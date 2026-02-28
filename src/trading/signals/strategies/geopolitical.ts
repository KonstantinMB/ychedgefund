/**
 * Geopolitical Risk Mapping Strategy
 *
 * Inputs: CII scores from /src/intelligence/instability.ts
 * When any country CII Z-score > 2.0:
 *   a) Look up /src/data/geo-asset-mapping.json
 *   b) Find affected assets (long and short legs)
 *   c) Generate signals for each affected asset
 * Confidence: min(Z-score / 4.0, 0.85)
 * Reasoning: "Iran CII spike to 3.1σ → Long USO (oil supply risk)"
 * Runs whenever CII recalculates (~15 min)
 */

import type { Signal } from '../../engine';
import { signalBus } from '../signal-bus';
import { ciiEngine, type CIIScore } from '../../../intelligence/instability';
import geoAssetMapping from '../../../data/geo-asset-mapping.json';
import { isTradeable } from '../../data/universe';

const STRATEGY_NAME = 'geopolitical';
const UPDATE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const Z_SCORE_THRESHOLD = 2.0; // 2 standard deviations

let updateTimer: number | null = null;
let previousScores: Map<string, number> = new Map();

interface GeoMapping {
  long: string[];
  short: string[];
  confidence_base: number;
  rationale: string;
}

/**
 * Calculate Z-score for a country's CII
 *
 * Z-score = (current_score - mean) / std_dev
 */
function calculateZScore(country: string, score: number, allScores: CIIScore[]): number {
  const scores = allScores.map(s => s.score);

  if (scores.length < 5) {
    // Not enough data for meaningful statistics
    return 0;
  }

  const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance =
    scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  const zScore = (score - mean) / stdDev;

  return zScore;
}

/**
 * Generate signals for a country experiencing high instability
 */
function generateGeopoliticalSignals(
  country: string,
  ciiScore: CIIScore,
  zScore: number
): void {
  // Get geo-asset mapping for this country
  const mapping = (geoAssetMapping as Record<string, GeoMapping>)[country];

  if (!mapping) {
    console.log(`[GeopoliticalStrategy] No asset mapping for ${country}`);
    return;
  }

  const { long, short, confidence_base, rationale } = mapping;

  // Calculate signal confidence
  // Base confidence from mapping * Z-score strength
  const zScoreMultiplier = Math.min(zScore / 4.0, 1.0); // Cap at Z=4.0
  const confidence = Math.min(confidence_base * zScoreMultiplier, 0.85);

  const trend = ciiScore.trend;
  const score = ciiScore.score;

  // Generate LONG signals for assets that benefit from instability
  for (const symbol of long) {
    // Filter: Only trade if symbol is in our tradeable universe
    if (!isTradeable(symbol)) {
      console.log(`[GeopoliticalStrategy] Skipping ${symbol} (not in universe)`);
      continue;
    }

    const signal: Signal = {
      id: `geopolitical-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
      strategy: STRATEGY_NAME,
      symbol,
      direction: 'LONG',
      confidence,
      reasoning: `${country} CII spike to ${score} (Z-score: ${zScore.toFixed(1)}σ, ${trend}). ${rationale}`,
      targetReturn: 0.08, // 8% target (geopolitical events can be large moves)
      stopLoss: 0.03, // 3% stop
      takeProfit: 0.08,
      expiresAt: Date.now() + 48 * 60 * 60 * 1000, // 48 hours
    };

    signalBus.publish(signal);
  }

  // Generate SHORT signals for assets that suffer from instability
  for (const symbol of short) {
    // Filter: Only trade if symbol is in our tradeable universe
    if (!isTradeable(symbol)) {
      console.log(`[GeopoliticalStrategy] Skipping ${symbol} (not in universe)`);
      continue;
    }

    const signal: Signal = {
      id: `geopolitical-${symbol}-${Date.now()}`,
      timestamp: Date.now(),
      strategy: STRATEGY_NAME,
      symbol,
      direction: 'SHORT',
      confidence,
      reasoning: `${country} CII spike to ${score} (Z-score: ${zScore.toFixed(1)}σ, ${trend}). ${rationale}`,
      targetReturn: 0.08, // 8% target
      stopLoss: 0.03, // 3% stop
      takeProfit: 0.08,
      expiresAt: Date.now() + 48 * 60 * 60 * 1000, // 48 hours
    };

    signalBus.publish(signal);
  }

  console.log(
    `[GeopoliticalStrategy] Generated ${long.length + short.length} signals for ${country} (Z=${zScore.toFixed(1)}σ)`
  );
}

/**
 * Update cycle: check CII scores and generate signals
 */
function updateCycle(): void {
  console.log('[GeopoliticalStrategy] Running update cycle...');

  // Get all CII scores
  const allScores = ciiEngine.getTopN(200); // Get all countries

  if (allScores.length === 0) {
    console.log('[GeopoliticalStrategy] No CII scores available yet');
    return;
  }

  // Calculate Z-scores for each country
  for (const ciiScore of allScores) {
    const { country, score, trend } = ciiScore;

    const zScore = calculateZScore(country, score, allScores);

    // Check if Z-score exceeds threshold
    if (zScore >= Z_SCORE_THRESHOLD) {
      // Check if this is a new spike (not previously above threshold)
      const previousScore = previousScores.get(country) || 0;
      const previousZScore = calculateZScore(country, previousScore, allScores);

      // Only generate signals if this is a NEW spike or rising trend
      if (previousZScore < Z_SCORE_THRESHOLD || trend === 'rising') {
        console.log(
          `[GeopoliticalStrategy] High instability detected: ${country} (score: ${score}, Z: ${zScore.toFixed(1)}σ, trend: ${trend})`
        );

        generateGeopoliticalSignals(country, ciiScore, zScore);
      }
    }

    // Update previous scores
    previousScores.set(country, score);
  }

  // Cleanup old entries (countries no longer in top scores)
  const currentCountries = new Set(allScores.map(s => s.country));
  for (const country of previousScores.keys()) {
    if (!currentCountries.has(country)) {
      previousScores.delete(country);
    }
  }
}

/**
 * Initialize geopolitical strategy
 *
 * Runs every 15 minutes to check CII scores and generate signals.
 */
export function initGeopoliticalStrategy(): void {
  console.log('[GeopoliticalStrategy] Initializing...');

  // Run immediately
  updateCycle();

  // Then every 15 minutes
  updateTimer = window.setInterval(() => {
    updateCycle();
  }, UPDATE_INTERVAL_MS);

  console.log('[GeopoliticalStrategy] Initialized successfully');
}

/**
 * Shutdown geopolitical strategy (cleanup)
 */
export function shutdownGeopoliticalStrategy(): void {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
  console.log('[GeopoliticalStrategy] Shutdown complete');
}
