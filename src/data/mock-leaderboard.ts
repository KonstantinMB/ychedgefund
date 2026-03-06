/**
 * Mock Leaderboard Data — 100 synthetic users for demo/teaser mode
 *
 * Generates realistic trading stats across all time periods with:
 * - Varied return distributions (winners & losers)
 * - Realistic rank changes
 * - Portfolio metrics (NAV, trade count, drawdown)
 * - Trending usernames for authenticity
 */

interface MockLeaderboardEntry {
  rank: number;
  username: string;
  displayName?: string;
  returnPct: number;
  prevRank: number | null;
  rankChange: number | null;
  nav: number;
  tradeCount: number;
  maxDrawdown?: number;
  createdAt?: number;
}

interface MockLeaderboardData {
  weekly: MockLeaderboardEntry[];
  monthly: MockLeaderboardEntry[];
  quarterly: MockLeaderboardEntry[];
  yearly: MockLeaderboardEntry[];
}

// Realistic trader usernames
const USERNAMES = [
  'AlphaHunter', 'BearSlayer', 'BullRider', 'ChartWizard', 'DeepValue',
  'EdgeSeeker', 'FibonacciKing', 'GammaGrind', 'HedgeFund101', 'IronCondor',
  'JumpTrader', 'KellyBetter', 'LiquiditySniper', 'MarketMaven', 'NasdaqNinja',
  'OptionOracle', 'PortfolioProf', 'QuantQuant', 'RiskReversal', 'SwingKing',
  'TrendFollower', 'UpsideOnly', 'VolatilityVault', 'WallStreetWolf', 'XtraAlpha',
  'YieldYogi', 'ZeroHedge420', 'CryptoCombo', 'DeltaNeutral', 'EarningsEdge',
  'FlashCrash', 'GridGod', 'HFTHero', 'IndexArb', 'JunkBondJunkie',
  'KnightCapital', 'LongShortLife', 'MomentumMax', 'NetNet', 'OTM_YOLO',
  'PairsTrade', 'QuadWitch', 'RatioSpread', 'StatArb', 'ThetaGang',
  'UnicornHunter', 'VegaVault', 'WheelStrategy', 'XRayVision', 'YoloYacht',
  'ZeroDTE', 'AssetAllocator', 'BreakoutBro', 'CoveredCall', 'DividendDuke',
  'EMH_Denier', 'FactorFinder', 'GrowthGuru', 'HoldTheLineKing', 'InverseJim',
  'JustBuyIndex', 'KillerKangol', 'LeapLord', 'MacroMike', 'NakedPut',
  'OptionsSensei', 'PutSeller', 'QuietQuant', 'RetailRebel', 'SectorRotate',
  'TrendIsGod', 'UndervaluedGem', 'ValueVelocity', 'WhaleWatcher', 'XFactorX',
  'YieldCurveYoda', 'ZigZagZoom', 'AlgoAddict', 'BetaSmasher', 'CashSecured',
  'DeepOTM', 'EquityElite', 'FlowFollower', 'GoldenCross', 'HedgeHedge',
  'IronButterfly', 'JustHODL', 'KnifeCatcher', 'LimitOrderOnly', 'MeanRevert',
  'NeverSellCalls', 'OutOfMoney', 'PremiumHarvest', 'QuietQuant2', 'RatioKing',
  'ShortStrangle', 'TailHedge', 'UncorrelatedAlpha', 'VolSkewMaster', 'WinnersOnly',
];

// Display names (some users have them)
const DISPLAY_NAMES: Record<string, string> = {
  'AlphaHunter': 'The Alpha Hunter',
  'WallStreetWolf': 'Wolf of Retail',
  'QuantQuant': 'Quant Master',
  'ThetaGang': 'Theta Gang Leader',
  'YoloYacht': 'YOLO Yacht Club',
  'DeepValue': 'Deep Value Investor',
  'MarketMaven': 'Market Maven',
  'OptionOracle': 'Options Oracle',
};

// Starting capital
const STARTING_CAPITAL = 1_000_000;

// Seed for deterministic generation
let seed = 12345;
function seededRandom(): number {
  seed = (seed * 9301 + 49297) % 233280;
  return seed / 233280;
}

function seededNormal(mean: number, stdDev: number): number {
  // Box-Muller transform
  const u1 = seededRandom();
  const u2 = seededRandom();
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  return mean + z0 * stdDev;
}

function generateReturnPct(periodDays: number): number {
  // Annual Sharpe ~1.5, annualized return ~15%, vol ~10%
  const annualReturnMean = 15;
  const annualVolatility = 10;
  const dailyReturn = annualReturnMean / 365;
  const dailyVol = annualVolatility / Math.sqrt(365);
  const periodReturn = seededNormal(dailyReturn * periodDays, dailyVol * Math.sqrt(periodDays));
  return periodReturn;
}

function generateMockEntries(periodDays: number, userCount = 100): MockLeaderboardEntry[] {
  const entries: MockLeaderboardEntry[] = [];
  const now = Date.now();
  const periodStart = now - periodDays * 24 * 60 * 60 * 1000;

  for (let i = 0; i < userCount; i++) {
    const username = USERNAMES[i]!;
    const displayName = DISPLAY_NAMES[username];
    const returnPct = generateReturnPct(periodDays);
    const nav = STARTING_CAPITAL * (1 + returnPct / 100);

    // Trade count: more active in shorter periods
    const avgTradesPerDay = 0.5 + seededRandom() * 2; // 0.5-2.5 trades/day
    const tradeCount = Math.max(1, Math.floor(avgTradesPerDay * periodDays * (0.8 + seededRandom() * 0.4)));

    // Max drawdown: typically 0.3-0.8 of volatility
    const maxDrawdown = Math.abs(seededNormal(0.05, 0.03));

    // Created at: random time in past year
    const createdAt = now - Math.floor(seededRandom() * 365 * 24 * 60 * 60 * 1000);

    entries.push({
      rank: 0, // Will be set after sorting
      username,
      displayName,
      returnPct,
      prevRank: null, // Will be set with rank change logic
      rankChange: null,
      nav,
      tradeCount,
      maxDrawdown,
      createdAt,
    });
  }

  // Sort by return descending
  entries.sort((a, b) => b.returnPct - a.returnPct);

  // Assign ranks and rank changes
  entries.forEach((entry, index) => {
    entry.rank = index + 1;

    // Previous rank: simulate realistic movement
    // Top 10: small changes (-3 to +3)
    // Mid-tier: medium changes (-10 to +10)
    // Bottom: larger swings (-20 to +20)
    let maxChange = 3;
    if (entry.rank > 50) maxChange = 20;
    else if (entry.rank > 10) maxChange = 10;

    const rawChange = Math.floor(seededNormal(0, maxChange / 2));
    const prevRank = Math.max(1, Math.min(userCount, entry.rank + rawChange));

    // 10% chance of new entry (no previous rank)
    if (seededRandom() < 0.1) {
      entry.prevRank = null;
      entry.rankChange = null;
    } else {
      entry.prevRank = prevRank;
      entry.rankChange = prevRank - entry.rank;
    }
  });

  return entries;
}

function generateAllPeriods(): MockLeaderboardData {
  // Reset seed for each period generation to ensure variety
  const baseSeed = 12345;

  seed = baseSeed;
  const weekly = generateMockEntries(7, 100);

  seed = baseSeed + 1000;
  const monthly = generateMockEntries(30, 100);

  seed = baseSeed + 2000;
  const quarterly = generateMockEntries(90, 100);

  seed = baseSeed + 3000;
  const yearly = generateMockEntries(365, 100);

  return { weekly, monthly, quarterly, yearly };
}

// Generate once at module load
const MOCK_DATA = generateAllPeriods();

export function getMockLeaderboardData(period: 'weekly' | 'monthly' | 'quarterly' | 'yearly'): MockLeaderboardEntry[] {
  return MOCK_DATA[period];
}

export function isMockDataEnabled(): boolean {
  return localStorage.getItem('leaderboard:mock_mode') === 'true';
}

export function setMockDataEnabled(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem('leaderboard:mock_mode', 'true');
  } else {
    localStorage.removeItem('leaderboard:mock_mode');
  }
  // Dispatch event for components to refresh
  window.dispatchEvent(new CustomEvent('leaderboard:mock-toggle', { detail: { enabled } }));
}
