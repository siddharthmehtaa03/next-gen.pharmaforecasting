# LES Model 2.0 context (forecaster flow)

Source: `LES_Context/LES_Model_2_v3_12_14.html`, a self-contained React build of the Nurtec ODT latest-estimate (LES) model. This note covers what the forecaster flow takes from it.

## Cycle cadence
| Cycle | Due | Actual + forecast months |
|---|---|---|
| LE1 | mid-Jan | 0 + 12 |
| LE2 | 5/15 | 2 + 10 |
| LE3 | 8/28 | ~5 + 7 |
| LE4 | 11/3 | ~8 + 4 |
| Op Plan | built alongside the fall cycles | 10-year |

Each submission is locked and versioned. You supersede it only by resubmitting.

## Data feeds (each has a different lag)
- **FINANCE (Blaze):** gross and net sales, GTN %, inventory $ at WAC, withdrawals and the price/pack chain. Actuals arrive first, then the Blaze trend with 80% confidence bands.
- **NPA:** product TRx and NBRx. Runs one month behind the FINANCE close.
- **eLAAD:** acute and preventive market TRx, treated patients, pills per Rx and class shares. Runs about two months behind.
- **PFIZER_INTERNAL:** selling days and population denominators. The model applies the CoE 4-4-5 fiscal calendar.
- **Official references** (an FP&A table): Budget, the prior LE and the GCA View.
- Long term this all comes through a CoE Snowflake access layer: no side-loaded files and no manual pastes.

## Scenarios
- **Trended Statistical:** the machine baseline. It carries no events.
- **Base Case:** the cycle base as filed, with every event at its base probability.
- **Optimistic:** favourable events +30 pts probability, threats −30 pts.
- **Pessimistic:** threats +30 pts probability, favourable events −30 pts.
- **GCA and Finance:** both carry the full register like Base. Events are tagged in or out per scenario.
- Up to 7 custom scenario slots ("Save current settings as scenario").

## Drivers and curves
- Spine: Market NBRx → NBRx share → NBRx→NRx mix → Refill (persistence) → TRx → price per Rx → gross → GTN → net.
- Outputs are derived from the spine and can't be set directly.
- Curve shapes: Fast Uptake, S-Shaped, Linear, Constant Growth, Slow Uptake.
- Input Tool:
  - Start month plus an end value.
  - Short-Term duration (the impact returns to zero) or Long-Term duration (the end value holds).
  - A curve can be attached to an event.

## Events
- **Types and fields:** Market, Product or Pricing; probability Low, Medium or High; phase-in; recurring; tied to at least one metric.
- **Contribution:** "Contribution at current probability" is measured event by event from a no-event baseline.
- **Double-count guard:** an executed action (for example the Jan-26 WAC +3.02%) is already in actuals and trend. It contributes $0 forward, but its embedded full-year value is still reported.
- **Sensing agents:** external (AlphaSense) and internal (M365 SharePoint: operating plan, LE, pricing committee, GSC risk documents). An accepted proposal enters the register switched off.

## Analytics tabs in LES
- Performance Dashboard, Sales Drivers, Patient Funnel
- GTN Analysis: an allowance waterfall (Contract, Medicaid, Coupon, Medicare, Medicare Mfr Discount, Distribution, DoD, Contra, Other). A rationale is required outside the guardrail.
- Financial Bridges: chained substitution across market, share, gross price, GTN, intensity, mix, calendar, inventory and unexplained, plus a Shapley view.
- Needs-to-Meet:
  - NTM = FY LE − YTD actuals.
  - Required rest-of-year growth is compared with YTD growth and two run-rates.
  - Verdicts: On pace, Tracking above LE, Behind — acceleration req'd, Behind — stretch.
- LRP: 10-year net sales.
- Event Landscape: the AlphaSense history.
- Judgment Layer: machine baseline → submitted number, broken into named increments the forecaster can approve or challenge by name.
- Competition: NBRx − TRx share wedge as a ~6-month leading indicator.
- U.E. Analytics: Unexplained Difference = gross − demand − ΔInventory. It's tested against a ±3–5% threshold, with ranked causes and owners (Trade & Distribution, Data Eng/Vendor).

## Charles in LES
- Answers only from live model state, with provenance ("Grounded in", or "Unverified figure").
- Pauses on a framing question before answering: which baseline, gross vs net, forward vs embedded price.
- Voice dictation, and a Q&A library you can export.

## Submission export
Goes to Snowflake as a SQL script or CSV (COPY INTO):
- Target: `COMM_US_SNDBX_DEV_DB.ATP_SCRATCH_SNBX`, prefix `LES_SUBMISSION`.
- Tables: HEADER, ASSUMPTIONS and DATA.

## Where it lands in the prototype
- **Cycles:** the LE cadence strip, and LE4, LE3 and Op Plan rows.
- **Activate and Workspace:**
  - feed freshness and lag per source
  - official references (Budget, prior LE, GCA View) as compare options
  - a Needs-to-Meet tile
- **Drivers:** the LES curve shapes, Short-Term or Long-Term duration, and a spine strip.
- **Events:**
  - the LES scenario probability rules
  - the executed-action double-count guard
  - duration, phase-in and probability band
- **Sensed events:** external and internal agents. Accepted proposals enter the register switched off.
- **Analytics:** tabs for Pressure test, Needs-to-Meet, Judgment layer, GTN, Competition and Data health.
- **Scenarios:** 7 custom slots, a locked submission, Snowflake target settings and a SQL preview.
- **Charles:** grounded answers that state every baseline, plus a Needs-to-Meet answer.
