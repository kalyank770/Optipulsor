import React from 'react';
import { 
  Gauge, 
  Activity, 
  Zap, 
  TrendingUp, 
  TrendingDown,
  ShieldAlert, 
  BarChart2, 
  Globe,
  Sliders,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Compass
} from 'lucide-react';
import { RealtimePredictionIndicators, InterMarketTelemetry, OptionChainRow } from '../types/options';
import { getInterMarketTelemetry } from '../data/globalMacroData';

interface RealtimeQuantSectionProps {
  indicators?: RealtimePredictionIndicators;
  interMarketTelemetry?: InterMarketTelemetry;
  currency?: string;
  tickerSymbol?: string;
  chain?: OptionChainRow[];
  spotPrice?: number;
}

export const RealtimeQuantSection: React.FC<RealtimeQuantSectionProps> = ({
  indicators,
  interMarketTelemetry,
  currency = '₹',
  tickerSymbol = 'NIFTY 50',
  chain = [],
  spotPrice = 22716.20,
}) => {
  const telemetry = interMarketTelemetry || getInterMarketTelemetry(tickerSymbol);

  // --- IV SURFACE & MISPRICING IDENTIFIER ENGINE ---
  const currentSpot = spotPrice || 22716.20;

  // Extract near-ATM strikes (up to 9 rows)
  const surfaceRows = React.useMemo(() => {
    if (!chain || chain.length === 0) return [];
    const sorted = [...chain].sort((a, b) => Math.abs(a.strike - currentSpot) - Math.abs(b.strike - currentSpot));
    const nearAtm = sorted.slice(0, 9).sort((a, b) => a.strike - b.strike);
    return nearAtm;
  }, [chain, currentSpot]);

  // Compute baseline ATM IV
  const atmIvBaseline = React.useMemo(() => {
    if (surfaceRows.length === 0) return 12.5;
    const atmRow = surfaceRows.reduce((prev, curr) => 
      Math.abs(curr.strike - currentSpot) < Math.abs(prev.strike - currentSpot) ? curr : prev
    );
    return Number(((atmRow.ce.iv + atmRow.pe.iv) / 2).toFixed(1));
  }, [surfaceRows, currentSpot]);

  // Derive mispricing spectrum across options
  const mispricedOptions = React.useMemo(() => {
    if (surfaceRows.length === 0) return [];

    const list: Array<{
      strike: number;
      type: 'CE' | 'PE';
      ltp: number;
      iv: number;
      ivVsAtmPct: number;
      pricingTag: 'OVERPRICED' | 'UNDERPRICED' | 'FAIR_VALUE';
      mispricingRatio: number;
      tradingAction: string;
    }> = [];

    surfaceRows.forEach(row => {
      // Call Option
      const ceIvDiff = Number((((row.ce.iv - atmIvBaseline) / atmIvBaseline) * 100).toFixed(1));
      let ceTag: 'OVERPRICED' | 'UNDERPRICED' | 'FAIR_VALUE' = 'FAIR_VALUE';
      if (ceIvDiff > 10) ceTag = 'OVERPRICED';
      else if (ceIvDiff < -10) ceTag = 'UNDERPRICED';

      list.push({
        strike: row.strike,
        type: 'CE',
        ltp: row.ce.ltp,
        iv: row.ce.iv,
        ivVsAtmPct: ceIvDiff,
        pricingTag: ceTag,
        mispricingRatio: Number((row.ce.iv / Math.max(1, atmIvBaseline)).toFixed(2)),
        tradingAction: ceTag === 'UNDERPRICED' 
          ? '⚡ High Leverage Buy Opportunity (Cheap IV)' 
          : ceTag === 'OVERPRICED' 
          ? '🔥 High Vol Premium (Credit Spread Sell / Avoid Buy)' 
          : 'Fair Market Value',
      });

      // Put Option
      const peIvDiff = Number((((row.pe.iv - atmIvBaseline) / atmIvBaseline) * 100).toFixed(1));
      let peTag: 'OVERPRICED' | 'UNDERPRICED' | 'FAIR_VALUE' = 'FAIR_VALUE';
      if (peIvDiff > 10) peTag = 'OVERPRICED';
      else if (peIvDiff < -10) peTag = 'UNDERPRICED';

      list.push({
        strike: row.strike,
        type: 'PE',
        ltp: row.pe.ltp,
        iv: row.pe.iv,
        ivVsAtmPct: peIvDiff,
        pricingTag: peTag,
        mispricingRatio: Number((row.pe.iv / Math.max(1, atmIvBaseline)).toFixed(2)),
        tradingAction: peTag === 'UNDERPRICED' 
          ? '⚡ High Leverage Buy Opportunity (Cheap IV)' 
          : peTag === 'OVERPRICED' 
          ? '🔥 High Vol Premium (Credit Spread Sell / Avoid Buy)' 
          : 'Fair Market Value',
      });
    });

    return list;
  }, [surfaceRows, atmIvBaseline]);

  const underpricedPicks = mispricedOptions.filter(o => o.pricingTag === 'UNDERPRICED').sort((a, b) => a.ivVsAtmPct - b.ivVsAtmPct).slice(0, 3);
  const overpricedPicks = mispricedOptions.filter(o => o.pricingTag === 'OVERPRICED').sort((a, b) => b.ivVsAtmPct - a.ivVsAtmPct).slice(0, 3);

  if (!indicators) {
    return (
      <div className="bg-slate-950/80 p-6 rounded-lg border border-slate-800 text-center text-slate-400 text-xs font-mono">
        Quantitative telemetry & volume dynamics generating real-time stream...
      </div>
    );
  }

  const { vwap, rsi, macd, ema, gammaExposure, orderFlow, vixVelocity, volumeAnalytics } = indicators;

  return (
    <div className="space-y-4 pt-1 font-sans">
      {/* 6 HIGH-DENSITY CORE QUANTITATIVE GAUGES */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* 1. VWAP Level */}
        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between min-h-[64px]">
          <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">VWAP Level</span>
          <span className="text-sm font-extrabold font-mono text-white mt-0.5">
            {currency}{vwap.value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
          </span>
          <span className={`text-[10px] font-mono font-bold ${vwap.bias === 'BULLISH' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {vwap.bias}
          </span>
        </div>

        {/* 2. RSI */}
        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between min-h-[64px]">
          <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">RSI (14)</span>
          <span className="text-sm font-extrabold font-mono text-sky-300 mt-0.5">
            {rsi.value.toFixed(1)}
          </span>
          <span className="text-[10px] font-mono text-slate-400 truncate">
            {rsi.condition}
          </span>
        </div>

        {/* 3. MACD */}
        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between min-h-[64px]">
          <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">MACD Hist</span>
          <span className={`text-sm font-extrabold font-mono mt-0.5 ${macd.histogram >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {macd.histogram > 0 ? `+${macd.histogram.toFixed(1)}` : macd.histogram.toFixed(1)}
          </span>
          <span className="text-[10px] font-mono text-slate-400 truncate">
            {macd.trend?.replace(/_/g, ' ') || 'NEUTRAL'}
          </span>
        </div>

        {/* 4. EMA spread */}
        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between min-h-[64px]">
          <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">EMA Spread</span>
          <span className={`text-sm font-extrabold font-mono mt-0.5 ${ema.spread >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {ema.spread > 0 ? `+${ema.spread.toFixed(1)}` : ema.spread.toFixed(1)}
          </span>
          <span className="text-[10px] font-mono text-slate-400 truncate">
            {ema.alignment}
          </span>
        </div>

        {/* 5. Gamma */}
        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between min-h-[64px]">
          <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">Gamma GEX</span>
          <span className="text-sm font-extrabold font-mono text-purple-300 mt-0.5">
            {gammaExposure.netGex > 0 ? `+${(gammaExposure.netGex / 1000000).toFixed(1)}M` : `${(gammaExposure.netGex / 1000000).toFixed(1)}M`}
          </span>
          <span className="text-[10px] font-mono text-slate-400 truncate">
            {gammaExposure.regime?.replace(/_GAMMA/g, '') || 'BALANCED'}
          </span>
        </div>

        {/* 6. VIX */}
        <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 flex flex-col justify-between min-h-[64px]">
          <span className="text-[10px] text-slate-400 font-bold uppercase font-sans">VIX Volatility</span>
          <span className="text-sm font-extrabold font-mono text-amber-300 mt-0.5">
            {vixVelocity.vix.toFixed(2)}
          </span>
          <span className="text-[10px] font-mono text-slate-400 truncate">
            {orderFlow.sentiment?.replace(/_DOMINANCE/g, ' DOM') || 'BALANCED'}
          </span>
        </div>
      </div>

      {/* CORE MATRIX GRID: VOLUME DYNAMICS & CORRELATIONS (SIDE-BY-SIDE) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* LEFT COMPACT PANEL: VOLUME & INSTITUTIONAL FLOW */}
        {volumeAnalytics && (
          <div className="rounded-xl border border-emerald-500/20 bg-slate-950 p-3.5 space-y-3 shadow-md">
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Volume Dynamics & Institutional Buildup
              </h4>
              <span className="ml-auto text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800/40">
                {volumeAnalytics.volumeAccuracyMultiplier}x Multiplier
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Vol Surge Factor</span>
                <strong className="text-white text-sm mt-0.5 block">{volumeAnalytics.totalVolumeMultiplier}x</strong>
                <span className="text-[10px] text-emerald-400 block mt-0.5 truncate">
                  {volumeAnalytics.totalVolumeMultiplier >= 1.4 ? '🔥 Institutional Spike' : 'Normal Flow'}
                </span>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Order Flow Delta</span>
                <strong className={`text-sm mt-0.5 block ${volumeAnalytics.buyerSellerPressureDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {volumeAnalytics.buyerSellerPressureDelta >= 0 ? '+' : ''}{volumeAnalytics.buyerSellerPressureDelta}%
                </strong>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                  {volumeAnalytics.buyerSellerPressureDelta >= 10 ? 'Buyers Active' : volumeAnalytics.buyerSellerPressureDelta <= -10 ? 'Sellers Active' : 'Balanced'}
                </span>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">Institutional Buildup</span>
                <strong className="text-amber-300 text-xs mt-0.5 block truncate">{volumeAnalytics.volumeBuildupLabel}</strong>
                <span className="text-[10px] text-slate-500 block mt-0.5 truncate">{volumeAnalytics.volumeDivergence?.replace(/_/g, ' ') || 'Balanced'}</span>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-sans">PCR Vol / PCR OI</span>
                <strong className="text-sky-300 text-xs mt-0.5 block truncate">Vol: {volumeAnalytics.pcrVolume} | OI: {volumeAnalytics.pcrOI}</strong>
                <span className="text-[10px] text-slate-400 block mt-0.5 truncate">
                  {volumeAnalytics.pcrVolume > volumeAnalytics.pcrOI ? 'Put Buying Surge' : 'Call Buying Surge'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT COMPACT PANEL: INTER-MARKET CUES & GLOBAL SKEW */}
        <div className="rounded-xl border border-sky-500/20 bg-slate-950 p-3.5 space-y-3 shadow-md">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
            <Globe className="w-4 h-4 text-sky-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Inter-Market Cues & Correlations
            </h4>
            <span className="ml-auto text-[10px] font-mono font-bold text-sky-300 bg-sky-950 px-1.5 py-0.2 rounded border border-sky-800/40">
              Score: {telemetry.globalCompositeScore > 0 ? `+${telemetry.globalCompositeScore}` : telemetry.globalCompositeScore}/100
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px] font-mono">
            {/* GIFT Nifty */}
            <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
              <span className="text-[9px] text-slate-500 block">GIFT NIFTY</span>
              <span className="font-bold text-white block mt-0.5">{telemetry?.giftNifty?.price ? telemetry.giftNifty.price.toLocaleString() : '22,695'}</span>
              <span className={`text-[9.5px] font-bold ${(telemetry?.giftNifty?.change || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(telemetry?.giftNifty?.change || 0) >= 0 ? '+' : ''}{(telemetry?.giftNifty?.change || 0).toFixed(1)}
              </span>
            </div>

            {/* S&P 500 Futures */}
            <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
              <span className="text-[9px] text-slate-500 block">S&P 500 FUT</span>
              <span className="font-bold text-white block mt-0.5">{telemetry?.sp500Futures?.price ? telemetry.sp500Futures.price.toLocaleString() : '5,752'}</span>
              <span className={`text-[9.5px] font-bold ${(telemetry?.sp500Futures?.changePercent || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(telemetry?.sp500Futures?.changePercent || 0) >= 0 ? '+' : ''}{telemetry?.sp500Futures?.changePercent || 0}%
              </span>
            </div>

            {/* USD / INR */}
            <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
              <span className="text-[9px] text-slate-500 block">USD / INR</span>
              <span className="font-bold text-white block mt-0.5">₹{telemetry?.usdInr?.price ? telemetry.usdInr.price.toFixed(2) : '83.52'}</span>
              <span className={`text-[9.5px] font-bold ${(telemetry?.usdInr?.changePercent || 0) <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(telemetry?.usdInr?.changePercent || 0) >= 0 ? '+' : ''}{telemetry?.usdInr?.changePercent || 0}%
              </span>
            </div>

            {/* Brent Crude */}
            <div className="p-1.5 rounded bg-slate-900 border border-slate-800">
              <span className="text-[9px] text-slate-500 block">BRENT CRUDE</span>
              <span className="font-bold text-white block mt-0.5">${telemetry?.brentCrude?.price ? telemetry.brentCrude.price.toFixed(2) : '73.20'}</span>
              <span className={`text-[9.5px] font-bold ${(telemetry?.brentCrude?.changePercent || 0) <= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {(telemetry?.brentCrude?.changePercent || 0) >= 0 ? '+' : ''}{telemetry?.brentCrude?.changePercent || 0}%
              </span>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-slate-300 font-sans p-2 rounded bg-slate-900/60 border border-slate-800">
            <strong className="text-sky-400">Synthesis:</strong> {telemetry.summaryInsight}
          </p>
        </div>
      </div>

      {/* COMPACT OPTION MISPRICING & VOLATILITY SPECTRUM */}
      {surfaceRows.length > 0 && (
        <div className="rounded-xl border border-purple-500/20 bg-slate-950 p-3.5 space-y-3.5 shadow-md">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-purple-400" />
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                Option Volatility Arbitrage & Mispricing Spectrum
              </h4>
            </div>
            <div className="text-[10.5px] font-mono text-slate-400 flex items-center gap-2">
              <span>ATM IV Baseline: <strong className="text-purple-300">{atmIvBaseline}%</strong></span>
              <span className="text-slate-600">|</span>
              <span className="text-emerald-400 font-semibold">{underpricedPicks.length} Cheap Options</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Cheap Options */}
            <div className="p-2.5 rounded-lg bg-emerald-950/10 border border-emerald-500/20 space-y-2">
              <span className="text-[11px] font-bold text-emerald-300 uppercase block tracking-wider font-mono">
                ✓ Underpriced Options (Buy Vol Advantage)
              </span>
              {underpricedPicks.length === 0 ? (
                <p className="text-[10.5px] text-slate-500 font-mono">No significantly cheap IV strikes detected.</p>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 font-mono text-xs">
                  {underpricedPicks.slice(0, 2).map((pick, i) => (
                    <div key={i} className="p-1.5 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-white">{currency}{pick.strike} {pick.type}</span>
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1 rounded">{pick.ivVsAtmPct}% Cheap</span>
                      <span className="text-[11px] text-slate-300">₹{pick.ltp.toFixed(1)} (IV {pick.iv.toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Overpriced Options */}
            <div className="p-2.5 rounded-lg bg-amber-950/10 border border-amber-500/20 space-y-2">
              <span className="text-[11px] font-bold text-amber-300 uppercase block tracking-wider font-mono">
                ⚠ Overpriced Options (Vol Premium Spike)
              </span>
              {overpricedPicks.length === 0 ? (
                <p className="text-[10.5px] text-slate-500 font-mono">No extreme IV spikes detected across strikes.</p>
              ) : (
                <div className="grid grid-cols-1 gap-1.5 font-mono text-xs">
                  {overpricedPicks.slice(0, 2).map((pick, i) => (
                    <div key={i} className="p-1.5 rounded bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                      <span className="font-bold text-white">{currency}{pick.strike} {pick.type}</span>
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1 rounded">+{pick.ivVsAtmPct}% IV Spike</span>
                      <span className="text-[11px] text-slate-300">₹{pick.ltp.toFixed(1)} (IV {pick.iv.toFixed(1)}%)</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

