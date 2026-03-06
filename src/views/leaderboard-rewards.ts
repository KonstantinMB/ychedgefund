/**
 * Leaderboard Rewards Component
 *
 * Eye-catching reward showcase for demo/gamification.
 * Features prize tiers, animated banners, and motivational CTAs.
 */

export interface RewardTier {
  rank: string;
  emoji: string;
  title: string;
  prizes: string[];
  gradient: string;
  glow: string;
}

export const REWARD_TIERS: RewardTier[] = [
  {
    rank: '1st',
    emoji: '🥇',
    title: 'Grand Champion',
    prizes: ['iPhone 16 Pro Max', '$500 Trading Voucher', 'Premium Features (1 Year)', 'Exclusive Discord Role'],
    gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    glow: 'rgba(255, 215, 0, 0.4)',
  },
  {
    rank: '2nd',
    emoji: '🥈',
    title: 'Silver Medalist',
    prizes: ['AirPods Pro 2', '$300 Trading Voucher', 'Premium Features (6 Months)', 'Exclusive Discord Role'],
    gradient: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)',
    glow: 'rgba(192, 192, 192, 0.4)',
  },
  {
    rank: '3rd',
    emoji: '🥉',
    title: 'Bronze Winner',
    prizes: ['Apple Watch SE', '$200 Trading Voucher', 'Premium Features (3 Months)', 'Exclusive Discord Role'],
    gradient: 'linear-gradient(135deg, #CD7F32 0%, #B87333 100%)',
    glow: 'rgba(205, 127, 50, 0.4)',
  },
  {
    rank: 'Top 10',
    emoji: '⭐',
    title: 'Elite Trader',
    prizes: ['$100 Trading Voucher', 'Premium Features (1 Month)', 'Special Badge'],
    gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)',
    glow: 'rgba(74, 222, 128, 0.3)',
  },
  {
    rank: 'Top 25',
    emoji: '🎯',
    title: 'Rising Star',
    prizes: ['$50 Trading Voucher', 'Premium Trial (2 Weeks)', 'Recognition Badge'],
    gradient: 'linear-gradient(135deg, #60A5FA 0%, #3B82F6 100%)',
    glow: 'rgba(96, 165, 250, 0.3)',
  },
];

export function createRewardsShowcase(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'leaderboard-rewards-showcase';

  // Hero banner
  const hero = document.createElement('div');
  hero.className = 'leaderboard-rewards-hero';
  hero.innerHTML = `
    <div class="leaderboard-rewards-hero-content">
      <div class="leaderboard-rewards-hero-icon">🏆</div>
      <h2 class="leaderboard-rewards-hero-title">WIN REAL PRIZES</h2>
      <p class="leaderboard-rewards-hero-subtitle">Monthly & Quarterly competitions • Top performers get rewarded</p>
      <div class="leaderboard-rewards-hero-pulse"></div>
    </div>
  `;
  container.appendChild(hero);

  // Prize tiers grid
  const grid = document.createElement('div');
  grid.className = 'leaderboard-rewards-grid';

  REWARD_TIERS.forEach((tier, index) => {
    const card = document.createElement('div');
    card.className = 'leaderboard-rewards-tier';
    card.style.setProperty('--tier-gradient', tier.gradient);
    card.style.setProperty('--tier-glow', tier.glow);
    card.style.animationDelay = `${index * 0.1}s`;

    card.innerHTML = `
      <div class="leaderboard-rewards-tier-header">
        <span class="leaderboard-rewards-tier-emoji">${tier.emoji}</span>
        <div>
          <div class="leaderboard-rewards-tier-rank">${tier.rank} Place</div>
          <div class="leaderboard-rewards-tier-title">${tier.title}</div>
        </div>
      </div>
      <ul class="leaderboard-rewards-tier-prizes">
        ${tier.prizes.map(prize => `<li>${prize}</li>`).join('')}
      </ul>
      <div class="leaderboard-rewards-tier-glow"></div>
    `;

    grid.appendChild(card);
  });

  container.appendChild(grid);

  // CTA banner
  const cta = document.createElement('div');
  cta.className = 'leaderboard-rewards-cta';
  cta.innerHTML = `
    <div class="leaderboard-rewards-cta-content">
      <div class="leaderboard-rewards-cta-icon">🚀</div>
      <div>
        <div class="leaderboard-rewards-cta-title">Start Trading to Compete</div>
        <div class="leaderboard-rewards-cta-subtitle">Climb the ranks • Prove your skills • Win prizes</div>
      </div>
    </div>
  `;
  container.appendChild(cta);

  return container;
}

export function createRewardsTeaser(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'leaderboard-rewards-teaser-compact';

  container.innerHTML = `
    <div class="leaderboard-rewards-teaser-header">
      <span class="leaderboard-rewards-teaser-icon">🎁</span>
      <span class="leaderboard-rewards-teaser-title">LIVE COMPETITION — PRIZES ACTIVE</span>
    </div>
    <div class="leaderboard-rewards-teaser-items">
      <div class="leaderboard-rewards-teaser-item">
        <span class="leaderboard-rewards-teaser-item-icon">🥇</span>
        <span class="leaderboard-rewards-teaser-item-text">1st: iPhone 16 Pro Max + $500</span>
      </div>
      <div class="leaderboard-rewards-teaser-item">
        <span class="leaderboard-rewards-teaser-item-icon">🥈</span>
        <span class="leaderboard-rewards-teaser-item-text">2nd: AirPods Pro 2 + $300</span>
      </div>
      <div class="leaderboard-rewards-teaser-item">
        <span class="leaderboard-rewards-teaser-item-icon">🥉</span>
        <span class="leaderboard-rewards-teaser-item-text">3rd: Apple Watch + $200</span>
      </div>
      <div class="leaderboard-rewards-teaser-item">
        <span class="leaderboard-rewards-teaser-item-icon">⭐</span>
        <span class="leaderboard-rewards-teaser-item-text">Top 10: $100 vouchers</span>
      </div>
    </div>
    <div class="leaderboard-rewards-teaser-footer">
      Monthly & Quarterly winners announced • Trade now to qualify
    </div>
  `;

  return container;
}

export function createMockModeToggle(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'leaderboard-mock-toggle';

  const mockEnabled = localStorage.getItem('leaderboard:mock_mode') === 'true';

  container.innerHTML = `
    <label class="leaderboard-mock-toggle-label">
      <input type="checkbox" class="leaderboard-mock-toggle-input" ${mockEnabled ? 'checked' : ''}>
      <span class="leaderboard-mock-toggle-slider"></span>
      <span class="leaderboard-mock-toggle-text">Demo Mode (100 Mock Users)</span>
    </label>
  `;

  const checkbox = container.querySelector('.leaderboard-mock-toggle-input') as HTMLInputElement;
  checkbox.addEventListener('change', () => {
    const enabled = checkbox.checked;
    if (enabled) {
      localStorage.setItem('leaderboard:mock_mode', 'true');
    } else {
      localStorage.removeItem('leaderboard:mock_mode');
    }
    window.dispatchEvent(new CustomEvent('leaderboard:mock-toggle', { detail: { enabled } }));
  });

  return container;
}

export function createCompetitionStats(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'leaderboard-competition-stats';

  const stats = [
    { icon: '👥', value: '100+', label: 'Active Traders', delay: '0s' },
    { icon: '💰', value: '$2.5M+', label: 'Prize Pool', delay: '0.1s' },
    { icon: '📈', value: '10,000+', label: 'Trades Executed', delay: '0.2s' },
    { icon: '🏆', value: '25', label: 'Winners Monthly', delay: '0.3s' },
  ];

  container.innerHTML = `
    <div class="leaderboard-stats-grid">
      ${stats.map(stat => `
        <div class="leaderboard-stat-card" style="animation-delay: ${stat.delay}">
          <div class="leaderboard-stat-icon">${stat.icon}</div>
          <div class="leaderboard-stat-value">${stat.value}</div>
          <div class="leaderboard-stat-label">${stat.label}</div>
        </div>
      `).join('')}
    </div>
  `;

  return container;
}
