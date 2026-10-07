import React, { useState } from 'react';
import { 
  AdvanceTradeSetup, 
  TickerConfig, 
  MarketMetrics, 
  OptionChainRow,
  LeadingPredictorFactor
} from '../types/options';
import { 
  Zap, 
  ShieldCheck, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Layers, 
  Gauge, 
  ChevronDown, 
  ChevronUp, 
  PlayCircle, 
  Globe,
  FileCheck2
} from 'lucide-react';

interface AdvanceTradeCardProps {
  setup: AdvanceTradeSetup;
  ticker: TickerConfig;
  metrics: MarketMetrics;
  chain?: OptionChainRow[];
  onSelectContractForSimulation: (strike: number, type: 'CE' | 'PE') => void;
  onSelectTab?: (tab: string) => void;
  theme?: 'dark' | 'light';
  isCompact?: boolean;
}

export const AdvanceTradeCard: React.FC<AdvanceTradeCardProps> = ({
  setup,
  ticker,
  metrics,
  chain,
  onSelectContractForSimulation,
  onSelectTab,
  theme = 'dark',
  isCompact = false,
}) => {
  const isLight = theme === 'light';
  // Collapsed by default as requested
  const [showRadarDetails, setShowRadarDetails] = useState(false);

  const isBull = setup.anticipatedAction === 'BUY_CE';
  const isBear = setup.anticipatedAction === 'BUY_PE';
  const isWait = setup.anticipatedAction === 'WAIT_NEUTRAL';

  // Find live option LTP
  const contractRow = chain?.find(r => r.strike === setup.recommendedStrike);
  const liveOption = setup.recommendedType === 'CE' ? contractRow?.ce : contractRow?.pe;
  const currentLTP = liveOption && liveOption.ltp > 0.05
    ? liveOption.ltp
    : setup.advanceEntryOptionRange[0] || 105;

  const getFactorBadgeColor = (state: LeadingPredictorFactor['state']) => {
    switch (state) {
      case 'STRONG_BULLISH':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'MODERATE_BULLISH':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'STRONG_BEARISH':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'MODERATE_BEARISH':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className={`rounded-xl border p-4 sm:p-5 transition-all shadow-lg relative overflow-hidden ${
      isLight 
        ? 'bg-gradient-to-br from-indigo-50/50 via-white to-amber-50/30 border-indigo-200 text-slate-900' 
        : 'bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border-indigo-500/30 text-slate-100'
    }`}>
      {/* Background Ambient Glow */}
      <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 ${
        isBull ? 'bg-emerald-500/10' : isBear ? 'bg-rose-500/10' : 'bg-indigo-500/10'
      }`} />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-indigo-500/20 relative z-10">
        <div className="flex items-start sm:items-center gap-2.5">
          <div className={`p-2 sm:p-2.5 rounded-lg flex items-center justify-center shrink-0 border ${
            isBull ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-xs shadow-emerald-500/20' :
            isBear ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-xs shadow-rose-500/20' :
            'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
          }`}>
            <Zap className="w-5 h-5 animate-pulse text-amber-400" />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60">
                Institutional Early-Anticipation Engine
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Confidence: <strong className="text-emerald-400 font-bold">{setup.probabilityScore}%</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Audit Report Link */}
          {onSelectTab && (
            <button
              onClick={() => onSelectTab('report')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-sky-950/70 hover:bg-sky-900/70 text-sky-300 border border-sky-700/60 text-xs font-mono transition-all cursor-pointer shadow-xs"
              title="View full Audit Report and algorithm reliability audit"
            >
              <FileCheck2 className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden xs:inline">Audit Report →</span>
            </button>
          )}

          {/* Simulate Contract Button */}
          {!isWait && (
            <button
              onClick={() => onSelectContractForSimulation(setup.recommendedStrike, setup.recommendedType)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs font-mono transition-all cursor-pointer shadow-sm shadow-emerald-500/20"
              title="Test & Simulate this trade payoff immediately"
            >
              <PlayCircle className="w-3.5 h-3.5" />
              <span>Simulate Payoff</span>
            </button>
          )}
        </div>
      </div>

      {/* Subtitle */}
      <p className="text-xs text-slate-300 font-sans mt-2.5 leading-relaxed relative z-10">
        <strong className="text-amber-300">Predictive Trigger: </strong>
        {setup.primaryLeadingCatalyst}
      </p>

      {/* PRIMARY SETUP HIGHLIGHT CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-3 relative z-10">
        {/* Card 1: Action & Recommended Strike */}
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          isBull ? 'bg-emerald-950/40 border-emerald-500/40' :
          isBear ? 'bg-rose-950/40 border-rose-500/40' :
          'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>RECOMMENDED STRIKE</span>
            <span className={`font-bold text-[10px] px-1.5 py-0.2 rounded border ${
              isBull ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' :
              isBear ? 'bg-rose-950 text-rose-300 border-rose-500/40' :
              'bg-slate-800 text-slate-300 border-slate-700'
            }`}>
              {setup.anticipatedAction.replace('_', ' ')}
            </span>
          </div>
          <div className="mt-1">
            <div className={`text-base sm:text-xl font-bold font-mono flex items-center gap-1.5 ${
              isBull ? 'text-emerald-300' : isBear ? 'text-rose-300' : 'text-slate-300'
            }`}>
              {isBull && <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />}
              {isBear && <ArrowDownRight className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{setup.recommendedStrike} {setup.recommendedType}</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              Live LTP: <strong className="text-white">{ticker.currency}{currentLTP.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: Entry Zone (Spot & Option) */}
        <div className="p-3 rounded-lg border bg-slate-900/80 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>ENTRY ZONE</span>
            <span className="text-emerald-400 font-bold text-[10px]">BASE SUPPORT</span>
          </div>
          <div className="mt-1">
            <div className="text-xs sm:text-sm font-bold font-mono text-amber-300">
              {ticker.currency}{setup.advanceEntryZoneSpot[0].toLocaleString()} – {ticker.currency}{setup.advanceEntryZoneSpot[1].toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              Option: <span className="text-slate-200">{ticker.currency}{setup.advanceEntryOptionRange[0].toFixed(2)} – {ticker.currency}{setup.advanceEntryOptionRange[1].toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Invalidation Stop-Loss */}
        <div className="p-3 rounded-lg border bg-slate-900/80 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>STRICT STOP-LOSS</span>
            <span className="text-rose-400 font-bold text-[10px]">PROTECTED</span>
          </div>
          <div className="mt-1">
            <div className="text-xs sm:text-sm font-bold font-mono text-rose-300">
              Spot: {ticker.currency}{setup.advanceStopLossSpot.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              Option SL: <strong className="text-rose-400">{ticker.currency}{setup.advanceOptionStopLoss.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {/* Card 4: Targets & Risk-Reward */}
        <div className="p-3 rounded-lg border bg-slate-900/80 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>TARGETS</span>
            <span className="text-emerald-400 font-bold text-[10px]">R:R {setup.advanceRiskRewardRatio}</span>
          </div>
          <div className="mt-1">
            <div className="text-xs sm:text-sm font-bold font-mono text-emerald-300">
              T1: {ticker.currency}{setup.advanceOptionTarget1.toFixed(2)} <span className="text-[10px] text-emerald-400">(+{Math.max(1, Math.round(((setup.advanceOptionTarget1 - currentLTP) / Math.max(0.05, currentLTP)) * 100))}%)</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              T2: <span className="text-emerald-400">{ticker.currency}{setup.advanceOptionTarget2.toFixed(2)}</span> (+{Math.max(2, Math.round(((setup.advanceOptionTarget2 - currentLTP) / Math.max(0.05, currentLTP)) * 100))}%)
            </div>
          </div>
        </div>
      </div>

      {/* 5+ LEADING PREDICTORS RADAR (COLLAPSED BY DEFAULT) */}
      <div className="mt-3 relative z-10">
        <button
          onClick={() => setShowRadarDetails(prev => !prev)}
          className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-850 text-slate-200 border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-indigo-400" />
            <span className="font-bold">5 Institutional Leading Predictors Radar</span>
            <span className="text-[10px] text-slate-400">({setup.leadingPredictorFactors.length} factors evaluated)</span>
          </div>
          <div className="flex items-center gap-1.5 text-indigo-400 text-[11px]">
            <span>{showRadarDetails ? 'Hide Radar' : 'View Live Radar'}</span>
            {showRadarDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showRadarDetails && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 pt-1 animate-fade-in">
            {setup.leadingPredictorFactors.map((factor, idx) => (
              <div 
                key={idx} 
                className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between space-y-1.5"
              >
                <div className="flex items-start justify-between gap-1.5">
                  <span className="text-xs font-bold text-slate-200 leading-tight">
                    {factor.name}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${getFactorBadgeColor(factor.state)}`}>
                    {factor.state.replace(/_/g, ' ')}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 leading-normal font-sans">
                  {factor.valueDescription}
                </p>

                <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-850">
                  <span>Confidence: <strong className="text-slate-300">{factor.confidenceScore}%</strong></span>
                  <span className="text-emerald-400/90 font-semibold">Active Vector</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
