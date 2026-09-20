'use client';

import React from 'react';
import { AccountMetrics } from '@/types/trading';
import { Wallet, DollarSign, Shield, TrendingUp, TrendingDown, Clock, AlertCircle } from 'lucide-react';

interface MetricsBarProps {
  metrics: AccountMetrics;
  activePnl: number;
  isConnected: boolean;
}

export const MetricsBar: React.FC<MetricsBarProps> = ({ metrics, activePnl, isConnected }) => {
  // Live dynamic equity based on balance + active running trade PnL
  const currentEquity = isConnected
    ? metrics.equity !== undefined
      ? metrics.equity + activePnl
      : metrics.balance + metrics.todayPnl + activePnl
    : 0;

  const currentFreeMargin = isConnected
    ? metrics.freeMargin !== undefined
      ? metrics.freeMargin
      : currentEquity - metrics.marginUsed
    : 0;

  const combinedTodayPnl = isConnected ? metrics.todayPnl + activePnl : 0;
  const combinedTodayPercent =
    isConnected && metrics.balance > 0 ? (combinedTodayPnl / metrics.balance) * 100 : 0;
  const isPnlPositive = combinedTodayPnl >= 0;

  return (
    <section id="metrics-bar" aria-label="Account Overview Metrics" className="w-full">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Account Balance */}
        <div
          id="metric-balance-card"
          className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 transition-all hover:border-slate-700"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Account Balance</span>
            <div className="p-1.5 rounded-md bg-slate-800/80 text-slate-300">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
            {isConnected ? (
              `$${metrics.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ) : (
              <span className="text-slate-500 font-normal text-lg sm:text-xl font-mono">$0.00</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
            {isConnected ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span>
                  {metrics.broker ? `Broker: ${metrics.broker}` : 'MT5 Live Link'}
                  {metrics.accountNumber ? ` (#${metrics.accountNumber})` : ''}
                </span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                <span className="text-slate-500">Bridge Disconnected</span>
              </>
            )}
          </div>
        </div>

        {/* Equity */}
        <div
          id="metric-equity-card"
          className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 transition-all hover:border-slate-700 relative overflow-hidden"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Equity (Floating)</span>
            <div className="p-1.5 rounded-md bg-sky-950/60 text-sky-400 border border-sky-800/40">
              <DollarSign className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight flex items-baseline gap-2">
            {isConnected ? (
              <>
                ${currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {activePnl !== 0 && (
                  <span
                    className={`text-xs font-semibold ${
                      activePnl > 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    ({activePnl >= 0 ? '+' : ''}${activePnl.toFixed(2)})
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-500 font-normal text-lg sm:text-xl font-mono">$0.00</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400">
            <span className="text-sky-400 font-medium">Margin Level:</span>
            <span className="font-mono text-slate-300">
              {isConnected
                ? metrics.marginUsed > 0
                  ? `${((currentEquity / metrics.marginUsed) * 100).toFixed(0)}%`
                  : 'N/A'
                : '—'}
            </span>
          </div>
        </div>

        {/* Free Margin */}
        <div
          id="metric-free-margin-card"
          className="bg-[#111827] border border-[#1f2937] rounded-xl p-4 transition-all hover:border-slate-700"
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Free Margin</span>
            <div className="p-1.5 rounded-md bg-slate-800/80 text-slate-300">
              <Shield className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
            {isConnected ? (
              `$${currentFreeMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            ) : (
              <span className="text-slate-500 font-normal text-lg sm:text-xl font-mono">$0.00</span>
            )}
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px] text-slate-400">
            <span>Used: ${isConnected ? metrics.marginUsed.toFixed(2) : '0.00'}</span>
            <span className="text-emerald-400 font-medium">
              {metrics.leverage ? `1:${metrics.leverage} Lev` : isConnected ? '1:100 Lev' : '—'}
            </span>
          </div>
        </div>

        {/* Today's Realized & Live P&L */}
        <div
          id="metric-today-pnl-card"
          className={`bg-[#111827] border rounded-xl p-4 transition-all ${
            !isConnected
              ? 'border-[#1f2937]'
              : isPnlPositive
              ? 'border-emerald-800/40 hover:border-emerald-700/60 bg-gradient-to-br from-[#111827] to-emerald-950/20'
              : 'border-red-800/40 hover:border-red-700/60 bg-gradient-to-br from-[#111827] to-red-950/20'
          }`}
        >
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Today&apos;s Realized P&L</span>
            <div
              className={`p-1.5 rounded-md border ${
                !isConnected
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : isPnlPositive
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800/40'
                  : 'bg-red-950/60 text-red-400 border-red-800/40'
              }`}
            >
              {isPnlPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            </div>
          </div>
          <div
            className={`text-xl sm:text-2xl font-bold font-mono tracking-tight ${
              !isConnected ? 'text-slate-500 font-normal text-lg sm:text-xl' : isPnlPositive ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {isConnected ? (
              `${isPnlPositive ? '+' : ''}$${combinedTodayPnl.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            ) : (
              '$0.00'
            )}
          </div>
          <div className="flex items-center justify-between mt-1 text-[11px]">
            <span
              className={`font-semibold px-1.5 py-0.5 rounded text-[10px] ${
                !isConnected
                  ? 'bg-slate-800 text-slate-500'
                  : isPnlPositive
                  ? 'bg-emerald-900/50 text-emerald-300'
                  : 'bg-red-900/50 text-red-300'
              }`}
            >
              {isConnected ? `${isPnlPositive ? '+' : ''}${combinedTodayPercent.toFixed(2)}%` : '0.00%'}
            </span>
            <span className="text-slate-400 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {isConnected ? 'Live Session' : 'Standby'}
            </span>
          </div>
        </div>
      </div>
    </section>
  );
};
