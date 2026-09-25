import React, { useState } from 'react';
import { 
  OptionFilters, 
  TickerConfig 
} from '../types/options';
import { 
  Filter, 
  SlidersHorizontal, 
  RotateCcw, 
  Search, 
  Calendar, 
  Zap, 
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
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 mb-4">
      {/* Primary Row: Expiry Date, Strike Range Presets, Moneyness, Search & Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Expiry Selector */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs text-slate-400 font-medium">Expiry:</span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 overflow-x-auto max-w-[280px] sm:max-w-md md:max-w-xl lg:max-w-2xl no-scrollbar">
            {ticker.expiryDates.map((exp, idx) => {
              const active = idx === expiryIndex;
              return (
                <button
                  key={exp}
                  onClick={() => onSelectExpiry(idx)}
                  className={`px-2.5 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors cursor-pointer ${
                    active
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                  }`}
                >
                  {exp}
                </button>
              );
            })}
          </div>
        </div>

        {/* Strike Range Preset */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Strikes:</span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
            {(['ATM_5', 'ATM_10', 'ATM_15', 'ALL'] as const).map(range => (
              <button
                key={range}
                onClick={() => setFilters(prev => ({ ...prev, strikeRange: range }))}
                className={`px-2 py-1 text-xs font-mono rounded whitespace-nowrap transition-colors cursor-pointer ${
                  filters.strikeRange === range
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {range === 'ATM_5' ? '±5 ATM' :
                 range === 'ATM_10' ? '±10 ATM' :
                 range === 'ATM_15' ? '±15 ATM' : 'All'}
              </button>
            ))}
          </div>
        </div>

        {/* Moneyness Quick Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Moneyness:</span>
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800">
            {(['ALL', 'ITM', 'ATM', 'OTM'] as const).map(m => (
              <button
                key={m}
                onClick={() => setFilters(prev => ({ ...prev, moneynessFilter: m }))}
                className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap transition-colors cursor-pointer ${
                  filters.moneynessFilter === m
                    ? 'bg-slate-800 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input & Volatility Expand button */}
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search strike..."
              value={filters.searchQuery}
              onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
              className="bg-slate-950 border border-slate-800 text-xs text-slate-200 pl-8 pr-3 py-1.5 rounded focus:outline-none focus:border-emerald-500/60 font-mono w-32 sm:w-40"
            />
          </div>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors cursor-pointer ${
              isExpanded || hasActiveCustomFilters
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Volatility Filters</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {hasActiveCustomFilters && (
            <button
              onClick={resetFilters}
              title="Reset all filters"
              className="p-1.5 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 border border-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Volatility & Precision Tuning Panel */}
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          {/* IV Range Slider */}
          <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
            <div className="flex items-center justify-between text-slate-300 mb-2">
              <span className="font-semibold flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Implied Volatility (IV) Range
              </span>
              <span className="font-mono text-emerald-400 font-bold">
                {filters.minIV}% - {filters.maxIV}%
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Min IV (%)</label>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={filters.minIV}
                  onChange={e => setFilters(prev => ({ ...prev, minIV: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Max IV (%)</label>
                <input
                  type="range"
                  min="20"
                  max="120"
                  step="2"
                  value={filters.maxIV}
                  onChange={e => setFilters(prev => ({ ...prev, maxIV: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Delta Range Filter */}
          <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
            <div className="flex items-center justify-between text-slate-300 mb-2">
              <span className="font-semibold">Delta Threshold (Directional Edge)</span>
              <span className="font-mono text-emerald-400 font-bold">
                Δ {filters.minDelta.toFixed(2)} - {filters.maxDelta.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Min Delta</label>
                <input
                  type="range"
                  min="0.05"
                  max="0.50"
                  step="0.05"
                  value={filters.minDelta}
                  onChange={e => setFilters(prev => ({ ...prev, minDelta: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Max Delta</label>
                <input
                  type="range"
                  min="0.50"
                  max="0.95"
                  step="0.05"
                  value={filters.maxDelta}
                  onChange={e => setFilters(prev => ({ ...prev, maxDelta: Number(e.target.value) }))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Min Open Interest Liquidity Cutoff */}
          <div className="bg-slate-950/70 p-3 rounded border border-slate-800">
            <div className="flex items-center justify-between text-slate-300 mb-2">
              <span className="font-semibold">Liquidity Filter (Min OI)</span>
              <span className="font-mono text-emerald-400 font-bold">
                {filters.minOpenInterest > 0 ? `≥ ${filters.minOpenInterest.toLocaleString()} contracts` : 'Off (Show All)'}
              </span>
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">
                Discard illiquid tail strikes with low contract interest
              </label>
              <input
                type="range"
                min="0"
                max={ticker.category === 'Index' ? 50000 : 10000}
                step={ticker.category === 'Index' ? 2500 : 500}
                value={filters.minOpenInterest}
                onChange={e => setFilters(prev => ({ ...prev, minOpenInterest: Number(e.target.value) }))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      )}

      {/* Row count metadata */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-800/50">
        <div className="flex items-center gap-2">
          <span>Showing <strong className="text-white font-mono">{filteredCount}</strong> of <strong className="text-slate-300 font-mono">{totalCount}</strong> strikes</span>
          <span className="text-slate-600">·</span>
          <span>ATM Strike: <strong className="text-white font-mono">{ticker.currency}{ticker.atmStrike.toLocaleString()}</strong></span>
          <span className="text-slate-600">·</span>
          <span>Tick Step: <strong className="text-slate-300 font-mono">{ticker.strikeStep}</strong></span>
        </div>

        <div className="text-slate-500">
          Click any Call or Put row to launch the Strategy & Payoff Simulator
        </div>
      </div>
    </div>
  );
};
