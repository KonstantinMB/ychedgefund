/**
 * Profile Modal — View and edit user profile
 *
 * Displays username, email, and display name (editable).
 * Display name is shown on the leaderboard when set.
 */

import { auth } from './auth-manager';
import type { User } from './auth-manager';

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 30;

let overlayEl: HTMLElement | null = null;

function closeModal(): void {
  overlayEl?.remove();
  overlayEl = null;
}

function escapeHtml(s: string): string {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

export function openProfileModal(): void {
  if (document.querySelector('.profile-overlay')) return;

  const user = auth.getUser();
  if (!user) return;

  overlayEl = document.createElement('div');
  overlayEl.className = 'profile-overlay auth-overlay';

  const modal = document.createElement('div');
  modal.className = 'auth-modal profile-modal';

  modal.innerHTML = `
    <div class="auth-header">
      <div class="auth-logo">
        <img src="/icon-192.png" alt="YC Hedge Fund" width="28" height="28" />
        <span>YC Hedge Fund</span>
      </div>
      <button class="auth-close" type="button" aria-label="Close">✕</button>
    </div>
    <div class="auth-title-wrap">
      <h2 class="auth-title">YOUR PROFILE</h2>
      <p class="profile-subtitle">Your profile is shown across the app and leaderboard.</p>
    </div>
    <div class="profile-form">
      <div class="profile-field">
        <label class="auth-label">> USERNAME (login)</label>
        <div class="profile-value">${escapeHtml(user.username)}</div>
      </div>
      <div class="profile-field">
        <label class="auth-label">> EMAIL</label>
        <div class="profile-value">${escapeHtml(user.email)}</div>
      </div>
      <div class="profile-field">
        <label class="auth-label">> DISPLAY NAME (leaderboard)</label>
        <input type="text" class="auth-input" id="profile-display-name" placeholder="e.g. Alpha Trader" maxlength="30" value="${escapeHtml(user.displayName ?? '')}">
        <div class="profile-hint">2–30 chars. Shown on leaderboard when set. Leave empty to use username.</div>
      </div>
      <button type="button" class="auth-submit" id="profile-save">▶ SAVE</button>
      <div class="auth-error" id="profile-error"></div>
      <div class="auth-success" id="profile-success" style="display:none"></div>
    </div>
  `;

  overlayEl.appendChild(modal);
  document.body.appendChild(overlayEl);

  const closeBtn = modal.querySelector('.auth-close');
  closeBtn?.addEventListener('click', closeModal);
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closeModal();
  });

  const displayInput = modal.querySelector('#profile-display-name') as HTMLInputElement;
  const saveBtn = modal.querySelector('#profile-save') as HTMLButtonElement;
  const errorEl = modal.querySelector('#profile-error') as HTMLElement;
  const successEl = modal.querySelector('#profile-success') as HTMLElement;

  function setError(msg: string): void {
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = msg ? 'block' : 'none';
    }
    if (successEl) successEl.style.display = 'none';
  }

  function setSuccess(msg: string): void {
    if (successEl) {
      successEl.textContent = msg;
      successEl.style.display = 'block';
    }
    if (errorEl) errorEl.style.display = 'none';
  }

  saveBtn.addEventListener('click', async () => {
    const raw = displayInput.value.trim();
    const displayName = raw === '' ? undefined : raw;

    if (displayName !== undefined) {
      if (displayName.length < DISPLAY_NAME_MIN) {
        setError(`Display name must be at least ${DISPLAY_NAME_MIN} characters`);
        return;
      }
      if (displayName.length > DISPLAY_NAME_MAX) {
        setError(`Display name must be at most ${DISPLAY_NAME_MAX} characters`);
        return;
      }
    }

    setError('');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';

    const result = await auth.updateProfile(displayName);

    saveBtn.disabled = false;
    saveBtn.textContent = '▶ SAVE';

    if (result.success) {
      setSuccess('Profile updated. Your display name will appear on the leaderboard.');
    } else {
      setError(result.error ?? 'Failed to update profile');
    }
  });
}
