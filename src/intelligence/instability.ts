/**
 * Country Instability Index (CII) Engine
 * Computes a 0-100 instability score per country from live GDELT and GDACS data.
 * Runs entirely client-side in the browser.
 */

import type { GdeltEvent, DisasterAlert } from '../lib/data-service';

export interface CIIScore {
  country: string;
  score: number;
  trend: 'rising' | 'falling' | 'stable';
  components: {
    conflictEvents: number;    // 0-40 pts
    naturalDisasters: number;  // 0-20 pts
    economicStress: number;    // 0-20 pts (placeholder, reserved for FRED data)
    geopoliticalRisk: number;  // 0-20 pts (from GDELT tone)
  };
  lastUpdated: number;
}

// Country name fragments → ISO-2 codes for GDACS title parsing
const TITLE_TO_ISO2: Array<[string, string]> = [
  ['afghanistan', 'AF'], ['albania', 'AL'], ['algeria', 'DZ'], ['angola', 'AO'],
  ['argentina', 'AR'], ['armenia', 'AM'], ['australia', 'AU'], ['azerbaijan', 'AZ'],
  ['bahrain', 'BH'], ['bangladesh', 'BD'], ['belarus', 'BY'], ['bolivia', 'BO'],
  ['brazil', 'BR'], ['burkina faso', 'BF'], ['burundi', 'BI'], ['cameroon', 'CM'],
  ['central african', 'CF'], ['chad', 'TD'], ['chile', 'CL'], ['china', 'CN'],
  ['colombia', 'CO'], ['congo', 'CD'], ['costa rica', 'CR'], ['cuba', 'CU'],
  ['cyprus', 'CY'], ['ecuador', 'EC'], ['egypt', 'EG'], ['el salvador', 'SV'],
  ['ethiopia', 'ET'], ['fiji', 'FJ'], ['france', 'FR'], ['georgia', 'GE'],
  ['germany', 'DE'], ['ghana', 'GH'], ['greece', 'GR'], ['guatemala', 'GT'],
  ['guinea', 'GN'], ['guyana', 'GY'], ['haiti', 'HT'], ['honduras', 'HN'],
  ['india', 'IN'], ['indonesia', 'ID'], ['iran', 'IR'], ['iraq', 'IQ'],
  ['israel', 'IL'], ['italy', 'IT'], ['jamaica', 'JM'], ['japan', 'JP'],
  ['jordan', 'JO'], ['kazakhstan', 'KZ'], ['kenya', 'KE'], ['north korea', 'KP'],
  ['south korea', 'KR'], ['kuwait', 'KW'], ['kyrgyzstan', 'KG'], ['laos', 'LA'],
  ['lebanon', 'LB'], ['libya', 'LY'], ['madagascar', 'MG'], ['malawi', 'MW'],
  ['malaysia', 'MY'], ['mali', 'ML'], ['mexico', 'MX'], ['moldova', 'MD'],
  ['mongolia', 'MN'], ['morocco', 'MA'], ['mozambique', 'MZ'], ['myanmar', 'MM'],
  ['nepal', 'NP'], ['nicaragua', 'NI'], ['niger', 'NE'], ['nigeria', 'NG'],
  ['pakistan', 'PK'], ['panama', 'PA'], ['paraguay', 'PY'], ['peru', 'PE'],
  ['philippines', 'PH'], ['qatar', 'QA'], ['russia', 'RU'], ['saudi arabia', 'SA'],
  ['senegal', 'SN'], ['somalia', 'SO'], ['south africa', 'ZA'], ['spain', 'ES'],
  ['sri lanka', 'LK'], ['sudan', 'SD'], ['syria', 'SY'], ['taiwan', 'TW'],
  ['tajikistan', 'TJ'], ['thailand', 'TH'], ['trinidad', 'TT'], ['tunisia', 'TN'],
  ['turkey', 'TR'], ['turkmenistan', 'TM'], ['ukraine', 'UA'], ['uruguay', 'UY'],
  ['uzbekistan', 'UZ'], ['venezuela', 'VE'], ['vietnam', 'VN'], ['yemen', 'YE'],
  ['zambia', 'ZM'], ['zimbabwe', 'ZW'],
];

export class CIIEngine {
  private scores: Map<string, CIIScore> = new Map();
  private history: Map<string, number[]> = new Map();

  /**
   * Recompute CII scores from the latest GDELT events and GDACS disaster alerts.
   */
  compute(gdeltEvents: GdeltEvent[], gdacsAlerts: DisasterAlert[]): Map<string, CIIScore> {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const recentGdelt = gdeltEvents.filter(e => e.timestamp >= oneDayAgo);

    // Group GDELT events by country code
    const byCountry = new Map<string, GdeltEvent[]>();
    for (const event of recentGdelt) {
      if (!event.country) continue;
      const code = event.country.toUpperCase();
      if (!byCountry.has(code)) byCountry.set(code, []);
      byCountry.get(code)!.push(event);
    }

    // Count GDACS disaster alerts per country (parse titles)
    const disastersByCountry = new Map<string, number>();
    for (const alert of gdacsAlerts) {
      const code = this.extractCountryCode(alert.title);
      if (code) {
        disastersByCountry.set(code, (disastersByCountry.get(code) ?? 0) + 1);
      }
    }

    // Also ensure any country found only in GDACS gets a base entry
    for (const code of disastersByCountry.keys()) {
      if (!byCountry.has(code)) {
        byCountry.set(code, []);
      }
    }

    const newScores = new Map<string, CIIScore>();

    for (const [code, events] of byCountry) {
      const eventCount = events.length;

      const tones = events
        .map(e => e.tone)
        .filter((t): t is number => t !== null);
      const avgTone = tones.length > 0
        ? tones.reduce((a, b) => a + b, 0) / tones.length
        : 0;

      const conflictEvents = Math.min(40, eventCount * 2);
      const geopoliticalRisk = Math.min(20, Math.abs(avgTone) * 2);
      const naturalDisasters = Math.min(20, (disastersByCountry.get(code) ?? 0) * 10);
      const economicStress = 0;

      const score = conflictEvents + naturalDisasters + economicStress + geopoliticalRisk;

      // Update rolling history (last 10 scores)
      const hist = this.history.get(code) ?? [];
      hist.push(score);
      if (hist.length > 10) hist.shift();
      this.history.set(code, hist);

      // Determine trend vs previous score
      const prevScore = hist.length >= 2 ? (hist[hist.length - 2] ?? score) : score;
      let trend: CIIScore['trend'] = 'stable';
      if (score - prevScore >= 5) trend = 'rising';
      else if (prevScore - score >= 5) trend = 'falling';

      newScores.set(code, {
        country: code,
        score,
        trend,
        components: { conflictEvents, naturalDisasters, economicStress, geopoliticalRisk },
        lastUpdated: now,
      });
    }

    this.scores = newScores;
    return this.scores;
  }

  /** Parse a GDACS-style title like "Flood in Bangladesh" → "BD" */
  private extractCountryCode(title: string): string | null {
    const lower = title.toLowerCase();
    for (const [fragment, code] of TITLE_TO_ISO2) {
      if (lower.includes(fragment)) return code;
    }
    return null;
  }

  /** Return the top N countries sorted by descending score */
  getTopN(n: number): CIIScore[] {
    return Array.from(this.scores.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, n);
  }

  getScore(country: string): CIIScore | null {
    return this.scores.get(country.toUpperCase()) ?? null;
  }

  getAll(): Map<string, CIIScore> {
    return this.scores;
  }
}

export const ciiEngine = new CIIEngine();
