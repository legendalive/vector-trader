'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  OperationalState,
  Trade,
  AccountMetrics,
  AppSettings,
  DEFAULT_SETTINGS,
  AVAILABLE_SYMBOLS,
} from '@/types/trading';
import { StorageService } from '@/lib/storage';
import {
  executionEngine,
  EngineConnectionStatus,
  EngineLogEntry,
} from '@/services/ExecutionEngine';
import { Header } from '@/components/Header';
import { MetricsBar } from '@/components/MetricsBar';
import { ControlPanel } from '@/components/ControlPanel';
import { LiveExecutionCard } from '@/components/LiveExecutionCard';
import { TradeHistoryTable } from '@/components/TradeHistoryTable';
import { BridgeConsole } from '@/components/BridgeConsole';
import { SettingsModal } from '@/components/SettingsModal';
import { StrategyRiskPanel } from '@/components/StrategyRiskPanel';
import { AIOverviewPanel } from '@/components/AIOverviewPanel';
import { ruleEngine } from '@/services/RuleEngine';

export default function VectorTraderDashboard() {
  const isClient = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Core operational state
  const [operationalState, setOperationalState] = useState<OperationalState>('at_rest');
  const [selectedSymbol, setSelectedSymbol] = useState<string>('EURUSD');
  const [activeTrade, setActiveTrade] = useState<Trade | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStrategyOpen, setIsStrategyOpen] = useState(false);
  const [scanTimeSeconds, setScanTimeSeconds] = useState(0);

  // Execution Engine connection telemetry state
  const [bridgeStatus, setBridgeStatus] = useState<EngineConnectionStatus>('DISCONNECTED');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [isSimulationMode, setIsSimulationMode] = useState<boolean>(false);
  const [bridgeLogs, setBridgeLogs] = useState<EngineLogEntry[]>([]);

  // Account metrics (Zeroed by default until real MT5 telemetry or simulated demo is received)
  const [metrics, setMetrics] = useState<AccountMetrics>({
    balance: 0,
    equity: 0,
    freeMargin: 0,
    marginUsed: 0,
    todayPnl: 0,
    todayPnlPercent: 0,
    isConnected: false,
  });

  const scanTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize storage and ExecutionEngine connection
  useEffect(() => {
    let unsubStatus: () => void = () => {};
    let unsubAccount: () => void = () => {};
    let unsubPosition: () => void = () => {};
    let unsubHistory: () => void = () => {};
    let unsubState: () => void = () => {};
    let unsubLogHandler: () => void = () => {};

    const initTimer = setTimeout(() => {
      const loadedSettings = StorageService.getSettings();
      const loadedTrades = StorageService.getTrades();
      setSettings(loadedSettings);
      setTrades(loadedTrades);

      // Subscribe to ExecutionEngine events
      unsubStatus = executionEngine.onStatus((status, latency) => {
        setBridgeStatus(status);
        setLatencyMs(latency);
        setIsSimulationMode(status === 'SIMULATION');
        setMetrics((prev) => ({
          ...prev,
          isConnected: status === 'CONNECTED' || status === 'SIMULATION',
        }));
      });

      unsubAccount = executionEngine.onAccount((data) => {
        setMetrics(data);
      });

      unsubPosition = executionEngine.onPosition((trade) => {
        setActiveTrade(trade);
        if (trade) {
          setOperationalState('trade_running');
        } else {
          setOperationalState((curr) => (curr === 'trade_running' ? 'at_rest' : curr));
        }
      });

      unsubHistory = executionEngine.onHistory((newTrades) => {
        setTrades(newTrades);
        StorageService.saveTrades(newTrades);
      });

      unsubState = executionEngine.onState((state) => {
        setOperationalState(state);
        if (state !== 'scanning') {
          if (scanTimerRef.current) {
            clearInterval(scanTimerRef.current);
            scanTimerRef.current = null;
          }
        }
      });

      const unsubLog = () => {
        setBridgeLogs([...executionEngine.logs]);
      };
      unsubLogHandler = executionEngine.onLog(unsubLog);

      // Initial logs copy
      setBridgeLogs([...executionEngine.logs]);

      // Connect to MT5 Bridge using configured URL
      executionEngine.connect(loadedSettings.bridgeUrl);
    }, 0);

    return () => {
      clearTimeout(initTimer);
      unsubStatus();
      unsubAccount();
      unsubPosition();
      unsubHistory();
      unsubState();
      unsubLogHandler();
      if (scanTimerRef.current) {
        clearInterval(scanTimerRef.current);
      }
    };
  }, []);

  // Toggle Simulation Mode
  const handleToggleSimulationMode = useCallback((enabled: boolean) => {
    setIsSimulationMode(enabled);
    executionEngine.setSimulationMode(enabled);
  }, []);

  // Save settings helper
  const handleSaveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    StorageService.saveSettings(newSettings);
    ruleEngine.updateSettings(newSettings);
    if (newSettings.bridgeUrl !== settings.bridgeUrl) {
      executionEngine.setUrl(newSettings.bridgeUrl);
    }
  };

  // Reconnect trigger
  const handleReconnect = () => {
    executionEngine.reconnect();
  };

  // Clear trade history
  const handleClearTrades = () => {
    StorageService.clearTrades();
    setTrades([]);
  };

  // Clear logs
  const handleClearLogs = () => {
    executionEngine.clearLogs();
    setBridgeLogs([]);
  };

  // Test connection WebSocket probe
  const handleTestConnection = (url: string): Promise<{ success: boolean; latency?: number; message?: string }> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      let hasFinished = false;

      try {
        const testWs = new WebSocket(url);
        const timeout = setTimeout(() => {
          if (!hasFinished) {
            hasFinished = true;
            try {
              testWs.close();
            } catch (e) {}
            resolve({
              success: false,
              message: `Timeout: No response from ${url} within 3.5 seconds.`,
            });
          }
        }, 3500);

        testWs.onopen = () => {
          if (!hasFinished) {
            hasFinished = true;
            clearTimeout(timeout);
            const roundtrip = Date.now() - startTime;
            testWs.close();
            resolve({ success: true, latency: roundtrip });
          }
        };

        testWs.onerror = () => {
          if (!hasFinished) {
            hasFinished = true;
            clearTimeout(timeout);
            resolve({
              success: false,
              message: `Failed to connect to ${url}. Ensure the MT5 daemon is running.`,
            });
          }
        };
      } catch (err: any) {
        resolve({ success: false, message: err?.message || 'Invalid WebSocket URL' });
      }
    });
  };

  // Start Scanning Handler
  const handleStartScanning = () => {
    if (bridgeStatus !== 'CONNECTED' && !isSimulationMode) {
      return;
    }

    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
    }

    setOperationalState('scanning');
    setScanTimeSeconds(0);

    // Command ExecutionEngine to start scanning
    executionEngine.startScanning(selectedSymbol, settings.maxRiskPerTrade, settings.maxDailyDrawdown);

    // Track local scan duration
    scanTimerRef.current = setInterval(() => {
      setScanTimeSeconds((prev) => prev + 1);
    }, 1000);
  };

  // Emergency Stop Switch Handler
  const handleEmergencyStop = () => {
    if (scanTimerRef.current) {
      clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    setOperationalState('at_rest');
    setScanTimeSeconds(0);

    // Command ExecutionEngine to immediately stop scanner and close open positions
    executionEngine.emergencyStop();
  };

  // Close active trade (market order execution via ExecutionEngine)
  const handleCloseActiveTrade = (tradeId: string) => {
    executionEngine.closeTrade(tradeId);
  };

  if (!isClient) {
    return (
      <div className="min-h-screen bg-[#0a0f1d] flex items-center justify-center text-slate-400">
        <div className="flex items-center gap-2.5 text-sm font-mono">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-ping" />
          <span>Starting Vector Trader Engine...</span>
        </div>
      </div>
    );
  }

  const activePnl = activeTrade?.netPnl ?? 0;
  const activeTradeCount = activeTrade ? 1 : 0;
  const isConnected = bridgeStatus === 'CONNECTED' || isSimulationMode;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0f1d] text-slate-100 selection:bg-cyan-500/30">
      {/* Navigation Header */}
      <Header
        settings={settings}
        bridgeStatus={bridgeStatus}
        latencyMs={latencyMs}
        activeTradeCount={activeTradeCount}
        isSimulationMode={isSimulationMode}
        operationalState={operationalState}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenStrategy={() => setIsStrategyOpen(true)}
        onReconnect={handleReconnect}
        onToggleSimulationMode={handleToggleSimulationMode}
      />

      {/* Main Workspace Dashboard */}
      <main id="main-content" className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Top Metrics Bar */}
        <MetricsBar metrics={metrics} activePnl={activePnl} isConnected={isConnected} />

        {/* Core Control Panel */}
        <ControlPanel
          operationalState={operationalState}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={setSelectedSymbol}
          onStartScanning={handleStartScanning}
          onEmergencyStop={handleEmergencyStop}
          settings={settings}
          isConnected={bridgeStatus === 'CONNECTED'}
          isSimulationMode={isSimulationMode}
          onToggleSimulationMode={handleToggleSimulationMode}
          onReconnectBridge={handleReconnect}
          onOpenStrategy={() => setIsStrategyOpen(true)}
          activeTradeCount={activeTradeCount}
        />

        {/* Live Execution & System Status Card */}
        <LiveExecutionCard
          operationalState={operationalState}
          activeTrade={activeTrade}
          selectedSymbol={selectedSymbol}
          scanTimeSeconds={scanTimeSeconds}
          isConnected={isConnected}
          isSimulationMode={isSimulationMode}
          accountMetrics={metrics}
          onCloseTrade={handleCloseActiveTrade}
        />

        {/* AI Market Overview & Decision Log Panel (Gemini 3.8 Flash Overseer) */}
        <AIOverviewPanel
          selectedSymbol={selectedSymbol}
          accountMetrics={metrics}
          onOpenSettings={() => setIsSettingsOpen(true)}
        />

        {/* Recent Trade History Table (Actual trades only, zero demo data unless simulated) */}
        <TradeHistoryTable
          trades={trades}
          activeTrade={activeTrade}
          onClearTrades={handleClearTrades}
        />

        {/* Live Daemon Telemetry & WebSocket Event Console */}
        <BridgeConsole
          logs={bridgeLogs}
          bridgeStatus={bridgeStatus}
          bridgeUrl={isSimulationMode ? 'Simulated Sandbox (Mock MT5 Engine)' : settings.bridgeUrl}
          onClearLogs={handleClearLogs}
        />

        {/* Informative Footer */}
        <footer className="pt-4 pb-2 border-t border-[#1f2937] flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400' : 'bg-red-400'
              }`}
            />
            <span>
              MT5 Daemon Bridge:{' '}
              {isSimulationMode ? 'Simulated Local Sandbox' : settings.bridgeUrl}
            </span>
            <span>&bull;</span>
            <span>Deployment: GitHub Pages Static Single-Page App</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Status: {isSimulationMode ? 'Simulation Active' : isConnected ? 'Online' : 'Awaiting Connection'}</span>
            <span>Risk Guard: {settings.maxRiskPerTrade}% Equity</span>
          </div>
        </footer>
      </main>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        bridgeStatus={bridgeStatus}
        latencyMs={latencyMs}
        isSimulationMode={isSimulationMode}
        onToggleSimulationMode={handleToggleSimulationMode}
        onSave={handleSaveSettings}
        onTestConnection={handleTestConnection}
      />

      {/* RuleEngine Strategy & Risk Guardrails Modal */}
      {isStrategyOpen && (
        <div
          id="strategy-modal-backdrop"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsStrategyOpen(false);
          }}
        >
          <div className="w-full max-w-4xl my-auto">
            <StrategyRiskPanel
              settings={settings}
              onSave={(updated) => {
                handleSaveSettings(updated);
              }}
              onClose={() => setIsStrategyOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
