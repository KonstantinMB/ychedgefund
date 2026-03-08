/**
 * Signals Panel — REDESIGNED
 *
 * "Genius quant analyst whispering in your ear"
 *
 * Each signal is a mini-story with:
 * - Multi-layer consensus detection (3+ strategies = rainbow border)
 * - Confidence bar with animated shimmer
 * - Strategy badges with specific trigger data
 * - Conversational AI-written WHY section
 * - Historical win rate distribution
 * - Map fly-to + trade execution
 * - Satisfying tactile animations
 */

import { registerLeftPanel as registerPanel } from './panel-manager';
import { showToast } from '../lib/toast';
import { dataService } from '../lib/data-service';
import type { Signal } from '../trading/engine';
import { executionLoop } from '../trading/engine/execution-loop';

// ── Strategy metadata ─────────────────────────────────────────────────────────

interface StrategyMeta {
  badge: string;
  icon: string;
  color: string;
  cssClass: string;
}

const STRATEGY_META: Record<string, StrategyMeta> = {
  geopolitical: { badge: 'GEO', icon: '🌍', color: '#FF8A65', cssClass: 'geo' },
  GEOPOLITICAL: { badge: 'GEO', icon: '🌍', color: '#FF8A65', cssClass: 'geo' },
  sentiment: { badge: 'SENT', icon: '📰', color: '#4FC3F7', cssClass: 'sent' },
  SENTIMENT: { badge: 'SENT', icon: '📰', color: '#4FC3F7', cssClass: 'sent' },
  momentum: { badge: 'MOM', icon: '📈', color: '#B388FF', cssClass: 'mom' },
  MOMENTUM: { badge: 'MOM', icon: '📈', color: '#B388FF', cssClass: 'mom' },
  macro: { badge: 'MACRO', icon: '📊', color: '#00E676', cssClass: 'macro' },
  MACRO: { badge: 'MACRO', icon: '📊', color: '#00E676', cssClass: 'macro' },
  'cross-asset': { badge: 'CROSS', icon: '🔀', color: '#FFD54F', cssClass: 'cross' },
  'prediction-markets': { badge: 'PRED', icon: '🎲', color: '#06b6d4', cssClass: 'pred' },
  'PREDICTION-MARKETS': { badge: 'PRED', icon: '🎲', color: '#06b6d4', cssClass: 'pred' },
  'supply-chain': { badge: 'SUPPLY', icon: '🛳️', color: '#F06292', cssClass: 'supply' },
  disaster: { badge: 'DISASTER', icon: '🌋', color: '#E57373', cssClass: 'disaster' },
};

function getMeta(strategy: string): StrategyMeta {
  return (
    STRATEGY_META[strategy] ?? {
      badge: strategy.slice(0, 4).toUpperCase(),
      icon: '•',
      color: '#94a3b8',
      cssClass: 'other',
    }
  );
}

// ── Consensus detection ───────────────────────────────────────────────────────

interface ConsensusGroup {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  signals: Signal[];
  combinedConfidence: number;
  strategies: string[];
}

function detectConsensus(signals: Signal[]): Map<string, ConsensusGroup> {
  const active = signals.filter((s) => s.expiresAt > Date.now());
  const groups = new Map<string, Signal[]>();

  for (const sig of active) {
    const key = `${sig.symbol}:${sig.direction}`;
    const list = groups.get(key) ?? [];
    list.push(sig);
    groups.set(key, list);
  }

  const consensusMap = new Map<string, ConsensusGroup>();

  for (const [key, group] of groups) {
    if (group.length < 3) continue; // Consensus requires 3+ strategies

    const [symbol, direction] = key.split(':') as [string, 'LONG' | 'SHORT'];
    const strategies = [...new Set(group.map((s) => s.strategy))];

    // Bayesian combined confidence
    const bayesian = 1 - group.reduce((p, s) => p * (1 - s.confidence), 1);

    consensusMap.set(key, {
      symbol,
      direction,
      signals: group,
      combinedConfidence: bayesian,
      strategies,
    });
  }

  return consensusMap;
}

// ── Signal card builder ───────────────────────────────────────────────────────

function buildSignalCard(sig: Signal, consensus: ConsensusGroup | null): HTMLElement {
  const meta = getMeta(sig.strategy);
  const isLong = sig.direction === 'LONG';
  const isExpired = sig.expiresAt <= Date.now();
  const confPct = Math.round(sig.confidence * 100);
  const isConsensus = consensus !== null;
  const isHighConfidence = sig.confidence >= 0.8;

  const card = document.createElement('div');
  card.className = `sig-card-v2 ${isLong ? 'long' : 'short'} ${isExpired ? 'expired' : ''} ${
    isConsensus ? 'consensus' : isHighConfidence ? 'high-conf' : 'standard'
  }`;
  card.dataset.signalId = sig.id;

  // Rainbow gradient border for consensus
  const borderStyle = isConsensus
    ? `border-left-image: linear-gradient(135deg, ${consensus!.signals
        .map((s) => getMeta(s.strategy).color)
        .join(', ')});`
    : `border-left-color: ${meta.color};`;

  card.style.cssText = borderStyle;

  // Extract symbol name (fallback to symbol)
  const symbolName = getSymbolName(sig.symbol);

  // Calculate R:R ratio
  const rrRatio = sig.stopLoss > 0 ? (sig.takeProfit / sig.stopLoss).toFixed(1) : '∞';

  // Expiry countdown
  const expiryText = formatExpiry(sig.expiresAt);

  // Strategy badge (consensus shows multi-badge)
  const strategyBadges = isConsensus
    ? consensus!.signals
        .map((s) => {
          const m = getMeta(s.strategy);
          return `
          <div class="sig-v2-strategy-badge" style="--badge-color: ${m.color}">
            <span class="badge-icon">${m.icon}</span>
            <span class="badge-label">${m.badge}</span>
            <span class="badge-trigger">${extractTrigger(s)}</span>
          </div>
        `;
        })
        .join('')
    : `
      <div class="sig-v2-strategy-badge" style="--badge-color: ${meta.color}">
        <span class="badge-icon">${meta.icon}</span>
        <span class="badge-label">${meta.badge}</span>
        <span class="badge-trigger">${extractTrigger(sig)}</span>
      </div>
    `;

  const consensusBadge = isConsensus
    ? `<span class="sig-v2-consensus-badge">★ ${consensus!.strategies.length} LAYERS CONSENSUS</span>`
    : '';

  card.innerHTML = `
    <div class="sig-v2-header">
      <div class="sig-v2-title-row">
        <span class="sig-v2-dir ${isLong ? 'long' : 'short'}">${isLong ? '▲' : '▼'} ${
    sig.direction
  }</span>
        <span class="sig-v2-symbol">${sig.symbol}</span>
        ${isExpired ? '<span class="sig-v2-status-dot expired"></span>' : '<span class="sig-v2-status-dot live"></span>'}
      </div>
      <div class="sig-v2-subtitle">${symbolName}</div>
    </div>

    <div class="sig-v2-confidence-row">
      <div class="sig-v2-conf-bar-wrapper">
        <div class="sig-v2-conf-bar">
          <div class="sig-v2-conf-fill ${isHighConfidence ? 'shimmer' : ''}" style="width: ${confPct}%; background: ${
    meta.color
  };"></div>
        </div>
      </div>
      <span class="sig-v2-conf-label">${confPct}% CONFIDENCE</span>
    </div>

    <div class="sig-v2-strategies">
      ${strategyBadges}
      ${consensusBadge}
    </div>

    <div class="sig-v2-why">
      <div class="sig-v2-why-label">WHY:</div>
      <div class="sig-v2-why-text">${enhanceReasoning(sig.reasoning)}</div>
    </div>

    <div class="sig-v2-targets">
      <span class="sig-v2-target">TARGET: $${calculateTarget(sig).toFixed(2)} (+${pct(
    sig.takeProfit
  )})</span>
      <span class="sig-v2-stop">STOP: $${calculateStop(sig).toFixed(2)} (-${pct(
    sig.stopLoss
  )})</span>
      <span class="sig-v2-rr">R:R RATIO: ${rrRatio}:1</span>
      <span class="sig-v2-expiry">EXPIRES: ${expiryText}</span>
    </div>

    <div class="sig-v2-actions">
      <button class="sig-v2-btn sig-v2-map-btn" data-action="map">
        <span class="btn-icon">🗺️</span>
        <span class="btn-label">VIEW MAP</span>
      </button>
      <button class="sig-v2-btn sig-v2-history-btn" data-action="history">
        <span class="btn-icon">📊</span>
        <span class="btn-label">HISTORY</span>
      </button>
      <button class="sig-v2-btn sig-v2-trade-btn" data-action="trade" ${isExpired ? 'disabled' : ''}>
        <span class="btn-icon">▶</span>
        <span class="btn-label">PAPER TRADE</span>
      </button>
    </div>

    <div class="sig-v2-history-stats">
      Similar signals: ${getHistoricalWinRate(sig)}% hit rate over ${getHistoricalCount(
    sig
  )} past occurrences
      <div class="sig-v2-win-dist-bar">${renderWinDistribution(sig)}</div>
    </div>
  `;

  // Wire action buttons
  const mapBtn = card.querySelector('[data-action="map"]') as HTMLButtonElement;
  const historyBtn = card.querySelector('[data-action="history"]') as HTMLButtonElement;
  const tradeBtn = card.querySelector('[data-action="trade"]') as HTMLButtonElement;

  mapBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleFlyToMap(sig);
  });

  historyBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    handleShowHistory(sig);
  });

  tradeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    handlePaperTrade(sig, tradeBtn);
  });

  // Animate card entrance (slide in from top with spring)
  card.style.opacity = '0';
  card.style.transform = 'translateY(-20px)';
  requestAnimationFrame(() => {
    card.style.transition = 'opacity 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
    card.style.opacity = '1';
    card.style.transform = 'translateY(0)';
  });

  return card;
}

// ── Helper functions ──────────────────────────────────────────────────────────

function getSymbolName(symbol: string): string {
  const names: Record<string, string> = {
    USO: 'United States Oil Fund',
    SPY: 'S&P 500 ETF',
    QQQ: 'Nasdaq 100 ETF',
    GLD: 'Gold Trust',
    TLT: '20+ Year Treasury Bond ETF',
    XLE: 'Energy Select Sector SPDR',
    EEM: 'Emerging Markets ETF',
    VDE: 'Vanguard Energy ETF',
    FXI: 'China Large-Cap ETF',
    XLF: 'Financial Select Sector SPDR',
    XLK: 'Technology Select Sector SPDR',
    XLV: 'Health Care Select Sector SPDR',
    XLI: 'Industrial Select Sector SPDR',
    DIA: 'Dow Jones Industrial Average ETF',
    IWM: 'Russell 2000 ETF',
  };
  return names[symbol] || symbol;
}

function extractTrigger(sig: Signal): string {
  const r = sig.reasoning;

  // Extract key numbers from reasoning
  if (r.includes('CII')) {
    const match = r.match(/CII\s*[:\+]?\s*([\+\-]?\d+\.?\d*)\s*σ?/i);
    if (match) return `Iran CII ${match[1]}σ`;
  }

  if (r.includes('GDELT tone')) {
    const match = r.match(/tone\s*[:\-]?\s*([\-\+]?\d+\.?\d*)/i);
    if (match) return `GDELT ${match[1]}`;
  }

  if (r.includes('AIS')) {
    const match = r.match(/(\d+)\s*tankers?\s*went dark/i);
    if (match) return `${match[1]} AIS gaps`;
  }

  if (r.includes('momentum')) {
    const match = r.match(/([\+\-]?\d+\.?\d*)%/);
    if (match) return `${match[1]}% momentum`;
  }

  // Fallback: first number in reasoning
  const firstNum = r.match(/([\+\-]?\d+\.?\d*)/);
  return firstNum ? firstNum[1] : sig.strategy;
}

function enhanceReasoning(text: string): string {
  // Highlight numbers with gold
  return text.replace(
    /([\+\-]?\d+\.?\d*[%σ]?)/g,
    '<span class="sig-v2-highlight">$1</span>'
  );
}

function calculateTarget(sig: Signal): number {
  // Mock current price (in real app, fetch from market data)
  const mockPrices: Record<string, number> = {
    USO: 78.2,
    SPY: 450.5,
    QQQ: 380.2,
    GLD: 180.5,
    TLT: 95.3,
    XLE: 85.4,
  };
  const currentPrice = mockPrices[sig.symbol] || 100;
  return currentPrice * (1 + sig.takeProfit);
}

function calculateStop(sig: Signal): number {
  const mockPrices: Record<string, number> = {
    USO: 78.2,
    SPY: 450.5,
    QQQ: 380.2,
    GLD: 180.5,
    TLT: 95.3,
    XLE: 85.4,
  };
  const currentPrice = mockPrices[sig.symbol] || 100;
  return currentPrice * (1 - sig.stopLoss);
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function formatExpiry(expiresAt: number): string {
  const remaining = expiresAt - Date.now();
  if (remaining <= 0) return 'EXPIRED';

  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);

  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function getHistoricalWinRate(sig: Signal): number {
  // Mock historical win rates by strategy
  const winRates: Record<string, number> = {
    geopolitical: 67,
    sentiment: 58,
    momentum: 54,
    macro: 51,
    'cross-asset': 55,
    'prediction-markets': 71,
    disaster: 69,
  };
  return winRates[sig.strategy.toLowerCase()] || 60;
}

function getHistoricalCount(sig: Signal): number {
  // Mock counts
  const counts: Record<string, number> = {
    geopolitical: 34,
    sentiment: 127,
    momentum: 89,
    macro: 56,
    'cross-asset': 43,
    'prediction-markets': 12,
    disaster: 23,
  };
  return counts[sig.strategy.toLowerCase()] || 50;
}

function renderWinDistribution(sig: Signal): string {
  const winRate = getHistoricalWinRate(sig) / 100;
  const winWidth = Math.round(winRate * 100);
  const lossWidth = 100 - winWidth;

  return `
    <div class="win-bar" style="width: ${winWidth}%;" title="${winWidth}% wins"></div>
    <div class="loss-bar" style="width: ${lossWidth}%;" title="${lossWidth}% losses"></div>
  `;
}

// ── Action handlers ───────────────────────────────────────────────────────────

function handleFlyToMap(sig: Signal): void {
  const coords = getRegionFor(sig);
  if (!coords) {
    showToast('No map location for this signal', 'info');
    return;
  }

  window.dispatchEvent(
    new CustomEvent('globe:fly-to', {
      detail: { longitude: coords[0], latitude: coords[1], zoom: 5, duration: 1500 },
    })
  );

  showToast(`Flying to ${getRegionName(coords)}`, 'info');
}

function handleShowHistory(sig: Signal): void {
  // TODO: Show historical performance modal
  showToast('Historical performance coming soon', 'info');
}

function handlePaperTrade(sig: Signal, btn: HTMLButtonElement): void {
  // Show quick-confirm modal
  const modal = buildTradeConfirmModal(sig, btn);
  document.body.appendChild(modal);
}

function buildTradeConfirmModal(sig: Signal, originBtn: HTMLButtonElement): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'sig-v2-trade-confirm-overlay';

  const shares = 500; // Default shares
  const estimatedCost = calculateTarget(sig) * shares;

  overlay.innerHTML = `
    <div class="sig-v2-trade-confirm-modal">
      <div class="modal-title">Execute Paper Trade</div>
      <div class="modal-trade-summary">
        ${sig.direction} ${sig.symbol} · ${shares} shares · ~$${estimatedCost.toLocaleString(
    'en-US',
    { maximumFractionDigits: 0 }
  )}
      </div>
      <div class="modal-actions">
        <button class="modal-btn modal-cancel" data-action="cancel">CANCEL</button>
        <button class="modal-btn modal-confirm" data-action="confirm">CONFIRM</button>
      </div>
    </div>
  `;

  const cancelBtn = overlay.querySelector('[data-action="cancel"]') as HTMLButtonElement;
  const confirmBtn = overlay.querySelector('[data-action="confirm"]') as HTMLButtonElement;

  cancelBtn.addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'EXECUTING...';

    const result = await executionLoop.executeSignal(sig);

    overlay.remove();

    if (result.approved && result.fill) {
      // Flash green on origin button
      originBtn.classList.add('flash-green');
      originBtn.textContent = '✓ EXECUTED';
      setTimeout(() => {
        originBtn.classList.remove('flash-green');
        originBtn.textContent = '▶ PAPER TRADE';
      }, 2000);

      showToast(
        `✓ ${sig.direction} ${sig.symbol} — ${result.fill.fillQuantity} shares @ $${result.fill.fillPrice.toFixed(
          2
        )}`,
        'success'
      );
    } else {
      showToast(result.reason ?? 'Order rejected', 'error');
    }
  });

  return overlay;
}

// ── Geography mapping ─────────────────────────────────────────────────────────

const SYMBOL_COORDS: Record<string, [number, number]> = {
  USO: [48, 25], // Middle East (oil)
  XLE: [48, 25],
  VDE: [48, 25],
  EEM: [104, 15], // Asia EM
  FXI: [116, 30], // China
  VWO: [100, 20],
  GLD: [28, 2], // Africa (gold)
  IAU: [28, 2],
  TLT: [-77, 38.9], // Washington DC
  IEF: [-77, 38.9],
  SPY: [-74, 40.7], // New York
  DIA: [-74, 40.7],
  IWM: [-74, 40.7],
  QQQ: [-122, 37.4], // Silicon Valley
  XLK: [-122, 37.4],
  XLF: [-73.9, 40.7], // Wall Street
};

function getRegionFor(sig: Signal): [number, number] | null {
  if (SYMBOL_COORDS[sig.symbol]) return SYMBOL_COORDS[sig.symbol];

  // Heuristics from reasoning
  const r = sig.reasoning.toLowerCase();
  if (r.includes('iran') || r.includes('middle east') || r.includes('hormuz'))
    return [48, 25];
  if (r.includes('china') || r.includes('taiwan')) return [116, 30];
  if (r.includes('russia') || r.includes('ukraine')) return [37.6, 55.7];
  if (r.includes('europe')) return [10, 50];

  return null;
}

function getRegionName(coords: [number, number]): string {
  const [lon, lat] = coords;
  if (lon > 40 && lon < 60 && lat > 20 && lat < 30) return 'Middle East';
  if (lon > 100 && lon < 130 && lat > 20 && lat < 40) return 'East Asia';
  if (lon > 30 && lon < 50 && lat > 50 && lat < 60) return 'Eastern Europe';
  if (lon < -60 && lon > -80 && lat > 35 && lat < 45) return 'Northeast USA';
  return 'Target region';
}

// ── Panel state ───────────────────────────────────────────────────────────────

let allSignals: Signal[] = [];
let filteredSignals: Signal[] = [];
let filterMode: 'all' | 'consensus' | 'high' = 'all';
let consensusMap = new Map<string, ConsensusGroup>();
let autoExecute = false;

// ── Render functions ──────────────────────────────────────────────────────────

function renderSignalList(container: HTMLElement): void {
  const listEl = container.querySelector('.sig-v2-list') as HTMLElement;
  if (!listEl) return;

  // Clear existing cards
  listEl.innerHTML = '';

  // Filter based on mode
  let toRender: Signal[] = [];

  switch (filterMode) {
    case 'all':
      toRender = filteredSignals;
      break;
    case 'consensus':
      // Only show signals that are part of consensus groups
      const consensusSignalIds = new Set<string>();
      for (const group of consensusMap.values()) {
        group.signals.forEach((s) => consensusSignalIds.add(s.id));
      }
      toRender = filteredSignals.filter((s) => consensusSignalIds.has(s.id));
      break;
    case 'high':
      toRender = filteredSignals.filter((s) => s.confidence >= 0.8);
      break;
  }

  if (toRender.length === 0) {
    listEl.innerHTML = `
      <div class="sig-v2-empty">
        <div class="empty-icon">📡</div>
        <div class="empty-title">No signals match current filter</div>
        <div class="empty-subtitle">Try adjusting filters or wait for new signals</div>
      </div>
    `;
    return;
  }

  // Render cards (max 20 at a time for performance)
  const fragment = document.createDocumentFragment();
  for (const sig of toRender.slice(0, 20)) {
    const key = `${sig.symbol}:${sig.direction}`;
    const consensus = consensusMap.get(key) || null;
    const card = buildSignalCard(sig, consensus);
    fragment.appendChild(card);
  }

  listEl.appendChild(fragment);

  // Update count badge
  updateCountBadge(toRender.length);
}

function updateCountBadge(count: number): void {
  const badge = document.querySelector('.sig-v2-count-badge') as HTMLElement;
  if (badge) badge.textContent = String(count);
}

// ── Panel initialization ──────────────────────────────────────────────────────

function buildPanelBody(container: HTMLElement): void {
  container.className += ' sig-v2-panel-body';

  container.innerHTML = `
    <div class="sig-v2-header-bar">
      <div class="sig-v2-title-section">
        <span class="sig-v2-title">SIGNALS</span>
        <span class="sig-v2-live-dot"></span>
        <span class="sig-v2-count-badge">0</span>
        <span class="sig-v2-active-label">active</span>
      </div>
      <label class="sig-v2-auto-toggle" title="Auto-execute approved signals">
        <span class="toggle-label">AUTO</span>
        <span class="toggle-switch">
          <input type="checkbox" class="toggle-input">
          <span class="toggle-track">
            <span class="toggle-thumb"></span>
          </span>
        </span>
        <span class="toggle-status">OFF</span>
      </label>
    </div>

    <div class="sig-v2-filter-bar">
      <button class="sig-v2-filter-btn active" data-filter="all">ALL</button>
      <button class="sig-v2-filter-btn" data-filter="consensus">CONSENSUS</button>
      <button class="sig-v2-filter-btn" data-filter="high">HIGH</button>
      <div class="sig-v2-filter-dropdown">
        <button class="sig-v2-filter-dropdown-btn">BY STRATEGY ▼</button>
        <div class="sig-v2-filter-dropdown-menu" style="display: none;">
          <!-- Strategy filters populated dynamically -->
        </div>
      </div>
    </div>

    <div class="sig-v2-list"></div>
  `;

  // Wire filter buttons
  const filterBtns = container.querySelectorAll('.sig-v2-filter-btn');
  filterBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterBtns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      filterMode = (btn as HTMLElement).dataset.filter as any;
      renderSignalList(container);
    });
  });

  // Wire auto-toggle
  const autoToggle = container.querySelector('.toggle-input') as HTMLInputElement;
  const autoStatus = container.querySelector('.toggle-status') as HTMLElement;

  autoToggle?.addEventListener('change', async () => {
    autoExecute = autoToggle.checked;
    autoStatus.textContent = autoExecute ? 'ON' : 'OFF';

    const { setAutoExecute } = await import('../trading/engine/execution-loop');
    setAutoExecute(autoExecute);

    showToast(
      autoExecute ? 'Auto-trade ON — signals ≥70% will execute' : 'Auto-trade OFF',
      'info'
    );
  });

  // Sync with execution loop state
  import('../trading/engine/execution-loop').then(({ getAutoExecute }) => {
    autoExecute = getAutoExecute();
    if (autoToggle) autoToggle.checked = autoExecute;
    if (autoStatus) autoStatus.textContent = autoExecute ? 'ON' : 'OFF';
  });

  // Subscribe to live signals
  window.addEventListener('trading:signals', (e: Event) => {
    const signals = (e as CustomEvent<Signal[]>).detail;
    if (Array.isArray(signals) && signals.length > 0) {
      onNewSignals(signals);
    }
  });

  // Initial empty render
  renderSignalList(container);
}

function onNewSignals(signals: Signal[]): void {
  allSignals = signals.slice(0, 100); // Cap at 100
  filteredSignals = allSignals.filter((s) => s.expiresAt > Date.now()); // Only active
  consensusMap = detectConsensus(filteredSignals);

  const container = document.querySelector('.sig-v2-panel-body') as HTMLElement;
  if (container) renderSignalList(container);

  // Mark as live
  const liveDot = document.querySelector('.sig-v2-live-dot') as HTMLElement;
  if (liveDot) liveDot.classList.add('live');
}

// ── Export ────────────────────────────────────────────────────────────────────

export function initSignalsPanelV2(): void {
  registerPanel({
    id: 'signals-v2',
    title: 'Signals V2',
    badge: 'LIVE',
    badgeClass: 'live',
    defaultCollapsed: false,
    init: buildPanelBody,
  });
}
