/**
 * POST /api/auth/logout
 *
 * Header: Authorization: Bearer {token}
 * Deletes session from Redis.
 * Returns: { success: true }
 * Does not require valid session — always returns 200 (idempotent)
 */

import { withCors } from '../_cors';
import { getAuthRedis } from './_redis';

export const config = { runtime: 'edge' };

function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim() || null;
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

export default withCors(async (req: Request) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const token = getBearerToken(req);
  if (token) {
    const redis = getAuthRedis();
    if (redis) {
      await redis.del(`session:${token}`);
    }
  }

  return jsonResponse({ success: true }, 200);
});
