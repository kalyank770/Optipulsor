import React from 'react';
import { SmcFvgFibSetup, TickerConfig } from '../types/options';
import { 
  Crosshair, 
  Flame, 
  Layers, 
  CheckCircle2
} from 'lucide-react';

interface SmcPriceActionCardProps {
  smc: SmcFvgFibSetup;
  ticker: TickerConfig;
  theme?: 'dark' | 'light';
  tradeDirection?: 'BUY_CE' | 'BUY_PE' | 'WAIT_NEUTRAL';
}

export function SmcPriceActionCard({ smc, ticker, theme = 'dark', tradeDirection }: SmcPriceActionCardProps) {
  const isLight = theme === 'light';

  // Trade direction passed from recommendation takes strict precedence to eliminate contradictions
  const isForcedBear = tradeDirection === 'BUY_PE';
  const isForcedBull = tradeDirection === 'BUY_CE';

  const isBear = isForcedBear || (!isForcedBull && smc.setupDirection === 'BEARISH_REVERSAL_PE');
  const isBull = isForcedBull || (!isForcedBear && smc.setupDirection === 'BULLISH_REVERSAL_CE');

  // Compute dynamic levels matching the active directional regime
  const dayHigh = ticker.dayHigh || ticker.spotPrice;
  const dayLow = ticker.dayLow || ticker.spotPrice;
  const step = ticker.strikeStep;

  const liquiditySweepLevel = isBear
    ? Math.max(dayHigh, smc.liquiditySweepLevel > ticker.spotPrice ? smc.liquiditySweepLevel : dayHigh)
    : Math.min(dayLow, smc.liquiditySweepLevel < ticker.spotPrice ? smc.liquiditySweepLevel : dayLow);

  const marketStructureShiftLevel = isBear
    ? Math.min(Number((ticker.spotPrice - step * 0.2).toFixed(1)), smc.marketStructureShiftLevel < ticker.spotPrice ? smc.marketStructureShiftLevel : Number((dayHigh - step * 0.6).toFixed(1)))
    : Math.max(Number((ticker.spotPrice + step * 0.2).toFixed(1)), smc.marketStructureShiftLevel > ticker.spotPrice ? smc.marketStructureShiftLevel : Number((dayLow + step * 0.6).toFixed(1)));

  const mssLabel = isBear
    ? '1m DAY LOW (MSS Breakdown)'
    : '1m DAY HIGH (MSS Breakout)';

  const rangeSpan = Math.max(step * 0.4, Math.abs(liquiditySweepLevel - marketStructureShiftLevel));
  const oteMin = Number((isBear ? marketStructureShiftLevel + rangeSpan * 0.50 : marketStructureShiftLevel - rangeSpan * 0.618).toFixed(1));
  const oteMax = Number((isBear ? marketStructureShiftLevel + rangeSpan * 0.618 : marketStructureShiftLevel - rangeSpan * 0.50).toFixed(1));
  const optimalTradeEntryRange: [number, number] = [Math.min(oteMin, oteMax), Math.max(oteMin, oteMax)];

  const stopLossSpot = isBear
    ? Number((liquiditySweepLevel + Math.max(step * 0.05, 2.5)).toFixed(2))
    : Number((liquiditySweepLevel - Math.max(step * 0.05, 2.5)).toFixed(2));
  const stopLossPoints = Math.abs(Number((stopLossSpot - ticker.spotPrice).toFixed(1)));

  const targetSpot = isBear
    ? Number((marketStructureShiftLevel - Math.max(step * 0.35, 20)).toFixed(2))
    : Number((marketStructureShiftLevel + Math.max(step * 0.35, 20)).toFixed(2));
  const targetPoints = Math.abs(Number((targetSpot - ticker.spotPrice).toFixed(1)));

  const riskRewardRatio = Number(Math.max(1.8, Math.min(4.2, targetPoints / Math.max(1, stopLossPoints))).toFixed(1));
  const capturedPoints = isBear
    ? (ticker.spotPrice < liquiditySweepLevel ? Math.max(0, Math.round(liquiditySweepLevel - ticker.spotPrice)) : 0)
    : (ticker.spotPrice > liquiditySweepLevel ? Math.max(0, Math.round(ticker.spotPrice - liquiditySweepLevel)) : 0);

  const displacementPoints = Number(rangeSpan.toFixed(1));

  const rationale = isBear
    ? `Buy-side liquidity swept above ${ticker.currency}${liquiditySweepLevel.toLocaleString()} with upper wick supply rejection. Institutional displacement broke structure below ${ticker.currency}${marketStructureShiftLevel.toLocaleString()} ('MSS Breakdown'). Optimal Trade Entry (OTE) active on pullback into FVG + 0.618 FIB zone (${ticker.currency}${optimalTradeEntryRange[0]} - ${ticker.currency}${optimalTradeEntryRange[1]}). Risk/Reward: ${riskRewardRatio} : 1. Synchronized with ${ticker.symbol} BUY PE trade recommendation.`
    : `Sell-side liquidity swept below ${ticker.currency}${liquiditySweepLevel.toLocaleString()} with buyer wick absorption. Institutional displacement broke structure above ${ticker.currency}${marketStructureShiftLevel.toLocaleString()} ('MSS Breakout'). Optimal Trade Entry (OTE) active on pullback into FVG + 0.618 FIB zone (${ticker.currency}${optimalTradeEntryRange[0]} - ${ticker.currency}${optimalTradeEntryRange[1]}). Risk/Reward: ${riskRewardRatio} : 1. Synchronized with ${ticker.symbol} BUY CE trade recommendation.`;

  return (
    <div className={`p-4 sm:p-5 rounded-2xl border transition-all shadow-xl relative overflow-hidden ${
      isLight 
        ? 'bg-white border-slate-200 text-slate-900' 
        : 'bg-slate-900/95 border-slate-800 text-slate-100 shadow-emerald-950/20'
    }`}>
      {/* Background Decorative Gradient */}
      <div className={`absolute -right-16 -top-16 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 ${
        isBear ? 'bg-rose-500' : isBull ? 'bg-emerald-500' : 'bg-cyan-500'
      }`} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl border flex items-center justify-center shrink-0 ${
            isBear 
              ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' 
              : isBull 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
          }`}>
            <Crosshair className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black tracking-tight text-white flex items-center gap-1.5">
                <span>Institutional SMC Trade Logic</span>
              </h3>
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase ${
                isBear 
                  ? 'bg-rose-950 text-rose-300 border-rose-700' 
                  : isBull 
                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700' 
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {isBear ? 'Short Entry (BUY PE)' : isBull ? 'Long Entry (BUY CE)' : 'Monitoring'}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Liquidity Sweep → Market Structure Shift (MSS) → FVG + 0.618 FIB Confluence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm">
            <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>R:R {riskRewardRatio} : 1</span>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono">
            Captured: <strong className="text-amber-300">+{capturedPoints} pts</strong>
          </span>
        </div>
      </div>

      {/* Visual Institutional Price Action Blueprint */}
      <div className="mt-4 p-3.5 sm:p-4 rounded-xl bg-slate-950/90 border border-slate-800 relative z-10 space-y-3 font-mono">
        <div className="flex items-center justify-between text-xs text-slate-400 border-b border-slate-800/80 pb-2">
          <span className="font-sans font-semibold text-slate-300 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>SMC Multi-Level Structural Execution Flow</span>
          </span>
          <span className="text-[11px] text-emerald-400 font-bold">1-Min &amp; 5-Min Alignment</span>
        </div>

        {/* Level 1: Previous Day / Session Liquidity Sweep */}
        <div className="p-2.5 rounded-lg bg-slate-900/80 border-l-4 border-l-sky-500 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-sky-400" />
            <span className="font-bold text-sky-300">
              {isBear ? 'Previous Day / Session High Sweep' : 'Previous Day / Session Low Sweep'}
            </span>
            <span className="text-[11px] text-slate-400 font-sans">
              {isBear ? '(Retail Breakout Trap)' : '(Retail Breakdown Trap)'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white font-bold">{ticker.currency}{liquiditySweepLevel.toLocaleString()}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-950 border border-sky-800 text-sky-300">1.0 FIB</span>
          </div>
        </div>

        {/* Level 2: FVG + FIB Shaded Optimal Trade Entry Box */}
        <div className="p-3 rounded-lg bg-gradient-to-r from-emerald-950/50 via-teal-950/40 to-slate-900 border-2 border-emerald-500/50 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black text-[11px] shadow-sm">
                  FVG + FIB
                </span>
                <span className="font-bold text-emerald-300 text-xs">
                  Optimal Trade Entry (OTE Zone: 0.50 – 0.618 Fib)
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans mt-1">
                {isBear 
                  ? 'Enter on the pullback retest of the Fair Value Gap rather than chasing the breakdown!'
                  : 'Enter on the pullback retest of the Fair Value Gap rather than chasing the breakout!'}
              </p>
            </div>

            <div className="text-right sm:text-right shrink-0">
              <span className="text-xs text-white font-black block">
                {ticker.currency}{optimalTradeEntryRange[0].toFixed(1)} – {ticker.currency}{optimalTradeEntryRange[1].toFixed(1)}
              </span>
              <span className="text-[10px] text-amber-300">
                Golden Pocket Retracement
              </span>
            </div>
          </div>
        </div>

        {/* Level 3: Market Structure Shift (1m MSS) */}
        <div className="p-2.5 rounded-lg bg-slate-900/80 border-l-4 border-l-purple-500 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span className="font-bold text-purple-300">{mssLabel}</span>
            <span className="text-[11px] text-slate-400 font-sans">(Market Structure Shift / MSS)</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-white font-bold">{ticker.currency}{marketStructureShiftLevel.toLocaleString()}</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 border border-purple-800 text-purple-300">0.0 FIB</span>
          </div>
        </div>

        {/* Risk / Reward Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
          <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-800/40">
            <span className="text-[10px] text-rose-400 block font-sans">Stop Loss (Risk)</span>
            <span className="text-rose-300 font-bold text-sm">
              {stopLossPoints.toFixed(1)} pts ({ticker.currency}{stopLossSpot.toLocaleString()})
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
            <span className="text-[10px] text-emerald-400 block font-sans">Target 1 (Liquidity Pool)</span>
            <span className="text-emerald-300 font-bold text-sm">
              +{targetPoints.toFixed(1)} pts ({ticker.currency}{targetSpot.toLocaleString()})
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-amber-950/40 border border-amber-800/40">
            <span className="text-[10px] text-amber-400 block font-sans">Risk / Return Ratio</span>
            <span className="text-amber-300 font-bold text-sm">
              {riskRewardRatio} : 1 Asymmetric
            </span>
          </div>

          <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 block font-sans">Displacement Move</span>
            <span className="text-white font-bold text-sm">
              {displacementPoints.toFixed(1)} pts
            </span>
          </div>
        </div>
      </div>

      {/* Synergy: SMC Price Action + Quantitative Calculations Box */}
      <div className="mt-3.5 p-3 rounded-xl bg-gradient-to-r from-slate-950 to-slate-900 border border-slate-800 text-xs relative z-10 space-y-1.5">
        <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
          <CheckCircle2 className="w-4 h-4" />
          <span>SMC Price Action + Quantitative Calculations Synergy:</span>
        </div>
        <p className="text-slate-300 font-sans leading-relaxed text-[11.5px]">
          {rationale}
        </p>
      </div>
    </div>
  );
}
