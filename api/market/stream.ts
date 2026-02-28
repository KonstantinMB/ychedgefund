/**
 * Market Data Stream Edge Function
 *
 * Proxies Finnhub REST quotes for the full tradeable universe.
 * Batches requests: 5 symbols per Finnhub call (free tier limit).
 * Falls back to Yahoo Finance if Finnhub unavailable.
 * Caches 15 seconds.
 *
 * Returns: { [symbol]: MarketTick }
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface MarketTick {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
}

// Tradeable universe (40 symbols)
const SYMBOLS = [
  // Broad Market (4)
  'SPY',
  'QQQ',
  'DIA',
  'IWM',

  // Sectors (10)
  'XLF',
  'XLE',
  'XLK',
  'XLV',
  'XLI',
  'XLP',
  'XLU',
  'XLB',
  'XLRE',
  'XLC',

  // Commodities (4)
  'GLD',
  'SLV',
  'USO',
  'UNG',

  // Fixed Income (5)
  'TLT',
  'IEF',
  'SHY',
  'HYG',
  'LQD',

  // International (3)
  'EEM',
  'EFA',
  'VWO',

  // Thematic (5)
  'JETS',
  'SMH',
  'XBI',
  'ARKK',
  'LIT',
];

/**
 * Fetch quote from Finnhub REST API
 */
async function fetchFromFinnhub(symbol: string, apiKey: string): Promise<MarketTick | null> {
  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;

    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      console.error(`[MarketStream] Finnhub fetch failed for ${symbol}: ${response.status}`);
      return null;
    }

    const data: any = await response.json();

    // Finnhub returns: { c: current, h: high, l: low, o: open, pc: previous close, t: timestamp }
    const price = data.c;
    const timestamp = data.t * 1000; // Convert to ms

    if (!price || price === 0) {
      return null;
    }

    return {
      symbol,
      price,
      bid: price, // Finnhub quote endpoint doesn't provide bid/ask
      ask: price,
      volume: 0, // Not provided in quote endpoint
      timestamp,
    };
  } catch (error) {
    console.error(`[MarketStream] Finnhub error for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch quote from Yahoo Finance REST API (fallback)
 */
async function fetchFromYahoo(symbol: string): Promise<MarketTick | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1m&range=1d`;

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const data: any = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result?.meta?.regularMarketPrice) {
      return null;
    }

    const meta = result.meta;

    return {
      symbol,
      price: meta.regularMarketPrice,
      bid: meta.bid || meta.regularMarketPrice,
      ask: meta.ask || meta.regularMarketPrice,
      volume: meta.regularMarketVolume || 0,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error(`[MarketStream] Yahoo error for ${symbol}:`, error);
    return null;
  }
}

/**
 * Fetch quotes for all symbols
 */
async function fetchAllQuotes(): Promise<Record<string, MarketTick>> {
  const apiKey = process.env.FINNHUB_API_KEY;
  const quotes: Record<string, MarketTick> = {};

  if (apiKey) {
    // Use Finnhub (batched to respect rate limits)
    console.log('[MarketStream] Fetching from Finnhub...');

    // Fetch in batches of 5 (Finnhub free tier: 60 req/min = 1 req/sec)
    const batchSize = 5;
    for (let i = 0; i < SYMBOLS.length; i += batchSize) {
      const batch = SYMBOLS.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(symbol => fetchFromFinnhub(symbol, apiKey))
      );

      results.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          quotes[batch[index]] = result.value;
        }
      });

      // Small delay between batches to respect rate limit
      if (i + batchSize < SYMBOLS.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log(`[MarketStream] Finnhub returned ${Object.keys(quotes).length} quotes`);
  }

  // Fallback to Yahoo for missing symbols
  const missingSymbols = SYMBOLS.filter(s => !quotes[s]);

  if (missingSymbols.length > 0) {
    console.log(`[MarketStream] Fetching ${missingSymbols.length} missing symbols from Yahoo...`);

    const results = await Promise.allSettled(
      missingSymbols.map(symbol => fetchFromYahoo(symbol))
    );

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value) {
        quotes[missingSymbols[index]] = result.value;
      }
    });

    console.log(`[MarketStream] Yahoo returned ${Object.keys(quotes).length} total quotes`);
  }

  // If still missing quotes, log warning
  const finalMissing = SYMBOLS.filter(s => !quotes[s]);
  if (finalMissing.length > 0) {
    console.warn(`[MarketStream] Missing quotes for: ${finalMissing.join(', ')}`);
  }

  return quotes;
}

export default withCors(async (_req: Request) => {
  try {
    const quotes = await withCache<Record<string, MarketTick>>(
      'market:stream:v1',
      15, // 15-second cache
      async () => {
        const data = await fetchAllQuotes();

        if (Object.keys(data).length === 0) {
          throw new Error('All market data upstream fetches failed');
        }

        return data;
      }
    );

    return new Response(
      JSON.stringify({
        quotes,
        count: Object.keys(quotes).length,
        timestamp: Date.now(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
        },
      }
    );
  } catch (error) {
    console.error('[MarketStream] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Failed to fetch market data',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
