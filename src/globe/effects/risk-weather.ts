/**
 * Risk Weather Choropleth System
 *
 * Country-level risk visualization via color fills:
 * - Composite risk score from: CII + portfolio exposure + recent events
 * - Color scale: Green (safe) → Yellow (caution) → Red (danger) → Crimson (critical)
 * - Smooth transitions as risk levels change
 * - Respects "Tactical Luxury" palette (no bright saturated colors)
 */

import { GeoJsonLayer } from '@deck.gl/layers';

export interface CountryRisk {
  countryCode: string; // ISO 3166-1 alpha-3 (e.g., "USA", "CHN")
  countryName: string;
  riskScore: number; // 0-1 composite risk
  ciiScore?: number; // Country Instability Index
  exposureScore?: number; // Portfolio exposure
  eventScore?: number; // Recent event density
  lastUpdated: number;
}

/**
 * Risk color scale (tactical muted tones)
 */
function getRiskColor(riskScore: number): [number, number, number, number] {
  // Clamp to 0-1
  const score = Math.max(0, Math.min(1, riskScore));

  if (score < 0.25) {
    // Low risk: Dark green → Sage green
    const t = score / 0.25;
    const r = 30 + (90 - 30) * t;
    const g = 100 + (130 - 100) * t;
    const b = 60 + (80 - 60) * t;
    return [r, g, b, 120];
  } else if (score < 0.5) {
    // Medium-low risk: Sage → Amber
    const t = (score - 0.25) / 0.25;
    const r = 90 + (180 - 90) * t;
    const g = 130 + (140 - 130) * t;
    const b = 80 + (60 - 80) * t;
    return [r, g, b, 140];
  } else if (score < 0.75) {
    // Medium-high risk: Amber → Orange
    const t = (score - 0.5) / 0.25;
    const r = 180 + (220 - 180) * t;
    const g = 140 + (100 - 140) * t;
    const b = 60 + (40 - 60) * t;
    return [r, g, b, 160];
  } else {
    // High risk: Orange → Deep red
    const t = (score - 0.75) / 0.25;
    const r = 220 + (180 - 220) * t;
    const g = 100 + (30 - 100) * t;
    const b = 40 + (30 - 40) * t;
    return [r, g, b, 180];
  }
}

/**
 * Create risk weather choropleth layer
 */
export function createRiskWeatherLayer(
  geoJsonData: any, // GeoJSON FeatureCollection of countries
  riskData: Map<string, CountryRisk>
): GeoJsonLayer {
  return new GeoJsonLayer({
    id: 'risk-weather-choropleth',
    data: geoJsonData,
    filled: true,
    stroked: true,
    getFillColor: (feature: any) => {
      const countryCode = feature.properties?.ISO_A3 || feature.properties?.iso_a3;
      const risk = riskData.get(countryCode);

      if (!risk) {
        // No data: very subtle dark fill
        return [20, 30, 20, 40];
      }

      return getRiskColor(risk.riskScore);
    },
    getLineColor: [212, 168, 67, 60], // Subtle gold borders
    getLineWidth: 1,
    lineWidthMinPixels: 0.5,
    pickable: true,
    autoHighlight: true,
    highlightColor: [212, 168, 67, 100],
    updateTriggers: {
      getFillColor: Array.from(riskData.values()).map((r) => r.riskScore).join(','),
    },
    transitions: {
      getFillColor: 1000, // 1s smooth color transitions
    },
  });
}

/**
 * Risk Weather Manager
 */
export class RiskWeatherManager {
  private countryRisks: Map<string, CountryRisk> = new Map();

  /**
   * Update risk for a country
   */
  setCountryRisk(risk: CountryRisk): void {
    this.countryRisks.set(risk.countryCode, risk);
  }

  /**
   * Calculate composite risk from components
   */
  calculateCompositeRisk(
    countryCode: string,
    ciiScore: number = 0,
    exposureScore: number = 0,
    eventScore: number = 0
  ): number {
    // Weighted average (CII is most important)
    const weights = {
      cii: 0.5,
      exposure: 0.3,
      event: 0.2,
    };

    const composite =
      ciiScore * weights.cii +
      exposureScore * weights.exposure +
      eventScore * weights.event;

    return Math.max(0, Math.min(1, composite));
  }

  /**
   * Update country risk with auto-composite calculation
   */
  updateCountryRisk(
    countryCode: string,
    countryName: string,
    options: {
      ciiScore?: number;
      exposureScore?: number;
      eventScore?: number;
    }
  ): void {
    const existing = this.countryRisks.get(countryCode);

    const ciiScore = options.ciiScore ?? existing?.ciiScore ?? 0;
    const exposureScore = options.exposureScore ?? existing?.exposureScore ?? 0;
    const eventScore = options.eventScore ?? existing?.eventScore ?? 0;

    const riskScore = this.calculateCompositeRisk(
      countryCode,
      ciiScore,
      exposureScore,
      eventScore
    );

    this.setCountryRisk({
      countryCode,
      countryName,
      riskScore,
      ciiScore,
      exposureScore,
      eventScore,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Get risk for a country
   */
  getCountryRisk(countryCode: string): CountryRisk | undefined {
    return this.countryRisks.get(countryCode);
  }

  /**
   * Get all country risks
   */
  getAllRisks(): Map<string, CountryRisk> {
    return this.countryRisks;
  }

  /**
   * Get top N riskiest countries
   */
  getTopRiskyCountries(limit: number = 10): CountryRisk[] {
    return Array.from(this.countryRisks.values())
      .sort((a, b) => b.riskScore - a.riskScore)
      .slice(0, limit);
  }

  /**
   * Clear all risk data
   */
  clear(): void {
    this.countryRisks.clear();
  }

  /**
   * Decay event scores over time (call periodically)
   * Event scores fade 10% per hour
   */
  decayEventScores(): void {
    const DECAY_RATE = 0.1; // 10% per hour
    const now = Date.now();

    for (const [countryCode, risk] of this.countryRisks.entries()) {
      if (risk.eventScore && risk.eventScore > 0) {
        const hoursSinceUpdate = (now - risk.lastUpdated) / (1000 * 60 * 60);
        const decayFactor = Math.pow(1 - DECAY_RATE, hoursSinceUpdate);

        risk.eventScore *= decayFactor;

        // Recalculate composite
        risk.riskScore = this.calculateCompositeRisk(
          countryCode,
          risk.ciiScore,
          risk.exposureScore,
          risk.eventScore
        );

        risk.lastUpdated = now;
      }
    }
  }
}

/**
 * Helper: Map country name to ISO A3 code
 * (Simplified - in production, use a proper mapping library)
 */
export const COUNTRY_NAME_TO_ISO3: Record<string, string> = {
  'United States': 'USA',
  'United Kingdom': 'GBR',
  China: 'CHN',
  Russia: 'RUS',
  Japan: 'JPN',
  Germany: 'DEU',
  France: 'FRA',
  India: 'IND',
  Brazil: 'BRA',
  Canada: 'CAN',
  Australia: 'AUS',
  'South Korea': 'KOR',
  Mexico: 'MEX',
  Spain: 'ESP',
  Italy: 'ITA',
  Turkey: 'TUR',
  'Saudi Arabia': 'SAU',
  Iran: 'IRN',
  Israel: 'ISR',
  'United Arab Emirates': 'ARE',
  Egypt: 'EGY',
  'South Africa': 'ZAF',
  Nigeria: 'NGA',
  Pakistan: 'PAK',
  Bangladesh: 'BGD',
  Indonesia: 'IDN',
  Thailand: 'THA',
  Vietnam: 'VNM',
  Philippines: 'PHL',
  Poland: 'POL',
  Ukraine: 'UKR',
  Argentina: 'ARG',
  Colombia: 'COL',
  Chile: 'CHL',
  Peru: 'PER',
  Venezuela: 'VEN',
  Iraq: 'IRQ',
  Syria: 'SYR',
  Afghanistan: 'AFG',
  Yemen: 'YEM',
  Libya: 'LBY',
  Sudan: 'SDN',
  Somalia: 'SOM',
  Ethiopia: 'ETH',
  Kenya: 'KEN',
  'Democratic Republic of Congo': 'COD',
  Myanmar: 'MMR',
  'North Korea': 'PRK',
  Singapore: 'SGP',
  'Hong Kong': 'HKG',
  Switzerland: 'CHE',
  Sweden: 'SWE',
  Norway: 'NOR',
  Denmark: 'DNK',
  Finland: 'FIN',
  Netherlands: 'NLD',
  Belgium: 'BEL',
  Austria: 'AUT',
  Greece: 'GRC',
  Portugal: 'PRT',
  'Czech Republic': 'CZE',
  Romania: 'ROU',
  Hungary: 'HUN',
  Ireland: 'IRL',
  'New Zealand': 'NZL',
  Malaysia: 'MYS',
  Qatar: 'QAT',
  Kuwait: 'KWT',
  Oman: 'OMN',
  Bahrain: 'BHR',
  Jordan: 'JOR',
  Lebanon: 'LBN',
  Morocco: 'MAR',
  Algeria: 'DZA',
  Tunisia: 'TUN',
  Ghana: 'GHA',
  Tanzania: 'TZA',
  Uganda: 'UGA',
  Zimbabwe: 'ZWE',
  Angola: 'AGO',
  Mozambique: 'MOZ',
  Cameroon: 'CMR',
  Mali: 'MLI',
  Niger: 'NER',
  'Burkina Faso': 'BFA',
  Senegal: 'SEN',
  Kazakhstan: 'KAZ',
  Uzbekistan: 'UZB',
  Azerbaijan: 'AZE',
  Belarus: 'BLR',
  Georgia: 'GEO',
  Armenia: 'ARM',
  Serbia: 'SRB',
  Croatia: 'HRV',
  Bulgaria: 'BGR',
  Slovakia: 'SVK',
  Slovenia: 'SVN',
  Lithuania: 'LTU',
  Latvia: 'LVA',
  Estonia: 'EST',
  Iceland: 'ISL',
  Luxembourg: 'LUX',
  Malta: 'MLT',
  Cyprus: 'CYP',
  Taiwan: 'TWN',
  Mongolia: 'MNG',
  Nepal: 'NPL',
  'Sri Lanka': 'LKA',
  Cambodia: 'KHM',
  Laos: 'LAO',
  'Papua New Guinea': 'PNG',
  'Costa Rica': 'CRI',
  Panama: 'PAN',
  Uruguay: 'URY',
  Paraguay: 'PRY',
  Bolivia: 'BOL',
  Ecuador: 'ECU',
  Guatemala: 'GTM',
  Honduras: 'HND',
  'El Salvador': 'SLV',
  Nicaragua: 'NIC',
  'Dominican Republic': 'DOM',
  Cuba: 'CUB',
  Haiti: 'HTI',
  Jamaica: 'JAM',
  'Trinidad and Tobago': 'TTO',
  Bahamas: 'BHS',
  Barbados: 'BRB',
  Brunei: 'BRN',
  Maldives: 'MDV',
  Mauritius: 'MUS',
  Botswana: 'BWA',
  Namibia: 'NAM',
  Zambia: 'ZMB',
  Malawi: 'MWI',
  Rwanda: 'RWA',
  Burundi: 'BDI',
  Eritrea: 'ERI',
  Djibouti: 'DJI',
  Gabon: 'GAB',
  'Equatorial Guinea': 'GNQ',
  'Republic of Congo': 'COG',
  Chad: 'TCD',
  'Central African Republic': 'CAF',
  'Guinea-Bissau': 'GNB',
  Guinea: 'GIN',
  'Sierra Leone': 'SLE',
  Liberia: 'LBR',
  Togo: 'TGO',
  Benin: 'BEN',
  'Ivory Coast': 'CIV',
  Mauritania: 'MRT',
  Gambia: 'GMB',
  Turkmenistan: 'TKM',
  Tajikistan: 'TJK',
  Kyrgyzstan: 'KGZ',
  Moldova: 'MDA',
  'North Macedonia': 'MKD',
  Albania: 'ALB',
  'Bosnia and Herzegovina': 'BIH',
  Montenegro: 'MNE',
  Kosovo: 'XKX',
};

/**
 * Helper: Get ISO3 code from country name (fuzzy match)
 */
export function getISO3FromName(countryName: string): string | null {
  // Direct match
  if (COUNTRY_NAME_TO_ISO3[countryName]) {
    return COUNTRY_NAME_TO_ISO3[countryName];
  }

  // Fuzzy match (lowercase, trim)
  const normalized = countryName.toLowerCase().trim();
  for (const [name, code] of Object.entries(COUNTRY_NAME_TO_ISO3)) {
    if (name.toLowerCase() === normalized) {
      return code;
    }
  }

  return null;
}
