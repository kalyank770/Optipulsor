import React from 'react';
import { 
  RefreshCw
} from 'lucide-react';
import { TickerConfig } from '../types/options';
import { POPULAR_TICKERS } from '../data/marketTickers';
import { MarketHoursStatus } from '../utils/marketHours';

interface HeaderProps {
  selectedTicker: TickerConfig;
  onSelectTicker: (t: TickerConfig) => void;
  onGoHome?: () => void;
  isLiveActive: boolean;
  onToggleLive: () => void;
  updateIntervalMs: number;
  onChangeInterval: (ms: number) => void;
  onForceRefresh: () => void;
  lastUpdated: Date;
  unreadNewsCount?: number;
  isSyncing?: boolean;
  onSyncLiveExchange?: () => void;
  syncStatusMsg?: string;
  marketStatus?: MarketHoursStatus;
}

export const Header: React.FC<HeaderProps> = ({
  selectedTicker,
  onSelectTicker,
  onGoHome,
  unreadNewsCount = 0,
  isSyncing = false,
  onSyncLiveExchange,
  marketStatus,
}) => {
  const isPositive = selectedTicker.change >= 0;

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-sm">
      {/* Top Bar: Wordmark, Live Exchange Refresh */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-13 sm:h-14 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            onClick={onGoHome}
            className="text-base sm:text-lg font-bold tracking-tight text-white hover:text-emerald-400 transition-colors flex items-center gap-2 cursor-pointer"
            title="OptiPulse - Scroll to Top"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>OptiPulse</span>
          </button>
          <span className="hidden sm:inline-block text-xs font-mono text-slate-500 border-l border-slate-800 pl-2.5">
            NSE Live Derivatives
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {marketStatus && (
            <div 
              title={marketStatus.isOpen 
                ? `${marketStatus.marketName} regular trading is active (${marketStatus.tradingHoursLabel}). Auto-refresh is polling.` 
                : `${marketStatus.marketName} is currently closed (${marketStatus.tradingHoursLabel}). Auto-refresh is paused outside market hours. ${marketStatus.nextOpenMsg}.`
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-mono border transition-colors ${
                marketStatus.isOpen
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-slate-900/90 text-slate-400 border-slate-800'
              }`}
            >
              <span className="relative flex h-2 w-2">
                {marketStatus.isOpen ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </>
                ) : (
                  <span className="inline-flex rounded-full h-2 w-2 bg-amber-500/80"></span>
                )}
              </span>
              <span className="hidden sm:inline font-semibold">
                {marketStatus.isOpen ? 'Market Open' : 'Market Closed'}
              </span>
              <span className="hidden lg:inline text-[10px] text-slate-500">
                ({marketStatus.isOpen ? 'Auto-Refresh Active' : 'Refresh Paused'})
              </span>
            </div>
          )}

          {onSyncLiveExchange && (
            <button
              onClick={onSyncLiveExchange}
              disabled={isSyncing}
              title={marketStatus?.isOpen ? "Manual quote refresh from Exchange" : `Market is closed (${marketStatus?.nextOpenMsg || 'Auto-refresh paused'}). Click to fetch latest settled quote.`}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 min-h-[36px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">{isSyncing ? 'Syncing...' : 'Live Sync'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Dedicated NIFTY 50 Benchmark Index Strip */}
      <div className="border-t border-slate-800/80 bg-slate-900/60 px-3 sm:px-6 py-1.5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-1.5 text-xs font-bold rounded-md bg-emerald-500 text-slate-950 flex items-center gap-1.5 shadow-sm">
              <span>NIFTY 50</span>
              <span className="text-[9.5px] px-1 py-0.5 rounded bg-slate-900/20 text-slate-950 font-mono font-bold">
                NSE INDEX
              </span>
            </div>
            <span className="hidden sm:inline-block text-xs font-medium text-slate-400">
              National Stock Exchange · Live F&O Derivatives
            </span>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 text-xs font-mono text-slate-400 shrink-0">
            <span>ATM: <strong className="text-emerald-400">{selectedTicker.atmStrike}</strong></span>
            <span className="text-slate-700">·</span>
            <span className="text-slate-400">VIX: <strong className="text-amber-300">{selectedTicker.vix.toFixed(2)}</strong></span>
          </div>
        </div>
      </div>

      {/* Live Spot Price Header Bar */}
      <div className="border-t border-slate-800/80 bg-slate-950 px-3 sm:px-6 py-1.5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 text-xs font-mono">
          {/* Left: Symbol & Live Spot */}
          <div className="flex items-center gap-2.5">
            <span className="font-bold text-white text-xs sm:text-sm">{selectedTicker.symbol}</span>
            <span className="text-slate-600">·</span>
            <span className="text-base sm:text-lg font-bold text-white tracking-tight">
              {selectedTicker.currency}{selectedTicker.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`font-bold text-xs ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? '+' : ''}{selectedTicker.change.toFixed(2)} ({isPositive ? '+' : ''}{selectedTicker.changePercent.toFixed(2)}%)
            </span>
            {selectedTicker.dayHigh > 0 && selectedTicker.dayLow > 0 && (
              <span className="hidden sm:inline-flex items-center gap-2 text-slate-400 text-[11px]">
                <span className="text-slate-600">·</span>
                <span>H: <strong className="text-slate-200">{selectedTicker.currency}{selectedTicker.dayHigh.toFixed(2)}</strong></span>
                <span>L: <strong className="text-slate-200">{selectedTicker.currency}{selectedTicker.dayLow.toFixed(2)}</strong></span>
              </span>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
