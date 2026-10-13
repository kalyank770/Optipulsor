# Audit Tab Refactoring: Read-Only 1-Week Trade History

Refactor the **Audit Tab** ("Audit & Accuracy") into a clean, strictly read-only historical verification workstation that compares **Suggested Trades vs. Actual Trades** for the last 1 week (grouped by date with the current day expanded on top), while removing all diagnostic triggers, calibration drawers, and manual controls without altering the core prediction engine.

---

## User Review & Confirmed Decisions

> [!IMPORTANT]
> The following decisions were explicitly selected in Turn 1 and govern the refactoring of the Audit tab:

- **Confirmed Decision 1 (Layout & Grouping)**: Clean date-grouped history view with the current trading day ("Today") expanded at the top and prior days collapsed by default.
- **Confirmed Decision 2 (Controls & Interactivity)**: Strictly read-only history table with **no header action buttons** (all buttons like "Trigger Self-Healing Calibration", "Reset Seed Data", manual trade inputs, and filter drawers are removed).
- **Confirmed Decision 3 (Metrics & Table Display)**: Comprehensive trade comparison row showing **Suggested Entry**, **Actual Entry**, **Target / Stop Loss**, **Exit Price**, and **Net Points P&L** (Spot & Option points).

---

## 1. Overview & Core Concept

- **What It Does**: Provides an accurate, non-polluted 1-week historical audit log comparing the prediction engine's suggested trades against real market execution outcomes for NIFTY, BANKNIFTY, and FINNIFTY.
- **Target Audience**: Quantitative traders and institutional users verifying the algorithm's real-world accuracy and P&L performance across the past 5–7 trading sessions.
- **Key Value**: Zero visual clutter, no false entries, and flawless financial tracking with tabular numeral alignment.

---

## 2. User Experience & Visual Design

- **Layout Hierarchy**:
  1. **Daily Summary Ribbon**: Single top row displaying aggregate 1-week metrics (Total Trades, Win Rate %, Net Option Points, Net Spot Points).
  2. **Current Day Group ("Today")**: Positioned at the top with a subtle green border and live indicator, auto-expanded to display today's live/logged trades.
  3. **Historical Date Groups (Past 6 Sessions)**: Collapsible date accordions displaying day-by-day suggested vs. actual trades, win counts, and daily net P&L.
- **Table Column Structure**:
  - **Timestamp & Type**: Execution time (e.g. `09:20 AM`) & Signal Action (`BUY CALL (CE)` / `BUY PUT (PE)`).
  - **Suggested Trade**: Recommended Entry LTP, Target 1 / Target 2, and Stop Loss.
  - **Actual Execution**: Realized Entry LTP, Subsequent Peak/Low LTP, Exit Price.
  - **Outcome**: Target Status badge (`TARGET 2 HIT`, `TARGET 1 HIT`, `STOP LOSS HIT`) & Time to Target.
  - **P&L Performance**: Net Spot Points and Net Option Premium Points (bold green for profit, red for loss).
- **Visual Style**: Clean dark theme with tabular numbers (`tabular-nums font-mono`), WCAG AA contrast, unboxed date metadata, and hairline borders (`border-slate-800`).

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1: Removal of Interactive Diagnostic Controls**:
  - *Chosen Approach*: Remove "Self-Healing Calibration Drawer", "Reset Audit Data" button, "Manual Trade Entry" forms, and multi-select filter bars from `DaysReportTab.tsx`.
  - *Why*: User requested a strictly read-only history table without extra buttons or complex diagnostic overlays.
- **Decision 2: Retention of Underlying Prediction Math & Log Engine**:
  - *Chosen Approach*: Keep `daysReportEngine.ts` and `selfHealingEngine.ts` functions intact in background utilities so prediction models, confidence scoring, and trade history calculation remain 100% operational.
  - *Why*: Ensures removing UI buttons does NOT break or alter any prediction algorithms.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             OptiPulse V10 App                               │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    ▼                                     ▼
      ┌───────────────────────────┐         ┌───────────────────────────┐
      │     Live Option Chain     │         │   HTF Prediction Engine   │
      └─────────────┬─────────────┘         └─────────────┬─────────────┘
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │     daysReportEngine.ts / Logger    │
                    │   (Calculates Suggested vs Actual)  │
                    └──────────────────┬──────────────────┘
                                       │
                                       ▼
                    ┌─────────────────────────────────────┐
                    │     DaysReportTab.tsx (Refactored)  │
                    │  - Read-Only Date Accordion Groups  │
                    │  - Current Day Expanded at Top      │
                    │  - Suggested vs Actual Price Table  │
                    └─────────────────────────────────────┘
```

- **File Modifications**:
  - `src/components/DaysReportTab.tsx`: Refactor layout to render clean date-grouped trade history tables, removing headers, self-healing drawers, filter buttons, and manual forms.
  - `src/utils/daysReportEngine.ts`: Verify that 1-week seed trade records and live trade logs contain accurate spot and option price calculations without false/duplicate entries.

---

## Plan Verification Checklist

- [ ] Remove header action buttons (Self-Healing trigger, Reset button, Manual forms).
- [ ] Group trade history strictly by date (last 7 days).
- [ ] Expand current trading day ("Today") at the top by default; collapse previous days.
- [ ] Display Suggested Entry, Actual Entry, Target/SL, Exit Price, and Net Points P&L in table rows.
- [ ] Preserve underlying prediction algorithms in `daysReportEngine.ts`.
- [ ] Validate compilation (`compile_applet`) and TypeScript linting (`lint_applet`).
