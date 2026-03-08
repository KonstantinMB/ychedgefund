/**
 * Trade Route Particle Flows
 *
 * Animated particles flowing along major shipping/trade routes:
 * - Particles travel from origin → destination along great circle paths
 * - Flow speed indicates trade volume/activity
 * - Color indicates commodity type (blue = energy, green = goods, gold = finance)
 * - Particles regenerate continuously for "living" effect
 */

import { ScatterplotLayer } from '@deck.gl/layers';
import { PathLayer } from '@deck.gl/layers';

export interface TradeRoute {
  id: string;
  origin: [number, number]; // [lon, lat]
  destination: [number, number]; // [lon, lat]
  routeType: 'shipping' | 'energy' | 'finance' | 'data';
  volume: number; // 0-1, affects particle count
  bidirectional?: boolean; // Particles flow both ways
}

export interface TradeParticle {
  id: string;
  routeId: string;
  position: [number, number]; // Current [lon, lat]
  progress: number; // 0-1 along route
  routeType: TradeRoute['routeType'];
  direction: 'forward' | 'backward';
}

const ROUTE_COLORS: Record<string, [number, number, number]> = {
  shipping: [79, 195, 247], // Cyan (ocean blue)
  energy: [255, 179, 0], // Amber (oil/gas)
  finance: [212, 168, 67], // Gold (money)
  data: [179, 136, 255], // Purple (fiber optic)
};

const PARTICLE_SPEED = 0.00005; // Progress per frame (0.005% of route per frame)
const PARTICLES_PER_ROUTE_BASE = 20;
const PARTICLE_SIZE = 3000; // meters

/**
 * Create trade route paths layer (background trails)
 */
export function createTradeRoutePathsLayer(routes: TradeRoute[]): PathLayer {
  return new PathLayer({
    id: 'trade-route-paths',
    data: routes,
    getPath: (d: TradeRoute) => [d.origin, d.destination],
    getColor: (d: TradeRoute) => {
      const color = ROUTE_COLORS[d.routeType] || [255, 255, 255];
      return [...color, 30]; // Very faint background trail
    },
    getWidth: 2,
    widthUnits: 'pixels',
    widthMinPixels: 1,
    widthMaxPixels: 3,
    pickable: false,
  });
}

/**
 * Create trade route particles layer (animated dots)
 */
export function createTradeParticlesLayer(particles: TradeParticle[]): ScatterplotLayer {
  return new ScatterplotLayer({
    id: 'trade-route-particles',
    data: particles,
    getPosition: (d: TradeParticle) => d.position,
    getFillColor: (d: TradeParticle) => {
      const color = ROUTE_COLORS[d.routeType] || [255, 255, 255];
      return [...color, 200]; // Bright particles
    },
    getRadius: PARTICLE_SIZE,
    radiusUnits: 'meters',
    radiusMinPixels: 1,
    radiusMaxPixels: 4,
    pickable: false,
    updateTriggers: {
      getPosition: particles.map((p) => p.progress).join(','), // Update when positions change
    },
  });
}

/**
 * Trade Route Manager
 * Handles particle generation, movement, recycling
 */
export class TradeRouteManager {
  private routes: Map<string, TradeRoute> = new Map();
  private particles: TradeParticle[] = [];
  private nextParticleId: number = 0;

  /**
   * Add a trade route
   */
  addRoute(route: TradeRoute): void {
    this.routes.set(route.id, route);
    this.initializeParticlesForRoute(route);
  }

  /**
   * Remove a trade route
   */
  removeRoute(routeId: string): void {
    this.routes.delete(routeId);
    this.particles = this.particles.filter((p) => p.routeId !== routeId);
  }

  /**
   * Get all routes
   */
  getRoutes(): TradeRoute[] {
    return Array.from(this.routes.values());
  }

  /**
   * Get all particles
   */
  getParticles(): TradeParticle[] {
    return this.particles;
  }

  /**
   * Initialize particles for a route
   */
  private initializeParticlesForRoute(route: TradeRoute): void {
    const particleCount = Math.ceil(PARTICLES_PER_ROUTE_BASE * route.volume);

    // Create forward particles
    for (let i = 0; i < particleCount; i++) {
      const progress = i / particleCount; // Evenly space along route
      const position = interpolateGreatCircle(route.origin, route.destination, progress);

      this.particles.push({
        id: `particle-${this.nextParticleId++}`,
        routeId: route.id,
        position,
        progress,
        routeType: route.routeType,
        direction: 'forward',
      });
    }

    // Create backward particles if bidirectional
    if (route.bidirectional) {
      for (let i = 0; i < particleCount; i++) {
        const progress = i / particleCount;
        const position = interpolateGreatCircle(route.destination, route.origin, progress);

        this.particles.push({
          id: `particle-${this.nextParticleId++}`,
          routeId: route.id,
          position,
          progress,
          routeType: route.routeType,
          direction: 'backward',
        });
      }
    }
  }

  /**
   * Update particle positions (call every frame)
   */
  update(): void {
    for (const particle of this.particles) {
      const route = this.routes.get(particle.routeId);
      if (!route) continue;

      // Move particle along route
      particle.progress += PARTICLE_SPEED;

      // Reset when reaching end
      if (particle.progress >= 1) {
        particle.progress = 0;
      }

      // Update position based on direction
      if (particle.direction === 'forward') {
        particle.position = interpolateGreatCircle(
          route.origin,
          route.destination,
          particle.progress
        );
      } else {
        particle.position = interpolateGreatCircle(
          route.destination,
          route.origin,
          particle.progress
        );
      }
    }
  }

  /**
   * Clear all routes and particles
   */
  clear(): void {
    this.routes.clear();
    this.particles = [];
  }
}

/**
 * Interpolate position along great circle route
 */
function interpolateGreatCircle(
  start: [number, number],
  end: [number, number],
  progress: number
): [number, number] {
  const [lon1, lat1] = start;
  const [lon2, lat2] = end;

  // Convert to radians
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1Rad = toRad(lat1);
  const lon1Rad = toRad(lon1);
  const lat2Rad = toRad(lat2);
  const lon2Rad = toRad(lon2);

  // Calculate great circle distance
  const d =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((lat2Rad - lat1Rad) / 2) ** 2 +
          Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin((lon2Rad - lon1Rad) / 2) ** 2
      )
    );

  // Interpolate along great circle
  const a = Math.sin((1 - progress) * d) / Math.sin(d);
  const b = Math.sin(progress * d) / Math.sin(d);

  const x = a * Math.cos(lat1Rad) * Math.cos(lon1Rad) + b * Math.cos(lat2Rad) * Math.cos(lon2Rad);
  const y = a * Math.cos(lat1Rad) * Math.sin(lon1Rad) + b * Math.cos(lat2Rad) * Math.sin(lon2Rad);
  const z = a * Math.sin(lat1Rad) + b * Math.sin(lat2Rad);

  const latRad = Math.atan2(z, Math.sqrt(x * x + y * y));
  const lonRad = Math.atan2(y, x);

  return [toDeg(lonRad), toDeg(latRad)];
}

/**
 * Pre-defined major trade routes
 */
export const MAJOR_TRADE_ROUTES: TradeRoute[] = [
  // Asia → North America (Trans-Pacific shipping)
  {
    id: 'asia-na-shipping',
    origin: [121.5, 31.2], // Shanghai
    destination: [-118.2, 33.7], // Los Angeles
    routeType: 'shipping',
    volume: 1.0,
    bidirectional: true,
  },
  // Europe → Asia (Suez Canal route)
  {
    id: 'europe-asia-shipping',
    origin: [4.4, 51.2], // Rotterdam
    destination: [103.8, 1.3], // Singapore
    routeType: 'shipping',
    volume: 0.9,
    bidirectional: true,
  },
  // Middle East → Asia (Energy)
  {
    id: 'me-asia-energy',
    origin: [54.4, 24.5], // UAE (Abu Dhabi)
    destination: [139.7, 35.7], // Tokyo
    routeType: 'energy',
    volume: 0.8,
    bidirectional: false,
  },
  // US → Europe (Trans-Atlantic shipping)
  {
    id: 'us-europe-shipping',
    origin: [-74.0, 40.7], // New York
    destination: [4.4, 51.2], // Rotterdam
    routeType: 'shipping',
    volume: 0.7,
    bidirectional: true,
  },
  // Russia → Europe (Energy)
  {
    id: 'russia-europe-energy',
    origin: [37.6, 55.8], // Moscow
    destination: [13.4, 52.5], // Berlin
    routeType: 'energy',
    volume: 0.6,
    bidirectional: false,
  },
  // US → Asia (Finance)
  {
    id: 'us-asia-finance',
    origin: [-74.0, 40.7], // New York
    destination: [114.2, 22.3], // Hong Kong
    routeType: 'finance',
    volume: 0.9,
    bidirectional: true,
  },
  // London → New York (Finance)
  {
    id: 'london-ny-finance',
    origin: [-0.1, 51.5], // London
    destination: [-74.0, 40.7], // New York
    routeType: 'finance',
    volume: 1.0,
    bidirectional: true,
  },
  // Trans-Atlantic Data (fiber optic)
  {
    id: 'transatlantic-data',
    origin: [-6.3, 53.3], // Dublin
    destination: [-71.1, 42.4], // Boston
    routeType: 'data',
    volume: 0.8,
    bidirectional: true,
  },
  // Trans-Pacific Data
  {
    id: 'transpacific-data',
    origin: [-122.4, 37.8], // San Francisco
    destination: [139.7, 35.7], // Tokyo
    routeType: 'data',
    volume: 0.9,
    bidirectional: true,
  },
  // South Asia → Middle East (Energy reverse flow)
  {
    id: 'asia-me-shipping',
    origin: [72.9, 19.1], // Mumbai
    destination: [54.4, 24.5], // UAE
    routeType: 'shipping',
    volume: 0.5,
    bidirectional: true,
  },
];
