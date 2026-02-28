/**
 * Trading Coordinator
 * Initialises all strategies and wires price updates from the data service
 * to the trading engine.
 */

import { tradingEngine } from './engine';
import type { YahooDetail } from '../lib/data-service';
import { dataService } from '../lib/data-service';
import { initGeopoliticalStrategy } from './strategies/geopolitical';
import { initSentimentStrategy } from './strategies/sentiment';
import { fetchMacroData } from './strategies/macro';

export function initTradingEngine(): void {
  // Initialise all three strategies
  initGeopoliticalStrategy();
  initSentimentStrategy();
  void fetchMacroData();

  // Wire Yahoo Finance price updates → engine price cache
  dataService.addEventListener('yahoo', (e: Event) => {
    const detail = (e as CustomEvent<YahooDetail>).detail;
    const priceMap: Record<string, number> = {};
    for (const quote of detail.quotes) {
      if (quote.price > 0) {
        priceMap[quote.symbol] = quote.price;
      }
    }
    tradingEngine.updatePrices(priceMap);
  });

  console.log('[Trading] Paper trading engine initialised');
}
