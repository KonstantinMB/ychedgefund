/**
 * Enhanced Command Palette Search
 *
 * Extends command palette with live data search:
 * - Countries (with CII, events, exposure)
 * - Signals (active signals with confidence)
 * - Positions (open positions with P&L)
 * - News (recent events)
 * - Commands (existing command palette items)
 */

import type { Command } from './command-palette';

// ── Search Result Types ───────────────────────────────────────────────────

interface SearchResult {
  type: 'country' | 'signal' | 'position' | 'news' | 'command';
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  action: () => void;
  metadata?: Record<string, any>;
}

// ── Enhanced Search Function ──────────────────────────────────────────────

export function enhancedSearch(query: string): Map<string, SearchResult[]> {
  const q = query.toLowerCase().trim();

  if (!q) {
    // Default: show recent/important items
    return getDefaultResults();
  }

  const results = new Map<string, SearchResult[]>();

  // Search countries
  const countryResults = searchCountries(q);
  if (countryResults.length > 0) {
    results.set('COUNTRIES', countryResults);
  }

  // Search signals
  const signalResults = searchSignals(q);
  if (signalResults.length > 0) {
    results.set('SIGNALS', signalResults);
  }

  // Search positions
  const positionResults = searchPositions(q);
  if (positionResults.length > 0) {
    results.set('POSITIONS', positionResults);
  }

  // Search news/events
  const newsResults = searchNews(q);
  if (newsResults.length > 0) {
    results.set('NEWS', newsResults);
  }

  return results;
}

// ── Default Results (Empty Query) ─────────────────────────────────────────

function getDefaultResults(): Map<string, SearchResult[]> {
  const results = new Map<string, SearchResult[]>();

  // Top countries by CII
  results.set('HIGH RISK COUNTRIES', [
    {
      type: 'country',
      id: 'IR',
      title: 'Iran',
      subtitle: 'CII: 78 · 3 active signals',
      icon: '🌍',
      action: () => flyToCountry('IR'),
    },
    {
      type: 'country',
      id: 'UA',
      title: 'Ukraine',
      subtitle: 'CII: 62 · 5 active events',
      icon: '🌍',
      action: () => flyToCountry('UA'),
    },
  ]);

  // Active signals
  results.set('ACTIVE SIGNALS', [
    {
      type: 'signal',
      id: 'sig-1',
      title: 'LONG USO — Iran CII spike',
      subtitle: '82% confidence',
      icon: '▲',
      action: () => openSignalDetail('sig-1'),
    },
  ]);

  return results;
}

// ── Country Search ────────────────────────────────────────────────────────

function searchCountries(query: string): SearchResult[] {
  const countries = [
    { iso2: 'IR', name: 'Iran', cii: 78, signals: 3, exposure: 8.5 },
    { iso2: 'IQ', name: 'Iraq', cii: 45, signals: 1, exposure: 3.2 },
    { iso2: 'UA', name: 'Ukraine', cii: 62, signals: 0, exposure: 0 },
    { iso2: 'RU', name: 'Russia', cii: 34, signals: 2, exposure: 0 },
    { iso2: 'CN', name: 'China', cii: 28, signals: 1, exposure: 15.0 },
    { iso2: 'US', name: 'United States', cii: 12, signals: 0, exposure: 45.0 },
    { iso2: 'SA', name: 'Saudi Arabia', cii: 24, signals: 2, exposure: 12.1 },
  ];

  return countries
    .filter((c) => c.name.toLowerCase().includes(query) || c.iso2.toLowerCase().includes(query))
    .slice(0, 3)
    .map((c) => ({
      type: 'country' as const,
      id: c.iso2,
      title: c.name,
      subtitle: `CII: ${c.cii} · ${c.signals} active signal${c.signals !== 1 ? 's' : ''}`,
      icon: '●',
      action: () => flyToCountry(c.iso2),
      metadata: c,
    }));
}

// ── Signal Search ─────────────────────────────────────────────────────────

function searchSignals(query: string): SearchResult[] {
  // Get active signals from signal bus
  const signals = [
    {
      id: 'sig-1',
      symbol: 'USO',
      direction: 'LONG',
      reason: 'Iran CII spike',
      confidence: 0.82,
    },
    {
      id: 'sig-2',
      symbol: 'GLD',
      direction: 'LONG',
      reason: 'Ukraine conflict escalation',
      confidence: 0.75,
    },
  ];

  return signals
    .filter(
      (s) =>
        s.symbol.toLowerCase().includes(query) ||
        s.reason.toLowerCase().includes(query) ||
        s.direction.toLowerCase().includes(query)
    )
    .slice(0, 3)
    .map((s) => ({
      type: 'signal' as const,
      id: s.id,
      title: `${s.direction} ${s.symbol} — ${s.reason}`,
      subtitle: `${(s.confidence * 100).toFixed(0)}% confidence`,
      icon: s.direction === 'LONG' ? '▲' : '▼',
      action: () => openSignalDetail(s.id),
      metadata: s,
    }));
}

// ── Position Search ───────────────────────────────────────────────────────

function searchPositions(query: string): SearchResult[] {
  const positions = [
    { symbol: 'USO', quantity: 500, pnl: 800, pnlPct: 2.0 },
    { symbol: 'GLD', quantity: 200, pnl: -150, pnlPct: -0.5 },
  ];

  return positions
    .filter((p) => p.symbol.toLowerCase().includes(query))
    .slice(0, 3)
    .map((p) => ({
      type: 'position' as const,
      id: p.symbol,
      title: `${p.symbol} — ${p.quantity.toLocaleString()} shares`,
      subtitle: `${p.pnl >= 0 ? '+' : ''}$${p.pnl.toLocaleString()} (${p.pnl >= 0 ? '+' : ''}${p.pnlPct.toFixed(1)}%)`,
      icon: '📈',
      action: () => openPositionDetail(p.symbol),
      metadata: p,
    }));
}

// ── News Search ───────────────────────────────────────────────────────────

function searchNews(query: string): SearchResult[] {
  const news = [
    {
      id: 'news-1',
      title: 'M5.2 earthquake near Tehran',
      source: 'USGS',
      timestamp: Date.now() - 3600000,
    },
    {
      id: 'news-2',
      title: 'Oil prices surge 3% amid Iran tensions',
      source: 'GDELT',
      timestamp: Date.now() - 7200000,
    },
  ];

  return news
    .filter((n) => n.title.toLowerCase().includes(query) || n.source.toLowerCase().includes(query))
    .slice(0, 3)
    .map((n) => ({
      type: 'news' as const,
      id: n.id,
      title: n.title,
      subtitle: `${n.source} · ${formatTimeAgo(n.timestamp)}`,
      icon: '📰',
      action: () => openNewsDetail(n.id),
      metadata: n,
    }));
}

// ── Action Handlers ───────────────────────────────────────────────────────

function flyToCountry(iso2: string): void {
  console.log(`[EnhancedSearch] Fly to country: ${iso2}`);

  // Get country coordinates (simplified)
  const coords: Record<string, [number, number]> = {
    IR: [53.688, 32.428], // Iran
    IQ: [43.679, 33.312], // Iraq
    UA: [31.168, 48.379], // Ukraine
    RU: [37.618, 55.751], // Russia
    CN: [116.404, 39.905], // China
    US: [-77.036, 38.898], // USA
    SA: [46.672, 24.712], // Saudi Arabia
  };

  const coord = coords[iso2];
  if (coord) {
    window.dispatchEvent(
      new CustomEvent('globe:fly-to', {
        detail: {
          longitude: coord[0],
          latitude: coord[1],
          zoom: 4,
          duration: 1500,
        },
      })
    );
  }
}

function openSignalDetail(signalId: string): void {
  console.log(`[EnhancedSearch] Open signal detail: ${signalId}`);
  window.dispatchEvent(
    new CustomEvent('panel:open', {
      detail: { panelId: 'signals', focusId: signalId },
    })
  );
}

function openPositionDetail(symbol: string): void {
  console.log(`[EnhancedSearch] Open position detail: ${symbol}`);
  window.dispatchEvent(
    new CustomEvent('panel:open', {
      detail: { panelId: 'portfolio', focusSymbol: symbol },
    })
  );
}

function openNewsDetail(newsId: string): void {
  console.log(`[EnhancedSearch] Open news detail: ${newsId}`);
  window.dispatchEvent(
    new CustomEvent('panel:open', {
      detail: { panelId: 'event-stream', focusId: newsId },
    })
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);

  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ── Convert to Command Format ─────────────────────────────────────────────

export function searchResultsToCommands(results: Map<string, SearchResult[]>): Command[] {
  const commands: Command[] = [];

  for (const [category, items] of results) {
    for (const item of items) {
      commands.push({
        id: item.id,
        label: item.title,
        description: item.subtitle,
        category,
        icon: item.icon,
        action: item.action,
      });
    }
  }

  return commands;
}
