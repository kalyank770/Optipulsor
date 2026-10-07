import React from 'react';
import { 
  RefreshCw,
  Sun,
  Moon,
  Power,
  Zap,
  Calendar,
  Compass,
  TrendingUp
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
  usePreMarket?: boolean;
  onTogglePreMarket?: () => void;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  selectedTicker,
  onSelectTicker,
  onGoHome,
  unreadNewsCount = 0,
  isSyncing = false,
  onSyncLiveExchange,
  marketStatus,
  usePreMarket = false,
  onTogglePreMarket,
  activeTab = 'chain',
  onSelectTab,
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
            className="text-base sm:text-lg font-bold tracking-tight text-white hover:text-emerald-400 transition-colors flex items-center gap-2 cursor-pointer group"
            title="OptiPulse V3.0 - Scroll to Top"
          >
            {/* Custom Scalable Professional SVG Logo (Options Payoff & Trading Candlesticks) */}
            <svg 
              className="w-6 h-6 transition-transform duration-300 group-hover:scale-110 shrink-0" 
              viewBox="0 0 32 32" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="optipulse-trading-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#10B981" /> {/* emerald-500 */}
                  <stop offset="100%" stopColor="#3B82F6" /> {/* blue-500 */}
                </linearGradient>
                <linearGradient id="strike-node-glow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#34D399" />
                  <stop offset="100%" stopColor="#60A5FA" />
                </linearGradient>
              </defs>

              {/* Background Trading Grid Lines (Subtle) */}
              <line x1="4" y1="10" x2="28" y2="10" className="stroke-slate-800" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="4" y1="16" x2="28" y2="16" className="stroke-slate-800" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="4" y1="22" x2="28" y2="22" className="stroke-slate-800" strokeWidth="1" strokeDasharray="2 2" />

              {/* Background Candlestick 1 (Bearish/Correction - Slate) */}
              <line x1="10" y1="12" x2="10" y2="24" className="stroke-slate-500" strokeWidth="1.2" strokeLinecap="round" />
              <rect x="8.5" y="15" width="3" height="6" rx="0.5" className="fill-slate-800 stroke-slate-500" strokeWidth="1" />

              {/* Background Candlestick 2 (Bullish - Green) */}
              <line x1="22" y1="6" x2="22" y2="18" stroke="#059669" strokeWidth="1.2" strokeLinecap="round" />
              <rect x="20.5" y="8" width="3" height="7" rx="0.5" fill="#064E3B" stroke="#059669" strokeWidth="1" />

              {/* Option Payoff Curve / Breakout Trend Line */}
              {/* This mimics an Option Call Payoff chart (flat premium line, then sharp upward trend breakout) */}
              <path 
                d="M5 22H14L25 7" 
                stroke="url(#optipulse-trading-grad)" 
                strokeWidth="3.2" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                className="drop-shadow-[0_0_6px_rgba(16,185,129,0.55)]"
              />

              {/* Volatility Target / Strike Price Inflection Node */}
              <circle 
                cx="14" 
                cy="22" 
                r="3.5" 
                fill="url(#strike-node-glow)" 
                className="stroke-slate-900 drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]" 
                strokeWidth="1.5"
              />

              {/* Breakout Arrow Pointer */}
              <path 
                d="M21 7H25V11" 
                stroke="url(#optipulse-trading-grad)" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            </svg>

            <span>OptiPulse</span>
            <span className="text-xs font-normal text-slate-400 font-mono ml-1.5 select-none">V5.0</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Combined Clean Exchange Session Status Badge */}
          {marketStatus && (
            <div 
              title={marketStatus.isHoliday
                ? `${marketStatus.marketName} is CLOSED today for ${marketStatus.holidayName}. ${marketStatus.nextOpenMsg}`
                : marketStatus.isOpen 
                ? `${marketStatus.marketName} regular trading is active (${marketStatus.tradingHoursLabel}).` 
                : `${marketStatus.marketName} is currently closed. ${marketStatus.nextOpenMsg}.`
              }
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-mono font-semibold rounded border transition-colors ${
                marketStatus.isHoliday
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 shadow-sm'
                  : marketStatus.isCasSession
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : marketStatus.isOpen
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
              }`}
            >
              {marketStatus.isHoliday ? (
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
              ) : marketStatus.isCasSession ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
              ) : marketStatus.isOpen ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              )}
              <span>
                {marketStatus.isHoliday 
                  ? 'Holiday' 
                  : marketStatus.isCasSession
                  ? 'CAS'
                  : marketStatus.isOpen 
                  ? 'Live' 
                  : marketStatus.session === 'PRE_MARKET' 
                  ? 'Pre-Market' 
                  : 'After-Market'}
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
              <span className="hidden xs:inline">{isSyncing ? 'Syncing...' : marketStatus?.isOpen ? 'Live Sync' : 'Exchange Sync'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile Consolidated Strip (Visible on mobile < sm) */}
      <div className="block sm:hidden border-t border-slate-800/80 bg-slate-900/90 px-3 py-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-white">{selectedTicker.symbol}</span>
            <span className="text-emerald-400 font-bold">
              {selectedTicker.currency}{selectedTicker.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            <span className={`font-bold text-[11px] ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              ({isPositive ? '+' : ''}{selectedTicker.changePercent.toFixed(2)}%)
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 shrink-0">
            <span>ATM: <strong className="text-emerald-400">{selectedTicker.atmStrike}</strong></span>
            <span className="text-slate-700">·</span>
            <span>VIX: <strong className="text-amber-300">{selectedTicker.vix.toFixed(2)}</strong></span>
          </div>
        </div>
      </div>

      {/* Desktop Multi-Tier Header Strips (Visible on sm: and up) */}
      <div className="hidden sm:block">
        {/* Dedicated NIFTY 50 Benchmark Index Strip */}
        <div className="border-t border-slate-800/80 bg-slate-900/60 px-6 py-1.5">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-2 shrink-0">
              <div className="px-3 py-1.5 text-xs font-bold rounded-md bg-emerald-500 text-[#020617] flex items-center gap-1.5 shadow-sm">
                <span>{selectedTicker.symbol === 'NIFTY 50' ? 'NIFTY 50' : selectedTicker.symbol}</span>
                <span className="text-[9.5px] px-1 py-0.5 rounded bg-slate-900/20 text-[#020617] font-mono font-bold">
                  NSE {selectedTicker.category ? selectedTicker.category.toUpperCase() : 'INDEX'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 sm:gap-3 text-xs font-mono text-slate-400 shrink-0">
              <span>ATM: <strong className="text-emerald-400">{selectedTicker.atmStrike}</strong></span>
              <span className="text-slate-700">·</span>
              <span className="text-slate-400">VIX: <strong className="text-amber-300">{selectedTicker.vix.toFixed(2)}</strong></span>
            </div>
          </div>
        </div>

        {/* Live Spot Price Header Bar */}
        <div className="border-t border-slate-800/80 bg-slate-950 px-6 py-1.5">
          <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 text-xs font-mono">
            {/* Left: Symbol & Live Spot */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="font-bold text-white text-xs sm:text-sm">{selectedTicker.symbol}</span>
              <span className="text-slate-600">·</span>
              <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                {selectedTicker.currency}{selectedTicker.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className={`font-bold text-xs ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? '+' : ''}{selectedTicker.change.toFixed(2)} ({isPositive ? '+' : ''}{selectedTicker.changePercent.toFixed(2)}%)
              </span>
              {selectedTicker.dayHigh > 0 && selectedTicker.dayLow > 0 && (
                <span className="inline-flex items-center gap-2 text-slate-400 text-[11px]">
                  <span className="text-slate-600">·</span>
                  <span>H: <strong className="text-slate-200">{selectedTicker.currency}{selectedTicker.dayHigh.toFixed(2)}</strong></span>
                  <span>L: <strong className="text-slate-200">{selectedTicker.currency}{selectedTicker.dayLow.toFixed(2)}</strong></span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
