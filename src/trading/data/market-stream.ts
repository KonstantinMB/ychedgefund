/**
 * Market Data Stream Manager
 *
 * Manages real-time price feeds from multiple sources:
 * - Finnhub WebSocket (US equities, real-time)
 * - Yahoo Finance REST (fallback, 15-second poll)
 * - CoinGecko REST (crypto, 30-second poll)
 *
 * Emits MarketTick events to the global state store.
 * Tracks staleness per symbol.
 * Auto-reconnects on WebSocket disconnect.
 */

import { getAllSymbols, getAsset } from './universe';

export interface MarketTick {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: number;
  source: 'finnhub' | 'yahoo' | 'coingecko' | 'binance';
  isDelayed: boolean;
  isStale: boolean;
}

type TickListener = (tick: MarketTick) => void;

/**
 * Market hours detection
 */
function isMarketHours(): boolean {
  const now = new Date();

  // Convert to ET (UTC-5 or UTC-4 depending on DST)
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();
  const utcDay = now.getUTCDay();

  // Approximate ET (assuming EST UTC-5)
  // TODO: Handle DST properly
  const etHour = (utcHour - 5 + 24) % 24;

  // Weekend check
  if (utcDay === 0 || utcDay === 6) return false;

  // Market hours: 9:30 AM - 4:00 PM ET
  const minutesFromMidnight = etHour * 60 + utcMinute;
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM

  return minutesFromMidnight >= marketOpen && minutesFromMidnight < marketClose;
}

/**
 * Check if a symbol is crypto
 */
function isCrypto(symbol: string): boolean {
  return symbol.includes('-USD');
}

/**
 * Check if a tick is stale
 */
function checkStaleness(tick: MarketTick): boolean {
  const now = Date.now();
  const ageMs = now - tick.timestamp;

  let thresholdMs: number;

  if (isCrypto(tick.symbol)) {
    thresholdMs = 30_000; // 30 seconds for crypto
  } else if (tick.source === 'yahoo') {
    thresholdMs = 120_000; // 2 minutes for REST endpoints
  } else if (isMarketHours()) {
    thresholdMs = 60_000; // 1 minute during market hours
  } else {
    thresholdMs = 300_000; // 5 minutes after hours
  }

  return ageMs > thresholdMs;
}

/**
 * Main market data stream manager
 */
export class MarketDataStream {
  private listeners: Set<TickListener> = new Set();
  private ticks: Map<string, MarketTick> = new Map();
  private finnhubWs: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private streamPollInterval: number | null = null;
  private stalenessCheckInterval: number | null = null;

  private finnhubApiKey: string | null = null;

  /**
   * Initialize the stream
   */
  async init(finnhubApiKey?: string): Promise<void> {
    this.finnhubApiKey = finnhubApiKey || null;

    console.log('[MarketStream] Initializing...');

    // Get all symbols from universe
    const symbols = getAllSymbols();

    console.log(`[MarketStream] Tracking ${symbols.length} symbols`);

    // Start Finnhub WebSocket for equities (if API key provided)
    if (this.finnhubApiKey) {
      this.connectFinnhub(symbols.filter(s => !isCrypto(s) && !s.includes('=X')));
    } else {
      console.warn('[MarketStream] No Finnhub API key - WebSocket disabled');
    }

    // Unified stream: /api/market/stream returns stocks, ETFs, crypto, forex
    this.startStreamPoll(symbols);

    // Start staleness checker (every 10 seconds)
    this.startStalenessCheck();

    console.log('[MarketStream] Initialized successfully');
  }

  /**
   * Connect to Finnhub WebSocket
   */
  private connectFinnhub(symbols: string[]): void {
    if (!this.finnhubApiKey) return;

    const wsUrl = `wss://ws.finnhub.io?token=${this.finnhubApiKey}`;

    this.finnhubWs = new WebSocket(wsUrl);

    this.finnhubWs.onopen = () => {
      console.log('[MarketStream] Finnhub WebSocket connected');
      this.reconnectAttempts = 0;

      // Subscribe to all equity symbols
      symbols.forEach(symbol => {
        this.finnhubWs?.send(JSON.stringify({ type: 'subscribe', symbol }));
      });
    };

    this.finnhubWs.onmessage = event => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'trade' && message.data) {
          message.data.forEach((trade: any) => {
            const tick: MarketTick = {
              symbol: trade.s,
              price: trade.p,
              bid: trade.p, // Finnhub trade feed doesn't include bid/ask
              ask: trade.p,
              volume: trade.v,
              timestamp: trade.t,
              source: 'finnhub',
              isDelayed: false,
              isStale: false,
            };

            this.updateTick(tick);
          });
        }
      } catch (error) {
        console.error('[MarketStream] Finnhub message parse error:', error);
      }
    };

    this.finnhubWs.onerror = error => {
      console.error('[MarketStream] Finnhub WebSocket error:', error);
    };

    this.finnhubWs.onclose = () => {
      console.warn('[MarketStream] Finnhub WebSocket closed');
      this.reconnectFinnhub(symbols);
    };
  }

  /**
   * Reconnect to Finnhub with exponential backoff
   */
  private reconnectFinnhub(symbols: string[]): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[MarketStream] Max Finnhub reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30000);

    console.log(
      `[MarketStream] Reconnecting to Finnhub in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    setTimeout(() => {
      this.connectFinnhub(symbols);
    }, delay);
  }

  /**
   * Start unified stream polling (15-second intervals).
   * /api/market/stream returns stocks, ETFs, crypto, forex from full universe.
   */
  private startStreamPoll(_symbols: string[]): void {
    const poll = async () => {
      try {
        const response = await fetch('/api/market/stream');
        if (!response.ok) {
          console.error('[MarketStream] Stream poll failed:', response.status);
          return;
        }

        const data = await response.json();
        const quotes = data.quotes || {};

        for (const [symbol, quote] of Object.entries(quotes)) {
          const q = quote as Record<string, unknown>;
          const tick: MarketTick = {
            symbol,
            price: (q.price as number) ?? 0,
            bid: (q.bid as number) ?? (q.price as number) ?? 0,
            ask: (q.ask as number) ?? (q.price as number) ?? 0,
            volume: (q.volume as number) ?? 0,
            timestamp: (q.timestamp as number) ?? Date.now(),
            source: 'yahoo',
            isDelayed: true,
            isStale: false,
          };
          this.updateTick(tick);
        }
      } catch (error) {
        console.error('[MarketStream] Stream poll error:', error);
      }
    };

    poll();
    this.streamPollInterval = window.setInterval(poll, 15_000);
  }

  /**
   * Start staleness checker (runs every 10 seconds)
   */
  private startStalenessCheck(): void {
    const check = () => {
      for (const [symbol, tick] of this.ticks.entries()) {
        const isStale = checkStaleness(tick);

        if (tick.isStale !== isStale) {
          // Staleness status changed
          const updatedTick = { ...tick, isStale };
          this.ticks.set(symbol, updatedTick);

          // Notify listeners
          this.notifyListeners(updatedTick);

          if (isStale) {
            console.warn(`[MarketStream] ${symbol} is now STALE`);
          } else {
            console.log(`[MarketStream] ${symbol} is now FRESH`);
          }
        }
      }
    };

    // Check every 10 seconds
    this.stalenessCheckInterval = window.setInterval(check, 10_000);
  }

  /**
   * Update a tick and notify listeners
   */
  private updateTick(tick: MarketTick): void {
    const isStale = checkStaleness(tick);
    const updatedTick = { ...tick, isStale };

    this.ticks.set(tick.symbol, updatedTick);
    this.notifyListeners(updatedTick);
  }

  /**
   * Notify all listeners of a tick update
   */
  private notifyListeners(tick: MarketTick): void {
    this.listeners.forEach(listener => {
      try {
        listener(tick);
      } catch (error) {
        console.error('[MarketStream] Listener error:', error);
      }
    });
  }

  /**
   * Subscribe to tick updates
   */
  subscribe(listener: TickListener): () => void {
    this.listeners.add(listener);

    // Immediately call listener with all current ticks
    this.ticks.forEach(tick => listener(tick));

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current tick for a symbol
   */
  getTick(symbol: string): MarketTick | null {
    return this.ticks.get(symbol) || null;
  }

  /**
   * Get all current ticks
   */
  getAllTicks(): Map<string, MarketTick> {
    return new Map(this.ticks);
  }

  /**
   * Get staleness status
   */
  getStalenessReport(): { fresh: number; stale: number; total: number } {
    let fresh = 0;
    let stale = 0;

    for (const tick of this.ticks.values()) {
      if (tick.isStale) {
        stale++;
      } else {
        fresh++;
      }
    }

    return { fresh, stale, total: this.ticks.size };
  }

  /**
   * Shutdown the stream
   */
  shutdown(): void {
    console.log('[MarketStream] Shutting down...');

    // Close Finnhub WebSocket
    if (this.finnhubWs) {
      this.finnhubWs.close();
      this.finnhubWs = null;
    }

    if (this.streamPollInterval) {
      clearInterval(this.streamPollInterval);
      this.streamPollInterval = null;
    }

    if (this.stalenessCheckInterval) {
      clearInterval(this.stalenessCheckInterval);
      this.stalenessCheckInterval = null;
    }

    // Clear all state
    this.listeners.clear();
    this.ticks.clear();

    console.log('[MarketStream] Shutdown complete');
  }
}

/**
 * Global market stream instance
 */
let globalStream: MarketDataStream | null = null;

/**
 * Get or create the global market stream
 */
export function getMarketStream(): MarketDataStream {
  if (!globalStream) {
    globalStream = new MarketDataStream();
  }
  return globalStream;
}

/**
 * Initialize the global market stream
 */
export async function initMarketStream(finnhubApiKey?: string): Promise<MarketDataStream> {
  const stream = getMarketStream();
  await stream.init(finnhubApiKey);
  return stream;
}
