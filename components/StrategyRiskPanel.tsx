'use client';

import React, { useState, useEffect } from 'react';
import { AppSettings, StrategyRiskSettings, DEFAULT_STRATEGY_SETTINGS } from '@/types/trading';
import {
  ShieldAlert,
  Sliders,
  TrendingUp,
  Activity,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  Layers,
  Gauge,
  HelpCircle,
  X,
} from 'lucide-react';
import { ruleEngine } from '@/services/RuleEngine';

interface StrategyRiskPanelProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  onClose?: () => void;
  className?: string;
}

export const StrategyRiskPanel: React.FC<StrategyRiskPanelProps> = ({
  settings,
  onSave,
  onClose,
  className = '',
}) => {
  const [formData, setFormData] = useState<StrategyRiskSettings>({
    riskPerTradePercent: settings.riskPerTradePercent ?? settings.maxRiskPerTrade ?? DEFAULT_STRATEGY_SETTINGS.riskPerTradePercent,
    maxDailyDrawdownPercent: settings.maxDailyDrawdownPercent ?? settings.maxDailyDrawdown ?? DEFAULT_STRATEGY_SETTINGS.maxDailyDrawdownPercent,
    maxOpenPositions: settings.maxOpenPositions ?? DEFAULT_STRATEGY_SETTINGS.maxOpenPositions,
    maxSpreadPips: settings.maxSpreadPips ?? DEFAULT_STRATEGY_SETTINGS.maxSpreadPips,
    emaFastPeriod: settings.emaFastPeriod ?? DEFAULT_STRATEGY_SETTINGS.emaFastPeriod,
    emaSlowPeriod: settings.emaSlowPeriod ?? DEFAULT_STRATEGY_SETTINGS.emaSlowPeriod,
    rsiPeriod: settings.rsiPeriod ?? DEFAULT_STRATEGY_SETTINGS.rsiPeriod,
    rsiOverbought: settings.rsiOverbought ?? DEFAULT_STRATEGY_SETTINGS.rsiOverbought,
    rsiOversold: settings.rsiOversold ?? DEFAULT_STRATEGY_SETTINGS.rsiOversold,
    atrPeriod: settings.atrPeriod ?? DEFAULT_STRATEGY_SETTINGS.atrPeriod,
    atrSlMultiplier: settings.atrSlMultiplier ?? DEFAULT_STRATEGY_SETTINGS.atrSlMultiplier,
    atrTpMultiplier: settings.atrTpMultiplier ?? DEFAULT_STRATEGY_SETTINGS.atrTpMultiplier,
    slMode: settings.slMode ?? DEFAULT_STRATEGY_SETTINGS.slMode,
    fixedSlPips: settings.fixedSlPips ?? DEFAULT_STRATEGY_SETTINGS.fixedSlPips,
    fixedTpPips: settings.fixedTpPips ?? DEFAULT_STRATEGY_SETTINGS.fixedTpPips,
  });

  const [isSaved, setIsSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'risk' | 'indicators' | 'exits'>('risk');
  const [prevSettings, setPrevSettings] = useState(settings);

  // Sync state during render if parent settings reference updates (official React pattern)
  if (settings !== prevSettings) {
    setPrevSettings(settings);
    setFormData({
      riskPerTradePercent: settings.riskPerTradePercent ?? settings.maxRiskPerTrade ?? DEFAULT_STRATEGY_SETTINGS.riskPerTradePercent,
      maxDailyDrawdownPercent: settings.maxDailyDrawdownPercent ?? settings.maxDailyDrawdown ?? DEFAULT_STRATEGY_SETTINGS.maxDailyDrawdownPercent,
      maxOpenPositions: settings.maxOpenPositions ?? DEFAULT_STRATEGY_SETTINGS.maxOpenPositions,
      maxSpreadPips: settings.maxSpreadPips ?? DEFAULT_STRATEGY_SETTINGS.maxSpreadPips,
      emaFastPeriod: settings.emaFastPeriod ?? DEFAULT_STRATEGY_SETTINGS.emaFastPeriod,
      emaSlowPeriod: settings.emaSlowPeriod ?? DEFAULT_STRATEGY_SETTINGS.emaSlowPeriod,
      rsiPeriod: settings.rsiPeriod ?? DEFAULT_STRATEGY_SETTINGS.rsiPeriod,
      rsiOverbought: settings.rsiOverbought ?? DEFAULT_STRATEGY_SETTINGS.rsiOverbought,
      rsiOversold: settings.rsiOversold ?? DEFAULT_STRATEGY_SETTINGS.rsiOversold,
      atrPeriod: settings.atrPeriod ?? DEFAULT_STRATEGY_SETTINGS.atrPeriod,
      atrSlMultiplier: settings.atrSlMultiplier ?? DEFAULT_STRATEGY_SETTINGS.atrSlMultiplier,
      atrTpMultiplier: settings.atrTpMultiplier ?? DEFAULT_STRATEGY_SETTINGS.atrTpMultiplier,
      slMode: settings.slMode ?? DEFAULT_STRATEGY_SETTINGS.slMode,
      fixedSlPips: settings.fixedSlPips ?? DEFAULT_STRATEGY_SETTINGS.fixedSlPips,
      fixedTpPips: settings.fixedTpPips ?? DEFAULT_STRATEGY_SETTINGS.fixedTpPips,
    });
  }

  const handleApplyPreset = (riskPct: number, ddPct: number) => {
    setFormData((prev) => ({
      ...prev,
      riskPerTradePercent: riskPct,
      maxDailyDrawdownPercent: ddPct,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: AppSettings = {
      ...settings,
      ...formData,
      maxRiskPerTrade: formData.riskPerTradePercent,
      maxDailyDrawdown: formData.maxDailyDrawdownPercent,
    };
    ruleEngine.updateSettings(formData);
    onSave(updated);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 1500);
  };

  const handleResetDefaults = () => {
    setFormData({ ...DEFAULT_STRATEGY_SETTINGS });
    ruleEngine.updateSettings(DEFAULT_STRATEGY_SETTINGS);
  };

  return (
    <div
      id="strategy-risk-panel"
      className={`bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden shadow-xl ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-5 py-3.5 border-b border-[#1f2937] bg-[#0d1322] gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-sky-950/60 border border-sky-800/40 text-sky-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                RuleEngine &bull; Strategy & Risk Guardrails
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800/40">
                Deterministic
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Client-side validation parameters enforcing hard risk limits before trade commands reach MT5.
            </p>
          </div>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] uppercase font-bold text-slate-400 mr-1 hidden md:inline">
            Presets:
          </span>
          <button
            type="button"
            id="preset-conservative-btn"
            onClick={() => handleApplyPreset(0.5, 2.0)}
            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#0a0f1d] hover:bg-slate-800 text-slate-300 hover:text-white border border-[#1f2937] transition-all"
          >
            0.5% Cons.
          </button>
          <button
            type="button"
            id="preset-balanced-btn"
            onClick={() => handleApplyPreset(1.0, 3.0)}
            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-sky-950/50 hover:bg-sky-900/60 text-sky-300 hover:text-white border border-sky-800/40 transition-all"
          >
            1.0% Bal.
          </button>
          <button
            type="button"
            id="preset-aggressive-btn"
            onClick={() => handleApplyPreset(2.0, 5.0)}
            className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#0a0f1d] hover:bg-slate-800 text-slate-300 hover:text-white border border-[#1f2937] transition-all"
          >
            2.0% Aggr.
          </button>

          {onClose && (
            <button
              type="button"
              id="close-strategy-panel-btn"
              onClick={onClose}
              className="p-1.5 ml-2 rounded-lg bg-[#0a0f1d] hover:bg-slate-800 border border-[#1f2937] text-slate-400 hover:text-white transition-colors"
              title="Close Strategy Panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center border-b border-[#1f2937] px-5 bg-[#0e1424] text-xs font-semibold">
        <button
          type="button"
          id="tab-risk-guardrails"
          onClick={() => setActiveTab('risk')}
          className={`flex items-center gap-2 py-2.5 px-3 border-b-2 transition-all ${
            activeTab === 'risk'
              ? 'border-sky-400 text-sky-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Risk Guardrails</span>
        </button>
        <button
          type="button"
          id="tab-tech-indicators"
          onClick={() => setActiveTab('indicators')}
          className={`flex items-center gap-2 py-2.5 px-3 border-b-2 transition-all ${
            activeTab === 'indicators'
              ? 'border-sky-400 text-sky-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Technical Indicators (EMA / RSI)</span>
        </button>
        <button
          type="button"
          id="tab-exits-atr"
          onClick={() => setActiveTab('exits')}
          className={`flex items-center gap-2 py-2.5 px-3 border-b-2 transition-all ${
            activeTab === 'exits'
              ? 'border-sky-400 text-sky-400 font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Exits &amp; Volatility (ATR / SL / TP)</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Tab 1: Risk Guardrails */}
        {activeTab === 'risk' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-150">
            {/* Risk Per Trade */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Risk / Trade (%)
                </label>
                <span className="text-[11px] font-mono font-bold text-amber-400">
                  {formData.riskPerTradePercent}%
                </span>
              </div>
              <input
                id="input-risk-per-trade"
                type="number"
                step="0.1"
                min="0.1"
                max="10.0"
                value={formData.riskPerTradePercent}
                onChange={(e) =>
                  setFormData({ ...formData, riskPerTradePercent: parseFloat(e.target.value) || 0.1 })
                }
                className="w-full bg-[#111827] border border-[#1f2937] focus:border-amber-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                required
              />
              <p className="text-[10px] text-slate-400">
                Calculates dynamic lot size using SL distance.
              </p>
            </div>

            {/* Max Daily Drawdown */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldAlert className="w-3 h-3 text-red-400" />
                  Daily Drawdown (%)
                </label>
                <span className="text-[11px] font-mono font-bold text-red-400">
                  {formData.maxDailyDrawdownPercent}%
                </span>
              </div>
              <input
                id="input-daily-drawdown"
                type="number"
                step="0.5"
                min="0.5"
                max="25.0"
                value={formData.maxDailyDrawdownPercent}
                onChange={(e) =>
                  setFormData({ ...formData, maxDailyDrawdownPercent: parseFloat(e.target.value) || 1.0 })
                }
                className="w-full bg-[#111827] border border-[#1f2937] focus:border-red-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                required
              />
              <p className="text-[10px] text-slate-400">
                Hard circuit breaker threshold.
              </p>
            </div>

            {/* Max Open Positions */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-sky-400" />
                  Max Open Positions
                </label>
                <span className="text-[11px] font-mono font-bold text-sky-400">
                  {formData.maxOpenPositions}
                </span>
              </div>
              <input
                id="input-max-positions"
                type="number"
                step="1"
                min="1"
                max="10"
                value={formData.maxOpenPositions}
                onChange={(e) =>
                  setFormData({ ...formData, maxOpenPositions: parseInt(e.target.value, 10) || 1 })
                }
                className="w-full bg-[#111827] border border-[#1f2937] focus:border-sky-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                required
              />
              <p className="text-[10px] text-slate-400">
                Blocks execution signals when limit is reached.
              </p>
            </div>

            {/* Max Spread Threshold */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Gauge className="w-3 h-3 text-emerald-400" />
                  Max Spread (Pips)
                </label>
                <span className="text-[11px] font-mono font-bold text-emerald-400">
                  {formData.maxSpreadPips} pips
                </span>
              </div>
              <input
                id="input-max-spread"
                type="number"
                step="0.5"
                min="0.5"
                max="30.0"
                value={formData.maxSpreadPips}
                onChange={(e) =>
                  setFormData({ ...formData, maxSpreadPips: parseFloat(e.target.value) || 1.0 })
                }
                className="w-full bg-[#111827] border border-[#1f2937] focus:border-emerald-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                required
              />
              <p className="text-[10px] text-slate-400">
                Rejects trades if market spread exceeds limit.
              </p>
            </div>
          </div>
        )}

        {/* Tab 2: Technical Indicators */}
        {activeTab === 'indicators' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 animate-in fade-in duration-150">
            {/* Fast EMA */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                EMA Fast Period
              </label>
              <input
                id="input-ema-fast"
                type="number"
                step="1"
                min="2"
                max="50"
                value={formData.emaFastPeriod}
                onChange={(e) =>
                  setFormData({ ...formData, emaFastPeriod: parseInt(e.target.value, 10) || 9 })
                }
                className="w-full bg-[#111827] border border-[#1f2937] focus:border-sky-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                required
              />
              <p className="text-[10px] text-slate-400">Default: 9 period</p>
            </div>

            {/* Slow EMA */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                EMA Slow Period
              </label>
              <input
                id="input-ema-slow"
                type="number"
                step="1"
                min="5"
                max="200"
                value={formData.emaSlowPeriod}
                onChange={(e) =>
                  setFormData({ ...formData, emaSlowPeriod: parseInt(e.target.value, 10) || 21 })
                }
                className="w-full bg-[#111827] border border-[#1f2937] focus:border-sky-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                required
              />
              <p className="text-[10px] text-slate-400">Default: 21 period</p>
            </div>

            {/* RSI Period */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                RSI Period
              </label>
              <input
                id="input-rsi-period"
                type="number"
                step="1"
                min="2"
                max="50"
                value={formData.rsiPeriod}
                onChange={(e) =>
                  setFormData({ ...formData, rsiPeriod: parseInt(e.target.value, 10) || 14 })
                }
                className="w-full bg-[#111827] border border-[#1f2937] focus:border-sky-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                required
              />
              <p className="text-[10px] text-slate-400">Default: 14 period</p>
            </div>

            {/* RSI Overbought */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block text-red-300">
                RSI Overbought (Sell)
              </label>
              <input
                id="input-rsi-overbought"
                type="number"
                step="1"
                min="55"
                max="95"
                value={formData.rsiOverbought}
                onChange={(e) =>
                  setFormData({ ...formData, rsiOverbought: parseInt(e.target.value, 10) || 70 })
                }
                className="w-full bg-[#111827] border border-[#1f2937] focus:border-red-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                required
              />
              <p className="text-[10px] text-slate-400">Ceiling filter (e.g. 70)</p>
            </div>

            {/* RSI Oversold */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block text-emerald-300">
                RSI Oversold (Buy)
              </label>
              <input
                id="input-rsi-oversold"
                type="number"
                step="1"
                min="5"
                max="45"
                value={formData.rsiOversold}
                onChange={(e) =>
                  setFormData({ ...formData, rsiOversold: parseInt(e.target.value, 10) || 30 })
                }
                className="w-full bg-[#111827] border border-[#1f2937] focus:border-emerald-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                required
              />
              <p className="text-[10px] text-slate-400">Floor filter (e.g. 30)</p>
            </div>
          </div>
        )}

        {/* Tab 3: Exits & Volatility */}
        {activeTab === 'exits' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-150">
            {/* Mode Selector */}
            <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
              <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                SL / TP Calculation Mode
              </label>
              <select
                id="select-sl-mode"
                value={formData.slMode}
                onChange={(e) =>
                  setFormData({ ...formData, slMode: e.target.value as 'atr' | 'fixed_pips' })
                }
                className="w-full bg-[#111827] border border-[#1f2937] focus:border-sky-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200"
              >
                <option value="atr">ATR Dynamic Volatility</option>
                <option value="fixed_pips">Fixed Pips Distance</option>
              </select>
              <p className="text-[10px] text-slate-400">
                {formData.slMode === 'atr' ? 'Adapts to market volatility' : 'Static pip offset'}
              </p>
            </div>

            {formData.slMode === 'atr' ? (
              <>
                {/* ATR Period */}
                <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
                    ATR Period
                  </label>
                  <input
                    id="input-atr-period"
                    type="number"
                    step="1"
                    min="5"
                    max="50"
                    value={formData.atrPeriod}
                    onChange={(e) =>
                      setFormData({ ...formData, atrPeriod: parseInt(e.target.value, 10) || 14 })
                    }
                    className="w-full bg-[#111827] border border-[#1f2937] focus:border-sky-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-400">Default: 14 candles</p>
                </div>

                {/* ATR SL Multiplier */}
                <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block text-red-300">
                    SL Multiplier (&times; ATR)
                  </label>
                  <input
                    id="input-atr-sl-mult"
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="10.0"
                    value={formData.atrSlMultiplier}
                    onChange={(e) =>
                      setFormData({ ...formData, atrSlMultiplier: parseFloat(e.target.value) || 1.5 })
                    }
                    className="w-full bg-[#111827] border border-[#1f2937] focus:border-red-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-400">Stop Loss = 1.5 &times; ATR</p>
                </div>

                {/* ATR TP Multiplier */}
                <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block text-emerald-300">
                    TP Multiplier (&times; ATR)
                  </label>
                  <input
                    id="input-atr-tp-mult"
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="15.0"
                    value={formData.atrTpMultiplier}
                    onChange={(e) =>
                      setFormData({ ...formData, atrTpMultiplier: parseFloat(e.target.value) || 2.5 })
                    }
                    className="w-full bg-[#111827] border border-[#1f2937] focus:border-emerald-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-400">Take Profit = 2.5 &times; ATR</p>
                </div>
              </>
            ) : (
              <>
                {/* Fixed SL Pips */}
                <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block text-red-300">
                    Fixed SL (Pips)
                  </label>
                  <input
                    id="input-fixed-sl-pips"
                    type="number"
                    step="1"
                    min="5"
                    max="500"
                    value={formData.fixedSlPips}
                    onChange={(e) =>
                      setFormData({ ...formData, fixedSlPips: parseInt(e.target.value, 10) || 20 })
                    }
                    className="w-full bg-[#111827] border border-[#1f2937] focus:border-red-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-400">Distance in pips</p>
                </div>

                {/* Fixed TP Pips */}
                <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block text-emerald-300">
                    Fixed TP (Pips)
                  </label>
                  <input
                    id="input-fixed-tp-pips"
                    type="number"
                    step="1"
                    min="5"
                    max="1000"
                    value={formData.fixedTpPips}
                    onChange={(e) =>
                      setFormData({ ...formData, fixedTpPips: parseInt(e.target.value, 10) || 40 })
                    }
                    className="w-full bg-[#111827] border border-[#1f2937] focus:border-emerald-500 focus:outline-hidden rounded-md px-3 py-1.5 text-xs text-slate-200 font-mono"
                    required
                  />
                  <p className="text-[10px] text-slate-400">Distance in pips</p>
                </div>

                <div className="space-y-1.5 p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937] flex items-center">
                  <div className="text-xs text-slate-400">
                    <span className="font-semibold text-slate-200 block">Risk:Reward Ratio</span>
                    {(formData.fixedTpPips / Math.max(1, formData.fixedSlPips)).toFixed(2)} : 1
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer Buttons */}
        <div className="flex items-center justify-between pt-3 border-t border-[#1f2937]">
          <button
            type="button"
            id="reset-strategy-defaults-btn"
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset Engine Defaults
          </button>

          <button
            type="submit"
            id="apply-strategy-risk-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-950/40 transition-all"
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                Applied to RuleEngine!
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Apply Parameters
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
