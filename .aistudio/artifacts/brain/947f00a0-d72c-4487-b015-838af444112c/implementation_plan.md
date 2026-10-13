# Signal Engine Audit & Bullish-PE Recommendation Anomaly Fix

Detailed root-cause analysis and architectural verification plan explaining why the algorithmic signal generator previously defaulted to PE (Put Option) recommendations despite bullish candlestick momentum, quant parameters, news wire signals, and Nifty 50 derivative indicators, along with the verified fixes implemented across the 15-pillar engine.

> [!IMPORTANT]
> **User Confirmed Decisions**
> - **Diagnostic Report Format**: Full detailed technical breakdown of root cause anomalies, mathematical audits, and code fixes.
> - **UI Interface**: Maintain the clean standard signal card interface without adding extra score panels to preserve scannability.

---

## 1. Overview & Core Concept

### What It Does
The Advance Trade & Live Signal Engine analyzes real-time option chain dynamics, PCR (Put-Call Ratio), market breadth across Nifty 50 constituents, order flow imbalance, and candle momentum to output high-probability options trade recommendations (`BUY_CE`, `BUY_PE`, or `WAIT_NEUTRAL`).

### The Anomaly Explained
The user observed a state where:
- Candlestick momentum was bullish
- Quant parameters were bullish
- News wire sentiment was positive
- Nifty 50 derivatives were showing bullish structure
**Yet the system recommended `BUY_PE` (Put Option).**

---

## 2. Root Cause Analysis & Audit Findings

Our deep audit of the 15-pillar engine, option chain synthesis, and trade decision rules revealed three compound flaws that caused a hard bias towards PE signals:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PE BIAS ANOMALY ROOT CAUSES                           │
├─────────────────────────────────────────────────────────────────────────────┤
│ 1. Synthetic Open Interest Asymmetry in Option Chain (useLiveOptionChain.ts) │
│    • Static trig calculations (Math.cos) generated negative Put OI change   │
│      values (peOIChg < 0) while Call OI change remained positive.           │
│    • Result: nearbyCeOIChg > nearbyPeOIChg * 1.15 evaluated to TRUE,       │
│      artificially inflating bearMatches count regardless of price trend.    │
├─────────────────────────────────────────────────────────────────────────────┤
│ 2. Neutral Score Fallback Skew in Advance Engine (advanceTradeEngine.ts)   │
│    • Condition `totalBearScore >= totalBullScore` inside `isBearishSkew`    │
│      defaulted equal/neutral scores to a bearish (PE) classification.       │
│    • Result: High-confidence bullish trades were blocked or skewed to PE.   │
├─────────────────────────────────────────────────────────────────────────────┤
│ 3. Unscaled Nifty Constituent Point Impact (niftyConstituents.ts)          │
│    • Market breadth analysis did not scale stock constituent changes with   │
│      the parent index's live change percentage.                             │
│    • Result: Heavyweight constituents produced net negative points impact    │
│      even when Nifty 50 was actively gaining momentum.                      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Verified Fixes & Technical Strategy

### Fix 1: Trend-Responsive OI Building (`src/hooks/useLiveOptionChain.ts`)
- Replaced unaligned trigonometric OI formulas with trend-responsive multipliers tied directly to `ticker.changePercent`.
- When `changePercent > 0` (rising market), Put writing (PE OI) increases and Call writing decreases, matching actual derivative market mechanics.
- Added strict non-negative conditions (`nearbyPeOIChg > 0 && nearbyCeOIChg > 0`) before evaluating relative OI ratios in `signalEngine.ts`.

### Fix 2: Symmetric Neutral Fallback (`src/utils/advanceTradeEngine.ts`)
- Updated `isBearishSkew` evaluation to require `totalBearScore > totalBullScore` (strict inequality).
- When scores are equal, directional resolution evaluates spot price momentum (`spotChangePct < -0.05`) rather than defaulting to PE.

### Fix 3: Index-Scaled Constituent Analysis (`src/data/niftyConstituents.ts`)
- Passed `ticker.changePercent` dynamically to `analyzeNiftyConstituents`.
- Properly aligned heavyweight constituent contributions (RELIANCE, HDFCBANK, ICICIBANK) with real index directional movement.

---

## 4. Technical Architecture & Component Interaction

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LIVE SIGNAL DATA FLOW                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │ Live Option Chain & OI Calculator │
                     │  (Trend-aligned Call & Put OI)    │
                     └───────────────────────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │     15-Pillar Decision Engine     │
                     │  • Quant Momentum                 │
                     │  • PCR & Derivative Alignment     │
                     │  • News Wire & Candlesticks       │
                     │  • Scaled Constituent Breadth     │
                     └───────────────────────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │   Advance Trade Signal Engine     │
                     │ (Symmetric Neutral Skew Resolver) │
                     └───────────────────────────────────┘
                                       │
                                       ▼
                     ┌───────────────────────────────────┐
                     │      AdvanceTradeCard View        │
                     │  Outputs: BUY_CE / BUY_PE / WAIT  │
                     └───────────────────────────────────┘
```

---

## 5. Verification Matrix & Results

| Market Conditions | Nifty Change % | Correct Output Signal | Previous Output (Buggy) | Status |
| :--- | :--- | :--- | :--- | :--- |
| Heavy Bullish | +0.80% | `BUY_CE` (Call Option) | `BUY_PE` (Put Option) | **VERIFIED FIX** |
| Moderate Bullish | +0.30% | `BUY_CE` (Call Option) | `BUY_PE` (Put Option) | **VERIFIED FIX** |
| Flat / Neutral | 0.00% | `WAIT_NEUTRAL` | `BUY_PE` (Put Option) | **VERIFIED FIX** |
| Heavy Bearish | -0.80% | `BUY_PE` (Put Option) | `BUY_PE` (Put Option) | **VERIFIED PASS** |
