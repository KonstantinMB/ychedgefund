/**
 * Momentum Strategy (Technical Analysis)
 *
 * Inputs: Historical OHLCV + calculated indicators from historical.ts
 * Logic:
 *   LONG when: price crosses above SMA(50) AND RSI > 50 AND RSI < 70
 *   SHORT when: price crosses below SMA(50) AND RSI < 50 AND RSI > 30
 * Confidence: based on distance from SMA and RSI extremity
 * Runs every time new price data arrives (~15 sec)
 * Filters: Only trade when ATR > 0.5% (enough volatility to profit)
 */

import type { Signal } from '../../engine';
import { signalBus } from '../signal-bus';
import { getMarketStream, type MarketTick } from '../../data/market-stream';
import { getCachedIndicators } from '../../data/historical';
import { getAllSymbols } from '../../data/universe';

const STRATEGY_NAME = 'momentum';
const MIN_ATR_PCT = 0.005; // 0.5% minimum volatility

interface MomentumState {
  previousPrices: Map<string, number>; // Track for crossover detection
}

const state: MomentumState = {
  previousPrices: new Map(),
};

/**
 * Analyze a single symbol for momentum signals
 */
async function analyzeMomentumSignal(tick: MarketTick): Promise<void> {
  const { symbol, price } = tick;

  // Skip crypto for momentum strategy (use different parameters)
  if (symbol.includes('-USD')) return;

  // Get technical indicators
  const indicators = await getCachedIndicators(symbol);
  if (!indicators) return;

  const { sma20, sma50, rsi14, atr14 } = indicators;

  // Filter: Skip if volatility too low
  const atrPct = atr14 / price;
  if (atrPct < MIN_ATR_PCT) {
    return; // Not enough volatility to profit
  }

  // Get previous price for crossover detection
  const prevPrice = state.previousPrices.get(symbol);
  state.previousPrices.set(symbol, price);

  if (!prevPrice) {
    // First time seeing this symbol, skip (need previous price for crossover)
    return;
  }

  // Detect crossovers
  const prevAboveSMA50 = prevPrice > sma50;
  const nowAboveSMA50 = price > sma50;

  const bullishCrossover = !prevAboveSMA50 && nowAboveSMA50;
  const bearishCrossover = prevAboveSMA50 && !nowAboveSMA50;

  // LONG signal: price crosses above SMA(50) AND RSI > 50 AND RSI < 70
  if (bullishCrossover && rsi14 > 50 && rsi14 < 70) {
    const distanceFromSMA = (price - sma50) / sma50;
    const rsiStrength = (rsi14 - 50) / 20; // 0 at RSI 50, 1 at RSI 70

    // Confidence based on RSI position and distance from SMA
    const confidence = Math.min(0.6 + rsiStrength * 0.3, 0.85);

    const signal: Signal = {
      id: `momentum-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
      strategy: STRATEGY_NAME,
      symbol,
      direction: 'LONG',
      confidence,
      reasoning: `Price crossed above 50-day SMA at $${sma50.toFixed(2)}. RSI at ${rsi14.toFixed(1)} indicates momentum without overbought. ATR: ${(atrPct * 100).toFixed(2)}%`,
      targetReturn: 0.05, // 5% target
      stopLoss: 0.02, // 2% stop
      takeProfit: 0.05, // 5% take profit
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    signalBus.publish(signal);
  }

  // SHORT signal: price crosses below SMA(50) AND RSI < 50 AND RSI > 30
  if (bearishCrossover && rsi14 < 50 && rsi14 > 30) {
    const distanceFromSMA = (sma50 - price) / sma50;
    const rsiStrength = (50 - rsi14) / 20; // 0 at RSI 50, 1 at RSI 30

    // Confidence based on RSI position and distance from SMA
    const confidence = Math.min(0.6 + rsiStrength * 0.3, 0.85);

    const signal: Signal = {
      id: `momentum-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
      strategy: STRATEGY_NAME,
      symbol,
      direction: 'SHORT',
      confidence,
      reasoning: `Price crossed below 50-day SMA at $${sma50.toFixed(2)}. RSI at ${rsi14.toFixed(1)} indicates downward momentum without oversold. ATR: ${(atrPct * 100).toFixed(2)}%`,
      targetReturn: 0.05, // 5% target
      stopLoss: 0.02, // 2% stop
      takeProfit: 0.05, // 5% take profit
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
    };

    signalBus.publish(signal);
  }

  // Alternative: Strong momentum signal when price significantly above/below SMA50
  // (even without crossover, if we have strong RSI confirmation)
  const distancePct = Math.abs(price - sma50) / sma50;

  if (distancePct > 0.03 && distancePct < 0.10) {
    // 3-10% from SMA
    if (price > sma50 && rsi14 > 60 && rsi14 < 75) {
      // Strong uptrend
      const confidence = Math.min(0.5 + (rsi14 - 60) / 30, 0.75);

      const signal: Signal = {
        id: `momentum-strong-${symbol}-${Date.now()}`,
        timestamp: Date.now(),
        strategy: `${STRATEGY_NAME}-strong`,
        symbol,
        direction: 'LONG',
        confidence,
        reasoning: `Price ${(distancePct * 100).toFixed(1)}% above 50-day SMA with RSI at ${rsi14.toFixed(1)}. Strong uptrend momentum.`,
        targetReturn: 0.07, // 7% target (higher for strong momentum)
        stopLoss: 0.03, // 3% stop
        takeProfit: 0.07,
        expiresAt: Date.now() + 48 * 60 * 60 * 1000, // 48 hours
      };

      signalBus.publish(signal);
    } else if (price < sma50 && rsi14 < 40 && rsi14 > 25) {
      // Strong downtrend
      const confidence = Math.min(0.5 + (40 - rsi14) / 30, 0.75);

      const signal: Signal = {
        id: `momentum-strong-${symbol}-${Date.now()}`,
        timestamp: Date.now(),
        strategy: `${STRATEGY_NAME}-strong`,
        symbol,
        direction: 'SHORT',
        confidence,
        reasoning: `Price ${(distancePct * 100).toFixed(1)}% below 50-day SMA with RSI at ${rsi14.toFixed(1)}. Strong downtrend momentum.`,
        targetReturn: 0.07, // 7% target
        stopLoss: 0.03, // 3% stop
        takeProfit: 0.07,
        expiresAt: Date.now() + 48 * 60 * 60 * 1000, // 48 hours
      };

      signalBus.publish(signal);
    }
  }
}

/**
 * Initialize momentum strategy
 *
 * Subscribes to market data stream and analyzes each tick.
 */
export function initMomentumStrategy(): void {
  console.log('[MomentumStrategy] Initializing...');

  const stream = getMarketStream();

  // Subscribe to all ticks
  stream.subscribe(tick => {
    // Run analysis async (don't block stream)
    analyzeMomentumSignal(tick).catch(error => {
      console.error(`[MomentumStrategy] Error analyzing ${tick.symbol}:`, error);
    });
  });

  console.log('[MomentumStrategy] Initialized successfully');
}
