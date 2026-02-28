/**
 * CoinGecko Crypto Prices Edge Function
 *
 * Fetches prices for major cryptocurrencies. Optional demo API key via
 * COINGECKO_API_KEY env var. 1-minute cache.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface CryptoPrice {
  id: string;
  symbol: string;
  price: number;
  change24h: number;
}

const COIN_IDS = ['bitcoin', 'ethereum', 'solana', 'ripple'];

const SYMBOL_MAP: Record<string, string> = {
  bitcoin: 'BTC',
  ethereum: 'ETH',
  solana: 'SOL',
  ripple: 'XRP',
};

type CoinGeckoResponse = Record<
  string,
  {
    usd: number;
    usd_24h_change: number;
  }
>;

function buildUrl(): string {
  const apiKey = process.env.COINGECKO_API_KEY;
  const base = apiKey
    ? 'https://pro-api.coingecko.com/api/v3/simple/price'
    : 'https://api.coingecko.com/api/v3/simple/price';
  const params = new URLSearchParams({
    ids: COIN_IDS.join(','),
    vs_currencies: 'usd',
    include_24hr_change: 'true',
  });
  return `${base}?${params}`;
}

function buildHeaders(): HeadersInit {
  const apiKey = process.env.COINGECKO_API_KEY;
  return apiKey ? { 'x-cg-demo-api-key': apiKey } : {};
}

function normalize(raw: CoinGeckoResponse): CryptoPrice[] {
  return COIN_IDS.filter((id) => raw[id]).map((id) => ({
    id,
    symbol: SYMBOL_MAP[id] || id.toUpperCase(),
    price: raw[id]?.usd ?? 0,
    change24h: raw[id]?.usd_24h_change ?? 0,
  }));
}

export default withCors(async (_req: Request) => {
  const prices = await withCache<CryptoPrice[]>('market:crypto', 60, async () => {
    const res = await fetch(buildUrl(), { headers: buildHeaders() });
    if (!res.ok) throw new Error(`CoinGecko upstream error: ${res.status}`);
    const raw: CoinGeckoResponse = await res.json();
    return normalize(raw);
  });

  return new Response(JSON.stringify({ prices, count: prices.length, timestamp: Date.now() }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
    },
  });
});
