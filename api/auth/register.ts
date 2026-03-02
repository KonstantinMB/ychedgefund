/**
 * POST /api/auth/register
 *
 * Body: { email: string, username: string, password: string }
 * Returns: { success: true, token: string, user: { id, username, email } }
 */

import { withCors } from '../_cors';
import { getAuthRedis, SESSION_TTL_SECONDS } from './_redis';
import { hashPassword, generateToken } from './_crypto';

export const config = { runtime: 'edge' };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;
const MIN_PASSWORD_LENGTH = 8;

interface RegisterBody {
  email?: string;
  username?: string;
  password?: string;
}

interface StoredUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

function validate(body: RegisterBody): { ok: true } | { ok: false; status: number; error: string } {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email) {
    return { ok: false, status: 400, error: 'Email is required' };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, status: 400, error: 'Invalid email format' };
  }

  if (!username) {
    return { ok: false, status: 400, error: 'Username is required' };
  }
  if (!USERNAME_REGEX.test(username)) {
    return {
      ok: false,
      status: 400,
      error: 'Username must be 3-20 chars, alphanumeric and underscores only, lowercase',
    };
  }

  if (!password) {
    return { ok: false, status: 400, error: 'Password is required' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, status: 400, error: 'Password must be at least 8 characters' };
  }

  return { ok: true };
}

function jsonResponse(data: object, status: number, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export default withCors(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const redis = getAuthRedis();
  if (!redis) {
    return jsonResponse({ error: 'Auth service unavailable' }, 503);
  }

  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const validation = validate(body);
  if (!validation.ok) {
    return jsonResponse({ error: validation.error }, validation.status);
  }

  const email = (body.email as string).trim().toLowerCase();
  const username = (body.username as string).trim().toLowerCase();
  const password = body.password as string;

  // Check username taken
  const existingUser = await redis.get<string>(`user:${username}`);
  if (existingUser) {
    return jsonResponse({ error: 'Username already taken' }, 409);
  }

  // Check email taken
  const existingEmail = await redis.get<string>(`email:${email}`);
  if (existingEmail) {
    return jsonResponse({ error: 'Email already registered' }, 409);
  }

  const passwordHash = await hashPassword(password);
  const id = `u_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;
  const createdAt = Date.now();

  const userRecord: StoredUser = {
    id,
    email,
    username,
    passwordHash,
    createdAt,
  };

  // Store user and email index (no TTL — permanent)
  await redis.set(`user:${username}`, JSON.stringify(userRecord));
  await redis.set(`email:${email}`, username);

  // Create session
  const token = generateToken();
  const expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  const sessionData = {
    userId: id,
    username,
    email,
    createdAt,
    expiresAt,
  };
  await redis.set(`session:${token}`, JSON.stringify(sessionData), { ex: SESSION_TTL_SECONDS });

  return jsonResponse(
    {
      success: true,
      token,
      user: { id, username, email },
    },
    200
  );
});
