/**
 * GET /api/auth/me
 *
 * Header: Authorization: Bearer {token}
 * Returns: { id, username, email } if valid
 * 401: Missing, invalid, or expired session
 */

import { withCors } from '../_cors';
import { requireAuth } from './_middleware';

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

  const userOrError = await requireAuth(req);
  if (userOrError instanceof Response) return userOrError;

  return jsonResponse(userOrError, 200);
});
