/**
 * Risk Manager - The Gatekeeper
 *
 * Every trade must pass ALL 10 pre-trade checks before execution.
 * Enforces position limits, sector caps, correlation checks, circuit breakers.
 */

import type { Signal, PortfolioState, Position } from '../engine';
import { PAPER_CONFIG } from '../engine';
import { getAsset } from '../data/universe';
import { CircuitBreaker, CircuitBreakerState } from './circuit-breaker';
import { logRiskDecision } from './audit-log';
import { getCachedIndicators } from '../data/historical';

export interface RiskCheck {
  name: string;
  passed: boolean;
  value: number;
  limit: number;
  message: string;
}

export interface RiskDecision {
  approved: boolean;
  adjustedSize?: number; // If auto-adjusted due to YELLOW state
  checks: RiskCheck[];
  reason?: string; // If rejected
  circuitBreakerState: CircuitBreakerState;
}

export class RiskManager {
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Evaluate an order against ALL 10 risk checks
   *
   * Returns RiskDecision with approval status and detailed check results.
   */
  async evaluateOrder(
    signal: Signal,
    portfolio: PortfolioState,
    requestedSize: number, // Dollar amount
    currentPrice: number,
    highWaterMark: number,
    dailyStartValue: number
  ): Promise<RiskDecision> {
    const checks: RiskCheck[] = [];

    // Update circuit breaker state
    const dailyPnLPct = (portfolio.totalValue - dailyStartValue) / dailyStartValue;
    const drawdown = (highWaterMark - portfolio.totalValue) / highWaterMark;

    this.circuitBreaker.update(dailyPnLPct, drawdown);
    const cbState = this.circuitBreaker.getState();

    // Check 1: Circuit Breaker (checked first)
    if (cbState === 'RED' || cbState === 'BLACK') {
      const check: RiskCheck = {
        name: 'Circuit Breaker',
        passed: false,
        value: dailyPnLPct,
        limit: cbState === 'RED' ? 0.05 : 0.15,
        message: `Circuit breaker ${cbState}: ${cbState === 'RED' ? 'daily loss > 5%' : 'drawdown > 15%'}`,
      };

      checks.push(check);

      const decision: RiskDecision = {
        approved: false,
        checks,
        reason: `Circuit breaker ${cbState} — trading halted`,
        circuitBreakerState: cbState,
      };

      logRiskDecision(signal.id, decision);
      return decision;
    }

    // Auto-adjust size if YELLOW
    let effectiveSize = requestedSize;
    if (cbState === 'YELLOW') {
      effectiveSize = requestedSize * 0.5;
    }

    // Check 2: Position Size Limit (≤ 10% NAV)
    const positionSizePct = effectiveSize / portfolio.totalValue;
    checks.push({
      name: 'Position Size',
      passed: positionSizePct <= PAPER_CONFIG.maxPositionPct,
      value: positionSizePct,
      limit: PAPER_CONFIG.maxPositionPct,
      message:
        positionSizePct <= PAPER_CONFIG.maxPositionPct
          ? 'Position size within limit'
          : `Position size ${(positionSizePct * 100).toFixed(1)}% exceeds 10% limit`,
    });

    // Check 3: Sector Exposure (≤ 30%)
    const asset = getAsset(signal.symbol);
    const sector = asset?.sector || 'Unknown';

    let currentSectorExposure = 0;
    for (const [sym, pos] of portfolio.positions.entries()) {
      const posAsset = getAsset(sym);
      if (posAsset?.sector === sector) {
        currentSectorExposure += pos.marketValue;
      }
    }

    const newSectorExposure = currentSectorExposure + effectiveSize;
    const sectorExposurePct = newSectorExposure / portfolio.totalValue;

    checks.push({
      name: 'Sector Exposure',
      passed: sectorExposurePct <= PAPER_CONFIG.maxSectorPct,
      value: sectorExposurePct,
      limit: PAPER_CONFIG.maxSectorPct,
      message:
        sectorExposurePct <= PAPER_CONFIG.maxSectorPct
          ? `${sector} sector exposure within limit`
          : `${sector} sector exposure ${(sectorExposurePct * 100).toFixed(1)}% exceeds 30% limit`,
    });

    // Check 4: Portfolio Heat (≤ 0.8)
    const currentHeat = await this.calculatePortfolioHeat(portfolio);
    const newPositionWeight = effectiveSize / portfolio.totalValue;
    const assetVolatility = await this.getAssetVolatility(signal.symbol);
    const newHeat = newPositionWeight * assetVolatility;
    const totalHeat = currentHeat + newHeat;

    checks.push({
      name: 'Portfolio Heat',
      passed: totalHeat <= 0.8,
      value: totalHeat,
      limit: 0.8,
      message:
        totalHeat <= 0.8
          ? 'Portfolio heat within limit'
          : `Portfolio heat ${(totalHeat * 100).toFixed(1)}% exceeds 80% limit`,
    });

    // Check 5: Daily Loss (< 5%)
    checks.push({
      name: 'Daily Loss Limit',
      passed: dailyPnLPct > -PAPER_CONFIG.maxDailyLossPct,
      value: dailyPnLPct,
      limit: -PAPER_CONFIG.maxDailyLossPct,
      message:
        dailyPnLPct > -PAPER_CONFIG.maxDailyLossPct
          ? 'Daily loss within limit'
          : `Daily loss ${(Math.abs(dailyPnLPct) * 100).toFixed(2)}% exceeds 5% limit`,
    });

    // Check 6: Drawdown (< 15%)
    checks.push({
      name: 'Drawdown Limit',
      passed: drawdown < PAPER_CONFIG.maxDrawdownPct,
      value: drawdown,
      limit: PAPER_CONFIG.maxDrawdownPct,
      message:
        drawdown < PAPER_CONFIG.maxDrawdownPct
          ? 'Drawdown within limit'
          : `Drawdown ${(drawdown * 100).toFixed(2)}% exceeds 15% limit`,
    });

    // Check 7: Sector Concentration (max 3 positions per sector)
    let sectorPositionCount = 0;
    for (const [sym] of portfolio.positions.entries()) {
      const posAsset = getAsset(sym);
      if (posAsset?.sector === sector) {
        sectorPositionCount++;
      }
    }

    checks.push({
      name: 'Sector Position Count',
      passed: sectorPositionCount < 3,
      value: sectorPositionCount,
      limit: 3,
      message:
        sectorPositionCount < 3
          ? `${sector} position count within limit`
          : `Already have 3 positions in ${sector} sector`,
    });

    // Check 8: Signal Diversity (max 2 positions from same strategy)
    let strategyPositionCount = 0;
    for (const trade of portfolio.openTrades) {
      if (trade.strategy === signal.strategy) {
        strategyPositionCount++;
      }
    }

    checks.push({
      name: 'Signal Diversity',
      passed: strategyPositionCount < 2,
      value: strategyPositionCount,
      limit: 2,
      message:
        strategyPositionCount < 2
          ? 'Strategy diversity maintained'
          : `Already have 2 positions from ${signal.strategy} strategy`,
    });

    // Check 9: Correlation (< 0.8 with any existing position)
    const correlationCheck = await this.checkCorrelation(signal.symbol, portfolio);
    checks.push(correlationCheck);

    // Check 10: Liquidity (order size < 1% of ADV)
    const avgDailyVolume = asset?.avgDailyVolume || 1_000_000;
    const orderShares = effectiveSize / currentPrice;
    const liquidityPct = orderShares / avgDailyVolume;

    checks.push({
      name: 'Liquidity',
      passed: liquidityPct < 0.01,
      value: liquidityPct,
      limit: 0.01,
      message:
        liquidityPct < 0.01
          ? 'Order size within liquidity limit'
          : `Order size ${(liquidityPct * 100).toFixed(2)}% of ADV exceeds 1% limit`,
    });

    // Bonus Check 11: Bid-Ask Spread (< 0.5%)
    // For paper trading, assume spread is 0.1% (realistic for liquid ETFs)
    const spreadPct = 0.001; // 0.1% assumed spread
    checks.push({
      name: 'Bid-Ask Spread',
      passed: spreadPct < 0.005,
      value: spreadPct,
      limit: 0.005,
      message: 'Spread within acceptable range',
    });

    // Determine if approved (ALL checks must pass)
    const allPassed = checks.every(check => check.passed);

    const decision: RiskDecision = {
      approved: allPassed,
      adjustedSize: cbState === 'YELLOW' ? effectiveSize : undefined,
      checks,
      reason: allPassed
        ? undefined
        : checks.find(c => !c.passed)?.message || 'Risk check failed',
      circuitBreakerState: cbState,
    };

    // Log decision
    logRiskDecision(signal.id, decision);

    return decision;
  }

  /**
   * Calculate current portfolio heat
   * Heat = sum of (position_weight * volatility)
   */
  private async calculatePortfolioHeat(portfolio: PortfolioState): Promise<number> {
    let totalHeat = 0;

    for (const [symbol, position] of portfolio.positions.entries()) {
      const weight = position.marketValue / portfolio.totalValue;
      const volatility = await this.getAssetVolatility(symbol);
      totalHeat += weight * volatility;
    }

    return totalHeat;
  }

  /**
   * Get asset volatility (20-day annualized)
   */
  private async getAssetVolatility(symbol: string): Promise<number> {
    try {
      const indicators = await getCachedIndicators(symbol);

      if (indicators && indicators.atr14) {
        // ATR as proxy for volatility
        // ATR is in price units, need to convert to %
        const latestPrice = indicators.candles[indicators.candles.length - 1]?.close || 100;
        const volatility = indicators.atr14 / latestPrice;

        // Annualize (ATR is daily, multiply by sqrt(252))
        return volatility * Math.sqrt(252);
      }
    } catch (error) {
      // Fallback volatility estimates by asset class
    }

    // Fallback: use beta as volatility proxy
    const asset = getAsset(symbol);
    if (asset) {
      // Assume SPY volatility is 0.18 (18%), scale by beta
      return 0.18 * Math.abs(asset.beta);
    }

    return 0.20; // Default 20% volatility
  }

  /**
   * Check correlation between new symbol and existing positions
   */
  private async checkCorrelation(
    symbol: string,
    portfolio: PortfolioState
  ): Promise<RiskCheck> {
    // Get historical returns for new symbol
    const newReturns = await this.getHistoricalReturns(symbol, 20);

    if (newReturns.length < 10) {
      // Not enough data, pass check
      return {
        name: 'Correlation',
        passed: true,
        value: 0,
        limit: 0.8,
        message: 'Insufficient data for correlation check',
      };
    }

    // Check correlation with each existing position
    for (const [existingSymbol] of portfolio.positions.entries()) {
      const existingReturns = await this.getHistoricalReturns(existingSymbol, 20);

      if (existingReturns.length < 10) continue;

      const correlation = this.calculateCorrelation(newReturns, existingReturns);

      if (Math.abs(correlation) > 0.8) {
        return {
          name: 'Correlation',
          passed: false,
          value: correlation,
          limit: 0.8,
          message: `High correlation ${(correlation * 100).toFixed(0)}% with ${existingSymbol}`,
        };
      }
    }

    return {
      name: 'Correlation',
      passed: true,
      value: 0,
      limit: 0.8,
      message: 'Correlation check passed',
    };
  }

  /**
   * Get historical returns for a symbol
   */
  private async getHistoricalReturns(symbol: string, days: number): Promise<number[]> {
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
   * Calculate correlation between two return series
   */
  private calculateCorrelation(returns1: number[], returns2: number[]): number {
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
   * Get circuit breaker instance
   */
  getCircuitBreaker(): CircuitBreaker {
    return this.circuitBreaker;
  }
}

/**
 * Global risk manager instance
 */
export const riskManager = new RiskManager();
