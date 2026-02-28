/**
 * PaperBroker — Simulated Order Execution
 *
 * Mimics a real broker with:
 *  - MARKET, LIMIT, STOP-LOSS, TRAILING-STOP order types
 *  - Slippage: 5 bps for equities, 10 bps for crypto
 *  - Simulated latency: 100–500 ms
 *  - Partial fills for orders > 0.5 % of daily volume (split into 3 fills)
 *  - Order book: PENDING → FILLED / REJECTED / CANCELLED
 */

import { getAsset } from '../data/universe';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrderType   = 'MARKET' | 'LIMIT' | 'STOP-LOSS' | 'TRAILING-STOP';
export type OrderSide   = 'BUY' | 'SELL';
export type OrderStatus = 'PENDING' | 'FILLED' | 'PARTIAL' | 'REJECTED' | 'CANCELLED';

export interface Order {
  id: string;
  symbol: string;
  type: OrderType;
  side: OrderSide;
  quantity: number;       // shares / units
  limitPrice?: number;    // LIMIT orders
  stopPrice?: number;     // STOP-LOSS orders
  trailPct?: number;      // TRAILING-STOP (e.g. 0.05 = 5 % trailing)
  submittedAt: number;
  signalId?: string;
  strategy?: string;
}

export interface Fill {
  id: string;
  orderId: string;
  symbol: string;
  side: OrderSide;
  fillPrice: number;
  fillQuantity: number;
  totalQuantity: number;   // original order quantity
  filledAt: number;
  isPartial: boolean;
  slippageBps: number;
}

export interface OrderRecord {
  order: Order;
  status: OrderStatus;
  fills: Fill[];
  submittedAt: number;
  completedAt?: number;
  reason?: string;         // rejection reason
}

type FillListener = (fill: Fill, record: OrderRecord) => void;

// ── Constants ─────────────────────────────────────────────────────────────────

const EQUITY_SLIPPAGE_BPS   = 5;    // 0.05 %
const CRYPTO_SLIPPAGE_BPS   = 10;   // 0.10 %
const PARTIAL_FILL_ADV_PCT  = 0.005; // >0.5 % of ADV → partial fill
const MIN_LATENCY_MS        = 100;
const MAX_LATENCY_MS        = 500;

const CRYPTO_SYMBOLS = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'BNB']);

// ── Helpers ───────────────────────────────────────────────────────────────────

function isCrypto(symbol: string): boolean {
  return symbol.includes('-USD') || CRYPTO_SYMBOLS.has(symbol);
}

function randomLatency(): number {
  return MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS);
}

// ── PaperBroker ───────────────────────────────────────────────────────────────

export class PaperBroker {
  private orderBook: Map<string, OrderRecord> = new Map();
  private priceCache: Map<string, number> = new Map();
  private trailHighs: Map<string, number> = new Map(); // orderId → highest price seen
  private trailLows: Map<string, number> = new Map();  // orderId → lowest price seen
  private fillListeners: Set<FillListener> = new Set();

  // ── Price feed ─────────────────────────────────────────────────────────────

  updatePrice(symbol: string, price: number): void {
    this.priceCache.set(symbol, price);
    this.processPendingOrders(symbol, price);
  }

  updatePrices(prices: Record<string, number> | Map<string, number>): void {
    const entries = prices instanceof Map ? prices.entries() : Object.entries(prices);
    for (const [sym, p] of entries) {
      this.updatePrice(sym, p);
    }
  }

  getPrice(symbol: string): number | undefined {
    return this.priceCache.get(symbol);
  }

  // ── Order submission ────────────────────────────────────────────────────────

  /**
   * Submit an order. Returns the final Fill (or the last partial fill for large orders).
   * Returns null if rejected or still pending (LIMIT/STOP waiting for price).
   */
  async submitOrder(order: Order): Promise<Fill | null> {
    // Register in order book
    const record: OrderRecord = {
      order,
      status: 'PENDING',
      fills: [],
      submittedAt: Date.now(),
    };
    this.orderBook.set(order.id, record);

    const marketPrice = this.priceCache.get(order.symbol);

    // ── MARKET: fill immediately if price available ──────────────────────────
    if (order.type === 'MARKET') {
      if (!marketPrice) {
        record.status = 'REJECTED';
        record.reason = `No price available for ${order.symbol}`;
        record.completedAt = Date.now();
        return null;
      }
      return this.executeFill(record, marketPrice);
    }

    // ── LIMIT: fill now only if price is already at or through limit ─────────
    if (order.type === 'LIMIT') {
      if (order.limitPrice == null) {
        record.status = 'REJECTED';
        record.reason = 'LIMIT order missing limitPrice';
        record.completedAt = Date.now();
        return null;
      }
      if (marketPrice) {
        const fillable = order.side === 'BUY'
          ? marketPrice <= order.limitPrice
          : marketPrice >= order.limitPrice;
        if (fillable) return this.executeFill(record, order.limitPrice);
      }
      // Otherwise stays PENDING until processPendingOrders fires
      return null;
    }

    // ── STOP-LOSS: stays pending until stop is hit ───────────────────────────
    if (order.type === 'STOP-LOSS') {
      if (order.stopPrice == null) {
        record.status = 'REJECTED';
        record.reason = 'STOP-LOSS order missing stopPrice';
        record.completedAt = Date.now();
        return null;
      }
      if (marketPrice) {
        const triggered = order.side === 'SELL'
          ? marketPrice <= order.stopPrice
          : marketPrice >= order.stopPrice;
        if (triggered) return this.executeFill(record, marketPrice);
      }
      return null;
    }

    // ── TRAILING-STOP: anchor high/low, recalculate on price updates ─────────
    if (order.type === 'TRAILING-STOP') {
      if (order.trailPct == null) {
        record.status = 'REJECTED';
        record.reason = 'TRAILING-STOP order missing trailPct';
        record.completedAt = Date.now();
        return null;
      }
      if (marketPrice) {
        if (order.side === 'SELL') {
          this.trailHighs.set(order.id, marketPrice);
        } else {
          this.trailLows.set(order.id, marketPrice);
        }
      }
      return null;
    }

    return null;
  }

  cancelOrder(orderId: string): boolean {
    const record = this.orderBook.get(orderId);
    if (record?.status === 'PENDING') {
      record.status = 'CANCELLED';
      record.completedAt = Date.now();
      this.trailHighs.delete(orderId);
      this.trailLows.delete(orderId);
      return true;
    }
    return false;
  }

  // ── Listeners ───────────────────────────────────────────────────────────────

  onFill(listener: FillListener): () => void {
    this.fillListeners.add(listener);
    return () => this.fillListeners.delete(listener);
  }

  // ── Order book access ────────────────────────────────────────────────────────

  getOrderBook(): OrderRecord[] {
    return Array.from(this.orderBook.values());
  }

  getOrder(orderId: string): OrderRecord | undefined {
    return this.orderBook.get(orderId);
  }

  getPendingOrders(): OrderRecord[] {
    return Array.from(this.orderBook.values()).filter(r => r.status === 'PENDING');
  }

  /** Prune order book — keep only last N completed orders */
  pruneOrderBook(keepLast = 500): void {
    const entries = Array.from(this.orderBook.entries());
    const completed = entries.filter(([, r]) => r.status !== 'PENDING');
    const toRemove = completed.slice(0, completed.length - keepLast);
    for (const [id] of toRemove) this.orderBook.delete(id);
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /** Core fill simulation — handles slippage, latency, partial fills */
  private async executeFill(record: OrderRecord, referencePrice: number): Promise<Fill | null> {
    const { order } = record;
    const latencyMs = randomLatency();

    const crypto = isCrypto(order.symbol);
    const slippageBps = crypto ? CRYPTO_SLIPPAGE_BPS : EQUITY_SLIPPAGE_BPS;
    const slippagePct = slippageBps / 10_000;

    // BUY pays more (adverse), SELL receives less (adverse)
    const fillPrice = order.side === 'BUY'
      ? referencePrice * (1 + slippagePct)
      : referencePrice * (1 - slippagePct);

    // Check if order is large enough to warrant partial fills
    const asset = getAsset(order.symbol);
    const adv   = asset?.avgDailyVolume ?? 1_000_000;
    const orderPct = order.quantity / adv;
    const isLarge  = orderPct > PARTIAL_FILL_ADV_PCT;

    return new Promise(resolve => {
      setTimeout(() => {
        if (isLarge) {
          // Split into 3 partial fills with slight price variation
          const q1 = Math.floor(order.quantity / 3);
          const q2 = Math.floor(order.quantity / 3);
          const q3 = order.quantity - q1 - q2;
          const quantities = [q1, q2, q3];
          let lastFill: Fill | null = null;

          for (let i = 0; i < quantities.length; i++) {
            const qty = quantities[i]!;
            const priceVariation = 1 + (Math.random() - 0.5) * 0.0004; // ±0.02% variation
            const fill: Fill = {
              id: `${order.id}-f${i + 1}`,
              orderId: order.id,
              symbol: order.symbol,
              side: order.side,
              fillPrice: fillPrice * priceVariation,
              fillQuantity: qty,
              totalQuantity: order.quantity,
              filledAt: Date.now() + latencyMs + i * 80,
              isPartial: i < quantities.length - 1,
              slippageBps,
            };
            record.fills.push(fill);
            record.status = i < quantities.length - 1 ? 'PARTIAL' : 'FILLED';
            this.emitFill(fill, record);
            lastFill = fill;
          }
          record.completedAt = Date.now() + latencyMs + 160;
          resolve(lastFill);
        } else {
          const fill: Fill = {
            id: `${order.id}-f1`,
            orderId: order.id,
            symbol: order.symbol,
            side: order.side,
            fillPrice,
            fillQuantity: order.quantity,
            totalQuantity: order.quantity,
            filledAt: Date.now() + latencyMs,
            isPartial: false,
            slippageBps,
          };
          record.fills.push(fill);
          record.status = 'FILLED';
          record.completedAt = Date.now() + latencyMs;
          this.emitFill(fill, record);
          resolve(fill);
        }
      }, latencyMs);
    });
  }

  /** Check pending orders when a new price tick arrives */
  private processPendingOrders(symbol: string, price: number): void {
    for (const [orderId, record] of this.orderBook) {
      if (record.status !== 'PENDING') continue;
      if (record.order.symbol !== symbol) continue;
      const { order } = record;

      if (order.type === 'LIMIT' && order.limitPrice != null) {
        const fillable = order.side === 'BUY'
          ? price <= order.limitPrice
          : price >= order.limitPrice;
        if (fillable) void this.executeFill(record, order.limitPrice);
        continue;
      }

      if (order.type === 'STOP-LOSS' && order.stopPrice != null) {
        const triggered = order.side === 'SELL'
          ? price <= order.stopPrice
          : price >= order.stopPrice;
        if (triggered) void this.executeFill(record, price);
        continue;
      }

      if (order.type === 'TRAILING-STOP' && order.trailPct != null) {
        if (order.side === 'SELL') {
          const high = this.trailHighs.get(orderId) ?? price;
          if (price > high) this.trailHighs.set(orderId, price);
          const stopLevel = (this.trailHighs.get(orderId) ?? price) * (1 - order.trailPct);
          if (price <= stopLevel) {
            this.trailHighs.delete(orderId);
            void this.executeFill(record, price);
          }
        } else {
          const low = this.trailLows.get(orderId) ?? price;
          if (price < low) this.trailLows.set(orderId, price);
          const stopLevel = (this.trailLows.get(orderId) ?? price) * (1 + order.trailPct);
          if (price >= stopLevel) {
            this.trailLows.delete(orderId);
            void this.executeFill(record, price);
          }
        }
      }
    }
  }

  private emitFill(fill: Fill, record: OrderRecord): void {
    this.fillListeners.forEach(listener => {
      try { listener(fill, record); } catch { /* never crash on listener errors */ }
    });
  }
}

/** Generate a broker-safe order ID */
export function makeOrderId(prefix = 'ord'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Global singleton */
export const paperBroker = new PaperBroker();
