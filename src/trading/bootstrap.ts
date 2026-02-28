/**
 * Trading Bootstrap
 *
 * Handles first-visit vs. returning-user state:
 *  - First visit (no localStorage data): seeds a 12-month synthetic equity
 *    curve so the performance panel shows meaningful data immediately.
 *  - Returning user: portfolioManager already rehydrated from localStorage;
 *    nothing extra to do.
 *
 * Call this AFTER initTradingEngine() so portfolioManager is fully constructed.
 */

import type { EquityPoint } from './engine/portfolio-manager';
import { portfolioManager } from './engine/portfolio-manager';

const BOOTSTRAP_KEY  = 'atlas-bootstrap-v1';
const TRADING_DAYS   = 252;   // ~12 calendar months
const START_CAPITAL  = 1_000_000;

// ── Deterministic PRNG (LCG) ─────────────────────────────────────────────────

function makeLcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function boxMuller(rng: () => number): number {
  const u = rng() || 1e-10;
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── Equity-curve generator ────────────────────────────────────────────────────

/**
 * Generates a realistic 12-month equity curve using geometric Brownian motion.
 * Annual return ~14%, annual volatility ~12%, daily drift/vol scaled to 1 day.
 */
function generateMockEquityCurve(): EquityPoint[] {
  const rng = makeLcg(42);

  const annualReturn = 0.14;
  const annualVol    = 0.12;
  const dt           = 1 / 252;

  // GBM parameters
  const mu    = annualReturn * dt;
  const sigma = annualVol * Math.sqrt(dt);

  // Start 252 trading days ago (≈ 1 year)
  const now   = Date.now();
  const msPerTradingDay = (365 / 252) * 24 * 3600 * 1000;
  const startTs = now - TRADING_DAYS * msPerTradingDay;

  const points: EquityPoint[] = [];
  let nav      = START_CAPITAL;
  let highWater = START_CAPITAL;

  for (let i = 0; i <= TRADING_DAYS; i++) {
    const ts = Math.round(startTs + i * msPerTradingDay);

    // Regime: occasional drawdown periods (every ~60 days, lasts ~10 days)
    const regimeFactor = Math.sin(i / 30) > 0.85 ? -0.5 : 1.0;
    const shock        = boxMuller(rng);
    const logReturn    = (mu + regimeFactor * sigma * shock) - 0.5 * sigma * sigma;
    nav = nav * Math.exp(logReturn);
    nav = Math.max(nav, START_CAPITAL * 0.80); // floor at 20% drawdown

    if (nav > highWater) highWater = nav;

    points.push({
      timestamp:    ts,
      totalValue:   nav,
      cash:         nav * 0.15,             // approximate cash portion
      unrealizedPnl: nav - START_CAPITAL,
      realizedPnl:  0,
    });
  }

  return points;
}

// ── Bootstrap entry point ─────────────────────────────────────────────────────

export function initBootstrap(): void {
  const alreadyBootstrapped = localStorage.getItem(BOOTSTRAP_KEY);

  if (alreadyBootstrapped) {
    // Returning user — portfolio loaded from localStorage by portfolioManager ctor.
    console.log('[Bootstrap] Returning user — loaded persisted portfolio');
    return;
  }

  // First visit: seed synthetic equity curve
  const curve = generateMockEquityCurve();
  portfolioManager.seedEquityCurve(curve);

  localStorage.setItem(BOOTSTRAP_KEY, '1');
  console.log(
    `[Bootstrap] First visit — seeded ${curve.length} equity points over 12 months. ` +
    `Final NAV: $${Math.round(curve[curve.length - 1].totalValue).toLocaleString()}`
  );
}
