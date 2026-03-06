/**
 * Signal Generation Engine - Master Initialization
 *
 * Initializes all 6 trading strategies and the signal aggregator.
 * Strategies run autonomously and publish signals to the signal bus.
 */

import { initMomentumStrategy } from './strategies/momentum';
import { initSentimentStrategy } from './strategies/sentiment';
import { initGeopoliticalStrategy } from './strategies/geopolitical';
import { initMacroStrategy } from './strategies/macro';
import { initCrossAssetStrategy } from './strategies/cross-asset';
import { initPredictionMarketStrategy } from './strategies/prediction-markets';
import { initSignalAggregator } from './signal-aggregator';
import { signalBus } from './signal-bus';

/**
 * Initialize all trading strategies
 */
export async function initAllStrategies(): Promise<void> {
  console.log('[SignalEngine] Initializing all strategies...');

  try {
    // 1. Momentum (technical analysis, runs on every price tick)
    initMomentumStrategy();

    // 2. Sentiment (news NLP, runs every 15 min)
    initSentimentStrategy();

    // 3. Geopolitical (CII-based, runs every 15 min)
    initGeopoliticalStrategy();

    // 4. Macro (regime classification, runs daily)
    initMacroStrategy();

    // 5. Cross-asset (divergence detection, runs every 30 min)
    initCrossAssetStrategy();

    // 6. Prediction Markets (Polymarket momentum + multi-source confirmation, runs every 15 min)
    initPredictionMarketStrategy();

    // 7. Signal aggregator (consensus detection)
    initSignalAggregator();

    console.log('[SignalEngine] All strategies initialized successfully');
  } catch (error) {
    console.error('[SignalEngine] Error initializing strategies:', error);
    throw error;
  }
}

/**
 * Get signal bus instance
 */
export { signalBus } from './signal-bus';

/**
 * Get signal aggregator functions
 */
export {
  findConsensusSignals,
  getTopSignals,
  getSignalsByStrategy,
  getStrategyStats,
} from './signal-aggregator';
