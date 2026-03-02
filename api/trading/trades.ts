/**
 * Trade History Edge Function (Auth-required, per-user)
 *
 * GET /api/trading/trades?limit=100&offset=0
 *   - Requires auth
 *   - Fetches trades:{username} from Redis
 *   - Returns paginated trade history
 *
 * POST /api/trading/trades
 *   - Requires auth
 *   - Body: new Trade object
 *   - Appends to trades:{username}, keeps last 5000
 */

import { withCors } from '../_cors';
import { requireAuth } from '../auth/_middleware';
import { getAuthRedis } from '../auth/_redis';

export const config = { runtime: 'edge' };

const MAX_TRADES = 5_000;

function tradesKey(username: string): string {
  return `trades:${username}`;
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
  const userOrError = await requireAuth(req);
  if (userOrError instanceof Response) return userOrError;
  const user = userOrError;

  const redis = getAuthRedis();
  if (!redis) {
    return jsonResponse({ error: 'Storage unavailable' }, 503);
  }

  const key = tradesKey(user.username);

  // ── GET: paginated trades ───────────────────────────────────────────────
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '100', 10), 1, 500), 500);
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10), 0);

    const raw = await redis.get<string>(key);
    let trades: unknown[] = [];
    if (raw) {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        trades = Array.isArray(parsed) ? parsed : [];
      } catch {
        trades = [];
      }
    }

    const total = trades.length;
    const slice = trades.slice(offset, offset + limit);

    return jsonResponse({
      trades: slice,
      total,
      limit,
      offset,
      timestamp: Date.now(),
    }, 200);
  }

  // ── POST: append trade ───────────────────────────────────────────────────
  if (req.method === 'POST') {
    let trade: unknown;
    try {
      trade = await req.json();
    } catch {
      return jsonResponse({ error: 'Invalid JSON body' }, 400);
    }

    if (!trade || typeof trade !== 'object') {
      return jsonResponse({ error: 'Invalid trade object' }, 400);
    }

    const t = trade as Record<string, unknown>;
    if (typeof t.id !== 'string' || typeof t.symbol !== 'string') {
      return jsonResponse({ error: 'Trade must have id and symbol' }, 400);
    }

    const raw = await redis.get<string>(key);
    let trades: unknown[] = [];
    if (raw) {
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        trades = Array.isArray(parsed) ? parsed : [];
      } catch {
        trades = [];
      }
    }

    trades.push({ ...t, appendedAt: Date.now() });
    if (trades.length > MAX_TRADES) {
      trades = trades.slice(-MAX_TRADES);
    }

    await redis.set(key, trades);

    return jsonResponse({
      success: true,
      tradeId: (trade as Record<string, unknown>).id,
      timestamp: Date.now(),
    }, 200);
  }

  return jsonResponse({ error: 'Method not allowed' }, 405);
});
