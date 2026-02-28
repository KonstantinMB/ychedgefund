/**
 * Portfolio Persistence Edge Function
 *
 * POST /api/trading/portfolio
 *   Body: { snapshot: PortfolioSnapshot, equityCurve: EquityPoint[] }
 *   Saves to Upstash Redis with a 30-day TTL.
 *   Returns 200 on success, 204 when Redis is unconfigured.
 *
 * GET /api/trading/portfolio
 *   Returns the last saved portfolio snapshot from Redis (for cross-device access).
 *
 * Cache: no caching — always returns fresh data.
 */

import { withCors } from '../_cors';

export const config = { runtime: 'edge' };

const REDIS_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days
const REDIS_KEY = 'atlas:portfolio:v2';

interface RedisSetRequest {
  snapshot: unknown;
  equityCurve: unknown[];
}

// ── Redis helpers (Upstash REST API) ─────────────────────────────────────────

function getRedisConfig(): { url: string; token: string } | null {
  const url   = (typeof process !== 'undefined' ? process.env.UPSTASH_REDIS_REST_URL   : undefined)
    ?? (globalThis as Record<string, unknown>)['UPSTASH_REDIS_REST_URL'] as string | undefined;
  const token = (typeof process !== 'undefined' ? process.env.UPSTASH_REDIS_REST_TOKEN : undefined)
    ?? (globalThis as Record<string, unknown>)['UPSTASH_REDIS_REST_TOKEN'] as string | undefined;

  if (!url || !token) return null;
  return { url, token };
}

async function redisSet(key: string, value: unknown, ttl: number): Promise<boolean> {
  const cfg = getRedisConfig();
  if (!cfg) return false;

  const res = await fetch(`${cfg.url}/set/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      value: JSON.stringify(value),
      ex: ttl,
    }),
    signal: AbortSignal.timeout(4_000),
  });

  return res.ok;
}

async function redisGet(key: string): Promise<unknown | null> {
  const cfg = getRedisConfig();
  if (!cfg) return null;

  const res = await fetch(`${cfg.url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${cfg.token}` },
    signal: AbortSignal.timeout(4_000),
  });

  if (!res.ok) return null;

  const body = await res.json() as { result: string | null };
  if (!body.result) return null;

  try {
    return JSON.parse(body.result);
  } catch {
    return null;
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default withCors(async (req: Request) => {
  // ── GET: retrieve saved portfolio ─────────────────────────────────────────
  if (req.method === 'GET') {
    if (!getRedisConfig()) {
      return new Response(JSON.stringify({ error: 'Redis not configured' }), {
        status: 204,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await redisGet(REDIS_KEY).catch(() => null);

    return new Response(JSON.stringify({ data, timestamp: Date.now() }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  // ── POST: save portfolio ──────────────────────────────────────────────────
  if (req.method === 'POST') {
    let body: RedisSetRequest;
    try {
      body = await req.json() as RedisSetRequest;
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!getRedisConfig()) {
      // Redis not configured — acknowledge but don't fail (localStorage is primary)
      return new Response(JSON.stringify({ saved: false, reason: 'Redis not configured' }), {
        status: 204,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload = {
      snapshot: body.snapshot,
      equityCurve: body.equityCurve,
      savedAt: Date.now(),
    };

    const ok = await redisSet(REDIS_KEY, payload, REDIS_TTL_SECONDS).catch(() => false);

    return new Response(JSON.stringify({ saved: ok, timestamp: Date.now() }), {
      status: ok ? 200 : 500,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  }

  return new Response('Method not allowed', { status: 405 });
});
