/**
 * Historical Market Data & Technical Indicators
 *
 * Fetches historical OHLCV from Stooq (free CSV, no API key needed).
 * Calculates: SMA(20), SMA(50), RSI(14), ATR(14), Bollinger Bands.
 * Stores in IndexedDB for fast local access.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface OHLCV {
  timestamp: number; // Unix ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  symbol: string;
  timestamp: number;
  sma20: number;
  sma50: number;
  rsi14: number;
  atr14: number;
  bollingerUpper: number;
  bollingerMiddle: number;
  bollingerLower: number;
  candles: OHLCV[]; // Last 60 days
}

interface MarketDataDB extends DBSchema {
  ohlcv: {
    key: string; // symbol
    value: {
      symbol: string;
      candles: OHLCV[];
      lastUpdate: number;
    };
  };
  indicators: {
    key: string; // symbol
    value: TechnicalIndicators;
  };
}

let db: IDBPDatabase<MarketDataDB> | null = null;

/**
 * Initialize IndexedDB
 */
async function getDB(): Promise<IDBPDatabase<MarketDataDB>> {
  if (db) return db;

  db = await openDB<MarketDataDB>('atlas-market-data', 1, {
    upgrade(database) {
      // OHLCV candles store
      if (!database.objectStoreNames.contains('ohlcv')) {
        database.createObjectStore('ohlcv', { keyPath: 'symbol' });
      }

      // Technical indicators store
      if (!database.objectStoreNames.contains('indicators')) {
        database.createObjectStore('indicators', { keyPath: 'symbol' });
      }
    },
  });

  return db;
}

/**
 * Fetch historical data from Stooq (free CSV, no key needed)
 *
 * URL pattern: https://stooq.com/q/d/l/?s={symbol}&d1={start}&d2={end}&i=d
 * Example: https://stooq.com/q/d/l/?s=spy.us&i=d (all history)
 *
 * CSV format:
 * Date,Open,High,Low,Close,Volume
 * 2024-02-28,452.30,455.10,451.20,454.50,75231000
 */
async function fetchFromStooq(symbol: string): Promise<OHLCV[]> {
  // Stooq uses lowercase with .us suffix for US stocks/ETFs
  const stooqSymbol = symbol.toLowerCase().replace('-usd', '');
  const suffix = symbol.includes('-USD') ? '' : '.us'; // Crypto has no suffix
  const url = `https://stooq.com/q/d/l/?s=${stooqSymbol}${suffix}&i=d`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Stooq fetch failed: ${response.status}`);
    }

    const csv = await response.text();
    return parseStooqCSV(csv);
  } catch (error) {
    console.error(`[Historical] Stooq fetch failed for ${symbol}:`, error);

    // Fallback to Yahoo Finance if Stooq fails
    return fetchFromYahoo(symbol);
  }
}

/**
 * Parse Stooq CSV format
 */
function parseStooqCSV(csv: string): OHLCV[] {
  const lines = csv.trim().split('\n');

  // Skip header
  const dataLines = lines.slice(1);

  const candles: OHLCV[] = [];

  for (const line of dataLines) {
    if (!line.trim()) continue;

    const [dateStr, openStr, highStr, lowStr, closeStr, volumeStr] = line.split(',');

    const timestamp = new Date(dateStr).getTime();
    const open = parseFloat(openStr);
    const high = parseFloat(highStr);
    const low = parseFloat(lowStr);
    const close = parseFloat(closeStr);
    const volume = parseInt(volumeStr, 10);

    // Skip invalid rows
    if (
      isNaN(timestamp) ||
      isNaN(open) ||
      isNaN(high) ||
      isNaN(low) ||
      isNaN(close) ||
      isNaN(volume)
    ) {
      continue;
    }

    candles.push({ timestamp, open, high, low, close, volume });
  }

  // Sort by timestamp ascending (oldest first)
  candles.sort((a, b) => a.timestamp - b.timestamp);

  return candles;
}

/**
 * Fallback: Fetch from Yahoo Finance if Stooq fails
 */
async function fetchFromYahoo(symbol: string): Promise<OHLCV[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=60d`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Yahoo fetch failed: ${response.status}`);
    }

    const data: any = await response.json();
    const result = data?.chart?.result?.[0];

    if (!result) {
      throw new Error('Yahoo response missing result');
    }

    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0];

    if (!quotes) {
      throw new Error('Yahoo response missing quotes');
    }

    const candles: OHLCV[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i] * 1000; // Yahoo uses seconds
      const open = quotes.open?.[i];
      const high = quotes.high?.[i];
      const low = quotes.low?.[i];
      const close = quotes.close?.[i];
      const volume = quotes.volume?.[i];

      if (
        open !== null &&
        high !== null &&
        low !== null &&
        close !== null &&
        volume !== null
      ) {
        candles.push({ timestamp, open, high, low, close, volume });
      }
    }

    return candles;
  } catch (error) {
    console.error(`[Historical] Yahoo fallback failed for ${symbol}:`, error);
    return [];
  }
}

/**
 * Calculate Simple Moving Average
 */
function calculateSMA(closes: number[], period: number): number {
  if (closes.length < period) return closes[closes.length - 1] || 0;

  const slice = closes.slice(-period);
  const sum = slice.reduce((acc, val) => acc + val, 0);
  return sum / period;
}

/**
 * Calculate RSI (Relative Strength Index)
 * Standard 14-period RSI
 */
function calculateRSI(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50; // Neutral if insufficient data

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    changes.push(closes[i] - closes[i - 1]);
  }

  const recentChanges = changes.slice(-period);

  const gains = recentChanges.filter(c => c > 0);
  const losses = recentChanges.filter(c => c < 0).map(c => Math.abs(c));

  const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  return rsi;
}

/**
 * Calculate ATR (Average True Range)
 * Measures volatility
 */
function calculateATR(candles: OHLCV[], period = 14): number {
  if (candles.length < period + 1) return 0;

  const trueRanges: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );

    trueRanges.push(tr);
  }

  const recentTR = trueRanges.slice(-period);
  const atr = recentTR.reduce((acc, val) => acc + val, 0) / period;

  return atr;
}

/**
 * Calculate Bollinger Bands
 * Middle = 20-day SMA
 * Upper = Middle + (2 * StdDev)
 * Lower = Middle - (2 * StdDev)
 */
function calculateBollingerBands(
  closes: number[],
  period = 20,
  stdDevMultiplier = 2
): { upper: number; middle: number; lower: number } {
  const middle = calculateSMA(closes, period);

  if (closes.length < period) {
    return { upper: middle, middle, lower: middle };
  }

  const slice = closes.slice(-period);
  const mean = middle;
  const squaredDiffs = slice.map(c => Math.pow(c - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
  const stdDev = Math.sqrt(variance);

  return {
    upper: middle + stdDevMultiplier * stdDev,
    middle,
    lower: middle - stdDevMultiplier * stdDev,
  };
}

/**
 * Calculate all technical indicators for a symbol
 */
function calculateIndicators(symbol: string, candles: OHLCV[]): TechnicalIndicators {
  const closes = candles.map(c => c.close);

  const sma20 = calculateSMA(closes, 20);
  const sma50 = calculateSMA(closes, 50);
  const rsi14 = calculateRSI(closes, 14);
  const atr14 = calculateATR(candles, 14);
  const bollinger = calculateBollingerBands(closes, 20, 2);

  return {
    symbol,
    timestamp: Date.now(),
    sma20,
    sma50,
    rsi14,
    atr14,
    bollingerUpper: bollinger.upper,
    bollingerMiddle: bollinger.middle,
    bollingerLower: bollinger.lower,
    candles: candles.slice(-60), // Keep last 60 days
  };
}

/**
 * Get historical data and technical indicators for a symbol
 *
 * Flow:
 * 1. Check IndexedDB cache (fresh if < 24 hours old)
 * 2. If stale or missing, fetch from Stooq
 * 3. Calculate indicators
 * 4. Store in IndexedDB
 * 5. Return indicators
 */
export async function getHistoricalData(symbol: string): Promise<TechnicalIndicators> {
  const database = await getDB();

  // Check cache
  const cached = await database.get('indicators', symbol);
  if (cached && Date.now() - cached.timestamp < 24 * 60 * 60 * 1000) {
    return cached;
  }

  // Fetch fresh data
  const candles = await fetchFromStooq(symbol);

  if (candles.length === 0) {
    throw new Error(`No historical data available for ${symbol}`);
  }

  // Calculate indicators
  const indicators = calculateIndicators(symbol, candles);

  // Store in IndexedDB
  await database.put('ohlcv', {
    symbol,
    candles,
    lastUpdate: Date.now(),
  });
  await database.put('indicators', indicators);

  return indicators;
}

/**
 * Backfill multiple symbols in parallel
 */
export async function backfillSymbols(symbols: string[]): Promise<void> {
  console.log(`[Historical] Backfilling ${symbols.length} symbols...`);

  const start = Date.now();

  // Fetch in parallel (batches of 10 to avoid rate limits)
  const batchSize = 10;
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);

    await Promise.allSettled(
      batch.map(symbol =>
        getHistoricalData(symbol).catch(err => {
          console.error(`[Historical] Failed to backfill ${symbol}:`, err);
        })
      )
    );

    // Small delay between batches
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log(`[Historical] Backfill complete in ${elapsed}s`);
}

/**
 * Get cached indicators (no fetch)
 */
export async function getCachedIndicators(
  symbol: string
): Promise<TechnicalIndicators | null> {
  const database = await getDB();
  return (await database.get('indicators', symbol)) || null;
}

/**
 * Clear all historical data (for testing)
 */
export async function clearHistoricalData(): Promise<void> {
  const database = await getDB();
  await database.clear('ohlcv');
  await database.clear('indicators');
  console.log('[Historical] All data cleared');
}
