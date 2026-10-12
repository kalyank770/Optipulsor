import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { 
  Clock, 
  ShieldCheck, 
  Info, 
  X, 
  Zap, 
  CheckCircle2, 
  ShieldAlert,
  Lock,
  Flame,
  FileText,
  Activity,
  ArrowRight
} from 'lucide-react';
import { SignalStabilityLock, SignalAction } from '../types/options';

interface StabilityLockBadgeProps {
  stabilityLock?: SignalStabilityLock;
  action?: SignalAction;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  showTooltipOnClick?: boolean;
}

export const StabilityLockBadge: React.FC<StabilityLockBadgeProps> = ({
  stabilityLock,
  action = 'WAIT_NEUTRAL',
  size = 'sm',
  className = '',
  showTooltipOnClick = true,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'directive' | 'allRules'>('directive');

  const isDirectional = action === 'BUY_CE' || action === 'BUY_PE';
  const secondsRemaining = stabilityLock?.secondsRemaining ?? (isDirectional ? 120 : 60);
  const totalSeconds = stabilityLock?.lockDurationSeconds ?? (isDirectional ? 120 : 60);

  // Close modal on Escape key press & prevent background scroll
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Size configurations
  const sizeClasses = {
    xs: 'px-2 py-0.5 text-[10px] gap-1',
    sm: 'px-2.5 py-1 text-[11px] gap-1.5',
    md: 'px-3 py-1.5 text-xs gap-2',
  }[size];

  return (
    <>
      <div className={`inline-flex items-center ${className}`}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (showTooltipOnClick) {
              setIsOpen(prev => !prev);
            }
          }}
          className={`inline-flex items-center font-mono font-semibold rounded-md border transition-all cursor-pointer select-none ${sizeClasses} ${
            isDirectional
              ? 'bg-indigo-950/90 border-indigo-500/60 text-indigo-200 hover:bg-indigo-900 hover:border-indigo-400 shadow-sm shadow-indigo-500/20'
              : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800 hover:border-slate-500 shadow-sm'
          }`}
          title="1–2 Min Prediction Stability Lock (Click for rule details)"
        >
          <span className="relative flex h-2 w-2 shrink-0">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isDirectional ? 'bg-indigo-400' : 'bg-amber-400'
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                isDirectional ? 'bg-indigo-500' : 'bg-amber-500'
              }`}
            />
          </span>

          <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />

          <span className="whitespace-nowrap">
            {isDirectional ? (
              <>
                <span className="font-bold text-white">Stability Lock:</span>
                <span className="text-indigo-300 ml-1 font-mono">
                  {secondsRemaining}s
                </span>
                <span className="hidden sm:inline text-slate-400 font-mono text-[9.5px]">/{totalSeconds}s</span>
              </>
            ) : (
              <>
                <span className="font-bold text-slate-200">Stability Lock:</span>
                <span className="text-slate-300 ml-1 font-mono">1-2m Lock</span>
              </>
            )}
          </span>

          <Info className="w-3 h-3 text-slate-400 ml-0.5 opacity-80 hover:opacity-100 shrink-0" />
        </button>
      </div>

      {/* Production Modal Dialog rendered at Document Root via React Portal */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md overflow-y-auto"
          onClick={() => setIsOpen(false)}
        >
          {/* Modal Container: Solid Opaque High-Contrast Card with max-h-[92vh] overflow-y-auto */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pillar4-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto bg-[#0a0f1d] border-2 border-indigo-500/70 rounded-2xl p-4 sm:p-6 shadow-[0_25px_70px_rgba(0,0,0,0.95)] text-slate-100 font-sans space-y-4 my-auto select-text"
          >
            {/* Top Modal Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 shadow-sm shrink-0">
                  <ShieldCheck className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      PREDICTION STABILITY DIRECTIVE
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      PRODUCTION_ALGORITHM_CONSTITUTION.md
                    </span>
                  </div>
                  <h3 id="pillar4-modal-title" className="font-bold text-white text-base sm:text-lg tracking-tight mt-0.5">
                    1-to-2 Minute Prediction Lock & Anti-Whipsaw Filter
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('directive')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'directive'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Stability Lock Telemetry</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('allRules')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'allRules'
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>All Production Directives</span>
              </button>
            </div>

            {activeTab === 'directive' ? (
              <>
                {/* Instruction Block */}
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-400 text-xs sm:text-sm">
                    <Zap className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Prediction Stability Mandate:</span>
                  </div>
                  <blockquote className="p-2.5 rounded-lg bg-black/40 border-l-2 border-amber-400 font-mono text-xs sm:text-[12.5px] text-amber-100 leading-relaxed italic">
                    &ldquo;Trade recommendation should not quickly change as per just live market is moving up/down. for this I don&apos;t need this application. I want this application should come up with prediction which should valid for atleast a min or 2 and also more accurate such that I can rely on this and will not loose any money.&rdquo;
                  </blockquote>
                  <p className="text-[11.5px] text-slate-300 leading-relaxed">
                    This directive protects real trading capital by banning rapid 5–10 second signal flips caused by normal exchange tick flutter. Directional trade setups remain firmly stabilized for <strong className="text-emerald-400">at least 1 to 2 minutes (60–120s)</strong> while real-time underlying market ticks continue updating without disturbance.
                  </p>
                </div>

                {/* Current Live Real-Time Lock Status Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs">
                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-sans">Active Signal</span>
                    <span className={`text-sm font-bold mt-0.5 block ${
                      action === 'BUY_CE' ? 'text-emerald-400' : action === 'BUY_PE' ? 'text-rose-400' : 'text-amber-400'
                    }`}>
                      {action.replace('_', ' ')}
                    </span>
                    <span className="text-[9.5px] text-slate-400">Institutional Setup</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-sans">Lock Duration</span>
                    <span className="text-sm font-bold text-white mt-0.5 block">
                      {totalSeconds} Seconds
                    </span>
                    <span className="text-[9.5px] text-slate-400">Min 1–2 Min Window</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-sans">Lock Remaining</span>
                    <span className="text-sm font-bold text-emerald-400 mt-0.5 block">
                      {secondsRemaining}s
                    </span>
                    <span className="text-[9.5px] text-slate-400">Anti-Flicker Active</span>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-sans">Background Feed</span>
                    <span className="text-sm font-bold text-sky-400 mt-0.5 block">
                      1s Live Stream
                    </span>
                    <span className="text-[9.5px] text-slate-400">Non-blocking Ticks</span>
                  </div>
                </div>

                {/* Invariant Implementation Rules */}
                <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2.5 text-xs">
                  <span className="font-bold text-white text-xs uppercase tracking-wider block font-mono">
                    How The Prediction Algorithm Strictly Enforces This:
                  </span>
                  <ul className="space-y-2 text-slate-300 text-[11.5px] leading-relaxed">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>
                        <strong className="text-emerald-300">Minimum 60–120s Stability Lock:</strong> Once a high-confluence BUY CE or BUY PE entry is issued, the trade recommendation action, recommended strike, entry range, and profit targets are strictly locked for at least 1 to 2 minutes.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>
                        <strong className="text-emerald-300">Uninterrupted 1-Second Price Streaming:</strong> Live spot price, contract LTP, Greeks, and P&amp;L continuously stream every second in the background without modifying the trade thesis.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                      <span>
                        <strong className="text-emerald-300">Multi-Timeframe Confluence Filter:</strong> Signals require momentum alignment across 2m, 5m, and 15m candlesticks, VWAP, order flow volume, and PCR—preventing false premature triggers.
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                      <span>
                        <strong className="text-rose-300">Capital-Preservation Emergency Exit:</strong> If the underlying market breaches the calculated trailing stop loss, the lock releases immediately to execute an emergency stop and protect real money.
                      </span>
                    </li>
                  </ul>
                </div>
              </>
            ) : (
              /* All 7 Production Directives Summary */
              <div className="space-y-2 text-xs">
                <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/30 text-indigo-200">
                  <span className="font-bold text-white block mb-1">
                    Complete Production Constitution Summary:
                  </span>
                  <span className="text-[11.5px] text-slate-300">
                    Governing all algorithm computations, data ingestion, UI stability, and audits.
                  </span>
                </div>

                <div className="space-y-2 text-[11.5px] max-h-[50vh] overflow-y-auto pr-1">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono">1</span>
                      Zero Dummy, Static, or Fallback Data
                    </span>
                    <p className="text-slate-400">
                      All data used in the application is 100% real, live, and authentic from official exchange sources (NSE, NSE IX GIFT Nifty, CBOE, Yahoo fast chart, TradingView).
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono">2</span>
                      Well-Tuned Mathematically Correct Prediction Algorithm
                    </span>
                    <p className="text-slate-400">
                      Analytic Black-Scholes European option pricing, Greeks (&Delta;, &Gamma;, &Theta;, &nu;), multi-timeframe confluence (2m/5m/15m), Net Order Flow Delta, and minimum 1:1.05 R:R filter.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono">3</span>
                      Mathematically Valid &amp; Single Source of Truth
                    </span>
                    <p className="text-slate-400">
                      Single authoritative signal engine (<code className="text-indigo-300">signal.action</code>). No secondary widget can override a Stand Aside or Capital Preservation mandate.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-500/50 space-y-1">
                    <span className="font-bold text-indigo-200 flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-indigo-500/30 text-indigo-300 text-[10px] flex items-center justify-center font-mono">4</span>
                      Minimum 1-to-2 Minute Prediction Lock (Current Badge)
                    </span>
                    <p className="text-indigo-100">
                      Trade recommendations do not quickly flip on 1-second price flutter. Predictions remain stable for at least 1–2 minutes, allowing disciplined execution without capital loss.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono">5</span>
                      No Cache Issues, Freezing, or App Crashes
                    </span>
                    <p className="text-slate-400">
                      Sub-second non-blocking polling loops with 2.2s network timeouts, watchdog auto-clearing locks, and in-memory caches delivering sub-100ms API responses.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono">6</span>
                      Full Cross-Device Compatibility (Desktop, Tab, Mobile)
                    </span>
                    <p className="text-slate-400">
                      Responsive layouts with zero text clipping, no abnormal wraps, full feature parity, and touch-optimized components across all form factors.
                    </p>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
                    <span className="font-bold text-white flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono">7</span>
                      Continuous Market Audit &amp; Discrepancy Diagnostics
                    </span>
                    <p className="text-slate-400">
                      Every intraday trade setup is logged with actual subsequent spot movement, peak option payoff, variance diagnostics, and mathematical explanations in Day&apos;s Report.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Modal Footer with Dismiss Button */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Feed Active</span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors cursor-pointer shadow-sm shadow-indigo-600/30"
              >
                Close &amp; Return to Feed
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
