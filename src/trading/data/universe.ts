/**
 * Tradeable Universe Definition
 *
 * Defines all assets the paper trading engine can trade.
 * 40 liquid ETFs covering all sectors + major assets + crypto.
 * All have high average daily volume (> 1M shares/day).
 */

export interface UniverseAsset {
  symbol: string;
  name: string;
  sector: string;
  assetClass: 'equity' | 'commodity' | 'fixed-income' | 'crypto' | 'international' | 'thematic';
  avgDailyVolume: number; // Average daily volume (shares)
  beta: number; // Beta vs SPY (1.0 = market, >1.0 = more volatile, <1.0 = less volatile)
  expense: number; // Expense ratio (annual %)
}

/**
 * Full tradeable universe (40 assets)
 */
export const TRADEABLE_UNIVERSE: UniverseAsset[] = [
  // Broad Market Indices (4)
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    sector: 'Broad Market',
    assetClass: 'equity',
    avgDailyVolume: 75_000_000,
    beta: 1.0,
    expense: 0.0945,
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust (Nasdaq 100)',
    sector: 'Technology',
    assetClass: 'equity',
    avgDailyVolume: 45_000_000,
    beta: 1.15,
    expense: 0.20,
  },
  {
    symbol: 'DIA',
    name: 'SPDR Dow Jones Industrial Average ETF',
    sector: 'Broad Market',
    assetClass: 'equity',
    avgDailyVolume: 3_500_000,
    beta: 0.95,
    expense: 0.16,
  },
  {
    symbol: 'IWM',
    name: 'iShares Russell 2000 ETF (Small Cap)',
    sector: 'Small Cap',
    assetClass: 'equity',
    avgDailyVolume: 28_000_000,
    beta: 1.10,
    expense: 0.19,
  },

  // Sector ETFs (10)
  {
    symbol: 'XLF',
    name: 'Financial Select Sector SPDR Fund',
    sector: 'Financials',
    assetClass: 'equity',
    avgDailyVolume: 55_000_000,
    beta: 1.12,
    expense: 0.10,
  },
  {
    symbol: 'XLE',
    name: 'Energy Select Sector SPDR Fund',
    sector: 'Energy',
    assetClass: 'equity',
    avgDailyVolume: 28_000_000,
    beta: 1.25,
    expense: 0.10,
  },
  {
    symbol: 'XLK',
    name: 'Technology Select Sector SPDR Fund',
    sector: 'Technology',
    assetClass: 'equity',
    avgDailyVolume: 12_000_000,
    beta: 1.20,
    expense: 0.10,
  },
  {
    symbol: 'XLV',
    name: 'Health Care Select Sector SPDR Fund',
    sector: 'Healthcare',
    assetClass: 'equity',
    avgDailyVolume: 12_000_000,
    beta: 0.85,
    expense: 0.10,
  },
  {
    symbol: 'XLI',
    name: 'Industrial Select Sector SPDR Fund',
    sector: 'Industrials',
    assetClass: 'equity',
    avgDailyVolume: 10_000_000,
    beta: 1.05,
    expense: 0.10,
  },
  {
    symbol: 'XLP',
    name: 'Consumer Staples Select Sector SPDR Fund',
    sector: 'Consumer Staples',
    assetClass: 'equity',
    avgDailyVolume: 8_000_000,
    beta: 0.70,
    expense: 0.10,
  },
  {
    symbol: 'XLU',
    name: 'Utilities Select Sector SPDR Fund',
    sector: 'Utilities',
    assetClass: 'equity',
    avgDailyVolume: 10_000_000,
    beta: 0.60,
    expense: 0.10,
  },
  {
    symbol: 'XLB',
    name: 'Materials Select Sector SPDR Fund',
    sector: 'Materials',
    assetClass: 'equity',
    avgDailyVolume: 5_000_000,
    beta: 1.10,
    expense: 0.10,
  },
  {
    symbol: 'XLRE',
    name: 'Real Estate Select Sector SPDR Fund',
    sector: 'Real Estate',
    assetClass: 'equity',
    avgDailyVolume: 3_500_000,
    beta: 0.90,
    expense: 0.10,
  },
  {
    symbol: 'XLC',
    name: 'Communication Services Select Sector SPDR Fund',
    sector: 'Communications',
    assetClass: 'equity',
    avgDailyVolume: 4_000_000,
    beta: 1.00,
    expense: 0.10,
  },

  // Commodities (4)
  {
    symbol: 'GLD',
    name: 'SPDR Gold Trust',
    sector: 'Precious Metals',
    assetClass: 'commodity',
    avgDailyVolume: 8_000_000,
    beta: 0.05,
    expense: 0.40,
  },
  {
    symbol: 'SLV',
    name: 'iShares Silver Trust',
    sector: 'Precious Metals',
    assetClass: 'commodity',
    avgDailyVolume: 12_000_000,
    beta: 0.15,
    expense: 0.50,
  },
  {
    symbol: 'USO',
    name: 'United States Oil Fund',
    sector: 'Energy',
    assetClass: 'commodity',
    avgDailyVolume: 18_000_000,
    beta: 0.45,
    expense: 0.79,
  },
  {
    symbol: 'UNG',
    name: 'United States Natural Gas Fund',
    sector: 'Energy',
    assetClass: 'commodity',
    avgDailyVolume: 3_000_000,
    beta: 0.30,
    expense: 1.06,
  },

  // Fixed Income (5)
  {
    symbol: 'TLT',
    name: 'iShares 20+ Year Treasury Bond ETF',
    sector: 'Treasury',
    assetClass: 'fixed-income',
    avgDailyVolume: 18_000_000,
    beta: -0.45,
    expense: 0.15,
  },
  {
    symbol: 'IEF',
    name: 'iShares 7-10 Year Treasury Bond ETF',
    sector: 'Treasury',
    assetClass: 'fixed-income',
    avgDailyVolume: 5_000_000,
    beta: -0.25,
    expense: 0.15,
  },
  {
    symbol: 'SHY',
    name: 'iShares 1-3 Year Treasury Bond ETF',
    sector: 'Treasury',
    assetClass: 'fixed-income',
    avgDailyVolume: 3_000_000,
    beta: -0.05,
    expense: 0.15,
  },
  {
    symbol: 'HYG',
    name: 'iShares iBoxx $ High Yield Corporate Bond ETF',
    sector: 'Corporate Bonds',
    assetClass: 'fixed-income',
    avgDailyVolume: 12_000_000,
    beta: 0.60,
    expense: 0.49,
  },
  {
    symbol: 'LQD',
    name: 'iShares iBoxx $ Investment Grade Corporate Bond ETF',
    sector: 'Corporate Bonds',
    assetClass: 'fixed-income',
    avgDailyVolume: 7_000_000,
    beta: 0.30,
    expense: 0.14,
  },

  // International (3)
  {
    symbol: 'EEM',
    name: 'iShares MSCI Emerging Markets ETF',
    sector: 'Emerging Markets',
    assetClass: 'international',
    avgDailyVolume: 32_000_000,
    beta: 1.15,
    expense: 0.68,
  },
  {
    symbol: 'EFA',
    name: 'iShares MSCI EAFE ETF (Developed Markets ex-US)',
    sector: 'Developed Markets',
    assetClass: 'international',
    avgDailyVolume: 18_000_000,
    beta: 0.95,
    expense: 0.32,
  },
  {
    symbol: 'VWO',
    name: 'Vanguard FTSE Emerging Markets ETF',
    sector: 'Emerging Markets',
    assetClass: 'international',
    avgDailyVolume: 10_000_000,
    beta: 1.12,
    expense: 0.08,
  },

  // Thematic/Niche (5)
  {
    symbol: 'JETS',
    name: 'U.S. Global Jets ETF (Airlines)',
    sector: 'Airlines',
    assetClass: 'thematic',
    avgDailyVolume: 2_500_000,
    beta: 1.40,
    expense: 0.60,
  },
  {
    symbol: 'SMH',
    name: 'VanEck Semiconductor ETF',
    sector: 'Semiconductors',
    assetClass: 'thematic',
    avgDailyVolume: 6_000_000,
    beta: 1.35,
    expense: 0.35,
  },
  {
    symbol: 'XBI',
    name: 'SPDR S&P Biotech ETF',
    sector: 'Biotech',
    assetClass: 'thematic',
    avgDailyVolume: 5_000_000,
    beta: 1.20,
    expense: 0.35,
  },
  {
    symbol: 'ARKK',
    name: 'ARK Innovation ETF (Disruptive Tech)',
    sector: 'Innovation',
    assetClass: 'thematic',
    avgDailyVolume: 8_000_000,
    beta: 1.50,
    expense: 0.75,
  },
  {
    symbol: 'LIT',
    name: 'Global X Lithium & Battery Tech ETF',
    sector: 'Battery Tech',
    assetClass: 'thematic',
    avgDailyVolume: 1_500_000,
    beta: 1.25,
    expense: 0.75,
  },

  // Crypto (3) — via CoinGecko, not traditional ETFs
  {
    symbol: 'BTC-USD',
    name: 'Bitcoin',
    sector: 'Cryptocurrency',
    assetClass: 'crypto',
    avgDailyVolume: 1_000_000_000, // Volume in USD, not shares
    beta: 1.80,
    expense: 0.0, // No expense ratio (direct holding simulation)
  },
  {
    symbol: 'ETH-USD',
    name: 'Ethereum',
    sector: 'Cryptocurrency',
    assetClass: 'crypto',
    avgDailyVolume: 500_000_000,
    beta: 2.00,
    expense: 0.0,
  },
  {
    symbol: 'SOL-USD',
    name: 'Solana',
    sector: 'Cryptocurrency',
    assetClass: 'crypto',
    avgDailyVolume: 200_000_000,
    beta: 2.50,
    expense: 0.0,
  },
];

/**
 * Get asset metadata by symbol
 */
export function getAsset(symbol: string): UniverseAsset | undefined {
  return TRADEABLE_UNIVERSE.find(a => a.symbol === symbol);
}

/**
 * Get all symbols in the universe
 */
export function getAllSymbols(): string[] {
  return TRADEABLE_UNIVERSE.map(a => a.symbol);
}

/**
 * Get symbols by asset class
 */
export function getSymbolsByAssetClass(
  assetClass: UniverseAsset['assetClass']
): string[] {
  return TRADEABLE_UNIVERSE.filter(a => a.assetClass === assetClass).map(a => a.symbol);
}

/**
 * Get symbols by sector
 */
export function getSymbolsBySector(sector: string): string[] {
  return TRADEABLE_UNIVERSE.filter(a => a.sector === sector).map(a => a.symbol);
}

/**
 * Check if symbol is in tradeable universe
 */
export function isTradeable(symbol: string): boolean {
  return TRADEABLE_UNIVERSE.some(a => a.symbol === symbol);
}

/**
 * Get all unique sectors
 */
export function getAllSectors(): string[] {
  const sectors = new Set(TRADEABLE_UNIVERSE.map(a => a.sector));
  return Array.from(sectors).sort();
}

/**
 * Get all unique asset classes
 */
export function getAllAssetClasses(): UniverseAsset['assetClass'][] {
  const classes = new Set(TRADEABLE_UNIVERSE.map(a => a.assetClass));
  return Array.from(classes);
}

/**
 * Sector to symbol mapping for quick lookups
 * Used by sentiment strategy to map news tone → tradeable ETFs
 */
export const SECTOR_TO_SYMBOLS: Record<string, string[]> = {
  'Technology': ['QQQ', 'XLK', 'SMH'],
  'Energy': ['XLE', 'USO', 'UNG'],
  'Financials': ['XLF'],
  'Healthcare': ['XLV', 'XBI'],
  'Industrials': ['XLI'],
  'Consumer Staples': ['XLP'],
  'Utilities': ['XLU'],
  'Materials': ['XLB'],
  'Real Estate': ['XLRE'],
  'Communications': ['XLC'],
  'Broad Market': ['SPY', 'DIA'],
  'Small Cap': ['IWM'],
  'Precious Metals': ['GLD', 'SLV'],
  'Airlines': ['JETS'],
  'Semiconductors': ['SMH'],
  'Biotech': ['XBI'],
  'Innovation': ['ARKK'],
  'Battery Tech': ['LIT'],
  'Emerging Markets': ['EEM', 'VWO'],
  'Developed Markets': ['EFA'],
  'Treasury': ['TLT', 'IEF', 'SHY'],
  'Corporate Bonds': ['HYG', 'LQD'],
  'Cryptocurrency': ['BTC-USD', 'ETH-USD', 'SOL-USD'],
};
