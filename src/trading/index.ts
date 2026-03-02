/**
 * Trading Coordinator
 *
 * Initialises the full trading stack in order:
 *  1. Legacy strategies (geopolitical, sentiment, macro) → signal bus
 *  2. PaperBroker — receives live prices
 *  3. PortfolioManager — tracks positions (loaded from localStorage)
 *  4. ExecutionLoop — processes signals and manages exits
 *  5. StateSync — publishes state to UI panels
 *
 * Price updates from the data service flow through here to keep all
 * engine components in sync.
 */

import { tradingEngine } from './engine';
import { initServerSync } from './engine/server-sync';
import type { YahooDetail, CryptoDetail } from '../lib/data-service';
import { dataService } from '../lib/data-service';
import { initGeopoliticalStrategy } from './strategies/geopolitical';
import { initSentimentStrategy } from './strategies/sentiment';
import { fetchMacroData } from './strategies/macro';
import { paperBroker } from './engine/paper-broker';
import { portfolioManager } from './engine/portfolio-manager';
import { executionLoop } from './engine/execution-loop';
import { stateSync } from './engine/state-sync';

export function initTradingEngine(): void {
  // ── 1. Strategies (publish to signalBus) ────────────────────────────────
  initGeopoliticalStrategy();
  initSentimentStrategy();
  void fetchMacroData();

  // ── 2. Start the new engine layer ────────────────────────────────────────
  stateSync.start();
  executionLoop.start();
  initServerSync();

  // ── 3. Wire price feeds to all engine components ──────────────────────────

  dataService.addEventListener('yahoo', (e: Event) => {
    const detail = (e as CustomEvent<YahooDetail>).detail;
    const priceMap: Record<string, number> = {};

    for (const quote of detail.quotes) {
      if (quote.price > 0) priceMap[quote.symbol] = quote.price;
    }

    // Legacy engine (for existing UI panel compatibility)
    tradingEngine.updatePrices(priceMap);

    // New engine layer
    paperBroker.updatePrices(priceMap);
    portfolioManager.updateMarkToMarket(priceMap);
    executionLoop.updatePrices(priceMap);

    window.dispatchEvent(new CustomEvent('price-feed-updated', {
      detail: { source: 'yahoo', count: Object.keys(priceMap).length, at: Date.now() },
    }));
  });

  dataService.addEventListener('crypto', (e: Event) => {
    const detail = (e as CustomEvent<CryptoDetail>).detail;
    const priceMap: Record<string, number> = {};

    for (const coin of detail.prices) {
      if (coin.price > 0) {
        const sym = coin.symbol.toUpperCase();
        priceMap[sym]          = coin.price;
        priceMap[`${sym}-USD`] = coin.price;
      }
    }

    // Legacy engine
    tradingEngine.updatePrices(priceMap);

    // New engine layer
    paperBroker.updatePrices(priceMap);
    portfolioManager.updateMarkToMarket(priceMap);
    executionLoop.updatePrices(priceMap);

    window.dispatchEvent(new CustomEvent('price-feed-updated', {
      detail: { source: 'crypto', count: Object.keys(priceMap).length, at: Date.now() },
    }));
  });

  // ── 4. Expose on window for DevTools verification ─────────────────────────
  if (import.meta.env.DEV) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    w.atlas = { ...(w.atlas ?? {}), tradingEngine, paperBroker, portfolioManager, executionLoop, stateSync };
  }

  console.log('[Trading] Paper trading engine v2 initialised — $1M NAV');
}
