/**
 * Atmosphere Glow Effect
 *
 * Subtle blue-white glow around Earth's edge that:
 * - Pulses gently (opacity 0.3 → 0.5 over 4s)
 * - Shifts to amber/red when global risk elevated
 * - Creates the "living planet" feeling
 */

import { SimpleMeshLayer } from '@deck.gl/mesh-layers';
import { SphereGeometry } from '@luma.gl/engine';

interface AtmosphereProps {
  riskLevel?: number; // 0-1, affects color tint
  pulsePhase?: number; // 0-1, animation phase
}

const EARTH_RADIUS_KM = 6371;
const ATMOSPHERE_THICKNESS_KM = 100; // Visual thickness
const ATMOSPHERE_RADIUS = EARTH_RADIUS_KM + ATMOSPHERE_THICKNESS_KM;

// Color shifts based on global risk
function getAtmosphereColor(riskLevel: number = 0, pulsePhase: number = 0): [number, number, number, number] {
  // Base colors
  const lowRisk = [135, 206, 250]; // Sky blue
  const highRisk = [212, 168, 67]; // Gold (tactical luxury)

  // Interpolate between low and high risk
  const r = lowRisk[0] + (highRisk[0] - lowRisk[0]) * riskLevel;
  const g = lowRisk[1] + (highRisk[1] - lowRisk[1]) * riskLevel;
  const b = lowRisk[2] + (highRisk[2] - lowRisk[2]) * riskLevel;

  // Pulse opacity between 0.3 and 0.5
  const opacity = 0.3 + 0.2 * Math.sin(pulsePhase * Math.PI * 2);

  return [r, g, b, opacity * 255];
}

export function createAtmosphereLayer(props: AtmosphereProps = {}): SimpleMeshLayer {
  const { riskLevel = 0, pulsePhase = 0 } = props;

  return new SimpleMeshLayer({
    id: 'atmosphere-glow',
    data: [{ position: [0, 0, 0] }],
    mesh: new SphereGeometry({
      nlat: 32,
      nlong: 64,
      radius: ATMOSPHERE_RADIUS,
    }),
    getPosition: (d: any) => d.position,
    getColor: getAtmosphereColor(riskLevel, pulsePhase),
    opacity: 1,
    wireframe: false,
    // Additive blending for glow effect
    parameters: {
      blend: true,
      blendFunc: ['src-alpha', 'one'], // Additive
      depthTest: false,
    },
    updateTriggers: {
      getColor: [riskLevel, pulsePhase],
    },
  });
}

/**
 * Atmosphere animation controller
 * Updates pulse phase every frame
 */
export class AtmosphereController {
  private pulsePhase: number = 0;
  private riskLevel: number = 0;
  private lastUpdate: number = Date.now();

  update(currentRiskLevel: number = 0): { pulsePhase: number; riskLevel: number } {
    const now = Date.now();
    const deltaMs = now - this.lastUpdate;
    this.lastUpdate = now;

    // Update pulse phase (4 second cycle)
    const PULSE_DURATION_MS = 4000;
    this.pulsePhase = (this.pulsePhase + deltaMs / PULSE_DURATION_MS) % 1;

    // Smoothly transition risk level
    const RISK_TRANSITION_SPEED = 0.02;
    this.riskLevel += (currentRiskLevel - this.riskLevel) * RISK_TRANSITION_SPEED;

    return {
      pulsePhase: this.pulsePhase,
      riskLevel: this.riskLevel,
    };
  }
}
