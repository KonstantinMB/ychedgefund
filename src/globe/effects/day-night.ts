/**
 * Day/Night Terminator Effect
 *
 * Calculates sun position and renders:
 * - Gradient where day/night boundary falls
 * - Night side slightly darker
 * - Financial centers in market hours get brighter glow
 * - Shows at a glance which markets are open RIGHT NOW
 */

import { PolygonLayer } from '@deck.gl/layers';

interface SunPosition {
  latitude: number;
  longitude: number;
}

/**
 * Calculate sun's subsolar point (where sun is directly overhead)
 * Based on current UTC time and date
 */
export function calculateSunPosition(date: Date = new Date()): SunPosition {
  const dayOfYear = getDayOfYear(date);
  const hoursUTC = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  // Solar declination (latitude where sun is overhead)
  // Simplified formula - accurate enough for visualization
  const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));

  // Solar hour angle (longitude where sun is overhead)
  // Sun travels 360° in 24 hours = 15°/hour
  const hourAngle = (hoursUTC - 12) * 15;

  return {
    latitude: declination,
    longitude: hourAngle,
  };
}

function getDayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Generate polygon representing night side of Earth
 * Creates a semi-circle polygon on the night side
 */
function generateNightPolygon(sunPos: SunPosition): number[][][] {
  const points: number[][] = [];
  const numPoints = 180; // Smooth curve

  // Calculate antipode (point opposite to sun)
  const antipodeLat = -sunPos.latitude;
  const antipodeLon = (sunPos.longitude + 180) % 360 - 180;

  // Generate semi-circle around antipode
  for (let i = 0; i <= numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;

    // 90° arc from sun position
    const lat = antipodeLat + 90 * Math.cos(angle);
    const lon = antipodeLon + 90 * Math.sin(angle) / Math.cos((lat * Math.PI) / 180);

    // Clamp coordinates
    const clampedLat = Math.max(-85, Math.min(85, lat));
    const clampedLon = ((lon + 180) % 360) - 180;

    points.push([clampedLon, clampedLat]);
  }

  return [points];
}

/**
 * Create day/night overlay layer
 */
export function createDayNightLayer(): PolygonLayer {
  const sunPos = calculateSunPosition();
  const nightPolygon = generateNightPolygon(sunPos);

  return new PolygonLayer({
    id: 'day-night-terminator',
    data: [{ polygon: nightPolygon }],
    getPolygon: (d: any) => d.polygon,
    getFillColor: [0, 0, 0, 60], // Semi-transparent black overlay
    stroked: true,
    getLineColor: [212, 168, 67, 100], // Subtle gold terminator line
    getLineWidth: 2,
    lineWidthMinPixels: 1,
    opacity: 1,
    pickable: false,
    updateTriggers: {
      getPolygon: Date.now(), // Update every minute
    },
  });
}

/**
 * Check if a financial center is in daylight (market hours)
 */
export function isInDaylight(lat: number, lon: number, date: Date = new Date()): boolean {
  const sunPos = calculateSunPosition(date);

  // Calculate angular distance from sun's position
  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  const lat1 = toRadians(sunPos.latitude);
  const lat2 = toRadians(lat);
  const deltaLon = toRadians(lon - sunPos.longitude);

  // Haversine formula
  const a =
    Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  const angularDistance = 2 * Math.asin(Math.sqrt(a));

  // If angular distance < 90° (π/2 radians), it's daytime
  return angularDistance < Math.PI / 2;
}

/**
 * Check if a market is currently in trading hours
 * Combines daylight check with actual market hour schedules
 */
export interface MarketHours {
  timezone: string;
  openHour: number; // UTC hour when market opens
  closeHour: number; // UTC hour when market closes
  weekdaysOnly?: boolean;
}

export const MARKET_SCHEDULES: Record<string, MarketHours> = {
  NYSE: { timezone: 'America/New_York', openHour: 14.5, closeHour: 21, weekdaysOnly: true }, // 9:30 AM - 4:00 PM ET
  LSE: { timezone: 'Europe/London', openHour: 8, closeHour: 16.5, weekdaysOnly: true }, // 8:00 AM - 4:30 PM GMT
  TSE: { timezone: 'Asia/Tokyo', openHour: 0, closeHour: 6, weekdaysOnly: true }, // 9:00 AM - 3:00 PM JST
  HKEX: { timezone: 'Asia/Hong_Kong', openHour: 1.5, closeHour: 8, weekdaysOnly: true }, // 9:30 AM - 4:00 PM HKT
  SSE: { timezone: 'Asia/Shanghai', openHour: 1.5, closeHour: 7, weekdaysOnly: true }, // 9:30 AM - 3:00 PM CST
  FWB: { timezone: 'Europe/Frankfurt', openHour: 8, closeHour: 20, weekdaysOnly: true }, // 9:00 AM - 8:00 PM CET
  SIX: { timezone: 'Europe/Zurich', openHour: 8, closeHour: 17, weekdaysOnly: true }, // 9:00 AM - 5:30 PM CET
};

export function isMarketOpen(marketCode: string, date: Date = new Date()): boolean {
  const schedule = MARKET_SCHEDULES[marketCode];
  if (!schedule) return false;

  const currentHourUTC = date.getUTCHours() + date.getUTCMinutes() / 60;
  const dayOfWeek = date.getUTCDay(); // 0 = Sunday, 6 = Saturday

  // Check if weekend
  if (schedule.weekdaysOnly && (dayOfWeek === 0 || dayOfWeek === 6)) {
    return false;
  }

  // Check if within trading hours
  if (schedule.openHour < schedule.closeHour) {
    // Same-day trading (e.g., 9 AM - 5 PM)
    return currentHourUTC >= schedule.openHour && currentHourUTC < schedule.closeHour;
  } else {
    // Overnight trading (crosses midnight UTC)
    return currentHourUTC >= schedule.openHour || currentHourUTC < schedule.closeHour;
  }
}

/**
 * Controller that updates day/night layer periodically
 */
export class DayNightController {
  private lastUpdate: number = 0;
  private updateInterval: number = 60000; // Update every minute

  shouldUpdate(): boolean {
    const now = Date.now();
    if (now - this.lastUpdate > this.updateInterval) {
      this.lastUpdate = now;
      return true;
    }
    return false;
  }
}
