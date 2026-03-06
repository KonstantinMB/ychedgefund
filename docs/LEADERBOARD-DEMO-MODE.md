# Leaderboard Demo Mode — Feature Documentation

## Overview

The leaderboard now includes a **Demo Mode** feature that populates the leaderboard with 100 realistic mock users across all time periods (weekly, monthly, quarterly, yearly). This mode is designed for:

- **Product demos** and video recordings
- **Showcasing rewards** and gamification features
- **Testing UI/UX** without real user data
- **Marketing materials** and presentations

## How to Enable Demo Mode

### Method 1: UI Toggle (Recommended)
1. Navigate to `/leaderboard`
2. Look for the **"Demo Mode (100 Mock Users)"** toggle at the top of the page
3. Click the toggle to enable/disable mock data
4. The leaderboard will instantly refresh with mock or real data

### Method 2: Browser Console
```javascript
// Enable demo mode
localStorage.setItem('leaderboard:mock_mode', 'true');
window.location.reload();

// Disable demo mode
localStorage.removeItem('leaderboard:mock_mode');
window.location.reload();
```

### Method 3: Programmatic (for automated tests)
```typescript
import { setMockDataEnabled } from '../data/mock-leaderboard';

setMockDataEnabled(true);  // Enable
setMockDataEnabled(false); // Disable
```

## Features in Demo Mode

### 1. Mock User Data
- **100 unique traders** with realistic usernames (AlphaHunter, WallStreetWolf, QuantQuant, etc.)
- **Varied performance**: Winners (+50%), losers (-20%), and everything in between
- **Realistic stats**: NAV, trade count, max drawdown, account creation dates
- **Rank changes**: Dynamic rank movement indicators (▲/▼)

### 2. Reward System Showcase
When demo mode is active, the leaderboard displays:

#### **Competition Stats** (top section)
- 👥 100+ Active Traders
- 💰 $2.5M+ Prize Pool
- 📈 10,000+ Trades Executed
- 🏆 25 Winners Monthly

#### **Full Rewards Showcase** (large banner)
- 🥇 **1st Place**: iPhone 16 Pro Max + $500 Voucher + Premium (1 Year)
- 🥈 **2nd Place**: AirPods Pro 2 + $300 Voucher + Premium (6 Months)
- 🥉 **3rd Place**: Apple Watch SE + $200 Voucher + Premium (3 Months)
- ⭐ **Top 10**: $100 Trading Voucher + Premium (1 Month)
- 🎯 **Top 25**: $50 Voucher + Premium Trial (2 Weeks)

#### **Compact Rewards Teaser** (always visible)
- Quick-glance prize summary
- Animated icons and glow effects
- Live competition indicator

### 3. Enhanced Visual Effects
- ✨ **Podium highlights**: Gold/Silver/Bronze gradients for top 3
- 🏆 **Animated trophy**: Bouncing trophy in the logo
- ⚡ **Shine effect**: Sweeping shine animation across title
- 🎨 **Gradient cards**: Color-coded reward tiers
- 💫 **Hover effects**: Interactive cards with glow on hover
- 📊 **Stat counters**: Animated stat cards with bouncing icons

## Mock Data Details

### Data Generation
Mock data is deterministic (seeded random) for consistent demos:
- **Returns**: Normal distribution, ~15% annual mean, ~10% volatility
- **Trade counts**: 0.5–2.5 trades/day on average
- **Drawdowns**: Realistic 3–8% typical drawdowns
- **Rank changes**: Smaller for top 10, larger for bottom tier

### Period-Specific Data
Each time period has independent mock data:
- **Weekly**: 7-day returns, fewer trades
- **Monthly**: 30-day returns, moderate activity
- **Quarterly**: 90-day returns, high trade counts
- **Yearly**: 365-day returns, compounded performance

## Use Cases

### 1. Product Demo Video
```bash
# Before recording
1. Enable demo mode via toggle
2. Navigate through Weekly → Monthly → Quarterly → Yearly
3. Show podium highlights, rank changes, rewards
4. Hover over stat cards and reward tiers
5. Scroll through full 100-user leaderboard
```

### 2. Marketing Screenshots
```bash
# Setup for clean screenshot
1. Enable demo mode
2. Select "Monthly" tab (most compelling stats)
3. Ensure rewards showcase is visible
4. Capture full-page screenshot
```

### 3. Investor Presentation
```bash
# Highlight gamification
1. Demo mode ON
2. Show competition stats at top
3. Explain reward tiers (iPhone, AirPods, etc.)
4. Demonstrate rank change indicators
5. Show user engagement potential
```

## Technical Implementation

### Files Modified/Created
- `src/data/mock-leaderboard.ts` — Mock data generator (100 users)
- `src/views/leaderboard-rewards.ts` — Reward components (showcase, teaser, toggle, stats)
- `src/views/leaderboard.ts` — Integration layer (fetch override, conditional rendering)
- `src/styles/base.css` — Gamification styles (animations, gradients, hover effects)

### Key Functions
```typescript
// Generate mock data for a period
getMockLeaderboardData(period: 'weekly' | 'monthly' | 'quarterly' | 'yearly'): MockLeaderboardEntry[]

// Check if mock mode is active
isMockDataEnabled(): boolean

// Toggle mock mode
setMockDataEnabled(enabled: boolean): void

// UI Components
createRewardsShowcase(): HTMLElement
createRewardsTeaser(): HTMLElement
createCompetitionStats(): HTMLElement
createMockModeToggle(): HTMLElement
```

### API Behavior
When demo mode is enabled:
- **API calls are bypassed** — no network requests to `/api/leaderboard`
- **LocalStorage checked first** in `fetchLeaderboard()`
- **Mock data returned instantly** — no loading delay
- **Real users hidden** — only mock data visible

When demo mode is disabled:
- **Normal API flow** — fetches real users from Redis
- **Current user rank** shown if authenticated
- **Empty state** if no traders exist

## Styling & Animations

### CSS Classes (New)
- `.leaderboard-rewards-showcase` — Full rewards banner
- `.leaderboard-rewards-grid` — Prize tier cards
- `.leaderboard-rewards-teaser-compact` — Compact prizes section
- `.leaderboard-competition-stats` — Stats grid (4 cards)
- `.leaderboard-mock-toggle` — Toggle switch UI
- `.leaderboard-logo-trophy` — Animated trophy emoji
- `.leaderboard-logo-shine` — Shine sweep effect

### Animations
- `leaderboard-trophy-bounce` — Trophy bounce (2s loop)
- `leaderboard-logo-shine` — Title shine sweep (3s loop)
- `leaderboard-hero-pulse` — Radial pulse ring (3s loop)
- `leaderboard-tier-fade-in` — Card fade-in (0.5s, staggered)
- `leaderboard-podium-enter` — Row slide-in (0.5s)
- `leaderboard-teaser-glow` — Border glow pulse (3s loop)

## Performance Notes

- **Bundle size**: +19.87 kB (leaderboard.js) — acceptable for feature richness
- **Render speed**: Instant (no API latency in demo mode)
- **Memory**: ~100 objects cached (negligible)
- **Animation cost**: CSS-only (GPU-accelerated)

## Gotchas & Edge Cases

1. **Sync button hidden** in demo mode (no portfolio to sync)
2. **Current user rank callout** hidden in demo mode (not in mock data)
3. **Auth banner** still shows for logged-out users
4. **Period switching** re-generates data (different mock users per period)
5. **LocalStorage persistence** — demo mode survives page reloads

## Future Enhancements (Optional)

- [ ] Add "Share Screenshot" button in demo mode
- [ ] Export mock leaderboard as CSV
- [ ] Time-based auto-demo (rotating periods)
- [ ] Custom reward tier editor for demos
- [ ] Mock data seed selector (different user sets)

## FAQ

**Q: Does demo mode affect real user rankings?**
A: No. Demo mode only affects the frontend. Real user data in Redis is untouched.

**Q: Can I customize prize values?**
A: Yes. Edit `REWARD_TIERS` in `src/views/leaderboard-rewards.ts`.

**Q: How do I reset to factory mock data?**
A: Reload the page. Mock data is deterministically regenerated on each load.

**Q: Does demo mode work on mobile?**
A: Yes. All animations and responsive grids work on mobile viewports.

**Q: Can I use demo mode in production?**
A: Yes, it's safe. It's client-side only and doesn't affect the backend.

---

**Demo Mode Activated** 🎬 — Ready to showcase the leaderboard's full potential!
