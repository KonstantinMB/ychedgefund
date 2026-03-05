/**
 * CoinGecko Crypto Prices Edge Function
 *
 * Strategy:
 *  1. Try /coins/markets (richer data: market cap, volume, 7d change) — requires demo key or no-auth free tier
 *  2. On 401/403/429, fall back to /simple/price (always free, no key needed) with basic fields
 *
 * 60-second cache. Never 500s — returns empty array on all errors.
 */

import { withCors } from '../_cors';
import { withCache } from '../_cache';

export const config = { runtime: 'edge' };

interface CryptoPrice {
  id: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
  marketCapRank: number;
}

/** Top 50+ crypto by market cap (CoinGecko IDs) */
const COIN_IDS = [
  'bitcoin', 'ethereum', 'tether', 'binancecoin', 'solana', 'ripple', 'usd-coin',
  'staked-ether', 'cardano', 'dogecoin', 'tron', 'avalanche-2', 'chainlink',
  'shiba-inu', 'polkadot', 'bitcoin-cash', 'polygon-ecosystem-token', 'litecoin',
  'uniswap', 'near', 'internet-computer', 'aptos', 'arbitrum',
  'optimism', 'injective-protocol', 'sui', 'render-token', 'fetch-ai',
  'pepe', 'the-open-network', 'hedera-hashgraph', 'filecoin', 'maker',
  'vechain', 'the-graph', 'algorand', 'ethereum-classic', 'stellar',
  'thorchain', 'floki', 'bonk', 'the-sandbox', 'axie-infinity',
  'decentraland', 'celestia', 'sei-network', 'jupiter-exchange-solana',
  'worldcoin-wld', 'arweave', 'curve-dao-token', 'lido-dao', 'pendle',
];

const SYMBOL_MAP: Record<string, string> = {
  bitcoin: 'BTC', ethereum: 'ETH', tether: 'USDT', binancecoin: 'BNB',
  solana: 'SOL', ripple: 'XRP', 'usd-coin': 'USDC', 'staked-ether': 'stETH',
  cardano: 'ADA', dogecoin: 'DOGE', tron: 'TRX', 'avalanche-2': 'AVAX',
  chainlink: 'LINK', 'shiba-inu': 'SHIB', polkadot: 'DOT', 'bitcoin-cash': 'BCH',
  'polygon-ecosystem-token': 'POL', litecoin: 'LTC', uniswap: 'UNI',
  near: 'NEAR', 'internet-computer': 'ICP', aptos: 'APT', arbitrum: 'ARB',
  optimism: 'OP', 'injective-protocol': 'INJ', sui: 'SUI', 'render-token': 'RENDER',
  'fetch-ai': 'FET', pepe: 'PEPE', 'the-open-network': 'TON', 'hedera-hashgraph': 'HBAR',
  filecoin: 'FIL', maker: 'MKR', vechain: 'VET', 'the-graph': 'GRT', algorand: 'ALGO',
  'ethereum-classic': 'ETC', stellar: 'XLM', thorchain: 'RUNE', floki: 'FLOKI',
  bonk: 'BONK', 'the-sandbox': 'SAND', 'axie-infinity': 'AXS', decentraland: 'MANA',
  celestia: 'TIA', 'sei-network': 'SEI', 'jupiter-exchange-solana': 'JUP',
  'worldcoin-wld': 'WLD', arweave: 'AR', 'curve-dao-token': 'CRV', 'lido-dao': 'LDO',
  pendle: 'PENDLE',
};

const NAME_MAP: Record<string, string> = {
  bitcoin: 'Bitcoin', ethereum: 'Ethereum', tether: 'Tether', binancecoin: 'BNB',
  solana: 'Solana', ripple: 'XRP', 'usd-coin': 'USDC', 'staked-ether': 'stETH',
  cardano: 'Cardano', dogecoin: 'Dogecoin', tron: 'TRON', 'avalanche-2': 'Avalanche',
  chainlink: 'Chainlink', 'shiba-inu': 'Shiba Inu', polkadot: 'Polkadot',
  'bitcoin-cash': 'Bitcoin Cash', 'polygon-ecosystem-token': 'Polygon', litecoin: 'Litecoin',
  uniswap: 'Uniswap', near: 'NEAR', 'internet-computer': 'Internet Computer', aptos: 'Aptos',
  arbitrum: 'Arbitrum', optimism: 'Optimism', 'injective-protocol': 'Injective', sui: 'Sui',
  'render-token': 'Render', 'fetch-ai': 'Fetch.ai', pepe: 'Pepe', 'the-open-network': 'Toncoin',
  'hedera-hashgraph': 'Hedera', filecoin: 'Filecoin', maker: 'Maker', vechain: 'VeChain',
  'the-graph': 'The Graph', algorand: 'Algorand', 'ethereum-classic': 'Ethereum Classic',
  stellar: 'Stellar', thorchain: 'THORChain', floki: 'Floki', bonk: 'Bonk',
  'the-sandbox': 'The Sandbox', 'axie-infinity': 'Axie Infinity', decentraland: 'Decentraland',
  celestia: 'Celestia', 'sei-network': 'Sei', 'jupiter-exchange-solana': 'Jupiter',
  'worldcoin-wld': 'Worldcoin', arweave: 'Arweave', 'curve-dao-token': 'Curve DAO',
  'lido-dao': 'Lido DAO', pendle: 'Pendle',
};

// ── /coins/markets (full data, requires demo key on pro endpoint) ─────────────

interface CoinGeckoMarketCoin {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  price_change_percentage_24h: number | null;
  price_change_percentage_7d_in_currency: number | null;
  market_cap: number | null;
  total_volume: number | null;
  market_cap_rank: number | null;
}

async function fetchMarkets(apiKey: string | undefined): Promise<CryptoPrice[] | null> {
  const base = apiKey
    ? 'https://pro-api.coingecko.com/api/v3/coins/markets'
    : 'https://api.coingecko.com/api/v3/coins/markets';

  const params = new URLSearchParams({
    vs_currency: 'usd',
    ids: COIN_IDS.join(','),
    order: 'market_cap_desc',
    per_page: '250',
    page: '1',
    sparkline: 'false',
    price_change_percentage: '24h,7d',
  });

  const headers: HeadersInit = apiKey ? { 'x-cg-demo-api-key': apiKey } : {};

  const res = await fetch(`${base}?${params}`, {
    headers,
    signal: AbortSignal.timeout(8_000),
  });

  // 401/403/429 means we need to fall back to /simple/price
  if (res.status === 401 || res.status === 403 || res.status === 429) return null;
  if (!res.ok) return null;

  const raw: CoinGeckoMarketCoin[] = await res.json();
  return raw.map((coin) => ({
    id: coin.id,
    symbol: SYMBOL_MAP[coin.id] ?? coin.symbol.toUpperCase(),
    name: coin.name,
    price: coin.current_price ?? 0,
    change24h: coin.price_change_percentage_24h ?? 0,
    change7d: coin.price_change_percentage_7d_in_currency ?? 0,
    marketCap: coin.market_cap ?? 0,
    volume24h: coin.total_volume ?? 0,
    marketCapRank: coin.market_cap_rank ?? 0,
  }));
}

// ── /simple/price (always free, no key needed) ────────────────────────────────

interface SimplePriceResponse {
  [id: string]: {
    usd: number;
    usd_24h_change: number;
    usd_market_cap: number;
    usd_24h_vol: number;
  };
}

async function fetchSimplePrice(): Promise<CryptoPrice[]> {
  const params = new URLSearchParams({
    ids: COIN_IDS.join(','),
    vs_currencies: 'usd',
    include_24hr_change: 'true',
    include_market_cap: 'true',
    include_24hr_vol: 'true',
  });

  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?${params}`,
    {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    }
  );

  if (!res.ok) return [];

  const raw: SimplePriceResponse = await res.json();

  return COIN_IDS
    .filter((id) => raw[id])
    .map((id, idx) => ({
      id,
      symbol: SYMBOL_MAP[id] ?? id.toUpperCase(),
      name: NAME_MAP[id] ?? id,
      price: raw[id]?.usd ?? 0,
      change24h: raw[id]?.usd_24h_change ?? 0,
      change7d: 0,           // not available in simple/price
      marketCap: raw[id]?.usd_market_cap ?? 0,
      volume24h: raw[id]?.usd_24h_vol ?? 0,
      marketCapRank: idx + 1, // approximate rank
    }));
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default withCors(async (_req: Request) => {
  let prices: CryptoPrice[] = [];

  try {
    prices = await withCache<CryptoPrice[]>('market:crypto:v2', 60, async () => {
      const apiKey = process.env.COINGECKO_API_KEY;

      // Try full market data first; fall back to simple price on auth/rate errors
      const marketData = await fetchMarkets(apiKey);
      if (marketData !== null && marketData.length > 0) return marketData;

      // Fallback: /simple/price — free, no key, always works
      return fetchSimplePrice();
    });
  } catch {
    prices = [];
  }

  const totalCryptoMarketCap = prices.reduce((sum, p) => sum + p.marketCap, 0);

  return new Response(
    JSON.stringify({
      prices,
      count: prices.length,
      totalCryptoMarketCap,
      timestamp: Date.now(),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    }
  );
});
