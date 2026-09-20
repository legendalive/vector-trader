// RuleEngine: Deterministic Client-Side Strategy & Risk Management System
// Validates all trade conditions, indicator triggers, and enforces hard risk guardrails
// BEFORE any execution payload reaches ExecutionEngine or MetaTrader 5.

import {
  AccountMetrics,
  Candle,
  SetupEvaluationResult,
  RuleEvaluationLog,
  StrategyRiskSettings,
  DEFAULT_STRATEGY_SETTINGS,
  AVAILABLE_SYMBOLS,
  Trade,
} from '@/types/trading';
import { StorageService } from '@/lib/storage';

export type EvaluationListener = (result: SetupEvaluationResult, log: RuleEvaluationLog) => void;
export type CircuitBreakerListener = (reason: string, currentDrawdownPercent: number) => void;

export interface EvaluateSetupParams {
  symbol: string;
  currentPrice: number;
  bid?: number;
  ask?: number;
  spreadPips?: number;
  candles?: Candle[];
  recentPrices?: number[];
  accountState: AccountMetrics;
  activePositions?: Trade[];
  strategySettings?: Partial<StrategyRiskSettings>;
}

export class RuleEngineService {
  private strategySettings: StrategyRiskSettings = { ...DEFAULT_STRATEGY_SETTINGS };
  private evaluationListeners: Set<EvaluationListener> = new Set();
  private circuitBreakerListeners: Set<CircuitBreakerListener> = new Set();
  public evaluationLogs: RuleEvaluationLog[] = [];
  private readonly maxLogs: number = 50;

  // Cached synthetic / real candles per symbol to support continuous indicator calculation
  private candleHistory: Map<string, Candle[]> = new Map();

  constructor() {
    this.loadSettings();
  }

  public loadSettings(): void {
    if (typeof window !== 'undefined') {
      try {
        const stored = StorageService.getSettings();
        if (stored) {
          this.strategySettings = {
            riskPerTradePercent: stored.riskPerTradePercent ?? stored.maxRiskPerTrade ?? DEFAULT_STRATEGY_SETTINGS.riskPerTradePercent,
            maxDailyDrawdownPercent: stored.maxDailyDrawdownPercent ?? stored.maxDailyDrawdown ?? DEFAULT_STRATEGY_SETTINGS.maxDailyDrawdownPercent,
            maxOpenPositions: stored.maxOpenPositions ?? DEFAULT_STRATEGY_SETTINGS.maxOpenPositions,
            maxSpreadPips: stored.maxSpreadPips ?? DEFAULT_STRATEGY_SETTINGS.maxSpreadPips,
            emaFastPeriod: stored.emaFastPeriod ?? DEFAULT_STRATEGY_SETTINGS.emaFastPeriod,
            emaSlowPeriod: stored.emaSlowPeriod ?? DEFAULT_STRATEGY_SETTINGS.emaSlowPeriod,
            rsiPeriod: stored.rsiPeriod ?? DEFAULT_STRATEGY_SETTINGS.rsiPeriod,
            rsiOverbought: stored.rsiOverbought ?? DEFAULT_STRATEGY_SETTINGS.rsiOverbought,
            rsiOversold: stored.rsiOversold ?? DEFAULT_STRATEGY_SETTINGS.rsiOversold,
            atrPeriod: stored.atrPeriod ?? DEFAULT_STRATEGY_SETTINGS.atrPeriod,
            atrSlMultiplier: stored.atrSlMultiplier ?? DEFAULT_STRATEGY_SETTINGS.atrSlMultiplier,
            atrTpMultiplier: stored.atrTpMultiplier ?? DEFAULT_STRATEGY_SETTINGS.atrTpMultiplier,
            slMode: stored.slMode ?? DEFAULT_STRATEGY_SETTINGS.slMode,
            fixedSlPips: stored.fixedSlPips ?? DEFAULT_STRATEGY_SETTINGS.fixedSlPips,
            fixedTpPips: stored.fixedTpPips ?? DEFAULT_STRATEGY_SETTINGS.fixedTpPips,
          };
        }
      } catch (e) {
        console.warn('[RuleEngine] Could not load stored strategy settings', e);
      }
    }
  }

  public updateSettings(newSettings: Partial<StrategyRiskSettings>): void {
    this.strategySettings = {
      ...this.strategySettings,
      ...newSettings,
    };
  }

  public getSettings(): StrategyRiskSettings {
    return { ...this.strategySettings };
  }

  // -------------------------------------------------------------
  // Technical Indicator Mathematics
  // -------------------------------------------------------------

  /**
   * Exponential Moving Average (EMA)
   */
  public calculateEMA(prices: number[], period: number): number[] {
    const cleanPrices = prices.filter((p) => typeof p === 'number' && Number.isFinite(p));
    if (cleanPrices.length === 0) return [];
    if (period <= 0) return [...cleanPrices];

    const k = 2 / (period + 1);
    const emaArray: number[] = [];

    // First EMA is simple average of initial period (or initial price if insufficient data)
    let initialCount = Math.min(period, cleanPrices.length);
    let sum = 0;
    for (let i = 0; i < initialCount; i++) {
      sum += cleanPrices[i];
    }
    let prevEMA = sum / Math.max(1, initialCount);
    if (!Number.isFinite(prevEMA)) prevEMA = cleanPrices[0] || 0;
    emaArray.push(prevEMA);

    for (let i = 1; i < cleanPrices.length; i++) {
      const currentEMA = cleanPrices[i] * k + prevEMA * (1 - k);
      const safeEMA = Number.isFinite(currentEMA) ? currentEMA : prevEMA;
      emaArray.push(safeEMA);
      prevEMA = safeEMA;
    }

    return emaArray;
  }

  /**
   * Relative Strength Index (RSI) using Wilder's smoothed method
   */
  public calculateRSI(closes: number[], period: number = 14): number[] {
    const cleanCloses = closes.filter((c) => typeof c === 'number' && Number.isFinite(c));
    if (cleanCloses.length <= 1) return [50];
    const rsiArray: number[] = [];

    let gains = 0;
    let losses = 0;

    const limit = Math.min(period, cleanCloses.length - 1);
    for (let i = 1; i <= limit; i++) {
      const diff = cleanCloses[i] - cleanCloses[i - 1];
      if (diff >= 0) gains += diff;
      else losses += Math.abs(diff);
    }

    let avgGain = gains / Math.max(1, limit);
    let avgLoss = losses / Math.max(1, limit);

    const calcCurrentRsi = (g: number, l: number): number => {
      if (l === 0) return 100;
      const rs = g / l;
      const val = 100 - 100 / (1 + rs);
      return Number.isFinite(val) ? val : 50;
    };

    rsiArray.push(calcCurrentRsi(avgGain, avgLoss));

    for (let i = limit + 1; i < cleanCloses.length; i++) {
      const diff = cleanCloses[i] - cleanCloses[i - 1];
      const currentGain = diff > 0 ? diff : 0;
      const currentLoss = diff < 0 ? Math.abs(diff) : 0;

      avgGain = (avgGain * (period - 1) + currentGain) / period;
      avgLoss = (avgLoss * (period - 1) + currentLoss) / period;

      rsiArray.push(calcCurrentRsi(avgGain, avgLoss));
    }

    return rsiArray;
  }

  /**
   * Average True Range (ATR)
   */
  public calculateATR(candles: Candle[], period: number = 14): number[] {
    const cleanCandles = candles.filter(
      (c) =>
        c &&
        Number.isFinite(c.high) &&
        Number.isFinite(c.low) &&
        Number.isFinite(c.close) &&
        c.high >= c.low
    );

    if (cleanCandles.length === 0) return [0];
    if (cleanCandles.length === 1) {
      return [Math.max(0, cleanCandles[0].high - cleanCandles[0].low)];
    }

    const trValues: number[] = [];
    trValues.push(Math.max(0, cleanCandles[0].high - cleanCandles[0].low));

    for (let i = 1; i < cleanCandles.length; i++) {
      const current = cleanCandles[i];
      const prev = cleanCandles[i - 1];
      const tr = Math.max(
        current.high - current.low,
        Math.abs(current.high - prev.close),
        Math.abs(current.low - prev.close)
      );
      trValues.push(Number.isFinite(tr) ? tr : 0);
    }

    // Moving average of True Range
    const atrValues: number[] = [];
    let initialSum = 0;
    const initialCount = Math.min(period, trValues.length);
    for (let i = 0; i < initialCount; i++) {
      initialSum += trValues[i];
    }
    let prevATR = initialSum / Math.max(1, initialCount);
    if (!Number.isFinite(prevATR)) prevATR = 0;
    atrValues.push(prevATR);

    for (let i = initialCount; i < trValues.length; i++) {
      const currentATR = (prevATR * (period - 1) + trValues[i]) / period;
      const safeATR = Number.isFinite(currentATR) ? currentATR : prevATR;
      atrValues.push(safeATR);
      prevATR = safeATR;
    }

    return atrValues;
  }

  // -------------------------------------------------------------
  // Symbol & Pip Normalization
  // -------------------------------------------------------------

  public getPipSize(symbol: string): number {
    const sym = AVAILABLE_SYMBOLS.find((s) => s.symbol === symbol);
    if (!sym) return 0.0001;
    if (sym.digits === 5) return 0.0001;
    if (sym.digits === 3) return 0.01;
    if (sym.digits === 2) return 0.1; // Gold/Crypto
    if (sym.digits === 1) return 1.0; // Indices
    return 0.0001;
  }

  public getPipValuePerStandardLot(symbol: string): number {
    if (symbol === 'EURUSD' || symbol === 'GBPUSD') return 10.0;
    if (symbol === 'USDJPY') return 9.2;
    if (symbol === 'XAUUSD') return 10.0; // 100 oz contract
    if (symbol === 'BTCUSD') return 1.0;
    if (symbol === 'US30' || symbol === 'NAS100') return 5.0;
    return 10.0;
  }

  // -------------------------------------------------------------
  // Hard Risk Guardrail Checks
  // -------------------------------------------------------------

  /**
   * Dynamic Position Sizing:
   * lotSize = (equity * riskPercent) / (slPips * pipValuePerLot)
   */
  public calculatePositionSize(
    equity: number,
    riskPercent: number,
    slPips: number,
    symbol: string
  ): {
    lotSize: number;
    riskAmount: number;
    slPips: number;
    pipValue: number;
    isValid: boolean;
    reason: string;
  } {
    const effectiveEquity = Math.max(0, Number(equity) || 0);
    const effectiveRiskPercent = Math.max(0.1, Math.min(10.0, Number(riskPercent) || 1.0));
    const effectiveSlPips = Math.max(2.0, Number(slPips) || 15.0);
    const pipValue = this.getPipValuePerStandardLot(symbol);

    const riskAmount = Number(((effectiveEquity * effectiveRiskPercent) / 100).toFixed(2));

    if (effectiveEquity <= 0) {
      return {
        lotSize: 0.01,
        riskAmount: 0,
        slPips: effectiveSlPips,
        pipValue,
        isValid: false,
        reason: 'Account equity is zero or negative.',
      };
    }

    // Standard formula: lotSize = Risk Amount / (Stop Loss in Pips * Pip Value per Lot)
    const rawLot = riskAmount / (effectiveSlPips * pipValue);
    const validRawLot = Number.isFinite(rawLot) && rawLot > 0 ? rawLot : 0.01;

    // Clamped between 0.01 and 50.00 lots, rounded to step 0.01
    const steppedLot = Math.round(validRawLot * 100) / 100;
    const lotSize = Math.max(0.01, Math.min(50.0, steppedLot));

    return {
      lotSize,
      riskAmount,
      slPips: Number(effectiveSlPips.toFixed(1)),
      pipValue,
      isValid: true,
      reason: `Calculated ${lotSize} lots based on $${riskAmount} risk (${effectiveRiskPercent}% equity) over ${effectiveSlPips.toFixed(1)} SL pips.`,
    };
  }

  /**
   * Max Daily Drawdown Circuit Breaker:
   * Closed losses + floating losses must NOT exceed maxDailyDrawdown threshold.
   */
  public checkDailyDrawdown(
    accountState: AccountMetrics,
    activePositions: Trade[] = [],
    maxDailyDrawdownPercent?: number
  ): {
    passed: boolean;
    currentDrawdownPercent: number;
    limitPercent: number;
    message: string;
  } {
    const limit = maxDailyDrawdownPercent ?? this.strategySettings.maxDailyDrawdownPercent;
    const balance = accountState.balance || 10000;
    const closedDailyPnl = accountState.todayPnl || 0;

    // Floating loss of active positions
    const floatingPnl = activePositions.reduce((sum, pos) => sum + (pos.netPnl || 0), 0);

    const totalLoss = Math.min(0, closedDailyPnl + floatingPnl);
    const currentDrawdownPercent = balance > 0 ? (Math.abs(totalLoss) / balance) * 100 : 0;

    const passed = currentDrawdownPercent < limit;
    const message = passed
      ? `Daily drawdown at ${currentDrawdownPercent.toFixed(2)}% (below safety threshold of ${limit.toFixed(1)}%).`
      : `CIRCUIT BREAKER TRIGGERED: Daily drawdown ${currentDrawdownPercent.toFixed(2)}% exceeds limit of ${limit.toFixed(1)}%. Trading halted!`;

    if (!passed) {
      this.notifyCircuitBreaker(message, currentDrawdownPercent);
    }

    return {
      passed,
      currentDrawdownPercent: Number(currentDrawdownPercent.toFixed(2)),
      limitPercent: limit,
      message,
    };
  }

  /**
   * Max Open Positions Limit Guard:
   */
  public checkMaxPositions(
    activePositions: Trade[] = [],
    maxAllowed?: number
  ): {
    passed: boolean;
    activeCount: number;
    maxAllowed: number;
    message: string;
  } {
    const limit = maxAllowed ?? this.strategySettings.maxOpenPositions;
    const activeCount = activePositions.length;
    const passed = activeCount < limit;

    const message = passed
      ? `Open positions ${activeCount}/${limit} (capacity available).`
      : `Max open positions limit reached (${activeCount}/${limit}). Blocking new executions.`;

    return {
      passed,
      activeCount,
      maxAllowed: limit,
      message,
    };
  }

  /**
   * Spread & Slippage Guard:
   */
  public checkSpread(
    currentSpreadPips: number,
    maxAllowedPips?: number
  ): {
    passed: boolean;
    spreadPips: number;
    maxAllowedPips: number;
    message: string;
  } {
    const limit = maxAllowedPips ?? this.strategySettings.maxSpreadPips;
    const passed = currentSpreadPips <= limit;
    const message = passed
      ? `Current spread ${currentSpreadPips.toFixed(1)} pips is within acceptable threshold (max ${limit.toFixed(1)} pips).`
      : `High spread rejection: Current ${currentSpreadPips.toFixed(1)} pips exceeds maximum allowable ${limit.toFixed(1)} pips.`;

    return {
      passed,
      spreadPips: Number(currentSpreadPips.toFixed(1)),
      maxAllowedPips: limit,
      message,
    };
  }

  // -------------------------------------------------------------
  // Synthetic Data Feeder for Testing & Seamless Analysis
  // -------------------------------------------------------------

  public ensureCandleHistory(symbol: string, currentPrice: number): Candle[] {
    let candles = this.candleHistory.get(symbol);
    if (!candles || candles.length < 35) {
      // Generate realistic recent candle history for technical indicator continuity
      const pipSize = this.getPipSize(symbol);
      const generated: Candle[] = [];
      let lastClose = currentPrice - pipSize * 15;
      const now = Date.now();

      for (let i = 50; i >= 0; i--) {
        const time = now - i * 60000;
        const volatility = pipSize * (5 + Math.random() * 8);
        const direction = Math.random() > 0.48 ? 1 : -1;
        const open = lastClose;
        const close = open + direction * volatility * 0.6;
        const high = Math.max(open, close) + Math.random() * volatility * 0.4;
        const low = Math.min(open, close) - Math.random() * volatility * 0.4;
        lastClose = close;
        generated.push({ time, open, high, low, close, volume: Math.floor(100 + Math.random() * 500) });
      }
      // Ensure the latest candle closes at currentPrice
      generated[generated.length - 1].close = currentPrice;
      candles = generated;
      this.candleHistory.set(symbol, candles);
    } else {
      // Append or update current candle
      const last = candles[candles.length - 1];
      last.close = currentPrice;
      last.high = Math.max(last.high, currentPrice);
      last.low = Math.min(last.low, currentPrice);
    }
    return candles;
  }

  // -------------------------------------------------------------
  // Deterministic Evaluation Pipeline: evaluateSetup(...)
  // -------------------------------------------------------------

  public evaluateSetup({
    symbol,
    currentPrice,
    bid,
    ask,
    spreadPips,
    candles,
    recentPrices,
    accountState,
    activePositions = [],
    strategySettings,
  }: EvaluateSetupParams): SetupEvaluationResult {
    const config: StrategyRiskSettings = {
      ...this.strategySettings,
      ...strategySettings,
    };

    const symConfig = AVAILABLE_SYMBOLS.find((s) => s.symbol === symbol) || AVAILABLE_SYMBOLS[0];
    const pipSize = this.getPipSize(symbol);

    // Data Validation Guard 1: Incomplete price tick check (NaN or non-positive price)
    if (
      typeof currentPrice !== 'number' ||
      isNaN(currentPrice) ||
      !Number.isFinite(currentPrice) ||
      currentPrice <= 0
    ) {
      return {
        signal: 'NEUTRAL',
        reason: 'Data Validation Guard: Incomplete price tick (NaN or non-positive price) ignored. Unintended order trigger prevented.',
        calculatedLotSize: 0,
        slPrice: 0,
        tpPrice: 0,
        riskPassed: false,
        indicators: {
          fastEma: 0,
          slowEma: 0,
          rsi: 50,
          atr: 0,
          currentSpreadPips: 0,
        },
        riskChecks: {
          maxDrawdownCheck: { passed: false, message: 'Data Validation Guard: Incomplete price tick' },
          maxPositionsCheck: { passed: false, message: 'Data Validation Guard: Incomplete price tick' },
          spreadCheck: { passed: false, message: 'Data Validation Guard: Incomplete price tick' },
          positionSizeCheck: { passed: false, message: 'Data Validation Guard: Incomplete price tick' },
        },
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
    }

    // Compute effective spread
    const effectiveSpreadPips =
      spreadPips !== undefined
        ? spreadPips
        : bid && ask
        ? Number(((ask - bid) / pipSize).toFixed(1))
        : symConfig.spread;

    // Retrieve or populate candle array
    const effectiveCandles = candles && candles.length >= 25
      ? candles
      : this.ensureCandleHistory(symbol, currentPrice);

    const rawCloses = recentPrices && recentPrices.length >= 25
      ? recentPrices
      : effectiveCandles.map((c) => c.close);

    // Sanitize closes array (filter out any NaN or non-finite historical values)
    const closes = rawCloses.filter((p) => typeof p === 'number' && Number.isFinite(p) && p > 0);
    if (closes.length < 5) {
      return {
        signal: 'NEUTRAL',
        reason: 'Data Validation Guard: Insufficient valid price history. Discarded to prevent unintended order triggers.',
        calculatedLotSize: 0,
        slPrice: 0,
        tpPrice: 0,
        riskPassed: false,
        indicators: {
          fastEma: currentPrice,
          slowEma: currentPrice,
          rsi: 50,
          atr: pipSize * 15,
          currentSpreadPips: effectiveSpreadPips,
        },
        riskChecks: {
          maxDrawdownCheck: { passed: false, message: 'Data Validation Guard: Insufficient history' },
          maxPositionsCheck: { passed: false, message: 'Data Validation Guard: Insufficient history' },
          spreadCheck: { passed: false, message: 'Data Validation Guard: Insufficient history' },
          positionSizeCheck: { passed: false, message: 'Data Validation Guard: Insufficient history' },
        },
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
    }

    // 1. Calculate Technical Indicators
    const fastEmas = this.calculateEMA(closes, config.emaFastPeriod);
    const slowEmas = this.calculateEMA(closes, config.emaSlowPeriod);
    const rsiSeries = this.calculateRSI(closes, config.rsiPeriod);
    const atrSeries = this.calculateATR(effectiveCandles, config.atrPeriod);

    const fastEma = fastEmas[fastEmas.length - 1] ?? currentPrice;
    const slowEma = slowEmas[slowEmas.length - 1] ?? currentPrice;
    const rsi = Number((rsiSeries[rsiSeries.length - 1] ?? 50).toFixed(1));
    const rawAtr = atrSeries[atrSeries.length - 1] || pipSize * 15;
    const atr = Number(rawAtr.toFixed(symConfig.digits));

    // Data Validation Guard 2: NaN indicator output check
    if (
      isNaN(fastEma) ||
      !Number.isFinite(fastEma) ||
      isNaN(slowEma) ||
      !Number.isFinite(slowEma) ||
      isNaN(rsi) ||
      !Number.isFinite(rsi) ||
      isNaN(atr) ||
      !Number.isFinite(atr) ||
      atr <= 0
    ) {
      return {
        signal: 'NEUTRAL',
        reason: 'Data Validation Guard: NaN or non-finite indicator output detected. Discarded to prevent unintended order triggers.',
        calculatedLotSize: 0,
        slPrice: 0,
        tpPrice: 0,
        riskPassed: false,
        indicators: {
          fastEma: Number.isFinite(fastEma) ? fastEma : currentPrice,
          slowEma: Number.isFinite(slowEma) ? slowEma : currentPrice,
          rsi: Number.isFinite(rsi) ? rsi : 50,
          atr: Number.isFinite(atr) && atr > 0 ? atr : pipSize * 15,
          currentSpreadPips: effectiveSpreadPips,
        },
        riskChecks: {
          maxDrawdownCheck: { passed: false, message: 'Data Validation Guard: NaN indicator output' },
          maxPositionsCheck: { passed: false, message: 'Data Validation Guard: NaN indicator output' },
          spreadCheck: { passed: false, message: 'Data Validation Guard: NaN indicator output' },
          positionSizeCheck: { passed: false, message: 'Data Validation Guard: NaN indicator output' },
        },
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
    }

    // Determine Technical Signal
    let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
    let technicalReason = '';

    const isFastAboveSlow = fastEma > slowEma;
    const emaDiff = Math.abs(fastEma - slowEma);
    const emaThreshold = pipSize * 0.5;

    if (isFastAboveSlow && emaDiff >= emaThreshold) {
      if (rsi < config.rsiOverbought) {
        signal = 'BUY';
        technicalReason = `Bullish EMA Crossover (${config.emaFastPeriod} EMA > ${config.emaSlowPeriod} EMA) confirmed with RSI ${rsi} (below ${config.rsiOverbought} overbought barrier).`;
      } else {
        signal = 'NEUTRAL';
        technicalReason = `Bullish EMA crossover suppressed: RSI ${rsi} in overbought zone (> ${config.rsiOverbought}).`;
      }
    } else if (!isFastAboveSlow && emaDiff >= emaThreshold) {
      if (rsi > config.rsiOversold) {
        signal = 'SELL';
        technicalReason = `Bearish EMA Crossover (${config.emaFastPeriod} EMA < ${config.emaSlowPeriod} EMA) confirmed with RSI ${rsi} (above ${config.rsiOversold} oversold floor).`;
      } else {
        signal = 'NEUTRAL';
        technicalReason = `Bearish EMA crossover suppressed: RSI ${rsi} in oversold zone (< ${config.rsiOversold}).`;
      }
    } else {
      signal = 'NEUTRAL';
      technicalReason = `Market converging or range-bound (EMA difference ${Number((emaDiff / pipSize).toFixed(1))} pips is below trigger threshold).`;
    }

    // 2. Stop Loss & Take Profit Price Calculation
    let slDistancePips = 15;
    let tpDistancePips = 30;

    if (config.slMode === 'atr') {
      const atrPips = rawAtr / pipSize;
      slDistancePips = Math.max(5, atrPips * config.atrSlMultiplier);
      tpDistancePips = Math.max(10, atrPips * config.atrTpMultiplier);
    } else {
      slDistancePips = config.fixedSlPips;
      tpDistancePips = config.fixedTpPips;
    }

    const slDistancePrice = slDistancePips * pipSize;
    const tpDistancePrice = tpDistancePips * pipSize;

    let slPrice = currentPrice;
    let tpPrice = currentPrice;

    if (signal === 'BUY') {
      slPrice = Number((currentPrice - slDistancePrice).toFixed(symConfig.digits));
      tpPrice = Number((currentPrice + tpDistancePrice).toFixed(symConfig.digits));
    } else if (signal === 'SELL') {
      slPrice = Number((currentPrice + slDistancePrice).toFixed(symConfig.digits));
      tpPrice = Number((currentPrice - tpDistancePrice).toFixed(symConfig.digits));
    } else {
      slPrice = Number((currentPrice - slDistancePrice).toFixed(symConfig.digits));
      tpPrice = Number((currentPrice + tpDistancePrice).toFixed(symConfig.digits));
    }

    // 3. Dynamic Position Sizing Calculation
    const posSizeResult = this.calculatePositionSize(
      accountState.equity,
      config.riskPerTradePercent,
      slDistancePips,
      symbol
    );

    // 4. Hard Guardrail Checks
    const ddCheck = this.checkDailyDrawdown(accountState, activePositions, config.maxDailyDrawdownPercent);
    const posCheck = this.checkMaxPositions(activePositions, config.maxOpenPositions);
    const spreadCheck = this.checkSpread(effectiveSpreadPips, config.maxSpreadPips);
    const sizeCheck = {
      passed: posSizeResult.isValid,
      message: posSizeResult.reason,
      value: posSizeResult.lotSize,
      threshold: config.riskPerTradePercent,
    };

    const riskPassed =
      ddCheck.passed &&
      posCheck.passed &&
      spreadCheck.passed &&
      sizeCheck.passed &&
      signal !== 'NEUTRAL';

    let overallReason = technicalReason;
    if (signal === 'NEUTRAL') {
      overallReason = `Setup Neutral: ${technicalReason}`;
    } else if (!riskPassed) {
      const failures: string[] = [];
      if (!ddCheck.passed) failures.push(`[Drawdown limit breached: ${ddCheck.currentDrawdownPercent}% >= ${ddCheck.limitPercent}%]`);
      if (!posCheck.passed) failures.push(`[Max positions limit reached: ${posCheck.activeCount}/${posCheck.maxAllowed}]`);
      if (!spreadCheck.passed) failures.push(`[Spread elevated: ${spreadCheck.spreadPips} pips > ${spreadCheck.maxAllowedPips} pips]`);
      if (!sizeCheck.passed) failures.push(`[Position size error: ${sizeCheck.message}]`);
      overallReason = `Signal ${signal} rejected by Risk Guardrails: ${failures.join(' ')}`;
    } else {
      overallReason = `Trade Approved: ${technicalReason} Lot: ${posSizeResult.lotSize}, SL: ${slPrice}, TP: ${tpPrice}. All risk guardrails satisfied.`;
    }

    const timestamp = new Date().toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    const result: SetupEvaluationResult = {
      signal,
      reason: overallReason,
      calculatedLotSize: posSizeResult.lotSize,
      slPrice,
      tpPrice,
      riskPassed,
      indicators: {
        fastEma: Number(fastEma.toFixed(symConfig.digits)),
        slowEma: Number(slowEma.toFixed(symConfig.digits)),
        rsi,
        atr,
        currentSpreadPips: Number(effectiveSpreadPips.toFixed(1)),
      },
      riskChecks: {
        maxDrawdownCheck: ddCheck,
        maxPositionsCheck: posCheck,
        spreadCheck,
        positionSizeCheck: sizeCheck,
      },
      timestamp,
    };

    // Record evaluation log
    const logEntry: RuleEvaluationLog = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp,
      symbol,
      signal,
      riskPassed,
      reason: overallReason,
      lotSize: posSizeResult.lotSize,
      slPrice,
      tpPrice,
      indicators: {
        fastEma: Number(fastEma.toFixed(symConfig.digits)),
        slowEma: Number(slowEma.toFixed(symConfig.digits)),
        rsi,
        atr,
        spread: Number(effectiveSpreadPips.toFixed(1)),
      },
    };

    this.addLog(logEntry);
    this.notifyEvaluation(result, logEntry);

    return result;
  }

  // -------------------------------------------------------------
  // Listeners & Evaluation Logs Buffer
  // -------------------------------------------------------------

  public onEvaluation(listener: EvaluationListener): () => void {
    this.evaluationListeners.add(listener);
    return () => {
      this.evaluationListeners.delete(listener);
    };
  }

  public onCircuitBreaker(listener: CircuitBreakerListener): () => void {
    this.circuitBreakerListeners.add(listener);
    return () => {
      this.circuitBreakerListeners.delete(listener);
    };
  }

  private notifyEvaluation(result: SetupEvaluationResult, log: RuleEvaluationLog): void {
    for (const listener of this.evaluationListeners) {
      try {
        listener(result, log);
      } catch (e) {
        console.error('[RuleEngine] Error in evaluation listener', e);
      }
    }
  }

  private notifyCircuitBreaker(reason: string, drawdownPercent: number): void {
    for (const listener of this.circuitBreakerListeners) {
      try {
        listener(reason, drawdownPercent);
      } catch (e) {
        console.error('[RuleEngine] Error in circuit breaker listener', e);
      }
    }
  }

  private addLog(entry: RuleEvaluationLog): void {
    this.evaluationLogs.unshift(entry);
    if (this.evaluationLogs.length > this.maxLogs) {
      this.evaluationLogs.pop();
    }
  }

  public clearLogs(): void {
    this.evaluationLogs = [];
  }
}

// Export singleton instance
export const ruleEngine = new RuleEngineService();
