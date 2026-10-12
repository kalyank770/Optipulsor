# OptiPulse Production Algorithm & Architectural Constitution

> **MANDATORY SYSTEM DIRECTIVE FOR ALL ENGINEERS & AI AGENTS**  
> This application is deployed for **production and real-money institutional and retail options trading**. False, hallucinated, or shifting signals result in severe real-world financial loss. Any modification to this codebase MUST adhere strictly to the invariants defined in this constitution.

---

## Pillar 1: Zero Dummy, Zero Fallback, 100% Authentic Live Exchange Data
1. **No Simulated Fallbacks in Live Mode**: Never use hardcoded prices (e.g. `108.50`, `19.00`), synthetic random walkers, or mocked option chains when the market is live or when exchange connections exist.
2. **Official Exchange Alignment**:
   - Indian Equity & Derivatives (`NIFTY 50`, `BANK NIFTY`, `FINNIFTY`): Calibrated to live National Stock Exchange of India (NSE) / NFO feeds and NSE IX (GIFT Nifty).
   - US Equities & Indices (`SPY`, `QQQ`, `AAPL`): Sourced via live CBOE / NASDAQ feeds.
3. **Session Awareness**:
   - **Pre-Market (09:00 - 09:15 IST)**: Discovery price equilibrium.
   - **Regular Continuous Market (09:15 - 15:30 IST)**: Live exchange market depth streaming at 1-second intervals.
   - **Closing Auction (15:30 - 15:40 IST)**: Final settlement discovery.
   - **After-Market (15:40 - 09:00 IST)**: Official NSE closing quote + live GIFT Nifty Session 2 feed.

---

## Pillar 2: Flawless, Zero-Hallucination F&O Mathematical Rigor
1. **Mathematical Pricing & Greeks**:
   - Black-Scholes European pricing equation $C(S, K, T, r, \sigma)$ and $P(S, K, T, r, \sigma)$ with real dividend yield and exact days to expiry.
   - Greeks: $\Delta$ (Delta), $\Gamma$ (Gamma), $\Theta$ (Theta), $\mathcal{V}$ (Vega) derived analytically.
   - Target price payoffs computed via Delta expansion + Gamma acceleration + Vega adjustment minus intraday Theta decay.
2. **Deterministic Risk-to-Reward Ratio (R:R)**:
   - Minimum R:R filter of 1:1.05 strictly enforced. If risk to initial Stop Loss exceeds Target 1 reward, the algorithm MUST downgrade to `WAIT_NEUTRAL` (Capital Preservation).
3. **Multi-Factor Confluence**:
   - Signals require multi-timeframe alignment across 1m, 2m, 5m, 15m, 1hr, and 1day candlesticks, VWAP, 9/21 EMA stack, Volume PCR, OI writing walls, and Net Order Flow Delta.

---

## Pillar 3: Single Source of Truth & Zero Signal Collision
1. **Sole Signal Authority**: `signal.action` (`BUY_CE`, `BUY_PE`, or `WAIT_NEUTRAL`) is the sole decision engine. No secondary component, advance radar, or chart pattern may override a `WAIT_NEUTRAL` capital preservation mandate.
2. **Stand-Aside Primacy**: When the institutional engine determines consolidation, choppy deadband, or unfavorable risk-reward, the application MUST clearly prescribe `STAND ASIDE / CAPITAL PRESERVATION`.

---

## Pillar 4: Minimum 1-to-2 Minute Prediction Lock & Anti-Whipsaw Filter
1. **Anti-Flicker Mandate**:
   - **Traders cannot execute trades if recommendations flip every 5–10 seconds on market noise.**
   - Once a directional prediction (`BUY_CE` or `BUY_PE`) is issued, it enters a **Minimum 60 to 120-Second Institutional Stability Lock**.
2. **Lock Behavior**:
   - The recommendation action, strike, entry zone, Target 1, Target 2, and Stop Loss remain **firmly locked** for the duration of the lock window.
   - Live spot price, contract LTP, live P&L, and Greeks continue streaming every 1 second in real time.
3. **Early Lock Termination Exceptions**:
   - **Hard Stop Loss Breach (`STOP_LOSS_HIT`)**: If market drops to or below the trailing stop loss, the lock is broken immediately to issue an emergency capital exit.
   - **Target Achieved (`TARGET_1_HIT` or `TARGET_2_HIT`)**: Milestone recorded to book profits.
   - **Manual Force Refresh**: User explicit refresh action.
4. **Active UI Indicator**: A dedicated stability badge (`⏱️ 2-Min Institutional Stability Lock · Anti-Whipsaw Active`) MUST be visible to the user showing active seconds remaining.

---

## Pillar 5: Persistent Active Trade Anchoring & Upward-Only Trailing Stop
1. **Fixed Reference Entry**: When an active position is held, `entryPrice`, `entryRange`, `target1`, `target2`, and initial `stopLoss` DO NOT float with the live fluctuating premium.
2. **Monotonic Trailing Stop Loss**:
   - Initial stop loss: Guarded below technical invalidation level.
   - When trade gains +30% toward Target 1 or +5% profit: Trailed to Cost (Break-Even locked at 0% loss risk).
   - When Target 1 is achieved: Trailed to lock 50% of Target 1 gains.
   - **Strict Rule**: Trailing Stop Loss **NEVER moves downward**. It only ratchets up.

---

## Pillar 6: Non-Blocking Sub-Second Streaming & Anti-Freeze Architecture
1. **1-Second Market Polling**: Polling loop runs non-blocking during market hours with a strict 2.2-second network timeout.
2. **Watchdog Lock Auto-Release**: If a network request hangs for >2.5s, the in-flight lock auto-clears. No UI field may freeze or become unresponsive.
3. **Sub-100ms Backend Latency**: Express API proxy routes utilize parallel lookups (TradingView scanner + Yahoo fast chart) with in-memory 800ms cache, delivering 20ms–90ms response times.

---

## Pillar 7: Multi-Viewport Universal Responsiveness
1. **Cross-Device Parity**:
   - **Desktop (>= 1024px)**: Full multi-pane terminal with depth tables, Greek matrices, and advance radar.
   - **Tablet (768px - 1023px)**: Responsive two-column layout with preserved action buttons and badges.
   - **Mobile (< 768px)**: Consolidated top summary strips, horizontal touch-scrolling cards, legible font sizes, no horizontal layout overflow.
2. **Zero Text Clipping**: Numbers, currencies (₹ / $), and badges must never overlap or wrap awkwardly.

---

## Pillar 8: Immutable Real-World Market Audit & Discrepancy Diagnostics
1. **Audit Engine Logging**: Every prediction emitted during the trading day MUST be logged into the Day's Report Audit tab with:
   - Prediction timestamp and duration held.
   - Projected target spot level vs actual subsequent peak spot level.
   - Projected option payoff vs actual peak contract price.
   - Discrepancy % and technical diagnosis (e.g. delta absorption, heavyweight drag, VIX crush).
2. **Transparency**: The trader must always be able to review the audit to inspect where the algorithm was exact, where minor variance occurred, and the mathematical root cause.

---

*Adopted on 12-Oct-2026 as the Permanent Production Standard for OptiPulse.*
