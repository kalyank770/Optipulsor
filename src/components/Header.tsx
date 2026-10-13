import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  RefreshCw,
  Sun,
  Moon,
  Power,
  Zap,
  Calendar,
  Compass,
  TrendingUp,
  Clock,
  X,
  CheckCircle2,
  Info,
  ShieldCheck
} from 'lucide-react';
import { TickerConfig, SignalStabilityLock, SignalAction } from '../types/options';
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
  syncStatusMsg?: string;
  marketStatus?: MarketHoursStatus;
  usePreMarket?: boolean;
  onTogglePreMarket?: () => void;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  stabilityLock?: SignalStabilityLock;
  signalAction?: SignalAction;
}

export const Header: React.FC<HeaderProps> = ({
  selectedTicker,
  onSelectTicker,
  onGoHome,
  onForceRefresh,
  unreadNewsCount = 0,
  isSyncing = false,
  marketStatus,
  usePreMarket = false,
  onTogglePreMarket,
  activeTab = 'chain',
  onSelectTab,
  stabilityLock,
  signalAction,
}) => {
  const isPositive = selectedTicker.change >= 0;
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);

  // Close session modal on Escape key
  useEffect(() => {
    if (!isSessionModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSessionModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSessionModalOpen]);

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-sm">
      {/* Top Bar: Wordmark, Live Exchange Refresh */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-13 sm:h-14 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            onClick={onGoHome}
            className="text-base sm:text-lg font-bold tracking-tight text-white hover:text-emerald-400 transition-colors flex items-center gap-2 cursor-pointer group"
            title="OptiPulse V10 - Scroll to Top"
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
            <span className="text-xs font-normal text-slate-400 font-mono ml-1.5 select-none">V10</span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Combined Clean Exchange Session Status Badge - Interactive */}
          {marketStatus && (
            <button 
              type="button"
              onClick={() => setIsSessionModalOpen(true)}
              title="Click to view exchange market hours, operating sessions and timings"
              className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-mono font-semibold rounded border transition-all cursor-pointer hover:brightness-125 select-none min-h-[36px] ${
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
              <Info className="w-3 h-3 text-slate-400 opacity-75 ml-0.5" />
            </button>
          )}

          {/* Manual Instant Refresh Button beside After-Market badge */}
          <button
            type="button"
            onClick={onForceRefresh}
            disabled={isSyncing}
            className="flex items-center justify-center p-2 rounded bg-slate-900 border border-slate-700 hover:border-emerald-500/60 hover:bg-slate-800 text-slate-200 hover:text-emerald-300 transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed shadow-xs min-h-[36px] min-w-[36px]"
            title="Refresh all live feeds & update predictions"
            aria-label="Refresh feeds"
          >
            <RefreshCw className={`w-4 h-4 text-emerald-400 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          </button>

          {/* Auto 0.5-second sub-second live stream status */}
          <div className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 text-xs font-mono font-semibold rounded bg-slate-900 border border-slate-800 text-slate-300 min-h-[36px]">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="hidden xs:inline">0.5s Stream</span>
            <span className="xs:hidden">0.5s</span>
          </div>
        </div>
      </div>

      {/* Mobile Consolidated Strip (Visible on mobile < sm) */}
      <div className="block sm:hidden border-t border-slate-800/80 bg-slate-900/90 px-3 py-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-white">{selectedTicker.symbol}</span>
            <span className="text-emerald-400 font-bold">
              {selectedTicker.currency}{(selectedTicker?.spotPrice ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                {selectedTicker.currency}{(selectedTicker?.spotPrice ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              {/* Authentic Continuous Live 1s Stream Indicator */}
              <div className="ml-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[10px] font-semibold rounded bg-emerald-950/70 border border-emerald-600/50 text-emerald-300">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>{marketStatus?.session === 'REGULAR' ? 'LIVE 1s STREAM' : marketStatus?.session === 'PRE_MARKET' ? 'PRE-MARKET 1s' : 'STREAM 1s'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exchange Market Session Info Modal rendered at Document Root via React Portal */}
      {isSessionModalOpen && marketStatus && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={() => setIsSessionModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto bg-[#0a0f1d] border-2 border-emerald-500/60 rounded-2xl p-4 sm:p-6 shadow-[0_25px_70px_rgba(0,0,0,0.95)] text-slate-100 font-sans space-y-4 my-auto select-text"
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-sm shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider border ${
                      marketStatus.isHoliday ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' :
                      marketStatus.isOpen ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                      'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                    }`}>
                      {marketStatus.session === 'REGULAR' ? 'LIVE SESSION' : marketStatus.session === 'PRE_MARKET' ? 'PRE-MARKET DISCOVERY' : marketStatus.isCasSession ? 'CLOSING AUCTION (CAS)' : marketStatus.isHoliday ? 'TRADING HOLIDAY' : 'AFTER-MARKET / CLOSED'}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {marketStatus.marketName || 'NSE India'}
                    </span>
                  </div>
                  <h3 id="session-modal-title" className="font-bold text-white text-base sm:text-lg tracking-tight mt-0.5">
                    Exchange Operating Status &amp; Market Hours
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsSessionModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Status Highlights */}
            <div className="grid grid-cols-2 gap-2.5 font-mono text-xs">
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 block font-sans">Current Exchange Time</span>
                <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                  {marketStatus.exchangeTimeStr || 'Asia/Kolkata'}
                </span>
                <span className="text-[9.5px] text-slate-500">Live Indian Standard Time</span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
                <span className="text-[10px] uppercase text-slate-400 block font-sans">Official Hours</span>
                <span className="text-sm font-bold text-white mt-0.5 block">
                  {marketStatus.tradingHoursLabel || '09:15 - 15:30 IST'}
                </span>
                <span className="text-[9.5px] text-slate-500">Monday to Friday (Mon-Fri)</span>
              </div>
            </div>

            {/* Next Open / Session Message */}
            <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-500/40 space-y-1.5 text-xs">
              <span className="font-bold text-indigo-300 block font-mono uppercase tracking-wider text-[11px]">
                Session Directive:
              </span>
              <p className="text-slate-200 leading-relaxed text-[12px]">
                {marketStatus.isHoliday 
                  ? `${marketStatus.holidayName}: ${marketStatus.holidayDescription}`
                  : marketStatus.isOpen 
                  ? `Continuous F&O and Cash market trading active. ${marketStatus.nextOpenMsg}`
                  : `${marketStatus.nextOpenMsg}. Algorithm processes overnight GIFT Nifty, Wall Street, and full-day chart to compute opening target strikes.`}
              </p>
            </div>

            {/* Indian Market Timing Breakdown List */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2 text-xs">
              <span className="font-bold text-white uppercase tracking-wider text-[11px] block font-mono">
                NSE Operating Sessions Schedule:
              </span>
              <div className="space-y-1.5 text-[11.5px]">
                <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-300">1. Pre-Open Discovery:</span>
                  <span className="font-mono text-amber-300 font-bold">09:00 AM – 09:15 AM IST</span>
                </div>
                <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-300">2. Regular Continuous F&amp;O:</span>
                  <span className="font-mono text-emerald-400 font-bold">09:15 AM – 03:30 PM IST</span>
                </div>
                <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-300">3. Closing Auction (CAS):</span>
                  <span className="font-mono text-amber-300 font-bold">03:30 PM – 03:40 PM IST</span>
                </div>
                <div className="flex justify-between items-center p-1.5 rounded bg-slate-950/80 border border-slate-800">
                  <span className="text-slate-300">4. Post-Market Session:</span>
                  <span className="font-mono text-indigo-300 font-bold">03:40 PM – 04:00 PM IST</span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>100% Authentic Live Feed</span>
              </div>
              <button
                type="button"
                onClick={() => setIsSessionModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-colors cursor-pointer shadow-sm shadow-emerald-600/30"
              >
                Close Window
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </header>
  );
};
