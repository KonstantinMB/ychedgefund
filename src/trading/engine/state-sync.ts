/**
 * StateSync — Trading ↔ UI Bridge
 *
 * Two storage layers:
 *   Layer 1: localStorage (instant, offline-capable)
 *   Layer 2: Redis via API (persistent, cross-device) — see server-sync.ts
 *
 * WRITE: portfolio-updated → server-sync debounces 5s → PUT /api/trading/portfolio
 * READ: On auth, server-sync fetches GET, latest timestamp wins
 *
 * Published events:
 *   'trading:signals'     → Signal[]
 *   'trading:portfolio'   → PortfolioSnapshot
 *   'trading:performance' → PerformanceMetrics
 *   'trading:riskStatus'  → CircuitBreakerMetrics
 *   'trading:trades'      → ClosedTrade[]
 */

import { signalBus } from '../signals/signal-bus';
import { portfolioManager } from './portfolio-manager';
import { riskManager } from '../risk/risk-manager';
import { calculatePerformance } from './performance';
import type { PerformanceMetrics } from './performance';
import type { PortfolioSnapshot } from './portfolio-manager';
import type { Signal } from '../engine';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TradingState {
  signals: Signal[];
  portfolio: PortfolioSnapshot | null;
  performance: PerformanceMetrics | null;
  riskStatus: {
    cbState: string;
    canTrade: boolean;
    positionSizeMultiplier: number;
    dailyPnLPct: number;
    drawdownPct: number;
  };
  trades: PortfolioSnapshot['closedTrades'];
  isRunning: boolean;
  lastUpdated: number;
}

// ── StateSync ──────────────────────────────────────────────────────────────────

export class StateSync {
  private state: TradingState = {
    signals: [],
    portfolio: null,
    performance: null,
    riskStatus: {
      cbState: 'GREEN',
      canTrade: true,
      positionSizeMultiplier: 1.0,
      dailyPnLPct: 0,
      drawdownPct: 0,
    },
    trades: [],
    isRunning: false,
    lastUpdated: Date.now(),
  };

  private perfUpdateTimer: ReturnType<typeof setInterval> | null = null;

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  start(): void {
    this.state.isRunning = true;

    // Portfolio updates → forward to panels + global store
    window.addEventListener('portfolio-updated', this.handlePortfolioUpdated);

    // New signals → update signal list
    signalBus.subscribe(signal => {
      this.state.signals = [signal, ...this.state.signals].slice(0, 50);
      this.publishEvent('trading:signals', this.state.signals);
    });

    // Risk decisions → forward to UI
    window.addEventListener('trading:risk-decision', this.handleRiskDecision);

    // Recalculate performance every 2 minutes (heavy calc, don't do on every tick)
    this.perfUpdateTimer = setInterval(() => this.refreshPerformance(), 2 * 60 * 1000);

    // Initial publish of existing state
    this.publishAll();

    console.log('[StateSync] Started — bridging trading engine to UI');
  }

  stop(): void {
    window.removeEventListener('portfolio-updated', this.handlePortfolioUpdated);
    window.removeEventListener('trading:risk-decision', this.handleRiskDecision);
    if (this.perfUpdateTimer) {
      clearInterval(this.perfUpdateTimer);
      this.perfUpdateTimer = null;
    }
    this.state.isRunning = false;
  }

  /** Get a point-in-time snapshot of all trading state (for panels that pull on demand) */
  getState(): TradingState {
    return { ...this.state };
  }

  // ── Event handlers ────────────────────────────────────────────────────────────

  private handlePortfolioUpdated = (e: Event): void => {
    const snapshot = (e as CustomEvent<PortfolioSnapshot>).detail;
    this.state.portfolio = snapshot;
    this.state.trades    = snapshot.closedTrades.slice(-100);
    this.state.lastUpdated = Date.now();

    // Sync legacy AppState 'trading' key for header bar
    this.syncLegacyTradingState(snapshot);

    // Publish named events
    this.publishEvent('trading:portfolio', snapshot);
    this.publishEvent('trading:trades', this.state.trades);

    // Light-weight risk status from circuit breaker
    const cbMetrics = riskManager.getCircuitBreaker().getMetrics();
    this.state.riskStatus = {
      cbState: cbMetrics.state,
      canTrade: cbMetrics.canTrade,
      positionSizeMultiplier: cbMetrics.positionSizeMultiplier,
      dailyPnLPct: cbMetrics.dailyPnLPct,
      drawdownPct: cbMetrics.drawdownPct,
    };
    this.publishEvent('trading:riskStatus', this.state.riskStatus);
  };

  private handleRiskDecision = (e: Event): void => {
    const { decision } = (e as CustomEvent<{ decision: { circuitBreakerState: string } }>).detail;
    // Update CB state immediately on risk decisions
    const cbMetrics = riskManager.getCircuitBreaker().getMetrics();
    this.state.riskStatus = {
      cbState: decision.circuitBreakerState,
      canTrade: cbMetrics.canTrade,
      positionSizeMultiplier: cbMetrics.positionSizeMultiplier,
      dailyPnLPct: cbMetrics.dailyPnLPct,
      drawdownPct: cbMetrics.drawdownPct,
    };
    this.publishEvent('trading:riskStatus', this.state.riskStatus);
  };

  // ── Performance refresh ────────────────────────────────────────────────────────

  private refreshPerformance(): void {
    const snapshot    = portfolioManager.getSnapshot();
    const equityCurve = portfolioManager.getEquityCurve();

    if (equityCurve.length < 2 && snapshot.closedTrades.length === 0) return;

    try {
      const metrics = calculatePerformance(snapshot, equityCurve);
      this.state.performance = metrics;
      this.publishEvent('trading:performance', metrics);
    } catch (err) {
      console.warn('[StateSync] Performance calculation error:', err);
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────────

  private publishAll(): void {
    const snapshot = portfolioManager.getSnapshot();
    this.state.portfolio = snapshot;
    this.state.signals   = signalBus.getRecent(50);
    this.state.trades    = snapshot.closedTrades.slice(-100);

    this.publishEvent('trading:portfolio', this.state.portfolio);
    this.publishEvent('trading:signals',   this.state.signals);
    this.publishEvent('trading:trades',    this.state.trades);
    this.publishEvent('trading:riskStatus', this.state.riskStatus);
  }

  private publishEvent<T>(name: string, detail: T): void {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  private syncLegacyTradingState(snapshot: PortfolioSnapshot): void {
    // Try to update the legacy AppState.trading slice for header indicators
    // We do this via a CustomEvent that main.ts can hook if desired
    window.dispatchEvent(new CustomEvent('trading:legacy-sync', {
      detail: {
        enabled: true,
        balance: snapshot.totalValue,
        dailyPnL: snapshot.dailyPnl,
        positions: snapshot.openPositionCount,
      },
    }));
  }
}

/** Global singleton */
export const stateSync = new StateSync();
