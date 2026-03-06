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
    title: 'Champion',
    prizes: ['$100 Cash Prize', 'Premium Access (3 Months)', 'Champion Badge'],
    gradient: 'linear-gradient(135deg, #FFD700 0%, #FFA500 100%)',
    glow: 'rgba(255, 215, 0, 0.4)',
  },
  {
    rank: '2nd',
    emoji: '🥈',
    title: 'Runner-Up',
    prizes: ['$50 Cash Prize', 'Premium Access (2 Months)', 'Elite Badge'],
    gradient: 'linear-gradient(135deg, #C0C0C0 0%, #A8A8A8 100%)',
    glow: 'rgba(192, 192, 192, 0.4)',
  },
  {
    rank: '3rd',
    emoji: '🥉',
    title: 'Third Place',
    prizes: ['$25 Cash Prize', 'Premium Access (1 Month)', 'Bronze Badge'],
    gradient: 'linear-gradient(135deg, #CD7F32 0%, #B87333 100%)',
    glow: 'rgba(205, 127, 50, 0.4)',
  },
  {
    rank: '4-10',
    emoji: '⭐',
    title: 'Top 10',
    prizes: ['Premium Access (2 Weeks)', 'Top 10 Badge', 'Discord Recognition'],
    gradient: 'linear-gradient(135deg, #4ADE80 0%, #22C55E 100%)',
    glow: 'rgba(74, 222, 128, 0.3)',
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
      <span class="leaderboard-rewards-hero-icon">🎁</span>
      <h2 class="leaderboard-rewards-hero-title">MONTHLY PRIZES</h2>
      <p class="leaderboard-rewards-hero-subtitle">Top 10 traders earn cash prizes & premium access</p>
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

  return container;
}

export function createRewardsTeaser(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'leaderboard-rewards-teaser-compact';

  container.innerHTML = `
    <div class="leaderboard-rewards-teaser-header">
      <span class="leaderboard-rewards-teaser-icon">🎁</span>
      <span class="leaderboard-rewards-teaser-title">MONTHLY PRIZES ACTIVE</span>
    </div>
    <div class="leaderboard-rewards-teaser-items">
      <div class="leaderboard-rewards-teaser-item">
        <span class="leaderboard-rewards-teaser-item-icon">🥇</span>
        <span class="leaderboard-rewards-teaser-item-text">1st: $100 + Premium (3 mo)</span>
      </div>
      <div class="leaderboard-rewards-teaser-item">
        <span class="leaderboard-rewards-teaser-item-icon">🥈</span>
        <span class="leaderboard-rewards-teaser-item-text">2nd: $50 + Premium (2 mo)</span>
      </div>
      <div class="leaderboard-rewards-teaser-item">
        <span class="leaderboard-rewards-teaser-item-icon">🥉</span>
        <span class="leaderboard-rewards-teaser-item-text">3rd: $25 + Premium (1 mo)</span>
      </div>
      <div class="leaderboard-rewards-teaser-item">
        <span class="leaderboard-rewards-teaser-item-icon">⭐</span>
        <span class="leaderboard-rewards-teaser-item-text">4-10: Premium access</span>
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
    { icon: '👥', value: '100+', label: 'traders', delay: '0s' },
    { icon: '💰', value: '$175', label: 'monthly prizes', delay: '0.05s' },
    { icon: '📈', value: '10K+', label: 'trades', delay: '0.1s' },
    { icon: '🏆', value: '10', label: 'winners/mo', delay: '0.15s' },
  ];

  container.innerHTML = `
    <div class="leaderboard-stats-grid">
      ${stats.map(stat => `
        <div class="leaderboard-stat-card" style="animation-delay: ${stat.delay}">
          <span class="leaderboard-stat-icon">${stat.icon}</span>
          <span class="leaderboard-stat-value">${stat.value}</span>
          <span class="leaderboard-stat-label">${stat.label}</span>
        </div>
      `).join('')}
    </div>
  `;

  return container;
}
