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
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  setFilters,
  ticker,
  expiryIndex,
  onSelectExpiry,
  filteredCount,
  totalCount,
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

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
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 sm:p-3.5 mb-3 sm:mb-4">
      {/* 1. Expiry Date Horizontal Scroll Carousel (Clean on both mobile & desktop) */}
      <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800/80">
        <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-xs text-slate-400 font-semibold shrink-0">Expiry:</span>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth flex-1 py-0.5">
          {ticker.expiryDates.map((exp, idx) => {
            const active = idx === expiryIndex;
            return (
              <button
                key={exp}
                onClick={() => onSelectExpiry(idx)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors cursor-pointer min-h-[32px] shrink-0 ${
                  active
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 font-bold shadow-sm'
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
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            {(['ATM_5', 'ATM_10', 'ATM_15', 'ALL'] as const).map(range => (
              <button
                key={range}
                onClick={() => setFilters(prev => ({ ...prev, strikeRange: range }))}
                className={`px-2 py-1 text-xs font-mono rounded whitespace-nowrap transition-colors cursor-pointer min-h-[28px] ${
                  filters.strikeRange === range
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range === 'ATM_5' ? '±5 ATM' :
                 range === 'ATM_10' ? '±10 ATM' :
                 range === 'ATM_15' ? '±15 ATM' : 'All'}
              </button>
            ))}
          </div>

          {/* Moneyness Quick Filter */}
          <div className="flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800">
            {(['ALL', 'ITM', 'ATM', 'OTM'] as const).map(m => (
              <button
                key={m}
                onClick={() => setFilters(prev => ({ ...prev, moneynessFilter: m }))}
                className={`px-2 py-1 text-xs font-semibold rounded whitespace-nowrap transition-colors cursor-pointer min-h-[28px] ${
                  filters.moneynessFilter === m
                    ? 'bg-slate-800 text-white font-bold'
                    : 'text-slate-400 hover:text-slate-200'
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
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search strike..."
              value={filters.searchQuery}
              onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded focus:outline-none focus:border-emerald-500/60 font-mono w-full sm:w-36 min-h-[32px]"
            />
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold border transition-colors cursor-pointer min-h-[32px] ${
              isExpanded || hasActiveCustomFilters
                ? 'bg-slate-800 text-emerald-400 border-emerald-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
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
              className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 3. Collapsible Advanced Tray: IV and Delta ranges */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
            <div className="flex justify-between text-slate-400 font-semibold mb-1">
              <span>Implied Volatility (IV):</span>
              <span className="text-white font-mono">{filters.minIV}% - {filters.maxIV}%</span>
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

          <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
            <div className="flex justify-between text-slate-400 font-semibold mb-1">
              <span>Delta Range (|Δ|):</span>
              <span className="text-white font-mono">{filters.minDelta.toFixed(2)} - {filters.maxDelta.toFixed(2)}</span>
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

          <div className="bg-slate-950 p-2.5 rounded border border-slate-800 flex items-center justify-between font-mono">
            <span className="text-slate-400">Strikes Filtered:</span>
            <span className="text-emerald-400 font-bold text-sm">
              {filteredCount} / {totalCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
