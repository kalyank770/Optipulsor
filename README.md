# OptiPulse V5.0 — Institutional Derivatives Intelligence & Algorithmic Prediction Engine

OptiPulse V5.0 is an institutional-grade options trading intelligence workstation and real-time predictive engine engineered for Indian & Global Derivatives Markets (NSE NIFTY 50, BANKNIFTY, FINNIFTY, MIDCPNIFTY, SENSEX, and Equities).

It combines real-time option chain analytics, order flow delta imbalances, multi-timeframe candlestick momentum, global macro cues, heavyweight constituent breadth, and institutional early-anticipation models into a unified 5-tab trading workstation.

---

## Executive Summary & Core Value Proposition

1. **Pre & After-Market Early Anticipation**: Captures institutional accumulation and distribution prior to regular market open using 5 leading predictor factors (OI Velocity, Heavyweight Lead, Order Flow Delta, Volatility Squeeze, Liquidity Sweeps).
2. **Multi-Factor Signal Confluence**: Evaluates 12+ real-time quantitative inputs to generate actionable trade setups (`BUY_CE`, `BUY_PE`, or `WAIT_NEUTRAL`) with precise entry zones, targets, invalidation stop-losses, and risk-reward ratios.
3. **Live Market Open Validation Engine**: Automatically snapshots overnight/pre-market predictions and validates them against regular open exchange execution, logging parameter-by-parameter accuracy scorecards.
4. **Order Flow & Quant Telemetry**: Tracks real-time buyer vs. seller delta imbalances, Put-Call Ratio (PCR), Volume Divergence, and Gamma Exposure (GEX) flip strikes.
5. **Interactive Options Payoff & Greeks Simulator**: Uses Black-Scholes pricing models to simulate P&L matrix, delta/gamma sensitivity, and breakeven boundaries across custom strike contracts.
6. **Audit Report Engine**: Maintains an immutable, audit-compliant trade log and historical performance ledger stored locally across trading sessions.

---

## System Architecture & Component Topology

The application is built as a modular React + TypeScript SPA using Vite, styled with Tailwind CSS, and powered by modular quantitative engines.

```
                    ┌─────────────────────────────────────────────────────────┐
                    │                      Header.tsx                         │
                    │   Ticker Selector · Exchange Session Sync · Mode Toggle │
                    └────────────────────────────┬────────────────────────────┘
                                                 │
                                                 ▼
                    ┌─────────────────────────────────────────────────────────┐
                    │               Workstation Navigation Bar                │
                    │      5 Standardized Tabs with Realtime Sentiment Dots    │
                    └────────────────────────────┬────────────────────────────┘
                                                 │
       ┌──────────────────┬──────────────────────┼─────────────────────┬──────────────────┐
       │                  │                      │                     │                  │
       ▼                  ▼                      ▼                     ▼                  ▼
┌──────────────┐   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐    ┌──────────────┐
│Tab 1: Trade  │   │Tab 2: Candle │      │Tab 3: Quant &│      │Tab 4: News & │    │Tab 5: Audit  │
│  Dynamics    │   │  Momentum    │      │ Order Flow   │      │  Catalysts   │    │    Report    │
└──────┬───────┘   └──────┬───────┘      └──────┬───────┘      └──────┬───────┘    └──────┬───────┘
       │                  │                      │                     │                  │
       ├─► AdvanceTrade   ├─► HTFPredictions     ├─► RealtimeQuant     ├─► NewsWidget     └─► DaysReport
       │   Card               Workstation            Section
       ├─► SignalCard     ├─► Candlestick        ├─► Order Flow Delta  ├─► Catalyst Feed
       ├─► Prediction-        Engine             ├─► Gamma Exposure    └─► Macro Cues
       │   Validation                            └─► PCR & Vol Imbalance
       ├─► GroundedPayoff
       └─► OptionChain
```

---

## Key Workstation Tabs

### 1. Trade Dynamics (`chain`)
Primary execution dashboard containing:
- **Institutional Early-Anticipation Engine** (`AdvanceTradeCard.tsx`): Displays early trade recommendations, entry ranges, stop-loss protection, targets, and a 5-factor leading predictor radar.
- **Pre & After-Market Prediction vs Live Open Validation Engine** (`PredictionValidationCard.tsx`): Real-time snapshot vs. live regular open comparison with accuracy scorecards.
- **High-Probability Swing & News Multiplier Engine** (`SignalCard.tsx`): Detailed signal breakdown, rationale points, entry/exit grounding, and multi-expiry signal matrices.
- **Option Contract Payoff & Risk Matrix** (`GroundedPayoffSection.tsx`): Interactive strike simulator and profit-probability calculator.
- **Live Option Chain Workstation** (`OptionChainTable.tsx` & `OiDistributionChart.tsx`): Full strike table displaying Call/Put LTP, Change, IV, OI, Volume, Greeks, and Buildup status.

### 2. Candlestick Momentum (`htf`)
Powered by `HTFPredictionsWorkstation.tsx`:
- Evaluates multi-timeframe candle structures (2m, 5m, 15m, 1H, 1D, 1W).
- Projects expected move boundaries ($\pm 1\sigma$), VWAP velocity, ATR volatility coiling, and HTF directional bias.

### 3. Order Flow & Quant (`quant`)
Powered by `RealtimeQuantSection.tsx`:
- **Order Flow Imbalance**: Quantifies buyer vs. seller delta percentage.
- **Gamma Exposure (GEX)**: Identifies gamma regime (LONG GEX vs. SHORT GEX) and flip strikes.
- **PCR Analytics**: Evaluates Total OI PCR vs. Volume PCR to detect institutional divergence.

### 4. News & Catalysts (`news`)
Powered by `NewsWidget.tsx`:
- Tracks breaking geopolitical, monetary policy, and corporate earnings catalysts.
- Calculates an **Overall Sentiment Label** (`BULLISH`, `BEARISH`, or `NEUTRAL`) and impact multiplier.

### 5. Audit Report (`report`)
Powered by `DaysReportTab.tsx`:
- Consolidated trade execution ledger logging every signal generated during active trading sessions.
- Displays target achievement status, P&L audit metrics, and historical prediction accuracy.

---

## Status Indicator Visual System (Dot Standard)

To provide immediate visual feedback without opening individual tabs, each top tab includes a pulse dot indicator:

| Status Dot Color | Market State / Signal | Trigger Conditions |
|---|---|---|
| 🟢 **Emerald Green** (`bg-emerald-400`) | **Bullish** | Trade Dynamics: `BUY_CE`<br>Candles: Bullish Confluence<br>Quant: Buyer Dominance / Positive Delta<br>News: `Overall: BULLISH` |
| 🔴 **Rose Red** (`bg-rose-500`) | **Bearish** | Trade Dynamics: `BUY_PE`<br>Candles: Bearish Breakdown<br>Quant: Seller Dominance / Negative Delta<br>News: `Overall: BEARISH` |
| 🟡 **Amber Yellow** (`bg-amber-400`) | **Sideways / Range** | Compression Squeeze / Symmetrical Triangle / Low Volume Chop |
| ⚪ **Slate Grey** (`bg-slate-400`) | **Neutral / Equilibrium** | Balanced Cash Flows / Wait Signal |

---

## Core Algorithmic & Mathematical Models

### 1. Multi-Factor Signal Engine (`src/utils/signalEngine.ts`)
Generates the core `TradeSignal` by synthesizing 12 weighted factors:

$$\text{Composite Score} = \sum_{i=1}^{12} w_i \cdot S_i$$

Where key factors include:
- $S_1$: Option Chain PCR & Max Pain Drift
- $S_2$: Real-time Order Flow Delta Imbalance (%)
- $S_3$: Heavyweight Constituent Delta (Weighted Index Impact)
- $S_4$: Global Macro Cues (GIFT Nifty, S&P 500 Futures, Brent Crude)
- $S_5$: Technical Momentum (RSI 14, MACD Histogram, VWAP Proximity)
- $S_6$: Multi-Timeframe Candle Confluence (2m / 5m / 15m)
- $S_7$: News Multiplier Impact ($0.8x - 1.35x$)

Confidence percentage is derived via:

$$\text{Confidence (\%)} = \min\left(98, \max\left(50, 50 + |\text{Composite Score}| \times 0.48\right)\right)$$

### 2. Institutional Early-Anticipation Engine (`src/utils/advanceTradeEngine.ts`)
Detects institutional accumulation/distribution prior to breakout:
- Evaluates **OI Velocity** (surge in Call/Put Open Interest).
- Tracks **Heavyweight Front-Running** (buying in top sector leaders like HDFCBANK, RELIANCE, ICICIBANK).
- Calculates **Lead Time Advantage** (typically 15 to 45 minutes ahead of lagging breakout indicators) and estimated **Slippage Savings** (12% to 28%).

### 3. Pre & After-Market Validation Engine (`src/utils/predictionValidationStore.ts` & `afterMarketEngine.ts`)
Snapshots predictions generated during pre-market/after-market sessions and validates them against live exchange open data:
- **Gap Verification**: Compares predicted gap points vs. actual gap at 09:15 AM IST.
- **Opening Type Classification**: Verifies `GAP_UP_OPENING`, `GAP_DOWN_OPENING`, or `FLAT_OPENING`.
- **Target Achievement**: Logs whether Target 1 and Target 2 were hit during initial opening volatility.
- **Accuracy Scorecard**: Computes overall accuracy score (%):

$$\text{Accuracy Score} = \frac{\sum \text{Correct Parameter Weights}}{\text{Total Evaluated Weights}} \times 100$$

### 4. Black-Scholes Options Pricing Engine (`src/utils/blackScholes.ts`)
Calculates theoretical option price ($C$ or $P$) and Greeks:

$$d_1 = \frac{\ln(S/K) + (r + \sigma^2/2)T}{\sigma \sqrt{T}}, \quad d_2 = d_1 - \sigma \sqrt{T}$$

$$C = S N(d_1) - K e^{-rT} N(d_2)$$

$$P = K e^{-rT} N(-d_2) - S N(-d_1)$$

Where:
- $\Delta_{Call} = N(d_1), \quad \Delta_{Put} = N(d_1) - 1$
- $\Gamma = \frac{N'(d_1)}{S \sigma \sqrt{T}}$
- $\Theta_{Call} = -\frac{S N'(d_1) \sigma}{2 \sqrt{T}} - r K e^{-rT} N(d_2)$
- $V = S \sqrt{T} N'(d_1)$

---

## Directory Structure & Component Inventory

```
src/
├── App.tsx                          # Primary layout, state orchestrator, tab navigation & indicator dots
├── index.css                        # Tailwind CSS imports & global workstation styles
├── main.tsx                         # React entry point
├── components/
│   ├── AdvanceTradeCard.tsx         # Institutional Early-Anticipation Engine card
│   ├── AfterMarketOpeningCard.tsx   # Pre/After-market opening analytics banner
│   ├── DaysReportTab.tsx            # Audit Report workstation tab component
│   ├── FilterBar.tsx                # Ticker & time interval control bar
│   ├── GroundedPayoffSection.tsx    # Interactive option contract payoff matrix
│   ├── Header.tsx                   # Main app bar (OptiPulse V5.0, live sync, market status)
│   ├── HTFPredictionsWorkstation.tsx# Candlestick Momentum workstation
│   ├── NewsWidget.tsx               # Breaking news & catalyst feed
│   ├── OiDistributionChart.tsx      # Open Interest bar chart distribution
│   ├── OptionChainTable.tsx         # Full option chain grid (Calls vs Puts)
│   ├── OptionPayoffModal.tsx        # Modal simulator for payoff curves
│   ├── PredictionValidationCard.tsx # Pre/After-market vs live open validation card
│   ├── RealtimeQuantSection.tsx     # Order Flow Delta & Gamma Exposure section
│   ├── SignalCard.tsx               # Trade dynamics signal card & multi-expiry matrix
│   └── StrikeHistoryTrends.tsx      # Strike history background analytics visualization
├── types/
│   ├── htfPredictions.ts            # Types for HTF prediction engine
│   └── options.ts                   # Core data models (TradeSignal, OptionChainRow, MarketMetrics, etc.)
└── utils/
    ├── advanceTradeEngine.ts        # Institutional early-anticipation setup generator
    ├── afterMarketEngine.ts         # Pre/After-market opening analytics calculation
    ├── blackScholes.ts              # Options pricing & Greeks mathematical formulas
    ├── candlestickEngine.ts        # Multi-timeframe candle pattern recognition
    ├── daysReportEngine.ts          # Audit report ledger state manager
    ├── expiryEngine.ts             # Expiry date parsing & settlement calculations
    ├── htfPredictionEngine.ts       # Higher timeframe forecast engine
    ├── marketHolidays.ts            # NSE official trading holiday calendar (2026)
    ├── marketHours.ts               # Exchange market hours & CAS session validator
    ├── predictionValidationStore.ts # Validation store & snapshot persistence
    ├── signalEngine.ts              # Core multi-factor signal evaluation engine
    ├── strikeHistoryEngine.ts       # Strike history tracking & win-rate confluence
    └── technicalIndicators.ts       # Technical indicator formulas (RSI, MACD, VWAP, ATR, Supertrend)
```

---

## Development Workflow & Handover Guidelines for Developers and AI Models

### 1. Build & Validation Commands
- **Compile Verification**: `npm run build` or the `compile_applet` tool.
- **Type Check & Linting**: `npm run lint` or `nsc --noEmit` / `lint_applet` tool.
- **Dev Server**: `npm run dev` (Runs Vite on port 3000).

### 2. Critical Architecture Rules
1. **Zero Mock Fallbacks in Live Calculations**: Always compute real metrics from live or simulated option chain & ticker data. Never inject hardcoded random dummy values into the prediction engines.
2. **Single Source of Truth for Signals**: `signalEngine.ts` is the central engine for generating trade actions. Higher level setups (e.g. `advanceTradeEngine.ts`) wrap or extend this base signal without contradicting it.
3. **Preserve Indicator Dot Consistency**: When adding new tabs or signals, ensure status indicator dots adhere strictly to the green/red/yellow/grey color standard.
4. **Header Cleanliness**: Keep branding labels clean (e.g., `OptiPulse V5.0` in plain grey text without intrusive background boxes).
5. **Persistent Storage Keys**: LocalStorage keys (`optipulse_prediction_history_v3`, `optipulse_days_report_v2`, etc.) must remain backward-compatible when schema extensions occur.

### 3. State Management Flow
`App.tsx` acts as the root controller, holding:
- `selectedTicker`: Active market symbol (`NIFTY 50`, `BANKNIFTY`, etc.).
- `metrics`: Computed market stats (spot, PCR, Max Pain, ATM strike).
- `chain`: Filtered option chain rows with live Greeks and LTPs.
- `signal`: Current `TradeSignal` generated by `signalEngine.ts`.
- `htfPredictions`: HTF trend forecasts generated by `htfPredictionEngine.ts`.
- `activeTab`: Currently selected workspace view (`chain`, `htf`, `quant`, `news`, `report`).

---

## License & Operational Note

Designed for high-frequency derivatives research, quantitative option chain analysis, and intraday setup validation. Strictly engineered for technical precision and data integrity.
