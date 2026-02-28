/**
 * Circuit Breaker - Trading Kill Switch
 *
 * Monitors daily P&L and max drawdown. Automatically halts or restricts trading
 * when risk limits are breached.
 *
 * States:
 * - GREEN: Normal trading
 * - YELLOW: Daily loss 3-5% → half position sizing
 * - RED: Daily loss > 5% → halt all new trades today
 * - BLACK: Drawdown > 15% → halt all new trades + flatten recommendation
 */

import { PAPER_CONFIG } from '../engine';

export type CircuitBreakerState = 'GREEN' | 'YELLOW' | 'RED' | 'BLACK';

export interface CircuitBreakerEvent {
  timestamp: number;
  fromState: CircuitBreakerState;
  toState: CircuitBreakerState;
  dailyPnLPct: number;
  drawdownPct: number;
  reason: string;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'GREEN';
  private dailyPnLPct: number = 0;
  private drawdownPct: number = 0;
  private history: CircuitBreakerEvent[] = [];
  private lastResetDate: string;

  constructor() {
    this.lastResetDate = this.getTodayDateString();
    this.loadState();

    // Auto-reset daily at market open (9:30 AM ET)
    this.scheduleMarketOpenReset();
  }

  /**
   * Update circuit breaker with latest portfolio metrics
   */
  update(dailyPnLPct: number, drawdownPct: number): void {
    this.dailyPnLPct = dailyPnLPct;
    this.drawdownPct = drawdownPct;

    // Check if we need to reset (new trading day)
    this.checkDailyReset();

    // Determine new state based on metrics
    const newState = this.calculateState(dailyPnLPct, drawdownPct);

    // Transition if state changed
    if (newState !== this.state) {
      this.transition(newState, dailyPnLPct, drawdownPct);
    }
  }

  /**
   * Get current state
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Get current metrics
   */
  getMetrics(): {
    state: CircuitBreakerState;
    dailyPnLPct: number;
    drawdownPct: number;
    canTrade: boolean;
    positionSizeMultiplier: number;
  } {
    return {
      state: this.state,
      dailyPnLPct: this.dailyPnLPct,
      drawdownPct: this.drawdownPct,
      canTrade: this.state !== 'RED' && this.state !== 'BLACK',
      positionSizeMultiplier: this.state === 'YELLOW' ? 0.5 : 1.0,
    };
  }

  /**
   * Get transition history (immutable log)
   */
  getHistory(): CircuitBreakerEvent[] {
    return [...this.history];
  }

  /**
   * Get today's events only
   */
  getTodayEvents(): CircuitBreakerEvent[] {
    const today = this.getTodayDateString();
    return this.history.filter(event => {
      const eventDate = new Date(event.timestamp).toISOString().split('T')[0];
      return eventDate === today;
    });
  }

  /**
   * Force reset (for testing or emergency override)
   */
  forceReset(): void {
    const previousState = this.state;

    this.state = 'GREEN';
    this.dailyPnLPct = 0;
    this.drawdownPct = 0;

    this.logEvent(previousState, 'GREEN', 0, 0, 'Manual reset');
    this.saveState();

    console.log('[CircuitBreaker] Force reset to GREEN state');
  }

  /**
   * Calculate state based on metrics
   */
  private calculateState(dailyPnLPct: number, drawdownPct: number): CircuitBreakerState {
    // BLACK takes precedence (most severe)
    if (drawdownPct >= PAPER_CONFIG.maxDrawdownPct) {
      return 'BLACK';
    }

    // RED: daily loss > 5%
    if (dailyPnLPct <= -PAPER_CONFIG.maxDailyLossPct) {
      return 'RED';
    }

    // YELLOW: daily loss 3-5%
    if (dailyPnLPct <= -0.03) {
      return 'YELLOW';
    }

    // GREEN: normal conditions
    return 'GREEN';
  }

  /**
   * Transition to new state
   */
  private transition(
    newState: CircuitBreakerState,
    dailyPnLPct: number,
    drawdownPct: number
  ): void {
    const previousState = this.state;
    this.state = newState;

    // Generate reason message
    const reason = this.generateTransitionReason(newState, dailyPnLPct, drawdownPct);

    // Log event immutably
    this.logEvent(previousState, newState, dailyPnLPct, drawdownPct, reason);

    // Save to localStorage
    this.saveState();

    // Console notification (important for operators)
    const emoji = {
      GREEN: '🟢',
      YELLOW: '🟡',
      RED: '🔴',
      BLACK: '⚫',
    };

    console.warn(
      `${emoji[newState]} [CircuitBreaker] ${previousState} → ${newState}: ${reason}`
    );
  }

  /**
   * Generate human-readable transition reason
   */
  private generateTransitionReason(
    state: CircuitBreakerState,
    dailyPnLPct: number,
    drawdownPct: number
  ): string {
    switch (state) {
      case 'GREEN':
        return 'Normal trading conditions restored';

      case 'YELLOW':
        return `Daily loss ${(Math.abs(dailyPnLPct) * 100).toFixed(2)}% — reducing position sizes to 50%`;

      case 'RED':
        return `Daily loss ${(Math.abs(dailyPnLPct) * 100).toFixed(2)}% exceeds 5% limit — halting all new trades today`;

      case 'BLACK':
        return `Drawdown ${(drawdownPct * 100).toFixed(2)}% exceeds 15% limit — trading halted, recommend flattening 50% of portfolio`;

      default:
        return 'Unknown state transition';
    }
  }

  /**
   * Log state transition event
   */
  private logEvent(
    fromState: CircuitBreakerState,
    toState: CircuitBreakerState,
    dailyPnLPct: number,
    drawdownPct: number,
    reason: string
  ): void {
    const event: CircuitBreakerEvent = {
      timestamp: Date.now(),
      fromState,
      toState,
      dailyPnLPct,
      drawdownPct,
      reason,
    };

    this.history.push(event);

    // Keep last 100 events (prevent unbounded growth)
    if (this.history.length > 100) {
      this.history = this.history.slice(-100);
    }

    // Save to localStorage immutably
    this.saveHistory();
  }

  /**
   * Check if we need to reset for a new trading day
   */
  private checkDailyReset(): void {
    const today = this.getTodayDateString();

    if (today !== this.lastResetDate) {
      // New trading day — reset daily metrics
      console.log(`[CircuitBreaker] New trading day detected: ${today}`);

      const previousState = this.state;

      // Reset daily P&L (but keep drawdown)
      this.dailyPnLPct = 0;

      // Reset state to GREEN unless BLACK (drawdown persists across days)
      if (this.state !== 'BLACK') {
        this.state = 'GREEN';
      }

      this.lastResetDate = today;

      // Log reset event
      if (previousState !== this.state) {
        this.logEvent(
          previousState,
          this.state,
          0,
          this.drawdownPct,
          'Daily reset at market open'
        );
      }

      this.saveState();
    }
  }

  /**
   * Schedule automatic reset at market open (9:30 AM ET)
   */
  private scheduleMarketOpenReset(): void {
    // Check every minute for market open
    setInterval(() => {
      this.checkDailyReset();
    }, 60_000); // 1 minute
  }

  /**
   * Get today's date as YYYY-MM-DD string (in ET timezone)
   */
  private getTodayDateString(): string {
    // For simplicity, use local date (in production, would convert to ET)
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Check if today is a market holiday (NYSE calendar)
   */
  private isMarketHoliday(date: Date): boolean {
    // NYSE holidays 2024-2026 (from data-agent.md)
    const holidays = [
      '2024-01-01', // New Year's Day
      '2024-01-15', // MLK Day
      '2024-02-19', // Presidents Day
      '2024-03-29', // Good Friday
      '2024-05-27', // Memorial Day
      '2024-06-19', // Juneteenth
      '2024-07-04', // Independence Day
      '2024-09-02', // Labor Day
      '2024-11-28', // Thanksgiving
      '2024-12-25', // Christmas
      '2025-01-01', // New Year's Day
      '2025-01-20', // MLK Day
      '2025-02-17', // Presidents Day
      '2025-04-18', // Good Friday
      '2025-05-26', // Memorial Day
      '2025-06-19', // Juneteenth
      '2025-07-04', // Independence Day
      '2025-09-01', // Labor Day
      '2025-11-27', // Thanksgiving
      '2025-12-25', // Christmas
      '2026-01-01', // New Year's Day
      '2026-01-19', // MLK Day
      '2026-02-16', // Presidents Day
      '2026-04-03', // Good Friday
      '2026-05-25', // Memorial Day
      '2026-06-19', // Juneteenth
      '2026-07-03', // Independence Day (observed)
      '2026-09-07', // Labor Day
      '2026-11-26', // Thanksgiving
      '2026-12-25', // Christmas
    ];

    const dateStr = date.toISOString().split('T')[0];
    return holidays.includes(dateStr);
  }

  /**
   * Save state to localStorage
   */
  private saveState(): void {
    const state = {
      state: this.state,
      dailyPnLPct: this.dailyPnLPct,
      drawdownPct: this.drawdownPct,
      lastResetDate: this.lastResetDate,
    };

    try {
      localStorage.setItem('atlas_circuit_breaker_state', JSON.stringify(state));
    } catch (error) {
      console.error('[CircuitBreaker] Error saving state:', error);
    }
  }

  /**
   * Load state from localStorage
   */
  private loadState(): void {
    try {
      const saved = localStorage.getItem('atlas_circuit_breaker_state');

      if (saved) {
        const state = JSON.parse(saved);
        this.state = state.state || 'GREEN';
        this.dailyPnLPct = state.dailyPnLPct || 0;
        this.drawdownPct = state.drawdownPct || 0;
        this.lastResetDate = state.lastResetDate || this.getTodayDateString();

        console.log('[CircuitBreaker] Loaded state from localStorage:', this.state);
      }
    } catch (error) {
      console.error('[CircuitBreaker] Error loading state:', error);
    }
  }

  /**
   * Save history to localStorage (immutable log)
   */
  private saveHistory(): void {
    try {
      localStorage.setItem('atlas_circuit_breaker_history', JSON.stringify(this.history));
    } catch (error) {
      console.error('[CircuitBreaker] Error saving history:', error);
    }
  }

  /**
   * Load history from localStorage
   */
  private loadHistory(): void {
    try {
      const saved = localStorage.getItem('atlas_circuit_breaker_history');

      if (saved) {
        this.history = JSON.parse(saved);
        console.log(`[CircuitBreaker] Loaded ${this.history.length} historical events`);
      }
    } catch (error) {
      console.error('[CircuitBreaker] Error loading history:', error);
    }
  }
}

/**
 * Get human-readable state description
 */
export function getStateDescription(state: CircuitBreakerState): string {
  switch (state) {
    case 'GREEN':
      return 'Normal trading — all systems operational';

    case 'YELLOW':
      return 'Caution — position sizes reduced to 50%';

    case 'RED':
      return 'Trading halted — daily loss limit exceeded';

    case 'BLACK':
      return 'Emergency halt — drawdown limit exceeded';

    default:
      return 'Unknown state';
  }
}

/**
 * Get state color for UI rendering
 */
export function getStateColor(state: CircuitBreakerState): string {
  switch (state) {
    case 'GREEN':
      return '#00ff00';

    case 'YELLOW':
      return '#ffff00';

    case 'RED':
      return '#ff0000';

    case 'BLACK':
      return '#000000';

    default:
      return '#888888';
  }
}
