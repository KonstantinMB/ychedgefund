/**
 * Heat Pulse Rings Effect
 *
 * Concentric rings radiating from high-severity geopolitical events:
 * - Conflict zones, disasters, major incidents pulse outward
 * - Ring expands over 4 seconds, fades as it grows
 * - Color matches event type (red for conflict, orange for disaster, gold for sanctions)
 * - Multiple rings can emanate from same location (staggered timing)
 */

import { ScatterplotLayer } from '@deck.gl/layers';

export interface HeatPulse {
  id: string;
  position: [number, number]; // [lon, lat]
  eventType: 'conflict' | 'disaster' | 'sanction' | 'nuclear' | 'energy';
  severity: number; // 0-1, affects max ring radius
  createdAt: number; // Timestamp
  pulseIndex: number; // For staggered multi-ring effect (0, 1, 2...)
}

const EVENT_COLORS: Record<string, [number, number, number]> = {
  conflict: [255, 61, 61], // Red
  disaster: [255, 152, 0], // Orange
  sanction: [212, 168, 67], // Gold
  nuclear: [255, 23, 68], // Crimson
  energy: [255, 179, 0], // Amber
};

const PULSE_DURATION_MS = 4000; // 4 seconds to expand
const PULSE_INTERVAL_MS = 1500; // New ring every 1.5s for multi-ring effect
const MAX_RINGS_PER_EVENT = 3;

/**
 * Create heat pulse rings layer
 * Uses ScatterplotLayer with expanding radius
 */
export function createHeatPulseLayer(pulses: HeatPulse[], currentTime: number): ScatterplotLayer {
  // Filter out expired pulses
  const activePulses = pulses.filter((pulse) => {
    const age = currentTime - pulse.createdAt;
    return age < PULSE_DURATION_MS;
  });

  return new ScatterplotLayer({
    id: 'heat-pulse-rings',
    data: activePulses,
    getPosition: (d: HeatPulse) => d.position,
    getRadius: (d: HeatPulse) => getPulseRadius(d, currentTime),
    getFillColor: (d: HeatPulse) => {
      const color = EVENT_COLORS[d.eventType] || [255, 255, 255];
      const opacity = getPulseOpacity(d, currentTime);
      return [...color, opacity];
    },
    radiusUnits: 'meters',
    radiusMinPixels: 0,
    radiusMaxPixels: 500,
    stroked: true,
    filled: false,
    getLineColor: (d: HeatPulse) => {
      const color = EVENT_COLORS[d.eventType] || [255, 255, 255];
      const opacity = getPulseOpacity(d, currentTime) * 1.5; // Brighter stroke
      return [...color, Math.min(255, opacity)];
    },
    getLineWidth: 3,
    lineWidthUnits: 'pixels',
    pickable: false,
    updateTriggers: {
      getRadius: currentTime,
      getFillColor: currentTime,
      getLineColor: currentTime,
    },
  });
}

/**
 * Calculate pulse radius based on age
 * Starts at 0, expands to max over PULSE_DURATION_MS
 */
function getPulseRadius(pulse: HeatPulse, currentTime: number): number {
  const age = currentTime - pulse.createdAt;
  const progress = Math.min(1, age / PULSE_DURATION_MS);

  // Ease-out cubic for smooth expansion
  const eased = 1 - Math.pow(1 - progress, 3);

  // Max radius based on severity (50km to 300km)
  const minRadius = 50_000; // 50km
  const maxRadius = 300_000; // 300km
  const severityRadius = minRadius + (maxRadius - minRadius) * pulse.severity;

  return eased * severityRadius;
}

/**
 * Calculate pulse opacity
 * Starts at max, fades as it expands
 */
function getPulseOpacity(pulse: HeatPulse, currentTime: number): number {
  const age = currentTime - pulse.createdAt;
  const progress = Math.min(1, age / PULSE_DURATION_MS);

  // Start bright, fade out
  return 180 * (1 - progress);
}

/**
 * Heat Pulse Manager
 * Handles pulse creation, multi-ring effect, cleanup
 */
export class HeatPulseManager {
  private pulses: HeatPulse[] = [];
  private nextId: number = 0;
  private eventTimers: Map<string, NodeJS.Timeout[]> = new Map();

  /**
   * Trigger heat pulse at location
   * Automatically creates multi-ring effect (3 rings, staggered)
   */
  triggerPulse(
    position: [number, number],
    eventType: HeatPulse['eventType'],
    severity: number = 0.7
  ): void {
    const eventKey = `${position[0]}-${position[1]}`;

    // Clear any existing timers for this location
    this.clearEventTimers(eventKey);

    // Create initial pulse immediately
    this.addSinglePulse(position, eventType, severity, 0);

    // Schedule additional rings
    const timers: NodeJS.Timeout[] = [];
    for (let i = 1; i < MAX_RINGS_PER_EVENT; i++) {
      const timer = setTimeout(() => {
        this.addSinglePulse(position, eventType, severity, i);
      }, i * PULSE_INTERVAL_MS);
      timers.push(timer);
    }

    this.eventTimers.set(eventKey, timers);

    // Auto-cleanup timers after all rings complete
    setTimeout(() => {
      this.clearEventTimers(eventKey);
    }, MAX_RINGS_PER_EVENT * PULSE_INTERVAL_MS + PULSE_DURATION_MS);
  }

  /**
   * Add a single pulse ring
   */
  private addSinglePulse(
    position: [number, number],
    eventType: HeatPulse['eventType'],
    severity: number,
    pulseIndex: number
  ): void {
    const id = `pulse-${this.nextId++}`;
    const pulse: HeatPulse = {
      id,
      position,
      eventType,
      severity,
      createdAt: Date.now(),
      pulseIndex,
    };

    this.pulses.push(pulse);
  }

  /**
   * Get all active pulses
   */
  getPulses(): HeatPulse[] {
    return this.pulses;
  }

  /**
   * Clean up expired pulses
   */
  cleanup(): void {
    const now = Date.now();
    this.pulses = this.pulses.filter((pulse) => now - pulse.createdAt < PULSE_DURATION_MS);
  }

  /**
   * Clear timers for a specific event location
   */
  private clearEventTimers(eventKey: string): void {
    const timers = this.eventTimers.get(eventKey);
    if (timers) {
      timers.forEach((timer) => clearTimeout(timer));
      this.eventTimers.delete(eventKey);
    }
  }

  /**
   * Clear all pulses and timers
   */
  clear(): void {
    this.pulses = [];
    this.eventTimers.forEach((timers) => {
      timers.forEach((timer) => clearTimeout(timer));
    });
    this.eventTimers.clear();
  }
}

/**
 * Helper: Determine event type from intelligence data
 */
export function classifyEventType(event: {
  category?: string;
  eventType?: string;
  tags?: string[];
}): HeatPulse['eventType'] {
  const category = event.category?.toLowerCase() || '';
  const type = event.eventType?.toLowerCase() || '';
  const tags = event.tags?.map((t) => t.toLowerCase()) || [];

  if (
    category.includes('conflict') ||
    category.includes('violence') ||
    type.includes('battle') ||
    tags.includes('conflict')
  ) {
    return 'conflict';
  }

  if (
    category.includes('disaster') ||
    category.includes('earthquake') ||
    category.includes('flood') ||
    type.includes('wildfire') ||
    tags.includes('disaster')
  ) {
    return 'disaster';
  }

  if (category.includes('nuclear') || tags.includes('nuclear')) {
    return 'nuclear';
  }

  if (
    category.includes('energy') ||
    category.includes('pipeline') ||
    tags.includes('energy')
  ) {
    return 'energy';
  }

  if (category.includes('sanction') || tags.includes('sanction')) {
    return 'sanction';
  }

  // Default fallback
  return 'conflict';
}
