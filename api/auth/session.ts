/**
 * GET /api/auth/session
 *
 * Header: Authorization: Bearer {token}
 * Returns: { user: { id, username, email }, expiresAt: number }
 * Auto-renewal: if TTL < 7 days, extends by 30 days
 * 401: Missing, invalid, or expired session
 */

import { withCors } from '../_cors';
import { requireAuthWithSession } from './_middleware';

export const config = { runtime: 'edge' };

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
  if (req.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const result = await requireAuthWithSession(req);
  if (result instanceof Response) return result;

  return jsonResponse(
    { user: result.user, expiresAt: result.expiresAt },
    200
  );
});
