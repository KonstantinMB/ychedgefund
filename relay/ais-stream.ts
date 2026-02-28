/**
 * AISStream.io WebSocket Client
 * Connects to the AISStream.io global vessel tracking WebSocket
 * and broadcasts normalized position reports to subscribers.
 */

import { WebSocket } from 'ws';

export interface VesselPosition {
  mmsi: number;
  name: string;
  lat: number;
  lon: number;
  speed: number;    // knots (speed over ground)
  heading: number;  // degrees (course over ground)
  status: number;   // navigational status code
  timestamp: number;
}

const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';

export class AISStreamClient {
  private ws: WebSocket | null = null;
  private reconnectDelay = 5000;
  private stopped = false;
  private readonly subscribers: Set<(vessel: VesselPosition) => void> = new Set();

  connect(): void {
    if (this.stopped) return;

    this.ws = new WebSocket(AISSTREAM_URL);

    this.ws.on('open', () => {
      console.log('[AIS] Connected to AISStream.io');
      this.reconnectDelay = 5000; // reset on success

      this.ws!.send(JSON.stringify({
        APIKey: process.env.AISSTREAM_API_KEY ?? '',
        BoundingBoxes: [[[-90, -180], [90, 180]]], // global
        FilterMessageTypes: ['PositionReport'],
      }));
    });

    this.ws.on('message', (rawData: Buffer) => {
      try {
        const msg = JSON.parse(rawData.toString());
        if (msg.MessageType !== 'PositionReport') return;

        const report = msg.Message?.PositionReport;
        if (!report) return;

        const lat: number = report.Latitude;
        const lon: number = report.Longitude;

        // Skip invalid coordinates
        if (!lat || !lon || Math.abs(lat) > 90 || Math.abs(lon) > 180) return;

        const vessel: VesselPosition = {
          mmsi: msg.MetaData?.MMSI ?? 0,
          name: (msg.MetaData?.ShipName ?? 'Unknown').trim(),
          lat,
          lon,
          speed: report.Sog ?? 0,
          heading: report.Cog ?? 0,
          status: report.NavigationalStatus ?? 0,
          timestamp: Date.now(),
        };

        this.subscribers.forEach(cb => cb(vessel));
      } catch {
        // Skip malformed messages silently
      }
    });

    this.ws.on('close', () => {
      if (this.stopped) return;
      console.log(`[AIS] Disconnected, reconnecting in ${this.reconnectDelay}ms`);
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 60_000);
    });

    this.ws.on('error', (err: Error) => {
      console.error('[AIS] WebSocket error:', err.message);
    });
  }

  subscribe(callback: (vessel: VesselPosition) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  stop(): void {
    this.stopped = true;
    this.ws?.close();
    this.ws = null;
  }
}
