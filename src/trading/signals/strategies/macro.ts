/**
 * Macro Regime Strategy
 *
 * Inputs: FRED data from /api/market/fred edge function
 * Key series: DGS2, DGS10 (yield curve), ICSA (claims), VIXCLS (VIX), CPIAUCSL (CPI)
 * Regime classification:
 *   RISK-ON: yield curve > 0, VIX < 20, claims falling
 *   RISK-OFF: yield curve < 0 OR VIX > 25 OR claims rising >10%
 *   CRISIS: yield curve < -0.5 AND VIX > 30
 * Runs daily (macro data doesn't change intraday)
 */

import type { Signal } from '../../engine';
import { signalBus } from '../signal-bus';

const STRATEGY_NAME = 'macro';
const UPDATE_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

let updateTimer: number | null = null;

type MacroRegime = 'RISK-ON' | 'RISK-OFF' | 'CRISIS';

interface MacroData {
  yieldCurve: number | null; // 10Y - 2Y spread
  vix: number | null;
  claims: number | null;
  claimsChange: number | null; // % change WoW
}

let lastMacroData: MacroData | null = null;

/**
 * Fetch FRED macro indicators
 */
async function fetchMacroIndicators(): Promise<MacroData> {
  try {
    // Fetch VIX from Yahoo (FRED VIX series is delayed)
    const vixResponse = await fetch('/api/market/yahoo');
    const vixData = await vixResponse.json();
    const vixQuote = vixData.quotes?.find((q: any) => q.symbol === 'VIX');
    const vix = vixQuote?.price || null;

    // For now, use mock data for FRED indicators
    // TODO: Implement /api/market/fred endpoint for DGS2, DGS10, ICSA
    const yieldCurve = 0.3; // Mock: positive (RISK-ON)
    const claims = 220000; // Mock
    const claimsChange = -2.5; // Mock: falling (RISK-ON)

    return {
      yieldCurve,
      vix,
      claims,
      claimsChange,
    };
  } catch (error) {
    console.error('[MacroStrategy] Error fetching macro indicators:', error);
    return {
      yieldCurve: null,
      vix: null,
      claims: null,
      claimsChange: null,
    };
  }
}

/**
 * Classify macro regime based on indicators
 */
function classifyRegime(data: MacroData): MacroRegime {
  const { yieldCurve, vix, claimsChange } = data;

  // CRISIS: yield curve inverted < -0.5% AND VIX > 30
  if (yieldCurve !== null && vix !== null) {
    if (yieldCurve < -0.005 && vix > 30) {
      return 'CRISIS';
    }
  }

  // RISK-OFF: yield curve inverted OR VIX > 25 OR claims rising > 10%
  if (
    (yieldCurve !== null && yieldCurve < 0) ||
    (vix !== null && vix > 25) ||
    (claimsChange !== null && claimsChange > 10)
  ) {
    return 'RISK-OFF';
  }

  // Default: RISK-ON
  return 'RISK-ON';
}

/**
 * Generate signals based on macro regime
 */
function generateMacroSignals(regime: MacroRegime, data: MacroData): void {
  const { yieldCurve, vix, claimsChange } = data;

  const reasoning = `Macro regime: ${regime}. Yield curve: ${yieldCurve?.toFixed(2)}%, VIX: ${vix?.toFixed(1)}, Claims change: ${claimsChange?.toFixed(1)}%`;

  if (regime === 'RISK-ON') {
    // RISK-ON → long SPY, QQQ, XLK, short TLT
    const signals: Partial<Signal>[] = [
      {
        symbol: 'SPY',
        direction: 'LONG',
        confidence: 0.65,
        reasoning: `${reasoning}. Risk-on environment favors equities.`,
        targetReturn: 0.05,
      },
      {
        symbol: 'QQQ',
        direction: 'LONG',
        confidence: 0.7,
        reasoning: `${reasoning}. Tech leads in risk-on rallies.`,
        targetReturn: 0.06,
      },
      {
        symbol: 'TLT',
        direction: 'SHORT',
        confidence: 0.6,
        reasoning: `${reasoning}. Bonds underperform in risk-on.`,
        targetReturn: 0.04,
      },
    ];

    signals.forEach(partial => publishSignal(partial));
  } else if (regime === 'RISK-OFF') {
    // RISK-OFF → long TLT, GLD, XLU, short QQQ
    const signals: Partial<Signal>[] = [
      {
        symbol: 'TLT',
        direction: 'LONG',
        confidence: 0.7,
        reasoning: `${reasoning}. Flight to safety → Treasuries.`,
        targetReturn: 0.05,
      },
      {
        symbol: 'GLD',
        direction: 'LONG',
        confidence: 0.75,
        reasoning: `${reasoning}. Gold as safe haven.`,
        targetReturn: 0.06,
      },
      {
        symbol: 'XLU',
        direction: 'LONG',
        confidence: 0.6,
        reasoning: `${reasoning}. Defensive utilities.`,
        targetReturn: 0.04,
      },
      {
        symbol: 'QQQ',
        direction: 'SHORT',
        confidence: 0.65,
        reasoning: `${reasoning}. Tech vulnerable in risk-off.`,
        targetReturn: 0.05,
      },
    ];

    signals.forEach(partial => publishSignal(partial));
  } else if (regime === 'CRISIS') {
    // CRISIS → long GLD, TLT, short SPY, HYG
    const signals: Partial<Signal>[] = [
      {
        symbol: 'GLD',
        direction: 'LONG',
        confidence: 0.85,
        reasoning: `${reasoning}. CRISIS mode → maximum safe haven.`,
        targetReturn: 0.10,
      },
      {
        symbol: 'TLT',
        direction: 'LONG',
        confidence: 0.8,
        reasoning: `${reasoning}. CRISIS → Treasury surge.`,
        targetReturn: 0.08,
      },
      {
        symbol: 'SPY',
        direction: 'SHORT',
        confidence: 0.75,
        reasoning: `${reasoning}. CRISIS → equity collapse.`,
        targetReturn: 0.12,
      },
      {
        symbol: 'HYG',
        direction: 'SHORT',
        confidence: 0.7,
        reasoning: `${reasoning}. High yield bonds crash in crisis.`,
        targetReturn: 0.10,
      },
    ];

    signals.forEach(partial => publishSignal(partial));
  }

  console.log(`[MacroStrategy] Generated signals for ${regime} regime`);
}

/**
 * Helper to publish a signal with defaults
 */
function publishSignal(partial: Partial<Signal>): void {
  const signal: Signal = {
    id: `macro-${partial.symbol}-${Date.now()}`,
    timestamp: Date.now(),
    strategy: STRATEGY_NAME,
    symbol: partial.symbol!,
    direction: partial.direction!,
    confidence: partial.confidence!,
    reasoning: partial.reasoning!,
    targetReturn: partial.targetReturn || 0.05,
    stopLoss: 0.03,
    takeProfit: partial.targetReturn || 0.05,
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days (macro is longer-term)
  };

  signalBus.publish(signal);
}

/**
 * Update cycle: fetch macro data and generate signals
 */
async function updateCycle(): Promise<void> {
  console.log('[MacroStrategy] Running update cycle...');

  const data = await fetchMacroIndicators();

  if (data.yieldCurve === null && data.vix === null) {
    console.log('[MacroStrategy] Insufficient macro data');
    return;
  }

  const regime = classifyRegime(data);

  console.log(`[MacroStrategy] Regime: ${regime}`);

  // Only generate new signals if regime changed
  if (
    !lastMacroData ||
    classifyRegime(lastMacroData) !== regime
  ) {
    generateMacroSignals(regime, data);
  }

  lastMacroData = data;
}

/**
 * Initialize macro strategy
 *
 * Runs daily to check macro regime and generate signals.
 */
export function initMacroStrategy(): void {
  console.log('[MacroStrategy] Initializing...');

  // Run immediately
  updateCycle();

  // Then every 24 hours
  updateTimer = window.setInterval(() => {
    updateCycle();
  }, UPDATE_INTERVAL_MS);

  console.log('[MacroStrategy] Initialized successfully');
}

/**
 * Shutdown macro strategy (cleanup)
 */
export function shutdownMacroStrategy(): void {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
  console.log('[MacroStrategy] Shutdown complete');
}
