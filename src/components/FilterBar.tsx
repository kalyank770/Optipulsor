import React, { useState } from 'react';
import { 
  OptionFilters, 
  TickerConfig 
} from '../types/options';
import { 
  SlidersHorizontal, 
  RotateCcw, 
  Search, 
  Calendar, 
  ChevronDown, 
  ChevronUp 
} from 'lucide-react';

interface FilterBarProps {
  filters: OptionFilters;
  setFilters: React.Dispatch<React.SetStateAction<OptionFilters>>;
  ticker: TickerConfig;
  expiryIndex: number;
  onSelectExpiry: (index: number) => void;
  filteredCount: number;
  totalCount: number;
  theme?: 'dark' | 'light';
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  setFilters,
  ticker,
  expiryIndex,
  onSelectExpiry,
  filteredCount,
  totalCount,
  theme = 'dark',
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const isLight = theme === 'light';

  const resetFilters = () => {
    setFilters({
      expiryDate: ticker.expiryDates[0],
      strikeRange: 'ATM_10',
      moneynessFilter: 'ALL',
      minIV: 5,
      maxIV: 80,
      minDelta: 0.05,
      maxDelta: 0.95,
      minOpenInterest: 0,
      searchQuery: '',
    });
  };

  const hasActiveCustomFilters = 
    filters.strikeRange !== 'ATM_10' ||
    filters.moneynessFilter !== 'ALL' ||
    filters.minIV > 5 ||
    filters.maxIV < 80 ||
    filters.minOpenInterest > 0 ||
    filters.searchQuery !== '';

  return (
    <div className={`rounded-lg p-2.5 sm:p-3.5 mb-3 sm:mb-4 border ${
      isLight ? 'bg-white border-slate-200 text-slate-900 shadow-sm' : 'bg-slate-900/90 border-slate-800 text-slate-100'
    }`}>
      {/* 1. Expiry Date Horizontal Scroll Carousel (Clean on both mobile & desktop) */}
      <div className={`flex items-center gap-2 pb-2.5 border-b ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
        <Calendar className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />
        <span className={`text-xs font-semibold shrink-0 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>Expiry:</span>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 py-0.5">
          {ticker.expiryDates.map((exp, idx) => {
            const active = idx === expiryIndex;
            return (
              <button
                key={exp}
                onClick={() => onSelectExpiry(idx)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors cursor-pointer min-h-[32px] shrink-0 ${
                  active
                    ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/50 font-bold shadow-sm'
                    : isLight 
                      ? 'bg-slate-100 text-slate-700 hover:text-slate-900 border border-slate-300' 
                      : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {exp}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Secondary Row: Strike Range, Moneyness, Search & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Strike Range Selector */}
          <div className={`flex items-center gap-1 p-0.5 rounded border ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-950 border-slate-800'}`}>
            {(['ATM_5', 'ATM_10', 'ATM_15', 'ALL'] as const).map(range => (
              <button
                key={range}
                onClick={() => setFilters(prev => ({ ...prev, strikeRange: range }))}
                className={`px-2 py-1 text-xs font-mono rounded whitespace-nowrap transition-colors cursor-pointer min-h-[28px] ${
                  filters.strikeRange === range
                    ? isLight ? 'bg-white text-slate-900 font-bold shadow-xs' : 'bg-slate-800 text-white font-bold'
                    : isLight ? 'text-slate-700 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range === 'ATM_5' ? '±5 ATM' :
                 range === 'ATM_10' ? '±10 ATM' :
                 range === 'ATM_15' ? '±15 ATM' : 'All'}
              </button>
            ))}
          </div>

          {/* Moneyness Quick Filter */}
          <div className={`flex items-center gap-1 p-0.5 rounded border ${isLight ? 'bg-slate-100 border-slate-300' : 'bg-slate-950 border-slate-800'}`}>
            {(['ALL', 'ITM', 'ATM', 'OTM'] as const).map(m => (
              <button
                key={m}
                onClick={() => setFilters(prev => ({ ...prev, moneynessFilter: m }))}
                className={`px-2 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors cursor-pointer min-h-[28px] ${
                  filters.moneynessFilter === m
                    ? isLight ? 'bg-white text-slate-900 font-bold shadow-xs' : 'bg-slate-800 text-white font-bold'
                    : isLight ? 'text-slate-700 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Expand Tray */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="relative flex-1 sm:flex-initial">
            <Search className={`w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder="Search strike..."
              value={filters.searchQuery}
              onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              className={`text-xs pl-8 pr-3 py-1.5 rounded focus:outline-none focus:border-emerald-500/60 font-mono w-full sm:w-36 min-h-[32px] border ${
                isLight ? 'bg-slate-100 border-slate-300 text-slate-900 placeholder:text-slate-500' : 'bg-slate-950 border-slate-800 text-slate-200'
              }`}
            />
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold border transition-colors cursor-pointer min-h-[32px] ${
              isExpanded || hasActiveCustomFilters
                ? isLight ? 'bg-slate-200 text-emerald-700 border-emerald-500/40' : 'bg-slate-800 text-emerald-400 border-emerald-500/40'
                : isLight ? 'bg-slate-100 text-slate-700 border-slate-300 hover:text-slate-900' : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">Greeks/IV</span>
            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {hasActiveCustomFilters && (
            <button
              onClick={resetFilters}
              title="Reset all filters"
              className={`p-1.5 transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center ${
                isLight ? 'text-slate-600 hover:text-rose-600' : 'text-slate-400 hover:text-rose-400'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Collapsible Advanced Tray: IV and Delta ranges */}
      {isExpanded && (
        <div className={`mt-3 pt-3 border-t grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs ${isLight ? 'border-slate-200' : 'border-slate-800/80'}`}>
          <div className={`p-2.5 rounded border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
            <div className={`flex justify-between font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
              <span>Implied Volatility (IV):</span>
              <span className={`font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{filters.minIV}% - {filters.maxIV}%</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="50"
                value={filters.minIV}
                onChange={e => setFilters(prev => ({ ...prev, minIV: Number(e.target.value) }))}
                className="w-full accent-emerald-500"
              />
              <input
                type="range"
                min="50"
                max="100"
                value={filters.maxIV}
                onChange={e => setFilters(prev => ({ ...prev, maxIV: Number(e.target.value) }))}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>

          <div className={`p-2.5 rounded border ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
            <div className={`flex justify-between font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
              <span>Delta Range (|Δ|):</span>
              <span className={`font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{filters.minDelta.toFixed(2)} - {filters.maxDelta.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="0.5"
                step="0.05"
                value={filters.minDelta}
                onChange={e => setFilters(prev => ({ ...prev, minDelta: Number(e.target.value) }))}
                className="w-full accent-emerald-500"
              />
              <input
                type="range"
                min="0.5"
                max="1"
                step="0.05"
                value={filters.maxDelta}
                onChange={e => setFilters(prev => ({ ...prev, maxDelta: Number(e.target.value) }))}
                className="w-full accent-emerald-500"
              />
            </div>
          </div>

          <div className={`p-2.5 rounded border flex items-center justify-between font-mono ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'}`}>
            <span className={isLight ? 'text-slate-700' : 'text-slate-400'}>Strikes Filtered:</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">
              {filteredCount} / {totalCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
