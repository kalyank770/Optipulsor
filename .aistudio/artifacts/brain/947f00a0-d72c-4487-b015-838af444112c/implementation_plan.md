# Comprehensive 15-Pillar Prediction Pipeline Audit & Real-Time Diagnostic Panel

A complete architectural audit, recalibration, and visual diagnostic system for OptiPulse's 15 institutional prediction pillars. Ensures unbiased, real-time signal generation, zero stale cross-ticker bleed, and mathematically grounded target/stop-loss mechanics across all market regimes.

## User Review & Critical Decisions

> [!IMPORTANT]
> The user confirmed the scope and focus for this prediction pipeline audit:
> - **Audit Scope**: Full 15-Pillar Institutional Audit with real-time bias detection and a dedicated UI Diagnostic Panel.
> - **Quantitative Pillars & Adjustments**:
>   1. Market Microstructure Delta Imbalance & Institutional GEX Support Walls.
>   2. Sectors & Heavyweight Relative Strength Lead-Lag Ratios.
>   3. Multi-Timeframe EMA Alignment & Volatility Compression Squeeze.
> - **Stop-Loss / Entry Query Resolution ("Entry is 61 but how stop loss is 73?")**:
>   - **Root Cause Identified**: When an active trade achieves Target 1 (e.g., premium surges from ₹61 to ₹85+), the engine automatically trails the Stop Loss upwards to lock in profits (e.g., ₹73.25). When live price subsequently pulls back to ₹61, the Stop Loss remains displayed at the locked-in trailed level (₹73.25).
>   - **Enhancement Action**: Update `AdvanceTradeCard.tsx` and `SignalCard.tsx` to explicitly display `🔒 Profit Lock SL: ₹73.25` when trailed, and enforce a strict safety clamp for fresh entries (`stopLoss <= premium * 0.85`).

- **Confirmed Choice**: Build an integrated 15-Pillar Pipeline Diagnostic Panel directly inside the HTF Predictions Workstation / Signal Overview so traders can audit every pillar's raw value, weight, contribution, and anti-bias guard rails in real-time.
- **Recommended Default**: Enforce strict stand-aside (`WAIT_NEUTRAL`) whenever conflicting signals exist between spot price action, options order flow, derivative heavyweights, and global futures drift.

---

## 1. Overview & Core Concept

### What It Does
1. **Audits the Entire 15-Pillar Prediction Pipeline**: Evaluates all 15 institutional prediction factors (from Option Open Interest Velocity to Heavyweight Lead-Lag, Order Flow CVD Delta, Volatility Compression, Liquidity Sweeps, GIFT Nifty Futures, Sectoral Breadth, RSI Divergence, MACD Velocity, GEX Walls, VIX Velocity, Volume Analytics, HTF Confluence, After-Market Gap Projection, and Anti-Whipsaw Hysteresis).
2. **Eliminates Algorithmic Bias**: Prevents bullish overrides (such as false `BUY_CE` calls) when underlying derivative indicators, PCR, or candlestick patterns are bearish.
3. **Harmonizes Stop-Loss & Target Calculations**: Standardizes option premium and spot invalidation levels across all assets (Nifty 50, Bank Nifty, Stock Options, USD tickers). Clamps fresh option Stop Loss strictly below entry cost (max 15-20% risk) while visually identifying trailed profit-lock levels.
4. **Delivers a Live 15-Pillar Diagnostic Panel**: Renders an interactive diagnostic workstation view allowing traders to expand and inspect each of the 15 pillars with live metrics, confidence scores, and guard rail states.

---

## 2. User Experience & Visual Design

### Key User Flows
- **Real-Time Signal Audit**: Traders view the main Trade Recommendation Card and can toggle open the **15-Pillar Pipeline Diagnostic Panel** to see exact weights, inputs, and bias checks.
- **Trailed Profit Lock Visual Badge**: When Stop Loss is trailed above entry (e.g. SL = ₹73.25 when Entry = ₹61), the UI displays a distinctive badge: `🔒 Trailed Profit Lock SL: ₹73.25 (+50% T1 Gains Locked)` so traders immediately recognize it as a profit lock rather than an inverted initial risk.
- **Bias Alert Indicators**: Clear visual indicators show when Capital Protection Guard Rails override a trade or force a stand-aside (`WAIT_NEUTRAL`) due to contradictory signals (e.g. PCR oversold vs. Call Wall resistance).
- **Interactive Pillar Deep-Dive**: Clicking any pillar reveals raw mathematical inputs (e.g., net heavyweight impact points, cumulative volume delta imbalance %, GEX strike distance, 5m RSI divergence velocity).

### Visual Identity & Theme
- **Theme**: Dark Slate / Deep Indigo Navy with high-contrast emerald (`#10B981`) for bullish vectors, rose (`#F43F5E`) for bearish vectors, and amber (`#F59E0B`) for stand-aside / capital protection.
- **Typography**: Clean sans-serif headings (`Plus Jakarta Sans`) with tabular figures (`font-mono tabular-nums`) for numerical strike prices, premiums, stop losses, and percentage deltas.
- **Zero-Pill Discipline**: Metadata displayed as unboxed typography separated by clean dots (`·`) or subtle hairline borders.

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: 15-Pillar Unified Weighting & Guard Rail Architecture
- **Chosen Approach**: Standardize all 15 predictive pillars into a zero-biased scoring engine with strict Guard Rails (0 through 6) that act as hard circuit breakers before any `BUY_CE` or `BUY_PE` signal is emitted.
- **Why**: Prevents false positive signals during market chop, late-session profit taking, or oversold/overbought extremes.
- **Alternatives Considered**: Simple weighted sum without guard rails (rejected because raw sums ignore non-linear risks like major Call/Put Walls or closing hour theta decay).

### Decision 2: Stop Loss & Trailing Profit Lock Labeling
- **Chosen Approach**: Explicitly differentiate between *Initial Risk Stop Loss* (strictly < Entry Premium) and *Trailed Profit Lock Stop Loss* (which trails > Entry Premium after Target 1 is hit).
- **Why**: Eliminates user confusion when observing a current market pullback (LTP ₹61) on a trade that previously hit Target 1 and locked in a higher stop loss (₹73.25).

---

## 4. Technical Architecture & Data Strategy *(Technical Reference)*

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       OPTIPULSE PREDICTION PIPELINE                     │
└─────────────────────────────────────────────────────────────────────────┘
                                     │
      ┌──────────────────────────────┴──────────────────────────────┐
      ▼                                                             ▼
┌──────────────────────────────┐              ┌──────────────────────────────┐
│  LIVE MARKET TELEMETRY FEED  │              │  DERIVATIVE CONSTITUENTS &   │
│  (Spot, Options Chain, VWAP, │              │  HEAVYWEIGHT LEAD-LAG ENGINE │
│  Volume, Order Flow Delta)   │              │  (HDFC Bank, Reliance, ICICI)│
└──────────────┬───────────────┘              └──────────────┬───────────────┘
               │                                             │
               └──────────────────────┬──────────────────────┘
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      THE 15 INSTITUTIONAL PILLARS                       │
│  1. OI Unwinding & Writing Velocity   9. MACD Velocity & Expansion       │
│  2. Heavyweight Lead-Lag Impact      10. Order Flow Delta & Imbalance   │
│  3. Cumulative Order Flow Delta (CVD) 11. VIX Volatility Velocity       │
│  4. Volatility Compression Squeeze   12. Inter-Market Telemetry (GIFT)  │
│  5. Liquidity Sweep & Wick Reversal  13. Volume Analytics & Spikes      │
│  6. GIFT Nifty / Global Macro Drift  14. HTF Multi-Timeframe Alignment  │
│  7. Sectoral Breadth & RS Ratio      15. Anti-Whipsaw Hysteresis State  │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     INSTITUTIONAL CAPITAL GUARD RAILS                   │
│  Guard Rail 0: Heavyweight Divergence Protection                       │
│  Guard Rail 1: VWAP Trend Alignment & Reclaim Verification              │
│  Guard Rail 1B: Closing Bell 0-DTE Short-Covering Squeeze Protection    │
│  Guard Rail 2: Extreme PCR Reversal Trap                                │
│  Guard Rail 3: Overhead Call Wall / Support Put Wall Clamping           │
│  Guard Rail 3B: Low-Volume Consolidation Deadband Protection            │
│  Guard Rail 4 & 5: Session High/Low & RSI Exhaustion Traps              │
│  Sanity Check: Absolute Derivatives & Candlestick Contradiction Block   │
└─────────────────────────────────────┬───────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     FINAL SYNCHRONIZED SIGNAL OUTPUT                    │
│      Action: BUY_CE | BUY_PE | WAIT_NEUTRAL                             │
│      Strike, Moneyness, Option Entry Range, Stop-Loss, Targets, R:R     │
│      Initial SL (< Entry) vs Trailed Profit Lock SL (> Entry)           │
└─────────────────────────────────────────────────────────────────────────┘
```

### The 15 Prediction Pillars & Mathematical Roles

| Pillar # | Prediction Factor | Mathematical / Data Source | Action Bias Impact |
| :--- | :--- | :--- | :--- |
| **Pillar 1** | **OI Velocity & Unwinding** | Near strike CE/PE OI change delta (`nearCeOiChange` vs `nearPeOiChange`) | `+2.4` Bullish on CE unwinding / PE writing; `-2.4` Bearish on PE unwinding |
| **Pillar 2** | **Heavyweight Lead-Lag** | Top Nifty 50 derivative constituents point impact (`netNiftyPointImpact`) | `+2.6` Bullish on net impact ≥ +18 pts; `-2.6` Bearish on net impact ≤ -18 pts |
| **Pillar 3** | **Cumulative Order Flow Delta** | Order flow delta % (`orderFlowDelta`) & volume imbalance % | `+2.2` Bullish on Buyer Dominance; `-2.2` Bearish on Seller Dominance |
| **Pillar 4** | **Volatility Compression Squeeze** | 5m swing range vs ATR ratio & 9/21 EMA compression | `+1.0` / `-1.0` Pre-breakout coiling multiplier |
| **Pillar 5** | **Liquidity Sweep & Wick Absorption** | Support/Resistance wick traps & RSI divergence | `+2.2` Bullish on lower wick absorption; `-2.2` Bearish on upper wick rejection |
| **Pillar 6** | **GIFT Nifty & Global Macro** | Implied cash basis gap (`giftNiftyPrice - spotPrice`) | `+2.4` Bullish on cash premium ≥ +25 pts; `-2.4` Bearish on discount ≤ -25 pts |
| **Pillar 7** | **Sectoral Breadth & Relative Strength** | Advance/Decline ratio (`advances / declines`) & Banking sector sentiment | `+1.5` / `-1.5` Sectoral confirmation boost |
| **Pillar 8** | **5m RSI Momentum & Divergence** | RSI(14) level & Bullish/Bearish Divergence | `+1.5` Bullish divergence; `-1.5` Bearish divergence |
| **Pillar 9** | **5m MACD Velocity & Expansion** | MACD(12,26,9) histogram trend & expansion state | `+1.2` Bullish expansion; `-1.2` Bearish expansion |
| **Pillar 10** | **Options Order Flow PCR Delta** | Intraday PCR volume vs Total OI PCR divergence | `+0.7` / `-0.7` Fast intraday option accumulation skew |
| **Pillar 11** | **VIX Volatility Velocity** | VIX velocity state (`SURGING` vs `COMPRESSING`) | `-1.0` Accelerates downside on surge; `+0.6` Supports grind up on crush |
| **Pillar 12** | **Inter-Market Telemetry** | Global composite score (US Futures, Crude, DXY, Asian markets) | `+2.2` Max global macro contribution scaled |
| **Pillar 13** | **Volume Analytics & Spikes** | Total volume multiplier vs 20MA & Volume divergence | `+1.4` Bullish volume expansion; `-1.4` Bearish volume expansion |
| **Pillar 14** | **HTF Multi-Timeframe Alignment** | 1H, 1D, 1W higher-timeframe trend confluence | `+2.0` / `-2.0` HTF trend alignment boost |
| **Pillar 15** | **Anti-Whipsaw Hysteresis State Machine** | Signal lock duration & deadband momentum persistence | Guards against instantaneous flip-flop switching across ticks |

### Implementation File Action Plan

1. **`src/utils/advanceTradeEngine.ts` & `src/utils/signalEngine.ts`**:
   - Verify all 15 factor scores inside `computeAdvanceTradeSetup`.
   - Update `leadingPredictorFactors` array to explicitly expose all 15 pillars in structured format.
   - Clamp fresh entry option stop losses (`stopLoss = Math.min(stopLoss, roundToTick(premium * 0.85))`).

2. **`src/components/AdvanceTradeCard.tsx` & `src/components/SignalCard.tsx`**:
   - Enhance the **Leading Predictors Radar** section to showcase all 15 factors when expanded.
   - Add explicit UI distinction for `🔒 Trailed Profit Lock SL: ₹73.25` vs `Initial Risk SL: ₹48.80`.

3. **`src/components/PredictionValidationCard.tsx`**:
   - Display a 15-Pillar Audit Health Summary table showing real-time accuracy, weight contribution, and bias status.

4. **Verification & Testing**:
   - Run `lint_applet` to confirm no syntax or type errors.
   - Run `compile_applet` to confirm build success.
