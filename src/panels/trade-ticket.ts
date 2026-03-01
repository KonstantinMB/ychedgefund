/**
 * Trade Ticket — Manual Paper Order Entry
 *
 * Slide-in modal that lets users place manual paper trades directly.
 * Features:
 *  - Searchable asset dropdown (40 ETFs from TRADEABLE_UNIVERSE + free-text)
 *  - Live price fetch with auto-refresh every 15 s
 *  - LONG / SHORT direction toggle
 *  - Dollar amount OR share quantity input (linked, switch between them)
 *  - NAV allocation bar (% of portfolio being committed)
 *  - Stop-loss % slider (1–25 %)
 *  - Take-profit % slider (5–50 %)
 *  - Risk/Reward ratio and max risk / potential gain display
 *  - Execute with broker-simulated latency + fill confirmation toast
 */

import { TRADEABLE_UNIVERSE } from '../trading/data/universe';
import { executionLoop } from '../trading/engine/execution-loop';
import { portfolioManager } from '../trading/engine/portfolio-manager';
import { showToast } from '../lib/toast';

// ── Helpers ───────────────────────────────────────────────────────────────────

const usd = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);

const usdP = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v);

const pct = (v: number, dp = 1) => `${v >= 0 ? '+' : ''}${(v * 100).toFixed(dp)}%`;

// ── State ─────────────────────────────────────────────────────────────────────

interface TicketState {
  symbol: string;
  name: string;
  price: number | null;
  priceChange: number;     // % change (for display only)
  direction: 'LONG' | 'SHORT';
  dollars: number;
  stopLossPct: number;
  takeProfitPct: number;
  loading: boolean;
  submitting: boolean;
}

const DEFAULT_STATE: TicketState = {
  symbol: 'SPY',
  name: 'SPDR S&P 500 ETF Trust',
  price: null,
  priceChange: 0,
  direction: 'LONG',
  dollars: 10_000,
  stopLossPct: 0.05,
  takeProfitPct: 0.15,
  loading: false,
  submitting: false,
};

// ── DOM refs (local to the open ticket) ──────────────────────────────────────

interface TicketRefs {
  overlay: HTMLElement;
  priceEl: HTMLElement;
  priceChangeEl: HTMLElement;
  dollarInput: HTMLInputElement;
  sharesEl: HTMLElement;
  navBarFill: HTMLElement;
  navPctEl: HTMLElement;
  slValueEl: HTMLElement;
  slPriceEl: HTMLElement;
  tpValueEl: HTMLElement;
  tpPriceEl: HTMLElement;
  maxRiskEl: HTMLElement;
  potentialEl: HTMLElement;
  rrEl: HTMLElement;
  executeBtn: HTMLButtonElement;
  longBtn: HTMLButtonElement;
  shortBtn: HTMLButtonElement;
  slSlider: HTMLInputElement;
  tpSlider: HTMLInputElement;
  cashAvailEl: HTMLElement;
}

// ── Build the ticket ──────────────────────────────────────────────────────────

export function openTradeTicket(prefill?: { symbol?: string; direction?: 'LONG' | 'SHORT' }): void {
  // Only one ticket at a time
  document.querySelector('.trade-ticket-overlay')?.remove();

  const state: TicketState = {
    ...DEFAULT_STATE,
    symbol: prefill?.symbol ?? DEFAULT_STATE.symbol,
    direction: prefill?.direction ?? DEFAULT_STATE.direction,
  };

  // Update name from universe if known
  const knownAsset = TRADEABLE_UNIVERSE.find(a => a.symbol === state.symbol);
  if (knownAsset) state.name = knownAsset.name;

  const overlay = document.createElement('div');
  overlay.className = 'trade-ticket-overlay';

  const card = document.createElement('div');
  card.className = 'trade-ticket-card';
  card.innerHTML = buildCardHTML(state);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // Gather refs
  const refs: TicketRefs = {
    overlay,
    priceEl: card.querySelector('#tt-price')!,
    priceChangeEl: card.querySelector('#tt-price-change')!,
    dollarInput: card.querySelector<HTMLInputElement>('#tt-dollars')!,
    sharesEl: card.querySelector('#tt-shares')!,
    navBarFill: card.querySelector<HTMLElement>('#tt-nav-fill')!,
    navPctEl: card.querySelector('#tt-nav-pct')!,
    slValueEl: card.querySelector('#tt-sl-value')!,
    slPriceEl: card.querySelector('#tt-sl-price')!,
    tpValueEl: card.querySelector('#tt-tp-value')!,
    tpPriceEl: card.querySelector('#tt-tp-price')!,
    maxRiskEl: card.querySelector('#tt-max-risk')!,
    potentialEl: card.querySelector('#tt-potential')!,
    rrEl: card.querySelector('#tt-rr')!,
    executeBtn: card.querySelector<HTMLButtonElement>('#tt-execute')!,
    longBtn: card.querySelector<HTMLButtonElement>('#tt-long-btn')!,
    shortBtn: card.querySelector<HTMLButtonElement>('#tt-short-btn')!,
    slSlider: card.querySelector<HTMLInputElement>('#tt-sl-slider')!,
    tpSlider: card.querySelector<HTMLInputElement>('#tt-tp-slider')!,
    cashAvailEl: card.querySelector('#tt-cash-avail')!,
  };

  // ── Recalculate and redraw numbers ─────────────────────────────────────────
  function recalc(): void {
    const price = state.price;
    const snap = portfolioManager.getSnapshot();
    const cash = snap.cash;
    const nav  = snap.totalValue || 1;

    // Cash
    refs.cashAvailEl.textContent = usd(cash);

    if (price && price > 0) {
      refs.priceEl.textContent = usdP(price);

      const shares = Math.floor(state.dollars / price);
      refs.sharesEl.textContent = `${shares.toLocaleString()} shares`;

      // NAV allocation
      const navPct = Math.min(state.dollars / nav, 1);
      refs.navBarFill.style.width = `${(navPct * 100).toFixed(1)}%`;
      refs.navBarFill.className = `tt-nav-fill${navPct > 0.1 ? ' warn' : ''}`;
      refs.navPctEl.textContent = `${(navPct * 100).toFixed(1)}% NAV`;

      // SL/TP prices
      const slMult = state.direction === 'LONG'
        ? (1 - state.stopLossPct)
        : (1 + state.stopLossPct);
      const tpMult = state.direction === 'LONG'
        ? (1 + state.takeProfitPct)
        : (1 - state.takeProfitPct);
      const slPrice = price * slMult;
      const tpPrice = price * tpMult;

      refs.slValueEl.textContent = `-${(state.stopLossPct * 100).toFixed(1)}%`;
      refs.slPriceEl.textContent = usdP(slPrice);
      refs.tpValueEl.textContent = `+${(state.takeProfitPct * 100).toFixed(1)}%`;
      refs.tpPriceEl.textContent = usdP(tpPrice);

      // Risk/Reward
      const invested = state.dollars;
      const maxRisk  = invested * state.stopLossPct;
      const maxGain  = invested * state.takeProfitPct;
      const rr       = maxRisk > 0 ? (maxGain / maxRisk) : 0;

      refs.maxRiskEl.textContent  = `-${usd(maxRisk)}`;
      refs.potentialEl.textContent = `+${usd(maxGain)}`;
      refs.rrEl.textContent = `1 : ${rr.toFixed(1)}`;
      refs.rrEl.className   = `tt-rr-val${rr >= 2 ? ' good' : rr >= 1 ? ' ok' : ' bad'}`;

      // Execute button label
      const label = state.direction === 'LONG' ? '▲ BUY LONG' : '▼ SELL SHORT';
      refs.executeBtn.textContent = `${label}  ${usd(state.dollars)}`;
      refs.executeBtn.disabled    = state.submitting || state.dollars < 100 || state.dollars > cash;
    } else {
      refs.priceEl.textContent    = 'Loading…';
      refs.sharesEl.textContent   = '—';
      refs.executeBtn.disabled    = true;
    }

    // Direction button classes
    refs.longBtn.classList.toggle('active', state.direction === 'LONG');
    refs.shortBtn.classList.toggle('active', state.direction === 'SHORT');
    refs.executeBtn.className = `tt-execute-btn ${state.direction === 'LONG' ? 'long' : 'short'}`;
    if (state.submitting) {
      refs.executeBtn.textContent = 'Executing…';
      refs.executeBtn.disabled    = true;
    }
  }

  // ── Price fetching ─────────────────────────────────────────────────────────
  let priceRefreshTimer: ReturnType<typeof setInterval> | null = null;

  async function loadPrice(symbol: string): Promise<void> {
    state.loading = true;
    refs.priceEl.textContent = 'Fetching…';
    refs.priceChangeEl.textContent = '';

    // Try priceCache first (instant)
    const cached = executionLoop.getPrice(symbol);
    if (cached) {
      state.price = cached;
      state.loading = false;
      recalc();
      return;
    }

    // Fetch from Yahoo
    const price = await executionLoop.fetchPrice(symbol);
    state.loading = false;
    if (price) {
      state.price = price;
    } else {
      state.price = null;
      refs.priceEl.textContent = 'Price unavailable';
    }
    recalc();
  }

  function startPriceRefresh(symbol: string): void {
    if (priceRefreshTimer) clearInterval(priceRefreshTimer);
    void loadPrice(symbol);
    priceRefreshTimer = setInterval(() => void loadPrice(symbol), 15_000);
  }

  // ── Ticker search ──────────────────────────────────────────────────────────
  const searchInput = card.querySelector<HTMLInputElement>('#tt-search')!;
  const dropdown    = card.querySelector<HTMLElement>('#tt-dropdown')!;

  function renderDropdown(query: string): void {
    const q = query.toUpperCase().trim();
    const matches = q.length === 0
      ? TRADEABLE_UNIVERSE
      : TRADEABLE_UNIVERSE.filter(a =>
          a.symbol.includes(q) || a.name.toUpperCase().includes(q) || a.sector.toUpperCase().includes(q)
        );

    dropdown.innerHTML = '';
    if (matches.length === 0) {
      // Allow custom ticker
      const item = document.createElement('div');
      item.className = 'tt-dropdown-item tt-custom';
      item.textContent = `Use "${q}" (custom ticker)`;
      item.addEventListener('click', () => selectSymbol(q, q, true));
      dropdown.appendChild(item);
    } else {
      for (const asset of matches.slice(0, 12)) {
        const item = document.createElement('div');
        item.className = 'tt-dropdown-item';
        item.innerHTML = `
          <span class="tt-dd-symbol">${asset.symbol}</span>
          <span class="tt-dd-name">${asset.name}</span>
          <span class="tt-dd-sector">${asset.sector}</span>
        `;
        item.addEventListener('click', () => selectSymbol(asset.symbol, asset.name, false));
        dropdown.appendChild(item);
      }
    }
    dropdown.classList.add('open');
  }

  function selectSymbol(symbol: string, name: string, _custom: boolean): void {
    state.symbol = symbol;
    state.name   = name;
    state.price  = null;
    searchInput.value = symbol;
    card.querySelector<HTMLElement>('#tt-asset-name')!.textContent = name;
    dropdown.classList.remove('open');
    startPriceRefresh(symbol);
  }

  searchInput.addEventListener('input', () => renderDropdown(searchInput.value));
  searchInput.addEventListener('focus', () => renderDropdown(searchInput.value));
  document.addEventListener('click', (e) => {
    if (!card.querySelector('.tt-search-wrap')?.contains(e.target as Node)) {
      dropdown.classList.remove('open');
    }
  });

  // ── Direction toggle ───────────────────────────────────────────────────────
  refs.longBtn.addEventListener('click', () => {
    state.direction = 'LONG';
    recalc();
  });
  refs.shortBtn.addEventListener('click', () => {
    state.direction = 'SHORT';
    recalc();
  });

  // ── Dollar input ───────────────────────────────────────────────────────────
  refs.dollarInput.addEventListener('input', () => {
    const v = parseFloat(refs.dollarInput.value.replace(/[^0-9.]/g, ''));
    state.dollars = isNaN(v) ? 0 : v;
    recalc();
  });

  // Quick-pick % buttons
  card.querySelectorAll<HTMLButtonElement>('.tt-pct-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const pctVal = parseFloat(btn.dataset['pct'] ?? '0.05');
      const nav = portfolioManager.getSnapshot().totalValue;
      state.dollars = Math.floor(nav * pctVal / 100) * 100; // round to $100
      refs.dollarInput.value = state.dollars.toFixed(0);
      recalc();
    });
  });

  // ── Stop-loss slider ───────────────────────────────────────────────────────
  refs.slSlider.addEventListener('input', () => {
    state.stopLossPct = parseFloat(refs.slSlider.value) / 100;
    recalc();
  });

  // ── Take-profit slider ─────────────────────────────────────────────────────
  refs.tpSlider.addEventListener('input', () => {
    state.takeProfitPct = parseFloat(refs.tpSlider.value) / 100;
    recalc();
  });

  // ── Execute ────────────────────────────────────────────────────────────────
  refs.executeBtn.addEventListener('click', async () => {
    if (state.submitting || !state.price) return;

    state.submitting = true;
    recalc();

    const result = await executionLoop.placeManualOrder({
      symbol: state.symbol,
      direction: state.direction,
      dollars: state.dollars,
      stopLossPct: state.stopLossPct,
      takeProfitPct: state.takeProfitPct,
      currentPrice: state.price,
    });

    state.submitting = false;

    if (result.ok && result.fill) {
      const qty = result.fill.fillQuantity;
      const fillPx = result.fill.fillPrice;
      showToast(
        `✓ ${state.direction} ${state.symbol}  ${qty} shares @ ${usdP(fillPx)}`,
        'success'
      );
      closeTicket();
    } else {
      showToast(`✗ ${result.reason ?? 'Order rejected'}`, 'error');
      recalc(); // re-enable button
    }
  });

  // ── Close ──────────────────────────────────────────────────────────────────
  function closeTicket(): void {
    if (priceRefreshTimer) clearInterval(priceRefreshTimer);
    overlay.classList.add('closing');
    setTimeout(() => overlay.remove(), 200);
  }

  card.querySelector('#tt-close')?.addEventListener('click', closeTicket);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeTicket();
  });
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      closeTicket();
      document.removeEventListener('keydown', onKey);
    }
  });

  // ── Boot ───────────────────────────────────────────────────────────────────
  startPriceRefresh(state.symbol);
  recalc();

  // Animate in
  requestAnimationFrame(() => overlay.classList.add('open'));
}

// ── Card HTML template ────────────────────────────────────────────────────────

function buildCardHTML(state: TicketState): string {
  return `
    <div class="tt-header">
      <div class="tt-title">
        <span class="tt-title-icon">📋</span>
        <span>Place Manual Trade</span>
      </div>
      <button class="tt-close-btn" id="tt-close" aria-label="Close">✕</button>
    </div>

    <!-- Asset selector -->
    <div class="tt-section tt-asset-section">
      <div class="tt-search-wrap">
        <input
          id="tt-search"
          class="tt-search-input"
          type="text"
          value="${state.symbol}"
          placeholder="Search ticker or name…"
          autocomplete="off"
          spellcheck="false"
        />
        <div id="tt-dropdown" class="tt-dropdown"></div>
      </div>
      <div class="tt-asset-meta">
        <span class="tt-asset-name" id="tt-asset-name">${state.name}</span>
        <span class="tt-price-wrap">
          <span class="tt-price" id="tt-price">—</span>
          <span class="tt-price-change" id="tt-price-change"></span>
        </span>
      </div>
    </div>

    <!-- Direction -->
    <div class="tt-section tt-direction-section">
      <div class="tt-label">Direction</div>
      <div class="tt-dir-buttons">
        <button id="tt-long-btn"  class="tt-dir-btn long  active">▲ LONG</button>
        <button id="tt-short-btn" class="tt-dir-btn short">▼ SHORT</button>
      </div>
    </div>

    <!-- Amount -->
    <div class="tt-section">
      <div class="tt-label-row">
        <span class="tt-label">Invest</span>
        <span class="tt-cash-avail">Available: <span id="tt-cash-avail">—</span></span>
      </div>
      <div class="tt-amount-row">
        <span class="tt-dollar-sign">$</span>
        <input id="tt-dollars" class="tt-dollar-input" type="number" min="100" step="100"
          value="${state.dollars}" placeholder="10000"/>
        <span class="tt-shares-lbl" id="tt-shares">— shares</span>
      </div>
      <div class="tt-pct-btns">
        <button class="tt-pct-btn" data-pct="1">1%</button>
        <button class="tt-pct-btn" data-pct="2">2%</button>
        <button class="tt-pct-btn" data-pct="5">5%</button>
        <button class="tt-pct-btn" data-pct="10">10%</button>
      </div>
      <div class="tt-nav-bar-wrap">
        <div class="tt-nav-bar-outer">
          <div class="tt-nav-fill" id="tt-nav-fill" style="width:1%"></div>
        </div>
        <span class="tt-nav-pct" id="tt-nav-pct">~1% NAV</span>
      </div>
    </div>

    <!-- Stop-Loss -->
    <div class="tt-section tt-sl-tp-section">
      <div class="tt-slider-row">
        <div class="tt-slider-label">
          <span>Stop-Loss</span>
          <span class="tt-sl-value" id="tt-sl-value">-${(state.stopLossPct * 100).toFixed(1)}%</span>
        </div>
        <input id="tt-sl-slider" class="tt-slider sl" type="range"
          min="1" max="25" step="0.5" value="${(state.stopLossPct * 100)}"/>
        <div class="tt-slider-sublabel">
          <span>Trigger at</span>
          <span id="tt-sl-price">—</span>
        </div>
      </div>

      <div class="tt-slider-row">
        <div class="tt-slider-label">
          <span>Take-Profit</span>
          <span class="tt-tp-value" id="tt-tp-value">+${(state.takeProfitPct * 100).toFixed(1)}%</span>
        </div>
        <input id="tt-tp-slider" class="tt-slider tp" type="range"
          min="5" max="50" step="0.5" value="${(state.takeProfitPct * 100)}"/>
        <div class="tt-slider-sublabel">
          <span>Target at</span>
          <span id="tt-tp-price">—</span>
        </div>
      </div>
    </div>

    <!-- Risk/Reward summary -->
    <div class="tt-section tt-rr-section">
      <div class="tt-rr-grid">
        <div class="tt-rr-cell loss">
          <div class="tt-rr-cell-label">Max Risk</div>
          <div class="tt-rr-cell-val" id="tt-max-risk">—</div>
        </div>
        <div class="tt-rr-cell rr">
          <div class="tt-rr-cell-label">Risk / Reward</div>
          <div class="tt-rr-val" id="tt-rr">—</div>
        </div>
        <div class="tt-rr-cell profit">
          <div class="tt-rr-cell-label">Potential</div>
          <div class="tt-rr-cell-val" id="tt-potential">—</div>
        </div>
      </div>
    </div>

    <!-- Execute -->
    <div class="tt-footer">
      <button class="tt-execute-btn long" id="tt-execute" disabled>
        ▲ BUY LONG  $10,000
      </button>
      <div class="tt-disclaimer">
        Paper money only · 5 bps simulated slippage · Stops auto-managed
      </div>
    </div>
  `;
}
