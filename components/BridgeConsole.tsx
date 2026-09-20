'use client';

import React, { useState } from 'react';
import { Terminal, ChevronDown, ChevronUp, Trash2, CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';
import { EngineLogEntry, EngineConnectionStatus } from '@/services/ExecutionEngine';

interface BridgeConsoleProps {
  logs: EngineLogEntry[];
  bridgeStatus: EngineConnectionStatus | 'disconnected' | 'connecting' | 'connected' | 'error' | string;
  bridgeUrl: string;
  onClearLogs?: () => void;
}

export const BridgeConsole: React.FC<BridgeConsoleProps> = ({
  logs,
  bridgeStatus,
  bridgeUrl,
  onClearLogs,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const statusUpper = bridgeStatus.toUpperCase();
  const isSim = statusUpper === 'SIMULATION';
  const isConnected = statusUpper === 'CONNECTED';
  const isReconnecting = statusUpper === 'RECONNECTING' || statusUpper === 'CONNECTING';

  return (
    <section
      id="bridge-telemetry-console"
      aria-label="MT5 Bridge Telemetry Log"
      className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden shadow-lg transition-all"
    >
      {/* Header bar that can be clicked to toggle */}
      <button
        type="button"
        id="toggle-bridge-console-btn"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-5 py-3 flex items-center justify-between bg-[#0d1322] hover:bg-[#131b2e] transition-colors border-b border-[#1f2937] text-left"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-slate-800 text-sky-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-200 tracking-wider uppercase">
                Daemon Telemetry & WebSocket Log
              </span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded font-mono font-semibold ${
                  isSim
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-800/60'
                    : isConnected
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                    : isReconnecting
                    ? 'bg-amber-950 text-amber-300 border border-amber-800/60'
                    : 'bg-red-950 text-red-300 border border-red-800/60'
                }`}
              >
                {statusUpper}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 block font-mono">
              Target: {bridgeUrl} &bull; {logs.length} events logged
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-xs hidden sm:inline text-slate-400">
            {isExpanded ? 'Collapse Log' : 'Inspect Live Stream'}
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expanded Log Console Body */}
      {isExpanded && (
        <div className="p-4 bg-[#0a0f1d] border-t border-[#1f2937]/50 font-mono text-xs">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1f2937] text-[11px] text-slate-400">
            <span>Live MT5 Daemon Execution & Handshake Stream</span>
            {logs.length > 0 && onClearLogs && (
              <button
                type="button"
                id="clear-bridge-logs-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearLogs();
                }}
                className="flex items-center gap-1 hover:text-slate-200 transition-colors"
              >
                <Trash2 className="w-3 h-3" />
                <span>Clear Console</span>
              </button>
            )}
          </div>

          <div
            id="bridge-log-viewport"
            className="max-h-60 overflow-y-auto space-y-1.5 pr-2 scrollbar-thin"
          >
            {logs.length === 0 ? (
              <div className="py-4 text-center text-slate-500 italic">
                Awaiting connection events from {bridgeUrl}...
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2.5 py-1 px-2 rounded hover:bg-[#111827] transition-colors leading-relaxed"
                >
                  <span className="text-slate-500 shrink-0 text-[10px] pt-0.5">
                    [{log.timestamp}]
                  </span>
                  {log.level === 'success' && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  )}
                  {log.level === 'warn' && (
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                  )}
                  {log.level === 'error' && (
                    <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  )}
                  {log.level === 'info' && (
                    <Info className="w-3.5 h-3.5 text-sky-400 shrink-0 mt-0.5" />
                  )}

                  <span
                    className={`text-[11px] break-all ${
                      log.level === 'success'
                        ? 'text-emerald-300'
                        : log.level === 'warn'
                        ? 'text-amber-300'
                        : log.level === 'error'
                        ? 'text-red-300'
                        : 'text-slate-300'
                    }`}
                  >
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
};
