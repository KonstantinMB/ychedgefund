/**
 * Geographic Convergence Detector
 * Bins events into 5°×5° grid cells (≈500km at equator) and flags cells
 * where ≥3 events of ≥2 distinct types cluster within a 24-hour window.
 * Runs entirely client-side in the browser.
 */

export interface ConvergenceZone {
  id: string;
  lat: number;
  lon: number;
  radius: number;    // km — approximate cell radius for globe rendering
  events: number;
  types: string[];   // unique event types present
  score: number;     // eventCount × uniqueTypes × 1.5
  label: string;     // human-readable location label
  severity: 'notable' | 'significant' | 'critical';
}

interface GridCell {
  centerLat: number;
  centerLon: number;
  items: Array<{ type: string; lat: number; lon: number }>;
}

export interface ConvergenceEvent {
  lat: number;
  lon: number;
  type: string;
}

export class ConvergenceDetector {
  /** Grid cell size in degrees (5° ≈ 550 km at equator) */
  private readonly GRID_SIZE = 5;

  /**
   * Detect convergence zones from a mixed array of geo-located events.
   * Returns up to 10 zones sorted by score descending.
   */
  detect(events: ConvergenceEvent[]): ConvergenceZone[] {
    const grid = new Map<string, GridCell>();

    for (const event of events) {
      if (!isFinite(event.lat) || !isFinite(event.lon)) continue;

      const gridLat = Math.floor(event.lat / this.GRID_SIZE) * this.GRID_SIZE;
      const gridLon = Math.floor(event.lon / this.GRID_SIZE) * this.GRID_SIZE;
      const key = `${gridLat}:${gridLon}`;

      if (!grid.has(key)) {
        grid.set(key, {
          centerLat: gridLat + this.GRID_SIZE / 2,
          centerLon: gridLon + this.GRID_SIZE / 2,
          items: [],
        });
      }
      grid.get(key)!.items.push(event);
    }

    const zones: ConvergenceZone[] = [];

    for (const [key, cell] of grid) {
      if (cell.items.length < 3) continue;

      const types = [...new Set(cell.items.map(e => e.type))];
      if (types.length < 2) continue;

      const score = cell.items.length * types.length * 1.5;

      let severity: ConvergenceZone['severity'] = 'notable';
      if (types.length >= 5) severity = 'critical';
      else if (types.length >= 4) severity = 'significant';

      zones.push({
        id: key,
        lat: cell.centerLat,
        lon: cell.centerLon,
        radius: 550,
        events: cell.items.length,
        types,
        score,
        label: this.buildLabel(cell.centerLat, cell.centerLon, types),
        severity,
      });
    }

    return zones.sort((a, b) => b.score - a.score).slice(0, 10);
  }

  /** Build a human-readable label from coordinates and event types */
  private buildLabel(lat: number, lon: number, types: string[]): string {
    const ns = lat >= 0 ? 'N' : 'S';
    const ew = lon >= 0 ? 'E' : 'W';
    const coords = `${Math.abs(Math.round(lat))}°${ns} ${Math.abs(Math.round(lon))}°${ew}`;
    const typeStr = types.slice(0, 2).join(' + ');
    return `${coords} [${typeStr}]`;
  }
}

export const convergenceDetector = new ConvergenceDetector();
