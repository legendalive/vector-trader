'use client';

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  ShieldCheck,
  ShieldAlert,
  Gauge,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  Brain,
  Sliders,
  Terminal,
  Activity,
  Zap,
} from 'lucide-react';
import { AIDecisionLog, AccountMetrics } from '@/types/trading';
import { aiService } from '@/services/AIService';
import { ruleEngine } from '@/services/RuleEngine';

interface AIOverviewPanelProps {
  selectedSymbol: string;
  accountMetrics?: AccountMetrics;
  onOpenSettings?: () => void;
  className?: string;
}

export const AIOverviewPanel: React.FC<AIOverviewPanelProps> = ({
  selectedSymbol,
  accountMetrics,
  onOpenSettings,
  className = '',
}) => {
  const [logs, setLogs] = useState<AIDecisionLog[]>(() => aiService.getDecisionLogs());
  const [lastDecision, setLastDecision] = useState<AIDecisionLog | null>(() =>
    aiService.getLastDecision()
  );
  const [currentRegime, setCurrentRegime] = useState<string>(() => aiService.getCurrentRegime());
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(() => aiService.getIsAnalyzing());
  const [isAiOffline, setIsAiOffline] = useState<boolean>(() => aiService.getIsAiOffline());
  const [warningBadge, setWarningBadge] = useState<string | null>(() => aiService.getWarningBadge());
  const [analysisNotice, setAnalysisNotice] = useState<string | null>(null);
  const [showLogsTable, setShowLogsTable] = useState<boolean>(true);
  const [isManualTriggering, setIsManualTriggering] = useState<boolean>(false);

  useEffect(() => {
    const unsubDecision = aiService.onDecision((decision) => {
      setLastDecision(decision);
      setCurrentRegime(decision.marketRegime);
      setLogs(aiService.getDecisionLogs());
      setIsAiOffline(aiService.getIsAiOffline());
      setWarningBadge(aiService.getWarningBadge());
    });

    const unsubStatus = aiService.onStatusChange((analyzing, message) => {
      setIsAnalyzing(analyzing);
      setIsAiOffline(aiService.getIsAiOffline());
      setWarningBadge(aiService.getWarningBadge());
      setAnalysisNotice(analyzing ? message || 'Gemini 3.8 Flash evaluating market context...' : null);
    });

    return () => {
      unsubDecision();
      unsubStatus();
    };
  }, []);

  // Trigger manual test analysis on current symbol
  const handleTriggerManualAnalysis = async () => {
    if (isAnalyzing || isManualTriggering) return;
    setIsManualTriggering(true);

    try {
      // Pull latest symbol setup from RuleEngine or defaults
      const symbolObj = ruleEngine.getSettings();
      const currentPrice =
        selectedSymbol === 'EURUSD'
          ? 1.0855
          : selectedSymbol === 'GBPUSD'
          ? 1.2945
          : selectedSymbol === 'USDJPY'
          ? 153.3
          : selectedSymbol === 'XAUUSD'
          ? 2646.0
          : selectedSymbol === 'BTCUSD'
          ? 64250.0
          : 1.085;

      const defaultMetrics: AccountMetrics = accountMetrics || {
        balance: 10000,
        equity: 10000,
        freeMargin: 10000,
        marginUsed: 0,
        todayPnl: 0,
        todayPnlPercent: 0,
        isConnected: true,
      };

      const evalResult = ruleEngine.evaluateSetup({
        symbol: selectedSymbol,
        currentPrice,
        spreadPips: 1.0,
        accountState: defaultMetrics,
        activePositions: [],
      });

      const signalToTest = evalResult.signal !== 'NEUTRAL' ? evalResult.signal : 'BUY';

      await aiService.analyzeMarketContext(
        {
          symbol: selectedSymbol,
          signal: signalToTest,
          price: currentPrice,
          spreadPips: 1.0,
          lotSize: evalResult.calculatedLotSize || 0.1,
          stopLoss: evalResult.slPrice,
          takeProfit: evalResult.tpPrice,
          indicators: evalResult.indicators,
          riskReason: evalResult.reason,
        },
        accountMetrics
      );
    } catch (err) {
      console.error('Manual AI analysis failed', err);
    } finally {
      setIsManualTriggering(false);
    }
  };

  // Helper for regime coloring
  const getRegimeColor = (regime: string) => {
    const lower = regime.toLowerCase();
    if (lower.includes('choppy') || lower.includes('ranging') || lower.includes('veto')) {
      return {
        bg: 'bg-amber-950/60',
        border: 'border-amber-700/60',
        text: 'text-amber-300',
        dot: 'bg-amber-400',
        icon: <TrendingDown className="w-3.5 h-3.5 text-amber-400" />,
      };
    }
    if (lower.includes('bullish') || lower.includes('trending up')) {
      return {
        bg: 'bg-emerald-950/60',
        border: 'border-emerald-700/60',
        text: 'text-emerald-300',
        dot: 'bg-emerald-400',
        icon: <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />,
      };
    }
    if (lower.includes('bearish') || lower.includes('breakdown')) {
      return {
        bg: 'bg-red-950/60',
        border: 'border-red-700/60',
        text: 'text-red-300',
        dot: 'bg-red-400',
        icon: <TrendingDown className="w-3.5 h-3.5 text-red-400" />,
      };
    }
    return {
      bg: 'bg-sky-950/60',
      border: 'border-sky-700/60',
      text: 'text-sky-300',
      dot: 'bg-sky-400',
      icon: <Activity className="w-3.5 h-3.5 text-sky-400" />,
    };
  };

  const regimeStyle = getRegimeColor(currentRegime);
  const confidence = lastDecision ? lastDecision.confidenceScore : 85;

  return (
    <section
      id="ai-market-overview-panel"
      aria-label="Google Gemini AI Analysis Overview & Decision Log"
      className={`bg-[#111827] border border-[#1f2937] rounded-xl p-5 shadow-lg relative overflow-hidden space-y-4 ${className}`}
    >
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1f2937]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-950/80 border border-indigo-700/50 text-indigo-300">
            <Brain className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider flex items-center gap-1.5">
                <span>Gemini AI Trade Overseer</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-indigo-900/60 text-indigo-200 border border-indigo-700/50">
                  gemini-3.8-flash
                </span>
              </h2>
            </div>
            <p className="text-[11px] text-slate-400">
              Structured JSON Risk Analysis &amp; Trade Veto Guardrail (responseSchema)
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Manual Run Test AI Trigger Button */}
          <button
            type="button"
            id="trigger-ai-analysis-btn"
            onClick={handleTriggerManualAnalysis}
            disabled={isAnalyzing || isManualTriggering}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-xs ${
              isAnalyzing || isManualTriggering
                ? 'bg-slate-800 text-slate-400 border-slate-700 cursor-not-allowed'
                : 'bg-indigo-950 hover:bg-indigo-900/90 border-indigo-700/70 text-indigo-200 hover:text-white'
            }`}
            title="Prompt Gemini 3.8 Flash with current market metrics and setup data"
          >
            <Sparkles
              className={`w-3.5 h-3.5 text-indigo-400 ${
                isAnalyzing || isManualTriggering ? 'animate-spin' : ''
              }`}
            />
            <span>{isAnalyzing ? 'AI Evaluating...' : 'Evaluate Context'}</span>
          </button>

          {/* Toggle Table Visibility */}
          <button
            type="button"
            id="toggle-ai-logs-btn"
            onClick={() => setShowLogsTable(!showLogsTable)}
            className="p-1.5 rounded-lg bg-[#0a0f1d] hover:bg-slate-800 border border-[#1f2937] text-slate-400 hover:text-slate-200 transition-colors text-xs flex items-center gap-1"
            title="Toggle Decision Log Table"
          >
            <span className="text-[11px] px-1 hidden sm:inline">History ({logs.length})</span>
            {showLogsTable ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* AI Analyzing Pulsing Banner */}
      {isAnalyzing && (
        <div
          id="ai-analyzing-banner"
          className="flex items-center justify-between p-3 rounded-lg bg-indigo-950/70 border border-indigo-600/70 text-indigo-200 text-xs animate-pulse shadow-md"
        >
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-400"></span>
            </span>
            <span className="font-semibold">
              {analysisNotice || 'AI Analyzing: Consulting Gemini 3.8 Flash Risk Overseer...'}
            </span>
          </div>
          <span className="font-mono text-[10px] text-indigo-300">Evaluating Veto Criteria</span>
        </div>
      )}

      {/* API Key Guard: AI Offline Warning Badge */}
      {(isAiOffline || warningBadge) && (
        <div
          id="ai-offline-warning-badge"
          className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-amber-950/40 border border-amber-600/60 text-amber-200 text-xs shadow-md"
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold tracking-wide">
              {warningBadge || 'AI Offline - Enforcing Hardcoded Rules Only'}
            </span>
          </div>
          <span className="text-[11px] text-amber-300/80 font-mono">
            Safety Fallback Active • Algorithmic Guardrails Enforced
          </span>
        </div>
      )}

      {/* 3 Core Overview Cards: Market Regime, AI Confidence Meter, Latest AI Decision */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Market Regime Badge */}
        <div
          id="ai-market-regime-card"
          className="p-4 rounded-xl bg-[#0a0f1d] border border-[#1f2937] flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase font-bold tracking-wider text-[10px]">Current Market Regime</span>
            <span className="text-[10px] font-mono text-slate-500">Live Context</span>
          </div>

          <div>
            <div
              id="ai-market-regime-badge"
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold tracking-wide ${regimeStyle.bg} ${regimeStyle.border} ${regimeStyle.text}`}
            >
              <span className={`w-2 h-2 rounded-full ${regimeStyle.dot} animate-pulse`} />
              {regimeStyle.icon}
              <span>{currentRegime}</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              Synthesized from EMA trend separation, RSI oscillator boundaries, and ATR volatility telemetry.
            </p>
          </div>

          <div className="pt-2 border-t border-[#1f2937]/70 flex items-center justify-between text-[11px] text-slate-400">
            <span>Primary Focus:</span>
            <span className="font-mono font-medium text-slate-300">Capital Preservation</span>
          </div>
        </div>

        {/* Card 2: AI Confidence Score Gauge / Meter */}
        <div
          id="ai-confidence-gauge-card"
          className="p-4 rounded-xl bg-[#0a0f1d] border border-[#1f2937] flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase font-bold tracking-wider text-[10px]">AI Confidence Score</span>
            <span className="text-[10px] font-mono text-indigo-400 font-semibold">
              {lastDecision ? (lastDecision.approved ? 'Approved Setup' : 'Vetoed Setup') : 'Standby'}
            </span>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-black font-mono text-white tracking-tight">
                  {confidence}
                </span>
                <span className="text-xs text-slate-400 font-mono">/100</span>
              </div>
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded ${
                  confidence >= 80
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                    : confidence >= 60
                    ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                    : 'bg-red-950 text-red-300 border border-red-800/60'
                }`}
              >
                {confidence >= 80 ? 'High Conviction' : confidence >= 60 ? 'Moderate' : 'Low / Veto Risk'}
              </span>
            </div>

            {/* Visual Gauge Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden relative">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  confidence >= 80
                    ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50'
                    : confidence >= 60
                    ? 'bg-amber-500 shadow-xs shadow-amber-500/50'
                    : 'bg-red-500 shadow-xs shadow-red-500/50'
                }`}
                style={{ width: `${confidence}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
              <span>Threshold: 60 min</span>
              <span>
                Lot Multiplier:{' '}
                <strong className="text-indigo-300">
                  {lastDecision?.adjustedLotSizeMultiplier !== undefined
                    ? `${lastDecision.adjustedLotSizeMultiplier}x`
                    : '1.0x'}
                </strong>
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-[#1f2937]/70 flex items-center justify-between text-[11px] text-slate-400">
            <span>Model Verdict:</span>
            <span className="font-mono text-slate-300">
              {lastDecision?.approved ? 'Execution Cleared' : 'Execution Blocked'}
            </span>
          </div>
        </div>

        {/* Card 3: Latest AI Decision Summary */}
        <div
          id="ai-latest-decision-card"
          className="p-4 rounded-xl bg-[#0a0f1d] border border-[#1f2937] flex flex-col justify-between space-y-3"
        >
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="uppercase font-bold tracking-wider text-[10px]">Latest Overseer Decision</span>
            <span className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {lastDecision?.timestamp || 'Just now'}
            </span>
          </div>

          {lastDecision ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-mono font-bold text-sm text-slate-200">
                  <span>{lastDecision.symbol}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[11px] ${
                      lastDecision.signal === 'BUY'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : 'bg-red-950 text-red-300 border border-red-800'
                    }`}
                  >
                    {lastDecision.signal}
                  </span>
                </div>

                <div
                  id="ai-decision-status-badge"
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                    lastDecision.approved
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                      : 'bg-red-950 text-red-300 border border-red-600'
                  }`}
                >
                  {lastDecision.approved ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-red-400" />
                  )}
                  <span>{lastDecision.approved ? 'Approved' : 'Vetoed'}</span>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 text-[11px] text-slate-300 leading-relaxed font-sans max-h-24 overflow-y-auto">
                <span className="text-slate-400 font-semibold uppercase text-[9px] block mb-0.5">
                  AI Reasoning:
                </span>
                &ldquo;{lastDecision.reasoning}&rdquo;
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-xs text-slate-500">
              No recent trade evaluations recorded yet. Start scanning or click &apos;Evaluate Context&apos;.
            </div>
          )}

          <div className="pt-2 border-t border-[#1f2937]/70 flex items-center justify-between text-[11px] text-slate-400">
            <span>Sizing Output:</span>
            <span className="font-mono text-slate-300">
              {lastDecision
                ? `${lastDecision.finalLotSize} Lots (${lastDecision.originalLotSize} req)`
                : '0.10 Lots'}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Decision Log Table / Stream */}
      {showLogsTable && (
        <div
          id="ai-decision-logs-section"
          className="mt-4 pt-3 border-t border-[#1f2937] space-y-2 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-300">
                AI Overseer Decision Stream
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono">
              Audit log of all Gemini prompt/response evaluations
            </span>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[#1f2937] bg-[#0a0f1d]">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#111827] text-[10px] uppercase font-bold text-slate-400 border-b border-[#1f2937]">
                <tr>
                  <th className="py-2.5 px-3">Time</th>
                  <th className="py-2.5 px-3">Symbol</th>
                  <th className="py-2.5 px-3">Signal</th>
                  <th className="py-2.5 px-3">Verdict</th>
                  <th className="py-2.5 px-3">Confidence</th>
                  <th className="py-2.5 px-3">Market Regime</th>
                  <th className="py-2.5 px-3">Lot Allocation</th>
                  <th className="py-2.5 px-4 min-w-[280px]">Reasoning Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1f2937] font-mono text-[11px]">
                {logs.length > 0 ? (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3 text-slate-400 whitespace-nowrap">{log.timestamp}</td>
                      <td className="py-2 px-3 font-bold text-slate-200">{log.symbol}</td>
                      <td className="py-2 px-3">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            log.signal === 'BUY'
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                              : 'bg-red-950 text-red-300 border border-red-800/60'
                          }`}
                        >
                          {log.signal}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            log.approved
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-600'
                              : 'bg-red-950 text-red-300 border border-red-600'
                          }`}
                        >
                          {log.approved ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3 h-3 text-red-400" />
                          )}
                          <span>{log.approved ? 'Approved' : 'Vetoed'}</span>
                        </span>
                      </td>
                      <td className="py-2 px-3 font-bold">
                        <span
                          className={
                            log.confidenceScore >= 80
                              ? 'text-emerald-400'
                              : log.confidenceScore >= 60
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }
                        >
                          {log.confidenceScore}%
                        </span>
                      </td>
                      <td className="py-2 px-3 font-sans text-slate-300 whitespace-nowrap">
                        {log.marketRegime}
                      </td>
                      <td className="py-2 px-3 text-slate-300 whitespace-nowrap">
                        <span className="font-bold text-white">{log.finalLotSize}</span>
                        <span className="text-[10px] text-slate-500 ml-1">
                          ({log.adjustedLotSizeMultiplier}x)
                        </span>
                      </td>
                      <td className="py-2 px-4 font-sans text-slate-300 leading-normal">
                        <span className="line-clamp-2" title={log.reasoning}>
                          {log.reasoning}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-500 font-sans">
                      No AI decisions recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
