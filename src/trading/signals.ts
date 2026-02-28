/**
 * Signal Aggregator
 * Collects signals from all strategies, deduplicates, ranks by confidence,
 * and passes them to the trading engine.
 */

import type { Signal } from './engine';
import { tradingEngine } from './engine';

const SIGNAL_TTL_MS = 4 * 60 * 60 * 1000;        // 4-hour expiry
const DEDUP_WINDOW_MS = 60 * 60 * 1000;           // 1-hour dedup window
const MAX_SIGNALS_PER_CYCLE = 5;                   // top N per processing pass

export class SignalAggregator {
  private pendingSignals: Signal[] = [];

  addSignal(partial: Omit<Signal, 'id' | 'timestamp' | 'expiresAt'> & Partial<Pick<Signal, 'id' | 'timestamp' | 'expiresAt'>>): void {
    const now = Date.now();

    // Dedup: same symbol + direction within the last hour
    const isDuplicate = this.pendingSignals.some(
      s =>
        s.symbol === partial.symbol &&
        s.direction === partial.direction &&
        now - s.timestamp < DEDUP_WINDOW_MS
    );
    if (isDuplicate) return;

    const signal: Signal = {
      id: partial.id ?? `signal-${now}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: partial.timestamp ?? now,
      expiresAt: partial.expiresAt ?? now + SIGNAL_TTL_MS,
      strategy: partial.strategy,
      symbol: partial.symbol,
      direction: partial.direction,
      confidence: partial.confidence,
      reasoning: partial.reasoning,
      targetReturn: partial.targetReturn,
      stopLoss: partial.stopLoss,
      takeProfit: partial.takeProfit,
    };

    this.pendingSignals.push(signal);
    this.processSignals();
  }

  private processSignals(): void {
    const now = Date.now();

    // Purge expired
    this.pendingSignals = this.pendingSignals.filter(s => s.expiresAt > now);

    // Sort by confidence descending
    this.pendingSignals.sort((a, b) => b.confidence - a.confidence);

    // Pass top signals to engine
    const top = this.pendingSignals.slice(0, MAX_SIGNALS_PER_CYCLE);
    for (const signal of top) {
      tradingEngine.acceptSignal(signal);
    }

    // Emit for panels
    window.dispatchEvent(
      new CustomEvent('signals-updated', { detail: { signals: this.pendingSignals } })
    );
  }

  getSignals(): Signal[] {
    return this.pendingSignals;
  }
}

export const signalAggregator = new SignalAggregator();
