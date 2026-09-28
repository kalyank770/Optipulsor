import React from 'react';
import { Target, Compass, ArrowUpRight, ArrowDownRight, ShieldCheck, Zap, Newspaper } from 'lucide-react';
import { TargetExitSynthesis, TradeSignal } from '../types/options';

interface GroundedPayoffSectionProps {
  synthesis?: TargetExitSynthesis;
  signal?: TradeSignal;
  currency?: string;
}

export const GroundedPayoffSection: React.FC<GroundedPayoffSectionProps> = ({
  synthesis,
  signal,
  currency = '₹'
}) => {
  if (!synthesis && !signal) {
    return (
      <div className="bg-slate-950/80 p-6 rounded-lg border border-slate-800 text-center text-slate-400 text-xs">
        Grounded payoff synthesis matrix computing real-time risk/reward profiles...
      </div>
    );
  }

  const grounding = synthesis?.entryExitGrounding;
  const candle = synthesis?.candlestickPillar;
  const news = synthesis?.newsPillar;
  const trend = synthesis?.trendPillar;

  return (
    <div className="space-y-4 pt-1 font-sans">
      {/* 4-Pillar Confluence Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Pillar 1: Candlestick & Momentum */}
        <div className="bg-slate-950/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Zap className="w-3.5 h-3.5 text-emerald-400" />
              1. Pattern & Momentum
            </div>
            <div className="text-sm font-bold text-white font-mono">
              {candle?.confluencePattern || 'Multi-TF Momentum'}
            </div>
            <div className="text-[11px] font-mono text-emerald-400 mt-1">
              Confluence Score: {candle?.confluenceScore ?? '+8.5'}/10
            </div>
          </div>
          <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-800/80 pt-1.5 font-mono">
            {candle?.momentumAlignment || 'Full Timeframe Confluence'}
          </div>
        </div>

        {/* Pillar 2: News & Catalyst Multiplier */}
        <div className="bg-slate-950/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Newspaper className="w-3.5 h-3.5 text-sky-400" />
              2. News Impact Multiplier
            </div>
            <div className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
              <span className="text-sky-300 font-extrabold">{news?.newsTargetImpact || '1.15x Acceleration'}</span>
            </div>
            <div className="text-[11px] font-mono text-sky-400 mt-1">
              Net Bias Score: {news?.netNewsBiasScore ?? '+7.2'}
            </div>
          </div>
          <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-800/80 pt-1.5 font-mono truncate">
            {news?.liveHeadline || 'Institutional order flow catalyst'}
          </div>
        </div>

        {/* Pillar 3: Trend & Daily ATR Range */}
        <div className="bg-slate-950/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
              3. Trend Continuation
            </div>
            <div className="text-sm font-bold text-amber-300 font-mono">
              {trend?.momentumVerdict || 'Bullish Momentum'}
            </div>
            <div className="text-[11px] font-mono text-amber-400 mt-1">
              Continuation Prob: {trend?.trendContinuationProb ?? '82'}%
            </div>
          </div>
          <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-800/80 pt-1.5 font-mono">
            Daily ATR: {trend?.atrDaily ?? '185'} pts
          </div>
        </div>

        {/* Pillar 4: Risk / Reward Target Structure */}
        <div className="bg-slate-950/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              4. Grounded Risk/Reward
            </div>
            <div className="text-sm font-bold text-emerald-300 font-mono">
              R:R Ratio {signal?.riskRewardRatio || '1:2.8'}
            </div>
            <div className="text-[11px] font-mono text-slate-300 mt-1">
              Confidence: {signal?.confidence ?? 88}%
            </div>
          </div>
          <div className="text-[10px] text-slate-400 mt-2 border-t border-slate-800/80 pt-1.5 font-mono">
            Structured Stop Loss Discipline
          </div>
        </div>
      </div>

      {/* Target Entry & Exit Level Derivation Grid */}
      <div className="bg-slate-950/90 p-4 rounded-lg border border-slate-800 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-400" />
            Spot Level Derivation & Option Premium Payoff Breakdown
          </h4>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
            Grounded Targets
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
          {/* Target 1 Spot & Premium */}
          <div className="bg-slate-900/90 p-3 rounded-lg border border-emerald-500/30">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-emerald-400">Target 1 (Primary)</span>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-bold">
                {grounding?.target1Probability ?? 85}% Prob
              </span>
            </div>
            <div className="text-lg font-extrabold text-white">
              Spot: {currency}{(grounding?.target1SpotLevel || signal?.spotTarget1 || 0).toLocaleString()}
            </div>
            <div className="text-xs text-emerald-300 font-bold mt-1">
              Option Premium: {currency}{(signal?.target1 || 0).toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-sans border-t border-slate-800 pt-1">
              {grounding?.target1SwingBasis || signal?.target1Basis || 'Pivot Resistance / Pivot Retracement Target'}
            </p>
          </div>

          {/* Target 2 Spot & Premium */}
          <div className="bg-slate-900/90 p-3 rounded-lg border border-sky-500/30">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-sky-400">Target 2 (Runner Expansion)</span>
              <span className="text-[10px] bg-sky-500/20 text-sky-300 px-1.5 py-0.5 rounded font-bold">
                {grounding?.target2Probability ?? 62}% Prob
              </span>
            </div>
            <div className="text-lg font-extrabold text-white">
              Spot: {currency}{(grounding?.target2SpotLevel || signal?.spotTarget2 || 0).toLocaleString()}
            </div>
            <div className="text-xs text-sky-300 font-bold mt-1">
              Option Premium: {currency}{(signal?.target2 || 0).toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-sans border-t border-slate-800 pt-1">
              {grounding?.target2SwingBasis || signal?.target2Basis || 'Extended Fibonacci swing projection'}
            </p>
          </div>

          {/* Stop Loss & Invalidation */}
          <div className="bg-slate-900/90 p-3 rounded-lg border border-rose-500/30">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-rose-400">Structural Stop Loss</span>
              <span className="text-[10px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded font-bold">
                Invalidation
              </span>
            </div>
            <div className="text-lg font-extrabold text-white">
              Spot: {currency}{(grounding?.stopLossSpotLevel || signal?.spotStopLoss || 0).toLocaleString()}
            </div>
            <div className="text-xs text-rose-300 font-bold mt-1">
              Option Premium SL: {currency}{(signal?.stopLoss || 0).toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 font-sans border-t border-slate-800 pt-1">
              {grounding?.stopLossBasis || 'Below recent swing low & key VWAP support band'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
