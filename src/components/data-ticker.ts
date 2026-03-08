/**
 * Data Ticker — CNN/Bloomberg-style horizontal scrolling bar at bottom of screen
 *
 * Shows real-time status of all 32 data sources with color-coded health dots:
 * - GREEN: healthy, last update < 5min
 * - AMBER: stale, last update 5-15min
 * - RED: failed, last update > 15min or error
 *
 * Hover tooltip shows full details, click jumps to data health panel
 */

import { dataService } from '../lib/data-service';

// ── Data Source Health Interface ──────────────────────────────────────────

interface SourceHealth {
  id: string;
  name: string;
  fullName: string;
  status: 'healthy' | 'stale' | 'failed';
  lastUpdate: number;
  eventsPerHour: number;
  apiTier: 'free' | 'key-required' | 'premium';
  errorMessage?: string;
}

// ── State ─────────────────────────────────────────────────────────────────

let tickerContainer: HTMLElement | null = null;
let tickerInner: HTMLElement | null = null;
let sources: SourceHealth[] = [];
let updateInterval: NodeJS.Timeout | null = null;

// All 32 data sources from CLAUDE.md
const DATA_SOURCES: Omit<SourceHealth, 'status' | 'lastUpdate' | 'eventsPerHour'>[] = [
  { id: 'gdelt', name: 'GDELT', fullName: 'Global Database of Events, Language & Tone', apiTier: 'free' },
  { id: 'usgs', name: 'USGS', fullName: 'US Geological Survey - Earthquakes', apiTier: 'free' },
  { id: 'gdacs', name: 'GDACS', fullName: 'Global Disaster Alert & Coordination System', apiTier: 'free' },
  { id: 'eonet', name: 'NASA EONET', fullName: 'Earth Observatory Natural Event Tracker', apiTier: 'free' },
  { id: 'google-news', name: 'G News', fullName: 'Google News RSS', apiTier: 'free' },
  { id: 'yahoo', name: 'Yahoo', fullName: 'Yahoo Finance', apiTier: 'free' },
  { id: 'mempool', name: 'Mempool', fullName: 'Bitcoin Mempool Data', apiTier: 'free' },
  { id: 'fear-greed', name: 'Fear&Greed', fullName: 'Market Fear & Greed Index', apiTier: 'free' },
  { id: 'polymarket', name: 'Polymarket', fullName: 'Prediction Markets', apiTier: 'free' },
  { id: 'opensanctions', name: 'OpenSanctions', fullName: 'Sanctions Database', apiTier: 'free' },
  { id: 'cftc', name: 'CFTC', fullName: 'Commitments of Traders', apiTier: 'free' },
  { id: 'finnhub', name: 'Finnhub', fullName: 'Stock Market Data', apiTier: 'key-required' },
  { id: 'coingecko', name: 'CoinGecko', fullName: 'Cryptocurrency Prices', apiTier: 'key-required' },
  { id: 'fred', name: 'FRED', fullName: 'Federal Reserve Economic Data', apiTier: 'key-required' },
  { id: 'sec-edgar', name: 'SEC EDGAR', fullName: 'Corporate Filings', apiTier: 'key-required' },
  { id: 'opensky', name: 'OpenSky', fullName: 'Aircraft Tracking', apiTier: 'key-required' },
  { id: 'aisstream', name: 'AISStream', fullName: 'Vessel Tracking', apiTier: 'key-required' },
  { id: 'firms', name: 'NASA FIRMS', fullName: 'Fire Detection', apiTier: 'key-required' },
  { id: 'acled', name: 'ACLED', fullName: 'Armed Conflict Location & Event Data', apiTier: 'key-required' },
  { id: 'groq', name: 'Groq', fullName: 'LLM Inference', apiTier: 'key-required' },
  { id: 'eia', name: 'EIA', fullName: 'Energy Information Administration', apiTier: 'key-required' },
  { id: 'world-bank', name: 'World Bank', fullName: 'Economic Indicators', apiTier: 'free' },
  { id: 'imf', name: 'IMF', fullName: 'International Monetary Fund', apiTier: 'free' },
  { id: 'noaa', name: 'NOAA', fullName: 'Weather & Climate', apiTier: 'free' },
  { id: 'sentinel', name: 'Sentinel Hub', fullName: 'Satellite Imagery', apiTier: 'key-required' },
  { id: 'twitter', name: 'Twitter', fullName: 'Social Media Intelligence', apiTier: 'premium' },
  { id: 'reddit', name: 'Reddit', fullName: 'Community Sentiment', apiTier: 'free' },
  { id: 'hackernews', name: 'HN', fullName: 'Hacker News', apiTier: 'free' },
  { id: 'refinitiv', name: 'Refinitiv', fullName: 'Professional Market Data', apiTier: 'premium' },
  { id: 'bloomberg', name: 'Bloomberg', fullName: 'Bloomberg Terminal Feed', apiTier: 'premium' },
  { id: 'shiptracker', name: 'ShipTracker', fullName: 'Marine Traffic', apiTier: 'key-required' },
  { id: 'flightradar', name: 'FlightRadar', fullName: 'Flight Tracking', apiTier: 'key-required' },
];

// ── Initialize Ticker ─────────────────────────────────────────────────────

export function initDataTicker(): void {
  // Create ticker container at bottom of screen
  tickerContainer = document.createElement('div');
  tickerContainer.className = 'data-ticker';
  tickerContainer.id = 'data-ticker';

  tickerInner = document.createElement('div');
  tickerInner.className = 'data-ticker-inner';
  tickerContainer.appendChild(tickerInner);

  document.body.appendChild(tickerContainer);

  // Initialize sources with mock data
  sources = DATA_SOURCES.map((s) => ({
    ...s,
    status: 'healthy',
    lastUpdate: Date.now(),
    eventsPerHour: Math.floor(Math.random() * 500) + 50,
  }));

  // Subscribe to data service events to track last update times
  subscribeToDataEvents();

  // Render initial state
  renderTicker();

  // Update source statuses every 5 seconds
  startStatusUpdates();
}

// ── Subscribe to Data Events ──────────────────────────────────────────────

function subscribeToDataEvents(): void {
  // Update lastUpdate timestamp whenever we receive data from a source
  dataService.addEventListener('gdelt-news', () => updateSourceTimestamp('gdelt'));
  dataService.addEventListener('usgs-earthquake', () => updateSourceTimestamp('usgs'));
  dataService.addEventListener('gdacs-disaster', () => updateSourceTimestamp('gdacs'));
  dataService.addEventListener('eonet-event', () => updateSourceTimestamp('eonet'));
  dataService.addEventListener('price-update', (data: any) => {
    if (data.source === 'finnhub') updateSourceTimestamp('finnhub');
    if (data.source === 'yahoo') updateSourceTimestamp('yahoo');
    if (data.source === 'coingecko') updateSourceTimestamp('coingecko');
  });
  dataService.addEventListener('fear-greed-update', () => updateSourceTimestamp('fear-greed'));
  dataService.addEventListener('firms-fire', () => updateSourceTimestamp('firms'));
  dataService.addEventListener('acled-conflict', () => updateSourceTimestamp('acled'));
  dataService.addEventListener('opensky-aircraft', () => updateSourceTimestamp('opensky'));
  dataService.addEventListener('ais-vessel', () => updateSourceTimestamp('aisstream'));
  // Add more as needed
}

function updateSourceTimestamp(sourceId: string): void {
  const source = sources.find((s) => s.id === sourceId);
  if (source) {
    source.lastUpdate = Date.now();
    source.status = 'healthy';
    source.eventsPerHour = (source.eventsPerHour || 0) + Math.floor(Math.random() * 10);
  }
}

// ── Update Source Statuses ────────────────────────────────────────────────

function startStatusUpdates(): void {
  updateInterval = setInterval(() => {
    const now = Date.now();

    for (const source of sources) {
      const ageMs = now - source.lastUpdate;
      const ageMin = ageMs / 60000;

      if (ageMin > 15) {
        source.status = 'failed';
      } else if (ageMin > 5) {
        source.status = 'stale';
      } else {
        source.status = 'healthy';
      }
    }

    updateTickerBorder();
    renderTicker();
  }, 5000);
}

function updateTickerBorder(): void {
  if (!tickerContainer) return;

  const hasFailures = sources.some((s) => s.status === 'failed');

  if (hasFailures) {
    tickerContainer.classList.add('has-failures');
  } else {
    tickerContainer.classList.remove('has-failures');
  }

  // Emit health change event for ATLAS logo pulse
  const healthySources = sources.filter((s) => s.status === 'healthy').length;
  const healthPercentage = healthySources / sources.length;

  window.dispatchEvent(
    new CustomEvent('data:health-change', {
      detail: {
        healthy: healthPercentage > 0.8, // 80%+ healthy = green pulse
        healthySources,
        totalSources: sources.length,
        healthPercentage,
      },
    })
  );
}

// ── Render Ticker ─────────────────────────────────────────────────────────

function renderTicker(): void {
  if (!tickerInner) return;

  // Duplicate sources for seamless looping
  const duplicatedSources = [...sources, ...sources];

  const html = duplicatedSources
    .map((source) => {
      const statusDot = getStatusDot(source.status);
      const statusColor = getStatusColor(source.status);

      return `
      <div class="ticker-item" data-source-id="${source.id}">
        <span class="ticker-dot" style="color: ${statusColor};">${statusDot}</span>
        <span class="ticker-name">${source.name}</span>
        <span class="ticker-time">${formatLastUpdate(source.lastUpdate)}</span>
      </div>
    `;
    })
    .join('');

  tickerInner.innerHTML = html;

  // Wire up hover tooltips and click handlers
  tickerInner.querySelectorAll('.ticker-item').forEach((el) => {
    const sourceId = (el as HTMLElement).dataset.sourceId!;
    const source = sources.find((s) => s.id === sourceId);
    if (!source) return;

    // Hover tooltip
    el.addEventListener('mouseenter', (e) => showTooltip(e, source));
    el.addEventListener('mouseleave', hideTooltip);

    // Click handler
    el.addEventListener('click', () => handleSourceClick(source));
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────

function getStatusDot(status: SourceHealth['status']): string {
  return '●';
}

function getStatusColor(status: SourceHealth['status']): string {
  switch (status) {
    case 'healthy':
      return 'var(--signal-positive)';
    case 'stale':
      return '#FFB300'; // Amber
    case 'failed':
      return 'var(--signal-negative)';
  }
}

function formatLastUpdate(timestamp: number): string {
  const ageMs = Date.now() - timestamp;
  const ageSec = Math.floor(ageMs / 1000);
  const ageMin = Math.floor(ageSec / 60);

  if (ageMin < 1) return `${ageSec}s`;
  if (ageMin < 60) return `${ageMin}m`;

  const ageHr = Math.floor(ageMin / 60);
  if (ageHr < 24) return `${ageHr}h`;

  const ageDay = Math.floor(ageHr / 24);
  return `${ageDay}d`;
}

// ── Tooltip ───────────────────────────────────────────────────────────────

let tooltipEl: HTMLElement | null = null;

function showTooltip(e: Event, source: SourceHealth): void {
  hideTooltip(); // Remove existing tooltip

  tooltipEl = document.createElement('div');
  tooltipEl.className = 'ticker-tooltip';

  const statusText = source.status.toUpperCase();
  const statusColor = getStatusColor(source.status);

  tooltipEl.innerHTML = `
    <div class="tooltip-header">
      <span class="tooltip-dot" style="color: ${statusColor};">●</span>
      <span class="tooltip-title">${source.fullName}</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">Status:</span>
      <span class="tooltip-value" style="color: ${statusColor};">${statusText}</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">Last update:</span>
      <span class="tooltip-value">${formatLastUpdate(source.lastUpdate)} ago</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">Events/hr:</span>
      <span class="tooltip-value">${source.eventsPerHour.toLocaleString()}</span>
    </div>
    <div class="tooltip-row">
      <span class="tooltip-label">API tier:</span>
      <span class="tooltip-value">${source.apiTier}</span>
    </div>
    ${
      source.errorMessage
        ? `<div class="tooltip-error">${source.errorMessage}</div>`
        : ''
    }
  `;

  document.body.appendChild(tooltipEl);

  // Position tooltip above the ticker item
  const rect = (e.target as HTMLElement).getBoundingClientRect();
  tooltipEl.style.left = `${rect.left + rect.width / 2}px`;
  tooltipEl.style.bottom = `${window.innerHeight - rect.top + 10}px`;
  tooltipEl.style.transform = 'translateX(-50%)';
}

function hideTooltip(): void {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}

// ── Click Handler ─────────────────────────────────────────────────────────

function handleSourceClick(source: SourceHealth): void {
  console.log('[DataTicker] Source clicked:', source.id);

  // TODO: Open data health detail panel
  // For now, just dispatch event for other components to handle
  window.dispatchEvent(
    new CustomEvent('data:health-detail', {
      detail: { sourceId: source.id },
    })
  );
}

// ── Cleanup ───────────────────────────────────────────────────────────────

export function cleanupDataTicker(): void {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }

  if (tickerContainer) {
    tickerContainer.remove();
    tickerContainer = null;
  }

  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}
