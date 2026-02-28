/**
 * Fear & Greed Index Edge Function
 *
 * Fetches the Crypto Fear & Greed Index from alternative.me.
 * No API key required. 1-hour cache.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface FearGreedRaw {
  name: string;
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
    time_until_update?: string;
  }>;
}

interface FearGreedData {
  value: number;
  classification: string;
  timestamp: number;
  nextUpdate: number;
}

const FNG_URL = 'https://api.alternative.me/fng/?limit=1&format=json';

function normalize(raw: FearGreedRaw): FearGreedData {
  const entry = raw.data?.[0];
  if (!entry) {
    return {
      value: 50,
      classification: 'Neutral',
      timestamp: Date.now(),
      nextUpdate: Date.now() + 3600 * 1000,
    };
  }

  const ts = parseInt(entry.timestamp, 10) * 1000;
  const updateIn = parseInt(entry.time_until_update || '3600', 10) * 1000;

  return {
    value: parseInt(entry.value, 10),
    classification: entry.value_classification,
    timestamp: isNaN(ts) ? Date.now() : ts,
    nextUpdate: Date.now() + (isNaN(updateIn) ? 3600 * 1000 : updateIn),
  };
}

export default withCors(async (_req: Request) => {
  const data = await withCache<FearGreedData>('market:fear-greed', 3600, async () => {
    const res = await fetch(FNG_URL, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`Fear & Greed upstream error: ${res.status}`);
    const raw: FearGreedRaw = await res.json();
    return normalize(raw);
  });

  return new Response(JSON.stringify({ ...data, fetchedAt: Date.now() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
    },
  });
});
