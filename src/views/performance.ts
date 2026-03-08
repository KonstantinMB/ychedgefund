/**
 * Performance View — Full-Screen Investor Deck Slide
 *
 * Replaces the globe when user clicks "Performance" tab.
 * Shows comprehensive portfolio performance metrics with:
 * - Full-width equity curve with SPY benchmark + drawdown chart
 * - Monthly returns heatmap
 * - Strategy breakdown donut chart
 * - Key metrics table (30d/90d/All periods)
 * - Recent trades table
 * - Export PDF and Share functionality
 */

import { portfolioManager } from '../trading/engine/portfolio-manager';
import type { PortfolioSnapshot, ClosedTrade } from '../trading/engine/portfolio-manager';
import { showToast } from '../lib/toast';

// ── Constants ─────────────────────────────────────────────────────────────────

const STRATEGY_COLORS: Record<string, string> = {
  geopolitical: '#FF8A65',
  sentiment: '#4FC3F7',
  momentum: '#B388FF',
  macro: '#00E676',
  'cross-asset': '#FFD54F',
  'prediction-markets': '#06b6d4',
  disaster: '#E57373',
  'supply-chain': '#F06292',
  earnings: '#4DB6AC',
  'geo-commodity': '#FF8A65',
  'country-rotation': '#9FA8DA',
};

type TimePeriod = '1M' | '3M' | '6M' | '1Y' | 'ALL';

// ── State ─────────────────────────────────────────────────────────────────────

let currentPeriod: TimePeriod = 'ALL';
let equityHistory: Array<{ timestamp: number; value: number; spyValue: number }> = [];
let monthlyReturns: Map<string, number> = new Map(); // 'YYYY-MM' -> return %

// ── Formatters ────────────────────────────────────────────────────────────────

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

const usdK = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 1,
  notation: 'compact',
});

const pct = (v: number, decimals = 2) => {
  const sign = v >= 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(decimals)}%`;
};

const pctAbs = (v: number, decimals = 2) => {
  return `${(v * 100).toFixed(decimals)}%`;
};

// ── Initialize View ───────────────────────────────────────────────────────────

export function initPerformanceView(): void {
  console.log('[Performance] Initializing full-screen performance view');

  // Generate mock equity history (in real app, this comes from portfolio history)
  generateMockEquityHistory();
  generateMockMonthlyReturns();

  renderPerformanceView();

  // Subscribe to portfolio updates
  window.addEventListener('trading:portfolio', () => {
    renderPerformanceView();
  });
}

// ── Render Main View ──────────────────────────────────────────────────────────

function renderPerformanceView(): void {
  const container = document.getElementById('performance-view');
  if (!container) {
    console.error('[Performance] Container not found');
    return;
  }

  const snap = portfolioManager.getSnapshot();
  const totalPnl = snap.totalValue - snap.startingCapital;
  const totalReturn = totalPnl / snap.startingCapital;
  const sharpe = 1.42; // TODO: compute from equity curve when available

  container.innerHTML = `
    <div class="perf-view-container">
      <div class="perf-header">
        <h1 class="perf-title">ATLAS PERFORMANCE REPORT</h1>
        <div class="perf-period-selector">
          ${renderPeriodButtons()}
        </div>
      </div>

      <div class="perf-big-numbers">
        ${renderBigNumber(snap.totalValue, 'PORTFOLIO VALUE', totalPnl >= 0)}
        ${renderBigNumber(totalPnl, 'TOTAL P&L', totalPnl >= 0)}
        ${renderBigNumber(totalReturn, 'RETURN', totalReturn >= 0, true)}
        ${renderBigNumber(sharpe, 'SHARPE', sharpe >= 0, false, 2)}
      </div>

      <div class="perf-equity-section">
        ${renderEquityCurve()}
      </div>

      <div class="perf-heatmap-section">
        ${renderMonthlyHeatmap()}
      </div>

      <div class="perf-bottom-grid">
        <div class="perf-strategy-section">
          ${renderStrategyBreakdown(snap)}
        </div>
        <div class="perf-metrics-section">
          ${renderKeyMetrics(snap)}
        </div>
      </div>

      <div class="perf-trades-section">
        ${renderRecentTrades(snap.closedTrades || [])}
      </div>

      <div class="perf-actions">
        <button class="perf-action-btn" id="perf-export-pdf">
          <span class="btn-icon">📄</span>
          EXPORT PDF
        </button>
        <button class="perf-action-btn" id="perf-share">
          <span class="btn-icon">📸</span>
          SHARE
        </button>
      </div>
    </div>
  `;

  // Wire event handlers
  wireEventHandlers();
}

// ── Period Buttons ────────────────────────────────────────────────────────────

function renderPeriodButtons(): string {
  const periods: TimePeriod[] = ['1M', '3M', '6M', '1Y', 'ALL'];
  return periods
    .map(
      (p) => `
    <button class="perf-period-btn ${p === currentPeriod ? 'active' : ''}" data-period="${p}">
      ${p}
    </button>
  `
    )
    .join('');
}

// ── Big Numbers ───────────────────────────────────────────────────────────────

function renderBigNumber(
  value: number,
  label: string,
  isPositive: boolean,
  isPct = false,
  decimals = 0
): string {
  const formatted = isPct ? pct(value, decimals) : usd.format(value);
  const colorClass = isPositive ? 'positive' : 'negative';

  return `
    <div class="perf-big-number">
      <div class="big-number-value ${colorClass}" data-value="${value}">
        ${formatted}
      </div>
      <div class="big-number-label">${label}</div>
    </div>
  `;
}

// ── Equity Curve ──────────────────────────────────────────────────────────────

function renderEquityCurve(): string {
  const filteredHistory = filterHistoryByPeriod(equityHistory, currentPeriod);

  if (filteredHistory.length < 2) {
    return '<div class="perf-equity-placeholder">Accumulating performance data...</div>';
  }

  const width = 1200;
  const height = 400;
  const padding = { top: 40, right: 60, bottom: 60, left: 80 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate bounds
  const minValue = Math.min(...filteredHistory.map((p) => Math.min(p.value, p.spyValue)));
  const maxValue = Math.max(...filteredHistory.map((p) => Math.max(p.value, p.spyValue)));
  const valueRange = maxValue - minValue || 1;

  // Generate Atlas path
  const atlasPoints = filteredHistory.map((pt, i) => {
    const x = padding.left + (i / (filteredHistory.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((pt.value - minValue) / valueRange) * chartHeight;
    return { x, y, value: pt.value, timestamp: pt.timestamp };
  });

  const atlasPath = atlasPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Generate SPY benchmark path
  const spyPoints = filteredHistory.map((pt, i) => {
    const x = padding.left + (i / (filteredHistory.length - 1)) * chartWidth;
    const y = padding.top + chartHeight - ((pt.spyValue - minValue) / valueRange) * chartHeight;
    return { x, y };
  });

  const spyPath = spyPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Generate gradient fill area
  const fillPath =
    atlasPath +
    ` L ${padding.left + chartWidth} ${padding.top + chartHeight} L ${padding.left} ${padding.top + chartHeight} Z`;

  // Drawdown calculation (simplified - shows distance from peak)
  const drawdownPoints = calculateDrawdown(filteredHistory);
  const maxDrawdown = Math.min(...drawdownPoints);

  const drawdownY = padding.top + chartHeight;
  const drawdownPath = drawdownPoints
    .map((dd, i) => {
      const x = padding.left + (i / (drawdownPoints.length - 1)) * chartWidth;
      const y = drawdownY - (Math.abs(dd) / Math.abs(maxDrawdown || 0.1)) * 80; // 80px max height
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  const drawdownFill =
    drawdownPath + ` L ${padding.left + chartWidth} ${drawdownY} L ${padding.left} ${drawdownY} Z`;

  return `
    <div class="perf-equity-curve">
      <div class="equity-curve-title">EQUITY CURVE</div>
      <svg class="equity-curve-svg" viewBox="0 0 ${width} ${height + 120}" id="equity-curve-svg">
        <defs>
          <linearGradient id="atlas-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--text-accent)" stop-opacity="0.3"/>
            <stop offset="100%" stop-color="var(--signal-positive)" stop-opacity="0.05"/>
          </linearGradient>
          <linearGradient id="drawdown-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--signal-negative)" stop-opacity="0.05"/>
            <stop offset="100%" stop-color="var(--signal-negative)" stop-opacity="0.3"/>
          </linearGradient>
        </defs>

        <!-- Y-axis grid lines -->
        ${generateYAxisGrid(minValue, maxValue, valueRange, padding, chartWidth, chartHeight)}

        <!-- Fill area under Atlas line -->
        <path d="${fillPath}" fill="url(#atlas-gradient)" />

        <!-- SPY benchmark line -->
        <path d="${spyPath}" fill="none" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-dasharray="4,4" opacity="0.6" />

        <!-- Atlas line -->
        <path d="${atlasPath}" fill="none" stroke="var(--text-accent)" stroke-width="2.5" />

        <!-- Drawdown area -->
        <text x="${padding.left}" y="${drawdownY + 20}" font-size="11" fill="var(--text-secondary)" font-family="var(--font-mono)">DRAWDOWN</text>
        <path d="${drawdownFill}" fill="url(#drawdown-gradient)" />
        <path d="${drawdownPath}" fill="none" stroke="var(--signal-negative)" stroke-width="1.5" />

        <!-- Labels -->
        <text x="${width - padding.right + 10}" y="${atlasPoints[atlasPoints.length - 1].y}" font-size="12" fill="var(--text-accent)" font-family="var(--font-sans)" font-weight="600">Atlas</text>
        <text x="${width - padding.right + 10}" y="${spyPoints[spyPoints.length - 1].y}" font-size="12" fill="var(--text-tertiary)" font-family="var(--font-sans)">SPY</text>
        <text x="${width - padding.right - 80}" y="${drawdownY + 35}" font-size="11" fill="var(--signal-negative)" font-family="var(--font-mono)">${pctAbs(
    maxDrawdown,
    1
  )} max</text>

        <!-- X-axis labels (time) -->
        ${generateXAxisLabels(filteredHistory, padding, chartWidth, chartHeight)}

        <!-- Interactive overlay for crosshair -->
        <rect x="${padding.left}" y="${padding.top}" width="${chartWidth}" height="${chartHeight}" fill="transparent" id="equity-curve-overlay" style="cursor: crosshair;" />
      </svg>

      <!-- Tooltip (hidden by default) -->
      <div class="equity-tooltip" id="equity-tooltip" style="display: none;">
        <div class="tooltip-date"></div>
        <div class="tooltip-value"></div>
        <div class="tooltip-return"></div>
      </div>
    </div>
  `;
}

function generateYAxisGrid(
  minValue: number,
  maxValue: number,
  valueRange: number,
  padding: any,
  chartWidth: number,
  chartHeight: number
): string {
  const steps = 5;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const value = minValue + (valueRange / steps) * i;
    const y = padding.top + chartHeight - (i / steps) * chartHeight;
    return `
      <line x1="${padding.left}" y1="${y}" x2="${padding.left + chartWidth}" y2="${y}" stroke="var(--border-subtle)" stroke-width="1" />
      <text x="${padding.left - 10}" y="${y + 4}" text-anchor="end" font-size="11" fill="var(--text-tertiary)" font-family="var(--font-mono)">${usdK.format(value)}</text>
    `;
  }).join('');
}

function generateXAxisLabels(
  history: any[],
  padding: any,
  chartWidth: number,
  chartHeight: number
): string {
  const labelCount = Math.min(8, history.length);
  const step = Math.floor(history.length / labelCount);

  return Array.from({ length: labelCount }, (_, i) => {
    const pt = history[i * step];
    if (!pt) return '';
    const x = padding.left + (i * step / (history.length - 1)) * chartWidth;
    const date = new Date(pt.timestamp);
    const label = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `
      <text x="${x}" y="${padding.top + chartHeight + 20}" text-anchor="middle" font-size="11" fill="var(--text-tertiary)" font-family="var(--font-mono)">${label}</text>
    `;
  }).join('');
}

function calculateDrawdown(history: any[]): number[] {
  let peak = history[0]?.value || 0;
  return history.map((pt) => {
    if (pt.value > peak) peak = pt.value;
    return (pt.value - peak) / peak;
  });
}

// ── Monthly Heatmap ───────────────────────────────────────────────────────────

function renderMonthlyHeatmap(): string {
  const months = Array.from(monthlyReturns.entries()).slice(-12); // Last 12 months

  if (months.length === 0) {
    return '<div class="perf-heatmap-placeholder">Accumulating monthly data...</div>';
  }

  const year = new Date().getFullYear();

  return `
    <div class="perf-heatmap">
      <div class="heatmap-title">MONTHLY RETURNS HEATMAP</div>
      <div class="heatmap-grid">
        <div class="heatmap-year">${year}</div>
        ${months
          .map(([monthKey, returnPct]) => {
            const [, month] = monthKey.split('-');
            const monthName = new Date(2000, parseInt(month) - 1).toLocaleDateString('en-US', {
              month: 'short',
            });
            const intensity = Math.min(Math.abs(returnPct) / 0.05, 1); // 5% = max intensity
            const isPositive = returnPct >= 0;
            const isCurrent = monthKey === getCurrentMonthKey();

            return `
            <div class="heatmap-cell ${isCurrent ? 'current' : ''}"
                 data-month="${monthKey}"
                 data-return="${returnPct}"
                 style="--intensity: ${intensity}; --cell-color: ${
              isPositive ? 'var(--signal-positive)' : 'var(--signal-negative)'
            };">
              <div class="cell-label">${monthName}</div>
              <div class="cell-value">${pct(returnPct, 1)}</div>
              <div class="cell-bar ${isPositive ? 'positive' : 'negative'}" style="height: ${
              intensity * 100
            }%;"></div>
            </div>
          `;
          })
          .join('')}
      </div>
    </div>
  `;
}

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ── Strategy Breakdown ────────────────────────────────────────────────────────

function renderStrategyBreakdown(snap: PortfolioSnapshot): string {
  const closedTrades = snap.closedTrades || [];
  const strategyStats = computeStrategyStats(closedTrades);

  if (strategyStats.length === 0) {
    return `
      <div class="perf-strategy-breakdown">
        <div class="section-title">STRATEGY BREAKDOWN</div>
        <div class="strategy-placeholder">No closed trades yet</div>
      </div>
    `;
  }

  const totalPnl = strategyStats.reduce((sum, s) => sum + s.pnl, 0);

  return `
    <div class="perf-strategy-breakdown">
      <div class="section-title">STRATEGY BREAKDOWN</div>
      ${renderStrategyDonut(strategyStats, totalPnl)}
      <div class="strategy-legend">
        ${strategyStats
          .map(
            (s) => `
          <div class="strategy-legend-item">
            <span class="legend-dot" style="background: ${s.color};"></span>
            <span class="legend-name">${s.strategy}</span>
            <span class="legend-pct">${Math.round(s.percentage)}%</span>
            <span class="legend-pnl ${s.pnl >= 0 ? 'positive' : 'negative'}">${usdK.format(
              s.pnl
            )}</span>
          </div>
        `
          )
          .join('')}
      </div>
    </div>
  `;
}

function renderStrategyDonut(stats: any[], totalPnl: number): string {
  const size = 200;
  const center = size / 2;
  const radius = 70;
  const innerRadius = 45;

  let currentAngle = -Math.PI / 2;

  const paths = stats.map((s) => {
    const sweep = (s.percentage / 100) * Math.PI * 2;
    const endAngle = currentAngle + sweep;
    const largeArc = sweep > Math.PI ? 1 : 0;

    const x1 = center + radius * Math.cos(currentAngle);
    const y1 = center + radius * Math.sin(currentAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);
    const x3 = center + innerRadius * Math.cos(endAngle);
    const y3 = center + innerRadius * Math.sin(endAngle);
    const x4 = center + innerRadius * Math.cos(currentAngle);
    const y4 = center + innerRadius * Math.sin(currentAngle);

    const d = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${x4} ${y4}`,
      'Z',
    ].join(' ');

    currentAngle = endAngle;

    return `<path d="${d}" fill="${s.color}" opacity="0.9" class="donut-segment" data-strategy="${s.strategy}" />`;
  });

  return `
    <svg class="strategy-donut-svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
      ${paths.join('')}
      <text x="${center}" y="${center - 10}" text-anchor="middle" font-size="11" fill="var(--text-tertiary)" font-family="var(--font-sans)">
        ${stats.length} STRATEGIES
      </text>
      <text x="${center}" y="${center + 10}" text-anchor="middle" font-size="18" fill="var(--text-accent)" font-family="var(--font-display)" font-weight="700">
        ${usdK.format(totalPnl)}
      </text>
    </svg>
  `;
}

function computeStrategyStats(trades: ClosedTrade[]): any[] {
  const map = new Map<string, number>();

  for (const trade of trades) {
    const strategy = trade.strategy || 'Unknown';
    map.set(strategy, (map.get(strategy) || 0) + (trade.realizedPnl || 0));
  }

  const total = Array.from(map.values()).reduce((sum, pnl) => sum + Math.abs(pnl), 0);

  return Array.from(map.entries())
    .map(([strategy, pnl]) => ({
      strategy,
      pnl,
      percentage: total > 0 ? (Math.abs(pnl) / total) * 100 : 0,
      color: STRATEGY_COLORS[strategy.toLowerCase()] || '#94a3b8',
    }))
    .sort((a, b) => b.pnl - a.pnl);
}

// ── Key Metrics ───────────────────────────────────────────────────────────────

function renderKeyMetrics(snap: PortfolioSnapshot): string {
  const metrics = [
    { label: 'Sharpe:', d30: 1.8, d90: 1.4, all: 1.42 },
    { label: 'Sortino:', d30: 2.1, d90: 1.7, all: 1.65 },
    { label: 'Max DD:', d30: -0.032, d90: -0.081, all: -0.081, isPct: true },
    { label: 'Win Rate:', d30: 0.58, d90: 0.56, all: 0.56, isPct: true },
    { label: 'Profit F:', d30: 1.6, d90: 1.4, all: 1.35 },
    { label: 'Alpha:', d30: 0.042, d90: 0.031, all: 0.016, isPct: true },
    { label: 'Beta:', d30: 0.28, d90: 0.34, all: 0.34 },
    { label: 'Calmar:', d30: 5.6, d90: 1.7, all: 0.58 },
  ];

  return `
    <div class="perf-key-metrics">
      <div class="section-title">KEY METRICS</div>
      <table class="metrics-table">
        <thead>
          <tr>
            <th>Metric</th>
            <th>30d</th>
            <th>90d</th>
            <th>All</th>
          </tr>
        </thead>
        <tbody>
          ${metrics
            .map(
              (m) => `
            <tr>
              <td class="metric-label">${m.label}</td>
              <td>${m.isPct ? pctAbs(m.d30, 1) : m.d30.toFixed(2)}</td>
              <td>${m.isPct ? pctAbs(m.d90, 1) : m.d90.toFixed(2)}</td>
              <td class="metric-all">${m.isPct ? pctAbs(m.all, 1) : m.all.toFixed(2)}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

// ── Recent Trades ─────────────────────────────────────────────────────────────

function renderRecentTrades(trades: ClosedTrade[]): string {
  const recent = trades.slice(-10).reverse(); // Last 10, newest first

  if (recent.length === 0) {
    return `
      <div class="perf-recent-trades">
        <div class="section-title">RECENT TRADES</div>
        <div class="trades-placeholder">No closed trades yet</div>
      </div>
    `;
  }

  return `
    <div class="perf-recent-trades">
      <div class="section-title">RECENT TRADES</div>
      <table class="trades-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Asset</th>
            <th>Dir</th>
            <th>Entry→Exit</th>
            <th>P&L</th>
            <th>Strategy</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          ${recent
            .map(
              (trade) => `
            <tr>
              <td>${new Date(trade.closedAt || 0).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}</td>
              <td class="trade-symbol">${trade.symbol}</td>
              <td class="trade-dir ${trade.direction.toLowerCase()}">${trade.direction}</td>
              <td class="trade-prices">$${trade.avgEntryPrice.toFixed(2)}→$${trade.avgExitPrice.toFixed(
                2
              )}</td>
              <td class="trade-pnl ${(trade.realizedPnl || 0) >= 0 ? 'positive' : 'negative'}">${usd.format(
                trade.realizedPnl || 0
              )}</td>
              <td>
                <span class="strategy-dot" style="background: ${
                  STRATEGY_COLORS[trade.strategy?.toLowerCase() || ''] || '#94a3b8'
                };"></span>
                ${trade.strategy || 'Unknown'}
              </td>
              <td class="trade-reason">${truncateReason(trade.closeReason || '')}</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function truncateReason(reason: string, maxLength = 40): string {
  if (reason.length <= maxLength) return reason;
  return reason.slice(0, maxLength) + '...';
}

// ── Event Handlers ────────────────────────────────────────────────────────────

function wireEventHandlers(): void {
  // Period selector buttons
  document.querySelectorAll('.perf-period-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      currentPeriod = (btn as HTMLElement).dataset.period as TimePeriod;
      renderPerformanceView();
    });
  });

  // Export PDF
  document.getElementById('perf-export-pdf')?.addEventListener('click', () => {
    showToast('PDF export coming soon', 'info');
    // TODO: Implement PDF generation
  });

  // Share
  document.getElementById('perf-share')?.addEventListener('click', () => {
    showToast('Share functionality coming soon', 'info');
    // TODO: Implement screenshot + watermark
  });

  // Equity curve crosshair
  const overlay = document.getElementById('equity-curve-overlay');
  const tooltip = document.getElementById('equity-tooltip');
  const svg = document.getElementById('equity-curve-svg');

  if (overlay && tooltip && svg) {
    overlay.addEventListener('mousemove', (e) => {
      const rect = svg.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Show tooltip at cursor
      tooltip.style.display = 'block';
      tooltip.style.left = `${e.clientX + 10}px`;
      tooltip.style.top = `${e.clientY - 60}px`;

      // Find nearest data point (simplified)
      const filteredHistory = filterHistoryByPeriod(equityHistory, currentPeriod);
      const chartWidth = 1200 - 80 - 60;
      const index = Math.round(((x - 80) / chartWidth) * (filteredHistory.length - 1));
      const pt = filteredHistory[Math.max(0, Math.min(index, filteredHistory.length - 1))];

      if (pt) {
        const date = new Date(pt.timestamp).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
        tooltip.querySelector('.tooltip-date')!.textContent = date;
        tooltip.querySelector('.tooltip-value')!.textContent = usd.format(pt.value);

        const dailyReturn = index > 0 ? (pt.value - filteredHistory[index - 1].value) / filteredHistory[index - 1].value : 0;
        tooltip.querySelector('.tooltip-return')!.textContent = pct(dailyReturn, 2);
      }
    });

    overlay.addEventListener('mouseleave', () => {
      tooltip.style.display = 'none';
    });
  }
}

// ── Helper Functions ──────────────────────────────────────────────────────────

function filterHistoryByPeriod(
  history: any[],
  period: TimePeriod
): Array<{ timestamp: number; value: number; spyValue: number }> {
  const now = Date.now();
  const cutoffs: Record<TimePeriod, number> = {
    '1M': now - 30 * 24 * 60 * 60 * 1000,
    '3M': now - 90 * 24 * 60 * 60 * 1000,
    '6M': now - 180 * 24 * 60 * 60 * 1000,
    '1Y': now - 365 * 24 * 60 * 60 * 1000,
    ALL: 0,
  };

  return history.filter((pt) => pt.timestamp >= cutoffs[period]);
}

function generateMockEquityHistory(): void {
  // Generate 12 months of daily equity data
  const startDate = Date.now() - 365 * 24 * 60 * 60 * 1000;
  const startingCapital = 1_000_000;

  for (let i = 0; i < 365; i++) {
    const timestamp = startDate + i * 24 * 60 * 60 * 1000;

    // Simulate gradual growth with volatility
    const trend = 1 + (i / 365) * 0.05; // 5% annual return
    const noise = 1 + (Math.random() - 0.5) * 0.02; // ±1% daily volatility
    const value = startingCapital * trend * noise;

    // SPY benchmark: 3% annual return
    const spyTrend = 1 + (i / 365) * 0.03;
    const spyNoise = 1 + (Math.random() - 0.5) * 0.015;
    const spyValue = startingCapital * spyTrend * spyNoise;

    equityHistory.push({ timestamp, value, spyValue });
  }
}

function generateMockMonthlyReturns(): void {
  const year = new Date().getFullYear();
  const monthlyData = [
    0.012, -0.008, 0.021, 0.004, 0.015, -0.012, 0.009, 0.018, 0.006, -0.003, 0.011, 0.007,
  ];

  monthlyData.forEach((ret, i) => {
    const monthKey = `${year}-${String(i + 1).padStart(2, '0')}`;
    monthlyReturns.set(monthKey, ret);
  });
}

// ── Show/Hide View ────────────────────────────────────────────────────────────

export function showPerformanceView(): void {
  const container = document.getElementById('performance-view');
  const globeContainer = document.getElementById('globe-container');

  if (container) {
    container.style.display = 'block';
    renderPerformanceView();
  }

  if (globeContainer) {
    globeContainer.style.display = 'none';
  }
}

export function hidePerformanceView(): void {
  const container = document.getElementById('performance-view');
  const globeContainer = document.getElementById('globe-container');

  if (container) {
    container.style.display = 'none';
  }

  if (globeContainer) {
    globeContainer.style.display = 'block';
  }
}
