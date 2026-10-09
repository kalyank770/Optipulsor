import React, { useState } from 'react';
import { 
  TickerConfig, 
  OptionType, 
  Candle,
  TradeSignal,
  MultiTimeframeChartPatterns
} from '../types/options';
import { 
  MultiTimeframePredictionSuite, 
  HTFCandlePatternResult, 
  HorizonPrediction, 
  ExpiryForecast 
} from '../types/htfPredictions';
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Target, 
  Layers,
  Calculator,
  Lock,
  ArrowRight,
  Clock,
  BarChart2,
  Activity,
  Flame,
  Zap,
  Compass
} from 'lucide-react';

interface HTFPredictionsWorkstationProps {
  predictions: MultiTimeframePredictionSuite;
  ticker: TickerConfig;
  signal?: TradeSignal;
  candleAnalysis?: MultiTimeframeChartPatterns;
  onSelectContractForSimulation?: (strike: number, type: OptionType) => void;
}

type ActiveViewFilter = 'candlesticks' | 'expiries' | 'horizons';

/**
 * Clean Mini Candlestick Visualizer for Beginners & Pros
 */
function MiniCandleChart({ candles, resistance, support, ema20 }: { 
  candles: Candle[]; 
  resistance: number; 
  support: number;
  ema20: number;
}) {
  if (!candles || candles.length === 0) return null;
  const minPrice = Math.min(...candles.map(c => c.low), support);
  const maxPrice = Math.max(...candles.map(c => c.high), resistance);
  const priceRange = Math.max(0.1, maxPrice - minPrice);

  const getY = (val: number) => {
    return Math.max(5, Math.min(95, 100 - ((val - minPrice) / priceRange) * 100));
  };

  return (
    <div className="w-full bg-slate-950/90 rounded-xl p-3 border border-slate-800">
      <div className="flex items-center justify-between text-[11px] font-mono mb-2">
        <span className="text-rose-400 font-semibold">🔴 Resistance: ₹{resistance.toLocaleString()}</span>
        <span className="text-amber-400 font-semibold">🟡 20 EMA: ₹{ema20.toLocaleString()}</span>
        <span className="text-emerald-400 font-semibold">🟢 Support: ₹{support.toLocaleString()}</span>
      </div>

      <div className="relative h-28 w-full flex items-end justify-between gap-1 pt-2 pb-1">
        {/* Resistance ceiling line */}
        <div 
          className="absolute left-0 right-0 border-t border-dashed border-rose-500/50 z-0 pointer-events-none"
          style={{ top: `${getY(resistance)}%` }}
        />
        {/* Support floor line */}
        <div 
          className="absolute left-0 right-0 border-t border-dashed border-emerald-500/50 z-0 pointer-events-none"
          style={{ top: `${getY(support)}%` }}
        />
        {/* 20 EMA trend line */}
        <div 
          className="absolute left-0 right-0 border-t border-amber-500/60 z-0 pointer-events-none"
          style={{ top: `${getY(ema20)}%` }}
        />

        {candles.map((candle, idx) => {
          const isGreen = candle.close >= candle.open;
          const highY = getY(candle.high);
          const lowY = getY(candle.low);
          const openY = getY(candle.open);
          const closeY = getY(candle.close);
          const bodyTop = Math.min(openY, closeY);
          const bodyHeight = Math.max(3, Math.abs(openY - closeY));
          const wickHeight = Math.max(3, lowY - highY);

          return (
            <div 
              key={idx} 
              className="relative flex-1 h-full flex items-center justify-center group cursor-pointer"
              title={`${candle.time} | Open: ₹${candle.open} High: ₹${candle.high} Low: ₹${candle.low} Close: ₹${candle.close}`}
            >
              {/* Wick */}
              <div 
                className={`absolute w-[1.5px] ${isGreen ? 'bg-emerald-400' : 'bg-rose-400'}`}
                style={{
                  top: `${highY}%`,
                  height: `${wickHeight}%`
                }}
              />
              {/* Body */}
              <div 
                className={`absolute w-full max-w-[9px] rounded-[2px] ${
                  isGreen ? 'bg-emerald-500 border border-emerald-400' : 'bg-rose-500 border border-rose-400'
                }`}
                style={{
                  top: `${bodyTop}%`,
                  height: `${bodyHeight}%`
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1.5 border-t border-slate-800">
        <span>Earliest: {candles[0]?.time}</span>
        <span className="text-white font-bold">Current Spot: ₹{candles[candles.length - 1]?.close.toLocaleString()}</span>
        <span>Latest: {candles[candles.length - 1]?.time}</span>
      </div>
    </div>
  );
}

export function HTFPredictionsWorkstation({
  predictions,
  ticker,
  signal,
  candleAnalysis,
  onSelectContractForSimulation
}: HTFPredictionsWorkstationProps) {
  const [activeFilter, setActiveFilter] = useState<ActiveViewFilter>('candlesticks');

  const candleData = candleAnalysis || signal?.candleAnalysis;

  const {
    h1Pattern,
    d1Pattern,
    w1Pattern,
    next1Hour,
    next1Day,
    next1Week,
    week1Expiry,
    week2Expiry,
    overallHTFBias,
    confluenceScore
  } = predictions;

  const isBullish = overallHTFBias.includes('BULLISH');
  const isBearish = overallHTFBias.includes('BEARISH');

  return (
    <div className="space-y-4 sm:space-y-6 animate-fade-in pb-12">
      {/* 1. MASTER PREDICTION SUMMARY & NAVIGATION CONTROLS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <span>Multi-Timeframe Candlestick &amp; Expiries Workstation</span>
              </h2>
              
              <div className={`px-3 py-1 rounded-lg text-xs font-bold font-mono border flex items-center gap-1.5 ${
                isBullish ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/50 shadow-sm' :
                isBearish ? 'bg-rose-950/70 text-rose-300 border-rose-500/50 shadow-sm' :
                'bg-amber-950/60 text-amber-300 border-amber-500/40'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isBullish ? 'bg-emerald-400 animate-pulse' : isBearish ? 'bg-rose-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>Overall Trend: {overallHTFBias.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter Switcher Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
          {[
            { id: 'candlesticks', label: '🕯️ Candlestick Momentum' },
            { id: 'expiries', label: '🔮 Next 2 Expiries Predictions' },
            { id: 'horizons', label: '⏱️ 1H · 1D · 1W Horizons' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id as ActiveViewFilter)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                activeFilter === tab.id
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. GROUPED CANDLESTICK MOMENTUM ENGINE (2M · 5M · 15M · 1H · 1D · 1W) */}
      {activeFilter === 'candlesticks' && (
        <div className="space-y-4 animate-fade-in">
          {/* A. Intraday Candlestick Momentum Engine (2M · 5M · 15M) */}
          {candleData && (
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                      <span>Intraday Candlestick Momentum Engine (2m · 5m · 15m)</span>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      Micro-triggers, tactical swings, structural anchors &amp; pattern confluence
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <div className="px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 shadow-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Exchange Feed: NSE Real OHLCV Stream</span>
                  </div>
                  <span className={`font-bold px-2.5 py-1 rounded-lg text-xs border ${
                    candleData.confluenceBias === 'BULLISH'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                      : candleData.confluenceBias === 'BEARISH'
                      ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/10'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  }`}>
                    {candleData.momentumAlignment?.replace(/_/g, ' ') || candleData.confluenceBias} ({candleData.confluenceScore > 0 ? '+' : ''}{candleData.confluenceScore}/10)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                {/* 2-Minute Candle Momentum Analysis */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
                      <span className="text-sky-400 font-bold flex items-center gap-1.5">
                        <span>2-Min Micro Trigger</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                        (candleData.m2Score ?? candleData.m2.momentumScore) > 0 ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' :
                        (candleData.m2Score ?? candleData.m2.momentumScore) < 0 ? 'text-rose-400 bg-rose-500/15 border border-rose-500/30' : 'text-slate-400 bg-slate-800'
                      }`}>
                        {(candleData.m2Score ?? candleData.m2.momentumScore) > 0 ? '+' : ''}
                        {(candleData.m2Score ?? candleData.m2.momentumScore)}/10
                      </span>
                    </div>
                    
                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2.5">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          (candleData.m2Score ?? candleData.m2.momentumScore) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(10, Math.abs(candleData.m2Score ?? candleData.m2.momentumScore) * 10))}%` }}
                      />
                    </div>

                    <div className="font-bold text-slate-200 text-xs mb-2">
                      {candleData?.m2?.pattern?.replace(/2m\s*/, '') || 'Consolidation Range'}
                    </div>

                    {/* Visual 2M Mini Candle Chart */}
                    {candleData?.m2?.candles && candleData.m2.candles.length > 0 && (
                      <div className="mb-2">
                        <MiniCandleChart 
                          candles={candleData.m2.candles}
                          resistance={candleData.m2.resistance}
                          support={candleData.m2.support}
                          ema20={Number(((candleData.m2.support + candleData.m2.resistance) / 2).toFixed(2))}
                        />
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-2.5 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Support: <strong className="text-slate-200">{ticker.currency}{candleData?.m2?.support?.toLocaleString()}</strong></span>
                    <span>Resist: <strong className="text-slate-200">{ticker.currency}{candleData?.m2?.resistance?.toLocaleString()}</strong></span>
                  </div>
                </div>

                {/* 5-Minute Candle Momentum Analysis */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
                      <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                        <span>5-Min Tactical Trend</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                        (candleData?.m5Score ?? candleData?.m5?.momentumScore ?? 0) > 0 ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' :
                        (candleData?.m5Score ?? candleData?.m5?.momentumScore ?? 0) < 0 ? 'text-rose-400 bg-rose-500/15 border border-rose-500/30' : 'text-slate-400 bg-slate-800'
                      }`}>
                        {(candleData?.m5Score ?? candleData?.m5?.momentumScore ?? 0) > 0 ? '+' : ''}
                        {(candleData?.m5Score ?? candleData?.m5?.momentumScore ?? 0)}/10
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2.5">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          (candleData?.m5Score ?? candleData?.m5?.momentumScore ?? 0) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(10, Math.abs(candleData?.m5Score ?? candleData?.m5?.momentumScore ?? 0) * 10))}%` }}
                      />
                    </div>

                    <div className="font-bold text-slate-200 text-xs mb-2">
                      {candleData?.m5?.pattern?.replace(/5m\s*/, '') || 'Tactical Alignment'}
                    </div>

                    {/* Visual 5M Mini Candle Chart */}
                    {candleData?.m5?.candles && candleData.m5.candles.length > 0 && (
                      <div className="mb-2">
                        <MiniCandleChart 
                          candles={candleData.m5.candles}
                          resistance={candleData.m5.resistance}
                          support={candleData.m5.support}
                          ema20={Number(((candleData.m5.support + candleData.m5.resistance) / 2).toFixed(2))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Swing Exit Target: <strong className="text-emerald-400">{ticker.currency}{candleData?.derivedExitLevel1?.toLocaleString()}</strong></span>
                    <span>ATR: <strong className="text-slate-300">{candleData?.m5?.atr} pts</strong></span>
                  </div>
                </div>

                {/* 15-Minute Candle Momentum Analysis */}
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/90 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-2">
                      <span className="text-amber-400 font-bold flex items-center gap-1.5">
                        <span>15-Min Structure Anchor</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold font-mono ${
                        (candleData?.m15Score ?? candleData?.m15?.momentumScore ?? 0) > 0 ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' :
                        (candleData?.m15Score ?? candleData?.m15?.momentumScore ?? 0) < 0 ? 'text-rose-400 bg-rose-500/15 border border-rose-500/30' : 'text-slate-400 bg-slate-800'
                      }`}>
                        {(candleData?.m15Score ?? candleData?.m15?.momentumScore ?? 0) > 0 ? '+' : ''}
                        {(candleData?.m15Score ?? candleData?.m15?.momentumScore ?? 0)}/10
                      </span>
                    </div>

                    <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2.5">
                      <div 
                        className={`h-full transition-all duration-500 ${
                          (candleData?.m15Score ?? candleData?.m15?.momentumScore ?? 0) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(10, Math.abs(candleData?.m15Score ?? candleData?.m15?.momentumScore ?? 0) * 10))}%` }}
                      />
                    </div>

                    <div className="font-bold text-slate-200 text-xs mb-2">
                      {candleData?.m15?.pattern?.replace(/15m\s*/, '') || 'Structural Support'}
                    </div>

                    {/* Visual 15M Mini Candle Chart */}
                    {candleData?.m15?.candles && candleData.m15.candles.length > 0 && (
                      <div className="mb-2">
                        <MiniCandleChart 
                          candles={candleData.m15.candles}
                          resistance={candleData.m15.resistance}
                          support={candleData.m15.support}
                          ema20={Number(((candleData.m15.support + candleData.m15.resistance) / 2).toFixed(2))}
                        />
                      </div>
                    )}
                  </div>

                  <div className="pt-2.5 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-center justify-between">
                    <span>Runner Exit Target: <strong className="text-sky-400">{ticker.currency}{candleData?.derivedExitLevel2?.toLocaleString()}</strong></span>
                    <span>ATR: <strong className="text-slate-300">{candleData?.m15?.atr} pts</strong></span>
                  </div>
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-800/70 text-[11.5px] text-slate-400 flex flex-wrap items-center justify-between gap-2 font-mono">
                <span>Pattern Confluence: <strong className="text-slate-200 font-semibold">{candleData.confluencePattern}</strong></span>
                <span>
                  Pattern Invalidation Stop: <strong className="text-rose-400">{ticker.currency}{candleData.invalidationLevel.toLocaleString()}</strong>
                </span>
              </div>
            </div>
          )}

          {/* B. High-Timeframe Candlestick Charts & Levels (1H · 1D · 1W) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-400" />
                Higher Timeframe Candlestick Charts &amp; Levels (1H · 1D · 1W)
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Visual Pattern Gauges &amp; Trend Lines
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {[h1Pattern, d1Pattern, w1Pattern].map((p: HTFCandlePatternResult) => {
                const isPBull = p.patternBias === 'BULLISH';
                const isPBear = p.patternBias === 'BEARISH';
                return (
                  <div 
                    key={p.timeframe}
                    className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-3.5 shadow-md"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5 font-mono text-xs">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 font-bold uppercase">
                            {p.timeframe.toUpperCase()}
                          </span>
                          <span className="text-slate-400 font-semibold">{p.timeframeLabel}</span>
                        </div>
                        <span className={`text-xs font-mono font-bold ${
                          isPBull ? 'text-emerald-400' : isPBear ? 'text-rose-400' : 'text-slate-300'
                        }`}>
                          {p.patternBias} ({p.patternConfidence}%)
                        </span>
                      </div>

                      <div className="font-bold text-white text-sm">
                        {p.primaryPattern}
                      </div>

                      <p className="text-slate-400 text-xs leading-relaxed">
                        {p.patternDescription}
                      </p>
                    </div>

                    {/* Mini Candlestick visualizer */}
                    <MiniCandleChart 
                      candles={p.candles} 
                      resistance={p.resistanceLevel} 
                      support={p.supportLevel} 
                      ema20={p.ema20} 
                    />

                    {/* Technical Key Numbers */}
                    <div className="grid grid-cols-3 gap-2 font-mono text-xs pt-1.5 border-t border-slate-800 text-center">
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">RSI Strength</span>
                        <strong className={p.rsi >= 60 ? 'text-emerald-400' : p.rsi <= 40 ? 'text-rose-400' : 'text-slate-300'}>
                          {p.rsi}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">20 EMA</span>
                        <strong className="text-amber-300">
                          ₹{p.ema20.toLocaleString()}
                        </strong>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-sans">ATR Range</span>
                        <strong className="text-sky-400">
                          {p.atr} pts
                        </strong>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 2. COMING 2 EXPIRIES PREDICTIONS (NEXT 2 EXPIRIES VIEW) */}
      {activeFilter === 'expiries' && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-emerald-400" />
              Coming 2 Expiries Predictions (Where the Trend Will Go &amp; What To Trade)
            </span>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
              Synthesized from 1H · 1D · 1W Patterns
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[week1Expiry, week2Expiry].map((e: ExpiryForecast) => {
              const isWeek1 = e.expiryType === 'NEXT_1_WEEK';
              const isCE = e.recommendedType === 'CE';
              const isExpBull = e.trendDirection === 'BULLISH_EXPANSION';
              const isExpBear = e.trendDirection === 'BEARISH_BREAKDOWN';

              return (
                <div 
                  key={e.expiryType}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 flex flex-col justify-between shadow-xl"
                >
                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base sm:text-lg font-bold text-white">
                            {isWeek1 ? '1. This Week Expiry' : '2. Next Week Expiry'}
                          </span>
                          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-emerald-300 border border-slate-700">
                            {e.daysToExpiry} {e.daysToExpiry === 1 ? 'Day' : 'Days'} Left ({e.expiryDateStr})
                          </span>
                        </div>
                        <div className="text-xs font-mono font-bold mt-1 flex items-center gap-1.5">
                          <span>Trend Outcome:</span>
                          <span className={isExpBull ? 'text-emerald-400' : isExpBear ? 'text-rose-400' : 'text-amber-300'}>
                            {e.trendDirectionLabel}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 uppercase font-mono block">Win Rate</span>
                        <span className="text-sm font-bold text-emerald-400 font-mono">{e.winProbability}%</span>
                      </div>
                    </div>

                    {/* Chart Analysis Rationale */}
                    <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed bg-slate-950 p-3 rounded-xl border border-slate-800/80">
                      <strong>Why this trade:</strong> {e.candleSynthesisRationale}
                    </p>

                    {/* Projected Target & Key Level Box */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block font-sans">Projected Settlement Spot</span>
                        <strong className="text-white text-base">₹{e.projectedSettlementSpot.toLocaleString()}</strong>
                        <span className="text-[10px] text-slate-500 block">Range: ₹{e.expectedSettlementRange[0]} - ₹{e.expectedSettlementRange[1]}</span>
                      </div>
                      <div className="border-l border-slate-800 pl-3">
                        <span className="text-[10px] text-slate-400 uppercase block font-sans">Max Pain Magnet Strike</span>
                        <strong className="text-amber-400 text-base">₹{e.maxPainStrike.toLocaleString()}</strong>
                        <span className="text-[10px] text-slate-500 block">PCR: {e.expectedPCR}</span>
                      </div>
                    </div>

                    {/* EXACT F&O CONTRACT TO BUY */}
                    <div className="p-4 rounded-xl bg-slate-950 border-2 border-emerald-500/40 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider font-mono">
                            ★ Recommended Action
                          </span>
                          <div className="text-base sm:text-lg font-black text-white font-mono flex items-center gap-2">
                            <span>BUY {ticker.symbol} {e.recommendedStrike} {e.recommendedType}</span>
                            <span className={`text-xs px-2 py-0.5 rounded font-bold ${
                              isCE ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}>
                              {e.recommendedType}
                            </span>
                          </div>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-[10px] text-slate-400 block font-sans">Option Premium</span>
                          <strong className="text-lg text-white">₹{e.contractLTP}</strong>
                        </div>
                      </div>

                      {/* Entry, Target 1, Target 2, Stop Loss */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-xs font-mono text-center">
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-sans">Safe Entry Zone</span>
                          <strong className="text-sky-300">₹{e.entryZone[0]} - ₹{e.entryZone[1]}</strong>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-sans">Target 1 (+{e.projectedROI}%)</span>
                          <strong className="text-emerald-400">₹{e.target1}</strong>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800">
                          <span className="text-[10px] text-slate-400 block font-sans">Target 2 (Runner)</span>
                          <strong className="text-emerald-300">₹{e.target2}</strong>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-900 border border-rose-950/60">
                          <span className="text-[10px] text-slate-400 block font-sans">Strict Stop Loss</span>
                          <strong className="text-rose-400">₹{e.stopLoss}</strong>
                        </div>
                      </div>

                      {/* Support & Resistance */}
                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 pt-1">
                        <span>Floor Support: <strong className="text-emerald-400">₹{e.supportFloor.toLocaleString()}</strong></span>
                        <span>·</span>
                        <span>Ceiling Resistance: <strong className="text-rose-400">₹{e.resistanceCeiling.toLocaleString()}</strong></span>
                      </div>
                    </div>

                    {/* Simple Beginner Rules to Protect Money */}
                    <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-1.5">
                      <div className="text-rose-400 font-bold text-xs flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5" />
                        <span>Rules to Protect Your Real Capital:</span>
                      </div>
                      <ul className="space-y-1 text-xs text-slate-300">
                        <li className="flex items-start gap-1.5 text-[11.5px] leading-snug">
                          <span className="text-rose-400 font-bold">•</span>
                          <span><strong>1. Entry Price:</strong> Buy only between ₹{e.entryZone[0]} and ₹{e.entryZone[1]}. Never buy if price has already jumped higher.</span>
                        </li>
                        <li className="flex items-start gap-1.5 text-[11.5px] leading-snug">
                          <span className="text-rose-400 font-bold">•</span>
                          <span><strong>2. Lock In Profits:</strong> When price reaches Target 1 (₹{e.target1}), sell half your lots and move your Stop Loss to your buy price to guarantee a risk-free trade.</span>
                        </li>
                        <li className="flex items-start gap-1.5 text-[11.5px] leading-snug">
                          <span className="text-rose-400 font-bold">•</span>
                          <span><strong>3. Strict Exit:</strong> If price falls to ₹{e.stopLoss}, exit immediately to avoid big losses.</span>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {onSelectContractForSimulation && (
                    <button
                      onClick={() => onSelectContractForSimulation(e.recommendedStrike, e.recommendedType)}
                      className="w-full mt-3 py-2.5 px-4 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Calculator className="w-4 h-4" />
                      <span>Simulate {e.recommendedStrike} {e.recommendedType} Payoff in Profit Calculator</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. FORWARD HORIZONS (NEXT 1-HOUR, NEXT 1-DAY, NEXT 1-WEEK OUTCOMES) */}
      {activeFilter === 'horizons' && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              Time Horizon Outcomes (Next 1-Hour, Next 1-Day, Next 1-Week)
            </span>
            <span className="text-[11px] font-mono text-slate-400">
              Clear Price Targets &amp; Strikes
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {[next1Hour, next1Day, next1Week].map((h: HorizonPrediction) => {
              const isHBull = h.predictedBias === 'BULLISH';
              const isHBear = h.predictedBias === 'BEARISH';
              return (
                <div 
                  key={h.horizon}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3.5 flex flex-col justify-between shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white font-mono">
                        {h.horizonLabel}
                      </span>
                      <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                        isHBull ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40' :
                        isHBear ? 'bg-rose-950/60 text-rose-300 border-rose-500/40' :
                        'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        {h.predictedBias} ({h.confidenceScore}%)
                      </span>
                    </div>

                    {/* Spot Target */}
                    <div className="p-3 rounded-xl bg-slate-950 font-mono">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-400 font-sans">Projected Price:</span>
                        <strong className="text-white text-base">₹{h.projectedSpotTarget.toLocaleString()}</strong>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                        <span>Expected Move:</span>
                        <strong className={isHBull ? 'text-emerald-400' : isHBear ? 'text-rose-400' : 'text-slate-300'}>
                          {isHBull ? '+' : isHBear ? '-' : '±'}{h.expectedMovePoints} pts ({h.expectedMovePercent}%)
                        </strong>
                      </div>
                    </div>

                    {/* Suggested Trade */}
                    <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/30 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase text-slate-400 font-bold">Suggested Option</span>
                        <strong className="text-emerald-400 font-mono text-sm">BUY {h.recommendedStrike} {h.recommendedType}</strong>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 font-mono text-center pt-1 border-t border-slate-800">
                        <div>
                          <span className="text-[9px] text-slate-400 block font-sans">Buy Price</span>
                          <strong className="text-white">₹{h.recommendedContractLTP}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block font-sans">Target</span>
                          <strong className="text-emerald-400">₹{h.target1LTP}</strong>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block font-sans">Stop Loss</span>
                          <strong className="text-rose-400">₹{h.stopLossLTP}</strong>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-slate-300 leading-snug">
                      <strong>How to trade:</strong> {h.executionAdvice}
                    </p>
                  </div>

                  {onSelectContractForSimulation && (
                    <button
                      onClick={() => onSelectContractForSimulation(h.recommendedStrike, h.recommendedType)}
                      className="w-full mt-2 py-2 px-3 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Calculator className="w-3.5 h-3.5" />
                      <span>Simulate in Calculator</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}


    </div>
  );
}
