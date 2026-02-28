/**
 * Finnhub Stock Quotes Edge Function
 *
 * Fetches real-time quotes for key ETFs from Finnhub.
 * Requires free Finnhub API key (60 req/min). 30-second cache.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface FinnhubQuote {
  c: number;   // current price
  d: number;   // change
  dp: number;  // change percent
  h: number;   // high
  l: number;   // low
  o: number;   // open
  pc: number;  // previous close
  t: number;   // timestamp
}

interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  timestamp: number;
}

const SYMBOLS = ['SPY', 'QQQ', 'IEF', 'GLD', 'USO', 'EEM', 'TLT'];

async function fetchQuote(symbol: string, apiKey: string): Promise<StockQuote> {
  const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Finnhub error for ${symbol}: ${res.status}`);

  const data: FinnhubQuote = await res.json();
  return {
    symbol,
    price: data.c ?? 0,
    change: data.d ?? 0,
    changePercent: data.dp ?? 0,
    high: data.h ?? 0,
    low: data.l ?? 0,
    timestamp: (data.t ?? 0) * 1000,
  };
}

export default withCors(async (_req: Request) => {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    return new Response(
      JSON.stringify({
        quotes: [],
        source: 'finnhub',
        error: 'API key not configured',
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const quotes = await withCache<StockQuote[]>('market:quotes:finnhub', 30, async () => {
    const results = await Promise.allSettled(
      SYMBOLS.map(s => fetchQuote(s, apiKey))
    );

    return results
      .filter((r): r is PromiseFulfilledResult<StockQuote> => r.status === 'fulfilled')
      .map(r => r.value);
  });

  return new Response(
    JSON.stringify({ quotes, count: quotes.length, source: 'finnhub', timestamp: Date.now() }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    }
  );
});
