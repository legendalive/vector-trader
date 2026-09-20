export type OperationalState = 'at_rest' | 'scanning' | 'ai_analyzing' | 'trade_running';

export type TradeDirection = 'BUY' | 'SELL';
export type TradeOutcome = 'WIN' | 'LOSS' | 'ACTIVE';

export interface AIAnalysisResult {
  approved: boolean;
  confidenceScore: number;
  marketRegime: string;
  reasoning: string;
  adjustedLotSizeMultiplier: number;
  isAiOffline?: boolean;
  warningBadge?: string | null;
}

export interface AIDecisionLog {
  id: string;
  timestamp: string;
  symbol: string;
  signal: 'BUY' | 'SELL';
  approved: boolean;
  confidenceScore: number;
  marketRegime: string;
  reasoning: string;
  adjustedLotSizeMultiplier: number;
  originalLotSize: number;
  finalLotSize: number;
  isAiOffline?: boolean;
  warningBadge?: string | null;
  indicators?: {
    fastEma?: number;
    slowEma?: number;
    rsi?: number;
    atr?: number;
    spread?: number;
  };
}

export interface Trade {
  id: string;
  symbol: string;
  type: TradeDirection;
  lotSize: number;
  entryPrice: number;
  exitPrice?: number;
  currentPrice?: number;
  stopLoss: number;
  takeProfit: number;
  netPnl: number;
  outcome: TradeOutcome;
  timestamp: string;
  exitTime?: string;
  pips?: number;
}

export interface AccountMetrics {
  balance: number;
  equity: number;
  freeMargin: number;
  marginUsed: number;
  todayPnl: number;
  todayPnlPercent: number;
  broker?: string;
  accountNumber?: string | number;
  currency?: string;
  leverage?: number;
  isConnected?: boolean;
}

export interface StrategyRiskSettings {
  riskPerTradePercent: number; // in % of equity (e.g., 1.0%)
  maxDailyDrawdownPercent: number; // in % (e.g., 3.0%)
  maxOpenPositions: number; // default: 1
  maxSpreadPips: number; // maximum allowable spread in pips (e.g., 2.5)
  emaFastPeriod: number; // default 9
  emaSlowPeriod: number; // default 21
  rsiPeriod: number; // default 14
  rsiOverbought: number; // default 70
  rsiOversold: number; // default 30
  atrPeriod: number; // default 14
  atrSlMultiplier: number; // default 1.5x
  atrTpMultiplier: number; // default 2.5x
  slMode: 'atr' | 'fixed_pips';
  fixedSlPips: number;
  fixedTpPips: number;
}

export const DEFAULT_STRATEGY_SETTINGS: StrategyRiskSettings = {
  riskPerTradePercent: 1.0,
  maxDailyDrawdownPercent: 3.0,
  maxOpenPositions: 1,
  maxSpreadPips: 3.0,
  emaFastPeriod: 9,
  emaSlowPeriod: 21,
  rsiPeriod: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  atrPeriod: 14,
  atrSlMultiplier: 1.5,
  atrTpMultiplier: 2.5,
  slMode: 'atr',
  fixedSlPips: 20,
  fixedTpPips: 40,
};

export interface AppSettings extends StrategyRiskSettings {
  bridgeUrl: string;
  geminiApiKey: string;
  maxRiskPerTrade: number; // alias for riskPerTradePercent
  maxDailyDrawdown: number; // alias for maxDailyDrawdownPercent
  bridgeConnected: boolean;
  configured: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  ...DEFAULT_STRATEGY_SETTINGS,
  bridgeUrl: 'ws://localhost:8080',
  geminiApiKey: '',
  maxRiskPerTrade: 1.0,
  maxDailyDrawdown: 3.0,
  bridgeConnected: false,
  configured: false,
};

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface TickData {
  symbol: string;
  bid: number;
  ask: number;
  spreadPips: number;
  timestamp: number;
}

export interface RiskCheckItem {
  passed: boolean;
  message: string;
  value?: number | string;
  threshold?: number | string;
}

export interface SetupEvaluationResult {
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  reason: string;
  calculatedLotSize: number;
  slPrice: number;
  tpPrice: number;
  riskPassed: boolean;
  indicators: {
    fastEma: number;
    slowEma: number;
    rsi: number;
    atr: number;
    currentSpreadPips: number;
  };
  riskChecks: {
    maxDrawdownCheck: RiskCheckItem;
    maxPositionsCheck: RiskCheckItem;
    spreadCheck: RiskCheckItem;
    positionSizeCheck: RiskCheckItem;
  };
  timestamp: string;
}

export interface RuleEvaluationLog {
  id: string;
  timestamp: string;
  symbol: string;
  signal: 'BUY' | 'SELL' | 'NEUTRAL';
  riskPassed: boolean;
  reason: string;
  lotSize: number;
  slPrice: number;
  tpPrice: number;
  indicators: {
    fastEma: number;
    slowEma: number;
    rsi: number;
    atr: number;
    spread: number;
  };
}

export const AVAILABLE_SYMBOLS = [
  { symbol: 'EURUSD', name: 'Euro / US Dollar', category: 'Forex', digits: 5, spread: 0.8 },
  { symbol: 'GBPUSD', name: 'British Pound / US Dollar', category: 'Forex', digits: 5, spread: 1.1 },
  { symbol: 'XAUUSD', name: 'Gold / US Dollar', category: 'Metals', digits: 2, spread: 18 },
  { symbol: 'BTCUSD', name: 'Bitcoin / US Dollar', category: 'Crypto', digits: 2, spread: 45 },
  { symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', category: 'Forex', digits: 3, spread: 0.9 },
  { symbol: 'US30', name: 'Wall Street 30 Index', category: 'Indices', digits: 1, spread: 2.0 },
  { symbol: 'NAS100', name: 'US Tech 100 Index', category: 'Indices', digits: 1, spread: 1.5 },
];
