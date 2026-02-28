/**
 * Yahoo Finance Market Quotes Edge Function
 *
 * Fetches quotes for key market indicators: SPY, GLD, USO, EURUSD=X, VIX.
 * No API key required. 1-minute cache per symbol, unified response.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  timestamp: number;
}

const SYMBOLS = ['SPY', 'GLD', 'USO', 'EURUSD=X', '%5EVIX'];
const DISPLAY_SYMBOLS: Record<string, string> = {
  SPY: 'SPY',
  GLD: 'GLD',
  USO: 'USO',
  'EURUSD=X': 'EURUSD=X',
  '%5EVIX': 'VIX',
};

interface YahooMeta {
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  shortName?: string;
  longName?: string;
  symbol?: string;
}

interface YahooChart {
  chart: {
    result?: Array<{ meta: YahooMeta }>;
    error?: { message: string };
  };
}

async function fetchSymbol(symbol: string): Promise<MarketQuote | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const res = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json',
      },
    });

    if (!res.ok) return null;

    const data: YahooChart = await res.json();
    const result = data?.chart?.result?.[0];
    if (!result?.meta) return null;

    const meta = result.meta;
    const displaySymbol = DISPLAY_SYMBOLS[symbol] || symbol;

    return {
      symbol: displaySymbol,
      name: meta.shortName || meta.longName || displaySymbol,
      price: meta.regularMarketPrice ?? 0,
      changePercent: meta.regularMarketChangePercent ?? 0,
      timestamp: Date.now(),
    };
  } catch {
    return null;
  }
}

export default withCors(async (_req: Request) => {
  const quotes = await withCache<MarketQuote[]>('market:quotes:all', 60, async () => {
    const results = await Promise.allSettled(SYMBOLS.map((s) => fetchSymbol(s)));

    const quotes: MarketQuote[] = [];
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        quotes.push(result.value);
      }
    }

    if (quotes.length === 0) {
      throw new Error('All Yahoo Finance upstream fetches failed');
    }

    return quotes;
  });

  return new Response(JSON.stringify({ quotes, count: quotes.length, timestamp: Date.now() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
});
