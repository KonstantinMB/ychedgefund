/**
 * Financial Center Beacons
 *
 * Vertical light beams emanating from major financial centers:
 * - Beam height proportional to trading volume
 * - Color indicates market status (green = open, dim = closed, gold = high activity)
 * - Subtle pulsing animation when markets are open
 * - Taller beams for higher volume/importance
 */

import { ColumnLayer } from '@deck.gl/layers';

export interface FinancialBeacon {
  id: string;
  name: string; // "NYSE", "LSE", "TSE", etc.
  position: [number, number]; // [lon, lat]
  marketCode: string; // For checking if market is open
  baseVolume: number; // Normalized 0-1 base trading volume
  currentVolume?: number; // Real-time volume multiplier (0-2)
  isOpen: boolean; // Market currently open
  importance: number; // 0-1, affects base height
}

const BEACON_COLORS = {
  open: [0, 230, 118], // Green (market open)
  closed: [138, 154, 124], // Muted sage (market closed)
  highActivity: [212, 168, 67], // Gold (high volume)
};

const BASE_HEIGHT = 50_000; // 50km base height
const MAX_HEIGHT = 500_000; // 500km max height
const BASE_RADIUS = 8_000; // 8km base radius

/**
 * Create financial beacons layer
 */
export function createFinancialBeaconsLayer(
  beacons: FinancialBeacon[],
  pulsePhase: number = 0
): ColumnLayer {
  return new ColumnLayer({
    id: 'financial-beacons',
    data: beacons,
    getPosition: (d: FinancialBeacon) => d.position,
    getElevation: (d: FinancialBeacon) => getBeaconHeight(d, pulsePhase),
    getFillColor: (d: FinancialBeacon) => getBeaconColor(d, pulsePhase),
    getLineColor: (d: FinancialBeacon) => {
      const fillColor = getBeaconColor(d, pulsePhase);
      // Brighter outline
      return [fillColor[0], fillColor[1], fillColor[2], Math.min(255, fillColor[3] * 1.5)];
    },
    elevationScale: 1,
    radius: BASE_RADIUS,
    extruded: true,
    wireframe: false,
    pickable: true,
    autoHighlight: true,
    highlightColor: [212, 168, 67, 200],
    updateTriggers: {
      getElevation: pulsePhase,
      getFillColor: pulsePhase,
    },
  });
}

/**
 * Calculate beacon height based on volume and importance
 */
function getBeaconHeight(beacon: FinancialBeacon, pulsePhase: number): number {
  // Base height from importance (0.3 to 1.0 of max height)
  const importanceHeight = BASE_HEIGHT + (MAX_HEIGHT - BASE_HEIGHT) * beacon.importance;

  // Volume multiplier (0.5x to 2x)
  const volumeMultiplier = beacon.currentVolume || beacon.baseVolume;

  // Calculate final height
  let height = importanceHeight * volumeMultiplier;

  // Add pulse if market is open (subtle height oscillation)
  if (beacon.isOpen) {
    const pulseAmount = Math.sin(pulsePhase * Math.PI * 2) * 0.05; // ±5%
    height *= 1 + pulseAmount;
  }

  return height;
}

/**
 * Get beacon color based on market status and activity
 */
function getBeaconColor(beacon: FinancialBeacon, pulsePhase: number): [number, number, number, number] {
  const volumeMultiplier = beacon.currentVolume || beacon.baseVolume;
  const isHighActivity = volumeMultiplier > 1.5;

  let baseColor: [number, number, number];

  if (!beacon.isOpen) {
    baseColor = BEACON_COLORS.closed;
  } else if (isHighActivity) {
    baseColor = BEACON_COLORS.highActivity;
  } else {
    baseColor = BEACON_COLORS.open;
  }

  // Base opacity
  let opacity = beacon.isOpen ? 120 : 60;

  // Add pulse to opacity if open
  if (beacon.isOpen) {
    const pulseAmount = Math.sin(pulsePhase * Math.PI * 2) * 0.3; // ±30%
    opacity *= 1 + pulseAmount;
  }

  return [...baseColor, Math.min(255, opacity)];
}

/**
 * Financial Beacon Manager
 */
export class FinancialBeaconManager {
  private beacons: Map<string, FinancialBeacon> = new Map();
  private pulsePhase: number = 0;
  private lastUpdate: number = Date.now();

  /**
   * Add or update a beacon
   */
  setBeacon(beacon: FinancialBeacon): void {
    this.beacons.set(beacon.id, beacon);
  }

  /**
   * Update beacon volume
   */
  updateVolume(beaconId: string, currentVolume: number): void {
    const beacon = this.beacons.get(beaconId);
    if (beacon) {
      beacon.currentVolume = currentVolume;
    }
  }

  /**
   * Update beacon market status (open/closed)
   */
  updateMarketStatus(beaconId: string, isOpen: boolean): void {
    const beacon = this.beacons.get(beaconId);
    if (beacon) {
      beacon.isOpen = isOpen;
    }
  }

  /**
   * Get all beacons
   */
  getBeacons(): FinancialBeacon[] {
    return Array.from(this.beacons.values());
  }

  /**
   * Update animation (call every frame)
   */
  update(): { pulsePhase: number } {
    const now = Date.now();
    const deltaMs = now - this.lastUpdate;
    this.lastUpdate = now;

    // 3 second pulse cycle
    const PULSE_DURATION_MS = 3000;
    this.pulsePhase = (this.pulsePhase + deltaMs / PULSE_DURATION_MS) % 1;

    return { pulsePhase: this.pulsePhase };
  }

  /**
   * Remove beacon
   */
  removeBeacon(beaconId: string): void {
    this.beacons.delete(beaconId);
  }

  /**
   * Clear all beacons
   */
  clear(): void {
    this.beacons.clear();
  }
}

/**
 * Pre-defined major financial centers
 */
export const MAJOR_FINANCIAL_CENTERS: Omit<FinancialBeacon, 'isOpen' | 'currentVolume'>[] = [
  {
    id: 'nyse',
    name: 'New York Stock Exchange',
    position: [-74.0, 40.7],
    marketCode: 'NYSE',
    baseVolume: 1.0,
    importance: 1.0, // Most important
  },
  {
    id: 'nasdaq',
    name: 'NASDAQ',
    position: [-74.0, 40.7],
    marketCode: 'NYSE', // Same hours as NYSE
    baseVolume: 0.95,
    importance: 0.95,
  },
  {
    id: 'lse',
    name: 'London Stock Exchange',
    position: [-0.09, 51.51],
    marketCode: 'LSE',
    baseVolume: 0.85,
    importance: 0.9,
  },
  {
    id: 'tse',
    name: 'Tokyo Stock Exchange',
    position: [139.77, 35.68],
    marketCode: 'TSE',
    baseVolume: 0.8,
    importance: 0.85,
  },
  {
    id: 'hkex',
    name: 'Hong Kong Stock Exchange',
    position: [114.16, 22.28],
    marketCode: 'HKEX',
    baseVolume: 0.75,
    importance: 0.8,
  },
  {
    id: 'sse',
    name: 'Shanghai Stock Exchange',
    position: [121.49, 31.24],
    marketCode: 'SSE',
    baseVolume: 0.9,
    importance: 0.85,
  },
  {
    id: 'fwb',
    name: 'Frankfurt Stock Exchange',
    position: [8.68, 50.11],
    marketCode: 'FWB',
    baseVolume: 0.65,
    importance: 0.75,
  },
  {
    id: 'six',
    name: 'SIX Swiss Exchange',
    position: [8.54, 47.38],
    marketCode: 'SIX',
    baseVolume: 0.6,
    importance: 0.7,
  },
  {
    id: 'euronext',
    name: 'Euronext Paris',
    position: [2.35, 48.86],
    marketCode: 'LSE', // Use LSE hours as proxy
    baseVolume: 0.6,
    importance: 0.7,
  },
  {
    id: 'tsx',
    name: 'Toronto Stock Exchange',
    position: [-79.38, 43.65],
    marketCode: 'NYSE', // Similar hours to NYSE
    baseVolume: 0.5,
    importance: 0.65,
  },
  {
    id: 'asx',
    name: 'Australian Securities Exchange',
    position: [151.21, -33.87],
    marketCode: 'TSE', // Use TSE hours as proxy
    baseVolume: 0.5,
    importance: 0.6,
  },
  {
    id: 'bse',
    name: 'Bombay Stock Exchange',
    position: [72.85, 18.93],
    marketCode: 'HKEX', // Use HKEX hours as proxy
    baseVolume: 0.55,
    importance: 0.65,
  },
  {
    id: 'krx',
    name: 'Korea Exchange',
    position: [126.98, 37.57],
    marketCode: 'TSE', // Similar hours to TSE
    baseVolume: 0.65,
    importance: 0.7,
  },
  {
    id: 'sgx',
    name: 'Singapore Exchange',
    position: [103.85, 1.28],
    marketCode: 'HKEX', // Similar hours
    baseVolume: 0.6,
    importance: 0.7,
  },
  {
    id: 'bmv',
    name: 'Mexican Stock Exchange',
    position: [-99.13, 19.43],
    marketCode: 'NYSE', // Similar hours
    baseVolume: 0.4,
    importance: 0.5,
  },
];
