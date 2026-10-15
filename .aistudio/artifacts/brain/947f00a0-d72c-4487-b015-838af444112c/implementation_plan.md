# Implementation Plan: Dynamic Intraday Trend Reversal & Prediction Engine Tuning

## 1. Problem Diagnosis: Why the Recommendation Remained Stuck on CE

In today's trading session, the market rallied in the morning but reversed downward in the afternoon. Despite a continuous selloff from the day's peak, the trade recommendation engine continued recommending Call options (`BUY_CE`). The root causes identified within the codebase include:

1. **Previous-Close Anchor Bias (`prevCloseTrendScore`)**:
   - The engine calculated `spotChangePct = ticker.changePercent` (net change relative to yesterday's closing price).
   - When the market opens with a gap up or morning rally (+0.8%), even after an afternoon drop of 100–150 points from the session high, `changePercent` remains positive (e.g. +0.20%).
   - As a result, the daily trend score remained bullish throughout the afternoon, continuously injecting positive score points into the final composite calculation.

2. **Asymmetric "Recovery-Only" Price Action Metric**:
   - Intraday price action only measured `recoveryRatio = (spotPrice - dayLow) / dayRange`.
   - It measured distance from `dayLow`, but completely ignored rejection and distance from `dayHigh` (intraday selloff magnitude).
   - When spot pulled back from 23,200 to 23,050 (day low at 22,800), `recoveryRatio` remained at ~0.62 (> 0.50), causing the system to misclassify the afternoon drop as a bullish "recovery rally".

3. **Hard Bullish Veto Locking PE Recommendations**:
   - The engine enforced `isHardBullishVeto = isCandleUpward || bullContradictionCount >= 2 || (isMarketRaising && score > 0)`.
   - Because `isMarketRaising` evaluated `(isAboveDayOpen || spotChangePct >= 0.05)`, it remained true all day, strictly prohibiting `BUY_PE` from ever triggering even when volume and prices were collapsing.

4. **Synthetic Candle Upward Drift Bias**:
   - When real exchange candles are absent or forming, synthetic rolling candle generation defaulted to `isUptrend = changePct >= 0`, generating green candles pointing upward for an index that is declining intraday.

5. **Trade Persistence Without Reversal Invalidation**:
   - Ongoing trades maintained their state until numerical stop-loss or targets were reached, failing to recognize when the macro intraday regime reversed against the position.

---

## 2. User-Selected Requirements & Architecture Decisions

Based on your clarifying choices:
- **Trend Balancing**: Prioritize intraday price action, swing momentum, and rolling VWAP/EMA dynamics over previous close (down-weighting previous close to <= 10% or using relative intraday velocity).
- **Directional Transition**: Require strong multi-timeframe consensus (5m, 15m, 1h candle alignments, order flow delta, heavyweight breadth) before allowing a directional flip (CE -> PE), transitioning cleanly through `WAIT_NEUTRAL` to protect capital.
- **Active Trade Invalidation**: When the intraday trend reverses and contradicts an ongoing trade recommendation, issue an immediate reversal alert, set `tradeStage` to `STOP_LOSS_HIT` / `INVALIDATED_REVERSAL`, and reset the setup to protect capital.

---

## 3. Proposed Changes

### Component 1: `src/utils/signalEngine.ts` (Core Decision & Scoring Engine)
- **Symmetric Intraday Price Action**:
  - Replace one-sided `recoveryRatio` with a two-way intraday swing metric:
    - `highRejectionRatio = (dayHigh - spotPrice) / dayRange` (measures afternoon supply breakdown from peak).
    - `lowRecoveryRatio = (spotPrice - dayLow) / dayRange` (measures morning absorption from low).
    - `intradayNetSwing = lowRecoveryRatio - highRejectionRatio` (-1.0 at day low to +1.0 at day high).
  - Deprecate static `prevCloseTrendScore` influence during active regular market sessions; price action will reflect current session dynamics (VWAP distance, intraday high/low breakdown, and 15m/5m price velocity).
- **Remove Hard One-Way Vetoes**:
  - Replace rigid `isHardBullishVeto` / `isHardBearishVeto` with symmetric multi-factor confluence checks.
  - Allow `BUY_PE` to trigger when price breaks below VWAP and EMA stack, even if the net daily change against yesterday is still slightly positive.
- **Multi-Timeframe Consensus Verification**:
  - Enforce a strict multi-timeframe consensus gate: before flipping from a previous `BUY_CE` to `BUY_PE`, require confirmation across 5m/15m chart patterns, VWAP breakdown (`spot < VWAP`), and order flow delta or heavyweight breadth.
  - If conditions are mixed during the reversal transition, route through `WAIT_NEUTRAL` with explicit capital preservation reasons.
- **Active Ongoing Trade Invalidation**:
  - In `generateTradeSignal`, check if an ongoing trade (`previousSignal.action === 'BUY_CE'`) faces confirmed bearish reversal conditions (`spot < VWAP` with bearish EMA/candles).
  - Trigger `tradeStage = 'STOP_LOSS_HIT'`, update notes to `⚠️ Trend Reversal Invalidation: Intraday trend flipped to bearish; exit remaining positions`, and unlock the engine to seek the next valid setup.

### Component 2: `src/utils/candlestickEngine.ts` (Chart Patterns & Rolling Candles)
- Update `generateRollingCandles`:
  - Determine `isUptrend` / `isDowntrend` using live intraday swing velocity, current spot position relative to session VWAP, and distance from `dayHigh` rather than solely `changePct >= 0`.
  - Ensure synthetic candles accurately illustrate the afternoon decline when spot drops off the high of the day.

### Component 3: `src/utils/technicalIndicators.ts` (VWAP & Dynamic Indicators)
- Ensure intraday session VWAP and EMA stack accurately track rolling 5m candle volume and price transitions.
- If the spot price is below the 9 and 21 EMA with negative slope, classify EMA alignment as `BEARISH_STACK` regardless of opening gap-up percentages.

---

## 4. Verification & Testing Plan

1. **Compilation Check**:
   - Run `compile_applet` to verify TypeScript types, imports, and clean builds.
2. **Scenario Simulation Testing**:
   - Run automated headless script evaluating simulated session scenarios:
     - **Scenario A (Morning Gap-up & Rally)**: Spot opens +0.5% higher, trades above VWAP, EMA bullish -> Verify algorithm recommends `BUY_CE` with high confidence.
     - **Scenario B (Afternoon Trend Reversal)**: Market drops 120 points from morning high; spot falls below VWAP and 9 EMA; `changePercent` remains +0.15% vs yesterday's close -> Verify algorithm:
       1. Immediately invalidates the morning CE trade stage (`Trend Reversal Exit`).
       2. Transitions through `WAIT_NEUTRAL` / `BUY_PE` as multi-timeframe consensus confirms.
       3. NEVER remains stuck on CE.
     - **Scenario C (Chop & False Breakdown)**: Price oscillates around VWAP with mixed indicators -> Verify algorithm holds `WAIT_NEUTRAL` to protect against theta bleed.
3. **End-to-End Dev Server Check**:
   - Restart dev server and verify UI responsiveness, latency indicators, and live trade recommendation card behavior.
