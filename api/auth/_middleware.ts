/**
 * Auth middleware for protected endpoints
 *
 * requireAuth(req) extracts Bearer token, looks up session in Redis,
 * returns User if valid, 401 Response if not.
 * Auto-renewal: if session TTL < 7 days, extends by 30 days.
 */

import { getAuthRedis, SESSION_TTL_SECONDS } from './_redis';

export interface User {
  id: string;
  username: string;
  email: string;
  displayName?: string;
}

interface SessionData {
  userId: string;
  username: string;
  email: string;
  displayName?: string;
  createdAt: number;
  expiresAt: number;
}

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

/**
 * Extract Bearer token from Authorization header
 */
function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

/**
 * Require valid auth. Returns User if valid, 401 Response if not.
 * Auto-renewal: if session TTL < 7 days, extends by 30 days.
 *
 * Usage:
 *   const userOrError = await requireAuth(req);
 *   if (userOrError instanceof Response) return userOrError;
 *   const user = userOrError;
 */
export async function requireAuth(req: Request): Promise<User | Response> {
  const token = getBearerToken(req);
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const redis = getAuthRedis();
  if (!redis) {
    return new Response(
      JSON.stringify({ error: 'Auth service unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const key = `session:${token}`;
  const raw = await redis.get<string>(key);

  if (!raw) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired session' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const session = typeof raw === 'string' ? (JSON.parse(raw) as SessionData) : (raw as SessionData);

  if (session.expiresAt < Date.now()) {
    await redis.del(key);
    return new Response(
      JSON.stringify({ error: 'Session expired' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Auto-renewal: if TTL < 7 days, extend by 30 days
  const ttl = await redis.ttl(key);
  if (ttl >= 0 && ttl < SEVEN_DAYS_SECONDS) {
    await redis.expire(key, SESSION_TTL_SECONDS);
  }

  return {
    id: session.userId,
    username: session.username,
    email: session.email,
    displayName: session.displayName,
  };
}

/**
 * Require auth and return session with expiresAt. Used by /api/auth/session.
 */
export async function requireAuthWithSession(req: Request): Promise<{ user: User; expiresAt: number } | Response> {
  const token = getBearerToken(req);
  if (!token) {
    return new Response(
      JSON.stringify({ error: 'Missing or invalid Authorization header' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const redis = getAuthRedis();
  if (!redis) {
    return new Response(
      JSON.stringify({ error: 'Auth service unavailable' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const key = `session:${token}`;
  const raw = await redis.get<string>(key);

  if (!raw) {
    return new Response(
      JSON.stringify({ error: 'Invalid or expired session' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const session = typeof raw === 'string' ? (JSON.parse(raw) as SessionData) : (raw as SessionData);

  if (session.expiresAt < Date.now()) {
    await redis.del(key);
    return new Response(
      JSON.stringify({ error: 'Session expired' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Auto-renewal: if TTL < 7 days, extend by 30 days
  const ttl = await redis.ttl(key);
  if (ttl >= 0 && ttl < SEVEN_DAYS_SECONDS) {
    await redis.expire(key, SESSION_TTL_SECONDS);
    // Recompute expiresAt after extension
    session.expiresAt = Date.now() + SESSION_TTL_SECONDS * 1000;
  }

  return {
    user: {
      id: session.userId,
      username: session.username,
      email: session.email,
      displayName: session.displayName,
    },
    expiresAt: session.expiresAt,
  };
}
