import React from 'react';
import { Gauge, Activity, Zap, TrendingUp, ShieldAlert, BarChart2 } from 'lucide-react';
import { RealtimePredictionIndicators } from '../types/options';

interface RealtimeQuantSectionProps {
  indicators?: RealtimePredictionIndicators;
  currency?: string;
}

export const RealtimeQuantSection: React.FC<RealtimeQuantSectionProps> = ({
  indicators,
  currency = '₹'
}) => {
  if (!indicators) {
    return (
      <div className="bg-slate-950/80 p-6 rounded-lg border border-slate-800 text-center text-slate-400 text-xs">
        Quantitative indicators generating live telemetry stream...
      </div>
    );
  }

  const { vwap, rsi, macd, ema, gammaExposure, orderFlow, vixVelocity } = indicators;

  return (
    <div className="space-y-4 pt-1 font-sans">
      {/* 6 Grid Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* 1. VWAP Structural Channel */}
        <div className="bg-slate-950/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                VWAP Channel & Position
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                vwap.bias === 'BULLISH' ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80' :
                vwap.bias === 'BEARISH' ? 'bg-rose-950/70 text-rose-300 border-rose-800/80' :
                'bg-slate-800 text-slate-300 border-slate-700'
              }`}>
                {vwap.bias} ({vwap.distancePercent > 0 ? `+${vwap.distancePercent.toFixed(2)}%` : `${vwap.distancePercent.toFixed(2)}%`})
              </span>
            </div>
            <div className="text-xl font-extrabold font-mono text-white">
              {currency}{vwap.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1 flex justify-between">
              <span>Band: {currency}{vwap.lowerBand.toFixed(1)} - {currency}{vwap.upperBand.toFixed(1)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 border-t border-slate-800/80 pt-2 font-mono">
            {vwap.statusLabel}
          </p>
        </div>

        {/* 2. RSI & Multi-timeframe Momentum */}
        <div className="bg-slate-950/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-sky-400" />
                RSI Relative Strength
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950/70 text-sky-300 border border-sky-800/80 font-bold">
                {rsi.condition}
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-xl font-extrabold font-mono text-sky-300">
                {rsi.value.toFixed(1)}
              </div>
              {rsi.divergence !== 'NONE' && (
                <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  {rsi.divergence.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 border-t border-slate-800/80 pt-2 font-mono">
            {rsi.label}
          </p>
        </div>

        {/* 3. MACD Divergence & Histogram Velocity */}
        <div className="bg-slate-950/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                MACD Trend Velocity
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/70 text-amber-300 border border-amber-800/80 font-bold">
                {macd.trend.replace('_', ' ')}
              </span>
            </div>
            <div className="text-xl font-extrabold font-mono text-slate-200">
              Hist: <span className={macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {macd.histogram > 0 ? `+${macd.histogram.toFixed(2)}` : macd.histogram.toFixed(2)}
              </span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1 flex justify-between">
              <span>MACD: {macd.macdLine.toFixed(2)} | Signal: {macd.signalLine.toFixed(2)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 border-t border-slate-800/80 pt-2 font-mono">
            MACD histogram velocity aligns with direction.
          </p>
        </div>

        {/* 4. EMA Ribbon Alignment */}
        <div className="bg-slate-950/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                EMA 9 / 21 Ribbon
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800/80 font-bold">
                {ema.alignment}
              </span>
            </div>
            <div className="text-xl font-extrabold font-mono text-white">
              Spread: <span className={ema.spread >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{ema.spread > 0 ? `+${ema.spread.toFixed(2)}` : ema.spread.toFixed(2)}</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1 flex justify-between">
              <span>EMA9: {currency}{ema.ema9.toFixed(1)} | EMA21: {currency}{ema.ema21.toFixed(1)}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 border-t border-slate-800/80 pt-2 font-mono">
            {ema.label}
          </p>
        </div>

        {/* 5. Institutional Gamma Exposure (GEX) */}
        <div className="bg-slate-950/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <BarChart2 className="w-3.5 h-3.5 text-purple-400" />
                Gamma Exposure (GEX)
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-bold ${
                gammaExposure.regime === 'POSITIVE_GAMMA' 
                  ? 'bg-emerald-950/70 text-emerald-300 border-emerald-800/80' 
                  : 'bg-rose-950/70 text-rose-300 border-rose-800/80'
              }`}>
                {gammaExposure.regime.replace('_', ' ')}
              </span>
            </div>
            <div className="text-xl font-extrabold font-mono text-purple-300">
              Net GEX: {gammaExposure.netGex > 0 ? `+${gammaExposure.netGex.toLocaleString()}` : gammaExposure.netGex.toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1 flex justify-between">
              <span>Gamma Flip Strike: <strong className="text-white">{currency}{gammaExposure.flipStrike.toLocaleString()}</strong></span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 border-t border-slate-800/80 pt-2 font-mono">
            {gammaExposure.implication}
          </p>
        </div>

        {/* 6. Order Flow & VIX Velocity */}
        <div className="bg-slate-950/90 p-3.5 rounded-lg border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                Order Flow & VIX State
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-950/70 text-rose-300 border border-rose-800/80 font-bold">
                {vixVelocity.velocityState}
              </span>
            </div>
            <div className="text-xl font-extrabold font-mono text-slate-200">
              VIX: {vixVelocity.vix.toFixed(2)} ({vixVelocity.vixChange >= 0 ? `+${vixVelocity.vixChange.toFixed(2)}` : vixVelocity.vixChange.toFixed(2)})
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-1 flex justify-between">
              <span>Order Flow: {orderFlow.sentiment.replace('_', ' ')}</span>
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2 border-t border-slate-800/80 pt-2 font-mono">
            {vixVelocity.impactOnOptions}
          </p>
        </div>
      </div>
    </div>
  );
};
