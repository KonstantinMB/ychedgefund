/**
 * Cross-Asset Divergence Strategy
 *
 * Inputs: Prices from market-stream.ts
 * Track correlation pairs that historically revert:
 *   GLD vs DXY (inverse): when gold up + dollar up = anomaly → short GLD
 *   USO vs JETS (inverse): oil up → short airlines
 *   TLT vs SPY (regime): when both falling = stress → long GLD
 *   BTC vs QQQ (risk proxy): when BTC leads QQQ by >2 days = momentum signal
 * Z-score the spread of each pair over 20-day window
 * Signal when Z-score > 2.0 or < -2.0
 * Runs every 30 minutes
 */

import type { Signal } from '../../engine';
import { signalBus } from '../signal-bus';
import { getMarketStream } from '../../data/market-stream';

const STRATEGY_NAME = 'cross-asset';
const UPDATE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const LOOKBACK_PERIODS = 20; // 20-day window
const Z_SCORE_THRESHOLD = 2.0;

let updateTimer: number | null = null;

interface PriceHistory {
  symbol: string;
  prices: { timestamp: number; price: number }[];
}

const priceHistory: Map<string, PriceHistory> = new Map();

/**
 * Track price for a symbol
 */
function trackPrice(symbol: string, price: number): void {
  if (!priceHistory.has(symbol)) {
    priceHistory.set(symbol, { symbol, prices: [] });
  }

  const history = priceHistory.get(symbol)!;
  const now = Date.now();

  // Add new price
  history.prices.push({ timestamp: now, price });

  // Keep only last 25 days (buffer beyond 20-day window)
  const cutoff = now - 25 * 24 * 60 * 60 * 1000;
  history.prices = history.prices.filter(p => p.timestamp >= cutoff);
}

/**
 * Get recent prices for a symbol
 */
function getRecentPrices(symbol: string, days: number): number[] {
  const history = priceHistory.get(symbol);
  if (!history) return [];

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const recentPrices = history.prices
    .filter(p => p.timestamp >= cutoff)
    .map(p => p.price);

  return recentPrices;
}

/**
 * Calculate daily returns from prices
 */
function calculateReturns(prices: number[]): number[] {
  const returns: number[] = [];

  for (let i = 1; i < prices.length; i++) {
    const ret = (prices[i] - prices[i - 1]) / prices[i - 1];
    returns.push(ret);
  }

  return returns;
}

/**
 * Calculate Z-score of a spread
 */
function calculateZScore(values: number[]): number {
  if (values.length < 2) return 0;

  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const current = values[values.length - 1];
  return (current - mean) / stdDev;
}

/**
 * Analyze GLD vs DXY (inverse correlation)
 * Anomaly: Both moving up or both moving down
 */
function analyzeGoldDollar(): void {
  // For now, use GLD as proxy for gold (DXY not in our universe)
  // In production, would fetch DXY from market stream

  // Skip: DXY not available
}

/**
 * Analyze USO vs JETS (inverse correlation)
 * Oil up → airlines down (fuel costs)
 */
function analyzeOilAirlines(): void {
  const usoPrices = getRecentPrices('USO', LOOKBACK_PERIODS);
  const jetsPrices = getRecentPrices('JETS', LOOKBACK_PERIODS);

  if (usoPrices.length < 10 || jetsPrices.length < 10) return;

  const usoReturns = calculateReturns(usoPrices);
  const jetsReturns = calculateReturns(jetsPrices);

  // Calculate spread (USO return - (-JETS return) = USO + JETS)
  // Normally should be negative (inverse)
  const spreads: number[] = [];
  const minLen = Math.min(usoReturns.length, jetsReturns.length);

  for (let i = 0; i < minLen; i++) {
    spreads.push(usoReturns[i] + jetsReturns[i]); // Should be ~0 if inverse
  }

  const zScore = calculateZScore(spreads);

  // If Z-score > 2: correlation broken (both moving same direction)
  if (Math.abs(zScore) > Z_SCORE_THRESHOLD) {
    // USO up, JETS not down enough → short JETS
    const currentUSOReturn = usoReturns[usoReturns.length - 1];
    const currentJETSReturn = jetsReturns[jetsReturns.length - 1];

    if (currentUSOReturn > 0 && currentJETSReturn > -currentUSOReturn * 0.5) {
      const signal: Signal = {
        id: `cross-asset-JETS-${Date.now()}`,
        timestamp: Date.now(),
        strategy: STRATEGY_NAME,
        symbol: 'JETS',
        direction: 'SHORT',
        confidence: Math.min(0.6 + Math.abs(zScore) / 10, 0.8),
        reasoning: `Oil-airline correlation broken (Z=${zScore.toFixed(1)}σ). USO up ${(currentUSOReturn * 100).toFixed(1)}%, JETS should be down more. Fuel cost pressure.`,
        targetReturn: 0.04,
        stopLoss: 0.02,
        takeProfit: 0.04,
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
      };

      signalBus.publish(signal);
    }
  }
}

/**
 * Analyze TLT vs SPY (flight to safety)
 * Both falling = stress → long GLD
 */
function analyzeBondsEquities(): void {
  const tltPrices = getRecentPrices('TLT', LOOKBACK_PERIODS);
  const spyPrices = getRecentPrices('SPY', LOOKBACK_PERIODS);

  if (tltPrices.length < 10 || spyPrices.length < 10) return;

  const tltReturns = calculateReturns(tltPrices);
  const spyReturns = calculateReturns(spyPrices);

  const currentTLT = tltReturns[tltReturns.length - 1];
  const currentSPY = spyReturns[spyReturns.length - 1];

  // Both falling = stress/crisis
  if (currentTLT < -0.01 && currentSPY < -0.01) {
    const signal: Signal = {
      id: `cross-asset-GLD-${Date.now()}`,
      timestamp: Date.now(),
      strategy: STRATEGY_NAME,
      symbol: 'GLD',
      direction: 'LONG',
      confidence: 0.75,
      reasoning: `Both bonds (TLT ${(currentTLT * 100).toFixed(1)}%) and equities (SPY ${(currentSPY * 100).toFixed(1)}%) falling. Flight to safety → Gold.`,
      targetReturn: 0.05,
      stopLoss: 0.02,
      takeProfit: 0.05,
      expiresAt: Date.now() + 48 * 60 * 60 * 1000,
    };

    signalBus.publish(signal);
  }
}

/**
 * Analyze BTC vs QQQ (risk proxy)
 * BTC leads QQQ in risk-on/risk-off
 */
function analyzeCryptoTech(): void {
  const btcPrices = getRecentPrices('BTC-USD', LOOKBACK_PERIODS);
  const qqqPrices = getRecentPrices('QQQ', LOOKBACK_PERIODS);

  if (btcPrices.length < 10 || qqqPrices.length < 10) return;

  const btcReturns = calculateReturns(btcPrices);
  const qqqReturns = calculateReturns(qqqPrices);

  // Check if BTC has been leading QQQ up
  // Last 3 days: BTC up, QQQ flat/up less
  if (btcReturns.length >= 3 && qqqReturns.length >= 3) {
    const btcRecent = btcReturns.slice(-3);
    const qqqRecent = qqqReturns.slice(-3);

    const btcAvg = btcRecent.reduce((sum, r) => sum + r, 0) / 3;
    const qqqAvg = qqqRecent.reduce((sum, r) => sum + r, 0) / 3;

    // BTC leading up by > 2%
    if (btcAvg > qqqAvg + 0.02) {
      const signal: Signal = {
        id: `cross-asset-QQQ-${Date.now()}`,
        timestamp: Date.now(),
        strategy: STRATEGY_NAME,
        symbol: 'QQQ',
        direction: 'LONG',
        confidence: 0.65,
        reasoning: `BTC leading QQQ up over 3 days (BTC avg: ${(btcAvg * 100).toFixed(1)}%, QQQ: ${(qqqAvg * 100).toFixed(1)}%). Risk-on momentum signal.`,
        targetReturn: 0.05,
        stopLoss: 0.02,
        takeProfit: 0.05,
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
      };

      signalBus.publish(signal);
    }

    // BTC leading down by > 2%
    if (btcAvg < qqqAvg - 0.02) {
      const signal: Signal = {
        id: `cross-asset-QQQ-${Date.now()}`,
        timestamp: Date.now(),
        strategy: STRATEGY_NAME,
        symbol: 'QQQ',
        direction: 'SHORT',
        confidence: 0.65,
        reasoning: `BTC leading QQQ down over 3 days (BTC avg: ${(btcAvg * 100).toFixed(1)}%, QQQ: ${(qqqAvg * 100).toFixed(1)}%). Risk-off momentum signal.`,
        targetReturn: 0.05,
        stopLoss: 0.02,
        takeProfit: 0.05,
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
      };

      signalBus.publish(signal);
    }
  }
}

/**
 * Update cycle: analyze cross-asset relationships
 */
function updateCycle(): void {
  console.log('[CrossAssetStrategy] Running update cycle...');

  // Analyze all pairs
  analyzeOilAirlines();
  analyzeBondsEquities();
  analyzeCryptoTech();
}

/**
 * Initialize cross-asset strategy
 *
 * Subscribes to market stream to track prices.
 * Runs analysis every 30 minutes.
 */
export function initCrossAssetStrategy(): void {
  console.log('[CrossAssetStrategy] Initializing...');

  // Subscribe to market stream to track prices
  const stream = getMarketStream();

  stream.subscribe(tick => {
    trackPrice(tick.symbol, tick.price);
  });

  // Run analysis cycle immediately
  updateCycle();

  // Then every 30 minutes
  updateTimer = window.setInterval(() => {
    updateCycle();
  }, UPDATE_INTERVAL_MS);

  console.log('[CrossAssetStrategy] Initialized successfully');
}

/**
 * Shutdown cross-asset strategy (cleanup)
 */
export function shutdownCrossAssetStrategy(): void {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
  console.log('[CrossAssetStrategy] Shutdown complete');
}
