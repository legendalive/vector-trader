'use client';

import React from 'react';
import { Wifi, WifiOff, Settings, RefreshCw, Activity, Sparkles, Sliders, Brain } from 'lucide-react';
import { AppSettings, OperationalState } from '@/types/trading';
import { EngineConnectionStatus } from '@/services/ExecutionEngine';

interface HeaderProps {
  settings: AppSettings;
  bridgeStatus: EngineConnectionStatus | 'disconnected' | 'connecting' | 'connected' | 'error';
  latencyMs: number | null;
  activeTradeCount: number;
  isSimulationMode: boolean;
  operationalState?: OperationalState;
  onOpenSettings: () => void;
  onOpenStrategy?: () => void;
  onReconnect: () => void;
  onToggleSimulationMode: (enabled: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  settings,
  bridgeStatus,
  latencyMs,
  activeTradeCount,
  isSimulationMode,
  operationalState,
  onOpenSettings,
  onOpenStrategy,
  onReconnect,
  onToggleSimulationMode,
}) => {
  const isConnected = bridgeStatus === 'CONNECTED' || bridgeStatus === 'connected';
  const isConnecting = bridgeStatus === 'RECONNECTING' || bridgeStatus === 'connecting';
  const isSim = isSimulationMode || bridgeStatus === 'SIMULATION';

  return (
    <header
      id="main-header"
      className="w-full bg-[#111827] border-b border-[#1f2937] px-4 lg:px-8 py-3.5 sticky top-0 z-30 shadow-md backdrop-blur-xs"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-600 to-emerald-600 shadow-md shadow-sky-950/50">
            {/* Minimalist vector execution glyph */}
            <svg
              className="w-6 h-6 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
              <polyline points="16 7 22 7 22 13" />
            </svg>
            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-[#0a0f1d] rounded-full flex items-center justify-center">
              <span
                className={`w-2 h-2 rounded-full ${
                  isSim
                    ? 'bg-cyan-400 animate-pulse'
                    : isConnected
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-red-400'
                }`}
              />
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                Vector<span className="text-sky-400">Trader</span>
              </h1>
              <span
                className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${
                  isSim
                    ? 'bg-cyan-950/80 border-cyan-700/60 text-cyan-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                {isSim ? 'Demo Sandbox' : 'MT5 Real'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              MetaTrader 5 Automated Execution Frontend
            </p>
          </div>
        </div>

        {/* Right Controls: Dynamic Bridge Status Badge & Settings */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Main Status Indicator: AI Analyzing State */}
          {operationalState === 'ai_analyzing' && (
            <div
              id="header-ai-analyzing-badge"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-500/70 bg-indigo-950/80 text-indigo-200 text-xs font-semibold animate-pulse shadow-md shadow-indigo-950/50"
            >
              <Brain className="w-3.5 h-3.5 text-indigo-400 animate-bounce" />
              <span>AI Analyzing...</span>
            </div>
          )}

          {/* Active Positions Counter Pill */}
          <div
            id="active-positions-badge"
            className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
              activeTradeCount > 0
                ? 'bg-sky-950/60 border-sky-700/60 text-sky-300'
                : 'bg-[#0a0f1d] border-[#1f2937] text-slate-400'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-sky-400" />
            <span>Active Positions:</span>
            <span
              className={`font-semibold px-1.5 py-0.2 rounded text-[11px] ${
                activeTradeCount > 0 ? 'bg-sky-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {activeTradeCount}
            </span>
          </div>

          {/* Dynamic Connection Status Badge */}
          <div
            id="bridge-connection-badge"
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold tracking-wide transition-all shadow-xs ${
              isSim
                ? 'bg-cyan-950/50 border-cyan-700/60 text-cyan-300'
                : isConnected
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : isConnecting
                ? 'bg-amber-950/40 border-amber-800/60 text-amber-300'
                : 'bg-red-950/40 border-red-800/60 text-red-300'
            }`}
          >
            <span className="relative flex h-2 w-2">
              {isSim ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                </>
              ) : isConnected ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </>
              ) : isConnecting ? (
                <>
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                </>
              ) : (
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-400"></span>
              )}
            </span>

            <div className="flex items-center gap-1.5">
              {isSim ? (
                <>
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Simulation Mode</span>
                </>
              ) : isConnected ? (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Connected {latencyMs !== null ? `(${latencyMs}ms)` : ''}</span>
                </>
              ) : isConnecting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                  <span>Reconnecting...</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  <span>Bridge Disconnected</span>
                </>
              )}
            </div>
          </div>

          {/* Explicit Simulation / Demo Mode Toggle Button */}
          <button
            type="button"
            id="header-toggle-simulation-btn"
            onClick={() => onToggleSimulationMode(!isSim)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              isSim
                ? 'bg-cyan-900/40 hover:bg-cyan-900/60 border-cyan-600 text-cyan-200'
                : 'bg-[#0a0f1d] hover:bg-[#1f2937] border-[#1f2937] text-slate-300 hover:text-white'
            }`}
            title={isSim ? 'Exit Simulation Mode and connect to real MT5 Bridge' : 'Enable Demo / Simulation Mode to test executions'}
          >
            <Sparkles className={`w-3.5 h-3.5 ${isSim ? 'text-cyan-400' : 'text-slate-400'}`} />
            <span className="hidden sm:inline">{isSim ? 'Demo: ON' : 'Demo Mode'}</span>
          </button>

          {/* Quick Reconnect button if disconnected in real mode */}
          {!isConnected && !isConnecting && !isSim && (
            <button
              type="button"
              id="header-reconnect-bridge-btn"
              onClick={onReconnect}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-950/50 hover:bg-sky-900/60 border border-sky-800/50 text-sky-300 hover:text-white text-xs font-semibold transition-all"
              title="Attempt to reconnect to MT5 WebSocket Bridge"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Connect</span>
            </button>
          )}

          {/* Strategy & Risk Rules Trigger Button */}
          {onOpenStrategy && (
            <button
              id="open-strategy-panel-btn"
              onClick={onOpenStrategy}
              className="flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-[#0a0f1d] hover:bg-[#1f2937] border border-sky-800/40 hover:border-sky-600 text-sky-200 hover:text-white transition-all text-xs font-semibold shadow-xs"
              title="Configure RuleEngine Strategy & Risk Guardrails"
            >
              <Sliders className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Strategy &amp; Risk</span>
            </button>
          )}

          {/* Settings Modal Trigger Button */}
          <button
            id="open-settings-modal-btn"
            onClick={onOpenSettings}
            className="flex items-center gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-lg bg-[#0a0f1d] hover:bg-[#1f2937] border border-[#1f2937] hover:border-slate-600 text-slate-200 hover:text-white transition-all text-xs font-medium shadow-xs"
            title="Configure MT5 Bridge and Local Storage Parameters"
          >
            <Settings className="w-4 h-4 text-sky-400" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>
    </header>
  );
};
