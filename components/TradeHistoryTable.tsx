'use client';

import React from 'react';
import { Trade } from '@/types/trading';
import {
  History,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  XCircle,
  Radio,
  FileText,
  Trash2,
} from 'lucide-react';

interface TradeHistoryTableProps {
  trades: Trade[];
  activeTrade?: Trade | null;
  onClearTrades?: () => void;
}

export const TradeHistoryTable: React.FC<TradeHistoryTableProps> = ({
  trades,
  activeTrade,
  onClearTrades,
}) => {
  // Take last 10 trades
  const displayTrades = trades.slice(0, 10);

  return (
    <section
      id="trade-history-section"
      aria-label="Recent Execution Log"
      className="bg-[#111827] border border-[#1f2937] rounded-xl p-5 shadow-lg relative overflow-hidden"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[#1f2937]">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-[#0a0f1d] border border-[#1f2937] text-slate-300">
            <History className="w-4 h-4 text-sky-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider">
              Recent Trade History
            </h2>
            <p className="text-[11px] text-slate-400">Actual automated MetaTrader 5 execution records</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>Win / Profit</span>
          </div>
          <div className="flex items-center gap-1.5 text-red-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span>Loss / Stop</span>
          </div>
          {activeTrade && (
            <div className="flex items-center gap-1.5 text-sky-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              <span>Active Position</span>
            </div>
          )}
          {displayTrades.length > 0 && onClearTrades && (
            <button
              type="button"
              id="clear-trade-history-btn"
              onClick={onClearTrades}
              className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300 transition-colors ml-2 px-2 py-1 rounded bg-[#0a0f1d] border border-[#1f2937]"
              title="Clear stored local trade history"
            >
              <Trash2 className="w-3 h-3" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Table Container with horizontal overflow protection */}
      <div className="overflow-x-auto mt-4">
        <table id="recent-trades-table" className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#1f2937] text-slate-400 uppercase tracking-wider font-semibold text-[10px]">
              <th className="py-2.5 px-3 font-semibold">Symbol</th>
              <th className="py-2.5 px-3 font-semibold">Type</th>
              <th className="py-2.5 px-3 font-semibold">Lot Size</th>
              <th className="py-2.5 px-3 font-semibold">Entry Price</th>
              <th className="py-2.5 px-3 font-semibold">Exit Price</th>
              <th className="py-2.5 px-3 font-semibold text-right">Net P&L</th>
              <th className="py-2.5 px-3 font-semibold text-center">Outcome</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1f2937]/60">
            {/* If there is an active running trade, display it at the very top with pulsating blue indicator */}
            {activeTrade && (
              <tr
                id={`trade-row-active-${activeTrade.id}`}
                className="bg-sky-950/40 hover:bg-sky-950/60 transition-colors border-l-4 border-sky-400 animate-pulse"
              >
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-400"></span>
                    </span>
                    <span className="font-bold font-mono text-white text-sm">{activeTrade.symbol}</span>
                  </div>
                </td>
                <td className="py-3 px-3">
                  <span
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-bold uppercase text-[11px] ${
                      activeTrade.type === 'BUY'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                        : 'bg-red-950 text-red-300 border border-red-800/60'
                    }`}
                  >
                    {activeTrade.type === 'BUY' ? (
                      <ArrowUpRight className="w-3 h-3" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3" />
                    )}
                    {activeTrade.type}
                  </span>
                </td>
                <td className="py-3 px-3 font-mono text-slate-300 font-semibold">
                  {activeTrade.lotSize.toFixed(2)}
                </td>
                <td className="py-3 px-3 font-mono text-slate-200">
                  {activeTrade.entryPrice.toFixed(
                    activeTrade.symbol === 'XAUUSD' || activeTrade.symbol === 'BTCUSD' ? 2 : 5
                  )}
                </td>
                <td className="py-3 px-3 font-mono text-sky-300 italic">Floating...</td>
                <td className="py-3 px-3 font-mono font-bold text-right text-sm">
                  <span
                    className={
                      activeTrade.netPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }
                  >
                    {activeTrade.netPnl >= 0 ? '+' : ''}${activeTrade.netPnl.toFixed(2)}
                  </span>
                </td>
                <td className="py-3 px-3 text-center">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-sky-900/60 text-sky-200 border border-sky-600/60">
                    <Radio className="w-3 h-3 animate-spin" />
                    RUNNING
                  </span>
                </td>
              </tr>
            )}

            {/* Completed Trade Rows */}
            {displayTrades.map((trade) => {
              const isWin = trade.outcome === 'WIN';
              const digits =
                trade.symbol === 'XAUUSD' || trade.symbol === 'BTCUSD' || trade.symbol.includes('30')
                  ? 2
                  : 5;

              return (
                <tr
                  key={trade.id}
                  id={`trade-row-${trade.id}`}
                  className={`transition-colors hover:bg-[#161f36] ${
                    isWin
                      ? 'bg-emerald-950/20 hover:bg-emerald-950/30'
                      : 'bg-red-950/20 hover:bg-red-950/30'
                  }`}
                >
                  {/* Symbol */}
                  <td className="py-3 px-3">
                    <div className="flex flex-col">
                      <span className="font-bold font-mono text-white text-sm">{trade.symbol}</span>
                      <span className="text-[10px] text-slate-400">{trade.timestamp}</span>
                    </div>
                  </td>

                  {/* Type */}
                  <td className="py-3 px-3">
                    <span
                      className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-bold uppercase text-[11px] ${
                        trade.type === 'BUY'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                          : 'bg-red-950 text-red-300 border border-red-800/60'
                      }`}
                    >
                      {trade.type === 'BUY' ? (
                        <ArrowUpRight className="w-3 h-3" />
                      ) : (
                        <ArrowDownRight className="w-3 h-3" />
                      )}
                      {trade.type}
                    </span>
                  </td>

                  {/* Lot Size */}
                  <td className="py-3 px-3 font-mono text-slate-300">{trade.lotSize.toFixed(2)}</td>

                  {/* Entry Price */}
                  <td className="py-3 px-3 font-mono text-slate-200">
                    {trade.entryPrice.toFixed(digits)}
                  </td>

                  {/* Exit Price */}
                  <td className="py-3 px-3 font-mono text-slate-200">
                    {trade.exitPrice ? trade.exitPrice.toFixed(digits) : '—'}
                  </td>

                  {/* Net P&L (Strict solid green / solid red rule) */}
                  <td className="py-3 px-3 text-right">
                    <div
                      className={`inline-block font-mono font-bold text-sm px-2.5 py-1 rounded border ${
                        isWin
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-700/60'
                          : 'bg-red-950 text-red-400 border-red-700/60'
                      }`}
                    >
                      {isWin ? '+' : ''}${trade.netPnl.toFixed(2)}
                    </div>
                    {trade.pips !== undefined && (
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {trade.pips >= 0 ? '+' : ''}{trade.pips.toFixed(1)} pips
                      </div>
                    )}
                  </td>

                  {/* Outcome Badge (Strict solid green / red background and text) */}
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        isWin
                          ? 'bg-emerald-950 text-emerald-400 border-emerald-700/60 shadow-xs shadow-emerald-950'
                          : 'bg-red-950 text-red-400 border-red-700/60 shadow-xs shadow-red-950'
                      }`}
                    >
                      {isWin ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <XCircle className="w-3 h-3 text-red-400" />
                      )}
                      {trade.outcome}
                    </span>
                  </td>
                </tr>
              );
            })}

            {displayTrades.length === 0 && !activeTrade && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-slate-400">
                  <FileText className="w-7 h-7 mx-auto mb-2.5 text-slate-600" />
                  <p className="text-sm font-medium text-slate-300">No executed trades logged yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                    Real executions and closed orders from your MetaTrader 5 bridge will be automatically recorded here.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
