/**
 * POST /api/auth/login
 *
 * Body: { login: string, password: string }
 *   login can be email or username
 *
 * Returns: { success: true, token: string, user: { id, username, email } }
 * 401: Invalid credentials
 * 429: Rate limited (5 failed attempts per IP in 15 min)
 */

import { withCors } from '../_cors';
import { getAuthRedis, SESSION_TTL_SECONDS, RATE_LIMIT_TTL_SECONDS, MAX_LOGIN_ATTEMPTS } from './_redis';
import { verifyPassword, generateToken } from './_crypto';

export const config = { runtime: 'edge' };

interface LoginBody {
  login?: string;
  password?: string;
}

interface StoredUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

function getClientIp(req: Request): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
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

  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const login = typeof body.login === 'string' ? body.login.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!login || !password) {
    return jsonResponse({ error: 'Login and password are required' }, 400);
  }

  // Rate limit check
  const ip = getClientIp(req);
  const rateKey = `ratelimit:login:${ip}`;
  const attempts = await redis.incr(rateKey);
  if (attempts === 1) {
    await redis.expire(rateKey, RATE_LIMIT_TTL_SECONDS);
  }
  if (attempts > MAX_LOGIN_ATTEMPTS) {
    return jsonResponse(
      { error: 'Too many failed attempts. Try again in 15 minutes.' },
      429
    );
  }

  // Resolve user: email → username → user record
  let username: string;
  if (login.includes('@')) {
    const resolved = await redis.get<string>(`email:${login.toLowerCase()}`);
    if (!resolved) {
      return jsonResponse({ error: 'Invalid credentials' }, 401);
    }
    username = resolved;
  } else {
    username = login.toLowerCase();
  }

  const userRaw = await redis.get<string>(`user:${username}`);
  if (!userRaw) {
    return jsonResponse({ error: 'Invalid credentials' }, 401);
  }

  const user = typeof userRaw === 'string' ? (JSON.parse(userRaw) as StoredUser) : (userRaw as StoredUser);

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    return jsonResponse({ error: 'Invalid credentials' }, 401);
  }

  // Success — reset rate limit for this IP
  await redis.del(rateKey);

  // Create session
  const token = generateToken();
  const createdAt = Date.now();
  const expiresAt = createdAt + SESSION_TTL_SECONDS * 1000;
  const sessionData = {
    userId: user.id,
    username: user.username,
    email: user.email,
    createdAt,
    expiresAt,
  };
  await redis.set(`session:${token}`, JSON.stringify(sessionData), { ex: SESSION_TTL_SECONDS });

  return jsonResponse(
    {
      success: true,
      token,
      user: { id: user.id, username: user.username, email: user.email },
    },
    200
  );
});
