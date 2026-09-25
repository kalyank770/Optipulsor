import React, { useState } from 'react';
import { OptionChainRow, TickerConfig, MarketMetrics } from '../types/options';

interface OiDistributionChartProps {
  rows: OptionChainRow[];
  ticker: TickerConfig;
  metrics: MarketMetrics;
  onSelectStrike: (strike: number) => void;
}

export const OiDistributionChart: React.FC<OiDistributionChartProps> = ({
  rows,
  ticker,
  metrics,
  onSelectStrike,
}) => {
  const [metricMode, setMetricMode] = useState<'TOTAL_OI' | 'CHG_OI'>('TOTAL_OI');

  // Compute maximum value for scaling
  const maxVal = Math.max(
    ...rows.map(r => 
      metricMode === 'TOTAL_OI'
        ? Math.max(r.ce.openInterest, r.pe.openInterest)
        : Math.max(Math.abs(r.ce.oiChange), Math.abs(r.pe.oiChange))
    ),
    1
  );

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-5">
      {/* Header with Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span>Open Interest Profile & Institutional Walls</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Identify institutional support floors (Put OI) and resistance ceilings (Call OI)
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-slate-400 mr-2">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-500" />
              <span>Call OI (Resistance)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-rose-500" />
              <span>Put OI (Support)</span>
            </span>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 text-xs">
            <button
              onClick={() => setMetricMode('TOTAL_OI')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                metricMode === 'TOTAL_OI'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Total Open Interest
            </button>
            <button
              onClick={() => setMetricMode('CHG_OI')}
              className={`px-2.5 py-1 rounded font-medium transition-colors cursor-pointer ${
                metricMode === 'CHG_OI'
                  ? 'bg-slate-800 text-white font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Change in OI (Intraday)
            </button>
          </div>
        </div>
      </div>

      {/* Institutional Key Levels Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div className="bg-slate-950/80 p-3 rounded border border-slate-800">
          <div className="text-[11px] text-slate-400 uppercase">Major Support Wall</div>
          <div className="text-base font-bold font-mono text-emerald-400 mt-0.5">
            {ticker.currency}{metrics.majorSupportStrike.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Highest Put OI Base</div>
        </div>

        <div className="bg-slate-950/80 p-3 rounded border border-slate-800">
          <div className="text-[11px] text-slate-400 uppercase">Major Resistance Wall</div>
          <div className="text-base font-bold font-mono text-rose-400 mt-0.5">
            {ticker.currency}{metrics.majorResistanceStrike.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Highest Call OI Ceiling</div>
        </div>

        <div className="bg-slate-950/80 p-3 rounded border border-slate-800">
          <div className="text-[11px] text-slate-400 uppercase">Max Pain Settlement</div>
          <div className="text-base font-bold font-mono text-sky-400 mt-0.5">
            {ticker.currency}{metrics.maxPainStrike.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Option Seller Sweet Spot</div>
        </div>

        <div className="bg-slate-950/80 p-3 rounded border border-slate-800">
          <div className="text-[11px] text-slate-400 uppercase">PCR (Put-Call Ratio)</div>
          <div className={`text-base font-bold font-mono mt-0.5 ${
            metrics.pcrTotalOI >= 1.05 ? 'text-emerald-400' :
            metrics.pcrTotalOI <= 0.90 ? 'text-rose-400' : 'text-amber-400'
          }`}>
            {metrics.pcrTotalOI.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {metrics.pcrTotalOI >= 1.05 ? 'Bullish (PE > CE)' :
             metrics.pcrTotalOI <= 0.90 ? 'Bearish (CE > PE)' : 'Neutral Balance'}
          </div>
        </div>
      </div>

      {/* High-Performance SVG / Canvas Visualizer */}
      <div className="space-y-1.5 font-mono text-xs">
        {rows.map(row => {
          const isATM = row.isATM;
          const isSupport = row.strike === metrics.majorSupportStrike;
          const isResistance = row.strike === metrics.majorResistanceStrike;
          const isMaxPain = row.strike === metrics.maxPainStrike;

          const ceVal = metricMode === 'TOTAL_OI' ? row.ce.openInterest : Math.max(0, row.ce.oiChange);
          const peVal = metricMode === 'TOTAL_OI' ? row.pe.openInterest : Math.max(0, row.pe.oiChange);

          const ceWidth = Math.min(100, (ceVal / maxVal) * 100);
          const peWidth = Math.min(100, (peVal / maxVal) * 100);

          return (
            <div
              key={row.strike}
              onClick={() => onSelectStrike(row.strike)}
              className={`flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors hover:bg-slate-800/60 ${
                isATM ? 'bg-amber-950/20 border-y border-amber-500/20' : ''
              }`}
            >
              {/* Left Bar: Call OI */}
              <div className="flex-1 flex items-center justify-end gap-2">
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {ceVal.toLocaleString()}
                </span>
                <div className="w-48 sm:w-64 h-4 bg-slate-950 rounded-sm overflow-hidden flex justify-end">
                  <div
                    className="h-full bg-emerald-500/80 rounded-l-sm transition-all duration-300"
                    style={{ width: `${ceWidth}%` }}
                    title={`Call OI: ${ceVal.toLocaleString()}`}
                  />
                </div>
              </div>

              {/* Center Strike Label */}
              <div className="w-20 text-center font-bold text-xs shrink-0 flex items-center justify-center gap-1">
                <span className={isATM ? 'text-amber-300' : 'text-slate-200'}>
                  {row.strike.toLocaleString()}
                </span>
                {isATM && (
                  <span className="text-[8px] bg-amber-500/30 text-amber-300 px-1 py-0.2 rounded font-sans font-bold">
                    ATM
                  </span>
                )}
                {isSupport && (
                  <span className="text-[8px] bg-emerald-500/30 text-emerald-300 px-1 py-0.2 rounded font-sans font-bold" title="Support Floor">
                    SUP
                  </span>
                )}
                {isResistance && (
                  <span className="text-[8px] bg-rose-500/30 text-rose-300 px-1 py-0.2 rounded font-sans font-bold" title="Resistance Ceiling">
                    RES
                  </span>
                )}
              </div>

              {/* Right Bar: Put OI */}
              <div className="flex-1 flex items-center justify-start gap-2">
                <div className="w-48 sm:w-64 h-4 bg-slate-950 rounded-sm overflow-hidden flex justify-start">
                  <div
                    className="h-full bg-rose-500/80 rounded-r-sm transition-all duration-300"
                    style={{ width: `${peWidth}%` }}
                    title={`Put OI: ${peVal.toLocaleString()}`}
                  />
                </div>
                <span className="text-[11px] text-slate-400 tabular-nums">
                  {peVal.toLocaleString()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
