/**
 * Portfolio Risk Metrics - Real-Time Risk Dashboard
 *
 * Calculates institutional-grade risk metrics for the paper trading portfolio:
 * - VaR (Value at Risk) at 95% and 99% confidence
 * - CVaR (Conditional VaR / Expected Shortfall)
 * - Portfolio beta vs SPY
 * - Sector concentration (Herfindahl index)
 * - Correlation matrix
 * - Volatility (annualized)
 * - Sharpe ratio (rolling 30-day)
 * - Max drawdown
 */

import type { PortfolioState, Position } from '../engine';
import { getAsset } from '../data/universe';
import { getCachedIndicators } from '../data/historical';

export interface RiskMetrics {
  timestamp: number;

  // Value at Risk
  var95: number; // 95% VaR (1-day, $)
  var99: number; // 99% VaR (1-day, $)

  // Conditional VaR (Expected Shortfall)
  cvar95: number; // Expected loss beyond VaR 95%
  cvar99: number; // Expected loss beyond VaR 99%

  // Portfolio characteristics
  beta: number; // vs SPY
  volatility: number; // Annualized (%)
  sharpeRatio: number; // Rolling 30-day
  maxDrawdown: number; // From high water mark

  // Concentration metrics
  sectorHerfindahl: number; // 0-1 (1 = single sector)
  topSectorExposure: { sector: string; percentage: number }[];
  positionHerfindahl: number; // 0-1 (1 = single position)

  // Correlation
  avgCorrelation: number; // Average pairwise correlation
  maxCorrelation: number; // Highest pairwise correlation
  correlationMatrix?: Map<string, Map<string, number>>;
}

export interface HistoricalReturn {
  date: string;
  return: number;
  portfolioValue: number;
}

/**
 * Calculate comprehensive portfolio risk metrics
 */
export async function calculatePortfolioRisk(
  portfolio: PortfolioState,
  historicalReturns: HistoricalReturn[]
): Promise<RiskMetrics> {
  // Calculate VaR and CVaR from historical returns
  const { var95, var99, cvar95, cvar99 } = calculateVaR(portfolio.totalValue, historicalReturns);

  // Calculate portfolio beta
  const beta = await calculatePortfolioBeta(portfolio);

  // Calculate volatility
  const volatility = calculateVolatility(historicalReturns);

  // Calculate Sharpe ratio
  const sharpeRatio = calculateSharpeRatio(historicalReturns);

  // Calculate max drawdown
  const maxDrawdown = calculateMaxDrawdown(historicalReturns);

  // Calculate sector concentration
  const { sectorHerfindahl, topSectorExposure } = calculateSectorConcentration(portfolio);

  // Calculate position concentration
  const positionHerfindahl = calculatePositionConcentration(portfolio);

  // Calculate correlation metrics
  const { avgCorrelation, maxCorrelation, correlationMatrix } = await calculateCorrelationMetrics(
    portfolio
  );

  return {
    timestamp: Date.now(),
    var95,
    var99,
    cvar95,
    cvar99,
    beta,
    volatility,
    sharpeRatio,
    maxDrawdown,
    sectorHerfindahl,
    topSectorExposure,
    positionHerfindahl,
    avgCorrelation,
    maxCorrelation,
    correlationMatrix,
  };
}

/**
 * Calculate Value at Risk (VaR) using historical simulation
 */
function calculateVaR(
  currentValue: number,
  historicalReturns: HistoricalReturn[]
): {
  var95: number;
  var99: number;
  cvar95: number;
  cvar99: number;
} {
  if (historicalReturns.length < 20) {
    // Not enough data for reliable VaR
    return { var95: 0, var99: 0, cvar95: 0, cvar99: 0 };
  }

  // Extract returns and sort
  const returns = historicalReturns.map(r => r.return).sort((a, b) => a - b);

  // VaR at 95% confidence (5th percentile of returns)
  const var95Index = Math.floor(returns.length * 0.05);
  const var95Return = returns[var95Index];
  const var95 = Math.abs(var95Return * currentValue);

  // VaR at 99% confidence (1st percentile of returns)
  const var99Index = Math.floor(returns.length * 0.01);
  const var99Return = returns[var99Index];
  const var99 = Math.abs(var99Return * currentValue);

  // CVaR (Expected Shortfall) - average of losses beyond VaR
  const cvar95Returns = returns.slice(0, var95Index + 1);
  const cvar95Return =
    cvar95Returns.length > 0
      ? cvar95Returns.reduce((sum, r) => sum + r, 0) / cvar95Returns.length
      : var95Return;
  const cvar95 = Math.abs(cvar95Return * currentValue);

  const cvar99Returns = returns.slice(0, var99Index + 1);
  const cvar99Return =
    cvar99Returns.length > 0
      ? cvar99Returns.reduce((sum, r) => sum + r, 0) / cvar99Returns.length
      : var99Return;
  const cvar99 = Math.abs(cvar99Return * currentValue);

  return { var95, var99, cvar95, cvar99 };
}

/**
 * Calculate portfolio beta vs SPY
 */
async function calculatePortfolioBeta(portfolio: PortfolioState): Promise<number> {
  if (portfolio.positions.size === 0) return 1.0;

  // Weight-average of individual betas
  let weightedBeta = 0;

  for (const [symbol, position] of portfolio.positions.entries()) {
    const asset = getAsset(symbol);
    const weight = position.marketValue / portfolio.totalValue;
    const beta = asset?.beta || 1.0;

    weightedBeta += weight * beta;
  }

  return weightedBeta;
}

/**
 * Calculate annualized volatility from historical returns
 */
function calculateVolatility(historicalReturns: HistoricalReturn[]): number {
  if (historicalReturns.length < 2) return 0;

  const returns = historicalReturns.map(r => r.return);

  // Calculate mean
  const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;

  // Calculate variance
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (returns.length - 1);

  // Annualize (assuming daily returns)
  const dailyVol = Math.sqrt(variance);
  const annualizedVol = dailyVol * Math.sqrt(252); // 252 trading days

  return annualizedVol;
}

/**
 * Calculate Sharpe ratio (rolling 30-day)
 */
function calculateSharpeRatio(historicalReturns: HistoricalReturn[]): number {
  if (historicalReturns.length < 30) return 0;

  // Use last 30 days
  const recentReturns = historicalReturns.slice(-30).map(r => r.return);

  // Calculate mean return
  const meanReturn = recentReturns.reduce((sum, r) => sum + r, 0) / recentReturns.length;

  // Calculate standard deviation
  const variance =
    recentReturns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
    (recentReturns.length - 1);
  const stdDev = Math.sqrt(variance);

  if (stdDev === 0) return 0;

  // Assume risk-free rate of 4% annually (0.04 / 252 daily)
  const riskFreeRate = 0.04 / 252;

  // Sharpe ratio = (mean return - risk-free rate) / std dev
  const sharpe = (meanReturn - riskFreeRate) / stdDev;

  // Annualize
  return sharpe * Math.sqrt(252);
}

/**
 * Calculate max drawdown from historical returns
 */
function calculateMaxDrawdown(historicalReturns: HistoricalReturn[]): number {
  if (historicalReturns.length === 0) return 0;

  let maxDrawdown = 0;
  let peak = historicalReturns[0].portfolioValue;

  for (const entry of historicalReturns) {
    if (entry.portfolioValue > peak) {
      peak = entry.portfolioValue;
    }

    const drawdown = (peak - entry.portfolioValue) / peak;

    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

/**
 * Calculate sector concentration (Herfindahl-Hirschman Index)
 */
function calculateSectorConcentration(portfolio: PortfolioState): {
  sectorHerfindahl: number;
  topSectorExposure: Array<{ sector: string; percentage: number }>;
} {
  if (portfolio.positions.size === 0) {
    return { sectorHerfindahl: 0, topSectorExposure: [] };
  }

  // Calculate sector exposures
  const sectorExposures = new Map<string, number>();

  for (const [symbol, position] of portfolio.positions.entries()) {
    const asset = getAsset(symbol);
    const sector = asset?.sector || 'Unknown';

    const current = sectorExposures.get(sector) || 0;
    sectorExposures.set(sector, current + position.marketValue);
  }

  // Calculate Herfindahl index (sum of squared market shares)
  let herfindahl = 0;

  for (const exposure of sectorExposures.values()) {
    const marketShare = exposure / portfolio.totalValue;
    herfindahl += marketShare * marketShare;
  }

  // Get top sectors
  const topSectorExposure = Array.from(sectorExposures.entries())
    .map(([sector, value]) => ({
      sector,
      percentage: (value / portfolio.totalValue) * 100,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  return { sectorHerfindahl: herfindahl, topSectorExposure };
}

/**
 * Calculate position concentration (Herfindahl index)
 */
function calculatePositionConcentration(portfolio: PortfolioState): number {
  if (portfolio.positions.size === 0) return 0;

  let herfindahl = 0;

  for (const position of portfolio.positions.values()) {
    const marketShare = position.marketValue / portfolio.totalValue;
    herfindahl += marketShare * marketShare;
  }

  return herfindahl;
}

/**
 * Calculate correlation metrics
 */
async function calculateCorrelationMetrics(portfolio: PortfolioState): Promise<{
  avgCorrelation: number;
  maxCorrelation: number;
  correlationMatrix: Map<string, Map<string, number>>;
}> {
  if (portfolio.positions.size < 2) {
    return {
      avgCorrelation: 0,
      maxCorrelation: 0,
      correlationMatrix: new Map(),
    };
  }

  const symbols = Array.from(portfolio.positions.keys());

  // Fetch historical returns for all symbols
  const returnsMap = new Map<string, number[]>();

  for (const symbol of symbols) {
    const returns = await getHistoricalReturns(symbol, 20);
    returnsMap.set(symbol, returns);
  }

  // Calculate pairwise correlations
  const correlationMatrix = new Map<string, Map<string, number>>();
  const correlations: number[] = [];

  for (let i = 0; i < symbols.length; i++) {
    const symbol1 = symbols[i];
    const returns1 = returnsMap.get(symbol1) || [];

    if (!correlationMatrix.has(symbol1)) {
      correlationMatrix.set(symbol1, new Map());
    }

    for (let j = i + 1; j < symbols.length; j++) {
      const symbol2 = symbols[j];
      const returns2 = returnsMap.get(symbol2) || [];

      const correlation = calculateCorrelation(returns1, returns2);

      // Store in matrix
      correlationMatrix.get(symbol1)!.set(symbol2, correlation);

      if (!correlationMatrix.has(symbol2)) {
        correlationMatrix.set(symbol2, new Map());
      }
      correlationMatrix.get(symbol2)!.set(symbol1, correlation);

      correlations.push(Math.abs(correlation));
    }
  }

  // Calculate average and max correlation
  const avgCorrelation =
    correlations.length > 0 ? correlations.reduce((sum, c) => sum + c, 0) / correlations.length : 0;
  const maxCorrelation = correlations.length > 0 ? Math.max(...correlations) : 0;

  return { avgCorrelation, maxCorrelation, correlationMatrix };
}

/**
 * Get historical returns for a symbol (helper)
 */
async function getHistoricalReturns(symbol: string, days: number): Promise<number[]> {
  try {
    const indicators = await getCachedIndicators(symbol);

    if (!indicators || indicators.candles.length < 2) return [];

    const candles = indicators.candles.slice(-days - 1);
    const returns: number[] = [];

    for (let i = 1; i < candles.length; i++) {
      const ret = (candles[i].close - candles[i - 1].close) / candles[i - 1].close;
      returns.push(ret);
    }

    return returns;
  } catch (error) {
    return [];
  }
}

/**
 * Calculate Pearson correlation between two return series
 */
function calculateCorrelation(returns1: number[], returns2: number[]): number {
  const n = Math.min(returns1.length, returns2.length);

  if (n < 2) return 0;

  const r1 = returns1.slice(-n);
  const r2 = returns2.slice(-n);

  const mean1 = r1.reduce((sum, r) => sum + r, 0) / n;
  const mean2 = r2.reduce((sum, r) => sum + r, 0) / n;

  let numerator = 0;
  let sumSq1 = 0;
  let sumSq2 = 0;

  for (let i = 0; i < n; i++) {
    const diff1 = r1[i] - mean1;
    const diff2 = r2[i] - mean2;

    numerator += diff1 * diff2;
    sumSq1 += diff1 * diff1;
    sumSq2 += diff2 * diff2;
  }

  const denominator = Math.sqrt(sumSq1 * sumSq2);

  if (denominator === 0) return 0;

  return numerator / denominator;
}

/**
 * Generate mock historical returns for testing (when no real data available)
 */
export function generateMockHistoricalReturns(
  days: number,
  startValue: number
): HistoricalReturn[] {
  const returns: HistoricalReturn[] = [];
  let value = startValue;

  for (let i = 0; i < days; i++) {
    // Random daily return between -2% and +2%
    const dailyReturn = (Math.random() - 0.5) * 0.04;
    value *= 1 + dailyReturn;

    returns.push({
      date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      return: dailyReturn,
      portfolioValue: value,
    });
  }

  return returns;
}

/**
 * Format risk metrics for display
 */
export function formatRiskMetrics(metrics: RiskMetrics): string {
  return `
Risk Metrics Report
Generated: ${new Date(metrics.timestamp).toLocaleString()}

VALUE AT RISK (1-day)
  VaR 95%: $${metrics.var95.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  VaR 99%: $${metrics.var99.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  CVaR 95%: $${metrics.cvar95.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
  CVaR 99%: $${metrics.cvar99.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}

PORTFOLIO CHARACTERISTICS
  Beta (vs SPY): ${metrics.beta.toFixed(2)}
  Volatility: ${(metrics.volatility * 100).toFixed(2)}% (annualized)
  Sharpe Ratio: ${metrics.sharpeRatio.toFixed(2)} (30-day)
  Max Drawdown: ${(metrics.maxDrawdown * 100).toFixed(2)}%

CONCENTRATION
  Sector Herfindahl: ${metrics.sectorHerfindahl.toFixed(3)} ${metrics.sectorHerfindahl > 0.3 ? '⚠️ HIGH' : '✓'}
  Position Herfindahl: ${metrics.positionHerfindahl.toFixed(3)} ${metrics.positionHerfindahl > 0.2 ? '⚠️ HIGH' : '✓'}

  Top Sector Exposures:
${metrics.topSectorExposure
  .slice(0, 3)
  .map(s => `    ${s.sector}: ${s.percentage.toFixed(1)}%`)
  .join('\n')}

CORRELATION
  Avg Correlation: ${(metrics.avgCorrelation * 100).toFixed(1)}%
  Max Correlation: ${(metrics.maxCorrelation * 100).toFixed(1)}% ${metrics.maxCorrelation > 0.8 ? '⚠️ HIGH' : '✓'}
  `.trim();
}
