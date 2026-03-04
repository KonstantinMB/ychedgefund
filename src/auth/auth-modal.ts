/**
 * Auth Modal — Login / Register
 *
 * Terminal aesthetic overlay. Appears when user clicks "Start Paper Trading"
 * or "My Portfolio". Dark, monospace, minimal.
 */

import { auth } from './auth-manager';

/**
 * Gate for trading actions. If not authenticated, shows auth modal.
 * Otherwise runs the action.
 */
export function requireAuthForTrading(action: () => void): void {
  if (auth.isAuthenticated()) {
    action();
  } else {
    openAuthModal();
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

type Tab = 'login' | 'register';

let overlayEl: HTMLElement | null = null;
let activeTab: Tab = 'login';

export interface AuthModalOptions {
  tab?: 'login' | 'register';
  subtitle?: string;
}

export function openAuthModal(options?: AuthModalOptions): void {
  if (document.querySelector('.auth-overlay')) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'auth-overlay';

  const modal = document.createElement('div');
  modal.className = 'auth-modal';

  modal.innerHTML = `
    <div class="auth-header">
      <div class="auth-logo">
        <img src="/icon-192.png" alt="YC Hedge Fund" width="28" height="28" />
        <span>YC Hedge Fund</span>
      </div>
      <button class="auth-close" type="button" aria-label="Close">✕</button>
    </div>
    <div class="auth-title-wrap">
      <h2 class="auth-title">SECURE ACCESS</h2>
      <div class="auth-subtitle"></div>
    </div>
    <div class="auth-tabs">
      <button class="auth-tab active" data-tab="login">LOGIN</button>
      <button class="auth-tab" data-tab="register">REGISTER</button>
    </div>
    <form class="auth-form" id="auth-form">
      <div id="auth-fields"></div>
      <button type="submit" class="auth-submit" id="auth-submit">▶ AUTHENTICATE</button>
      <div class="auth-error" id="auth-error"></div>
      <div class="auth-success" id="auth-success" style="display:none"></div>
      <label class="auth-remember" id="auth-remember-wrap" style="display:none">
        <input type="checkbox" id="auth-remember" checked>
        <span>Remember me</span>
      </label>
      <div class="auth-footer" id="auth-footer"></div>
    </div>
  `;

  overlayEl.appendChild(modal);
  document.body.appendChild(overlayEl);

  if (options?.tab) activeTab = options.tab;
  if (options?.subtitle) {
    const sub = modal.querySelector('.auth-subtitle') as HTMLElement;
    if (sub) {
      sub.textContent = options.subtitle;
      sub.style.display = 'block';
    }
  }
  if (options?.tab) {
    modal.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    const tabBtn = modal.querySelector(`[data-tab="${options.tab}"]`);
    if (tabBtn) tabBtn.classList.add('active');
  }
  renderFields(activeTab);
  updateFooter(activeTab);
  if (options?.subtitle?.includes('local-only')) {
    const footer = modal.querySelector('#auth-footer');
    if (footer) {
      const localLink = document.createElement('a');
      localLink.href = '#';
      localLink.id = 'auth-local-only-link';
      localLink.textContent = 'Continue in local-only mode';
      localLink.style.display = 'block';
      localLink.style.marginTop = '0.5rem';
      localLink.style.fontSize = '0.7rem';
      localLink.style.color = 'var(--text-muted)';
      localLink.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.setItem('atlas:local-only', '1');
        closeModal();
        import('../panels/panel-manager').then(({ forceExpand }) => forceExpand('portfolio'));
        document.querySelector('[data-panel-id="portfolio"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      footer.appendChild(localLink);
    }
  }

  // Tab clicks
  modal.querySelectorAll('.auth-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = (btn as HTMLElement).dataset.tab as Tab;
      modal.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      btn.classList.add('active');
      renderFields(activeTab);
      updateFooter(activeTab);
      clearError();
    });
  });

  // Close button
  modal.querySelector('.auth-close')!.addEventListener('click', closeModal);

  // Escape key
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', onKey);
    }
  };
  document.addEventListener('keydown', onKey);

  // Form submit
  modal.querySelector('#auth-form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    void handleSubmit();
  });

  // Click outside to close
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closeModal();
  });
}

function closeModal(): void {
  overlayEl?.remove();
  overlayEl = null;
}

function clearError(): void {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = '';
    el.className = 'auth-error';
  }
}

function setError(msg: string): void {
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent = msg;
    el.className = 'auth-error typewriter';
    el.style.animation = 'none';
    void el.offsetWidth; // reflow
    el.style.animation = 'auth-typewriter 0.03s steps(' + msg.length + ') forwards';
  }
}

function setSuccess(msg: string): void {
  const el = document.getElementById('auth-success');
  if (el) {
    el.textContent = msg;
    el.style.display = 'block';
    document.getElementById('auth-error')!.textContent = '';
  }
}

function renderFields(tab: Tab): void {
  const container = document.getElementById('auth-fields');
  if (!container) return;

  const rememberWrap = document.getElementById('auth-remember-wrap');
  const submitBtn = document.getElementById('auth-submit') as HTMLButtonElement;

  if (tab === 'login') {
    container.innerHTML = `
      <div class="auth-field">
        <label class="auth-label">> USERNAME / EMAIL</label>
        <div class="auth-input-wrap">
          <input type="text" class="auth-input" id="auth-login" placeholder="trader1 or user@example.com" autocomplete="username">
        </div>
      </div>
      <div class="auth-field">
        <label class="auth-label">> PASSWORD</label>
        <div class="auth-input-wrap">
          <input type="password" class="auth-input" id="auth-password" placeholder="••••••••" autocomplete="current-password">
        </div>
      </div>
    `;
    if (rememberWrap) rememberWrap.style.display = 'flex';
    if (submitBtn) submitBtn.textContent = '▶ AUTHENTICATE';
  } else {
    container.innerHTML = `
      <div class="auth-field">
        <label class="auth-label">> EMAIL</label>
        <div class="auth-input-wrap">
          <input type="email" class="auth-input" id="auth-email" placeholder="user@example.com" autocomplete="email">
        </div>
      </div>
      <div class="auth-field">
        <label class="auth-label">> USERNAME</label>
        <div class="auth-input-wrap">
          <input type="text" class="auth-input" id="auth-username" placeholder="trader1" autocomplete="username">
        </div>
      </div>
      <div class="auth-field">
        <label class="auth-label">> PASSWORD</label>
        <div class="auth-input-wrap">
          <input type="password" class="auth-input" id="auth-password" placeholder="min 8 characters" autocomplete="new-password">
        </div>
        <div class="auth-strength-bar"><div class="auth-strength-fill" id="auth-strength-fill"></div></div>
        <div class="auth-strength-label" id="auth-strength-label"></div>
      </div>
      <div class="auth-field">
        <label class="auth-label">> CONFIRM</label>
        <div class="auth-input-wrap">
          <input type="password" class="auth-input" id="auth-confirm" placeholder="••••••••" autocomplete="new-password">
        </div>
      </div>
    `;
    if (rememberWrap) rememberWrap.style.display = 'flex';
    if (submitBtn) submitBtn.textContent = '▶ CREATE ACCOUNT';

    // Password strength + confirm validation
    const pw = document.getElementById('auth-password');
    const conf = document.getElementById('auth-confirm');
    const updateStrength = () => {
      const val = (pw as HTMLInputElement).value;
      const { label, cls } = getPasswordStrength(val);
      const fill = document.getElementById('auth-strength-fill');
      const lbl = document.getElementById('auth-strength-label');
      if (fill) fill.className = `auth-strength-fill ${cls}`;
      if (lbl) lbl.textContent = label;
    };
    const updateConfirm = () => {
      const confWrap = (conf as HTMLInputElement).closest('.auth-field');
      const pv = (pw as HTMLInputElement).value;
      const cv = (conf as HTMLInputElement).value;
      if (cv.length === 0) return;
      confWrap?.classList.toggle('auth-confirm-mismatch', pv !== cv);
    };
    pw?.addEventListener('input', updateStrength);
    pw?.addEventListener('blur', updateStrength);
    conf?.addEventListener('input', updateConfirm);
    conf?.addEventListener('blur', updateConfirm);
  }

  // Username validation (register)
  if (tab === 'register') {
    const un = document.getElementById('auth-username');
    un?.addEventListener('input', () => {
      const val = (un as HTMLInputElement).value.toLowerCase().replace(/[^a-z0-9_]/g, '');
      (un as HTMLInputElement).value = val;
    });
    un?.addEventListener('blur', () => {
      const val = (un as HTMLInputElement).value;
      const wrap = un.closest('.auth-field');
      wrap?.classList.toggle('auth-valid', val.length >= 3 && USERNAME_REGEX.test(val));
    });
  }

  // Email validation (register)
  if (tab === 'register') {
    const em = document.getElementById('auth-email');
    em?.addEventListener('blur', () => {
      const val = (em as HTMLInputElement).value.trim().toLowerCase();
      const wrap = em.closest('.auth-field');
      wrap?.classList.toggle('auth-valid', EMAIL_REGEX.test(val));
    });
  }

  document.getElementById('auth-success')!.style.display = 'none';
}

function getPasswordStrength(pw: string): { label: string; cls: string } {
  if (pw.length < 6) return { label: '', cls: 'weak' };
  const hasLower = /[a-z]/.test(pw);
  const hasUpper = /[A-Z]/.test(pw);
  const hasDigit = /\d/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  const score = (hasLower ? 1 : 0) + (hasUpper ? 1 : 0) + (hasDigit ? 1 : 0) + (hasSpecial ? 1 : 0) + (pw.length >= 10 ? 1 : 0);
  if (score >= 4 && pw.length >= 8) return { label: 'Strong', cls: 'strong' };
  if (score >= 2 && pw.length >= 6) return { label: 'Medium', cls: 'medium' };
  return { label: 'Weak', cls: 'weak' };
}

function updateFooter(tab: Tab): void {
  const footer = document.getElementById('auth-footer');
  if (!footer) return;
  if (tab === 'login') {
    footer.innerHTML = 'No account? <a href="#" id="auth-switch-register">Register</a>';
    footer.querySelector('#auth-switch-register')?.addEventListener('click', (e) => {
      e.preventDefault();
      activeTab = 'register';
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      (document.querySelector('[data-tab="register"]') as HTMLElement)?.classList.add('active');
      renderFields('register');
      updateFooter('register');
      clearError();
    });
  } else {
    footer.innerHTML = 'Have an account? <a href="#" id="auth-switch-login">Login</a>';
    footer.querySelector('#auth-switch-login')?.addEventListener('click', (e) => {
      e.preventDefault();
      activeTab = 'login';
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      (document.querySelector('[data-tab="login"]') as HTMLElement)?.classList.add('active');
      renderFields('login');
      updateFooter('login');
      clearError();
    });
  }
}

async function handleSubmit(): Promise<void> {
  const submitBtn = document.getElementById('auth-submit') as HTMLButtonElement;
  const remember = (document.getElementById('auth-remember') as HTMLInputElement)?.checked ?? true;

  clearError();
  document.getElementById('auth-success')!.style.display = 'none';

  if (activeTab === 'login') {
    const login = (document.getElementById('auth-login') as HTMLInputElement)?.value.trim() ?? '';
    const password = (document.getElementById('auth-password') as HTMLInputElement)?.value ?? '';

    if (!login || !password) {
      setError('Enter username/email and password');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'AUTHENTICATING<span class="auth-loading-dots"></span>';
    const result = await auth.login(login, password, remember);
    submitBtn.disabled = false;
    submitBtn.textContent = '▶ AUTHENTICATE';

    if (result.success) {
      setSuccess('ACCESS GRANTED');
      setTimeout(closeModal, 800);
    } else {
      setError(result.error ?? 'Invalid credentials');
    }
  } else {
    const email = (document.getElementById('auth-email') as HTMLInputElement)?.value.trim().toLowerCase() ?? '';
    const username = (document.getElementById('auth-username') as HTMLInputElement)?.value.trim().toLowerCase() ?? '';
    const password = (document.getElementById('auth-password') as HTMLInputElement)?.value ?? '';
    const confirm = (document.getElementById('auth-confirm') as HTMLInputElement)?.value ?? '';

    if (!EMAIL_REGEX.test(email)) {
      setError('Invalid email format');
      return;
    }
    if (!USERNAME_REGEX.test(username)) {
      setError('Username: 3-20 chars, alphanumeric + underscores only');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = 'CREATING<span class="auth-loading-dots"></span>';
    const result = await auth.register(email, username, password, remember);
    submitBtn.disabled = false;
    submitBtn.textContent = '▶ CREATE ACCOUNT';

    if (result.success) {
      setSuccess('ACCESS GRANTED');
      setTimeout(closeModal, 800);
    } else {
      setError(result.error ?? 'Registration failed');
    }
  }
}
