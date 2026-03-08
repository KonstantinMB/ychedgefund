/**
 * Service Worker Registration
 * Registers SW for PWA functionality and offline support
 */

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    console.log('[SW] Service workers not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
    });

    console.log('[SW] Registered successfully:', registration.scope);

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60_000); // Every minute

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          showUpdateNotification();
        }
      });
    });
  } catch (error) {
    console.error('[SW] Registration failed:', error);
  }
}

function showUpdateNotification(): void {
  console.log('[SW] New version available');

  // Show toast notification
  const toast = document.createElement('div');
  toast.className = 'sw-update-toast';
  toast.innerHTML = `
    <div class="sw-update-content">
      <span class="sw-update-icon">🔄</span>
      <span class="sw-update-text">New version available</span>
      <button class="sw-update-btn" id="sw-reload-btn">Reload</button>
      <button class="sw-update-dismiss" id="sw-dismiss-btn">✕</button>
    </div>
  `;

  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  // Wire up buttons
  document.getElementById('sw-reload-btn')?.addEventListener('click', () => {
    window.location.reload();
  });

  document.getElementById('sw-dismiss-btn')?.addEventListener('click', () => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 300);
  });
}

// Inject styles
const style = document.createElement('style');
style.textContent = `
  .sw-update-toast {
    position: fixed;
    bottom: 80px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    z-index: 10000;
    opacity: 0;
    transition: all 0.3s ease-out;
  }

  .sw-update-toast.visible {
    transform: translateX(-50%) translateY(0);
    opacity: 1;
  }

  .sw-update-content {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 18px;
    background: var(--surface-elevated);
    border: 1px solid var(--border-medium);
    border-radius: 8px;
    box-shadow: var(--shadow-xl);
  }

  .sw-update-icon {
    font-size: 20px;
  }

  .sw-update-text {
    font-family: var(--font-ui);
    font-size: 14px;
    color: var(--text-primary);
  }

  .sw-update-btn {
    padding: 6px 14px;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: var(--font-semibold);
    color: white;
    background: var(--text-accent);
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .sw-update-btn:hover {
    background: #C09438;
  }

  .sw-update-dismiss {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-tertiary);
    font-size: 16px;
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s ease;
  }

  .sw-update-dismiss:hover {
    background: var(--surface-raised);
    color: var(--text-primary);
  }

  @media (max-width: 768px) {
    .sw-update-toast {
      bottom: 160px; /* Above bottom sheet */
      left: 20px;
      right: 20px;
      transform: translateX(0) translateY(100px);
    }

    .sw-update-toast.visible {
      transform: translateX(0) translateY(0);
    }
  }
`;
document.head.appendChild(style);
