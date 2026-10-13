# Comprehensive Audit & Verification of CE, PE, and NEUTRAL Prediction Algorithms

A complete audit and precision-calibration plan to verify that CE (Call Option), PE (Put Option), and NEUTRAL (Wait / Capital Protection) recommendations are 100% accurately interpreted, mathematically balanced, and clearly presented across the real-time, multi-timeframe, and pre/after-market prediction engines.

> [!IMPORTANT]
> **Confirmed User Decisions**:
> - **Scope**: Full audit across real-time (`signalEngine.ts`), multi-timeframe (`htfPredictionEngine.ts`), and pre-market (`afterMarketEngine.ts`) prediction engines.
> - **Neutral Trigger Discipline**: Balanced threshold triggering `WAIT_NEUTRAL` on signal tie, deadband equilibrium (score within -0.7 to +0.7), or multi-factor indicator divergence.
> - **CE/PE Symmetry**: Strict 1:1 symmetrical scoring math, identical guard rail thresholds, and symmetric contradiction veto checks for CE and PE.

---

## 1. Overview & Core Concept

- **What It Does**: Scans all 3 prediction engines in the app (Real-Time Intraday Option Engine, Pre/After-Market Opening Predictor, and Multi-Timeframe Trend Predictor) to audit scoring weightings, veto thresholds, guard rails, and UI badge interpretations for CE, PE, and NEUTRAL recommendations.
- **Target Audience / Persona**: High-frequency and intraday F&O traders requiring 100% reliable, zero-bias, transparent option trade recommendations with zero false-directional skew or misinterpretation.
- **Key Value**: Guarantees that CE is only recommended on genuine bullish momentum/reclaim, PE on genuine bearish breakdown/supply, and NEUTRAL on chop/conflict—eliminating any residual bias or misleading trade signals.

---

## 2. Comprehensive Engine Audit Matrix

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FULL PREDICTION ALGORITHM AUDIT MATRIX                          │
├──────────────────────────────┬─────────────────────────────┬───────────────────────────┤
│ Engine / Component           │ Scan Focus Area             │ Verification Target       │
├──────────────────────────────┼─────────────────────────────┼───────────────────────────┤
│ 1. Real-Time Option Engine   │ • Score thresholds          │ • BUY_CE if score >= +0.7 │
│    (src/utils/signalEngine)  │ • Bull vs Bear match ratio  │ • BUY_PE if score <= -0.7 │
│                              │ • Guard Rail symmetry       │ • WAIT_NEUTRAL in deadband│
│                              │ • Contradiction veto logic  │   (-0.7 < score < +0.7)   │
├──────────────────────────────┼─────────────────────────────┼───────────────────────────┤
│ 2. Pre-Market Predictor      │ • Gift Nifty implied open   │ • BUY_CE on Gap-Up        │
│    (src/utils/afterMarket)   │ • Basis & Gap drift math    │ • BUY_PE on Gap-Down      │
│                              │ • Directional opening skew  │ • WAIT on Flat / Chop     │
├──────────────────────────────┼─────────────────────────────┼───────────────────────────┤
│ 3. Multi-Timeframe Forecast  │ • 15m, 1h, 1d trend alignment│ • BULLISH_CE, BEARISH_PE, │
│    (src/utils/htfPrediction) │ • HTF Confluence weighting  │   or NEUTRAL_RANGE        │
├──────────────────────────────┼─────────────────────────────┼───────────────────────────┤
│ 4. UI Representation Cards   │ • SignalCard.tsx            │ • Accurate color coding & │
│    (src/components/*)        │ • AfterMarketOpeningCard    │   unambiguous action text │
└──────────────────────────────┴─────────────────────────────┴───────────────────────────┘
```

---

## 3. Detailed Audit Findings & Planned Fixes

### A. Real-Time Signal Engine (`src/utils/signalEngine.ts`)
1. **Symmetric Score Thresholds**:
   - Ensure `score >= +0.7` and `netBullEdge >= 1` route to `BUY_CE`.
   - Ensure `score <= -0.7` and `netBullEdge <= -1` route to `BUY_PE`.
   - Ensure scores within `(-0.7, +0.7)` or `netBullEdge == 0` route cleanly to `WAIT_NEUTRAL`.
2. **Symmetrical Contradiction Veto Checks**:
   - Verify `bullContradictionCount` and `bearContradictionCount` evaluate mirrored conditions (PCR, order flow, candlestick confluence, and heavyweight point impact).
3. **Guard Rail Symmetrical Softening**:
   - Audit Guard Rails 0 to 8 (VWAP support/resistance, Call Wall / Put Wall proximity, PCR extremes, RSI overbought/oversold) to verify they dampen both CE and PE with exact 1:1 mathematical formulas.
4. **`recommendedType` Watchlist Clarity when `WAIT_NEUTRAL`**:
   - When action is `WAIT_NEUTRAL`, ensure the UI clearly highlights the "WAIT / NEUTRAL" state while displaying the reference watchlist strike without confusing the user into thinking an active order entry is advised.

### B. Pre-Market Engine (`src/utils/afterMarketEngine.ts`)
1. **Gap-Up & Gap-Down Strategy Routing**:
   - Verify `GAP_UP_OPENING` maps exclusively to `BUY_CE` or `WAIT_FIRST_15M` (never `BUY_PE`).
   - Verify `GAP_DOWN_OPENING` maps exclusively to `BUY_PE` or `WAIT_FIRST_15M` (never `BUY_CE`).
   - Verify `FLAT_OPENING` defaults to `WAIT_FIRST_15M`.

### C. Multi-Timeframe Trend Engine (`src/utils/htfPredictionEngine.ts`)
1. **Timeframe Confluence Calculation**:
   - Verify 15m, 1h, and Daily timeframes use uniform trend thresholds for `BULLISH_CE`, `BEARISH_PE`, and `NEUTRAL_RANGE`.

### D. UI Rendering & Interpretation Clarity (`SignalCard.tsx` & `AfterMarketOpeningCard.tsx`)
1. **Visual Distinction**:
   - **CE (Call Option)**: Vibrant Emerald/Green badge with `BUY_CE` or `BULLISH_CE` action text.
   - **PE (Put Option)**: Sharp Rose/Red badge with `BUY_PE` or `BEARISH_PE` action text.
   - **NEUTRAL (Wait)**: Clear Amber/Slate badge with `WAIT_NEUTRAL` or `WAIT_FIRST_15M` action text and capital protection rationale.

---

## 4. Technical Architecture & Component Flow

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                            PREDICTION INTERPRETATION FLOW                              │
└───────────────────────────┬────────────────────────────────────────────┘
                                            │
                                  ┌─────────┴─────────┐
                                  │   Market Data &   │
                                  │ Live Option Chain │
                                  └─────────┬─────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
          ┌─────────┴─────────┐   ┌─────────┴─────────┐   ┌─────────┴─────────┐
          │ Real-Time Signal  │   │ Pre-Market Opening│   │  HTF Prediction   │
          │      Engine       │   │      Engine       │   │      Engine       │
          └─────────┬─────────┘   └─────────┬─────────┘   └─────────┬─────────┘
                    │                       │                       │
                    └───────────────────────┼───────────────────────┘
                                            │
                                  ┌─────────┴─────────┐
                                  │ Symmetric Audit   │
                                  │   & Veto Filter   │
                                  └─────────┬─────────┘
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               │                            │                            │
     ┌─────────┴─────────┐        ┌─────────┴─────────┐        ┌─────────┴─────────┐
     │   BUY_CE (Call)   │        │   BUY_PE (Put)    │        │   WAIT_NEUTRAL    │
     │  Score >= +0.7    │        │  Score <= -0.7    │        │ Deadband / Chop   │
     └─────────┬─────────┘        └─────────┬─────────┘        └─────────┬─────────┘
               │                            │                            │
               └────────────────────────────┼────────────────────────────┘
                                            │
                                  ┌─────────┴─────────┐
                                  │  UI Signal Cards  │
                                  │ (Green/Red/Amber) │
                                  └───────────────────┘
```

---

## 5. Implementation & Verification Plan

1. **Algorithm Code Audit & Calibration**:
   - Review `src/utils/signalEngine.ts`, `src/utils/afterMarketEngine.ts`, and `src/utils/htfPredictionEngine.ts` to confirm 100% symmetry in scoring math, veto rules, and strategy assignment.
   - Verify that all edge cases (neutral tie, extreme PCR, heavyweight divergence, gap-up vs gap-down) result in accurate CE, PE, or NEUTRAL outputs.
2. **UI & Component Audit**:
   - Verify `SignalCard.tsx` and `AfterMarketOpeningCard.tsx` render badges, strike suggestions, dynamic confidence bars, and capital protection notices clearly without ambiguity.
3. **Build & Type-Safety Validation**:
   - Execute `compile_applet` and `lint_applet` to ensure zero compilation or syntax issues.
