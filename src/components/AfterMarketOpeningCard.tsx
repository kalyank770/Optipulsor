import React from 'react';
import { 
  Moon, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Zap, 
  Layers, 
  ArrowUpRight, 
  ArrowDownRight,
  Clock,
  Briefcase
} from 'lucide-react';
import { AfterMarketOpeningAnalytics } from '../utils/afterMarketEngine';
import { TickerConfig } from '../types/options';

interface AfterMarketOpeningCardProps {
  analytics?: AfterMarketOpeningAnalytics;
  ticker: TickerConfig;
  theme?: 'dark' | 'light';
}

export const AfterMarketOpeningCard: React.FC<AfterMarketOpeningCardProps> = ({
  analytics,
  ticker,
  theme = 'dark'
}) => {
  if (!analytics || !analytics.isAfterMarketMode) return null;

  const isLight = theme === 'light';
  const {
    sessionStateLabel,
    lastSpotClose,
    lastVwapClose,
    vwapDeltaPoints,
    vwapDeltaLabel,
    giftNiftyPrice,
    giftNiftyChangePoints,
    giftNiftyChangePercent,
    fiiDiiNetFlow,
    predictedOpeningSpot,
    predictedOpeningGapPoints,
    predictedOpeningGapPercent,
    predictedOpeningType,
    openingStrategyPlaybook
  } = analytics;

  const isGapUp = predictedOpeningType === 'GAP_UP_OPENING';
  const isGapDown = predictedOpeningType === 'GAP_DOWN_OPENING';

  return (
    <div className={`rounded-xl border p-4 shadow-xl space-y-4 font-sans transition-all ${
      isLight 
        ? 'bg-gradient-to-br from-indigo-50/90 via-white to-sky-50/90 border-indigo-200 text-slate-900' 
        : 'bg-gradient-to-br from-slate-950 via-indigo-950/30 to-slate-950 border-indigo-500/40 text-slate-100'
    }`}>
      {/* 1. SECTION HEADER: Session Badge & Next Day Opening Prediction */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-500/20 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shrink-0">
            <Moon className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-white">
                After-Market & Pre-Market Opening Analytics
              </h3>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-bold">
                {sessionStateLabel.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Overnight parameters (GIFT Nifty, Close vs VWAP, FII flow) forecasting next session's opening gap
            </p>
          </div>
        </div>

        {/* Predicted Opening Gap Badge */}
        <div className="flex items-center gap-2 font-mono">
          <span className="text-xs text-slate-400">Predicted Open:</span>
          <span className={`px-3 py-1 rounded text-xs font-extrabold flex items-center gap-1 border ${
            isGapUp 
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
              : isGapDown 
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
              : 'bg-slate-800 text-slate-300 border-slate-700'
          }`}>
            {isGapUp ? <ArrowUpRight className="w-3.5 h-3.5" /> : isGapDown ? <ArrowDownRight className="w-3.5 h-3.5" /> : null}
            <span>{ticker.currency}{predictedOpeningSpot.toLocaleString()}</span>
            <span className="text-[10.5px]">
              ({predictedOpeningGapPoints >= 0 ? '+' : ''}{predictedOpeningGapPoints} pts / {predictedOpeningGapPercent}%)
            </span>
          </span>
        </div>
      </div>

      {/* 2. OVERNIGHT AFTER-MARKET PARAMETERS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs font-mono">
        {/* A. Closing Spot vs VWAP Delta */}
        <div className={`p-3 rounded-lg border ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="text-[10.5px] text-slate-400 font-bold uppercase font-sans mb-1 flex items-center justify-between">
            <span>Close vs VWAP Delta</span>
            <Clock className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-sm font-extrabold text-white">
            Spot Close: {ticker.currency}{lastSpotClose.toLocaleString()}
          </div>
          <p className={`text-[11px] font-semibold mt-1 ${vwapDeltaPoints >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {vwapDeltaLabel}
          </p>
        </div>

        {/* B. GIFT Nifty Overnight Trading */}
        <div className={`p-3 rounded-lg border ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="text-[10.5px] text-slate-400 font-bold uppercase font-sans mb-1 flex items-center justify-between">
            <span>GIFT Nifty Overnight</span>
            <Layers className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="text-sm font-extrabold text-sky-300">
            {giftNiftyPrice.toLocaleString()}
          </div>
          <p className={`text-[11px] font-semibold mt-1 ${giftNiftyChangePoints >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {giftNiftyChangePoints >= 0 ? '+' : ''}{giftNiftyChangePoints} pts ({giftNiftyChangePercent}%)
          </p>
        </div>

        {/* C. FII / DII After-Market Net Flow */}
        <div className={`p-3 rounded-lg border ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="text-[10.5px] text-slate-400 font-bold uppercase font-sans mb-1 flex items-center justify-between">
            <span>FII After-Market Net Flow</span>
            <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-extrabold text-emerald-300">
            FII: {fiiDiiNetFlow.fiiNetCashCr >= 0 ? `+₹${fiiDiiNetFlow.fiiNetCashCr} Cr` : `-₹${Math.abs(fiiDiiNetFlow.fiiNetCashCr)} Cr`}
          </div>
          <p className="text-[11px] text-slate-300 mt-1 truncate">
            {fiiDiiNetFlow.netFlowSentiment.replace(/_/g, ' ')}
          </p>
        </div>

        {/* D. Global Macro Backdrop */}
        <div className={`p-3 rounded-lg border ${
          isLight ? 'bg-white border-slate-200' : 'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="text-[10.5px] text-slate-400 font-bold uppercase font-sans mb-1 flex items-center justify-between">
            <span>Opening Sentiment</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-sm font-extrabold text-amber-300">
            {predictedOpeningType.replace(/_/g, ' ')}
          </div>
          <p className="text-[11px] text-slate-300 mt-1">
            Global Score: {analytics.globalMacroCompositeScore > 0 ? `+${analytics.globalMacroCompositeScore}` : analytics.globalMacroCompositeScore} / 100
          </p>
        </div>
      </div>

      {/* 3. NEXT DAY OPENING TRADE STRATEGY PLAYBOOK */}
      <div className={`p-3.5 rounded-lg border ${
        openingStrategyPlaybook.openingBias === 'BULLISH_GAP_MOMENTUM'
          ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-100'
          : openingStrategyPlaybook.openingBias === 'BEARISH_GAP_BREAKDOWN'
          ? 'bg-rose-950/40 border-rose-500/40 text-rose-100'
          : 'bg-amber-950/40 border-amber-500/40 text-amber-100'
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-2">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-white/10 shrink-0">
              {openingStrategyPlaybook.openingOptionType === 'CE' ? <TrendingUp className="w-4 h-4 text-emerald-400" /> : <TrendingDown className="w-4 h-4 text-rose-400" />}
            </span>
            <span className="font-bold text-xs uppercase tracking-wider text-white">
              Next Day Opening Playbook: {openingStrategyPlaybook.strategyTitle}
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-[10px] text-slate-300">Opening Trade:</span>
            <span className="px-2.5 py-0.5 rounded font-extrabold bg-white/20 border border-white/20 text-white">
              {openingStrategyPlaybook.recommendedOpeningOption === 'BUY_CE' 
                ? `BUY ${openingStrategyPlaybook.openingStrike} CE` 
                : openingStrategyPlaybook.recommendedOpeningOption === 'BUY_PE' 
                ? `BUY ${openingStrategyPlaybook.openingStrike} PE` 
                : 'WAIT FOR 15M ORB'}
            </span>
          </div>
        </div>

        <p className="text-xs leading-relaxed mt-2.5 font-sans text-slate-200">
          <strong>Opening Strategy & Context:</strong> {openingStrategyPlaybook.playbookDescription}
        </p>

        {openingStrategyPlaybook.recommendedOpeningOption !== 'WAIT_FIRST_15M' && (
          <div className="grid grid-cols-3 gap-2 mt-3 pt-2.5 border-t border-white/10 font-mono text-xs text-center">
            <div>
              <span className="text-[10px] text-slate-300 block">TARGET 1 (T1)</span>
              <strong className="text-emerald-400 text-sm">₹{openingStrategyPlaybook.openingContractTarget1.toFixed(2)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-300 block">TARGET 2 (T2)</span>
              <strong className="text-sky-400 text-sm">₹{openingStrategyPlaybook.openingContractTarget2.toFixed(2)}</strong>
            </div>
            <div>
              <span className="text-[10px] text-slate-300 block">OPENING STOP LOSS</span>
              <strong className="text-rose-400 text-sm">₹{openingStrategyPlaybook.openingContractStopLoss.toFixed(2)}</strong>
            </div>
          </div>
        )}

        <div className="mt-2.5 pt-2 border-t border-white/10 text-[11px] font-mono text-slate-300 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-300 shrink-0" />
          <span><strong>Execution Trigger:</strong> {openingStrategyPlaybook.openingExecutionTrigger}</span>
        </div>
      </div>
    </div>
  );
};
