/**
 * Temporal Anomaly Detection — Welford's Online Algorithm
 * Maintains running mean and variance per (metric, key) without storing raw data.
 * States are persisted to localStorage so baselines survive page refreshes.
 * Runs entirely client-side in the browser.
 */

const STORAGE_KEY = 'atlas-anomaly-states';
const ANOMALY_THRESHOLD = 2.5; // |z-score| > 2.5 → anomaly

export interface AnomalyState {
  n: number;     // sample count
  mean: number;  // running mean (Welford)
  M2: number;    // sum of squared deviations (Welford)
}

export interface AnomalyResult {
  country: string;
  metric: string;
  currentValue: number;
  mean: number;
  stdDev: number;
  zScore: number;
  isAnomaly: boolean;
}

export class AnomalyDetector {
  private states: Map<string, AnomalyState> = new Map();

  /**
   * Welford's online update step.
   * Call this for every new observation of the named metric.
   */
  update(key: string, value: number): AnomalyState {
    const state = this.states.get(key) ?? { n: 0, mean: 0, M2: 0 };
    state.n++;
    const delta = value - state.mean;
    state.mean += delta / state.n;
    const delta2 = value - state.mean;
    state.M2 += delta * delta2;
    this.states.set(key, state);
    return state;
  }

  /** Sample variance (unbiased, n−1 denominator) */
  getVariance(key: string): number {
    const state = this.states.get(key);
    if (!state || state.n < 2) return 0;
    return state.M2 / (state.n - 1);
  }

  getStdDev(key: string): number {
    return Math.sqrt(this.getVariance(key));
  }

  /**
   * Update the running baseline and return the anomaly result for the observation.
   * Key format convention: "COUNTRY_CODE:metric_name" e.g. "UA:events"
   */
  check(key: string, value: number): AnomalyResult {
    this.update(key, value);
    const state = this.states.get(key)!;
    const stdDev = this.getStdDev(key);
    const zScore = stdDev > 0 ? (value - state.mean) / stdDev : 0;

    const parts = key.split(':');
    return {
      country: parts[0] ?? key,
      metric: parts[1] ?? 'value',
      currentValue: value,
      mean: state.mean,
      stdDev,
      zScore,
      isAnomaly: Math.abs(zScore) > ANOMALY_THRESHOLD,
    };
  }

  /** Return all keys currently being tracked */
  getTrackedKeys(): string[] {
    return Array.from(this.states.keys());
  }

  /** Return a snapshot of the current state for a key */
  getState(key: string): AnomalyState | null {
    return this.states.get(key) ?? null;
  }

  /** Persist all Welford states to localStorage */
  saveToStorage(): void {
    try {
      const serialisable: Record<string, AnomalyState> = {};
      this.states.forEach((state, key) => {
        serialisable[key] = state;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialisable));
    } catch {
      // Storage quota exceeded or private-browsing — silently skip
    }
  }

  /** Restore Welford states from localStorage (call once on init) */
  loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, AnomalyState>;
      for (const [key, state] of Object.entries(parsed)) {
        if (
          typeof state.n === 'number' &&
          typeof state.mean === 'number' &&
          typeof state.M2 === 'number'
        ) {
          this.states.set(key, state);
        }
      }
    } catch {
      // Corrupt or missing storage — start fresh
    }
  }

  /** Clear all tracked states (useful for testing / reset) */
  reset(): void {
    this.states.clear();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

export const anomalyDetector = new AnomalyDetector();
