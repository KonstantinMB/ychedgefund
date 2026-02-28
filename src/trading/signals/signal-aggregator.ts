/**
 * Signal Aggregator with Bayesian Combination
 *
 * Receives signals from all 5 strategies.
 * When multiple strategies agree on same asset + direction:
 *   confidence = 1 - (1 - conf_1) * (1 - conf_2) * ... (Bayesian combination)
 * Tags multi-strategy consensus signals with "consensus: true"
 * These get priority in position sizing.
 */

import type { Signal } from '../engine';
import { signalBus } from './signal-bus';

const CONSENSUS_WINDOW_MS = 60 * 60 * 1000; // 1 hour window for consensus

interface ConsensusSignal extends Signal {
  consensus: boolean;
  contributingStrategies: string[];
  combinedConfidence: number;
}

/**
 * Find consensus signals (multiple strategies agreeing on same symbol + direction)
 */
export function findConsensusSignals(): ConsensusSignal[] {
  const allSignals = signalBus.getHistory();
  const now = Date.now();

  // Filter to recent signals (last 1 hour)
  const recentSignals = allSignals.filter(
    s => now - s.timestamp < CONSENSUS_WINDOW_MS
  );

  // Group by symbol + direction
  const groups = new Map<string, Signal[]>();

  for (const signal of recentSignals) {
    const key = `${signal.symbol}-${signal.direction}`;

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)!.push(signal);
  }

  // Find groups with multiple strategies (consensus)
  const consensusSignals: ConsensusSignal[] = [];

  for (const [key, signals] of groups.entries()) {
    if (signals.length < 2) continue; // Need at least 2 strategies

    // Check if signals are from different strategies
    const strategies = new Set(signals.map(s => s.strategy));

    if (strategies.size < 2) continue; // Same strategy multiple times doesn't count

    // Calculate Bayesian combined confidence
    // Formula: 1 - (1 - p1) * (1 - p2) * (1 - p3) * ...
    let combinedConfidence = 1.0;

    for (const signal of signals) {
      combinedConfidence *= 1 - signal.confidence;
    }

    combinedConfidence = 1 - combinedConfidence;

    // Take the most recent signal as the base
    const latestSignal = signals.reduce((latest, current) =>
      current.timestamp > latest.timestamp ? current : latest
    );

    // Create consensus signal
    const consensusSignal: ConsensusSignal = {
      ...latestSignal,
      id: `consensus-${latestSignal.symbol}-${Date.now()}`,
      strategy: 'consensus',
      confidence: combinedConfidence,
      consensus: true,
      contributingStrategies: Array.from(strategies),
      combinedConfidence,
      reasoning: `Multi-strategy consensus (${strategies.size} strategies): ${Array.from(strategies).join(', ')}. Combined confidence: ${(combinedConfidence * 100).toFixed(0)}%. ${latestSignal.reasoning}`,
    };

    consensusSignals.push(consensusSignal);
  }

  return consensusSignals;
}

/**
 * Get top signals by confidence (including consensus signals)
 */
export function getTopSignals(count: number = 10): Signal[] {
  const allSignals = signalBus.getHistory();
  const consensusSignals = findConsensusSignals();

  // Combine regular signals and consensus signals
  const combined = [...allSignals, ...consensusSignals];

  // Sort by confidence descending
  combined.sort((a, b) => b.confidence - a.confidence);

  // Return top N
  return combined.slice(0, count);
}

/**
 * Get signals grouped by strategy
 */
export function getSignalsByStrategy(): Map<string, Signal[]> {
  const allSignals = signalBus.getHistory();
  const grouped = new Map<string, Signal[]>();

  for (const signal of allSignals) {
    if (!grouped.has(signal.strategy)) {
      grouped.set(signal.strategy, []);
    }

    grouped.get(signal.strategy)!.push(signal);
  }

  return grouped;
}

/**
 * Get strategy performance stats
 */
export function getStrategyStats(): Map<
  string,
  {
    count: number;
    avgConfidence: number;
    consensusCount: number;
  }
> {
  const allSignals = signalBus.getHistory();
  const consensusSignals = findConsensusSignals();

  const stats = new Map<
    string,
    {
      count: number;
      avgConfidence: number;
      consensusCount: number;
    }
  >();

  // Count regular signals by strategy
  for (const signal of allSignals) {
    if (!stats.has(signal.strategy)) {
      stats.set(signal.strategy, {
        count: 0,
        avgConfidence: 0,
        consensusCount: 0,
      });
    }

    const stat = stats.get(signal.strategy)!;
    stat.count++;
    stat.avgConfidence += signal.confidence;
  }

  // Calculate averages
  for (const [strategy, stat] of stats.entries()) {
    stat.avgConfidence = stat.avgConfidence / stat.count;
  }

  // Count consensus participation
  for (const consensusSignal of consensusSignals) {
    for (const strategy of consensusSignal.contributingStrategies) {
      if (stats.has(strategy)) {
        stats.get(strategy)!.consensusCount++;
      }
    }
  }

  return stats;
}

/**
 * Initialize signal aggregation (runs continuously)
 */
export function initSignalAggregator(): void {
  console.log('[SignalAggregator] Initializing...');

  // Check for consensus signals every minute
  setInterval(() => {
    const consensus = findConsensusSignals();

    if (consensus.length > 0) {
      console.log(`[SignalAggregator] Found ${consensus.length} consensus signals:`);

      for (const signal of consensus) {
        console.log(
          `  ${signal.symbol} ${signal.direction}: ${signal.contributingStrategies.join(' + ')} = ${(signal.combinedConfidence * 100).toFixed(0)}% confidence`
        );
      }
    }
  }, 60_000); // Every minute

  console.log('[SignalAggregator] Initialized successfully');
}
