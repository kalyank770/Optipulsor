import React, { useState } from 'react';
import { 
  AdvanceTradeSetup, 
  TickerConfig, 
  MarketMetrics, 
  OptionChainRow,
  LeadingPredictorFactor,
  TradeSignal
} from '../types/options';
import { MarketHoursStatus } from '../utils/marketHours';
import { MoneynessBadge, getMoneyness } from './MoneynessBadge';
import { 
  Zap, 
  ShieldCheck, 
  Target, 
  ArrowUpRight, 
  ArrowDownRight, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Layers, 
  Gauge, 
  ChevronDown, 
  ChevronUp, 
  PlayCircle, 
  Globe,
  FileCheck2,
  Copy,
  CheckCircle2,
  Minus,
  Circle,
  Flame
} from 'lucide-react';
import { SmcPriceActionCard } from './SmcPriceActionCard';

interface AdvanceTradeCardProps {
  setup: AdvanceTradeSetup;
  signal?: TradeSignal;
  ticker: TickerConfig;
  metrics: MarketMetrics;
  chain?: OptionChainRow[];
  marketStatus?: MarketHoursStatus;
  usePreMarket?: boolean;
  onTogglePreMarket?: () => void;
  onSelectContractForSimulation: (strike: number, type: 'CE' | 'PE') => void;
  onSelectTab?: (tab: string) => void;
  theme?: 'dark' | 'light';
  isCompact?: boolean;
}

export const AdvanceTradeCard: React.FC<AdvanceTradeCardProps> = ({
  setup,
  signal,
  ticker,
  metrics,
  chain,
  marketStatus,
  usePreMarket = false,
  onTogglePreMarket,
  onSelectContractForSimulation,
  onSelectTab,
  theme = 'dark',
  isCompact = false,
}) => {
  const isLight = theme === 'light';
  // Collapsed by default as requested
  const [showRadarDetails, setShowRadarDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeCategoryTab, setActiveCategoryTab] = useState<'ALL' | 'DERIVATIVES_MICROSTRUCTURE' | 'PRICE_ACTION_MOMENTUM' | 'MACRO_TIMEFRAME'>('ALL');

  const isSignalWait = signal?.action === 'WAIT_NEUTRAL';
  const isSetupWait = setup.anticipatedAction === 'WAIT_NEUTRAL';
  const isBull = signal ? signal.action === 'BUY_CE' : setup.anticipatedAction === 'BUY_CE';
  const isBear = signal ? signal.action === 'BUY_PE' : setup.anticipatedAction === 'BUY_PE';
  const isWait = !isBull && !isBear;
  const isSideways = isWait || Boolean(signal?.sidewaysMarketAnalysis?.isSideways && isWait);

  // Trade lifecycle stages & Stop Loss Cooldown Guard
  const isCooldown = Boolean(signal?.stopLossCooldownUntil && Date.now() < signal.stopLossCooldownUntil);
  const cooldownSeconds = isCooldown ? Math.max(1, Math.ceil(((signal?.stopLossCooldownUntil || 0) - Date.now()) / 1000)) : 0;
  const stage = signal?.tradeStage || 'FRESH_ENTRY';
  const isRetracing = stage === 'POST_TARGET_RETRACEMENT';
  const isTarget1Captured = stage === 'TARGET_1_HIT';
  const isTarget2Captured = stage === 'TARGET_2_HIT';
  const isStopLossBreached = stage === 'STOP_LOSS_HIT' || isCooldown;

  // Spot buffer for invalidation
  const spotBuffer = ticker.currency === '$' ? 1.5 : (ticker.symbol.includes('BANK') ? 60 : 25);
  const effectiveSpotStopLoss = isBear
    ? (setup.advanceStopLossSpot > ticker.spotPrice ? setup.advanceStopLossSpot : Number((ticker.spotPrice + spotBuffer).toFixed(2)))
    : (setup.advanceStopLossSpot < ticker.spotPrice ? setup.advanceStopLossSpot : Number((ticker.spotPrice - spotBuffer).toFixed(2)));

  // Find live option LTP
  const contractRow = chain?.find(r => r.strike === setup.recommendedStrike);
  const liveOption = setup.recommendedType === 'CE' ? contractRow?.ce : contractRow?.pe;
  const currentLTP = liveOption && liveOption.ltp > 0.05
    ? liveOption.ltp
    : (signal?.recommendedContractLTP && signal.recommendedContractLTP > 0.05 ? signal.recommendedContractLTP : (setup.advanceEntryOptionRange?.[0] || 50.00));

  // Harmonize Entry Range, Stop Loss, and Targets directly with the signal engine's anchored levels
  const optEntryLow = signal?.entryRange ? signal.entryRange[0] : (setup.advanceEntryOptionRange ? setup.advanceEntryOptionRange[0] : currentLTP);
  const optEntryHigh = signal?.entryRange ? signal.entryRange[1] : (setup.advanceEntryOptionRange ? setup.advanceEntryOptionRange[1] : currentLTP);
  
  // Harmonized targets bounded to genuine option price physics
  const candidateT1 = (signal?.target1 && signal.target1 > currentLTP && signal.target1 <= currentLTP * 1.65)
    ? signal.target1
    : (setup.advanceOptionTarget1 && setup.advanceOptionTarget1 > currentLTP && setup.advanceOptionTarget1 <= currentLTP * 1.65)
    ? setup.advanceOptionTarget1
    : Number((currentLTP * 1.30).toFixed(2));

  const candidateT2 = (signal?.target2 && signal.target2 >= candidateT1 + Math.max(0.30, (candidateT1 - currentLTP) * 0.35) && signal.target2 <= currentLTP * 2.1)
    ? signal.target2
    : (setup.advanceOptionTarget2 && setup.advanceOptionTarget2 >= candidateT1 + Math.max(0.30, (candidateT1 - currentLTP) * 0.35) && setup.advanceOptionTarget2 <= currentLTP * 2.1)
    ? setup.advanceOptionTarget2
    : Number((currentLTP + Math.max(0.60, (candidateT1 - currentLTP) * 1.65)).toFixed(2));

  const optTarget1 = candidateT1;
  const optTarget2 = candidateT2;
  const initialOptSL = Math.max(0.05, Math.min(signal?.stopLoss || setup.advanceOptionStopLoss, Math.max(0.05, currentLTP * 0.80)));
  const trailedOptSL = signal?.trailingStopLoss;
  const isProfitLocked = Boolean(trailedOptSL && trailedOptSL > initialOptSL);
  const optStopLoss = isProfitLocked ? trailedOptSL! : initialOptSL;
  const optRisk = Math.max(0.5, currentLTP - optStopLoss);
  const optReward = Math.max(0.5, optTarget1 - currentLTP);
  const rawCalculatedRR = Number((optReward / optRisk).toFixed(1));
  const optRR = (rawCalculatedRR >= 1.0 && rawCalculatedRR <= 5.0)
    ? `1 : ${rawCalculatedRR}`
    : (signal?.riskRewardRatio && !signal.riskRewardRatio.includes('NaN') ? signal.riskRewardRatio : `1 : ${rawCalculatedRR}`);

  const effectiveMoneyness = setup.moneyness || signal?.moneyness || getMoneyness(setup.recommendedStrike, setup.recommendedType, ticker.spotPrice, ticker.strikeStep);

  const candle = signal?.candleAnalysis;
  const candleScore = candle?.confluenceScore ?? 0;
  const candleBias = candle?.confluenceBias || 'NEUTRAL';

  // Verify tactical timeframes (1m, 2m, 5m) actually agree with trade direction
  const m1V = candle?.m1Score ?? candle?.m1?.momentumScore ?? 0;
  const m2V = candle?.m2Score ?? candle?.m2?.momentumScore ?? 0;
  const m5V = candle?.m5Score ?? candle?.m5?.momentumScore ?? 0;
  
  const isTacticalBullish = m1V >= -0.5 && m2V >= -0.5 && m5V >= -0.5;
  const isTacticalBearish = m1V <= 0.5 && m2V <= 0.5 && m5V <= 0.5;

  const isCandleInlinedWithTrade = 
    (isBull && candleBias === 'BULLISH' && isTacticalBullish) ||
    (isBear && candleBias === 'BEARISH' && isTacticalBearish) ||
    (isWait && candleBias === 'NEUTRAL');

  const handleCopy = () => {
    const text = `OptiPulse Signal: ${isBull ? 'CALL (CE)' : isBear ? 'PUT (PE)' : 'NEUTRAL'}\nTicker: ${ticker.symbol} (Spot: ${ticker.currency}${ticker.spotPrice.toLocaleString()})\nRecommended: ${setup.recommendedStrike} ${setup.recommendedType} (${effectiveMoneyness}) @ ${ticker.currency}${currentLTP.toFixed(2)}\nConfidence: ${setup.probabilityScore}%\nTarget 1: ${ticker.currency}${optTarget1.toFixed(2)}\nTarget 2: ${ticker.currency}${optTarget2.toFixed(2)}\nStop Loss: ${ticker.currency}${optStopLoss.toFixed(2)}\nR:R: ${optRR}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFactorBadgeColor = (state: LeadingPredictorFactor['state']) => {
    switch (state) {
      case 'STRONG_BULLISH':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      case 'MODERATE_BULLISH':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'STRONG_BEARISH':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'MODERATE_BEARISH':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className={`rounded-xl border p-4 sm:p-5 transition-all shadow-lg relative overflow-hidden ${
      isLight 
        ? 'bg-gradient-to-br from-indigo-50/50 via-white to-amber-50/30 border-indigo-200 text-slate-900' 
        : 'bg-gradient-to-br from-indigo-950/40 via-slate-900 to-slate-950 border-indigo-500/30 text-slate-100'
    }`}>
      {/* Background Ambient Glow */}
      <div className={`absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20 ${
        isBull ? 'bg-emerald-500/10' : isBear ? 'bg-rose-500/10' : 'bg-indigo-500/10'
      }`} />

      {/* Unified Top Header & Recommendation Area */}
      <div className="flex flex-col gap-2.5 pb-3.5 border-b border-indigo-500/20 relative z-10">
        {/* Top Metadata Row: Mode Title, Copy, Spot Price & Confidence */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold font-mono uppercase tracking-wider text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/60">
              {marketStatus?.isHoliday 
                ? `Next Session Prediction (${marketStatus.nextTradingDayName || 'Monday'})`
                : marketStatus && !marketStatus.isOpen 
                ? "Next Session Prediction" 
                : 'Early Signal Engine'}
            </span>

            {/* Compact Copy Button */}
            <button
              onClick={handleCopy}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer flex items-center justify-center shrink-0"
              title="Copy Trade Recommendation Details"
            >
              {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-400 hover:text-slate-200" />}
            </button>

            <span className="text-slate-600">·</span>
            <span className="font-mono text-slate-300">
              {marketStatus?.isOpen && !marketStatus?.isHoliday ? 'Live Spot:' : 'Spot:'} <strong className="text-white">{ticker.currency}{ticker.spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
            </span>
          </div>

          <span className="text-xs text-slate-300 font-mono">
            Confidence: <strong className={`${isStopLossBreached ? 'text-rose-400' : isWait ? 'text-amber-400' : 'text-emerald-400'} font-bold`}>
              {isStopLossBreached ? 'STAND ASIDE' : isWait ? `${signal?.confidence || 50}%` : `${signal?.confidence || setup.probabilityScore}%`}
            </strong>
          </span>
        </div>

        {/* Main Recommendation Row: Directional Icon, Headline, Regime Badge & Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1">
          <div className="flex items-start sm:items-center gap-3">
            {/* Directional Icon Box */}
            <div className={`p-2.5 sm:p-3 rounded-lg flex items-center justify-center shrink-0 border ${
              isStopLossBreached ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-xs shadow-rose-500/20' :
              isRetracing ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-xs shadow-amber-500/20' :
              isTarget1Captured || isTarget2Captured ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-xs shadow-emerald-500/20' :
              isBull ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 shadow-xs shadow-emerald-500/20' :
              isBear ? 'bg-rose-500/20 text-rose-400 border-rose-500/40 shadow-xs shadow-rose-500/20' :
              isSideways ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-xs shadow-amber-500/20' :
              'bg-slate-800 text-slate-400 border-slate-700'
            }`}>
              {isStopLossBreached ? (
                <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 stroke-[2.5] shrink-0" />
              ) : isRetracing ? (
                <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 stroke-[2.5] shrink-0" />
              ) : isBull ? (
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400 stroke-[2.5] shrink-0" />
              ) : isBear ? (
                <TrendingDown className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400 stroke-[2.5] shrink-0" />
              ) : isSideways ? (
                <Circle className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 stroke-[2.5] shrink-0" />
              ) : (
                <Minus className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400 stroke-[2.5] shrink-0" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                {(() => {
                  const activeStrike = signal?.recommendedStrike || setup.recommendedStrike;
                  const activeType = signal?.recommendedType || setup.recommendedType;
                  return (
                    <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white flex flex-wrap items-center gap-2">
                      {isStopLossBreached && (
                        <span className="text-rose-400 flex items-center gap-2 flex-wrap">
                          <span>🛑 STOP LOSS HIT — {activeStrike} {activeType}</span>
                        </span>
                      )}
                      {!isStopLossBreached && isTarget2Captured && (
                        <span className="text-sky-400 flex items-center gap-2 flex-wrap">
                          <span>🚀 TARGET 2 HIT — {activeStrike} {activeType}</span>
                          <span className="text-xs font-mono font-bold bg-sky-950 text-sky-300 px-2 py-0.5 rounded border border-sky-800">FULL EXIT</span>
                        </span>
                      )}
                      {!isStopLossBreached && isTarget1Captured && !isTarget2Captured && (
                        <span className="text-emerald-400 flex items-center gap-2 flex-wrap">
                          <span>🎯 TARGET 1 HIT — {activeStrike} {activeType}</span>
                          <span className="text-xs font-mono font-bold bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded border border-emerald-800">SCALE 50%</span>
                        </span>
                      )}
                      {!isStopLossBreached && isRetracing && !isTarget1Captured && !isTarget2Captured && (
                        <span className="text-amber-300 flex items-center gap-2 flex-wrap">
                          <span>⚠️ TARGET 1 HIT · RETRACEMENT WATCH — {activeStrike} {activeType}</span>
                          <MoneynessBadge moneyness={effectiveMoneyness} size="sm" />
                        </span>
                      )}
                      {!isStopLossBreached && !isTarget2Captured && !isTarget1Captured && !isRetracing && isBull && (
                        <span className="text-emerald-400 flex items-center gap-2 flex-wrap">
                          <span>BUY CALL — {activeStrike} CE</span>
                          <MoneynessBadge moneyness={effectiveMoneyness} size="sm" />
                        </span>
                      )}
                      {!isStopLossBreached && !isTarget2Captured && !isTarget1Captured && !isRetracing && isBear && (
                        <span className="text-rose-400 flex items-center gap-2 flex-wrap">
                          <span>BUY PUT — {activeStrike} PE</span>
                          <MoneynessBadge moneyness={effectiveMoneyness} size="sm" />
                        </span>
                      )}
                      {!isStopLossBreached && !isTarget2Captured && !isTarget1Captured && !isRetracing && isWait && (
                        <span className="text-amber-400">STAY NEUTRAL / WAIT {signal?.afterMarketAnalytics?.predictedOpeningType === 'FLAT_OPENING' ? '(FLAT OPEN)' : ''}</span>
                      )}
                    </h2>
                  );
                })()}

                {/* Dynamic Regime & Momentum Badge */}
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded border flex items-center gap-1.5 font-mono shadow-xs ${
                  isStopLossBreached
                    ? 'border-rose-500/50 bg-rose-950/70 text-rose-300'
                    : isRetracing
                    ? 'border-amber-500/50 bg-amber-950/70 text-amber-300'
                    : isTarget2Captured
                    ? 'border-sky-500/50 bg-sky-950/70 text-sky-300'
                    : isTarget1Captured
                    ? 'border-emerald-500/50 bg-emerald-950/70 text-emerald-300'
                    : isBull
                    ? 'border-emerald-500/50 bg-emerald-950/70 text-emerald-300'
                    : isBear
                    ? 'border-rose-500/50 bg-rose-950/70 text-rose-300'
                    : 'border-amber-500/50 bg-amber-950/70 text-amber-300'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                    isStopLossBreached ? 'bg-rose-400' : isRetracing ? 'bg-amber-400' : isTarget2Captured ? 'bg-sky-400' : isBull ? 'bg-emerald-400' : isBear ? 'bg-rose-400' : 'bg-amber-400'
                  }`} />
                  <span>
                    {isCooldown
                      ? `COOLDOWN (${cooldownSeconds}s · STAND ASIDE)`
                      : isStopLossBreached
                      ? 'SL HIT (CAPITAL PRESERVED)'
                      : isRetracing
                      ? 'PULLBACK RETEST (Do Not Chase)'
                      : isTarget2Captured
                      ? '100% TARGET CAPTURED'
                      : isTarget1Captured
                      ? 'TARGET 1 CAPTURED (+35%)'
                      : isBull
                      ? `BULLISH (${setup.probabilityScore}% Momentum)`
                      : isBear
                      ? `BEARISH (${setup.probabilityScore}% Momentum)`
                      : signal?.afterMarketAnalytics?.predictedOpeningType === 'FLAT_OPENING'
                      ? `FLAT OPEN (${signal.afterMarketAnalytics.predictedOpeningGapPoints >= 0 ? '+' : ''}${signal.afterMarketAnalytics.predictedOpeningGapPoints} pts) · Wait ORB`
                      : `SIDEWAYS (${signal?.sidewaysMarketAnalysis?.compressionPercentage || 64}% Chop)`}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {/* Pre-Market Live Pricing indicator */}
            {(usePreMarket || marketStatus?.session === 'PRE_MARKET' || ticker.isUsingPreMarket) && (
              <div 
                className="px-2 py-1 rounded bg-amber-950/60 border border-amber-500/50 text-amber-300 text-[10.5px] font-mono font-bold flex items-center gap-1.5 shadow-xs"
                title={`Pre-Market Active Spot: ₹${(ticker.preMarketPrice || ticker.spotPrice).toFixed(2)} (${ticker.change >= 0 ? '+' : ''}${ticker.change.toFixed(2)} pts)`}
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                <span>Pre-Mkt Spot: ₹{(ticker.preMarketPrice || ticker.spotPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            {/* Simulate Contract Icon Button */}
            {!isWait && !isStopLossBreached && (
              <button
                onClick={() => onSelectContractForSimulation(setup.recommendedStrike, setup.recommendedType)}
                className="p-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold transition-all cursor-pointer shadow-sm shadow-emerald-500/20 flex items-center justify-center shrink-0"
                title="Simulate Payoff"
              >
                <PlayCircle className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtitle / Predictive Trigger */}
      <p className="text-xs text-slate-300 font-sans mt-2.5 leading-relaxed relative z-10">
        <strong className="text-amber-300">Predictive Trigger: </strong>
        {setup.primaryLeadingCatalyst}
      </p>

      {/* 18-Pillar Directional Validation & Bias Audit Strip */}
      <div className="mt-2.5 p-2 rounded-lg bg-slate-950/70 border border-slate-800 text-[11px] font-mono flex flex-wrap items-center justify-between gap-2 relative z-10">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 font-sans flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Algorithm Validation:</span>
          </span>
          <span className={`font-bold px-1.5 py-0.5 rounded border ${
            isBull 
              ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60' 
              : isBear 
              ? 'text-rose-400 bg-rose-950/60 border-rose-800/60' 
              : 'text-amber-300 bg-amber-950/60 border-amber-800/60'
          }`}>
            {setup.directionalBiasLabel || (isBull ? `+${setup.probabilityScore}% Bullish Bias` : isBear ? `-${setup.probabilityScore}% Bearish Bias` : '0.0% Neutral Bias')}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">
            Pillars Bullish: <strong className="text-emerald-400">{setup.leadingPredictorFactors.filter(f => f.state.includes('BULLISH')).length}</strong>
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-300">
            Bearish: <strong className="text-rose-400">{setup.leadingPredictorFactors.filter(f => f.state.includes('BEARISH')).length}</strong>
          </span>
          <span className="text-slate-500">·</span>
          <span className="text-slate-300">
            Neutral: <strong className="text-amber-300">{setup.leadingPredictorFactors.filter(f => f.state === 'NEUTRAL').length}</strong>
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10.5px]">
          <span className="text-slate-400">Regime:</span>
          <span className={`font-bold px-1.5 py-0.2 rounded border ${
            isStopLossBreached ? 'text-rose-300 bg-rose-950 border-rose-700' :
            isRetracing ? 'text-amber-300 bg-amber-950 border-amber-700' :
            isBull ? 'text-emerald-300 bg-emerald-950 border-emerald-700' :
            isBear ? 'text-rose-300 bg-rose-950 border-rose-700' :
            'text-amber-300 bg-amber-950 border-amber-700'
          }`}>
            {isStopLossBreached ? 'SL Invalidation Floor Breached' :
             isRetracing ? 'Retracement Pullback Phase' :
             isBull ? 'Confirmed Call Momentum' :
             isBear ? 'Confirmed Put Momentum' :
             'Consolidation Stand Aside'}
          </span>
        </div>
      </div>

      {/* PRIMARY SETUP HIGHLIGHT CARDS GRID */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 mt-2.5 relative z-10">
        {/* Card 1: Action & Recommended Strike */}
        <div className={`p-3 rounded-lg border flex flex-col justify-between ${
          isBull ? 'bg-emerald-950/40 border-emerald-500/40' :
          isBear ? 'bg-rose-950/40 border-rose-500/40' :
          'bg-slate-900/80 border-slate-800'
        }`}>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>{isWait ? 'REFERENCE WATCH CONTRACT' : 'RECOMMENDED STRIKE'}</span>
            <span className={`font-bold text-[10px] px-1.5 py-0.2 rounded border ${
              isBull ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' :
              isBear ? 'bg-rose-950 text-rose-300 border-rose-500/40' :
              'bg-amber-950 text-amber-300 border-amber-500/40'
            }`}>
              {isWait ? 'STAND ASIDE' : setup.anticipatedAction.replace('_', ' ')}
            </span>
          </div>
          <div className="mt-1">
            <div className={`text-base sm:text-xl font-bold font-mono flex items-center gap-1.5 flex-wrap ${
              isBull ? 'text-emerald-300' : isBear ? 'text-rose-300' : 'text-slate-300'
            }`}>
              {isBull && <ArrowUpRight className="w-4 h-4 text-emerald-400 shrink-0" />}
              {isBear && <ArrowDownRight className="w-4 h-4 text-rose-400 shrink-0" />}
              <span>{setup.recommendedStrike} {setup.recommendedType}</span>
              <MoneynessBadge moneyness={effectiveMoneyness} size="xs" />
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              Live LTP: <strong className="text-white">{ticker.currency}{currentLTP.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        {/* Card 2: Entry Zone (Spot & Option) */}
        <div className="p-3 rounded-lg border bg-slate-900/80 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>{isWait ? 'WATCH RANGE' : 'ENTRY ZONE'}</span>
            <span className={`${isWait ? 'text-amber-400' : 'text-emerald-400'} font-bold text-[10px]`}>
              {isWait ? (ticker.marketState === 'REGULAR' || ticker.marketState === 'OPEN' ? 'WAIT BREAKOUT' : 'WAIT 09:30 AM') : 'BASE SUPPORT'}
            </span>
          </div>
          <div className="mt-1">
            <div className="text-xs sm:text-sm font-bold font-mono text-amber-300">
              {ticker.currency}{setup.advanceEntryZoneSpot[0].toLocaleString()} – {ticker.currency}{setup.advanceEntryZoneSpot[1].toLocaleString()}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              {isWait ? (
                <span className="text-amber-300/90 font-sans">{ticker.marketState === 'REGULAR' || ticker.marketState === 'OPEN' ? 'Trigger: Confirmed breakout outside range' : 'Trigger: Break outside range post-09:30'}</span>
              ) : (
                <span>Option: <span className="text-slate-200">{ticker.currency}{optEntryLow.toFixed(2)} – {ticker.currency}{optEntryHigh.toFixed(2)}</span></span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Invalidation Stop-Loss */}
        <div className="p-3 rounded-lg border bg-slate-900/80 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>{isWait ? 'CAPITAL PROTECTION' : isProfitLocked ? 'PROFIT LOCK SL' : 'STRICT STOP-LOSS'}</span>
            <span className={`${isWait ? 'text-amber-400' : isProfitLocked ? 'text-emerald-400' : 'text-rose-400'} font-bold text-[10px]`}>
              {isWait ? 'DISCIPLINE' : isProfitLocked ? '🔒 TRAILED' : 'PROTECTED'}
            </span>
          </div>
          <div className="mt-1">
            <div className={`text-xs sm:text-sm font-bold font-mono ${isWait ? 'text-amber-200' : isProfitLocked ? 'text-emerald-300' : 'text-rose-300'}`}>
              {isWait ? (ticker.marketState === 'REGULAR' || ticker.marketState === 'OPEN' ? 'Stand Aside (Capital Preservation)' : 'Stand Aside at 09:15 Open') : `Spot: ${ticker.currency}${effectiveSpotStopLoss.toLocaleString()}`}
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              {isWait ? (
                <span className="text-slate-400 font-sans">{ticker.marketState === 'REGULAR' || ticker.marketState === 'OPEN' ? 'Zero naked trades in chop deadband' : 'Zero naked trades on flat gap'}</span>
              ) : isProfitLocked ? (
                <div className="space-y-0.5">
                  <span className="flex items-center gap-1 flex-wrap">
                    <span>Option SL: <strong className="text-emerald-400">{ticker.currency}{optStopLoss.toFixed(2)}</strong></span>
                    <span className="text-[10px] text-emerald-300 font-sans font-semibold bg-emerald-950/80 px-1 py-0.2 rounded border border-emerald-500/30">🔒 Profit Locked</span>
                  </span>
                  <div className="text-[10px] text-slate-400 font-sans">
                    Initial SL: {ticker.currency}{initialOptSL.toFixed(2)} (Trailed +50% T1)
                  </div>
                </div>
              ) : (
                <span>Option SL: <strong className="text-rose-400">{ticker.currency}{optStopLoss.toFixed(2)}</strong> <span className="text-[10px] text-slate-400 font-sans">(Initial SL)</span></span>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: Targets & Risk-Reward */}
        <div className="p-3 rounded-lg border bg-slate-900/80 border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span>{isWait ? 'POST-BREAKOUT TARGETS' : 'TARGETS'}</span>
            <span className="text-emerald-400 font-bold text-[10px]">{isWait ? 'CONDITIONAL' : `R:R ${optRR}`}</span>
          </div>
          <div className="mt-1">
            <div className="text-xs sm:text-sm font-bold font-mono text-emerald-300">
              T1: {ticker.currency}{optTarget1.toFixed(2)} <span className="text-[10px] text-emerald-400">(+{Math.max(1, Math.round(((optTarget1 - currentLTP) / Math.max(0.05, currentLTP)) * 100))}%)</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400 mt-0.5">
              T2: <span className="text-emerald-400">{ticker.currency}{optTarget2.toFixed(2)}</span> (+{Math.max(2, Math.round(((optTarget2 - currentLTP) / Math.max(0.05, currentLTP)) * 100))}%)
            </div>
          </div>
        </div>
      </div>

      {/* INLINED CANDLESTICK MOMENTUM & PRICE ACTION CONFLUENCE BAR */}
      <div className="mt-2.5 p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/90 relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
              <Flame className={`w-3.5 h-3.5 ${
                candleBias === 'BULLISH' ? 'text-emerald-400' :
                candleBias === 'BEARISH' ? 'text-rose-400' :
                'text-amber-400'
              }`} />
              <span>Inlined Candlestick Momentum:</span>
            </span>

            <span className={`text-[11px] font-bold px-2 py-0.5 rounded border font-mono ${
              candleBias === 'BULLISH'
                ? 'text-emerald-300 bg-emerald-950/70 border-emerald-500/40'
                : candleBias === 'BEARISH'
                ? 'text-rose-300 bg-rose-950/70 border-rose-500/40'
                : 'text-amber-300 bg-amber-950/70 border-amber-500/40'
            }`}>
              {candleBias} ({candleScore > 0 ? '+' : ''}{candleScore.toFixed(1)}/10) · {candle?.momentumAlignment?.replace(/_/g, ' ') || 'ALIGNED'}
            </span>

            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
              isCandleInlinedWithTrade
                ? 'text-emerald-300 bg-emerald-950/60 border-emerald-700/60'
                : 'text-amber-300 bg-amber-950/60 border-amber-700/60'
            }`}>
              {isCandleInlinedWithTrade 
                ? (isBull ? '✓ 100% Inlined with BUY CE' : isBear ? '✓ 100% Inlined with BUY PE' : '✓ Inlined with Stand-Aside Range')
                : '⚡ Momentum Transition Retest'}
            </span>
          </div>

          {/* Micro Timeframe Velocity Chips */}
          <div className="flex items-center gap-1.5 flex-wrap text-[10.5px] font-mono">
            <span className="text-slate-400 font-sans text-[10px]">Timeframes:</span>
            {[
              { tf: '1m', val: candle?.m1Score ?? candle?.m1?.momentumScore ?? 0 },
              { tf: '2m', val: candle?.m2Score ?? candle?.m2?.momentumScore ?? 0 },
              { tf: '5m', val: candle?.m5Score ?? candle?.m5?.momentumScore ?? 0 },
              { tf: '15m', val: candle?.m15Score ?? candle?.m15?.momentumScore ?? 0 },
              { tf: '1H', val: candle?.h1Score ?? candle?.h1?.momentumScore ?? 0 },
            ].map(item => (
              <span
                key={item.tf}
                className={`px-1.5 py-0.2 rounded border font-bold ${
                  item.val > 0.5 
                    ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60' 
                    : item.val < -0.5 
                    ? 'text-rose-400 bg-rose-950/60 border-rose-800/60' 
                    : 'text-slate-400 bg-slate-900 border-slate-800'
                }`}
                title={`${item.tf} momentum velocity: ${item.val}`}
              >
                {item.tf}: {item.val > 0 ? '+' : ''}{item.val}
              </span>
            ))}
          </div>
        </div>

        {/* Candlestick Pattern Detail & Direct Workstation Link */}
        <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 font-sans">Active Candle Formation:</span>
            <span className="font-semibold text-white">
              {candle?.confluencePattern || (isBull ? 'Bullish Absorption & Higher Low Formation' : isBear ? 'Bearish Supply Distribution & Lower High Capping' : 'Tight Equilibrium Consolidation Range')}
            </span>
            {candle?.orbStatus && candle.orbStatus !== 'INSIDE_ORB_RANGE' && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded border font-mono ${
                candle.orbStatus === 'BULLISH_ORB_BREAKOUT' ? 'text-emerald-300 bg-emerald-950 border-emerald-700' : 'text-rose-300 bg-rose-950 border-rose-700'
              }`}>
                {candle.orbStatus.replace(/_/g, ' ')}
              </span>
            )}
          </div>

          {onSelectTab && (
            <button
              onClick={() => onSelectTab('candlesticks')}
              className="text-[10.5px] font-sans text-indigo-300 hover:text-indigo-200 hover:underline flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>Inspect Full Candlesticks & Momentum</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Quantitative Controls Bar */}
      <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono relative z-10">
        {/* Dealer Gamma GEX Regime */}
        <div className="p-2 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400 font-sans flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-purple-400" />
            <span>GEX Regime:</span>
          </span>
          <span className={`font-bold px-1.5 py-0.5 rounded border ${
            setup.gammaRegimeData?.regime === 'NEGATIVE_GAMMA'
              ? 'text-purple-300 bg-purple-950/80 border-purple-500/40'
              : 'text-sky-300 bg-sky-950/80 border-sky-500/40'
          }`}>
            {setup.gammaRegimeData?.regime === 'NEGATIVE_GAMMA' ? '⚡ Short Gamma (Accelerated)' : '🛡️ Long Gamma (Pin Wall)'}
          </span>
        </div>

        {/* Multi-Timeframe Coherence */}
        <div className="p-2 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400 font-sans flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-teal-400" />
            <span>MTCF Coherence:</span>
          </span>
          <span className="font-bold text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40">
            {setup.timeframeCoherence?.summary || `${setup.timeframeCoherence?.coherenceScore ?? 83}% Trend Coherence`}
          </span>
        </div>

        {/* Dynamic ATR Volatility Matrix */}
        <div className="p-2 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between">
          <span className="text-slate-400 font-sans flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Dynamic ATR:</span>
          </span>
          <span className="font-bold text-amber-300 font-mono">
            ±{ticker.currency}{setup.dynamicVolatilityMatrix?.dynamicAtr14 || 38.5} pts ({setup.dynamicVolatilityMatrix?.volatilityRegime?.replace(/_/g, ' ') || 'Adaptive'})
          </span>
        </div>
      </div>

      {/* Multi-Timeframe Regime Bridge Banner when in Wait / Flat Open */}
      {isWait && (
        <div className="mt-2.5 p-2.5 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-200 text-xs font-sans leading-relaxed relative z-10 flex items-start gap-2">
          <Activity className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-300 text-xs flex items-center gap-1.5 flex-wrap">
              <span>{ticker.marketState === 'REGULAR' || ticker.marketState === 'OPEN' ? 'Intraday Consolidation Protocol: Stand Aside in Wait' : 'Flat Open Protocol: Stand Aside First 15 Mins'}</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30">
                {ticker.marketState === 'REGULAR' || ticker.marketState === 'OPEN' ? 'BREAKOUT WATCH' : 'ORB Rule'}
              </span>
            </div>
            <p className="text-[11px] text-amber-200/90 leading-normal">
              {ticker.marketState === 'REGULAR' || ticker.marketState === 'OPEN' ? (
                <>Spot is oscillating in a tight consolidation range (<strong className="text-white font-mono">{ticker.currency}{setup.advanceEntryZoneSpot[0].toLocaleString()} – {ticker.currency}{setup.advanceEntryZoneSpot[1].toLocaleString()}</strong>). Confluence model is in equilibrium. Stand aside in WAIT until a confirmed breakout above resistance or breakdown below support occurs. Reference contract <strong className="text-white font-mono">{setup.recommendedStrike} {setup.recommendedType} ({effectiveMoneyness})</strong> LTP is <strong className="text-white font-mono">{ticker.currency}{currentLTP.toFixed(2)}</strong>.</>
              ) : (
                <>GIFT Nifty indicates a flat opening ({signal?.afterMarketAnalytics?.predictedOpeningGapPoints !== undefined ? (signal.afterMarketAnalytics.predictedOpeningGapPoints >= 0 ? '+' : '') + signal.afterMarketAnalytics.predictedOpeningGapPoints : '+27.5'} pts). Buying options at 09:15 AM on a flat open risks theta decay and IV crush. Stand aside for 15 mins. Enter reference contract <strong className="text-white font-mono">{setup.recommendedStrike} {setup.recommendedType} ({effectiveMoneyness})</strong> only after a confirmed 15-Minute Opening Range Breakout (ORB) post-09:30 AM.</>
              )}
            </p>
          </div>
        </div>
      )}

      {/* INSTITUTIONAL SMC PRICE ACTION EXECUTION CARD (Liquidity Sweep -> MSS -> FVG + FIB) */}
      {setup.smcFvgFib && (
        <div className="mt-3 relative z-10">
          <SmcPriceActionCard 
            smc={setup.smcFvgFib} 
            ticker={ticker} 
            theme={theme} 
            tradeDirection={isBear ? 'BUY_PE' : isBull ? 'BUY_CE' : 'WAIT_NEUTRAL'}
          />
        </div>
      )}



      {/* 17-PILLAR LEADING PREDICTORS RADAR (COLLAPSED BY DEFAULT) */}
      <div className="mt-3 relative z-10">
        <button
          onClick={() => setShowRadarDetails(prev => !prev)}
          className="w-full flex items-center justify-between p-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-850 text-slate-200 border border-slate-800 text-xs font-mono transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-indigo-400" />
            <span className="font-bold">{setup.leadingPredictorFactors.length}-Pillar Pipeline Audit Radar</span>
            <span className="text-[10px] text-slate-400">({setup.leadingPredictorFactors.length} factors evaluated)</span>
          </div>
          <div className="flex items-center gap-1.5 text-indigo-400 text-[11px]">
            <span>{showRadarDetails ? 'Hide Radar' : 'View Live Radar'}</span>
            {showRadarDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showRadarDetails && (
          <div className="mt-2 space-y-2 animate-fade-in">
            {/* Category Filter Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-lg border border-slate-800 text-xs font-mono overflow-x-auto">
              <button
                onClick={() => setActiveCategoryTab('ALL')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeCategoryTab === 'ALL'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                ALL ({setup.leadingPredictorFactors.length} Pillars)
              </button>
              <button
                onClick={() => setActiveCategoryTab('DERIVATIVES_MICROSTRUCTURE')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeCategoryTab === 'DERIVATIVES_MICROSTRUCTURE'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Derivatives & Microstructure
              </button>
              <button
                onClick={() => setActiveCategoryTab('PRICE_ACTION_MOMENTUM')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeCategoryTab === 'PRICE_ACTION_MOMENTUM'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Price Action & Momentum
              </button>
              <button
                onClick={() => setActiveCategoryTab('MACRO_TIMEFRAME')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  activeCategoryTab === 'MACRO_TIMEFRAME'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                Macro & Multi-Timeframe
              </button>
            </div>

            {/* Factors Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {setup.leadingPredictorFactors
                .filter(factor => {
                  if (activeCategoryTab === 'ALL') return true;
                  const cat = factor.category;
                  if (activeCategoryTab === 'DERIVATIVES_MICROSTRUCTURE') {
                    return cat === 'OI_VELOCITY' || cat === 'HEAVYWEIGHT_LEAD' || cat === 'ORDER_FLOW_DELTA' || cat === 'PCR_DIVERGENCE';
                  }
                  if (activeCategoryTab === 'PRICE_ACTION_MOMENTUM') {
                    return cat === 'VOLATILITY_SQUEEZE' || cat === 'LIQUIDITY_SWEEP' || cat === 'RSI_MOMENTUM' || cat === 'MACD_EXPANSION' || cat === 'VOLUME_ANALYTICS';
                  }
                  return cat === 'GLOBAL_MACRO_LEAD' || cat === 'SECTORAL_BREADTH' || cat === 'VIX_VELOCITY' || cat === 'INTERMARKET_TELEMETRY' || cat === 'HTF_ALIGNMENT' || cat === 'HYSTERESIS_STATE';
                })
                .map((factor, idx) => (
                  <div 
                    key={idx} 
                    className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 flex flex-col justify-between space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <span className="text-xs font-bold text-slate-200 leading-tight">
                        {factor.name}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${getFactorBadgeColor(factor.state)}`}>
                        {factor.state.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400 leading-normal font-sans">
                      {factor.valueDescription}
                    </p>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-850">
                      <span>Confidence: <strong className="text-slate-300">{factor.confidenceScore}%</strong></span>
                      <span className="text-emerald-400/90 font-semibold">Active Vector</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
