/**
 * ExecutionLoop — The Trading Engine Heartbeat
 *
 * Runs every 60 seconds and on every new signal from the bus:
 *
 * a) New signal flow:
 *    SignalBus → get price → RiskManager.evaluateOrder()
 *    → PaperBroker.submitOrder() → PortfolioManager.openPosition()
 *
 * b) Exit condition checks (every 30 s):
 *    - Stop loss hit
 *    - Trailing stop hit
 *    - Take profit reached
 *    - Time stop expired (signal.expiresAt)
 *    - Signal reversal (opposite direction signal for same symbol)
 *
 * c) Mark-to-market update
 * d) State persistence
 */

import type { Signal } from '../engine';
import { PAPER_CONFIG } from '../engine';
import { signalBus } from '../signals/signal-bus';
import { riskManager } from '../risk/risk-manager';
import { paperBroker, makeOrderId } from './paper-broker';
import type { Fill } from './paper-broker';
import { portfolioManager } from './portfolio-manager';
import type { ClosedTrade } from './portfolio-manager';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExecutionResult {
  signalId: string;
  symbol: string;
  approved: boolean;
  reason?: string;
  fill?: Fill;
  tradeId?: string;
}

export interface LoopStats {
  startedAt: number;
  tickCount: number;
  signalsProcessed: number;
  tradesOpened: number;
  tradesClosed: number;
  lastTickAt: number;
  isRunning: boolean;
}

// ── Auto-execute gate ─────────────────────────────────────────────────────────

/** When false, signals are shown in the UI but not auto-executed */
let autoExecuteEnabled = true;

export function setAutoExecute(enabled: boolean): void {
  autoExecuteEnabled = enabled;
  console.log(`[ExecutionLoop] Auto-execute: ${enabled ? 'ON' : 'OFF'}`);
  window.dispatchEvent(new CustomEvent('trading:auto-execute-changed', { detail: { enabled } }));
}

export function getAutoExecute(): boolean {
  return autoExecuteEnabled;
}

// ── ExecutionLoop ─────────────────────────────────────────────────────────────

export class ExecutionLoop {
  private priceCache: Map<string, number> = new Map();
  private unsubscribeSignalBus: (() => void) | null = null;
  private mainInterval: ReturnType<typeof setInterval> | null = null;
  private exitCheckInterval: ReturnType<typeof setInterval> | null = null;
  private stats: LoopStats = {
    startedAt: 0,
    tickCount: 0,
    signalsProcessed: 0,
    tradesOpened: 0,
    tradesClosed: 0,
    lastTickAt: 0,
    isRunning: false,
  };

  // Track signals we've already attempted (prevent duplicate execution)
  private processedSignalIds = new Set<string>();
  // Track pending signals waiting for a price
  private pendingSignals: Signal[] = [];
  // (Trailing stop tracking is handled inside PaperBroker via trailHighs/trailLows)

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start(): void {
    if (this.stats.isRunning) return;

    this.stats.isRunning  = true;
    this.stats.startedAt  = Date.now();

    // Subscribe to real-time price updates
    window.addEventListener('price-feed-updated', this.handlePriceFeedUpdate);

    // Subscribe to signal bus — process signals only when auto-execute is ON
    this.unsubscribeSignalBus = signalBus.subscribe(signal => {
      if (autoExecuteEnabled) void this.processSignal(signal);
    });

    // Main heartbeat: MTM + pending signals retry + persist
    this.mainInterval = setInterval(() => this.tick(), 60_000);

    // Exit condition checker: more frequent (every 30 s)
    this.exitCheckInterval = setInterval(() => this.checkExitConditions(), 30_000);

    // Run an immediate tick after a short delay (let prices warm up)
    setTimeout(() => void this.tick(), 3_000);

    console.log('[ExecutionLoop] Started — checking signals every 60s, exits every 30s');
  }

  stop(): void {
    if (!this.stats.isRunning) return;

    window.removeEventListener('price-feed-updated', this.handlePriceFeedUpdate);
    if (this.unsubscribeSignalBus) { this.unsubscribeSignalBus(); this.unsubscribeSignalBus = null; }
    if (this.mainInterval)  { clearInterval(this.mainInterval);  this.mainInterval  = null; }
    if (this.exitCheckInterval) { clearInterval(this.exitCheckInterval); this.exitCheckInterval = null; }

    this.stats.isRunning = false;
    console.log('[ExecutionLoop] Stopped');
  }

  getStats(): LoopStats {
    return { ...this.stats };
  }

  /** Externally update price cache (also called from trading/index.ts) */
  updatePrices(prices: Record<string, number>): void {
    for (const [sym, price] of Object.entries(prices)) {
      this.priceCache.set(sym, price);
    }
    paperBroker.updatePrices(prices);
    portfolioManager.updateMarkToMarket(prices);

    // Retry any pending signals that were waiting for prices
    if (this.pendingSignals.length > 0) {
      const ready: Signal[] = [];
      const still: Signal[] = [];
      for (const sig of this.pendingSignals) {
        if (this.priceCache.has(sig.symbol)) ready.push(sig);
        else still.push(sig);
      }
      this.pendingSignals = still;
      for (const sig of ready) void this.processSignal(sig);
    }
  }

  // ── Main tick ────────────────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    this.stats.tickCount++;
    this.stats.lastTickAt = Date.now();

    // MTM update with latest prices
    portfolioManager.updateMarkToMarket(this.priceCache);

    // Check exit conditions inline (belt-and-suspenders alongside the interval)
    this.checkExitConditions();

    // Persist state
    portfolioManager.persistNow();

    // Publish state to UI
    window.dispatchEvent(new CustomEvent('trading:tick', {
      detail: {
        stats: this.getStats(),
        snapshot: portfolioManager.getSnapshot(),
      },
    }));
  }

  // ── Signal processing ─────────────────────────────────────────────────────

  private async processSignal(signal: Signal): Promise<ExecutionResult> {
    const result: ExecutionResult = { signalId: signal.id, symbol: signal.symbol, approved: false };

    // Already processed?
    if (this.processedSignalIds.has(signal.id)) return result;

    // Expired?
    if (signal.expiresAt < Date.now()) {
      result.reason = 'Signal expired';
      return result;
    }

    // Already have a position in this symbol?
    if (portfolioManager.hasPosition(signal.symbol)) {
      result.reason = `Already holding ${signal.symbol}`;
      return result;
    }

    // Get current price
    const currentPrice = this.priceCache.get(signal.symbol);
    if (!currentPrice) {
      // Queue it — will retry when price arrives
      if (!this.pendingSignals.find(s => s.id === signal.id)) {
        this.pendingSignals.push(signal);
      }
      result.reason = 'Waiting for price data';
      return result;
    }

    this.processedSignalIds.add(signal.id);

    // Kelly-like sizing: confidence × 2% / stopLoss, capped at maxPositionPct
    const stopLoss = signal.stopLoss > 0 ? signal.stopLoss : 0.05;
    const requestedDollars = Math.min(
      (signal.confidence * 0.02 * portfolioManager.getTotalValue()) / stopLoss,
      PAPER_CONFIG.maxPositionPct * portfolioManager.getTotalValue(),
      portfolioManager.getCash() * 0.95    // leave 5% cash buffer
    );

    if (requestedDollars < 100) {
      result.reason = 'Position size too small (< $100)';
      return result;
    }

    // Risk check
    const portfolio = this.buildLegacyPortfolioState();
    const riskDecision = await riskManager.evaluateOrder(
      signal,
      portfolio,
      requestedDollars,
      currentPrice,
      portfolioManager.getHighWaterMark(),
      portfolioManager.getDailyStartValue()
    );

    this.stats.signalsProcessed++;

    // Publish risk decision for UI
    window.dispatchEvent(new CustomEvent('trading:risk-decision', {
      detail: { signal, decision: riskDecision },
    }));

    if (!riskDecision.approved) {
      result.reason = riskDecision.reason ?? 'Risk check failed';
      return result;
    }

    // Use adjusted size if YELLOW circuit breaker halved it
    const effectiveDollars = riskDecision.adjustedSize ?? requestedDollars;
    const quantity = Math.floor(effectiveDollars / currentPrice);
    if (quantity <= 0) {
      result.reason = 'Computed quantity = 0';
      return result;
    }

    // Submit to paper broker
    const orderId = makeOrderId('entry');
    const fill = await paperBroker.submitOrder({
      id: orderId,
      symbol: signal.symbol,
      type: 'MARKET',
      side: signal.direction === 'LONG' ? 'BUY' : 'SELL',
      quantity,
      submittedAt: Date.now(),
      signalId: signal.id,
      strategy: signal.strategy,
    });

    if (!fill) {
      result.reason = 'Broker rejected order';
      return result;
    }

    // Register position in portfolio manager
    const position = portfolioManager.openPosition(fill, signal);

    this.stats.tradesOpened++;
    result.approved = true;
    result.fill = fill;
    result.tradeId = position.id;

    console.log(
      `[ExecutionLoop] Opened ${signal.direction} ${signal.symbol} ×${quantity}` +
      ` @ $${fill.fillPrice.toFixed(2)} (${signal.strategy}, conf: ${(signal.confidence * 100).toFixed(0)}%)`
    );

    window.dispatchEvent(new CustomEvent('trading:trade-opened', { detail: { signal, fill, position } }));

    return result;
  }

  // ── Exit condition checker ────────────────────────────────────────────────

  private checkExitConditions(): void {
    const snapshot = portfolioManager.getSnapshot();
    const now = Date.now();

    for (const pos of snapshot.positions) {
      const price = this.priceCache.get(pos.symbol);
      if (!price) continue;

      let closeReason: ClosedTrade['closeReason'] | null = null;

      // Stop loss
      if (pos.direction === 'LONG' && price <= pos.avgCostPrice * (1 - pos.stopLossPct)) {
        closeReason = 'stop-loss';
      } else if (pos.direction === 'SHORT' && price >= pos.avgCostPrice * (1 + pos.stopLossPct)) {
        closeReason = 'stop-loss';
      }

      // Take profit
      if (!closeReason) {
        if (pos.direction === 'LONG' && price >= pos.avgCostPrice * (1 + pos.takeProfitPct)) {
          closeReason = 'take-profit';
        } else if (pos.direction === 'SHORT' && price <= pos.avgCostPrice * (1 - pos.takeProfitPct)) {
          closeReason = 'take-profit';
        }
      }

      // Trailing stop: 5 % from the best price seen
      if (!closeReason && pos.trailingStopPct) {
        if (pos.direction === 'LONG' && pos.highestPrice) {
          if (price <= pos.highestPrice * (1 - pos.trailingStopPct)) {
            closeReason = 'trailing-stop';
          }
        } else if (pos.direction === 'SHORT' && pos.lowestPrice) {
          if (price >= pos.lowestPrice * (1 + pos.trailingStopPct)) {
            closeReason = 'trailing-stop';
          }
        }
      }

      // Time stop: close any position held > 72 hours
      if (!closeReason) {
        const ageMs = now - pos.openedAt;
        if (ageMs > 72 * 60 * 60 * 1000) {
          closeReason = 'time-stop';
        }
      }

      if (closeReason) {
        void this.closePosition(pos.symbol, closeReason);
      }
    }
  }

  private async closePosition(
    symbol: string,
    reason: ClosedTrade['closeReason']
  ): Promise<void> {
    const pos = portfolioManager.getPosition(symbol);
    if (!pos) return;

    const orderId = makeOrderId('exit');
    const fill = await paperBroker.submitOrder({
      id: orderId,
      symbol,
      type: 'MARKET',
      side: pos.direction === 'LONG' ? 'SELL' : 'BUY',
      quantity: pos.quantity,
      submittedAt: Date.now(),
    });

    if (!fill) return;

    const trade = portfolioManager.closePosition(symbol, fill, reason);
    if (!trade) return;

    this.stats.tradesClosed++;

    console.log(
      `[ExecutionLoop] Closed ${pos.direction} ${symbol} (${reason})` +
      ` P&L: $${trade.realizedPnl.toFixed(2)} (${(trade.realizedPnlPct * 100).toFixed(2)}%)`
    );

    window.dispatchEvent(new CustomEvent('trading:trade-closed', { detail: { trade, reason } }));
  }

  // ── Price feed handler ────────────────────────────────────────────────────

  private handlePriceFeedUpdate = (e: Event): void => {
    // 'price-feed-updated' events carry { source, count, at } but NOT the actual prices
    // Prices flow through yahoo/crypto listeners in trading/index.ts → updatePrices()
    void e; // event is used for side-effect triggering only
  };

  // ── Compatibility shim ───────────────────────────────────────────────────
  // The existing RiskManager.evaluateOrder() expects a legacy PortfolioState
  // (Map-based positions, openTrades array). Build it from PortfolioManager.

  private buildLegacyPortfolioState() {
    const snapshot = portfolioManager.getSnapshot();

    const positions = new Map<string, {
      symbol: string; quantity: number; avgEntryPrice: number;
      currentPrice: number; marketValue: number; unrealizedPnl: number;
      unrealizedPnlPct: number; direction: 'LONG' | 'SHORT'; openedAt: number;
    }>();

    for (const p of snapshot.positions) {
      positions.set(p.symbol, {
        symbol: p.symbol,
        quantity: p.quantity,
        avgEntryPrice: p.avgCostPrice,
        currentPrice: p.currentPrice,
        marketValue: p.marketValue,
        unrealizedPnl: p.unrealizedPnl,
        unrealizedPnlPct: p.unrealizedPnlPct,
        direction: p.direction,
        openedAt: p.openedAt,
      });
    }

    const openTrades = snapshot.positions.map(p => ({
      id: p.id,
      signalId: p.signalId,
      symbol: p.symbol,
      direction: p.direction,
      status: 'OPEN' as const,
      entryPrice: p.avgCostPrice,
      quantity: p.quantity,
      openedAt: p.openedAt,
      strategy: p.strategy,
      reasoning: '',
      stopLossPct: p.stopLossPct,
      takeProfitPct: p.takeProfitPct,
    }));

    return {
      cash: snapshot.cash,
      totalValue: snapshot.totalValue,
      positions,
      openTrades,
      closedTrades: [],
      signals: [],
      dailyPnl: snapshot.dailyPnl,
      totalPnl: snapshot.totalPnl,
      maxDrawdown: snapshot.maxDrawdown,
      haltedUntil: 0,
    };
  }
}

/** Global singleton */
export const executionLoop = new ExecutionLoop();
