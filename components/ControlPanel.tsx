'use client';

import React, { useState } from 'react';
import {
  OperationalState,
  AVAILABLE_SYMBOLS,
  AppSettings,
} from '@/types/trading';
import {
  Play,
  Octagon,
  ChevronDown,
  Percent,
  ShieldAlert,
  AlertTriangle,
  RefreshCw,
  Brain,
} from 'lucide-react';

interface ControlPanelProps {
  operationalState: OperationalState;
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  onStartScanning: () => void;
  onEmergencyStop: () => void;
  settings: AppSettings;
  isConnected: boolean;
  isSimulationMode: boolean;
  onToggleSimulationMode: (enabled: boolean) => void;
  onReconnectBridge?: () => void;
  onOpenStrategy?: () => void;
  activeTradeCount: number;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  operationalState,
  selectedSymbol,
  onSelectSymbol,
  onStartScanning,
  onEmergencyStop,
  settings,
  isConnected,
  isSimulationMode,
  onToggleSimulationMode,
  onReconnectBridge,
  onOpenStrategy,
  activeTradeCount,
}) => {
  const [isSymbolDropdownOpen, setIsSymbolDropdownOpen] = useState(false);

  const currentSymbolObj =
    AVAILABLE_SYMBOLS.find((s) => s.symbol === selectedSymbol) || AVAILABLE_SYMBOLS[0];

  const isScanning = operationalState === 'scanning';
  const isAiAnalyzing = operationalState === 'ai_analyzing';
  const isRunningTrade = operationalState === 'trade_running';
  const canScan = isConnected || isSimulationMode;

  return (
    <section
      id="control-panel"
      aria-label="Execution Control Engine"
      className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 sm:p-5 shadow-lg relative"
    >
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
        {/* Left Side: Symbol Selector & Pair Info */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-1">
              Active Trading Pair
            </label>
            <div className="relative">
              <button
                type="button"
                id="symbol-selector-dropdown-btn"
                onClick={() => setIsSymbolDropdownOpen(!isSymbolDropdownOpen)}
                className="flex items-center justify-between gap-3 min-w-[210px] bg-[#0a0f1d] hover:bg-[#161f36] border border-[#1f2937] hover:border-slate-600 px-3.5 py-2.5 rounded-lg text-left transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                  <div>
                    <span className="text-sm font-bold text-white font-mono block leading-tight">
                      {currentSymbolObj.symbol}
                    </span>
                    <span className="text-[10px] text-slate-400 block leading-tight">
                      {currentSymbolObj.name}
                    </span>
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${
                    isSymbolDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {/* Dropdown Menu */}
              {isSymbolDropdownOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsSymbolDropdownOpen(false)}
                  />
                  <div
                    id="symbol-dropdown-menu"
                    className="absolute left-0 top-full mt-2 w-72 bg-[#111827] border border-[#1f2937] rounded-xl shadow-2xl z-30 py-2 overflow-hidden max-h-80 overflow-y-auto"
                  >
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-[#1f2937]">
                      Select Market Symbol
                    </div>
                    {AVAILABLE_SYMBOLS.map((item) => (
                      <button
                        key={item.symbol}
                        type="button"
                        id={`select-symbol-${item.symbol}`}
                        onClick={() => {
                          onSelectSymbol(item.symbol);
                          setIsSymbolDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3.5 py-2.5 text-left text-xs transition-colors hover:bg-[#1f2937] ${
                          selectedSymbol === item.symbol
                            ? 'bg-sky-950/50 text-sky-300 font-semibold border-l-2 border-sky-400'
                            : 'text-slate-200'
                        }`}
                      >
                        <div>
                          <span className="font-bold font-mono text-white mr-2">{item.symbol}</span>
                          <span className="text-slate-400 text-[11px]">{item.name}</span>
                        </div>
                        <div className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                          {item.category}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Quick Risk Parameter Pills */}
          <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[#1f2937] self-end mb-1">
            <button
              type="button"
              id="quick-risk-per-trade-pill-btn"
              onClick={onOpenStrategy}
              className="px-3 py-2 rounded-lg bg-[#0a0f1d] hover:bg-slate-800/80 border border-[#1f2937] hover:border-amber-600/50 text-xs text-left transition-all cursor-pointer group"
              title="Click to configure Dynamic Position Sizing and Strategy Rules"
            >
              <span className="text-[10px] uppercase font-bold text-slate-400 group-hover:text-amber-300 block">Risk / Trade</span>
              <span className="font-mono font-bold text-amber-400">
                {settings.riskPerTradePercent ?? settings.maxRiskPerTrade}% Equity
              </span>
            </button>
            <button
              type="button"
              id="quick-max-dd-pill-btn"
              onClick={onOpenStrategy}
              className="px-3 py-2 rounded-lg bg-[#0a0f1d] hover:bg-slate-800/80 border border-[#1f2937] hover:border-red-600/50 text-xs text-left transition-all cursor-pointer group"
              title="Click to configure Max Daily Drawdown and Hard Guardrails"
            >
              <span className="text-[10px] uppercase font-bold text-slate-400 group-hover:text-red-300 block">Daily Limit</span>
              <span className="font-mono font-bold text-red-400">
                -{settings.maxDailyDrawdownPercent ?? settings.maxDailyDrawdown}% DD
              </span>
            </button>
          </div>
        </div>

        {/* Right Side: Action Trigger Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* If bridge disconnected, show connection prompt */}
          {!isConnected && onReconnectBridge && (
            <button
              type="button"
              id="control-panel-connect-bridge-btn"
              onClick={onReconnectBridge}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg border border-amber-700/50 bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 hover:text-amber-100 text-xs font-semibold transition-all"
              title="Connect to local MT5 Bridge daemon"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Connect Bridge</span>
            </button>
          )}

          {/* Start Scanning Button (Bright Green State Action Button) */}
          <button
            type="button"
            id="start-scanning-btn"
            onClick={onStartScanning}
            disabled={!canScan || isScanning || isAiAnalyzing || isRunningTrade}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-md ${
              !canScan
                ? 'opacity-50 cursor-not-allowed bg-slate-800 text-slate-400 border border-slate-700'
                : isAiAnalyzing
                ? 'bg-indigo-800/80 text-indigo-100 border border-indigo-500/60 cursor-default ring-2 ring-indigo-500/30'
                : isScanning
                ? 'bg-emerald-700/60 text-emerald-200 border border-emerald-500/40 cursor-default ring-2 ring-emerald-500/20'
                : isRunningTrade
                ? 'opacity-40 cursor-not-allowed bg-emerald-950 text-slate-400 border border-emerald-900'
                : isSimulationMode
                ? 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-950/60 hover:shadow-cyan-900/80 active:scale-98'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/60 hover:shadow-emerald-900/80 active:scale-98'
            }`}
            title={!canScan ? 'Connect MetaTrader 5 Bridge or switch to Demo Mode to scan' : 'Start algorithmic setup scanning'}
          >
            {isAiAnalyzing ? (
              <>
                <Brain className="w-4 h-4 text-indigo-300 animate-pulse" />
                <span className="animate-pulse">AI Analyzing...</span>
              </>
            ) : (
              <>
                <Play className={`w-4 h-4 fill-current ${isScanning ? 'animate-pulse' : ''}`} />
                <span>{isScanning ? 'Scanning Active' : isSimulationMode ? 'Start Scanning (Demo)' : 'Start Scanning'}</span>
              </>
            )}
          </button>

          {/* Emergency Stop Switch / Stop Scanning (Prominent Red Button) */}
          <button
            type="button"
            id="emergency-stop-btn"
            onClick={onEmergencyStop}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-red-600 hover:bg-red-500 text-white transition-all shadow-md shadow-red-950/60 hover:shadow-red-900/80 active:scale-98"
            title="Immediately halt scanning, reset status to At Rest, and command MT5 to close any open positions"
          >
            <Octagon className="w-4 h-4 fill-current" />
            <span>Emergency Stop</span>
          </button>
        </div>
      </div>

      {/* Real-time disconnected banner with explicit Demo / Simulation Mode switch */}
      {!isConnected && !isSimulationMode && (
        <div className="mt-3 pt-3 border-t border-[#1f2937] flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-amber-400/90 gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-400" />
            <span>
              Bridge Offline: Run your MetaTrader 5 WebSocket daemon on{' '}
              <code className="bg-black/40 px-1 py-0.5 rounded font-mono text-amber-300">
                {settings.bridgeUrl}
              </code>{' '}
              or test directly using simulation mode.
            </span>
          </div>

          <button
            type="button"
            id="enable-demo-mode-banner-btn"
            onClick={() => onToggleSimulationMode(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-cyan-950/70 hover:bg-cyan-900/80 border border-cyan-700/60 text-cyan-300 text-xs font-semibold shrink-0 transition-all shadow-xs"
          >
            <span>Switch to Demo / Simulation Mode</span>
          </button>
        </div>
      )}

      {/* Simulation Mode Indicator Banner */}
      {isSimulationMode && (
        <div className="mt-3 pt-3 border-t border-cyan-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between text-xs text-cyan-300 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>
              <strong>Demo / Simulation Mode Active:</strong> Simulating local MT5 account balance ($10,000.00), algorithmic setup detections, and live floating trade telemetry.
            </span>
          </div>
          <button
            type="button"
            id="disable-demo-mode-banner-btn"
            onClick={() => onToggleSimulationMode(false)}
            className="text-[11px] underline text-slate-400 hover:text-slate-200 transition-colors"
          >
            Exit Demo & Connect Live MT5
          </button>
        </div>
      )}
    </section>
  );
};
