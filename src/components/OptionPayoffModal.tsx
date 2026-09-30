import React, { useState, useMemo } from 'react';
import { OptionContract, TickerConfig, TradeSignal } from '../types/options';
import { X, TrendingUp, TrendingDown, Target, Activity, Compass, ArrowRight, RotateCcw, CheckCircle2, Sliders } from 'lucide-react';
import { deriveExitLogicPlan, ExitLogicPlan } from '../utils/technicalIndicators';

interface OptionPayoffModalProps {
  contract: OptionContract | null;
  ticker: TickerConfig;
  isOpen: boolean;
  onClose: () => void;
  theme?: 'dark' | 'light';
  signal?: TradeSignal | null;
}

export const OptionPayoffModal: React.FC<OptionPayoffModalProps> = ({
  contract,
  ticker,
  isOpen,
  onClose,
  theme = 'dark',
  signal,
}) => {
  if (!isOpen || !contract) return null;
  const isLight = theme === 'light';

  const isCE = contract.type === 'CE';
  const K = contract.strike;
  const lotSize = ticker.lotSize;
  const premium = contract.ltp;

  // Lot multiplier state
  const [lots, setLots] = useState<number>(1);
  const totalQty = lots * lotSize;

  // Target spot price simulation state (defaults to current spot)
  const [targetSpot, setTargetSpot] = useState<number>(ticker.spotPrice);

  // Position type: Long Buyer (default) or Short Seller
  const [positionType, setPositionType] = useState<'BUY' | 'SELL'>('BUY');

  // Toggle overlay markers on payoff curve
  const [showExitOverlay, setShowExitOverlay] = useState<boolean>(true);

  // Derive Exit Logic & Momentum Roadmap (RSI & MACD based)
  const exitPlan: ExitLogicPlan = useMemo(() => {
    return deriveExitLogicPlan(contract, ticker, signal, totalQty);
  }, [contract, ticker, signal, totalQty]);

  // Dynamic min and max spot bounds encompassing all exit levels and current spot
  const targetSpots = exitPlan.levels.map(l => l.targetSpot);
  const allLevels = [ticker.spotPrice, K, targetSpot, ...targetSpots];
  const lowestSpot = Math.min(...allLevels);
  const highestSpot = Math.max(...allLevels);
  const span = Math.max(ticker.spotPrice * 0.05, (highestSpot - lowestSpot) * 1.35);
  const minSpot = Math.round(Math.min(ticker.spotPrice - span * 0.5, lowestSpot - ticker.strikeStep * 0.5));
  const maxSpot = Math.round(Math.max(ticker.spotPrice + span * 0.5, highestSpot + ticker.strikeStep * 0.5));

  // Breakeven price calculation
  const breakeven = isCE ? K + premium : K - premium;

  // PnL calculation at target spot on expiry
  let intrinsicAtExpiry = 0;
  if (isCE) {
    intrinsicAtExpiry = Math.max(0, targetSpot - K);
  } else {
    intrinsicAtExpiry = Math.max(0, K - targetSpot);
  }

  let pnlPerShare = 0;
  if (positionType === 'BUY') {
    pnlPerShare = intrinsicAtExpiry - premium;
  } else {
    pnlPerShare = premium - intrinsicAtExpiry;
  }

  const totalPnL = Math.round(pnlPerShare * totalQty);
  const maxLoss = positionType === 'BUY' ? Math.round(premium * totalQty) : Infinity;
  const maxProfit = positionType === 'BUY' ? Infinity : Math.round(premium * totalQty);
  const roi = positionType === 'BUY' ? ((pnlPerShare / premium) * 100).toFixed(1) : 'N/A';

  // Generate SVG curve points
  const pointsCount = 40;
  const step = (maxSpot - minSpot) / (pointsCount - 1);
  const curvePoints: { x: number; y: number; pnl: number }[] = [];

  let minPnL = 0;
  let maxPnL = 0;

  for (let i = 0; i < pointsCount; i++) {
    const s = minSpot + i * step;
    let payoff = 0;
    if (isCE) {
      payoff = Math.max(0, s - K) - premium;
    } else {
      payoff = Math.max(0, K - s) - premium;
    }
    if (positionType === 'SELL') payoff = -payoff;
    const pnl = payoff * totalQty;
    if (pnl < minPnL) minPnL = pnl;
    if (pnl > maxPnL) maxPnL = pnl;
    curvePoints.push({ x: s, y: 0, pnl });
  }

  // Normalize to SVG viewport (500 width, 180 height)
  const pnlSpan = Math.max(maxPnL - minPnL, 100);
  const svgPoints = curvePoints.map(pt => {
    const normX = ((pt.x - minSpot) / (maxSpot - minSpot)) * 480 + 10;
    const normY = 170 - ((pt.pnl - minPnL) / pnlSpan) * 150 - 10;
    return `${normX},${normY}`;
  }).join(' ');

  // Zero-line Y coordinate
  const zeroY = 170 - ((0 - minPnL) / pnlSpan) * 150 - 10;

  // Coordinate mapper for SVG overlay vertical lines
  const getSvgX = (spotVal: number) => {
    const clamped = Math.max(minSpot, Math.min(maxSpot, spotVal));
    return ((clamped - minSpot) / (maxSpot - minSpot)) * 480 + 10;
  };

  const currentSpotX = getSvgX(ticker.spotPrice);
  const strikeX = getSvgX(K);
  const simSpotX = getSvgX(targetSpot);
  const l1SpotX = getSvgX(exitPlan.levels[0]?.targetSpot ?? ticker.spotPrice);
  const l2SpotX = getSvgX(exitPlan.levels[1]?.targetSpot ?? ticker.spotPrice);
  const l3SpotX = getSvgX(exitPlan.levels[2]?.targetSpot ?? ticker.spotPrice);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="payoff-modal-title"
        className={`border rounded-xl w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-slate-900 border-slate-800 text-white'
        }`}
      >
        {/* Modal Header */}
        <div className={`flex items-center justify-between px-3.5 py-3 sm:px-6 sm:py-4 border-b shrink-0 ${
          isLight ? 'bg-slate-100 border-slate-200 text-slate-900' : 'bg-slate-950 border-slate-800 text-white'
        }`}>
          <div className="flex items-center gap-3">
            <span className={`p-2 rounded-lg font-bold text-sm font-mono ${
              isCE ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40' :
              'bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/40'
            }`}>
              {contract.strike} {contract.type}
            </span>
            <div>
              <h2 id="payoff-modal-title" className={`text-base font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                {ticker.symbol} {contract.strike} {contract.type} Payoff & Exit Logic
              </h2>
              <div className={`flex flex-wrap items-center gap-2 text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                <span>Premium (LTP): <strong className={`font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{ticker.currency}{premium.toFixed(2)}</strong></span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <span>Lots:</span>
                  <button
                    onClick={() => setLots(Math.max(1, lots - 1))}
                    className={`px-1.5 py-0.2 rounded font-bold cursor-pointer text-[10px] ${
                      isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    title="Decrease lots"
                  >
                    -
                  </button>
                  <strong className={`font-mono ${isLight ? 'text-slate-900' : 'text-white'}`}>{lots} ({totalQty} Qty)</strong>
                  <button
                    onClick={() => setLots(lots + 1)}
                    className={`px-1.5 py-0.2 rounded font-bold cursor-pointer text-[10px] ${
                      isLight ? 'bg-slate-200 hover:bg-slate-300 text-slate-800' : 'bg-slate-800 hover:bg-slate-700 text-white'
                    }`}
                    title="Increase lots"
                  >
                    +
                  </button>
                </span>
                <span>·</span>
                <span className="text-emerald-500 dark:text-emerald-400 font-semibold font-mono">
                  Capital: {ticker.currency}{(Math.round(premium * totalQty)).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Position Buy/Sell Switcher */}
            <div className="flex items-center gap-1 bg-slate-900 p-1 rounded border border-slate-800 text-xs font-mono">
              <button
                onClick={() => setPositionType('BUY')}
                className={`px-2.5 py-1 rounded font-bold transition-colors cursor-pointer ${
                  positionType === 'BUY'
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setPositionType('SELL')}
                className={`px-2.5 py-1 rounded font-bold transition-colors cursor-pointer ${
                  positionType === 'SELL'
                    ? 'bg-rose-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                SELL
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto flex-1">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Breakeven Spot</span>
              <div className="text-base font-bold font-mono text-white mt-1 tabular-nums">
                {ticker.currency}{breakeven.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500">At expiry</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Max Loss</span>
              <div className="text-base font-bold font-mono text-rose-400 mt-1 tabular-nums">
                {maxLoss === Infinity ? 'Unlimited' : `${ticker.currency}${maxLoss.toLocaleString()}`}
              </div>
              <span className="text-[10px] text-slate-500">{positionType === 'BUY' ? 'Total Premium' : 'Margin Risk'}</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Max Profit</span>
              <div className="text-base font-bold font-mono text-emerald-400 mt-1 tabular-nums">
                {maxProfit === Infinity ? 'Unlimited' : `${ticker.currency}${maxProfit.toLocaleString()}`}
              </div>
              <span className="text-[10px] text-slate-500">{positionType === 'BUY' ? 'Upside uncapped' : 'Premium kept'}</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Simulated P&L</span>
              <div className={`text-base font-bold font-mono mt-1 tabular-nums ${
                totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {totalPnL >= 0 ? '+' : ''}{ticker.currency}{totalPnL.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500">ROI: {roi}% at {ticker.currency}{targetSpot.toFixed(1)}</span>
            </div>
          </div>

          {/* Payoff Curve Visualizer with Exit Levels Overlay */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 mb-2 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-200">Payoff Curve & Exit Milestones</span>
                <span className="text-slate-600">·</span>
                <span className="font-mono text-slate-400 text-[11px]">
                  Range: {ticker.currency}{minSpot.toLocaleString()} - {ticker.currency}{maxSpot.toLocaleString()}
                </span>
              </div>

              {/* Exit Overlay Toggle */}
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  onClick={() => setShowExitOverlay(!showExitOverlay)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer border ${
                    showExitOverlay 
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400' 
                      : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {showExitOverlay ? 'Exit Milestones: Visible' : 'Exit Milestones: Hidden'}
                </button>
              </div>
            </div>

            <div className="relative w-full h-40 bg-slate-900/60 rounded border border-slate-800/80 overflow-hidden flex items-center justify-center">
              <svg className="w-full h-full" viewBox="0 0 500 180" preserveAspectRatio="none">
                {/* Zero line */}
                <line
                  x1="10"
                  y1={zeroY}
                  x2="490"
                  y2={zeroY}
                  stroke="#475569"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />

                {/* Strike price vertical line */}
                <line
                  x1={strikeX}
                  y1="10"
                  x2={strikeX}
                  y2="170"
                  stroke="#eab308"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                  opacity="0.7"
                />

                {/* Current Spot vertical line */}
                <line
                  x1={currentSpotX}
                  y1="10"
                  x2={currentSpotX}
                  y2="170"
                  stroke="#f59e0b"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                  opacity="0.8"
                />

                {/* Simulated Target Spot vertical line (if moved away from current spot) */}
                {Math.abs(targetSpot - ticker.spotPrice) > 1 && (
                  <line
                    x1={simSpotX}
                    y1="10"
                    x2={simSpotX}
                    y2="170"
                    stroke="#38bdf8"
                    strokeWidth="1.5"
                    opacity="0.85"
                  />
                )}

                {/* Exit Levels Overlays */}
                {showExitOverlay && (
                  <>
                    {/* Level 1 Exit Line */}
                    <line
                      x1={l1SpotX}
                      y1="10"
                      x2={l1SpotX}
                      y2="170"
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                      opacity="0.85"
                    />

                    {/* Level 2 Exit Line */}
                    <line
                      x1={l2SpotX}
                      y1="10"
                      x2={l2SpotX}
                      y2="170"
                      stroke="#0ea5e9"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                      opacity="0.85"
                    />

                    {/* Level 3 Exit Line */}
                    <line
                      x1={l3SpotX}
                      y1="10"
                      x2={l3SpotX}
                      y2="170"
                      stroke="#a855f7"
                      strokeWidth="1.5"
                      strokeDasharray="3 2"
                      opacity="0.85"
                    />
                  </>
                )}

                {/* Payoff Polyline */}
                <polyline
                  fill="none"
                  stroke={isCE ? '#10b981' : '#f43f5e'}
                  strokeWidth="2.5"
                  points={svgPoints}
                />
              </svg>

              {/* In-chart Overlaid Badges */}
              {showExitOverlay && (
                <div className="absolute top-2 left-2 right-2 flex justify-between pointer-events-none text-[10px] font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-amber-500/30">
                      Spot {ticker.currency}{ticker.spotPrice.toLocaleString()}
                    </span>
                    <span className="text-yellow-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-yellow-500/30">
                      Strike {K}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-emerald-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-emerald-500/30">
                      L1: {ticker.currency}{exitPlan.levels[0]?.targetSpot} (40%)
                    </span>
                    <span className="text-sky-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-sky-500/30">
                      L2: {ticker.currency}{exitPlan.levels[1]?.targetSpot} (40%)
                    </span>
                    <span className="text-purple-400 bg-slate-950/80 px-1.5 py-0.5 rounded border border-purple-500/30">
                      L3: {ticker.currency}{exitPlan.levels[2]?.targetSpot} (20%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Interactive Spot Price Simulation Slider */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <div className="flex items-center gap-2">
                <Sliders className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-slate-200 font-medium">
                  Simulate Spot Price:
                </span>
                <span className="font-mono font-bold text-white text-sm tabular-nums">
                  {ticker.currency}{targetSpot.toFixed(2)}
                </span>
                {Math.abs(targetSpot - ticker.spotPrice) > 0.05 && (
                  <span className={`text-[11px] font-mono ${targetSpot >= ticker.spotPrice ? 'text-emerald-400' : 'text-rose-400'}`}>
                    ({targetSpot >= ticker.spotPrice ? '+' : ''}{(targetSpot - ticker.spotPrice).toFixed(2)} pts)
                  </span>
                )}
              </div>

              <button
                onClick={() => setTargetSpot(ticker.spotPrice)}
                className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800 transition-colors cursor-pointer"
                title="Reset simulation to current spot"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Spot</span>
              </button>
            </div>
            <input
              type="range"
              min={minSpot}
              max={maxSpot}
              step={ticker.strikeStep / 2}
              value={targetSpot}
              onChange={e => setTargetSpot(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1 tabular-nums">
              <span>{ticker.currency}{minSpot}</span>
              <span className="text-amber-400">Current Spot: {ticker.currency}{ticker.spotPrice.toFixed(2)}</span>
              <span>{ticker.currency}{maxSpot}</span>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* DEDICATED EXIT LOGIC VISUAL INDICATOR & MOMENTUM ROADMAP (RSI & MACD)     */}
          {/* ========================================================================= */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/90 space-y-4">
            {/* Header: Title and unboxed metadata */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                  <Target className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
                    <span>Exit Logic & Momentum Scaling</span>
                    <span className="text-[10px] font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                      RSI & MACD Guided
                    </span>
                  </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                    <span>5m RSI Momentum</span>
                    <span aria-hidden="true">·</span>
                    <span>MACD Trend Cues</span>
                    <span aria-hidden="true">·</span>
                    <span>40% / 40% / 20% Tiered Scaling</span>
                  </div>
                </div>
              </div>

              {/* Status Badge */}
              <div className="text-xs font-mono flex items-center gap-2">
                <span className="text-slate-400">Posture:</span>
                <span className="text-emerald-400 font-semibold bg-slate-900 px-2 py-1 rounded border border-slate-800">
                  {exitPlan?.momentumVerdict?.replace(/_/g, ' ') || 'NEUTRAL'}
                </span>
              </div>
            </div>

            {/* Live Momentum Indicators Bar: RSI & MACD Dual Telemetry */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* RSI (14) Momentum Meter */}
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <Activity className="w-3.5 h-3.5 text-slate-400" />
                    <span>Relative Strength Index (RSI 14)</span>
                  </div>
                  <span className={`font-mono font-bold ${exitPlan.rsi.zoneColor} tabular-nums text-sm`}>
                    {exitPlan.rsi.value.toFixed(1)}
                  </span>
                </div>

                {/* Sleek RSI Zone Meter */}
                <div className="space-y-1 my-1">
                  <div className="relative w-full h-2 rounded-full bg-slate-950 overflow-hidden border border-slate-800">
                    {/* Zone indicators: <30 oversold, 30-70 normal, >70 overbought */}
                    <div className="absolute left-0 top-0 bottom-0 w-[30%] bg-rose-500/20" />
                    <div className="absolute left-[30%] top-0 bottom-0 w-[40%] bg-emerald-500/20" />
                    <div className="absolute left-[70%] top-0 bottom-0 w-[30%] bg-amber-500/20" />

                    {/* RSI Current Value Marker */}
                    <div 
                      className="absolute top-0 bottom-0 w-2 -ml-1 bg-white rounded-full shadow-sm transition-all duration-300"
                      style={{ left: `${Math.max(2, Math.min(98, exitPlan.rsi.value))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-slate-500 font-mono">
                    <span>0 (Oversold &lt;30)</span>
                    <span className="text-slate-400">50 Midline</span>
                    <span>100 (Overbought &gt;70)</span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 leading-tight mt-1 flex items-center justify-between">
                  <span>Condition: <strong className={exitPlan.rsi.zoneColor}>{exitPlan.rsi.label}</strong></span>
                  <span className="text-[10px] text-slate-500">{isCE ? 'Watch for 65+ exit' : 'Watch for 35- exit'}</span>
                </div>
              </div>

              {/* MACD (12, 26, 9) Trend Box */}
              <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800/80 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                    <Compass className="w-3.5 h-3.5 text-slate-400" />
                    <span>MACD Trend & Velocity (12, 26, 9)</span>
                  </div>
                  <span className={`font-mono font-bold ${exitPlan.macd.histogramColor} tabular-nums text-sm`}>
                    {exitPlan.macd.histogram >= 0 ? '+' : ''}{exitPlan.macd.histogram.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-[10px] font-mono my-1 bg-slate-950 p-1.5 rounded border border-slate-800/60 text-center">
                  <div>
                    <span className="text-slate-500 block text-[9px]">MACD Line</span>
                    <span className="text-white font-semibold">{exitPlan.macd.macdLine.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Signal Line</span>
                    <span className="text-slate-300 font-semibold">{exitPlan.macd.signalLine.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[9px]">Histogram</span>
                    <span className={`font-bold ${exitPlan.macd.histogramColor}`}>
                      {exitPlan.macd.histogram >= 0 ? '+' : ''}{exitPlan.macd.histogram.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 leading-tight mt-1 flex items-center justify-between">
                  <span>State: <strong className={exitPlan.macd.histogramColor}>{exitPlan.macd.label}</strong></span>
                  <span className="text-[10px] text-slate-500">Trailing trigger: cross</span>
                </div>
              </div>
            </div>

            {/* Strategic Momentum Guidance Banner */}
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-xs text-slate-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <span className="text-slate-400">Institutional Strategy: </span>
                <span className="text-slate-200">{exitPlan.summaryGuidance}</span>
              </div>
            </div>

            {/* 3-Tier Suggested Partial Profit Booking Levels Roadmap */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-300">
                  Partial Profit Booking Milestones
                </span>
                <span className="font-mono text-[11px] text-slate-400">
                  Total Allocated: {totalQty} Contracts
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {exitPlan.levels.map((lvl) => {
                  const isCurrentTarget = Math.abs(targetSpot - lvl.targetSpot) < 0.1;
                  return (
                    <div 
                      key={lvl.level}
                      className={`p-3 rounded-lg border transition-all flex flex-col justify-between ${
                        isCurrentTarget
                          ? 'bg-slate-900 border-emerald-500/60 ring-1 ring-emerald-500/30 shadow-lg'
                          : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div>
                        {/* Level Header & Tag */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-white font-mono">
                            {lvl.level === 1 ? 'L1: Scalp Exit' : lvl.level === 2 ? 'L2: Trend Runner' : 'L3: Climax Runner'}
                          </span>
                          <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border uppercase font-bold tracking-tight ${lvl.badgeColor}`}>
                            {lvl.tag}
                          </span>
                        </div>

                        {/* Price Milestones */}
                        <div className="bg-slate-950 p-2.5 rounded border border-slate-800/60 space-y-1.5 mb-2.5 font-mono">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Target Spot:</span>
                            <span className="font-bold text-white tabular-nums">
                              {ticker.currency}{lvl.targetSpot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-400">Target Premium:</span>
                            <span className="font-bold text-emerald-400 tabular-nums">
                              {ticker.currency}{lvl.estimatedOptionPrice.toFixed(2)} (+{lvl.gainPercent}%)
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/60">
                            <span className="text-slate-500">Booked P&L:</span>
                            <span className="font-bold text-emerald-400 tabular-nums">
                              +{ticker.currency}{lvl.estimatedBookingPnL.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>

                        {/* Technical Indicator Exit Rules */}
                        <div className="space-y-1.5 text-[11px] text-slate-400 mb-3">
                          <div className="flex items-start gap-1.5">
                            <span className="text-emerald-400 shrink-0 font-bold">RSI:</span>
                            <span className="text-slate-300 leading-tight">{lvl.rsiTrigger}</span>
                          </div>
                          <div className="flex items-start gap-1.5">
                            <span className="text-sky-400 shrink-0 font-bold">MACD:</span>
                            <span className="text-slate-300 leading-tight">{lvl.macdTrigger}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800/40 leading-normal">
                            <span className="text-amber-400 font-semibold">Action: </span>
                            {lvl.recommendedTrailingSL}
                          </div>
                        </div>
                      </div>

                      {/* Interactive Simulation Button */}
                      <button
                        onClick={() => setTargetSpot(lvl.targetSpot)}
                        className={`w-full py-1.5 px-2.5 rounded text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border ${
                          isCurrentTarget
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                        }`}
                      >
                        <span>{isCurrentTarget ? 'Simulating This Exit' : `Simulate Level ${lvl.level}`}</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Option Greeks Grid */}
          <div className="border-t border-slate-800 pt-3">
            <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2.5">
              Live Option Greeks Sensitivity
            </h4>
            <div className="grid grid-cols-4 gap-2 text-xs font-mono">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-center">
                <span className="text-slate-500 block text-[10px]">Delta (Δ)</span>
                <span className="font-bold text-white mt-0.5 block tabular-nums">{contract.greeks.delta.toFixed(3)}</span>
                <span className="text-[9px] text-slate-500">Price / 1pt move</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-center">
                <span className="text-slate-500 block text-[10px]">Gamma (Γ)</span>
                <span className="font-bold text-white mt-0.5 block tabular-nums">{contract.greeks.gamma.toFixed(5)}</span>
                <span className="text-[9px] text-slate-500">Delta acceleration</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-center">
                <span className="text-slate-500 block text-[10px]">Theta (Θ)</span>
                <span className="font-bold text-rose-400 mt-0.5 block tabular-nums">{contract.greeks.theta.toFixed(2)}</span>
                <span className="text-[9px] text-slate-500">Daily decay</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-center">
                <span className="text-slate-500 block text-[10px]">Vega (ν)</span>
                <span className="font-bold text-sky-400 mt-0.5 block tabular-nums">{contract.greeks.vega.toFixed(2)}</span>
                <span className="text-[9px] text-slate-500">Per 1% IV change</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Formula: Black-Scholes European Option Pricing with Dynamic Greeks</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors cursor-pointer"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
