/**
 * Signal Bus - Central Event System for Trading Signals
 *
 * All strategies publish signals here.
 * The paper trading engine subscribes to new signals.
 * Deduplicates: same asset + same direction within 1 hour = skip.
 * Maintains signal history (last 500 signals) in memory.
 */

import type { Signal } from '../engine';

const MAX_SIGNAL_HISTORY = 500;
const DEDUP_WINDOW_MS = 60 * 60 * 1000; // 1 hour

type SignalListener = (signal: Signal) => void;

export class SignalBus {
  private signals: Signal[] = [];
  private listeners: Set<SignalListener> = new Set();

  /**
   * Publish a new signal to the bus
   *
   * Deduplicates based on symbol + direction within 1-hour window.
   * Notifies all subscribers.
   */
  publish(signal: Signal): void {
    // Deduplication check
    const isDuplicate = this.signals.some(
      existing =>
        existing.symbol === signal.symbol &&
        existing.direction === signal.direction &&
        Date.now() - existing.timestamp < DEDUP_WINDOW_MS
    );

    if (isDuplicate) {
      console.log(
        `[SignalBus] Skipping duplicate signal: ${signal.symbol} ${signal.direction} (within 1h window)`
      );
      return;
    }

    // Add to history
    this.signals.push(signal);

    // Trim history to last 500 signals
    if (this.signals.length > MAX_SIGNAL_HISTORY) {
      this.signals = this.signals.slice(-MAX_SIGNAL_HISTORY);
    }

    console.log(
      `[SignalBus] Published signal: ${signal.symbol} ${signal.direction} (${signal.strategy}, confidence: ${(signal.confidence * 100).toFixed(0)}%)`
    );

    // Notify all listeners
    this.notifyListeners(signal);
  }

  /**
   * Subscribe to new signals
   */
  subscribe(listener: SignalListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get all signals in history
   */
  getHistory(): Signal[] {
    return [...this.signals];
  }

  /**
   * Get signals by strategy
   */
  getByStrategy(strategy: string): Signal[] {
    return this.signals.filter(s => s.strategy === strategy);
  }

  /**
   * Get signals by symbol
   */
  getBySymbol(symbol: string): Signal[] {
    return this.signals.filter(s => s.symbol === symbol);
  }

  /**
   * Get recent signals (last N)
   */
  getRecent(count: number): Signal[] {
    return this.signals.slice(-count);
  }

  /**
   * Clear all signals (for testing)
   */
  clear(): void {
    this.signals = [];
    console.log('[SignalBus] Cleared all signals');
  }

  /**
   * Notify all listeners of a new signal
   */
  private notifyListeners(signal: Signal): void {
    this.listeners.forEach(listener => {
      try {
        listener(signal);
      } catch (error) {
        console.error('[SignalBus] Listener error:', error);
      }
    });
  }
}

/**
 * Global signal bus instance
 */
export const signalBus = new SignalBus();
