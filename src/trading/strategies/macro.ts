/**
 * Macro Indicator Divergence Strategy
 * Fetches FRED data and generates signals based on yield curve,
 * unemployment, and Fed funds rate divergences.
 */

import { signalAggregator } from '../signals';

interface FredIndicator {
  id: string;
  name: string;
  value: number;
  date: string;
  unit: string;
}

interface FredResponse {
  indicators: FredIndicator[];
  source: string;
  timestamp: number;
}

type MacroRegime = 'recession' | 'expansion' | 'stagflation' | 'neutral';

interface MacroSignalSpec {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  confidence: number;
}

const MACRO_SIGNALS: Record<MacroRegime, MacroSignalSpec[]> = {
  recession: [
    { symbol: 'TLT', direction: 'LONG',  confidence: 0.65 },
    { symbol: 'GLD', direction: 'LONG',  confidence: 0.60 },
    { symbol: 'SHY', direction: 'LONG',  confidence: 0.55 },
    { symbol: 'IWM', direction: 'SHORT', confidence: 0.60 },
    { symbol: 'EEM', direction: 'SHORT', confidence: 0.55 },
  ],
  expansion: [
    { symbol: 'EEM', direction: 'LONG',  confidence: 0.55 },
    { symbol: 'IWM', direction: 'LONG',  confidence: 0.55 },
    { symbol: 'SPY', direction: 'LONG',  confidence: 0.50 },
    { symbol: 'TLT', direction: 'SHORT', confidence: 0.50 },
  ],
  stagflation: [
    { symbol: 'GLD', direction: 'LONG',  confidence: 0.70 },
    { symbol: 'USO', direction: 'LONG',  confidence: 0.60 },
    { symbol: 'TLT', direction: 'SHORT', confidence: 0.55 },
    { symbol: 'SPY', direction: 'SHORT', confidence: 0.50 },
  ],
  neutral: [],
};

const REGIME_REASONINGS: Record<MacroRegime, string> = {
  recession:   'Inverted yield curve + rising unemployment → recession trade: long bonds/gold, short risk',
  expansion:   'Steepening yield curve → growth trade: long risk assets, short long-duration bonds',
  stagflation: 'Rising inflation + weak growth → stagflation trade: long commodities/gold, short bonds/equities',
  neutral:     'No clear macro regime signal',
};

function detectRegime(indicators: FredIndicator[]): MacroRegime {
  const yieldCurve   = indicators.find(i => i.id === 'T10Y2Y');
  const unemployment = indicators.find(i => i.id === 'UNRATE');
  const cpi          = indicators.find(i => i.id === 'CPIAUCSL');
  const fedFunds     = indicators.find(i => i.id === 'FEDFUNDS');

  const spread = yieldCurve?.value ?? 0;
  const unrate = unemployment?.value ?? 4;
  const cpiVal = cpi?.value ?? 300;
  const ff     = fedFunds?.value ?? 0;

  // Rough inflation proxy: high CPI index level + fed funds > 4% → elevated inflation
  const elevatedInflation = cpiVal > 310 && ff > 4;

  if (spread < 0 && unrate > 4.5) return 'recession';
  if (spread > 1.5 && unrate < 4)  return 'expansion';
  if (elevatedInflation && spread < 0.5) return 'stagflation';
  return 'neutral';
}

function generateMacroSignals(regime: MacroRegime): void {
  if (regime === 'neutral') return;

  const specs = MACRO_SIGNALS[regime];
  const reasoning = REGIME_REASONINGS[regime];
  const now = Date.now();

  for (const spec of specs) {
    signalAggregator.addSignal({
      strategy: 'macro',
      symbol: spec.symbol,
      direction: spec.direction,
      confidence: spec.confidence,
      reasoning,
      targetReturn: 0.07,
      stopLoss: 0.04,
      takeProfit: 0.12,
      timestamp: now,
    });
  }

  console.log(`[Strategy] Macro regime detected: ${regime}`);
}

async function analyzeIndicators(): Promise<void> {
  try {
    const res = await fetch('/api/market/fred');
    if (!res.ok) return;

    const json = (await res.json()) as FredResponse;
    if (!Array.isArray(json.indicators) || json.indicators.length === 0) return;

    const regime = detectRegime(json.indicators);
    generateMacroSignals(regime);
  } catch (err) {
    console.error('[Strategy] Macro FRED fetch failed:', err);
  }
}

export async function fetchMacroData(): Promise<void> {
  await analyzeIndicators();

  // Re-fetch every 6 hours to match FRED cache TTL
  setInterval(() => { void analyzeIndicators(); }, 6 * 60 * 60 * 1000);

  console.log('[Strategy] Macro strategy initialised');
}
