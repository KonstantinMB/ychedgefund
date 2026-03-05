/**
 * PATCH /api/auth/profile
 *
 * Body: { displayName?: string }
 * Updates the user's display name (2-30 chars). Shown on leaderboard when set.
 * Empty string clears display name.
 */

import { withCors } from '../_cors';
import { getAuthRedis, SESSION_TTL_SECONDS } from './_redis';
import { requireAuth } from './_middleware';

export const config = { runtime: 'edge' };

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 30;
const DISPLAY_NAME_REGEX = /^[\w\s\-.'()]+$/;

interface StoredUser {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  createdAt: number;
  displayName?: string;
}

function jsonResponse(data: object, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
}

export default withCors(async (req: Request) => {
  if (req.method !== 'PATCH') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const userOrError = await requireAuth(req);
  if (userOrError instanceof Response) return userOrError;
  const user = userOrError;

  const redis = getAuthRedis();
  if (!redis) {
    return jsonResponse({ error: 'Auth service unavailable' }, 503);
  }

  let body: { displayName?: string };
  try {
    body = (await req.json()) as { displayName?: string };
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const raw = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const displayName = raw === '' ? undefined : raw;

  if (displayName !== undefined) {
    if (displayName.length < DISPLAY_NAME_MIN) {
      return jsonResponse(
        { error: `Display name must be at least ${DISPLAY_NAME_MIN} characters` },
        400
      );
    }
    if (displayName.length > DISPLAY_NAME_MAX) {
      return jsonResponse(
        { error: `Display name must be at most ${DISPLAY_NAME_MAX} characters` },
        400
      );
    }
    if (!DISPLAY_NAME_REGEX.test(displayName)) {
      return jsonResponse(
        { error: 'Display name can only contain letters, numbers, spaces, and . \' - ( )' },
        400
      );
    }
  }

  const userRaw = await redis.get<string>(`user:${user.username}`);
  if (!userRaw) {
    return jsonResponse({ error: 'User not found' }, 404);
  }

  const stored = typeof userRaw === 'string' ? (JSON.parse(userRaw) as StoredUser) : (userRaw as StoredUser);
  const updated: StoredUser = {
    ...stored,
    displayName,
  };
  await redis.set(`user:${user.username}`, JSON.stringify(updated));

  // Update session so client gets new displayName on next /me
  const token = getBearerToken(req);
  if (token) {
    const sessionKey = `session:${token}`;
    const sessionRaw = await redis.get<string>(sessionKey);
    if (sessionRaw) {
      const session = typeof sessionRaw === 'string' ? JSON.parse(sessionRaw) : sessionRaw;
      session.displayName = displayName;
      await redis.set(sessionKey, JSON.stringify(session), { ex: SESSION_TTL_SECONDS });
    }
  }

  return jsonResponse(
    {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName,
      },
    },
    200
  );
});
