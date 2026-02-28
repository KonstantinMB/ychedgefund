/**
 * Geopolitical Risk → Asset Mapping Strategy
 * Triggered by CII engine updates. Maps country instability scores to
 * correlated ETF longs/shorts via geo-asset-mapping.json.
 */

import type { CIIScore } from '../../intelligence/instability';
import { ciiEngine } from '../../intelligence/instability';
import { signalAggregator } from '../signals';
import GEO_ASSET_MAPPING from '../../data/geo-asset-mapping.json';

type GeoMappingEntry = {
  long: string[];
  short: string[];
  confidence_base: number;
  rationale: string;
};

const geoMap = GEO_ASSET_MAPPING as Record<string, GeoMappingEntry>;

const SAFE_HAVENS_LONG = ['GLD', 'TLT', 'IEF'] as const;
const CII_HIGH_THRESHOLD = 70;
const CII_LOW_THRESHOLD = 50;

function generateSignals(scores: CIIScore[]): void {
  const now = Date.now();

  for (const score of scores) {
    const mapping = geoMap[score.country];
    if (!mapping) continue;

    // High instability, rising → SHORT exposed ETFs, LONG safe havens
    if (score.score > CII_HIGH_THRESHOLD && score.trend === 'rising') {
      const confidence = Math.min(0.9, score.score / 100);
      const reasoning = `CII spike in ${score.country}: score ${score.score.toFixed(1)}, rising trend. ${mapping.rationale}`;

      for (const symbol of mapping.short) {
        signalAggregator.addSignal({
          strategy: 'geopolitical',
          symbol,
          direction: 'SHORT',
          confidence: confidence * mapping.confidence_base,
          reasoning,
          targetReturn: 0.08,
          stopLoss: 0.05,
          takeProfit: 0.15,
          timestamp: now,
        });
      }

      // Safe haven longs
      const safeHavenConfidence = Math.min(0.75, confidence * 0.85);
      for (const symbol of SAFE_HAVENS_LONG) {
        signalAggregator.addSignal({
          strategy: 'geopolitical',
          symbol,
          direction: 'LONG',
          confidence: safeHavenConfidence,
          reasoning: `Safe haven demand: CII ${score.score.toFixed(1)} in ${score.country}`,
          targetReturn: 0.05,
          stopLoss: 0.03,
          takeProfit: 0.10,
          timestamp: now,
        });
      }
    }

    // Low instability, falling → LONG recovery ETFs
    if (score.score < CII_LOW_THRESHOLD && score.trend === 'falling') {
      const confidence = Math.min(0.65, mapping.confidence_base * (1 - score.score / 100));
      const reasoning = `CII stabilising in ${score.country}: score ${score.score.toFixed(1)}, falling trend.`;

      for (const symbol of mapping.long) {
        signalAggregator.addSignal({
          strategy: 'geopolitical',
          symbol,
          direction: 'LONG',
          confidence,
          reasoning,
          targetReturn: 0.06,
          stopLoss: 0.04,
          takeProfit: 0.12,
          timestamp: now,
        });
      }
    }
  }
}

export function initGeopoliticalStrategy(): void {
  window.addEventListener('cii-updated', () => {
    const top = ciiEngine.getTopN(20);
    generateSignals(top);
  });

  console.log('[Strategy] Geopolitical strategy initialised');
}
