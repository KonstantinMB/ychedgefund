/**
 * POST /api/trading/portfolio/reset
 *
 * Requires auth. Archives current portfolio to portfolio:{username}:archived:{timestamp}
 * then saves fresh $1M portfolio.
 */

import { withCors } from '../../_cors';
import { requireAuth } from '../../auth/_middleware';
import { getAuthRedis } from '../../auth/_redis';

export const config = { runtime: 'edge' };

const STARTING_CAPITAL = 1_000_000;
const ARCHIVE_TTL = 90 * 24 * 60 * 60; // 90 days

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

  const userOrError = await requireAuth(req);
  if (userOrError instanceof Response) return userOrError;
  const user = userOrError;

  const redis = getAuthRedis();
  if (!redis) {
    return jsonResponse({ error: 'Storage unavailable' }, 503);
  }

  const key = `portfolio:${user.username}`;
  const now = Date.now();

  // Archive existing portfolio
  const existing = await redis.get(key);
  if (existing) {
    const archiveKey = `portfolio:${user.username}:archived:${now}`;
    await redis.set(archiveKey, existing, { ex: ARCHIVE_TTL });
  }

  const fresh = {
    cash: STARTING_CAPITAL,
    positions: [],
    closedTrades: [],
    realizedPnl: 0,
    highWaterMark: STARTING_CAPITAL,
    maxDrawdown: 0,
    dailyStartValue: STARTING_CAPITAL,
    equityCurve: [],
    savedAt: now,
    createdAt: now,
  };

  await redis.set(key, fresh);

  return jsonResponse({ success: true, data: fresh, timestamp: now }, 200);
});
