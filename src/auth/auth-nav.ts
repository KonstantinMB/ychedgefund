/**
 * Auth Nav — Top bar auth controls
 *
 * NOT LOGGED IN: [Sign In] [Register]
 * LOGGED IN: ● username [▼] with dropdown
 *
 * Session indicator: green dot (healthy), amber dot (<1 day) with tooltip
 * Dropdown: My Portfolio, Trade History, Export Data, Reset Portfolio, Sign Out
 */

import { auth } from './auth-manager';
import { openAuthModal } from './auth-modal';
import type { User } from './auth-manager';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_EXPIRY_WARN_MS = ONE_DAY_MS;

let sessionExpiresAt: number | null = null;
let dropdownEl: HTMLElement | null = null;
let authContainerEl: HTMLElement | null = null;

export function initAuthNav(container: HTMLElement): void {
  authContainerEl = document.createElement('div');
  authContainerEl.className = 'auth-nav-container';
  container.appendChild(authContainerEl);

  render();
  window.addEventListener('auth:authenticated', () => render());
  window.addEventListener('auth:user', () => render());

  // Close dropdown on outside click
  document.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (dropdownEl && !authContainerEl?.contains(target) && !dropdownEl.contains(target)) {
      closeDropdown();
    }
  });
}

function render(): void {
  if (!authContainerEl) return;
  authContainerEl.innerHTML = '';

  if (auth.isAuthenticated()) {
    renderLoggedIn();
  } else {
    renderLoggedOut();
  }
}

function renderLoggedOut(): void {
  if (!authContainerEl) return;

  const signInBtn = document.createElement('button');
  signInBtn.className = 'auth-nav-btn auth-nav-signin';
  signInBtn.textContent = 'Sign In';
  signInBtn.addEventListener('click', () => openAuthModal());

  const registerBtn = document.createElement('button');
  registerBtn.className = 'auth-nav-btn auth-nav-register';
  registerBtn.textContent = 'Register';
  registerBtn.addEventListener('click', () => openAuthModal({ tab: 'register' }));

  authContainerEl.appendChild(signInBtn);
  authContainerEl.appendChild(registerBtn);
}

function renderLoggedIn(): void {
  if (!authContainerEl) return;
  const user = auth.getUser();
  if (!user) return;

  void fetchSessionExpiry();

  const wrap = document.createElement('div');
  wrap.className = 'auth-nav-user-wrap';

  const dot = document.createElement('span');
  dot.className = 'auth-nav-dot auth-nav-dot-green';
  dot.setAttribute('aria-hidden', 'true');
  updateSessionDot(dot);

  const label = document.createElement('span');
  label.className = 'auth-nav-username';
  label.textContent = user.username;

  const chevron = document.createElement('button');
  chevron.className = 'auth-nav-chevron';
  chevron.setAttribute('aria-label', 'Open menu');
  chevron.textContent = '▼';
  chevron.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown(user, wrap);
  });

  wrap.appendChild(dot);
  wrap.appendChild(label);
  wrap.appendChild(chevron);
  authContainerEl.appendChild(wrap);
}

async function fetchSessionExpiry(): Promise<void> {
  const token = auth.getToken();
  if (!token) return;
  try {
    const res = await fetch('/api/auth/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = (await res.json()) as { expiresAt?: number };
      sessionExpiresAt = data.expiresAt ?? null;
      // Update dot if already rendered
      const dot = authContainerEl?.querySelector('.auth-nav-dot');
      if (dot instanceof HTMLElement) updateSessionDot(dot);
    }
  } catch {
    // Ignore
  }
}

function updateSessionDot(dot: HTMLElement): void {
  const expiresAt = sessionExpiresAt;
  if (!expiresAt) {
    dot.className = 'auth-nav-dot auth-nav-dot-green';
    dot.title = '';
    return;
  }
  const remaining = expiresAt - Date.now();
  if (remaining < SESSION_EXPIRY_WARN_MS) {
    dot.className = 'auth-nav-dot auth-nav-dot-amber';
    dot.title = 'Session expires soon. Activity will auto-renew.';
  } else {
    dot.className = 'auth-nav-dot auth-nav-dot-green';
    dot.title = '';
  }
}

function toggleDropdown(user: User, anchor: HTMLElement): void {
  if (dropdownEl) {
    closeDropdown();
    return;
  }

  dropdownEl = document.createElement('div');
  dropdownEl.className = 'auth-nav-dropdown';

  dropdownEl.innerHTML = `
    <div class="auth-nav-dropdown-header">
      <span class="auth-nav-dropdown-dot">●</span>
      <span class="auth-nav-dropdown-username">${escapeHtml(user.username)}</span>
    </div>
    <div class="auth-nav-dropdown-email">${escapeHtml(user.email)}</div>
    <div class="auth-nav-dropdown-divider"></div>
    <button class="auth-nav-dropdown-item" data-action="portfolio">My Portfolio</button>
    <button class="auth-nav-dropdown-item" data-action="trades">Trade History</button>
    <button class="auth-nav-dropdown-item" data-action="export">Export Data</button>
    <div class="auth-nav-dropdown-divider"></div>
    <button class="auth-nav-dropdown-item" data-action="reset">Reset Portfolio</button>
    <div class="auth-nav-dropdown-divider"></div>
    <button class="auth-nav-dropdown-item auth-nav-dropdown-signout" data-action="logout">Sign Out</button>
  `;

  dropdownEl.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const action = (btn as HTMLElement).dataset.action;
      handleDropdownAction(action ?? '');
      closeDropdown();
    });
  });

  document.body.appendChild(dropdownEl);
  positionDropdown(anchor);
}

function positionDropdown(anchor: HTMLElement): void {
  if (!dropdownEl) return;
  const rect = anchor.getBoundingClientRect();
  dropdownEl.style.position = 'fixed';
  dropdownEl.style.top = `${rect.bottom + 4}px`;
  dropdownEl.style.right = `${window.innerWidth - rect.right}px`;
  dropdownEl.style.minWidth = `${Math.max(rect.width, 180)}px`;
}

function closeDropdown(): void {
  dropdownEl?.remove();
  dropdownEl = null;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

async function handleDropdownAction(action: string): Promise<void> {
  switch (action) {
    case 'portfolio': {
      const leftPanel = document.getElementById('left-panel');
      if (leftPanel) leftPanel.style.opacity = '1';
      const { forceExpand } = await import('../panels/panel-manager');
      forceExpand('portfolio');
      const panel = document.querySelector('[data-panel-id="portfolio"]');
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;
    }
    case 'trades': {
      const leftPanel = document.getElementById('left-panel');
      if (leftPanel) leftPanel.style.opacity = '1';
      const { forceExpand } = await import('../panels/panel-manager');
      forceExpand('performance');
      const panel = document.querySelector('[data-panel-id="performance"]');
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      break;
    }
    case 'export': {
      const { portfolioManager } = await import('../trading/engine/portfolio-manager');
      const snap = portfolioManager.getSnapshot();
      const trades = [...snap.closedTrades].sort((a, b) => a.closedAt - b.closedAt);
      if (trades.length === 0) {
        const { showToast } = await import('../lib/toast');
        showToast('No trades to export');
        return;
      }
      const headers = ['Symbol', 'Direction', 'Strategy', 'Opened', 'Closed', 'Qty', 'Entry', 'Exit', 'P&L', 'P&L%', 'Reason'];
      const rows = trades.map(t => [
        t.symbol, t.direction, t.strategy,
        new Date(t.openedAt).toISOString(),
        new Date(t.closedAt).toISOString(),
        t.quantity, t.avgEntryPrice.toFixed(2), t.avgExitPrice.toFixed(2),
        t.realizedPnl.toFixed(2), (t.realizedPnlPct * 100).toFixed(2) + '%',
        t.closeReason,
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `yc-hedge-fund-trades-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      const { showToast } = await import('../lib/toast');
      showToast(`Exported ${trades.length} trades`);
      break;
    }
    case 'reset': {
      if (!confirm('Reset portfolio to $1,000,000? All positions and trades will be lost.')) return;
      const { auth } = await import('./auth-manager');
      const { resetPortfolioOnServer } = await import('../trading/engine/server-sync');
      const { tradingEngine } = await import('../trading/engine');
      const { portfolioManager } = await import('../trading/engine/portfolio-manager');
      const { showToast } = await import('../lib/toast');
      if (auth.isAuthenticated()) {
        const ok = await resetPortfolioOnServer();
        if (ok) {
          tradingEngine.resetPortfolio();
          showToast('Portfolio reset to $1,000,000');
        } else {
          showToast('Reset failed. Try again.');
        }
      } else {
        tradingEngine.resetPortfolio();
        portfolioManager.reset();
        showToast('Portfolio reset to $1,000,000');
      }
      break;
    }
    case 'logout': {
      await auth.logout();
      sessionExpiresAt = null;
      sessionStorage.removeItem('atlas:local-only');
      const { forceExpand } = await import('../panels/panel-manager');
      forceExpand('strategic-risk');
      const rightPanel = document.getElementById('right-panel');
      const leftPanel = document.getElementById('left-panel');
      rightPanel?.querySelector('.panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (leftPanel) leftPanel.style.opacity = '0.6';
      const { showToast } = await import('../lib/toast');
      showToast('Signed out');
      break;
    }
  }
}

/**
 * Open auth modal with optional subtitle (e.g. for Trading tab prompt).
 */
export function openAuthModalWithMessage(message: string): void {
  openAuthModal({ subtitle: message });
}
