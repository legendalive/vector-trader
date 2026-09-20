'use client';

import React, { useState } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '@/types/trading';
import {
  Settings,
  X,
  Eye,
  EyeOff,
  Save,
  RotateCcw,
  ShieldAlert,
  Server,
  Key,
  Percent,
  CheckCircle2,
  Lock,
  RefreshCw,
  AlertCircle,
  Download,
  Upload,
  FileJson,
} from 'lucide-react';
import { EngineConnectionStatus } from '@/services/ExecutionEngine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  bridgeStatus: EngineConnectionStatus | 'disconnected' | 'connecting' | 'connected' | 'error' | string;
  latencyMs: number | null;
  isSimulationMode?: boolean;
  onToggleSimulationMode?: (enabled: boolean) => void;
  onSave: (newSettings: AppSettings) => void;
  onTestConnection: (url: string) => Promise<{ success: boolean; latency?: number; message?: string }>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  bridgeStatus,
  latencyMs,
  isSimulationMode = false,
  onToggleSimulationMode,
  onSave,
  onTestConnection,
}) => {
  if (!isOpen) return null;

  return (
    <SettingsModalContent
      onClose={onClose}
      settings={settings}
      bridgeStatus={bridgeStatus}
      latencyMs={latencyMs}
      isSimulationMode={isSimulationMode}
      onToggleSimulationMode={onToggleSimulationMode}
      onSave={onSave}
      onTestConnection={onTestConnection}
    />
  );
};

const SettingsModalContent: React.FC<Omit<SettingsModalProps, 'isOpen'>> = ({
  onClose,
  settings,
  bridgeStatus,
  latencyMs,
  isSimulationMode = false,
  onToggleSimulationMode,
  onSave,
  onTestConnection,
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);
  const [showApiKey, setShowApiKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [testingStatus, setTestingStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testResultMsg, setTestResultMsg] = useState<string>('');
  const [configNotice, setConfigNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExportConfig = () => {
    try {
      const exportData = {
        appName: 'Vector Trader',
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        securityNotice:
          'API keys and sensitive credentials are intentionally excluded from configuration exports for security.',
        strategyRules: {
          emaFastPeriod: formData.emaFastPeriod,
          emaSlowPeriod: formData.emaSlowPeriod,
          rsiPeriod: formData.rsiPeriod,
          rsiOverbought: formData.rsiOverbought,
          rsiOversold: formData.rsiOversold,
          atrPeriod: formData.atrPeriod,
          atrSlMultiplier: formData.atrSlMultiplier,
          atrTpMultiplier: formData.atrTpMultiplier,
          slMode: formData.slMode,
          fixedSlPips: formData.fixedSlPips,
          fixedTpPips: formData.fixedTpPips,
        },
        riskParameters: {
          riskPerTradePercent: formData.riskPerTradePercent,
          maxDailyDrawdownPercent: formData.maxDailyDrawdownPercent,
          maxOpenPositions: formData.maxOpenPositions,
          maxSpreadPips: formData.maxSpreadPips,
        },
        bridgeConfig: {
          bridgeUrl: formData.bridgeUrl,
        },
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `vector-trader-config-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setConfigNotice({
        type: 'success',
        message: 'Strategy rules & risk parameters exported to JSON. (API keys excluded)',
      });
      setTimeout(() => setConfigNotice(null), 4000);
    } catch (err: any) {
      setConfigNotice({
        type: 'error',
        message: `Failed to export configuration: ${err?.message || 'Unknown error'}`,
      });
    }
  };

  const handleImportConfigFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);

        // Normalize format (whether nested in strategyRules or flat)
        const strat = parsed.strategyRules || parsed;
        const risk = parsed.riskParameters || parsed;
        const bridge = parsed.bridgeConfig || parsed;

        setFormData((prev) => ({
          ...prev,
          // Strategy rules (with numeric validation)
          emaFastPeriod: Number(strat.emaFastPeriod) > 0 ? Number(strat.emaFastPeriod) : prev.emaFastPeriod,
          emaSlowPeriod: Number(strat.emaSlowPeriod) > 0 ? Number(strat.emaSlowPeriod) : prev.emaSlowPeriod,
          rsiPeriod: Number(strat.rsiPeriod) > 0 ? Number(strat.rsiPeriod) : prev.rsiPeriod,
          rsiOverbought:
            Number(strat.rsiOverbought) > 50 && Number(strat.rsiOverbought) <= 95
              ? Number(strat.rsiOverbought)
              : prev.rsiOverbought,
          rsiOversold:
            Number(strat.rsiOversold) >= 5 && Number(strat.rsiOversold) < 50
              ? Number(strat.rsiOversold)
              : prev.rsiOversold,
          atrPeriod: Number(strat.atrPeriod) > 0 ? Number(strat.atrPeriod) : prev.atrPeriod,
          atrSlMultiplier: Number(strat.atrSlMultiplier) > 0 ? Number(strat.atrSlMultiplier) : prev.atrSlMultiplier,
          atrTpMultiplier: Number(strat.atrTpMultiplier) > 0 ? Number(strat.atrTpMultiplier) : prev.atrTpMultiplier,
          slMode: strat.slMode === 'fixed' || strat.slMode === 'atr' ? strat.slMode : prev.slMode,
          fixedSlPips: Number(strat.fixedSlPips) > 0 ? Number(strat.fixedSlPips) : prev.fixedSlPips,
          fixedTpPips: Number(strat.fixedTpPips) > 0 ? Number(strat.fixedTpPips) : prev.fixedTpPips,

          // Risk parameters (with numeric validation)
          riskPerTradePercent:
            Number(risk.riskPerTradePercent) > 0 && Number(risk.riskPerTradePercent) <= 10
              ? Number(risk.riskPerTradePercent)
              : prev.riskPerTradePercent,
          maxDailyDrawdownPercent:
            Number(risk.maxDailyDrawdownPercent) > 0 && Number(risk.maxDailyDrawdownPercent) <= 50
              ? Number(risk.maxDailyDrawdownPercent)
              : prev.maxDailyDrawdownPercent,
          maxOpenPositions:
            Number(risk.maxOpenPositions) > 0 ? Math.floor(Number(risk.maxOpenPositions)) : prev.maxOpenPositions,
          maxSpreadPips: Number(risk.maxSpreadPips) > 0 ? Number(risk.maxSpreadPips) : prev.maxSpreadPips,

          // Bridge URL if provided
          bridgeUrl: bridge.bridgeUrl?.trim() || prev.bridgeUrl,

          // CRITICAL: NEVER overwrite or clear local Gemini API key from import file
          geminiApiKey: prev.geminiApiKey,
        }));

        setConfigNotice({
          type: 'success',
          message: 'Configuration imported successfully! Click "Save Configuration" to persist.',
        });
        setTimeout(() => setConfigNotice(null), 5000);
      } catch (err: any) {
        setConfigNotice({
          type: 'error',
          message: `Invalid configuration file: ${err?.message || 'JSON parse failure'}`,
        });
      } finally {
        // Reset file input so user can import the same file again if desired
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.readAsText(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      configured: true,
    });
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 600);
  };

  const handleReset = () => {
    setFormData(DEFAULT_SETTINGS);
  };

  const handleRunTest = async () => {
    setTestingStatus('testing');
    setTestResultMsg('');
    try {
      const result = await onTestConnection(formData.bridgeUrl);
      if (result.success) {
        setTestingStatus('success');
        setTestResultMsg(`Handshake successful! Response time: ${result.latency || 12}ms`);
      } else {
        setTestingStatus('failed');
        setTestResultMsg(result.message || 'Unable to reach WebSocket daemon.');
      }
    } catch (err: any) {
      setTestingStatus('failed');
      setTestResultMsg(err?.message || 'Connection failed.');
    }
  };

  return (
    <div
      id="settings-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="settings-modal-content"
        className="w-full max-w-lg bg-[#111827] border border-[#1f2937] rounded-xl shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1f2937] bg-[#0d1322]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-sky-950/60 border border-sky-800/40 text-sky-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Engine Configuration</h2>
              <p className="text-xs text-slate-400">MetaTrader 5 Bridge parameters & local storage</p>
            </div>
          </div>
          <button
            id="close-settings-modal-btn"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-100 transition-colors p-1.5 rounded-lg hover:bg-[#1f2937]"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="mx-6 mt-4 p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex items-start gap-2.5">
          <Lock className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-300 leading-relaxed">
            <span className="font-semibold text-emerald-400">Zero Server Storage:</span> All bridge URLs,
            risk parameters, and API keys are strictly stored within your browser&apos;s{' '}
            <code className="bg-black/30 px-1 py-0.5 rounded text-emerald-300">localStorage</code>.
            Keys and orders are never transmitted to external analytics servers.
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* MT5 Bridge URL */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <Server className="w-3.5 h-3.5 text-sky-400" />
                MetaTrader 5 Bridge URL
              </label>
              <button
                type="button"
                id="test-bridge-url-btn"
                onClick={handleRunTest}
                disabled={testingStatus === 'testing'}
                className="flex items-center gap-1 text-[11px] text-sky-400 hover:text-sky-300 font-medium transition-colors"
              >
                <RefreshCw className={`w-3 h-3 ${testingStatus === 'testing' ? 'animate-spin' : ''}`} />
                <span>{testingStatus === 'testing' ? 'Testing...' : 'Test Connection'}</span>
              </button>
            </div>
            <div className="relative">
              <input
                id="bridge-url-input"
                type="text"
                value={formData.bridgeUrl}
                onChange={(e) => setFormData({ ...formData, bridgeUrl: e.target.value })}
                placeholder="ws://localhost:8080"
                className="w-full bg-[#0a0f1d] border border-[#1f2937] focus:border-sky-500 focus:outline-hidden rounded-lg px-3.5 py-2.5 text-sm text-slate-200 font-mono"
                required
              />
            </div>
            {testingStatus === 'success' && (
              <p className="text-[11px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{testResultMsg}</span>
              </p>
            )}
            {testingStatus === 'failed' && (
              <p className="text-[11px] text-red-400 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{testResultMsg}</span>
              </p>
            )}
            <p className="text-[11px] text-slate-400">
              WebSocket address of your MetaTrader 5 Python bridge or WebSockets EA daemon.
            </p>
          </div>

          {/* Gemini API Key */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-300 uppercase tracking-wider">
              <Key className="w-3.5 h-3.5 text-sky-400" />
              Gemini API Key (Optional AI Signal Reasoner)
            </label>
            <div className="relative">
              <input
                id="gemini-api-key-input"
                type={showApiKey ? 'text' : 'password'}
                value={formData.geminiApiKey}
                onChange={(e) => setFormData({ ...formData, geminiApiKey: e.target.value })}
                placeholder="AIzaSy..."
                className="w-full bg-[#0a0f1d] border border-[#1f2937] focus:border-sky-500 focus:outline-hidden rounded-lg pl-3.5 pr-10 py-2.5 text-sm text-slate-200 font-mono"
              />
              <button
                type="button"
                id="toggle-gemini-key-visibility-btn"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                tabIndex={-1}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              Locally stored key for automated prompt evaluation and news sentiment analysis.
            </p>
          </div>

          {/* Risk Control Parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <Percent className="w-3.5 h-3.5 text-amber-400" />
                Risk / Trade
              </label>
              <div className="relative">
                <input
                  id="max-risk-input"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="10.0"
                  value={formData.riskPerTradePercent ?? formData.maxRiskPerTrade}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setFormData({ ...formData, maxRiskPerTrade: val, riskPerTradePercent: val });
                  }}
                  className="w-full bg-[#0a0f1d] border border-[#1f2937] focus:border-amber-500 focus:outline-hidden rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                  required
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                  %
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Equity sizing allocation.</p>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
                Max Daily DD
              </label>
              <div className="relative">
                <input
                  id="max-drawdown-input"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="20.0"
                  value={formData.maxDailyDrawdownPercent ?? formData.maxDailyDrawdown}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    setFormData({ ...formData, maxDailyDrawdown: val, maxDailyDrawdownPercent: val });
                  }}
                  className="w-full bg-[#0a0f1d] border border-[#1f2937] focus:border-red-500 focus:outline-hidden rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                  required
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">
                  %
                </span>
              </div>
              <p className="text-[10px] text-slate-400">Auto-killswitch threshold.</p>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Max Positions
              </label>
              <div className="relative">
                <input
                  id="modal-max-positions-input"
                  type="number"
                  step="1"
                  min="1"
                  max="10"
                  value={formData.maxOpenPositions ?? 1}
                  onChange={(e) =>
                    setFormData({ ...formData, maxOpenPositions: parseInt(e.target.value, 10) || 1 })
                  }
                  className="w-full bg-[#0a0f1d] border border-[#1f2937] focus:border-sky-500 focus:outline-hidden rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                  required
                />
              </div>
              <p className="text-[10px] text-slate-400">Concurrent active limit.</p>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Max Spread
              </label>
              <div className="relative">
                <input
                  id="modal-max-spread-input"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="25.0"
                  value={formData.maxSpreadPips ?? 3.0}
                  onChange={(e) =>
                    setFormData({ ...formData, maxSpreadPips: parseFloat(e.target.value) || 1.0 })
                  }
                  className="w-full bg-[#0a0f1d] border border-[#1f2937] focus:border-emerald-500 focus:outline-hidden rounded-lg px-3 py-2 text-xs text-slate-200 font-mono"
                  required
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 font-medium">
                  pips
                </span>
              </div>
              <p className="text-[10px] text-slate-400">High spread guard.</p>
            </div>
          </div>

          {/* Indicator & Exit Parameters Group */}
          <div className="p-3.5 rounded-lg bg-[#0a0f1d] border border-[#1f2937] space-y-2.5">
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider block">
              RuleEngine Technical Parameters &amp; ATR Exits
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div>
                <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  EMA Fast / Slow
                </label>
                <div className="flex items-center gap-1 font-mono">
                  <input
                    type="number"
                    value={formData.emaFastPeriod ?? 9}
                    onChange={(e) =>
                      setFormData({ ...formData, emaFastPeriod: parseInt(e.target.value, 10) || 9 })
                    }
                    className="w-14 bg-[#111827] border border-[#1f2937] rounded px-2 py-1 text-xs text-slate-200"
                  />
                  <span className="text-slate-500">/</span>
                  <input
                    type="number"
                    value={formData.emaSlowPeriod ?? 21}
                    onChange={(e) =>
                      setFormData({ ...formData, emaSlowPeriod: parseInt(e.target.value, 10) || 21 })
                    }
                    className="w-14 bg-[#111827] border border-[#1f2937] rounded px-2 py-1 text-xs text-slate-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  RSI Period / Limits
                </label>
                <div className="flex items-center gap-1 font-mono">
                  <input
                    type="number"
                    value={formData.rsiPeriod ?? 14}
                    onChange={(e) =>
                      setFormData({ ...formData, rsiPeriod: parseInt(e.target.value, 10) || 14 })
                    }
                    className="w-12 bg-[#111827] border border-[#1f2937] rounded px-2 py-1 text-xs text-slate-200"
                  />
                  <span className="text-slate-500">[{formData.rsiOversold ?? 30}/{formData.rsiOverbought ?? 70}]</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Exit Mode
                </label>
                <select
                  value={formData.slMode ?? 'atr'}
                  onChange={(e) =>
                    setFormData({ ...formData, slMode: e.target.value as 'atr' | 'fixed_pips' })
                  }
                  className="w-full bg-[#111827] border border-[#1f2937] rounded px-2 py-1 text-xs text-slate-200"
                >
                  <option value="atr">ATR Multiplier</option>
                  <option value="fixed_pips">Fixed Pips</option>
                </select>
              </div>

              <div>
                <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  {formData.slMode === 'atr' ? 'ATR SL & TP Mult.' : 'Fixed SL & TP (Pips)'}
                </label>
                <div className="flex items-center gap-1 font-mono">
                  {formData.slMode === 'atr' ? (
                    <>
                      <span className="text-red-400">{formData.atrSlMultiplier ?? 1.5}x</span>
                      <span className="text-slate-500">/</span>
                      <span className="text-emerald-400">{formData.atrTpMultiplier ?? 2.5}x</span>
                    </>
                  ) : (
                    <>
                      <span className="text-red-400">{formData.fixedSlPips ?? 20}p</span>
                      <span className="text-slate-500">/</span>
                      <span className="text-emerald-400">{formData.fixedTpPips ?? 40}p</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Current Live Connection Status Info */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-[#0a0f1d] border border-[#1f2937]">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${
                  isSimulationMode || bridgeStatus === 'SIMULATION'
                    ? 'bg-cyan-400 shadow-xs shadow-cyan-400/50'
                    : bridgeStatus === 'CONNECTED' || bridgeStatus === 'connected'
                    ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50'
                    : bridgeStatus === 'RECONNECTING' || bridgeStatus === 'connecting'
                    ? 'bg-amber-400'
                    : 'bg-red-400'
                }`}
              />
              <div>
                <span className="text-xs font-medium text-slate-200 block">
                  Actual Bridge Status:{' '}
                  {isSimulationMode || bridgeStatus === 'SIMULATION'
                    ? 'Simulation Mode (Virtual Sandbox)'
                    : bridgeStatus === 'CONNECTED' || bridgeStatus === 'connected'
                    ? `Connected (${latencyMs || 0}ms)`
                    : bridgeStatus === 'RECONNECTING' || bridgeStatus === 'connecting'
                    ? 'Handshake / Reconnecting...'
                    : 'Disconnected'}
                </span>
                <span className="text-[11px] text-slate-400 block font-mono">
                  {isSimulationMode ? 'Simulated Local Sandbox' : formData.bridgeUrl}
                </span>
              </div>
            </div>

            {onToggleSimulationMode && (
              <button
                type="button"
                id="modal-toggle-simulation-btn"
                onClick={() => onToggleSimulationMode(!isSimulationMode)}
                className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${
                  isSimulationMode
                    ? 'bg-cyan-950 border-cyan-700 text-cyan-300 hover:bg-cyan-900'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {isSimulationMode ? 'Disable Demo' : 'Use Demo Mode'}
              </button>
            )}
          </div>

          {/* Configuration Import / Export Utility */}
          <div className="p-3.5 rounded-xl bg-[#111827] border border-[#1f2937]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-sky-950/50 border border-sky-800/40 text-sky-400">
                <FileJson className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-200">Local Configuration Utility</div>
                <div className="text-[11px] text-slate-400">
                  Export or import strategy & risk rules as JSON (API keys excluded)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportConfigFile}
                accept=".json,application/json"
                className="hidden"
                id="import-config-file-input"
              />
              <button
                type="button"
                id="import-config-btn"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-[#1f2937] hover:bg-slate-700 border border-slate-700 transition-colors"
                title="Import configuration from a local JSON file"
              >
                <Upload className="w-3.5 h-3.5 text-sky-400" />
                Import Config
              </button>
              <button
                type="button"
                id="export-config-btn"
                onClick={handleExportConfig}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-[#1f2937] hover:bg-slate-700 border border-slate-700 transition-colors"
                title="Export current strategy and risk parameters as JSON"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Export Config
              </button>
            </div>
          </div>

          {/* Configuration feedback notification */}
          {configNotice && (
            <div
              id="config-feedback-banner"
              className={`p-2.5 rounded-lg text-xs flex items-center gap-2 border animate-in fade-in duration-150 ${
                configNotice.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-800 text-emerald-300'
                  : 'bg-rose-950/40 border-rose-800 text-rose-300'
              }`}
            >
              {configNotice.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <span>{configNotice.message}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#1f2937]">
            <button
              type="button"
              id="reset-settings-defaults-btn"
              onClick={handleReset}
              className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors px-2 py-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Defaults
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                id="cancel-settings-btn"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:text-white bg-[#1f2937] hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="save-settings-btn"
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-950/40 transition-all"
              >
                {savedSuccess ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    Saved!
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
