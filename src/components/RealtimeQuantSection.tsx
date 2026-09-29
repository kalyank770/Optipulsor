import React from 'react';
import { 
  Gauge, 
  Activity, 
  Zap, 
  TrendingUp, 
  TrendingDown,
  ShieldAlert, 
  BarChart2, 
  Globe
} from 'lucide-react';
import { RealtimePredictionIndicators, InterMarketTelemetry } from '../types/options';
import { getInterMarketTelemetry } from '../data/globalMacroData';

interface RealtimeQuantSectionProps {
  indicators?: RealtimePredictionIndicators;
  interMarketTelemetry?: InterMarketTelemetry;
  currency?: string;
  tickerSymbol?: string;
}

export const RealtimeQuantSection: React.FC<RealtimeQuantSectionProps> = ({
  indicators,
  interMarketTelemetry,
  currency = '₹',
  tickerSymbol = 'NIFTY 50'
}) => {
  const telemetry = interMarketTelemetry || getInterMarketTelemetry(tickerSymbol);

  if (!indicators) {
    return (
      <div className="bg-slate-950/80 p-6 rounded-lg border border-slate-800 text-center text-slate-400 text-xs font-mono">
        Quantitative telemetry & volume dynamics generating real-time stream...
      </div>
    );
  }

  const { vwap, rsi, macd, ema, gammaExposure, orderFlow, vixVelocity, volumeAnalytics } = indicators;

  return (
    <div className="space-y-5 pt-1 font-sans">
      {/* SECTION 1: GLOBAL INTER-MARKET TELEMETRY (Inter-Market Correlation Affecting Indian Derivatives) */}
      <div className="rounded-xl border border-sky-500/30 bg-slate-950/90 p-4 shadow-lg space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-sky-500/15 text-sky-400 border border-sky-500/30 shrink-0">
              <Globe className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Inter-Market Telemetry & Global Cues</span>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
                  Indian F&O Driver
                </span>
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Overnight lead & real-time correlation drivers: GIFT Nifty, US Futures, USD/INR, Brent Crude & US Yields
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono">
            <span className="text-xs text-slate-400">Global Score:</span>
            <span className={`px-2.5 py-1 rounded text-xs font-extrabold border ${
              telemetry.globalCompositeScore >= 15 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' 
                : telemetry.globalCompositeScore <= -15 
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                : 'bg-slate-800 text-slate-300 border-slate-700'
            }`}>
              {telemetry.globalCompositeScore > 0 ? `+${telemetry.globalCompositeScore}` : telemetry.globalCompositeScore} / 100
            </span>
            <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-slate-900 border border-slate-800 text-emerald-400">
              FII: {telemetry.fiiFlowExpectation.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* Global Market Driver Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs font-mono">
          {/* 1. GIFT Nifty */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase block truncate font-sans">GIFT NIFTY</div>
              <div className="text-xs font-extrabold text-white mt-0.5">{telemetry.giftNifty.price.toLocaleString()}</div>
            </div>
            <div className={`text-[11px] font-bold mt-1 ${telemetry.giftNifty.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {telemetry.giftNifty.change >= 0 ? '+' : ''}{telemetry.giftNifty.change.toFixed(1)} ({telemetry.giftNifty.changePercent >= 0 ? '+' : ''}{telemetry.giftNifty.changePercent}%)
            </div>
          </div>

          {/* 2. S&P 500 Futures */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase block truncate font-sans">S&P 500 FUT</div>
              <div className="text-xs font-extrabold text-white mt-0.5">{telemetry.sp500Futures.price.toLocaleString()}</div>
            </div>
            <div className={`text-[11px] font-bold mt-1 ${telemetry.sp500Futures.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {telemetry.sp500Futures.changePercent >= 0 ? '+' : ''}{telemetry.sp500Futures.changePercent}%
            </div>
          </div>

          {/* 3. Nasdaq Futures */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase block truncate font-sans">NASDAQ FUT</div>
              <div className="text-xs font-extrabold text-white mt-0.5">{telemetry.nasdaqFutures.price.toLocaleString()}</div>
            </div>
            <div className={`text-[11px] font-bold mt-1 ${telemetry.nasdaqFutures.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {telemetry.nasdaqFutures.changePercent >= 0 ? '+' : ''}{telemetry.nasdaqFutures.changePercent}%
            </div>
          </div>

          {/* 4. USD / INR */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase block truncate font-sans">USD / INR</div>
              <div className="text-xs font-extrabold text-white mt-0.5">₹{telemetry.usdInr.price.toFixed(2)}</div>
            </div>
            <div className={`text-[11px] font-bold mt-1 ${telemetry.usdInr.changePercent <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {telemetry.usdInr.changePercent >= 0 ? '+' : ''}{telemetry.usdInr.changePercent}%
            </div>
          </div>

          {/* 5. Dollar Index DXY */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase block truncate font-sans">DXY INDEX</div>
              <div className="text-xs font-extrabold text-white mt-0.5">{telemetry.dxyIndex.price.toFixed(2)}</div>
            </div>
            <div className={`text-[11px] font-bold mt-1 ${telemetry.dxyIndex.changePercent <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {telemetry.dxyIndex.changePercent >= 0 ? '+' : ''}{telemetry.dxyIndex.changePercent}%
            </div>
          </div>

          {/* 6. Brent Crude */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase block truncate font-sans">BRENT CRUDE</div>
              <div className="text-xs font-extrabold text-white mt-0.5">${telemetry.brentCrude.price.toFixed(2)}</div>
            </div>
            <div className={`text-[11px] font-bold mt-1 ${telemetry.brentCrude.changePercent <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {telemetry.brentCrude.changePercent >= 0 ? '+' : ''}{telemetry.brentCrude.changePercent}%
            </div>
          </div>

          {/* 7. US 10Y Yield */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase block truncate font-sans">US 10Y YIELD</div>
              <div className="text-xs font-extrabold text-white mt-0.5">{telemetry.us10yYield.price.toFixed(2)}%</div>
            </div>
            <div className={`text-[11px] font-bold mt-1 ${telemetry.us10yYield.changePercent <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {telemetry.us10yYield.changePercent >= 0 ? '+' : ''}{telemetry.us10yYield.changePercent}%
            </div>
          </div>

          {/* 8. Nikkei 225 */}
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="text-[10px] text-slate-400 font-bold uppercase block truncate font-sans">NIKKEI 225</div>
              <div className="text-xs font-extrabold text-white mt-0.5">{telemetry.nikkei225.price.toLocaleString()}</div>
            </div>
            <div className={`text-[11px] font-bold mt-1 ${telemetry.nikkei225.changePercent >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {telemetry.nikkei225.changePercent >= 0 ? '+' : ''}{telemetry.nikkei225.changePercent}%
            </div>
          </div>
        </div>

        {/* Global Summary Insight */}
        <div className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 leading-relaxed font-sans">
          <strong className="text-sky-400 mr-1.5 font-mono uppercase">Inter-Market Synthesis:</strong>
          {telemetry.summaryInsight}
        </div>
      </div>

      {/* SECTION 2: VOLUME DYNAMICS & INSTITUTIONAL BUILDUP MATRIX */}
      {volumeAnalytics && (
        <div className="rounded-xl border border-emerald-500/30 bg-slate-950/90 p-4 shadow-lg space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                <BarChart2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Volume Dynamics & Institutional Buildup</span>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    High Precision
                  </span>
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Contract volume vs 20MA baseline, Call/Put buyer flow, and Order Flow Delta pressure
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 font-mono">
              <span className="text-xs text-slate-400">Accuracy Multiplier:</span>
              <span className="px-2.5 py-1 rounded text-xs font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                {volumeAnalytics.volumeAccuracyMultiplier}x
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
            {/* 1. Volume Multiplier vs 20MA */}
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-bold uppercase font-sans mb-1">Volume Surge Factor</div>
              <div className="text-lg font-extrabold text-white">
                {volumeAnalytics.totalVolumeMultiplier}x <span className="text-xs text-slate-400 font-normal">vs 20MA</span>
              </div>
              <p className="text-[11px] text-emerald-400 mt-1">
                {volumeAnalytics.totalVolumeMultiplier >= 1.4 ? '🔥 Institutional Volume Spike' : 'Normal Volume Flow'}
              </p>
            </div>

            {/* 2. Order Flow Delta Pressure */}
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-bold uppercase font-sans mb-1">Order Flow Delta Imbalance</div>
              <div className={`text-lg font-extrabold ${volumeAnalytics.buyerSellerPressureDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {volumeAnalytics.buyerSellerPressureDelta >= 0 ? '+' : ''}{volumeAnalytics.buyerSellerPressureDelta}%
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {volumeAnalytics.buyerSellerPressureDelta >= 10 ? 'Buyers Aggressive' : volumeAnalytics.buyerSellerPressureDelta <= -10 ? 'Sellers Aggressive' : 'Balanced Flow'}
              </p>
            </div>

            {/* 3. Buildup Classification */}
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-bold uppercase font-sans mb-1">Institutional Buildup</div>
              <div className="text-sm font-extrabold text-amber-300">
                {volumeAnalytics.volumeBuildupLabel}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {volumeAnalytics.volumeDivergence.replace(/_/g, ' ')}
              </p>
            </div>

            {/* 4. PCR Volume vs PCR OI */}
            <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800">
              <div className="text-[11px] text-slate-400 font-bold uppercase font-sans mb-1">PCR Volume / OI</div>
              <div className="text-sm font-extrabold text-sky-300">
                Vol PCR: {volumeAnalytics.pcrVolume} | OI PCR: {volumeAnalytics.pcrOI}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {volumeAnalytics.pcrVolume > volumeAnalytics.pcrOI ? 'Intraday Put Buying Surge' : 'Intraday Call Buying Surge'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: 6 QUANTITATIVE METRICS GRID */}
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
                  {rsi.divergence.replace(/_/g, ' ')}
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
                {macd.trend.replace(/_/g, ' ')}
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
                {gammaExposure.regime.replace(/_/g, ' ')}
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
              <span>Order Flow: {orderFlow.sentiment.replace(/_/g, ' ')}</span>
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
