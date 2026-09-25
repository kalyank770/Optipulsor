import React, { useState } from 'react';
import { OptionContract, TickerConfig } from '../types/options';
import { X, TrendingUp, TrendingDown, Calculator, ShieldCheck } from 'lucide-react';

interface OptionPayoffModalProps {
  contract: OptionContract | null;
  ticker: TickerConfig;
  isOpen: boolean;
  onClose: () => void;
}

export const OptionPayoffModal: React.FC<OptionPayoffModalProps> = ({
  contract,
  ticker,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !contract) return null;

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

  // Min and max spot bounds for slider & payoff curve
  const range = ticker.spotPrice * 0.05;
  const minSpot = Math.round(ticker.spotPrice - range);
  const maxSpot = Math.round(ticker.spotPrice + range);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="payoff-modal-title"
        className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 my-auto"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-3.5 py-3 sm:px-6 sm:py-4 border-b border-slate-800 bg-slate-950 shrink-0">
          <div className="flex items-center gap-3">
            <span className={`p-2 rounded-lg font-bold text-sm font-mono ${
              isCE ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
              'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}>
              {contract.strike} {contract.type}
            </span>
            <div>
              <h2 id="payoff-modal-title" className="text-base font-bold text-white">
                {ticker.symbol} {contract.strike} {contract.type} Payoff & Greeks
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                <span>Premium (LTP): <strong className="font-mono text-white">{ticker.currency}{premium.toFixed(2)}</strong></span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  <span>Lots:</span>
                  <button
                    onClick={() => setLots(Math.max(1, lots - 1))}
                    className="px-1.5 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer text-[10px]"
                    title="Decrease lots"
                  >
                    -
                  </button>
                  <strong className="font-mono text-white">{lots} ({totalQty} Qty)</strong>
                  <button
                    onClick={() => setLots(lots + 1)}
                    className="px-1.5 py-0.2 rounded bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer text-[10px]"
                    title="Increase lots"
                  >
                    +
                  </button>
                </span>
                <span>·</span>
                <span className="text-emerald-400 font-semibold font-mono">
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
              <div className="text-base font-bold font-mono text-white mt-1">
                {ticker.currency}{breakeven.toFixed(2)}
              </div>
              <span className="text-[10px] text-slate-500">At expiry</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Max Loss</span>
              <div className="text-base font-bold font-mono text-rose-400 mt-1">
                {maxLoss === Infinity ? 'Unlimited' : `${ticker.currency}${maxLoss.toLocaleString()}`}
              </div>
              <span className="text-[10px] text-slate-500">{positionType === 'BUY' ? 'Total Premium' : 'Margin Risk'}</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Max Profit</span>
              <div className="text-base font-bold font-mono text-emerald-400 mt-1">
                {maxProfit === Infinity ? 'Unlimited' : `${ticker.currency}${maxProfit.toLocaleString()}`}
              </div>
              <span className="text-[10px] text-slate-500">{positionType === 'BUY' ? 'Upside uncapped' : 'Premium kept'}</span>
            </div>

            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 uppercase font-medium">Target P&L</span>
              <div className={`text-base font-bold font-mono mt-1 ${
                totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {totalPnL >= 0 ? '+' : ''}{ticker.currency}{totalPnL.toLocaleString()}
              </div>
              <span className="text-[10px] text-slate-500">ROI: {roi}%</span>
            </div>
          </div>

          {/* Payoff Curve Visualizer */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
              <span>Payoff Curve at Expiration</span>
              <span className="font-mono text-slate-300">
                Spot Range: {ticker.currency}{minSpot.toLocaleString()} - {ticker.currency}{maxSpot.toLocaleString()}
              </span>
            </div>

            <div className="relative w-full h-36 bg-slate-900/60 rounded border border-slate-800/80 overflow-hidden flex items-center justify-center">
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
                {(() => {
                  const strikeX = ((K - minSpot) / (maxSpot - minSpot)) * 480 + 10;
                  return (
                    <line
                      x1={strikeX}
                      y1="10"
                      x2={strikeX}
                      y2="170"
                      stroke="#eab308"
                      strokeWidth="1"
                      strokeDasharray="2 2"
                      opacity="0.6"
                    />
                  );
                })()}

                {/* Payoff Polyline */}
                <polyline
                  fill="none"
                  stroke={isCE ? '#10b981' : '#f43f5e'}
                  strokeWidth="2.5"
                  points={svgPoints}
                />
              </svg>
            </div>
          </div>

          {/* Interactive Spot Price Slider */}
          <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="text-slate-300 font-medium">
                Simulate Target Spot Price:
              </span>
              <span className="font-mono font-bold text-white text-sm">
                {ticker.currency}{targetSpot.toFixed(2)}
              </span>
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
            <div className="flex justify-between text-[10px] text-slate-500 font-mono mt-1">
              <span>{ticker.currency}{minSpot}</span>
              <span className="text-amber-400">Current: {ticker.currency}{ticker.spotPrice.toFixed(1)}</span>
              <span>{ticker.currency}{maxSpot}</span>
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
                <span className="font-bold text-white mt-0.5 block">{contract.greeks.delta.toFixed(3)}</span>
                <span className="text-[9px] text-slate-500">Price / 1pt move</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-center">
                <span className="text-slate-500 block text-[10px]">Gamma (Γ)</span>
                <span className="font-bold text-white mt-0.5 block">{contract.greeks.gamma.toFixed(5)}</span>
                <span className="text-[9px] text-slate-500">Delta acceleration</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-center">
                <span className="text-slate-500 block text-[10px]">Theta (Θ)</span>
                <span className="font-bold text-rose-400 mt-0.5 block">{contract.greeks.theta.toFixed(2)}</span>
                <span className="text-[9px] text-slate-500">Daily decay</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-center">
                <span className="text-slate-500 block text-[10px]">Vega (ν)</span>
                <span className="font-bold text-sky-400 mt-0.5 block">{contract.greeks.vega.toFixed(2)}</span>
                <span className="text-[9px] text-slate-500">Per 1% IV change</span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Formula: Black-Scholes European Option Pricing</span>
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
