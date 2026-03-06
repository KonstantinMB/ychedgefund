/**
 * YC Hedge Fund - Mobile block screen
 * Full-screen overlay when accessed from mobile — platform is desktop-only.
 * Exception: /leaderboard is allowed on mobile (mobile-friendly view).
 */

const MOBILE_BREAKPOINT = 768;

const MOBILE_MESSAGES = [
  "We love that you're checking us out on the go — but this dashboard needs a big screen to shine. Fire up your laptop, we'll be here. 💻",
  "The globe needs room to breathe. So do our charts. Desktop only — we promise it's worth the wait. 🖥️",
  "Your phone is amazing. Our 3D globe? Not so much on 5 inches. Grab a desktop and let's trade the world. 🌍",
  "We're not being difficult — we're being honest. This thing was built for the big screen. See you on desktop! ✨",
];

export function isMobileViewport(): boolean {
  return window.innerWidth <= MOBILE_BREAKPOINT;
}

function pickMessage(): string {
  const idx = Math.floor(Math.random() * MOBILE_MESSAGES.length);
  return MOBILE_MESSAGES[idx]!;
}

/**
 * If mobile and not on leaderboard, show block screen and return true. Caller should abort init.
 * On /leaderboard, mobile is allowed — returns false.
 */
export function showMobileBlockIfNeeded(): boolean {
  if (!isMobileViewport()) return false;
  if (window.location.pathname === '/leaderboard') return false;

  const block = document.createElement('div');
  block.className = 'mobile-block';
  block.setAttribute('role', 'alert');

  block.innerHTML = `
    <div class="mobile-block-content">
      <div class="mobile-block-logo">
        <img src="/icon-192.png?v=2" alt="YC Hedge Fund" width="100" height="100" />
      </div>
      <h1 class="mobile-block-title">Desktop Only</h1>
      <p class="mobile-block-subtitle">YC Hedge Fund</p>
      <p class="mobile-block-message">${pickMessage()}</p>
      <p class="mobile-block-hint">Open this page on a laptop or desktop to use the platform.</p>
      <a href="/leaderboard" class="mobile-block-leaderboard-link">View Leaderboard on mobile →</a>
    </div>
  `;

  document.body.appendChild(block);
  return true;
}
