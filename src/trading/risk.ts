/**
 * Risk Management
 * Position sizing (Kelly-like) and limit checks for the paper trading engine.
 */

import type { TradingEngine, Signal } from './engine';
import { PAPER_CONFIG } from './engine';

// ── Sector classification ──────────────────────────────────────────────────────

export const SECTOR_MAP: Record<string, string> = {
  SPY: 'us-equity',  QQQ: 'us-equity',   IWM: 'us-equity',
  GLD: 'commodities', SLV: 'commodities', USO: 'commodities', DBA: 'commodities',
  UNG: 'commodities', WEAT: 'commodities', CORN: 'commodities', COPX: 'commodities',
  TLT: 'bonds',       IEF: 'bonds',       SHY: 'bonds',
  EEM: 'emerging-markets',
  EWJ: 'japan', EWG: 'europe',  EWZ: 'brazil',  EWY: 'korea',
  EWI: 'europe', EWU: 'europe', FXI: 'china',  MCHI: 'china',
  EWA: 'australia', EWW: 'mexico', TUR: 'turkey',
  UUP: 'forex',   FXE: 'forex',
  VIX: 'volatility',
  XLE: 'energy',  XLF: 'financials', XLY: 'consumer',
  JETS: 'airlines',
  RSX: 'russia',  ERUS: 'russia',
  INDA: 'india',  VNM: 'vietnam',
  IAU: 'commodities', PPLT: 'commodities', URA: 'commodities',
  SOYB: 'commodities', ARGT: 'argentina', ECH: 'chile',
  SOXX: 'tech', TSM: 'tech',
};

function getSector(symbol: string): string {
  return SECTOR_MAP[symbol] ?? 'other';
}

/**
 * Verify the proposed trade does not breach position or sector concentration limits.
 */
export function checkPositionLimits(
  engine: TradingEngine,
  signal: Signal,
  proposedValue: number
): { allowed: boolean; reason?: string } {
  const state = engine.getState();
  const now = Date.now();

  // Halted?
  if (state.haltedUntil > now) {
    return { allowed: false, reason: 'Trading halted (daily loss limit)' };
  }

  // Single-position cap
  const maxPositionValue = PAPER_CONFIG.maxPositionPct * state.totalValue;
  if (proposedValue > maxPositionValue) {
    return {
      allowed: false,
      reason: `Position $${proposedValue.toFixed(0)} exceeds ${PAPER_CONFIG.maxPositionPct * 100}% limit`,
    };
  }

  // Sector cap
  const targetSector = getSector(signal.symbol);
  let sectorValue = proposedValue; // include the new trade
  for (const pos of state.positions.values()) {
    if (getSector(pos.symbol) === targetSector) {
      sectorValue += pos.marketValue;
    }
  }
  const maxSectorValue = PAPER_CONFIG.maxSectorPct * state.totalValue;
  if (sectorValue > maxSectorValue) {
    return {
      allowed: false,
      reason: `Sector '${targetSector}' exposure would exceed ${PAPER_CONFIG.maxSectorPct * 100}%`,
    };
  }

  // Sufficient cash?
  if (proposedValue > state.cash) {
    return { allowed: false, reason: 'Insufficient cash' };
  }

  return { allowed: true };
}

/**
 * Kelly-inspired position sizing.
 * Returns the recommended position value in USD (not shares).
 * Caller divides by entry price to get quantity.
 *
 * Formula: min(confidence × riskPct × portfolio ÷ stopLoss, maxPositionPct × portfolio)
 */
export function calculatePositionSize(
  portfolioValue: number,
  signal: Signal,
  riskPct: number = 0.02,
  entryPrice: number = 100
): number {
  const stopLoss = signal.stopLoss > 0 ? signal.stopLoss : 0.05;
  const positionDollars = Math.min(
    (signal.confidence * riskPct * portfolioValue) / stopLoss,
    PAPER_CONFIG.maxPositionPct * portfolioValue
  );
  const quantity = Math.floor(positionDollars / entryPrice);
  return quantity;
}
