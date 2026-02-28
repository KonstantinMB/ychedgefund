/**
 * Intelligence Engine Coordinator
 * Wires CII, convergence detection, and anomaly detection to the data service.
 * All computation runs client-side; results are broadcast via CustomEvents on `window`.
 */

import { dataService } from '../lib/data-service';
import type { GdeltDetail, UsgsDetail } from '../lib/data-service';
import { ciiEngine } from './instability';
import { convergenceDetector } from './convergence';
import type { ConvergenceEvent } from './convergence';
import { anomalyDetector } from './anomaly';

let initialised = false;

/**
 * Build a merged convergence event list from USGS earthquakes and GDACS alerts.
 */
function buildConvergenceEvents(): ConvergenceEvent[] {
  const events: ConvergenceEvent[] = [];

  const usgs = dataService.getUsgs();
  if (usgs) {
    for (const eq of usgs.events) {
      events.push({ lat: eq.lat, lon: eq.lon, type: 'earthquake' });
    }
  }

  const gdacs = dataService.getGdacs();
  if (gdacs) {
    for (const alert of gdacs.alerts) {
      events.push({ lat: alert.lat, lon: alert.lon, type: `disaster:${alert.type}` });
    }
  }

  return events;
}

/**
 * Recompute CII and emit `cii-updated` on window.
 */
function recomputeCII(): void {
  const gdelt = dataService.getGdelt();
  const gdacs = dataService.getGdacs();

  if (!gdelt) return;

  ciiEngine.compute(gdelt.events, gdacs?.alerts ?? []);
  window.dispatchEvent(new CustomEvent('cii-updated'));
}

/**
 * Recompute convergence zones and emit `convergence-updated` on window.
 */
function recomputeConvergence(): void {
  const events = buildConvergenceEvents();
  const zones = convergenceDetector.detect(events);
  window.dispatchEvent(new CustomEvent('convergence-updated', { detail: { zones } }));
}

/**
 * Initialize the intelligence engine.
 * Safe to call multiple times — only initialises once.
 */
export function initIntelligenceEngine(): void {
  if (initialised) return;
  initialised = true;

  // Restore persisted Welford baselines from previous sessions
  anomalyDetector.loadFromStorage();

  // ── GDELT listener ──────────────────────────────────────────────────────────
  dataService.addEventListener('gdelt', (e: Event) => {
    const detail = (e as CustomEvent<GdeltDetail>).detail;

    // CII recompute
    const gdacs = dataService.getGdacs();
    ciiEngine.compute(detail.events, gdacs?.alerts ?? []);
    window.dispatchEvent(new CustomEvent('cii-updated'));

    // Anomaly detection: event count per country
    const countByCountry = new Map<string, number>();
    for (const event of detail.events) {
      if (!event.country) continue;
      const code = event.country.toUpperCase();
      countByCountry.set(code, (countByCountry.get(code) ?? 0) + 1);
    }
    for (const [code, count] of countByCountry) {
      const result = anomalyDetector.check(`${code}:events`, count);
      if (result.isAnomaly) {
        window.dispatchEvent(new CustomEvent('anomaly-detected', { detail: result }));
      }
    }

    anomalyDetector.saveToStorage();
  });

  // ── GDACS listener ──────────────────────────────────────────────────────────
  dataService.addEventListener('gdacs', (_e: Event) => {
    // CII needs refreshed GDACS data
    recomputeCII();

    // Convergence uses both GDACS + USGS
    recomputeConvergence();
  });

  // ── USGS listener ───────────────────────────────────────────────────────────
  dataService.addEventListener('usgs', (e: Event) => {
    const detail = (e as CustomEvent<UsgsDetail>).detail;

    // Convergence re-runs whenever earthquakes refresh
    recomputeConvergence();

    // Anomaly detection: earthquake magnitudes
    for (const eq of detail.events) {
      if (eq.magnitude >= 4.0) {
        const result = anomalyDetector.check('global:earthquake_magnitude', eq.magnitude);
        if (result.isAnomaly) {
          window.dispatchEvent(new CustomEvent('anomaly-detected', { detail: result }));
        }
      }
    }

    anomalyDetector.saveToStorage();
  });
}

// Re-export engines for panels that want to query them directly
export { ciiEngine } from './instability';
export { convergenceDetector } from './convergence';
export { anomalyDetector } from './anomaly';
