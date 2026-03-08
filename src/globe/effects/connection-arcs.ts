/**
 * Connection Arcs Effect
 *
 * Draws animated arcs from geopolitical events to affected financial centers:
 * - Event triggers signal → arc sweeps from event location to financial center
 * - Arc color matches signal type (gold geo, red disaster, purple momentum, etc.)
 * - Dash-array stroke animation traveling along path
 * - Arcs fade out after 30 seconds
 */

import { ArcLayer } from '@deck.gl/layers';

export interface ConnectionArc {
  id: string;
  sourcePosition: [number, number]; // [lon, lat] of event
  targetPosition: [number, number]; // [lon, lat] of financial center
  signalType: 'geopolitical' | 'sentiment' | 'momentum' | 'macro' | 'disaster' | 'crossasset' | 'predictionmarkets';
  createdAt: number; // Timestamp
  severity?: number; // 0-1, affects arc thickness
}

const SIGNAL_COLORS: Record<string, [number, number, number]> = {
  geopolitical: [212, 168, 67], // Gold
  sentiment: [79, 195, 247], // Cyan
  momentum: [179, 136, 255], // Purple
  macro: [0, 230, 118], // Green
  disaster: [255, 61, 61], // Red
  crossasset: [255, 213, 79], // Amber
  predictionmarkets: [6, 182, 212], // Cyan
};

const ARC_LIFETIME_MS = 30000; // 30 seconds
const FADE_START_MS = 20000; // Start fading at 20s

/**
 * Create connection arcs layer
 */
export function createConnectionArcsLayer(arcs: ConnectionArc[], currentTime: number): ArcLayer {
  // Filter out expired arcs
  const activeArcs = arcs.filter((arc) => currentTime - arc.createdAt < ARC_LIFETIME_MS);

  return new ArcLayer({
    id: 'connection-arcs',
    data: activeArcs,
    getSourcePosition: (d: ConnectionArc) => d.sourcePosition,
    getTargetPosition: (d: ConnectionArc) => d.targetPosition,
    getSourceColor: (d: ConnectionArc) => {
      const color = SIGNAL_COLORS[d.signalType] || [255, 255, 255];
      const opacity = getArcOpacity(d, currentTime);
      return [...color, opacity];
    },
    getTargetColor: (d: ConnectionArc) => {
      const color = SIGNAL_COLORS[d.signalType] || [255, 255, 255];
      const opacity = getArcOpacity(d, currentTime);
      return [...color, opacity];
    },
    getWidth: (d: ConnectionArc) => {
      const baseLine = 2;
      const severityMultiplier = d.severity ? 1 + d.severity * 2 : 1; // 1x to 3x
      return baseLine * severityMultiplier;
    },
    getTilt: 15, // Arc curvature
    greatCircle: true, // Follow Earth's curvature
    widthMinPixels: 1,
    widthMaxPixels: 6,
    pickable: false,
    updateTriggers: {
      getSourceColor: currentTime,
      getTargetColor: currentTime,
    },
  });
}

/**
 * Calculate arc opacity based on age
 * Starts at 255, holds steady for 20s, then fades to 0 over final 10s
 */
function getArcOpacity(arc: ConnectionArc, currentTime: number): number {
  const age = currentTime - arc.createdAt;

  if (age < FADE_START_MS) {
    return 255; // Full opacity
  }

  // Fade over final 10 seconds
  const fadeProgress = (age - FADE_START_MS) / (ARC_LIFETIME_MS - FADE_START_MS);
  return Math.max(0, 255 * (1 - fadeProgress));
}

/**
 * Connection Arc Manager
 * Manages arc lifecycle and cleanup
 */
export class ConnectionArcManager {
  private arcs: ConnectionArc[] = [];
  private nextId: number = 0;

  /**
   * Add a new arc from event to financial center
   */
  addArc(
    sourcePosition: [number, number],
    targetPosition: [number, number],
    signalType: ConnectionArc['signalType'],
    severity: number = 0.5
  ): string {
    const id = `arc-${this.nextId++}`;
    const arc: ConnectionArc = {
      id,
      sourcePosition,
      targetPosition,
      signalType,
      severity,
      createdAt: Date.now(),
    };

    this.arcs.push(arc);
    return id;
  }

  /**
   * Get all active arcs
   */
  getArcs(): ConnectionArc[] {
    return this.arcs;
  }

  /**
   * Clean up expired arcs
   */
  cleanup(): void {
    const now = Date.now();
    this.arcs = this.arcs.filter((arc) => now - arc.createdAt < ARC_LIFETIME_MS);
  }

  /**
   * Remove specific arc by ID
   */
  removeArc(id: string): void {
    this.arcs = this.arcs.filter((arc) => arc.id !== id);
  }

  /**
   * Clear all arcs
   */
  clear(): void {
    this.arcs = [];
  }
}

/**
 * Helper: Find nearest financial center to a position
 */
export function findNearestFinancialCenter(
  position: [number, number],
  financialCenters: Array<{ name: string; position: [number, number] }>
): { name: string; position: [number, number] } | null {
  if (financialCenters.length === 0) return null;

  let nearest = financialCenters[0];
  let minDistance = haversineDistance(position, nearest.position);

  for (const center of financialCenters) {
    const distance = haversineDistance(position, center.position);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = center;
    }
  }

  return nearest;
}

/**
 * Haversine distance between two [lon, lat] points (in km)
 */
function haversineDistance(pos1: [number, number], pos2: [number, number]): number {
  const [lon1, lat1] = pos1;
  const [lon2, lat2] = pos2;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
