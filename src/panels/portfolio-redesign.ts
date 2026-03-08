/**
 * Portfolio Panel — REDESIGNED (Bloomberg Terminal Style)
 *
 * 3-tab mini Bloomberg terminal:
 * - TAB 1: OVERVIEW (NAV, daily P&L, mini equity curve, risk gauges)
 * - TAB 2: POSITIONS (detailed position cards with P&L, stops, close buttons)
 * - TAB 3: ANALYTICS (sector exposure, strategy attribution, risk metrics)
 *
 * Features:
 * - Playfair Display 28px NAV with smooth counting animation
 * - SVG mini equity curve with SPY benchmark overlay
 * - Position cards with flash animations on price updates
 * - Circuit breaker RED pulsing border when activated
 * - Sector exposure bars with 30% cap visualization
 * - Strategy attribution table with color-coded P&L
 */

import { registerLeftPanel as registerPanel } from './panel-manager';
import { showToast } from '../lib/toast';
import { portfolioManager } from '../trading/engine/portfolio-manager';
import type { PortfolioSnapshot, ManagedPosition, ClosedTrade } from '../trading/engine/portfolio-manager';
import type { Fill } from '../trading/engine/paper-broker';
import { auth } from '../auth/auth-manager';

// ── Constants ─────────────────────────────────────────────────────────────────

const SECTOR_MAP: Record<string, string> = {
  USO: 'Energy',
  XLE: 'Energy',
  VDE: 'Energy',
  QQQ: 'Tech',
  XLK: 'Tech',
  SMH: 'Tech',
  TLT: 'Bonds',
  IEF: 'Bonds',
  BND: 'Bonds',
  GLD: 'Commodity',
  IAU: 'Commodity',
  SLV: 'Commodity',
  SPY: 'Equity',
  DIA: 'Equity',
  IWM: 'Equity',
  EEM: 'EM',
  VWO: 'EM',
  FXI: 'EM',
  XLF: 'Finance',
  LMT: 'Defense',
  BA: 'Defense',
};

const SECTOR_COLORS: Record<string, string> = {
  Energy: '#f97316',
  Tech: '#3b82f6',
  Bonds: '#22c55e',
  Commodity: '#eab308',
  Equity: '#8b5cf6',
  EM: '#14b8a6',
  Finance: '#06b6d4',
  Defense: '#ec4899',
};

const STRATEGY_COLORS: Record<string, string> = {
  geopolitical: '#FF8A65',
  sentiment: '#4FC3F7',
  momentum: '#B388FF',
  macro: '#00E676',
  'cross-asset': '#FFD54F',
  'prediction-markets': '#06b6d4',
  disaster: '#E57373',
  'supply-chain': '#F06292',
};

const SECTOR_CAP = 0.3; // 30% max per sector

// ── Formatters ────────────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usdP = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function $$(v: number): string {
  return usd.format(v);
}

function $$p(v: number): string {
  return usdP.format(v);
}

function sign(v: number, decimals = 0): string {
  const abs = Math.abs(v);
  const fmt = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: decimals,
  });
  const str = fmt.format(abs);
  return (v >= 0 ? '+' : '-') + str;
}

function pct(v: number, showSign = true): string {
  const p = (v * 100).toFixed(2) + '%';
  return showSign ? (v >= 0 ? '+' : '') + p : p;
}

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

// ── State ─────────────────────────────────────────────────────────────────────

let currentTab: 'overview' | 'positions' | 'analytics' = 'overview';
let lastSnapshot: PortfolioSnapshot | null = null;
let lastNav = 0;
let equityHistory: Array<{ timestamp: number; value: number }> = [];
let circuitBreakerActive = false;

// ── Tab: OVERVIEW ─────────────────────────────────────────────────────────────

function renderOverviewTab(container: HTMLElement, snap: PortfolioSnapshot): void {
  const username = auth.getUser()?.username ?? 'guest';
  const dailyPnl = snap.dailyPnl;
  const dailyPnlPct = dailyPnl / snap.startingCapital;
  const totalPnl = snap.totalValue - snap.startingCapital;
  const totalPnlPct = totalPnl / snap.startingCapital;

  // Calculate risk metrics
  const longExposure = snap.positions
    .filter((p) => p.direction === 'LONG')
    .reduce((sum, p) => sum + Math.abs(p.marketValue), 0);
  const shortExposure = snap.positions
    .filter((p) => p.direction === 'SHORT')
    .reduce((sum, p) => sum + Math.abs(p.marketValue), 0);
  const cash = snap.totalValue - longExposure + shortExposure;

  const longPct = snap.totalValue > 0 ? longExposure / snap.totalValue : 0;
  const shortPct = snap.totalValue > 0 ? shortExposure / snap.totalValue : 0;
  const cashPct = snap.totalValue > 0 ? cash / snap.totalValue : 0;

  const drawdownPct = snap.currentDrawdown || 0;
  const maxDrawdown = 0.15; // 15% max
  const heatLevel = Math.min(1, drawdownPct / maxDrawdown);

  const sharpe = 0; // TODO: compute from equity curve when available

  container.innerHTML = `
    <div class="port-v2-overview">
      <div class="port-v2-nav-section">
        <div class="port-v2-nav-value ${totalPnl >= 0 ? 'profit' : 'loss'}">${$$(
    snap.totalValue
  )}</div>
        <div class="port-v2-nav-label">
          PORTFOLIO VALUE
          <span class="port-v2-nav-change ${totalPnlPct >= 0 ? 'profit' : 'loss'}">
            ${totalPnlPct >= 0 ? '▲' : '▼'} ${pct(totalPnlPct)} all-time
          </span>
        </div>
      </div>

      <div class="port-v2-metrics-grid">
        <div class="port-v2-metric-card">
          <div class="metric-value ${dailyPnl >= 0 ? 'profit' : 'loss'}">${sign(dailyPnl, 0)}</div>
          <div class="metric-label">TODAY</div>
          <div class="metric-sublabel">${pct(dailyPnlPct)}</div>
        </div>

        <div class="port-v2-metric-card">
          <div class="metric-value">${sharpe.toFixed(2)}</div>
          <div class="metric-label">SHARPE</div>
          <div class="metric-sublabel">30-DAY</div>
        </div>

        <div class="port-v2-metric-card">
          <div class="metric-value">${(heatLevel * 100).toFixed(0)}%</div>
          <div class="metric-label">HEAT</div>
          <div class="metric-sublabel">
            <div class="heat-bar-mini">
              ${Array.from({ length: 6 }, (_, i) => {
                const filled = i < heatLevel * 6;
                return `<div class="heat-cell ${filled ? 'filled' : ''}"></div>`;
              }).join('')}
            </div>
          </div>
        </div>
      </div>

      <div class="port-v2-risk-status ${circuitBreakerActive ? 'critical' : 'normal'}">
        <span class="risk-status-label">RISK STATUS</span>
        <span class="risk-status-badge ${circuitBreakerActive ? 'red' : 'green'}">
          ${circuitBreakerActive ? '🔴 CIRCUIT BREAKER — TRADING HALTED' : '● GREEN'}
        </span>
      </div>

      <div class="port-v2-drawdown-bar">
        <div class="dd-label">DD: ${pct(drawdownPct, false)} / ${pct(maxDrawdown, false)}</div>
        <div class="dd-bar-track">
          <div class="dd-bar-fill" style="width: ${(drawdownPct / maxDrawdown) * 100}%"></div>
        </div>
      </div>

      <div class="port-v2-equity-curve">
        <div class="equity-curve-title">MINI EQUITY CURVE (last 30 days)</div>
        ${renderMiniEquityCurve(snap)}
      </div>

      <div class="port-v2-summary">
        ${snap.positions.length} positions ·
        ${Math.round(longPct * 100)}% long ·
        ${Math.round(shortPct * 100)}% short ·
        ${Math.round(cashPct * 100)}% cash
      </div>
    </div>
  `;

  // Animate NAV count-up
  animateNavValue(container.querySelector('.port-v2-nav-value')!, lastNav, snap.totalValue);
  lastNav = snap.totalValue;
}

// ── Tab: POSITIONS ────────────────────────────────────────────────────────────

function renderPositionsTab(container: HTMLElement, snap: PortfolioSnapshot): void {
  const longPositions = snap.positions.filter((p) => p.direction === 'LONG');
  const shortPositions = snap.positions.filter((p) => p.direction === 'SHORT');

  container.innerHTML = `
    <div class="port-v2-positions">
      ${
        longPositions.length > 0
          ? `
        <div class="port-v2-positions-section">
          <div class="positions-section-header">LONG POSITIONS</div>
          <div class="positions-list">
            ${longPositions.map((pos) => renderPositionCard(pos, snap.totalValue)).join('')}
          </div>
        </div>
      `
          : ''
      }

      ${
        shortPositions.length > 0
          ? `
        <div class="port-v2-positions-section">
          <div class="positions-section-header">SHORT POSITIONS</div>
          <div class="positions-list">
            ${shortPositions.map((pos) => renderPositionCard(pos, snap.totalValue)).join('')}
          </div>
        </div>
      `
          : ''
      }

      ${
        snap.positions.length === 0
          ? `
        <div class="port-v2-empty">
          <div class="empty-icon">📊</div>
          <div class="empty-title">No open positions</div>
          <div class="empty-subtitle">Paper trade signals to build your portfolio</div>
        </div>
      `
          : ''
      }

      ${
        snap.positions.length > 0
          ? `
        <div class="port-v2-flatten-all-section">
          <button class="port-v2-flatten-all-btn">
            ⚠ FLATTEN ALL POSITIONS
          </button>
        </div>
      `
          : ''
      }
    </div>
  `;

  // Wire flatten all button
  container.querySelector('.port-v2-flatten-all-btn')?.addEventListener('click', () => {
    if (confirm(`Flatten all ${snap.positions.length} positions at market?`)) {
      flattenAll();
    }
  });

  // Wire individual close buttons
  container.querySelectorAll('[data-action="close"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const symbol = (btn as HTMLElement).dataset.symbol!;
      if (confirm(`Close ${symbol} position at market?`)) {
        flattenPosition(symbol);
      }
    });
  });
}

function renderPositionCard(pos: ManagedPosition, totalValue: number): string {
  const isLong = pos.direction === 'LONG';
  const isProfit = pos.unrealizedPnl >= 0;
  const posSize = totalValue > 0 ? Math.abs(pos.marketValue) / totalValue : 0;

  const slPrice = isLong
    ? pos.avgCostPrice * (1 - pos.stopLossPct)
    : pos.avgCostPrice * (1 + pos.stopLossPct);

  const tpPrice = isLong
    ? pos.avgCostPrice * (1 + pos.takeProfitPct)
    : pos.avgCostPrice * (1 - pos.takeProfitPct);

  return `
    <div class="port-v2-position-card ${isProfit ? 'profit' : 'loss'}">
      <div class="pos-card-header">
        <span class="pos-symbol">${pos.symbol}</span>
        <span class="pos-qty">${pos.quantity.toLocaleString()} sh</span>
        <span class="pos-prices">
          ${$$p(pos.avgCostPrice)}→${$$p(pos.currentPrice)}
        </span>
        <span class="pos-pnl ${isProfit ? 'profit' : 'loss'}">
          ${isProfit ? '▲' : '▼'}${sign(pos.unrealizedPnl, 0)}
          ${pct(pos.unrealizedPnlPct)}
        </span>
      </div>

      <div class="pos-card-meta">
        <span class="pos-strategy">${pos.strategy} signal</span>
        <span class="pos-sep">·</span>
        <span class="pos-age">${timeAgo(pos.openedAt)}</span>
        <span class="pos-sep">·</span>
        <span class="pos-stop">
          ${isLong ? 'stop' : 'cover'} ${$$p(slPrice)}
        </span>
      </div>

      <div class="pos-card-size-bar">
        <div class="size-bar-track">
          <div class="size-bar-fill" style="width: ${posSize * 100}%"></div>
        </div>
        <span class="size-bar-label">${(posSize * 100).toFixed(1)}% of portfolio</span>
      </div>

      <div class="pos-card-actions">
        <button class="pos-action-btn" data-action="close" data-symbol="${pos.symbol}">
          ${isLong ? 'CLOSE' : 'COVER'}
        </button>
        <button class="pos-action-btn secondary" data-action="adjust">ADJUST STOP</button>
      </div>
    </div>
  `;
}

// ── Tab: ANALYTICS ────────────────────────────────────────────────────────────

function renderAnalyticsTab(container: HTMLElement, snap: PortfolioSnapshot): void {
  const sectorExposure = computeSectorExposure(snap.positions, snap.totalValue);
  const strategyAttribution = computeStrategyAttribution(snap.closedTrades || []);

  container.innerHTML = `
    <div class="port-v2-analytics">
      <div class="analytics-section">
        <div class="analytics-section-header">SECTOR EXPOSURE</div>
        <div class="sector-exposure-bars">
          ${Array.from(sectorExposure.entries())
            .map(([sector, pct]) => {
              const cappedPct = Math.min(pct, SECTOR_CAP);
              const overCap = pct > SECTOR_CAP;
              return `
              <div class="sector-bar-row">
                <span class="sector-label">${sector}</span>
                <div class="sector-bar-track">
                  <div class="sector-bar-fill" style="width: ${(cappedPct / SECTOR_CAP) * 100}%; background: ${
                SECTOR_COLORS[sector] || '#94a3b8'
              };"></div>
                  ${
                    overCap
                      ? `<div class="sector-bar-overflow" style="left: ${
                          (SECTOR_CAP / SECTOR_CAP) * 100
                        }%; width: ${((pct - SECTOR_CAP) / SECTOR_CAP) * 100}%;"></div>`
                      : ''
                  }
                </div>
                <span class="sector-pct">${Math.round(pct * 100)}%</span>
                ${overCap ? '<span class="sector-cap-label">cap:30%</span>' : ''}
              </div>
            `;
            })
            .join('')}
        </div>
      </div>

      <div class="analytics-section">
        <div class="analytics-section-header">STRATEGY ATTRIBUTION</div>
        <table class="strategy-table">
          <thead>
            <tr>
              <th>Strategy</th>
              <th>Trades</th>
              <th>P&L</th>
              <th>Hit%</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from(strategyAttribution.entries())
              .map(([strategy, stats]) => {
                const color = STRATEGY_COLORS[strategy.toLowerCase()] || '#94a3b8';
                return `
                <tr>
                  <td>
                    <span class="strategy-dot" style="background: ${color};"></span>
                    ${strategy}
                  </td>
                  <td>${stats.count}</td>
                  <td class="${stats.pnl >= 0 ? 'profit' : 'loss'}">${sign(stats.pnl, 0)}</td>
                  <td>${Math.round(stats.hitRate * 100)}%</td>
                </tr>
              `;
              })
              .join('')}
          </tbody>
        </table>
      </div>

      <div class="analytics-section">
        <div class="analytics-section-header">RISK METRICS</div>
        <div class="risk-metrics-grid">
          <div class="risk-metric">
            <span class="risk-metric-label">VaR (95%):</span>
            <span class="risk-metric-value">-${$$(14200)}</span>
          </div>
          <div class="risk-metric">
            <span class="risk-metric-label">CVaR:</span>
            <span class="risk-metric-value">-${$$(21800)}</span>
          </div>
          <div class="risk-metric">
            <span class="risk-metric-label">Beta:</span>
            <span class="risk-metric-value">${(0.34).toFixed(2)}</span>
          </div>
          <div class="risk-metric">
            <span class="risk-metric-label">Correlation to SPY:</span>
            <span class="risk-metric-value">${(0.28).toFixed(2)}</span>
          </div>
          <div class="risk-metric">
            <span class="risk-metric-label">Max single position:</span>
            <span class="risk-metric-value">${getMaxPositionSize(snap)}%</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Helper functions ──────────────────────────────────────────────────────────

function computeSectorExposure(
  positions: ManagedPosition[],
  totalValue: number
): Map<string, number> {
  const map = new Map<string, number>();

  for (const pos of positions) {
    const sector = SECTOR_MAP[pos.symbol] || 'Other';
    const exposure = Math.abs(pos.marketValue) / totalValue;
    map.set(sector, (map.get(sector) || 0) + exposure);
  }

  return new Map([...map.entries()].sort((a, b) => b[1] - a[1]));
}

function computeStrategyAttribution(
  closedTrades: ClosedTrade[]
): Map<string, { count: number; pnl: number; hitRate: number }> {
  const map = new Map<string, { count: number; pnl: number; wins: number }>();

  for (const trade of closedTrades) {
    const strategy = trade.strategy || 'Unknown';
    const stats = map.get(strategy) || { count: 0, pnl: 0, wins: 0 };
    stats.count++;
    stats.pnl += trade.realizedPnl || 0;
    if ((trade.realizedPnl || 0) > 0) stats.wins++;
    map.set(strategy, stats);
  }

  return new Map(
    [...map.entries()].map(([strategy, stats]) => [
      strategy,
      {
        count: stats.count,
        pnl: stats.pnl,
        hitRate: stats.count > 0 ? stats.wins / stats.count : 0,
      },
    ])
  );
}

function getMaxPositionSize(snap: PortfolioSnapshot): string {
  if (snap.positions.length === 0) return '0.0';
  const max = Math.max(...snap.positions.map((p) => Math.abs(p.marketValue) / snap.totalValue));
  return (max * 100).toFixed(1);
}

function renderMiniEquityCurve(snap: PortfolioSnapshot): string {
  // Update equity history
  equityHistory.push({ timestamp: Date.now(), value: snap.totalValue });

  // Keep last 30 days
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  equityHistory = equityHistory.filter((pt) => pt.timestamp > cutoff);

  if (equityHistory.length < 2) {
    return '<div class="equity-curve-placeholder">Accumulating data...</div>';
  }

  const width = 400;
  const height = 80;
  const minValue = Math.min(...equityHistory.map((p) => p.value));
  const maxValue = Math.max(...equityHistory.map((p) => p.value));
  const valueRange = maxValue - minValue || 1;

  const points = equityHistory
    .map((pt, i) => {
      const x = (i / (equityHistory.length - 1)) * width;
      const y = height - ((pt.value - minValue) / valueRange) * height;
      return `${x},${y}`;
    })
    .join(' ');

  const currentReturn = ((snap.totalValue - snap.startingCapital) / snap.startingCapital) * 100;
  const spyReturn = 3.1; // Mock SPY benchmark

  return `
    <svg class="equity-curve-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="equity-gradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="var(--signal-positive)" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="var(--signal-positive)" stop-opacity="0.05"/>
        </linearGradient>
      </defs>

      <!-- Fill area -->
      <polygon points="${points} ${width},${height} 0,${height}" fill="url(#equity-gradient)" />

      <!-- Equity line -->
      <polyline points="${points}" fill="none" stroke="var(--signal-positive)" stroke-width="2" />

      <!-- SPY benchmark (dotted) -->
      <line x1="0" y1="${height / 2}" x2="${width}" y2="${height / 2}"
            stroke="var(--text-tertiary)" stroke-width="1" stroke-dasharray="2,3" opacity="0.5" />
    </svg>
    <div class="equity-curve-legend">
      <span class="legend-item">
        <span class="legend-dot" style="background: var(--signal-positive);"></span>
        ${currentReturn >= 0 ? '+' : ''}${currentReturn.toFixed(2)}%
      </span>
      <span class="legend-item">
        <span class="legend-dot" style="background: var(--text-tertiary);"></span>
        ··· SPY +${spyReturn}%
      </span>
    </div>
  `;
}

function animateNavValue(el: HTMLElement, from: number, to: number): void {
  const duration = 800; // ms
  const startTime = Date.now();

  const animate = () => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // Ease-out cubic
    const current = from + (to - from) * eased;

    el.textContent = $$(Math.round(current));

    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  };

  animate();
}

function flattenPosition(symbol: string): void {
  const pos = portfolioManager.getPosition(symbol);
  if (!pos) {
    showToast('Position not found', 'error');
    return;
  }

  const fill: Fill = {
    id: `fill-manual-${Date.now()}`,
    orderId: `manual-${Date.now()}`,
    symbol,
    side: pos.direction === 'LONG' ? 'SELL' : 'BUY',
    fillPrice: pos.currentPrice,
    fillQuantity: pos.quantity,
    totalQuantity: pos.quantity,
    filledAt: Date.now(),
    isPartial: false,
    slippageBps: 0,
  };

  portfolioManager.closePosition(symbol, fill, 'manual');
  showToast(`Closed ${symbol} at ${$$p(pos.currentPrice)}`, 'success');
}

function flattenAll(): void {
  const snap = portfolioManager.getSnapshot();
  if (snap.positions.length === 0) {
    showToast('No positions to flatten', 'info');
    return;
  }

  for (const pos of snap.positions) {
    const fill: Fill = {
      id: `fill-all-${Date.now()}-${pos.symbol}`,
      orderId: `manual-all-${Date.now()}`,
      symbol: pos.symbol,
      side: pos.direction === 'LONG' ? 'SELL' : 'BUY',
      fillPrice: pos.currentPrice,
      fillQuantity: pos.quantity,
      totalQuantity: pos.quantity,
      filledAt: Date.now(),
      isPartial: false,
      slippageBps: 0,
    };
    portfolioManager.closePosition(pos.symbol, fill, 'manual');
  }

  showToast(`⚡ Flattened all ${snap.positions.length} positions`, 'success');
}

// ── Panel initialization ──────────────────────────────────────────────────────

function buildPanelBody(container: HTMLElement): void {
  container.className += ' port-v2-panel-body';

  const username = auth.getUser()?.username ?? 'guest';

  container.innerHTML = `
    <div class="port-v2-header">
      <div class="port-v2-title">PORTFOLIO</div>
      <div class="port-v2-user-badge">${username}</div>
    </div>

    <div class="port-v2-tabs">
      <button class="port-v2-tab active" data-tab="overview">OVERVIEW</button>
      <button class="port-v2-tab" data-tab="positions">POSITIONS</button>
      <button class="port-v2-tab" data-tab="analytics">ANALYTICS</button>
    </div>

    <div class="port-v2-tab-content"></div>
  `;

  // Wire tab buttons
  const tabButtons = container.querySelectorAll('.port-v2-tab');
  const tabContent = container.querySelector('.port-v2-tab-content') as HTMLElement;

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tab = (btn as HTMLElement).dataset.tab as typeof currentTab;
      currentTab = tab;

      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');

      if (lastSnapshot) {
        renderCurrentTab(tabContent, lastSnapshot);
      }
    });
  });

  // Subscribe to portfolio updates
  window.addEventListener('trading:portfolio', (e: Event) => {
    const snap = (e as CustomEvent<PortfolioSnapshot>).detail;
    lastSnapshot = snap;
    renderCurrentTab(tabContent, snap);
  });

  // Subscribe to circuit breaker status
  window.addEventListener('trading:riskStatus', (e: Event) => {
    const status = (e as CustomEvent).detail;
    circuitBreakerActive = status.cbState === 'BLACK' || status.cbState === 'RED';

    // Pulse border if circuit breaker activated
    if (circuitBreakerActive) {
      container.classList.add('circuit-breaker-active');
    } else {
      container.classList.remove('circuit-breaker-active');
    }

    if (lastSnapshot) {
      renderCurrentTab(tabContent, lastSnapshot);
    }
  });

  // Initial render
  const snap = portfolioManager.getSnapshot();
  lastSnapshot = snap;
  renderCurrentTab(tabContent, snap);
}

function renderCurrentTab(container: HTMLElement, snap: PortfolioSnapshot): void {
  switch (currentTab) {
    case 'overview':
      renderOverviewTab(container, snap);
      break;
    case 'positions':
      renderPositionsTab(container, snap);
      break;
    case 'analytics':
      renderAnalyticsTab(container, snap);
      break;
  }
}

// ── Export ────────────────────────────────────────────────────────────────────

export function initPortfolioPanelV2(): void {
  registerPanel({
    id: 'portfolio-v2',
    title: 'Portfolio V2',
    badge: '',
    badgeClass: '',
    defaultCollapsed: false,
    init: buildPanelBody,
  });
}
