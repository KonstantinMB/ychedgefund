/**
 * OpenSky Network REST Poller
 * OpenSky does not provide a WebSocket feed — we poll the REST API
 * every 30 seconds and push batched aircraft updates to subscribers.
 */

export interface AircraftState {
  icao24: string;
  callsign: string;
  country: string;
  lat: number;
  lon: number;
  altitude: number; // metres (barometric or geometric)
  velocity: number; // m/s
  heading: number;  // degrees true north
}

const OPENSKY_URL = 'https://opensky-network.org/api/states/all';
const MAX_AIRCRAFT = 800;

export class OpenSkyPoller {
  private interval: NodeJS.Timeout | null = null;
  private readonly subscribers: Set<(aircraft: AircraftState[]) => void> = new Set();

  start(intervalMs = 30_000): void {
    void this.poll(); // immediate first poll
    this.interval = setInterval(() => { void this.poll(); }, intervalMs);
  }

  private async poll(): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'Atlas Intelligence Platform (atlas-relay)',
      };

      const username = process.env.OPENSKY_USERNAME;
      const password = process.env.OPENSKY_PASSWORD;
      if (username && password) {
        const credentials = Buffer.from(`${username}:${password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
      }

      const res = await fetch(OPENSKY_URL, { headers });
      if (!res.ok) {
        console.warn(`[OpenSky] Poll returned ${res.status}`);
        return;
      }

      const json = await res.json() as { states: any[][] | null };
      const states = json.states ?? [];

      const aircraft: AircraftState[] = states
        // s[8] = on_ground boolean, s[5] = lon, s[6] = lat
        .filter((s) => s[6] !== null && s[5] !== null && s[8] === false)
        .slice(0, MAX_AIRCRAFT)
        .map((s) => ({
          icao24: String(s[0] ?? ''),
          callsign: String(s[1] ?? '').trim(),
          country: String(s[2] ?? ''),
          lat: s[6] as number,
          lon: s[5] as number,
          altitude: (s[7] ?? s[13] ?? 0) as number,
          velocity: (s[9] ?? 0) as number,
          heading: (s[10] ?? 0) as number,
        }));

      this.subscribers.forEach(cb => cb(aircraft));
    } catch (err) {
      // Network errors are transient — skip this poll cycle
      if (err instanceof Error) {
        console.warn('[OpenSky] Poll error:', err.message);
      }
    }
  }

  subscribe(callback: (aircraft: AircraftState[]) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
