import React, { useState } from 'react';
import { 
  Volume2, 
  VolumeX, 
  RefreshCw, 
  Edit3, 
  Check, 
  X,
  TrendingUp,
  Layers
} from 'lucide-react';
import { TickerConfig } from '../types/options';
import { POPULAR_TICKERS } from '../data/marketTickers';

interface HeaderProps {
  selectedTicker: TickerConfig;
  onSelectTicker: (t: TickerConfig) => void;
  activeView: 'chain' | 'signals' | 'oi_map' | 'news' | 'strategy';
  setActiveView: (view: 'chain' | 'signals' | 'oi_map' | 'news' | 'strategy') => void;
  isLiveActive: boolean;
  onToggleLive: () => void;
  updateIntervalMs: number;
  onChangeInterval: (ms: number) => void;
  onForceRefresh: () => void;
  lastUpdated: Date;
  soundEnabled: boolean;
  onToggleSound: () => void;
  unreadNewsCount?: number;
  isSyncing?: boolean;
  onSyncLiveExchange?: () => void;
  onSetManualSpotPrice?: (price: number) => void;
  syncStatusMsg?: string;
}

export const Header: React.FC<HeaderProps> = ({
  selectedTicker,
  onSelectTicker,
  activeView,
  setActiveView,
  soundEnabled,
  onToggleSound,
  isSyncing = false,
  onSyncLiveExchange,
  onSetManualSpotPrice,
}) => {
  const isPositive = selectedTicker.change >= 0;
  const [isEditingSpot, setIsEditingSpot] = useState(false);
  const [customSpotInput, setCustomSpotInput] = useState(selectedTicker.spotPrice.toString());

  const handleApplyCustomSpot = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(customSpotInput);
    if (!isNaN(val) && val > 0 && onSetManualSpotPrice) {
      onSetManualSpotPrice(val);
      setIsEditingSpot(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 shadow-sm">
      {/* Top Bar: Wordmark, Desktop Nav, Quick Actions */}
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 h-13 sm:h-14 flex items-center justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button 
            onClick={() => setActiveView('chain')}
            className="text-base sm:text-lg font-bold tracking-tight text-white hover:text-emerald-400 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>OptiPulse</span>
          </button>
          <span className="hidden sm:inline-block text-[11px] font-semibold text-slate-500 border-l border-slate-800 pl-2.5">
            NSE Live Derivatives
          </span>
        </div>

        {/* Desktop Navigation Tabs (Hidden on mobile, mobile uses bottom nav bar) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveView('chain')}
            className={`transition-colors cursor-pointer py-1 border-b-2 text-xs lg:text-sm ${
              activeView === 'chain'
                ? 'text-emerald-400 border-emerald-400 font-semibold'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Option Chain
          </button>

          <button
            onClick={() => setActiveView('signals')}
            className={`transition-colors cursor-pointer py-1 border-b-2 text-xs lg:text-sm ${
              activeView === 'signals'
                ? 'text-emerald-400 border-emerald-400 font-semibold'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            CE / PE Signal
          </button>

          <button
            onClick={() => setActiveView('oi_map')}
            className={`transition-colors cursor-pointer py-1 border-b-2 text-xs lg:text-sm ${
              activeView === 'oi_map'
                ? 'text-emerald-400 border-emerald-400 font-semibold'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            OI Walls
          </button>

          <button
            onClick={() => setActiveView('strategy')}
            className={`transition-colors cursor-pointer py-1 border-b-2 text-xs lg:text-sm ${
              activeView === 'strategy'
                ? 'text-emerald-400 border-emerald-400 font-semibold'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            Payoff Simulator
          </button>

          <button
            onClick={() => setActiveView('news')}
            className={`transition-colors cursor-pointer py-1 border-b-2 text-xs lg:text-sm ${
              activeView === 'news'
                ? 'text-emerald-400 border-emerald-400 font-semibold'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            News Wire
          </button>
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onSyncLiveExchange && (
            <button
              onClick={onSyncLiveExchange}
              disabled={isSyncing}
              title="Refresh live quotes from Exchange"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded bg-slate-900 border border-slate-700 text-slate-200 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-50 min-h-[36px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden xs:inline">{isSyncing ? 'Syncing...' : 'Sync'}</span>
            </button>
          )}

          <button
            onClick={onToggleSound}
            title={soundEnabled ? 'Mute signal audio' : 'Enable signal audio'}
            className="p-2 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Symbol Horizontal Strip */}
      <div className="border-t border-slate-800/80 bg-slate-900/60 px-3 sm:px-6 py-1.5">
        <div className="max-w-[1600px] mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
          {POPULAR_TICKERS.map(t => {
            const active = t.symbol === selectedTicker.symbol;
            return (
              <button
                key={t.symbol}
                onClick={() => {
                  setIsEditingSpot(false);
                  onSelectTicker(t);
                  setCustomSpotInput(t.spotPrice.toString());
                }}
                className={`px-3 py-1.5 text-xs font-bold rounded-md whitespace-nowrap transition-colors cursor-pointer min-h-[36px] flex items-center ${
                  active
                    ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                    : 'bg-slate-950/80 text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-800'
                }`}
              >
                {t.symbol}
              </button>
            );
          })}
        </div>
      </div>

      {/* Spot Price & Lot Size Header Bar (Clean, single-row on mobile) */}
      <div className="border-t border-slate-800/80 bg-slate-950 px-3 sm:px-6 py-1.5">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-2 text-xs font-mono">
          {/* Left: Symbol & Live Spot */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-400 hidden xs:inline">{selectedTicker.symbol}:</span>

            {isEditingSpot ? (
              <form onSubmit={handleApplyCustomSpot} className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.05"
                  value={customSpotInput}
                  onChange={e => setCustomSpotInput(e.target.value)}
                  className="w-24 px-1.5 py-0.5 bg-slate-900 border border-emerald-500 text-white text-xs rounded focus:outline-none font-bold"
                  autoFocus
                />
                <button type="submit" className="p-1 rounded bg-emerald-600 text-white cursor-pointer" title="Apply">
                  <Check className="w-3 h-3" />
                </button>
                <button type="button" onClick={() => setIsEditingSpot(false)} className="p-1 rounded bg-slate-800 text-slate-400 cursor-pointer" title="Cancel">
                  <X className="w-3 h-3" />
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {selectedTicker.currency}{selectedTicker.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <button
                  onClick={() => {
                    setCustomSpotInput(selectedTicker.spotPrice.toString());
                    setIsEditingSpot(true);
                  }}
                  title="Override spot price"
                  className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 cursor-pointer"
                >
                  <Edit3 className="w-3 h-3" />
                </button>
              </div>
            )}

            <span className={`font-bold text-xs ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? '+' : ''}{selectedTicker.change.toFixed(2)} ({isPositive ? '+' : ''}{selectedTicker.changePercent.toFixed(2)}%)
            </span>
          </div>

          {/* Right: Lot size badge */}
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-900 text-slate-300 border border-slate-800">
              Lot: {selectedTicker.lotSize}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
