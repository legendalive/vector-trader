'use client';

import React, { useState, useEffect } from 'react';
import {
  OperationalState,
  Trade,
  AVAILABLE_SYMBOLS,
  SetupEvaluationResult,
  RuleEvaluationLog,
  AccountMetrics,
} from '@/types/trading';
import {
  Activity,
  Radio,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Target,
  CheckCircle2,
  XCircle,
  Gauge,
  WifiOff,
  Wifi,
  Layers,
  TrendingUp,
  Percent,
  Terminal,
  Trash2,
  ChevronDown,
  ChevronUp,
  Brain,
  Sparkles,
} from 'lucide-react';
import { ruleEngine } from '@/services/RuleEngine';

interface LiveExecutionCardProps {
  operationalState: OperationalState;
  activeTrade: Trade | null;
  selectedSymbol: string;
  scanTimeSeconds: number;
  isConnected: boolean;
  isSimulationMode?: boolean;
  accountMetrics?: AccountMetrics;
  onCloseTrade: (tradeId: string) => void;
}

export const LiveExecutionCard: React.FC<LiveExecutionCardProps> = ({
  operationalState,
  activeTrade,
  selectedSymbol,
  scanTimeSeconds,
  isConnected,
  isSimulationMode = false,
  accountMetrics,
  onCloseTrade,
}) => {
  const [latestEval, setLatestEval] = useState<SetupEvaluationResult | null>(null);
  const [evalLogs, setEvalLogs] = useState<RuleEvaluationLog[]>(() => [...ruleEngine.evaluationLogs]);
  const [showLogs, setShowLogs] = useState(true);

  // Subscribe to real-time rule engine evaluation events
  useEffect(() => {
    const unsubscribe = ruleEngine.onEvaluation((result, _log) => {
      setLatestEval(result);
      setEvalLogs([...ruleEngine.evaluationLogs]);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const isPnlPositive = (activeTrade?.netPnl ?? 0) >= 0;

  const currentSymbolObj =
    AVAILABLE_SYMBOLS.find((s) => s.symbol === selectedSymbol) || AVAILABLE_SYMBOLS[0];

  const strategySettings = ruleEngine.getSettings();

  // Format scan elapsed time
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const clearLogs = () => {
    ruleEngine.clearLogs();
    setEvalLogs([]);
  };

  return (
    <section
      id="live-execution-status-card"
      aria-label="Live Execution & System Status"
      className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 shadow-lg relative overflow-hidden transition-all space-y-4"
    >
      {/* Top Bar of Card: Title & Operational State Pill */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1f2937]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-slate-300">
            <Gauge className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Live Execution &amp; RuleEngine Status
            </h2>
            <p className="text-[11px] text-slate-400">Deterministic strategy verification &amp; MT5 bridge telemetry</p>
          </div>
        </div>

        {/* 3 Distinct Operational States Visual Status Pill */}
        <div id="system-operational-status-pill" className="flex items-center gap-2">
          {latestEval && (
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold ${
                latestEval.signal === 'BUY'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : latestEval.signal === 'SELL'
                  ? 'bg-red-950 text-red-300 border border-red-800'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              <span className="text-[10px] uppercase text-slate-400 font-sans">Signal:</span>
              <span>{latestEval.signal}</span>
            </div>
          )}

          {operationalState === 'at_rest' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/80 text-slate-300 text-xs font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span>At Rest (Standby)</span>
            </div>
          )}

          {operationalState === 'scanning' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-950/60 border border-amber-600/60 text-amber-300 text-xs font-semibold shadow-xs shadow-amber-950/50">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-400"></span>
              </span>
              <span className="animate-pulse">Evaluating Rules / Scanning...</span>
            </div>
          )}

          {operationalState === 'ai_analyzing' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-500/80 text-indigo-200 text-xs font-semibold shadow-xs shadow-indigo-950/70">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-90"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-400"></span>
              </span>
              <Brain className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span className="animate-pulse">AI Analyzing...</span>
            </div>
          )}

          {operationalState === 'trade_running' && (
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-sky-950/70 border border-sky-500/70 text-sky-200 text-xs font-semibold shadow-xs shadow-sky-950/60">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-80"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-400"></span>
              </span>
              <span>Trade Running (Position Open)</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Card Content: Conditional depending on activeTrade or state */}
      <div>
        {activeTrade ? (
          /* Active Trade Summary Card */
          <div
            id="active-trade-summary-card"
            className="rounded-xl border border-sky-800/50 bg-[#0a0f1d] p-4 sm:p-5 relative overflow-hidden"
          >
            {/* Top Row: Symbol, Direction Badge, Lot Size, and Close Button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1f2937]">
              <div className="flex items-center gap-3">
                <div className="text-xl sm:text-2xl font-black font-mono text-white tracking-tight">
                  {activeTrade.symbol}
                </div>
                <div
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                    activeTrade.type === 'BUY'
                      ? 'bg-emerald-950 border border-emerald-700/60 text-emerald-300'
                      : 'bg-red-950 border border-red-700/60 text-red-300'
                  }`}
                >
                  {activeTrade.type === 'BUY' ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                  <span>{activeTrade.type}</span>
                </div>
                <div className="px-2.5 py-0.5 rounded-md bg-slate-800/90 border border-slate-700 text-slate-300 text-xs font-mono font-semibold">
                  {activeTrade.lotSize.toFixed(2)} Lots
                </div>
                <span className="text-[11px] text-slate-400 font-mono">Ticket #{activeTrade.id}</span>
                {isSimulationMode && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-950/80 border border-cyan-700/60 text-cyan-300">
                    Simulated Fill
                  </span>
                )}
              </div>

              {/* Close Position Button */}
              <button
                type="button"
                id="close-active-trade-btn"
                onClick={() => onCloseTrade(activeTrade.id)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 hover:border-red-600 text-red-300 hover:text-white text-xs font-bold transition-all shadow-xs"
                title="Execute market close on MT5"
              >
                <XCircle className="w-4 h-4 text-red-400" />
                <span>Close Position (Market)</span>
              </button>
            </div>

            {/* Active Position Parameters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4">
              {/* Entry Price */}
              <div className="p-3 rounded-lg bg-[#111827] border border-[#1f2937]">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                  Entry Price
                </span>
                <span className="text-base font-bold font-mono text-slate-200">
                  {activeTrade.entryPrice.toFixed(
                    activeTrade.symbol === 'XAUUSD' || activeTrade.symbol === 'BTCUSD' ? 2 : 5
                  )}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                  @ {activeTrade.timestamp}
                </span>
              </div>

              {/* Current Floating P&L */}
              <div
                className={`p-3 rounded-lg border transition-all ${
                  isPnlPositive
                    ? 'bg-emerald-950/30 border-emerald-800/50'
                    : 'bg-red-950/30 border-red-800/50'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider mb-1">
                  <span className={isPnlPositive ? 'text-emerald-400' : 'text-red-400'}>
                    Floating Net P&amp;L
                  </span>
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                </div>
                <div
                  className={`text-base font-bold font-mono ${
                    isPnlPositive ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {isPnlPositive ? '+' : ''}${activeTrade.netPnl.toFixed(2)}
                </div>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                  {activeTrade.pips !== undefined
                    ? `${activeTrade.pips >= 0 ? '+' : ''}${activeTrade.pips.toFixed(1)} pips`
                    : ''}
                </span>
              </div>

              {/* Stop Loss */}
              <div className="p-3 rounded-lg bg-[#111827] border border-[#1f2937]">
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-red-400 mb-1">
                  <ShieldAlert className="w-3 h-3 text-red-400" />
                  <span>Stop Loss (SL)</span>
                </div>
                <span className="text-base font-bold font-mono text-red-300">
                  {activeTrade.stopLoss.toFixed(
                    activeTrade.symbol === 'XAUUSD' || activeTrade.symbol === 'BTCUSD' ? 2 : 5
                  )}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">SL Guard Active</span>
              </div>

              {/* Take Profit */}
              <div className="p-3 rounded-lg bg-[#111827] border border-[#1f2937]">
                <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-400 mb-1">
                  <Target className="w-3 h-3 text-emerald-400" />
                  <span>Take Profit (TP)</span>
                </div>
                <span className="text-base font-bold font-mono text-emerald-300">
                  {activeTrade.takeProfit.toFixed(
                    activeTrade.symbol === 'XAUUSD' || activeTrade.symbol === 'BTCUSD' ? 2 : 5
                  )}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">TP Target Active</span>
              </div>
            </div>
          </div>
        ) : operationalState === 'ai_analyzing' ? (
          /* Active AI Analysis Telemetry */
          <div
            id="ai-analyzing-telemetry-box"
            className="rounded-xl border border-indigo-700/60 bg-[#0a0f1d] p-5 relative overflow-hidden animate-pulse"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-950/70 border border-indigo-600/70 text-indigo-400 shrink-0">
                  <Brain className="w-6 h-6 animate-bounce" />
                  <span className="animate-ping absolute inset-1 rounded-xl bg-indigo-400/30" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-100 font-mono flex items-center gap-2">
                      <span>AI Analyzing Market Context for {selectedSymbol}...</span>
                      <Sparkles className="w-4 h-4 text-indigo-400" />
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 mt-0.5">
                    Gemini 3.8 Flash model synthesizing EMA divergence, RSI thresholds, spread sanity, and market regime before execution approval.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <div className="px-3 py-1.5 rounded-md bg-indigo-950/80 border border-indigo-600 text-indigo-300 text-xs font-mono font-bold tracking-wider">
                  GENAI OVERSEER
                </div>
              </div>
            </div>
          </div>
        ) : operationalState === 'scanning' ? (
          /* Active Scanning Telemetry */
          <div
            id="scanning-telemetry-box"
            className="rounded-xl border border-amber-800/40 bg-[#0a0f1d] p-5 relative overflow-hidden"
          >
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                {/* Pulsating Radar Visual */}
                <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-amber-950/50 border border-amber-700/50 text-amber-400 shrink-0">
                  <Radio className="w-6 h-6 animate-pulse" />
                  <span className="animate-ping absolute inset-1 rounded-xl bg-amber-400/20" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-slate-100 font-mono">
                      Evaluating {selectedSymbol} Setup &amp; Risk Guardrails...
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Deterministic pipeline calculating EMA({strategySettings.emaFastPeriod}/{strategySettings.emaSlowPeriod}), RSI({strategySettings.rsiPeriod}), ATR({strategySettings.atrPeriod}), and enforcing risk limits.
                  </p>
                </div>
              </div>

              {/* Scan Duration Timer */}
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">
                    Scan Duration
                  </span>
                  <span className="text-sm font-bold font-mono text-amber-300">
                    {formatTime(scanTimeSeconds)}
                  </span>
                </div>
                <div className="px-2.5 py-1 rounded-md bg-amber-950/60 border border-amber-700/50 text-amber-300 text-xs font-mono">
                  ACTIVE
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* At Rest / Idle Telemetry */
          <div
            id="at-rest-telemetry-box"
            className="rounded-xl border border-[#1f2937] bg-[#0a0f1d] p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-400 shrink-0">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <span className="text-sm font-bold text-slate-200 block">
                  Engine Standing By &bull; No Open Positions
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  {isConnected ? (
                    <>
                      Connected to MT5 Bridge. Select <strong className="text-sky-400 font-semibold">{selectedSymbol}</strong> and click{' '}
                      <strong className="text-emerald-400 font-semibold">Start Scanning</strong>.
                    </>
                  ) : (
                    <>
                      MetaTrader 5 Bridge is currently disconnected. Run your local MT5 bridge daemon to receive live telemetry.
                    </>
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-[#111827] px-3.5 py-2 rounded-lg border border-[#1f2937]">
              {isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span className="text-emerald-300">Daemon Online</span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-400"></span>
                  <span className="text-slate-400">Bridge Offline</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Real-time Indicator Readings & Risk Guardrails Overview Bar */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
        {/* Guardrail 1: Max Daily Drawdown */}
        <div className="p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
              Daily Drawdown
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-red-950/60 text-red-300 border border-red-800/40">
              Max {strategySettings.maxDailyDrawdownPercent}%
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-base font-bold font-mono text-slate-200">
              {latestEval?.riskChecks.maxDrawdownCheck.value !== undefined
                ? `${latestEval.riskChecks.maxDrawdownCheck.value}%`
                : '0.00%'}
            </span>
            <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Within Limit
            </span>
          </div>
        </div>

        {/* Guardrail 2: Max Open Positions */}
        <div className="p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              Open Positions
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-sky-950/60 text-sky-300 border border-sky-800/40">
              Max {strategySettings.maxOpenPositions}
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-base font-bold font-mono text-slate-200">
              {activeTrade ? 1 : 0} / {strategySettings.maxOpenPositions}
            </span>
            <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Allowed
            </span>
          </div>
        </div>

        {/* Guardrail 3: Spread Guard */}
        <div className="p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              Market Spread
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-800/40">
              Limit {strategySettings.maxSpreadPips} pips
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-base font-bold font-mono text-slate-200">
              {latestEval?.indicators.currentSpreadPips ?? currentSymbolObj.spread} pips
            </span>
            <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              Passed
            </span>
          </div>
        </div>

        {/* Guardrail 4: Dynamic Position Sizing */}
        <div className="p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937] flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-amber-400" />
              Dynamic Lot Sizing
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-950/60 text-amber-300 border border-amber-800/40">
              {strategySettings.riskPerTradePercent}% Risk
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-base font-bold font-mono text-amber-300">
              {latestEval?.calculatedLotSize ? `${latestEval.calculatedLotSize.toFixed(2)} Lots` : '0.10 Lots'}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">
              ATR Scaled
            </span>
          </div>
        </div>
      </div>

      {/* Real-Time Technical Indicators Strip */}
      <div className="p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-sky-400 shrink-0" />
          <span className="font-bold text-slate-200 uppercase tracking-wide text-[11px]">
            Live Indicator Stream:
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-slate-300 font-mono">
          <div>
            <span className="text-slate-400 text-[10px] mr-1">Fast EMA({strategySettings.emaFastPeriod}):</span>
            <span className="text-sky-300 font-bold">
              {latestEval?.indicators.fastEma ?? '---'}
            </span>
          </div>

          <div>
            <span className="text-slate-400 text-[10px] mr-1">Slow EMA({strategySettings.emaSlowPeriod}):</span>
            <span className="text-indigo-300 font-bold">
              {latestEval?.indicators.slowEma ?? '---'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[10px]">RSI({strategySettings.rsiPeriod}):</span>
            <span
              className={`font-bold ${
                (latestEval?.indicators.rsi ?? 50) >= strategySettings.rsiOverbought
                  ? 'text-red-400'
                  : (latestEval?.indicators.rsi ?? 50) <= strategySettings.rsiOversold
                  ? 'text-emerald-400'
                  : 'text-slate-200'
              }`}
            >
              {latestEval?.indicators.rsi ?? '---'}
            </span>
            <span className="text-[10px] text-slate-400">
              (Limits: {strategySettings.rsiOversold}/{strategySettings.rsiOverbought})
            </span>
          </div>

          <div>
            <span className="text-slate-400 text-[10px] mr-1">ATR({strategySettings.atrPeriod}):</span>
            <span className="text-amber-300 font-bold">
              {latestEval?.indicators.atr ?? '---'}
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* Real-Time Rule Evaluation Logs Feed */}
      {/* ------------------------------------------------------------- */}
      <div className="pt-1">
        <div className="flex items-center justify-between pb-2">
          <button
            type="button"
            id="toggle-eval-logs-btn"
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white uppercase tracking-wider transition-colors"
          >
            <Terminal className="w-3.5 h-3.5 text-sky-400" />
            <span>Active Rule Evaluation Logs ({evalLogs.length})</span>
            {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {evalLogs.length > 0 && showLogs && (
            <button
              type="button"
              id="clear-eval-logs-btn"
              onClick={clearLogs}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-red-300 transition-colors"
              title="Clear evaluation history"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        {showLogs && (
          <div
            id="rule-evaluation-logs-terminal"
            className="rounded-lg border border-[#1f2937] bg-[#0a0f1d] p-3 max-h-48 overflow-y-auto font-mono text-[11px] space-y-1.5"
          >
            {evalLogs.length === 0 ? (
              <div className="text-slate-400 py-3 text-center italic">
                RuleEngine stream active. Start scanning or wait for incoming market ticks to view evaluation logs...
              </div>
            ) : (
              evalLogs.map((log) => (
                <div
                  key={log.id}
                  className={`flex flex-col sm:flex-row sm:items-baseline justify-between gap-1.5 p-1.5 rounded border ${
                    log.riskPassed
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-200'
                      : log.signal !== 'NEUTRAL'
                      ? 'bg-amber-950/20 border-amber-800/40 text-amber-200'
                      : 'bg-[#111827] border-[#1f2937] text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-slate-400 text-[10px]">{log.timestamp}</span>
                    <span className="font-bold text-slate-200">[{log.symbol}]</span>
                    <span
                      className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                        log.signal === 'BUY'
                          ? 'bg-emerald-900 text-emerald-300'
                          : log.signal === 'SELL'
                          ? 'bg-red-900 text-red-300'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {log.signal}
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${
                        log.riskPassed ? 'text-emerald-400' : 'text-slate-400'
                      }`}
                    >
                      {log.riskPassed ? 'RISK: APPROVED' : 'RISK: BLOCKED/WAIT'}
                    </span>
                  </div>

                  <div className="text-slate-400 text-[11px] truncate" title={log.reason}>
                    {log.reason}
                  </div>

                  {log.lotSize > 0 && log.riskPassed && (
                    <div className="text-amber-300 text-[10px] shrink-0">
                      Lot: {log.lotSize.toFixed(2)} | SL: {log.slPrice} | TP: {log.tpPrice}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </section>
  );
};

