/**
 * GDELT News Sentiment Momentum Strategy
 * Computes 4-hour rolling average tone per country from GDELT events.
 * Triggers signals when |rollingTone| > 3.0.
 */

import type { GdeltEvent, GdeltDetail } from '../../lib/data-service';
import { dataService } from '../../lib/data-service';
import { signalAggregator } from '../signals';
import GEO_ASSET_MAPPING from '../../data/geo-asset-mapping.json';

type GeoMappingEntry = {
  long: string[];
  short: string[];
  confidence_base: number;
  rationale: string;
};

const geoMap = GEO_ASSET_MAPPING as Record<string, GeoMappingEntry>;

const TONE_THRESHOLD = 3.0;
const ROLLING_WINDOW_MS = 4 * 60 * 60 * 1000; // 4 hours

// Rolling event buffer — kept in module scope
let eventBuffer: GdeltEvent[] = [];

/**
 * Compute average GDELT tone per country for events in the last 4 hours.
 */
function computeRegionTones(events: GdeltEvent[]): Map<string, number> {
  const cutoff = Date.now() - ROLLING_WINDOW_MS;
  const recent = events.filter(e => e.timestamp >= cutoff && e.tone !== null);

  const tonesByCountry = new Map<string, number[]>();
  for (const event of recent) {
    if (!event.country || event.tone === null) continue;
    const code = event.country.toUpperCase();
    const arr = tonesByCountry.get(code) ?? [];
    arr.push(event.tone);
    tonesByCountry.set(code, arr);
  }

  const avgTones = new Map<string, number>();
  for (const [code, tones] of tonesByCountry) {
    if (tones.length === 0) continue;
    const avg = tones.reduce((a, b) => a + b, 0) / tones.length;
    avgTones.set(code, avg);
  }
  return avgTones;
}

function generateSentimentSignals(tones: Map<string, number>): void {
  const now = Date.now();

  for (const [code, avgTone] of tones) {
    if (Math.abs(avgTone) <= TONE_THRESHOLD) continue;

    const mapping = geoMap[code];
    if (!mapping) continue;

    const confidence = Math.min(0.85, mapping.confidence_base * (Math.abs(avgTone) / 10));
    const reasoning = `GDELT 4h tone for ${code}: ${avgTone.toFixed(2)} (threshold ±${TONE_THRESHOLD})`;

    if (avgTone < -TONE_THRESHOLD) {
      // Negative sentiment → SHORT sector ETFs, LONG GLD
      for (const symbol of mapping.short) {
        signalAggregator.addSignal({
          strategy: 'sentiment',
          symbol,
          direction: 'SHORT',
          confidence,
          reasoning,
          targetReturn: 0.06,
          stopLoss: 0.04,
          takeProfit: 0.12,
          timestamp: now,
        });
      }
      signalAggregator.addSignal({
        strategy: 'sentiment',
        symbol: 'GLD',
        direction: 'LONG',
        confidence: confidence * 0.8,
        reasoning: `Negative sentiment hedge: ${code} tone ${avgTone.toFixed(2)}`,
        targetReturn: 0.04,
        stopLoss: 0.03,
        takeProfit: 0.08,
        timestamp: now,
      });
    } else if (avgTone > TONE_THRESHOLD) {
      // Positive sentiment → LONG sector ETFs
      for (const symbol of mapping.long) {
        signalAggregator.addSignal({
          strategy: 'sentiment',
          symbol,
          direction: 'LONG',
          confidence: confidence * 0.7,
          reasoning,
          targetReturn: 0.05,
          stopLoss: 0.03,
          takeProfit: 0.10,
          timestamp: now,
        });
      }
    }
  }
}

export function initSentimentStrategy(): void {
  dataService.addEventListener('gdelt', (e: Event) => {
    const detail = (e as CustomEvent<GdeltDetail>).detail;

    // Merge new events into rolling buffer, cap to 2000 most recent
    eventBuffer = [...eventBuffer, ...detail.events]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 2000);

    const tones = computeRegionTones(eventBuffer);
    generateSentimentSignals(tones);
  });

  console.log('[Strategy] Sentiment strategy initialised');
}
