import React, { useState, useEffect, useRef } from 'react';
import { 
  TradeSignal, 
  TickerConfig, 
  MarketMetrics,
  OptionChainRow
} from '../types/options';
import { 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Copy, 
  CheckCircle2, 
  Maximize2,
  ArrowUpRight, 
  ArrowDownRight,
  Calculator,
  AlertTriangle,
  BarChart2,
  Globe,
  Moon,
  Zap,
  Layers,
  Activity,
  Gauge,
  Radio,
  SlidersHorizontal,
  Compass,
  Target,
  Percent
} from 'lucide-react';

interface SignalCardProps {
  signal: TradeSignal;
  ticker: TickerConfig;
  metrics: MarketMetrics;
  chain?: OptionChainRow[];
  onSelectContractForSimulation: (strike: number, type: 'CE' | 'PE') => void;
  isSyncing?: boolean;
  theme?: 'dark' | 'light';
}

export const SignalCard: React.FC<SignalCardProps> = ({
  signal,
  ticker,
  chain,
  onSelectContractForSimulation,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const [copied, setCopied] = useState(false);
  const [lots, setLots] = useState<number>(1);
  const [priceFlash, setPriceFlash] = useState<'UP' | 'DOWN' | null>(null);

  const isCE = signal.action === 'BUY_CE';
  const isPE = signal.action === 'BUY_PE';
  const isNeutral = signal.action === 'WAIT_NEUTRAL';

  // Find live contract quote directly from the option chain
  const recommendedRow = chain?.find(r => r.strike === signal.recommendedStrike);
  const liveContract = signal.recommendedType === 'CE' ? recommendedRow?.ce : recommendedRow?.pe;

  // Real-time dynamic contract premium (LTP)
  const currentLTP = liveContract?.ltp ?? signal.recommendedContractLTP;
  const prevLtpRef = useRef<number>(currentLTP);

  // Price tick visual flash detector
  useEffect(() => {
    if (prevLtpRef.current !== currentLTP) {
      if (currentLTP > prevLtpRef.current) {
        setPriceFlash('UP');
      } else if (currentLTP < prevLtpRef.current) {
        setPriceFlash('DOWN');
      }
      prevLtpRef.current = currentLTP;
      const t = setTimeout(() => setPriceFlash(null), 1200);
      return () => clearTimeout(t);
    }
  }, [currentLTP]);

  // Total quantity and capital calculations based on selected lots
  const lotSize = ticker.lotSize;
  const totalQty = Math.max(1, lots) * lotSize;
  const totalCapital = currentLTP * totalQty;

  // Real-time Target 1 P&L calculation
  const target1 = signal.target1;
  const t1Points = Number((target1 - currentLTP).toFixed(2));
  const t1ProfitTotal = Number((t1Points * totalQty).toFixed(2));
  const t1ProfitPct = totalCapital > 0 ? Number(((t1ProfitTotal / totalCapital) * 100).toFixed(1)) : 15.0;

  // Real-time Target 2 P&L calculation
  const target2 = signal.target2;
  const t2Points = Number((target2 - currentLTP).toFixed(2));
  const t2ProfitTotal = Number((t2Points * totalQty).toFixed(2));
  const t2ProfitPct = totalCapital > 0 ? Number(((t2ProfitTotal / totalCapital) * 100).toFixed(1)) : 30.0;

  // Real-time Stop Loss P&L calculation
  const stopLoss = signal.stopLoss;
  const slRiskPoints = Number((currentLTP - stopLoss).toFixed(2));
  const slLossTotal = Number((slRiskPoints * totalQty).toFixed(2));
  const slLossPct = totalCapital > 0 ? Number(((slLossTotal / totalCapital) * 100).toFixed(1)) : 12.0;

  // Expiry breakeven spot price
  const breakevenSpot = signal.recommendedType === 'CE' 
    ? signal.recommendedStrike + currentLTP 
    : signal.recommendedStrike - currentLTP;

  // Quick lot selection
  const quickLots = [1, 2, 5, 10];

  const handleCopy = () => {
    const text = `OptiPulse Live Signal: ${signal.action === 'BUY_CE' ? 'CALL (CE)' : signal.action === 'BUY_PE' ? 'PUT (PE)' : 'NEUTRAL'}\nTicker: ${ticker.symbol} (Spot: ${ticker.currency}${ticker.spotPrice.toLocaleString()})\nRecommended: ${signal.recommendedStrike} ${signal.recommendedType} @ ${ticker.currency}${currentLTP.toFixed(2)}\nSelected Lots: ${lots} (${totalQty} Qty)\nCapital Deployed: ${ticker.currency}${totalCapital.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\nTarget 1: ${ticker.currency}${target1.toFixed(2)} (+${t1ProfitPct}%) [${signal.target1Basis || `Spot ${signal.spotTarget1}`}]\nTarget 2: ${ticker.currency}${target2.toFixed(2)} (+${t2ProfitPct}%) [${signal.target2Basis || `Spot ${signal.spotTarget2}`}]\nStop Loss: ${ticker.currency}${stopLoss.toFixed(2)} (-${slLossPct}%)\nBreakeven Spot: ${ticker.currency}${breakevenSpot.toFixed(2)}\nR:R: ${signal.riskRewardRatio}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`rounded-xl border p-3.5 sm:p-5 transition-all shadow-md ${
      isLight 
        ? (isCE ? 'bg-white border-emerald-500/50 text-slate-900 shadow-xl' : isPE ? 'bg-white border-rose-500/50 text-slate-900 shadow-xl' : 'bg-white border-slate-300 text-slate-900 shadow-xl')
        : (isCE ? 'bg-slate-900/95 border-emerald-500/40 text-slate-100 shadow-xl' : isPE ? 'bg-slate-900/95 border-rose-500/40 text-slate-100 shadow-xl' : 'bg-slate-900/95 border-slate-800 text-slate-100')
    }`}>
      {/* Top Header: Recommendation & Action Buttons */}
      <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b ${
        isLight ? 'border-slate-200' : 'border-slate-800/80'
      }`}>
        <div className="flex items-start sm:items-center gap-3">
          <div className={`p-2.5 sm:p-3 rounded-lg flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 ${
            isCE ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' :
            isPE ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' :
            'bg-amber-500/15 text-amber-400 border border-amber-500/30'
          }`}>
            {isCE && <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />}
            {isPE && <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6" />}
            {isNeutral && <ShieldAlert className="w-5 h-5 sm:w-6 sm:h-6" />}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <span className="uppercase font-semibold tracking-wider text-[11px]">Trade Recommendation</span>
              <span className="text-slate-600">·</span>
              <span className="font-mono text-slate-300">
                Spot: <strong className="text-white">{ticker.currency}{ticker.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-0.5">
              <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white flex flex-wrap items-center gap-2">
                {signal.tradeStage === 'POST_TARGET_RETRACEMENT' ? (
                  <span className="text-amber-400">
                    {isCE ? 'CALL' : 'PUT'} — {signal.recommendedStrike} {signal.recommendedType} (Target 1 Reached · Retracing)
                  </span>
                ) : (
                  <>
                    {isCE && <span className="text-emerald-400">BUY CALL — {signal.recommendedStrike} CE</span>}
                    {isPE && <span className="text-rose-400">BUY PUT — {signal.recommendedStrike} PE</span>}
                    {isNeutral && <span className="text-amber-400">STAY NEUTRAL / WAIT</span>}
                  </>
                )}
              </h2>

              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                signal.strength === 'STRONG' ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300' :
                signal.strength === 'MODERATE' ? 'border-sky-500/40 bg-sky-950/40 text-sky-300' :
                'border-amber-500/40 bg-amber-950/40 text-amber-300'
              }`}>
                {signal.strength} ({signal.confidence}%)
              </span>

              {/* Trade Lifecycle State Badge */}
              {signal.tradeStage && (
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border font-mono ${
                  signal.tradeStage === 'POST_TARGET_RETRACEMENT'
                    ? 'border-amber-500/50 bg-amber-950/60 text-amber-300 animate-pulse'
                    : signal.tradeStage === 'TARGET_1_HIT' || signal.tradeStage === 'TARGET_2_HIT'
                    ? 'border-emerald-500/50 bg-emerald-950/60 text-emerald-300'
                    : signal.tradeStage === 'EXPANDING_IN_PROFIT'
                    ? 'border-sky-500/50 bg-sky-950/60 text-sky-300'
                    : signal.tradeStage === 'STOP_LOSS_HIT'
                    ? 'border-rose-500/50 bg-rose-950/60 text-rose-300'
                    : 'border-slate-700 bg-slate-800 text-slate-300'
                }`}>
                  {signal.tradeStage === 'POST_TARGET_RETRACEMENT' && '⚠️ TARGET 1 HIT · RETRACED'}
                  {signal.tradeStage === 'TARGET_1_HIT' && '🎯 TARGET 1 HIT'}
                  {signal.tradeStage === 'TARGET_2_HIT' && '🚀 TARGET 2 RUNNER HIT'}
                  {signal.tradeStage === 'EXPANDING_IN_PROFIT' && '📈 EXPANDING TOWARDS T1'}
                  {signal.tradeStage === 'FRESH_ENTRY' && '⚡ FRESH ENTRY ZONE'}
                  {signal.tradeStage === 'STOP_LOSS_HIT' && '🛑 STOP LOSS HIT'}
                  {signal.tradeStage === 'NEUTRAL_WAIT' && '⏸️ CONSOLIDATING'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors cursor-pointer min-h-[40px]"
            title="Copy trade details"
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={() => onSelectContractForSimulation(signal.recommendedStrike, signal.recommendedType)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors cursor-pointer shadow-sm min-h-[40px]"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Payoff Simulator</span>
          </button>
        </div>
      </div>

      {/* Post-Target Retracement / Completed Prediction Warning Banner */}
      {signal.tradeStage === 'POST_TARGET_RETRACEMENT' && (
        <div className="mt-3 p-3 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          <div className="flex items-start sm:items-center gap-2.5">
            <div className="p-1.5 rounded bg-amber-500/20 text-amber-400 shrink-0">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-amber-300 text-xs sm:text-sm">
                Target 1 Reached Earlier · Currently Retracing @ {ticker.currency}{currentLTP.toFixed(2)}
              </div>
              <p className="text-amber-200/90 text-[11.5px] mt-0.5 leading-relaxed">
                This contract already reached Target 1 and has now pulled back into profit-booking. <strong className="text-amber-100">Avoid fresh market entry at {ticker.currency}{currentLTP.toFixed(2)}</strong>. Existing positions should hold trailing stop loss; new buyers should wait for a fresh base or next cycle breakout.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Live Contract Strip */}
      <div className="mt-3 p-3 rounded-lg bg-slate-950 border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">LIVE NFO</span>
          <span className="text-slate-600">·</span>
          <span className="font-mono text-white font-bold text-xs sm:text-sm">
            {ticker.symbol} {signal.recommendedStrike} {signal.recommendedType}
          </span>
        </div>

        {/* Live Contract Price & Spread */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
            priceFlash === 'UP' ? 'bg-emerald-500/30 text-emerald-300' :
            priceFlash === 'DOWN' ? 'bg-rose-500/30 text-rose-300' :
            'bg-slate-900 text-white'
          }`}>
            <span className="text-slate-400 text-[11px]">LTP:</span>
            <span className="text-base sm:text-lg font-bold">
              {ticker.currency}{currentLTP.toFixed(2)}
            </span>
            {liveContract?.change !== undefined && (
              <span className={`text-[11px] font-semibold flex items-center ${liveContract.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {liveContract.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {liveContract.change >= 0 ? '+' : ''}{liveContract.change.toFixed(2)} ({liveContract.changePercent}%)
              </span>
            )}
          </div>

          {liveContract?.bidPrice !== undefined && liveContract?.askPrice !== undefined && (
            <div className="text-slate-400 text-[11px] flex items-center gap-1.5">
              <span>Bid: <strong className="text-slate-200">{ticker.currency}{liveContract.bidPrice.toFixed(2)}</strong></span>
              <span>·</span>
              <span>Ask: <strong className="text-slate-200">{ticker.currency}{liveContract.askPrice.toFixed(2)}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Lot Sizer Control Bar */}
      <div className={`mt-3 flex flex-wrap items-center justify-between gap-2.5 p-2.5 sm:p-3 rounded-lg border ${
        isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-slate-950/60 border-slate-800/60 text-slate-300'
      }`}>
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Calculator className="w-4 h-4 text-sky-400 shrink-0" />
            <span className="hidden xs:inline">Position:</span>
          </div>

          {/* Quick lot buttons */}
          <div className="flex items-center gap-1">
            {quickLots.map(q => (
              <button
                key={q}
                onClick={() => setLots(q)}
                className={`px-2 py-1 text-xs font-mono font-bold rounded transition-colors cursor-pointer min-h-[32px] min-w-[32px] ${
                  lots === q 
                    ? 'bg-sky-500 text-white font-bold shadow-sm' 
                    : isLight 
                      ? 'bg-white hover:bg-slate-200 text-slate-700 border border-slate-300' 
                      : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800'
                }`}
              >
                {q}L
              </button>
            ))}
          </div>

          {/* Stepper for custom lots */}
          <div className={`flex items-center rounded overflow-hidden border ${
            isLight ? 'border-slate-300 bg-white' : 'border-slate-700 bg-slate-900'
          }`}>
            <button
              onClick={() => setLots(Math.max(1, lots - 1))}
              className={`px-2.5 py-1 text-xs font-bold cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center ${
                isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title="Decrease lot"
            >
              -
            </button>
            <span className={`px-2 py-1 text-xs font-mono font-bold min-w-[44px] text-center ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              {lots} {lots === 1 ? 'Lot' : 'Lots'}
            </span>
            <button
              onClick={() => setLots(lots + 1)}
              className={`px-2.5 py-1 text-xs font-bold cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center ${
                isLight ? 'text-slate-700 hover:bg-slate-100' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
              title="Increase lot"
            >
              +
            </button>
          </div>
        </div>

        {/* Total Quantity */}
        <div className={`flex items-center justify-between sm:justify-end gap-3 text-xs font-mono w-full sm:w-auto pt-2 sm:pt-0 ${
          isLight ? 'border-t border-slate-200 sm:border-0' : 'border-t border-slate-800/60 sm:border-0'
        }`}>
          <div className="text-sky-600 dark:text-sky-300 font-bold">
            Total Quantity: <strong className={isLight ? 'text-slate-900' : 'text-white'}>{totalQty} units</strong> ({lots} Lot{lots > 1 ? 's' : ''})
          </div>
        </div>
      </div>

      {/* Real-Money Live Profit & Loss Matrix */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mt-3">
        {/* Metric 1: Capital Deployed */}
        <div className={`p-2.5 sm:p-3.5 rounded-lg border flex flex-col justify-between ${
          isLight ? 'bg-slate-50 border-slate-200' : 'bg-slate-950 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400">
            <span>Capital Outlay</span>
            <span className="text-[10px] text-slate-400 font-mono">{lots}L</span>
          </div>
          <div className="my-1.5">
            <div className={`text-lg sm:text-2xl font-bold font-mono tracking-tight ${
              isLight ? 'text-slate-900' : 'text-white'
            }`}>
              {ticker.currency}{totalCapital.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-mono">
              {totalQty} × {ticker.currency}{currentLTP.toFixed(2)}
            </div>
          </div>
          <div className={`text-[10px] text-slate-500 pt-1 flex items-center justify-between border-t ${
            isLight ? 'border-slate-200' : 'border-slate-900'
          }`}>
            <span>Max Outlay</span>
          </div>
        </div>

        {/* Metric 2: Stop Loss Points Risk */}
        <div className={`p-2.5 sm:p-3.5 rounded-lg border border-rose-500/30 flex flex-col justify-between ${
          isLight ? 'bg-rose-50/50' : 'bg-slate-950'
        }`}>
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] uppercase font-semibold text-rose-500 dark:text-rose-400">
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Stop Loss
            </span>
            <span className="text-[10px] font-mono px-1 rounded bg-rose-500/10 text-rose-600 dark:text-rose-300">
              -{slLossPct}%
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-lg sm:text-2xl font-bold font-mono text-rose-600 dark:text-rose-400 tracking-tight">
              -{slRiskPoints.toFixed(2)} pts
            </div>
            <div className="text-[10px] sm:text-[11px] text-rose-700/80 dark:text-rose-300/80 font-mono">
              Cut @ {ticker.currency}{stopLoss.toFixed(2)}
            </div>
          </div>
          <div className={`text-[10px] text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-between font-mono border-t ${
            isLight ? 'border-rose-200' : 'border-slate-900'
          }`}>
            <span className="truncate mr-1 text-[9.5px] text-rose-400/90" title={signal.spotStopLoss ? `Spot Invalidation @ ${ticker.currency}${signal.spotStopLoss.toLocaleString()}` : 'Risk Limit'}>
              {signal.spotStopLoss ? `Spot: ${ticker.currency}${signal.spotStopLoss.toLocaleString()}` : 'Risk Limit'}
            </span>
            <span className="shrink-0">Max SL</span>
          </div>
        </div>

        {/* Metric 3: Target 1 Points Gain */}
        <div className={`p-2.5 sm:p-3.5 rounded-lg border border-emerald-500/30 flex flex-col justify-between ${
          isLight ? 'bg-emerald-50/50' : 'bg-slate-950'
        }`}>
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] uppercase font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              Target 1
            </span>
            <span className="text-[10px] font-mono px-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
              +{t1ProfitPct}%
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-lg sm:text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
              +{t1Points.toFixed(2)} pts
            </div>
            <div className="text-[10px] sm:text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-mono">
              Exit @ {ticker.currency}{target1.toFixed(2)}
            </div>
          </div>
          <div className={`text-[10px] text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-between font-mono border-t ${
            isLight ? 'border-emerald-200' : 'border-slate-900'
          }`}>
            <span className="truncate mr-1 text-[9.5px] text-emerald-400/90" title={signal.target1Basis || `Spot Target`}>
              {signal.spotTarget1 ? `Spot: ${ticker.currency}${signal.spotTarget1.toLocaleString()}` : `R:R ${signal.riskRewardRatio}`}
            </span>
            <span className="shrink-0">R:R {signal.riskRewardRatio}</span>
          </div>
        </div>

        {/* Metric 4: Target 2 Points Gain */}
        <div className={`p-2.5 sm:p-3.5 rounded-lg border border-sky-500/30 flex flex-col justify-between ${
          isLight ? 'bg-sky-500/5' : 'bg-slate-950'
        }`}>
          <div className="flex items-center justify-between text-[10px] sm:text-[11px] uppercase font-semibold text-sky-600 dark:text-sky-400">
            <span className="flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" />
              Target 2
            </span>
            <span className="text-[10px] font-mono px-1 rounded bg-sky-500/10 text-sky-600 dark:text-sky-300">
              +{t2ProfitPct}%
            </span>
          </div>
          <div className="my-1.5">
            <div className="text-lg sm:text-2xl font-bold font-mono text-sky-600 dark:text-sky-400 tracking-tight">
              +{t2Points.toFixed(2)} pts
            </div>
            <div className="text-[10px] sm:text-[11px] text-sky-700/80 dark:text-sky-300/80 font-mono">
              Exit @ {ticker.currency}{target2.toFixed(2)}
            </div>
          </div>
          <div className={`text-[10px] text-slate-500 dark:text-slate-400 pt-1 flex items-center justify-between font-mono border-t ${
            isLight ? 'border-sky-200' : 'border-slate-900'
          }`}>
            <span className="truncate mr-1 text-[9.5px] text-sky-400/90" title={signal.target2Basis || `Major Wall`}>
              {signal.spotTarget2 ? `Spot: ${ticker.currency}${signal.spotTarget2.toLocaleString()}` : 'Extended Wall'}
            </span>
            <span className="shrink-0">Runner</span>
          </div>
        </div>
      </div>

      {/* Execution Guidance & Key Levels Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 text-xs font-mono">
        <div className="p-2 rounded bg-slate-950 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase font-sans">Entry Zone</span>
          <span className="text-white font-bold text-xs sm:text-sm mt-0.5 block truncate">
            {ticker.currency}{signal.entryRange[0].toFixed(2)} - {signal.entryRange[1].toFixed(2)}
          </span>
        </div>

        <div className="p-2 rounded bg-slate-950 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase font-sans">Breakeven Spot</span>
          <span className="text-sky-400 font-bold text-xs sm:text-sm mt-0.5 block truncate">
            {ticker.currency}{breakevenSpot.toFixed(2)}
          </span>
        </div>

        <div className="p-2 rounded bg-slate-950 border border-slate-800">
          <span className="text-slate-400 block text-[10px] uppercase font-sans">Risk : Reward</span>
          <span className="text-emerald-400 font-bold text-xs sm:text-sm mt-0.5 block truncate">
            {signal.riskRewardRatio}
          </span>
        </div>
      </div>

      {/* Compact Strike Profit Possibility Strip (2 Below · Predicted · 2 Above) */}
      {signal.adjacentStrikes && signal.adjacentStrikes.length > 0 && (
        <div className="mt-3 p-2.5 sm:p-3 rounded-lg bg-slate-950/90 border border-slate-800">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
              <Target className="w-3.5 h-3.5 text-emerald-400" />
              <span>Strike Matrix (2 Below · Predicted · 2 Above)</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {signal.recommendedType === 'CE' ? 'Calls (CE)' : 'Puts (PE)'} · Click to Simulate
            </span>
          </div>

          {/* Compact 5-Strike Row */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 font-mono text-xs">
            {signal.adjacentStrikes.map((adj) => {
              const isPred = adj.isPredicted;
              return (
                <button
                  key={adj.strike}
                  onClick={() => onSelectContractForSimulation(adj.strike, adj.type)}
                  className={`p-2 rounded-md border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                    isPred
                      ? 'bg-emerald-950/40 border-emerald-500/60 ring-1 ring-emerald-500/40'
                      : 'bg-slate-900/80 border-slate-800/80 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                  title={`Click to simulate ${adj.strike} ${adj.type} (${adj.recommendationTag})`}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className={`font-bold ${isPred ? 'text-emerald-400 font-bold' : 'text-slate-200'}`}>
                      {adj.strike} {adj.type}
                    </span>
                    {isPred ? (
                      <span className="text-[9px] px-1 py-0.2 rounded font-bold bg-emerald-500 text-slate-950 font-mono">
                        PICK
                      </span>
                    ) : (
                      <span className="text-[9.5px] text-slate-500 font-mono">
                        {adj.relativePosition > 0 ? `+${adj.relativePosition}` : adj.relativePosition}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[11px]">
                    <span className="text-slate-400 font-sans font-normal">Price:</span>
                    <span className="text-white font-bold">
                      {ticker.currency}{adj.ltp.toFixed(2)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[11px] mt-0.5 pt-0.5 border-t border-slate-800/60">
                    <span className="text-slate-400 font-sans font-normal" title="Probability of Profit / Win Chance">Win Prob:</span>
                    <span className={`font-bold ${
                      adj.profitProbabilityPercent >= 70 ? 'text-emerald-400' :
                      adj.profitProbabilityPercent >= 55 ? 'text-sky-400' :
                      adj.profitProbabilityPercent >= 45 ? 'text-amber-400' : 'text-purple-400'
                    }`}>
                      {adj.profitProbabilityPercent}%
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-1 text-[10.5px] mt-0.5">
                    <span className="text-slate-400 font-sans font-normal" title="Expected Target 1 Gain %">T1 ROI:</span>
                    <span className="text-emerald-400 font-semibold">
                      +{adj.target1GainPercent}%
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Explanatory Rationale Footer */}
          <div className="mt-2 pt-1.5 border-t border-slate-800/70 flex items-center justify-between text-[10.5px] text-slate-400">
            <span className="text-slate-300">
              💡 <strong className="text-slate-200">Selection Logic:</strong> Deep ITM strikes (e.g. {signal.recommendedStrike + ticker.strikeStep * (signal.recommendedType === 'PE' ? 1 : -1)} {signal.recommendedType}) have higher Win Prob (90%+) via high Delta, but require high capital outlay with lower % leverage. The algorithm recommends <strong className="text-emerald-400">ATM {signal.recommendedStrike} {signal.recommendedType}</strong> for optimal Gamma acceleration, higher % ROI, and maximum liquidity.
            </span>
          </div>
        </div>
      )}

      {/* Multi-Timeframe Candlestick & Chart Patterns (2m | 5m | 15m) with Momentum Scoring */}
      {signal.candleAnalysis && (
        <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Multi-Timeframe Candlestick Momentum Engine (2m · 5m · 15m)
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-slate-400">Momentum Confluence:</span>
              <span className={`font-bold px-2.5 py-0.5 rounded text-[11px] border ${
                signal.candleAnalysis.confluenceBias === 'BULLISH'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10'
                  : signal.candleAnalysis.confluenceBias === 'BEARISH'
                  ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 shadow-sm shadow-rose-500/10'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              }`}>
                {signal.candleAnalysis.momentumAlignment?.replace(/_/g, ' ') || signal.candleAnalysis.confluenceBias} ({signal.candleAnalysis.confluenceScore > 0 ? '+' : ''}{signal.candleAnalysis.confluenceScore}/10)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
            {/* 2-Minute Candle Momentum Analysis */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                  <span className="text-sky-400 font-bold flex items-center gap-1">
                    <span>2-Min Micro Trigger</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    (signal.candleAnalysis.m2Score ?? signal.candleAnalysis.m2.momentumScore) > 0 ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' :
                    (signal.candleAnalysis.m2Score ?? signal.candleAnalysis.m2.momentumScore) < 0 ? 'text-rose-400 bg-rose-500/15 border border-rose-500/30' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {(signal.candleAnalysis.m2Score ?? signal.candleAnalysis.m2.momentumScore) > 0 ? '+' : ''}
                    {(signal.candleAnalysis.m2Score ?? signal.candleAnalysis.m2.momentumScore)}/10
                  </span>
                </div>
                
                {/* Visual Momentum Progress Bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      (signal.candleAnalysis.m2Score ?? signal.candleAnalysis.m2.momentumScore) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(10, Math.abs(signal.candleAnalysis.m2Score ?? signal.candleAnalysis.m2.momentumScore) * 10))}%` }}
                  />
                </div>

                <div className="font-bold text-slate-200 text-xs mt-0.5">
                  {signal.candleAnalysis.m2.pattern.replace(/2m\s*/, '')}
                </div>
              </div>
              
              <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10.5px] font-mono text-slate-400 flex items-center justify-between">
                <span>Support: <strong className="text-slate-200">{ticker.currency}{signal.candleAnalysis.m2.support.toLocaleString()}</strong></span>
                <span>Resist: <strong className="text-slate-200">{ticker.currency}{signal.candleAnalysis.m2.resistance.toLocaleString()}</strong></span>
              </div>
            </div>

            {/* 5-Minute Candle Momentum Analysis */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                  <span className="text-emerald-400 font-bold flex items-center gap-1">
                    <span>5-Min Tactical Trend</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    (signal.candleAnalysis.m5Score ?? signal.candleAnalysis.m5.momentumScore) > 0 ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' :
                    (signal.candleAnalysis.m5Score ?? signal.candleAnalysis.m5.momentumScore) < 0 ? 'text-rose-400 bg-rose-500/15 border border-rose-500/30' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {(signal.candleAnalysis.m5Score ?? signal.candleAnalysis.m5.momentumScore) > 0 ? '+' : ''}
                    {(signal.candleAnalysis.m5Score ?? signal.candleAnalysis.m5.momentumScore)}/10
                  </span>
                </div>

                {/* Visual Momentum Progress Bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      (signal.candleAnalysis.m5Score ?? signal.candleAnalysis.m5.momentumScore) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(10, Math.abs(signal.candleAnalysis.m5Score ?? signal.candleAnalysis.m5.momentumScore) * 10))}%` }}
                  />
                </div>

                <div className="font-bold text-slate-200 text-xs mt-0.5">
                  {signal.candleAnalysis.m5.pattern.replace(/5m\s*/, '')}
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10.5px] font-mono text-slate-400 flex items-center justify-between">
                <span>Swing Target: <strong className="text-emerald-400">{ticker.currency}{signal.candleAnalysis.derivedExitLevel1.toLocaleString()}</strong></span>
                <span>ATR: <strong className="text-slate-300">{ticker.currency}{signal.candleAnalysis.m5.atr}</strong></span>
              </div>
            </div>

            {/* 15-Minute Candle Momentum Analysis */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1.5">
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <span>15-Min Structure Anchor</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                    (signal.candleAnalysis.m15Score ?? signal.candleAnalysis.m15.momentumScore) > 0 ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/30' :
                    (signal.candleAnalysis.m15Score ?? signal.candleAnalysis.m15.momentumScore) < 0 ? 'text-rose-400 bg-rose-500/15 border border-rose-500/30' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {(signal.candleAnalysis.m15Score ?? signal.candleAnalysis.m15.momentumScore) > 0 ? '+' : ''}
                    {(signal.candleAnalysis.m15Score ?? signal.candleAnalysis.m15.momentumScore)}/10
                  </span>
                </div>

                {/* Visual Momentum Progress Bar */}
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mb-2">
                  <div 
                    className={`h-full transition-all duration-500 ${
                      (signal.candleAnalysis.m15Score ?? signal.candleAnalysis.m15.momentumScore) >= 0 ? 'bg-emerald-500' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(10, Math.abs(signal.candleAnalysis.m15Score ?? signal.candleAnalysis.m15.momentumScore) * 10))}%` }}
                  />
                </div>

                <div className="font-bold text-slate-200 text-xs mt-0.5">
                  {signal.candleAnalysis.m15.pattern.replace(/15m\s*/, '')}
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-800/80 text-[10.5px] font-mono text-slate-400 flex items-center justify-between">
                <span>Runner Target: <strong className="text-sky-400">{ticker.currency}{signal.candleAnalysis.derivedExitLevel2.toLocaleString()}</strong></span>
                <span>ATR: <strong className="text-slate-300">{ticker.currency}{signal.candleAnalysis.m15.atr}</strong></span>
              </div>
            </div>
          </div>

          <div className="mt-2.5 pt-2 border-t border-slate-800/70 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-2">
            <span>Pattern Confluence: <strong className="text-slate-200">{signal.candleAnalysis.confluencePattern}</strong></span>
            <span className="font-mono">
              Pattern Invalidation Stop: <strong className="text-rose-400">{ticker.currency}{signal.candleAnalysis.invalidationLevel.toLocaleString()}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Real-Time News Impact Multiplier & Grounded Confluence Architecture */}
      {signal.targetExitSynthesis && (
        <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                High-Probability Swing & News Multiplier Engine
              </span>
            </div>
            {signal.targetExitSynthesis.newsMultiplierData && (
              <div className="flex items-center gap-2 text-[11px] font-mono">
                <span className="text-slate-400">News Multiplier:</span>
                <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {signal.targetExitSynthesis.newsMultiplierData.netNewsImpactMultiplier}x Swing Factor
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
            {/* Pillar A: Live & Last Night News Multiplier */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                  <span className="text-amber-400 font-bold flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    Real-Time News Multipliers
                  </span>
                  <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    signal.targetExitSynthesis.newsPillar.netNewsBiasScore > 0 ? 'text-emerald-400 bg-emerald-500/10' :
                    signal.targetExitSynthesis.newsPillar.netNewsBiasScore < 0 ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {signal.targetExitSynthesis.newsPillar.netNewsBiasScore > 0 ? '+' : ''}{signal.targetExitSynthesis.newsPillar.netNewsBiasScore} Net
                  </span>
                </div>
                
                <div className="space-y-1.5 mt-1.5">
                  <div className="text-[11px] leading-tight">
                    <span className="text-slate-500 font-mono block text-[10px] uppercase">Overnight Anchor ({signal.targetExitSynthesis.newsMultiplierData?.overnightMultiplier ?? 1.0}x):</span>
                    <span className="text-slate-300 font-medium line-clamp-1" title={signal.targetExitSynthesis.newsPillar.overnightHeadline}>
                      {signal.targetExitSynthesis.newsPillar.overnightHeadline}
                    </span>
                  </div>
                  <div className="text-[11px] leading-tight">
                    <span className="text-slate-500 font-mono block text-[10px] uppercase">Live Breaking Catalyst ({signal.targetExitSynthesis.newsMultiplierData?.liveBreakingMultiplier ?? 1.0}x):</span>
                    <span className="text-slate-300 font-medium line-clamp-1" title={signal.targetExitSynthesis.newsPillar.liveHeadline}>
                      {signal.targetExitSynthesis.newsPillar.liveHeadline}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10.5px] font-mono text-emerald-400">
                {signal.targetExitSynthesis.newsPillar.newsTargetImpact}
              </div>
            </div>

            {/* Pillar B: Previous Multi-Session Trend & Volatility */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                  <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5" />
                    Trend & Measured Volatility
                  </span>
                  <span className="text-slate-400 text-[10px] font-mono">
                    {signal.targetExitSynthesis.trendPillar.trendContinuationProb}% Prob
                  </span>
                </div>

                <div className="space-y-1 mt-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Session Drift:</span>
                    <strong className="text-slate-200">{signal.targetExitSynthesis.trendPillar.prevSessionTrend}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Day Range Established:</span>
                    <strong className="text-slate-200 font-mono">{ticker.currency}{signal.targetExitSynthesis.trendPillar.dayRange} pts</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Daily Expected Move (ATR):</span>
                    <strong className="text-slate-200 font-mono">±{ticker.currency}{signal.targetExitSynthesis.trendPillar.atrDaily} pts</strong>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10.5px] font-mono text-slate-300">
                Velocity: <span className="text-emerald-400 font-semibold">{signal.targetExitSynthesis.trendPillar.momentumVerdict}</span>
              </div>
            </div>

            {/* Pillar C: Option Chart Data & Greeks Engine */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                  <span className="text-sky-400 font-bold flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5" />
                    Option Chart Data & Greeks
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    PCR {signal.targetExitSynthesis.optionChartPillar.pcrTotalOI.toFixed(2)}
                  </span>
                </div>

                <div className="space-y-1 mt-1 text-[11px] font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Institutional Call Wall:</span>
                    <strong className="text-rose-400">{ticker.currency}{signal.targetExitSynthesis.optionChartPillar.callWall.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Institutional Put Wall:</span>
                    <strong className="text-emerald-400">{ticker.currency}{signal.targetExitSynthesis.optionChartPillar.putWall.toLocaleString()}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-sans">Max Pain Anchor:</span>
                    <strong className="text-sky-400">{ticker.currency}{signal.targetExitSynthesis.optionChartPillar.maxPain.toLocaleString()}</strong>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-1.5 border-t border-slate-800/80 text-[10.5px] font-mono text-slate-400 flex justify-between">
                <span>Δ Gain: <strong className="text-emerald-400">+{ticker.currency}{signal.targetExitSynthesis.optionChartPillar.deltaExpansion}</strong></span>
                <span>Γ Accel: <strong className="text-sky-400">+{ticker.currency}{signal.targetExitSynthesis.optionChartPillar.gammaAcceleration}</strong></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Real-Time Quantitative Parameters & Engine Tuning */}
      {signal.realtimeIndicators && (
        <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Real-Time Quantitative Parameters & Predictive Tuning
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
              <span className="text-slate-500">Confluence Engine:</span>
              <span className="text-emerald-400 font-bold">7-Pillar Live Alignment</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
            {/* 1. Intraday VWAP & Bands */}
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-semibold mb-0.5">
                  <span className="text-sky-400 flex items-center gap-1 font-bold">
                    <Compass className="w-3 h-3" /> Intraday VWAP
                  </span>
                  <span className={`px-1 py-0.2 rounded text-[9.5px] font-mono font-bold ${
                    signal.realtimeIndicators.vwap.bias === 'BULLISH' ? 'text-emerald-400 bg-emerald-500/10' :
                    signal.realtimeIndicators.vwap.bias === 'BEARISH' ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {signal.realtimeIndicators.vwap.distancePercent > 0 ? '+' : ''}{signal.realtimeIndicators.vwap.distancePercent}%
                  </span>
                </div>
                <div className="font-mono font-bold text-slate-100 text-xs">
                  {ticker.currency}{signal.realtimeIndicators.vwap.value.toLocaleString()}
                </div>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-800 text-[9.5px] text-slate-400 truncate" title={signal.realtimeIndicators.vwap.statusLabel}>
                {signal.realtimeIndicators.vwap.statusLabel}
              </div>
            </div>

            {/* 2. 5m RSI (14) & Divergence */}
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-semibold mb-0.5">
                  <span className="text-emerald-400 flex items-center gap-1 font-bold">
                    <Activity className="w-3 h-3" /> 5m RSI (14)
                  </span>
                  <span className={`px-1 py-0.2 rounded text-[9.5px] font-mono font-bold ${
                    signal.realtimeIndicators.rsi.condition === 'BULLISH' ? 'text-emerald-400 bg-emerald-500/10' :
                    signal.realtimeIndicators.rsi.condition === 'BEARISH' ? 'text-rose-400 bg-rose-500/10' :
                    signal.realtimeIndicators.rsi.condition === 'OVERBOUGHT' ? 'text-amber-400 bg-amber-500/10' :
                    signal.realtimeIndicators.rsi.condition === 'OVERSOLD' ? 'text-purple-400 bg-purple-500/10' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {signal.realtimeIndicators.rsi.condition}
                  </span>
                </div>
                <div className="flex items-center justify-between font-mono">
                  <span className="font-bold text-slate-100 text-xs">{signal.realtimeIndicators.rsi.value.toFixed(1)}</span>
                  {signal.realtimeIndicators.rsi.divergence !== 'NONE' && (
                    <span className="text-[9px] font-bold text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/30">
                      {signal.realtimeIndicators.rsi.divergence.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
              <div className="w-full bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                <div 
                  className={`h-full ${
                    signal.realtimeIndicators.rsi.value >= 60 ? 'bg-emerald-500' :
                    signal.realtimeIndicators.rsi.value <= 40 ? 'bg-rose-500' : 'bg-sky-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, signal.realtimeIndicators.rsi.value))}%` }}
                />
              </div>
            </div>

            {/* 3. 5m MACD (12, 26, 9) */}
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-semibold mb-0.5">
                  <span className="text-purple-400 flex items-center gap-1 font-bold">
                    <BarChart2 className="w-3 h-3" /> 5m MACD (12,26,9)
                  </span>
                  <span className={`px-1 py-0.2 rounded text-[9.5px] font-mono font-bold ${
                    signal.realtimeIndicators.macd.histogram >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'
                  }`}>
                    {signal.realtimeIndicators.macd.histogram >= 0 ? '+' : ''}{signal.realtimeIndicators.macd.histogram}
                  </span>
                </div>
                <div className="font-mono font-bold text-slate-100 text-xs truncate">
                  {signal.realtimeIndicators.macd.label}
                </div>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-800 text-[9.5px] font-mono text-slate-400 flex justify-between">
                <span>Line: {signal.realtimeIndicators.macd.macdLine}</span>
                <span>Sig: {signal.realtimeIndicators.macd.signalLine}</span>
              </div>
            </div>

            {/* 4. 9/21 EMA Institutional Stack */}
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-semibold mb-0.5">
                  <span className="text-amber-400 flex items-center gap-1 font-bold">
                    <Zap className="w-3 h-3" /> 9/21 EMA Stack
                  </span>
                  <span className={`px-1 py-0.2 rounded text-[9.5px] font-mono font-bold ${
                    signal.realtimeIndicators.ema.alignment === 'BULLISH_STACK' ? 'text-emerald-400 bg-emerald-500/10' :
                    signal.realtimeIndicators.ema.alignment === 'BEARISH_STACK' ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {signal.realtimeIndicators.ema.spread > 0 ? '+' : ''}{signal.realtimeIndicators.ema.spread}
                  </span>
                </div>
                <div className="font-mono font-bold text-slate-100 text-xs truncate">
                  {signal.realtimeIndicators.ema.label}
                </div>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-800 text-[9.5px] font-mono text-slate-400 flex justify-between">
                <span>9 EMA: {signal.realtimeIndicators.ema.ema9.toLocaleString()}</span>
                <span>21: {signal.realtimeIndicators.ema.ema21.toLocaleString()}</span>
              </div>
            </div>

            {/* 5. Option Gamma Exposure (GEX) */}
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-semibold mb-0.5">
                  <span className="text-cyan-400 flex items-center gap-1 font-bold">
                    <Gauge className="w-3 h-3" /> Gamma (GEX) Regime
                  </span>
                  <span className={`px-1 py-0.2 rounded text-[9.5px] font-mono font-bold ${
                    signal.realtimeIndicators.gammaExposure.regime === 'POSITIVE_GAMMA' 
                      ? 'text-emerald-400 bg-emerald-500/10' 
                      : 'text-amber-400 bg-amber-500/10'
                  }`}>
                    {signal.realtimeIndicators.gammaExposure.regime.replace(/_GAMMA/, '')}
                  </span>
                </div>
                <div className="font-mono font-bold text-slate-100 text-xs">
                  Net: {signal.realtimeIndicators.gammaExposure.netGex.toLocaleString()}
                </div>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-800 text-[9.5px] font-mono text-slate-400">
                Flip Strike: <strong className="text-slate-200">{ticker.currency}{signal.realtimeIndicators.gammaExposure.flipStrike.toLocaleString()}</strong>
              </div>
            </div>

            {/* 6. Order Flow Delta & Imbalance */}
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-semibold mb-0.5">
                  <span className="text-indigo-400 flex items-center gap-1 font-bold">
                    <Activity className="w-3 h-3" /> Order Flow Delta
                  </span>
                  <span className={`px-1 py-0.2 rounded text-[9.5px] font-mono font-bold ${
                    signal.realtimeIndicators.orderFlow.sentiment === 'BUYER_DOMINANCE' ? 'text-emerald-400 bg-emerald-500/10' :
                    signal.realtimeIndicators.orderFlow.sentiment === 'SELLER_DOMINANCE' ? 'text-rose-400 bg-rose-500/10' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {signal.realtimeIndicators.orderFlow.volumeImbalancePercent > 0 ? '+' : ''}{signal.realtimeIndicators.orderFlow.volumeImbalancePercent}%
                  </span>
                </div>
                <div className="font-mono font-bold text-slate-100 text-xs">
                  Δ {signal.realtimeIndicators.orderFlow.orderFlowDelta > 0 ? '+' : ''}{signal.realtimeIndicators.orderFlow.orderFlowDelta.toLocaleString()}
                </div>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-800 text-[9.5px] font-mono text-slate-400 flex justify-between">
                <span>PCR Vol-OI Div:</span>
                <strong className={signal.realtimeIndicators.orderFlow.pcrDivergence > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                  {signal.realtimeIndicators.orderFlow.pcrDivergence > 0 ? '+' : ''}{signal.realtimeIndicators.orderFlow.pcrDivergence}
                </strong>
              </div>
            </div>

            {/* 7. VIX Volatility Velocity */}
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800 flex flex-col justify-between col-span-2 sm:col-span-1">
              <div>
                <div className="flex items-center justify-between text-[10.5px] text-slate-400 font-semibold mb-0.5">
                  <span className="text-rose-400 flex items-center gap-1 font-bold">
                    <Radio className="w-3 h-3" /> VIX Velocity
                  </span>
                  <span className={`px-1 py-0.2 rounded text-[9.5px] font-mono font-bold ${
                    signal.realtimeIndicators.vixVelocity.velocityState === 'SURGING' ? 'text-rose-400 bg-rose-500/10' :
                    signal.realtimeIndicators.vixVelocity.velocityState === 'EXPANDING' ? 'text-amber-400 bg-amber-500/10' :
                    signal.realtimeIndicators.vixVelocity.velocityState === 'COMPRESSING' ? 'text-emerald-400 bg-emerald-500/10' : 'text-slate-400 bg-slate-800'
                  }`}>
                    {signal.realtimeIndicators.vixVelocity.velocityState}
                  </span>
                </div>
                <div className="font-mono font-bold text-slate-100 text-xs">
                  {signal.realtimeIndicators.vixVelocity.vix} ({signal.realtimeIndicators.vixVelocity.vixPercentChange > 0 ? '+' : ''}{signal.realtimeIndicators.vixVelocity.vixPercentChange}%)
                </div>
              </div>
              <div className="mt-1 pt-1 border-t border-slate-800 text-[9.5px] text-slate-400 truncate" title={signal.realtimeIndicators.vixVelocity.impactOnOptions}>
                {signal.realtimeIndicators.vixVelocity.impactOnOptions}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grounded High-Probability Entry & Exit Grounding Analytics */}
      {signal.targetExitSynthesis?.entryExitGrounding && (
        <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Grounded Target Entry & Exit Payoff Derivation
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
              <span>Risk Per Lot:</span>
              <strong className="text-rose-400">{ticker.currency}{signal.targetExitSynthesis.entryExitGrounding.riskPerLot.toLocaleString()}</strong>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs font-mono">
            {/* Target 1 Payoff */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-emerald-500/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] text-emerald-400 font-sans font-bold mb-1">
                  <span>Target 1 (Tactical Swing)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 font-mono">
                    {signal.targetExitSynthesis.entryExitGrounding.target1Probability}% Prob
                  </span>
                </div>
                <div className="text-sm font-bold text-white mb-1">
                  Spot: {ticker.currency}{signal.targetExitSynthesis.entryExitGrounding.target1SpotLevel.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-slate-400 font-sans leading-tight">
                  {signal.targetExitSynthesis.entryExitGrounding.target1SwingBasis}
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-300 flex justify-between">
                <span>Δ Payoff: <strong className="text-emerald-400">+{ticker.currency}{signal.targetExitSynthesis.entryExitGrounding.target1DeltaContr}</strong></span>
                <span>Γ Accel: <strong className="text-sky-400">+{ticker.currency}{signal.targetExitSynthesis.entryExitGrounding.target1GammaContr}</strong></span>
              </div>
            </div>

            {/* Target 2 Payoff */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-sky-500/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] text-sky-400 font-sans font-bold mb-1">
                  <span>Target 2 (Structural Runner)</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-300 font-mono">
                    {signal.targetExitSynthesis.entryExitGrounding.target2Probability}% Prob
                  </span>
                </div>
                <div className="text-sm font-bold text-white mb-1">
                  Spot: {ticker.currency}{signal.targetExitSynthesis.entryExitGrounding.target2SpotLevel.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-slate-400 font-sans leading-tight">
                  {signal.targetExitSynthesis.entryExitGrounding.target2SwingBasis}
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-300 flex justify-between">
                <span>Δ Payoff: <strong className="text-emerald-400">+{ticker.currency}{signal.targetExitSynthesis.entryExitGrounding.target2DeltaContr}</strong></span>
                <span>Γ Accel: <strong className="text-sky-400">+{ticker.currency}{signal.targetExitSynthesis.entryExitGrounding.target2GammaContr}</strong></span>
              </div>
            </div>

            {/* Invalidation Stop Loss */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-rose-500/20 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-[11px] text-rose-400 font-sans font-bold mb-1">
                  <span>Structural Invalidation SL</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-500/10 text-rose-300 font-mono">
                    Risk Limit
                  </span>
                </div>
                <div className="text-sm font-bold text-rose-400 mb-1">
                  Spot: {ticker.currency}{signal.targetExitSynthesis.entryExitGrounding.stopLossSpotLevel.toLocaleString()}
                </div>
                <div className="text-[10.5px] text-slate-400 font-sans leading-tight">
                  {signal.targetExitSynthesis.entryExitGrounding.stopLossBasis}
                </div>
              </div>
              <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10px] text-slate-300 flex justify-between">
                <span>Max Drawdown:</span>
                <strong className="text-rose-400">-{ticker.currency}{signal.targetExitSynthesis.entryExitGrounding.maxRiskAmount.toLocaleString()}</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nifty Derivative Heavyweight Companies & Sectoral Breadth (Indian Markets) */}
      {signal.constituentAnalysis && (
        <div className="mt-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-2 border-b border-slate-800/80">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <BarChart2 className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-bold text-white uppercase tracking-wider">
                Nifty 50 Derivative Heavyweights & Sectoral Breadth
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono">
              <span className="text-slate-400">Heavyweight Bias:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                signal.constituentAnalysis.overallHeavyweightBias.includes('BULLISH') ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                signal.constituentAnalysis.overallHeavyweightBias.includes('BEARISH') ? 'bg-rose-500/15 text-rose-300 border-rose-500/30' :
                'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}>
                {signal.constituentAnalysis.overallHeavyweightBias.replace(/_/g, ' ')} ({signal.constituentAnalysis.breadthScore > 0 ? '+' : ''}{signal.constituentAnalysis.breadthScore}/10)
              </span>
            </div>
          </div>

          {/* Heavyweight Breadth Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5 text-xs font-mono">
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">Constituent A/D</span>
              <span className="text-xs font-bold text-emerald-400">
                {signal.constituentAnalysis.advances} Adv <span className="text-slate-500">/</span> <span className="text-rose-400">{signal.constituentAnalysis.declines} Dec</span>
              </span>
            </div>
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">Weighted Delta</span>
              <span className={`text-xs font-bold ${signal.constituentAnalysis.weightedConstituentDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {signal.constituentAnalysis.weightedConstituentDelta >= 0 ? '+' : ''}{signal.constituentAnalysis.weightedConstituentDelta}%
              </span>
            </div>
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">Net Point Impact</span>
              <span className={`text-xs font-bold ${signal.constituentAnalysis.netNiftyPointImpact >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {signal.constituentAnalysis.netNiftyPointImpact >= 0 ? '+' : ''}{signal.constituentAnalysis.netNiftyPointImpact} pts
              </span>
            </div>
            <div className="p-2 rounded bg-slate-900/90 border border-slate-800">
              <span className="text-[10px] text-slate-400 uppercase block font-sans">Advance Ratio</span>
              <span className="text-xs font-bold text-sky-400">
                {signal.constituentAnalysis.advancesDeclinesRatio}x
              </span>
            </div>
          </div>

          {/* Top Gainers and Draggers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {/* Top Leaders */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-emerald-500/20">
              <span className="text-[10.5px] font-bold text-emerald-400 flex items-center justify-between mb-1.5 font-sans">
                <span className="flex items-center gap-1">
                  <ArrowUpRight className="w-3.5 h-3.5" /> Top Index Leaders (Heavyweights)
                </span>
                <span className="text-[10px] font-mono text-emerald-400/80">Support Pillars</span>
              </span>
              <div className="space-y-1 font-mono text-[11px]">
                {signal.constituentAnalysis.topGainers.map(g => (
                  <div key={g.symbol} className="flex justify-between items-center py-0.5 border-b border-slate-800/50 last:border-0">
                    <span className="text-slate-200 font-bold">{g.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400 font-semibold">+{g.changePercent}%</span>
                      <span className="text-[10px] px-1 rounded bg-emerald-500/10 text-emerald-300">+{g.points} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Laggards */}
            <div className="p-2.5 rounded bg-slate-900/90 border border-rose-500/20">
              <span className="text-[10.5px] font-bold text-rose-400 flex items-center justify-between mb-1.5 font-sans">
                <span className="flex items-center gap-1">
                  <ArrowDownRight className="w-3.5 h-3.5" /> Index Laggards & Resistance
                </span>
                <span className="text-[10px] font-mono text-rose-400/80">Draggers</span>
              </span>
              <div className="space-y-1 font-mono text-[11px]">
                {signal.constituentAnalysis.topDraggers.map(d => (
                  <div key={d.symbol} className="flex justify-between items-center py-0.5 border-b border-slate-800/50 last:border-0">
                    <span className="text-slate-200 font-bold">{d.symbol}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-rose-400 font-semibold">{d.changePercent}%</span>
                      <span className="text-[10px] px-1 rounded bg-rose-500/10 text-rose-300">{d.points} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sectoral Breakdown Corridor */}
          <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5 text-[10.5px] font-mono">
            <span className="text-slate-400 font-sans mr-1">Sector Contributions:</span>
            {signal.constituentAnalysis.sectoralBreakdown.slice(0, 5).map(s => (
              <span 
                key={s.sector}
                className={`px-2 py-0.5 rounded border text-[10px] flex items-center gap-1 ${
                  s.sentiment === 'BULLISH' ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30' :
                  s.sentiment === 'BEARISH' ? 'bg-rose-950/40 text-rose-300 border-rose-500/30' :
                  'bg-slate-900 text-slate-300 border-slate-700'
                }`}
              >
                <strong>{s.sector}</strong> ({s.weight}%): {s.contributionPoints >= 0 ? '+' : ''}{s.contributionPoints} pts ({s.leadingStock})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Trade Rationale */}
      <div className="mt-3 p-2.5 sm:p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs leading-relaxed text-slate-300">
        <span className="font-bold text-white mr-1.5">Trade Rationale:</span>
        {signal.summaryNote}
      </div>
    </div>
  );
};
