# UX audit: pharma forecasting edge cases (CoE Configurator)

## Context
The user asked which UX capabilities a pharma forecasting tool needs, and which edge cases appear when you audit the whole tool. The tool covers: the library, a 7-step configurator, versions, the assistant and notifications. This document records what the prototype handles today (`src/App.tsx`), the gaps, and a prioritised build list. Nothing is implemented until approved.

## What's handled today
- **Validation:** inline errors appear only after you try to continue.
- **Navigation:** free movement between steps via the rail.
- **Archetypes:** a beta engine or an under-review archetype is blocked at Valuation tier.
- **Modules:** conflicts are flagged. Rx-Share cannot take patient modules, and missing dependencies are shown.
- **Data:**
  - Feed freshness states: Current, Delayed, Partial, Missing.
  - Failed feeds need a fallback, and the fallback needs a reason.
- **Assumptions:** each open assumption needs an owner, source and confidence.
- **Versions:**
  - Published versions can't be changed.
  - A publish failure leaves the draft saved.
- **Access:** restricted BD (business development) models are locked.

## Edge cases and gaps by area

### 1. Lifecycle and time
- **Loss of exclusivity (LOE) and generic entry dates:**
  - These differ by market and indication.
  - Patent litigation makes the date uncertain, so it needs a scenario range rather than one date.
- **Launch timing:**
  - Pre-launch brands have no actuals.
  - A delayed regulatory approval shifts every curve.
  - The tool needs an "analog-only" mode with no data binding.
- **Label expansion mid-cycle:** adding an indication to a published model should create a new draft version without breaking existing scenarios.
- **Horizon:**
  - LRP runs 10 years or more while OP runs 1–2 years, so the time step should change over the horizon (monthly, then annual).
  - The time step also needs to match fiscal and calendar years.
- **Actuals boundary:**
  - Feeds report actuals through different months.
  - The tool must show where actuals end and the forecast begins, per input.

### 2. Data and provenance
- **Restatements:** a vendor revises history after publish. The tool should alert the user and show a before/after.
- **Licensing:** some vendors (IQVIA, Symphony) have contract limits by user or market. The tool should not offer sources a user isn't licensed for.
- **Units and currency:**
  - Mixed units (TRx vs NRx, doses vs patients, packs vs units).
  - Exchange rate (FX): choose a budget rate or a spot rate.
  - Rounding when values roll up.
- **Manual uploads:**
  - Check the file schema and preview it before accepting.
  - Expire uploads after a set time, and record who uploaded each file.
- **Partial coverage:** the "82% coverage" case needs a projection factor, and the tool should state whether that factor was applied.

### 3. Multi-indication and multi-market
- **Shared patients:**
  - The same patients can appear in two indications (e.g. UC and Crohn's), so the tool needs a de-duplication rule.
  - Price and gross-to-net (G2N) are shared, but volume is not.
- **Market roll-up:** EU5 vs individual countries, regional currency, and per-market variation in G2N and reimbursement timing (HTA delays).
- **Removed indications:** removing an indication with downstream bindings, scenarios or reviewers should show an impact summary.

### 4. Governance and compliance
- **Electronic records:** under 21 CFR Part 11 (US FDA rules on electronic records), and if the client requires it, publishing needs an e-signature with a reason. The tool would also need a tamper-evident audit trail and a rule that the person who configures a model cannot also approve it.
- **Version approvals:**
  - Two-step approval is flagged as a "Pending client decision".
  - The reviewer cannot be the same person as the publisher.
  - Approvals need a delegate when the reviewer is out of office.
- **Deprecated engines:** when an engine version is retired, the tool should list affected models and offer a migration diff.
- **Cycle freeze:** after the OP submission deadline, editing is locked unless an override is granted with a reason.
- **Insider and MNPI data (material non-public information):** restricted models must stay out of search, notifications and assistant answers, not just the table.

### 5. Collaboration and concurrency
- **Simultaneous edits:** two CoE users editing the same draft need a draft lock or presence indicator, plus conflict resolution.
- **Handover:** the draft owner leaves, so ownership must be transferable.
- **Published version in use:** forecasters are mid-scenario when a new version publishes. Their scenarios stay pinned, and they get an optional rebase with a diff.
- **Comments:** threaded comments on an assumption or module, for review conversations.

### 6. Scale and efficiency for the super user
- **Bulk work:**
  - Apply one change across many models, e.g. a new engine version across 40 brands.
  - Clone a configuration to another market.
- **Version diffs:** compare v2.3 with v2.4, covering modules, bands, sources and engine.
- **Keyboard and large models:** keyboard navigation in grids, and large slice combinations (e.g. 5 slices × 8 values = 32k cells) need a performance warning.
- **Templates:** save an archetype, modules and bands as a reusable CoE template.

### 7. Forecast integrity edge cases
- **Assumption bands:**
  - A band that excludes the historical actual.
  - A band at 0% or 100%.
  - Negative growth.
  - Share above 100% once the cascade is nested.
- **Persistency and capture:**
  - The persistency curve must never increase over time.
  - Vaccine capture cannot exceed the coverage ceiling.
- **Data values:** division by zero when a slice value has no patients, and empty slice values.
- **Overrides:** a manual override of a derived output is not allowed. The tool should explain which lever controls that output.

### 8. Accessibility and reliability
- **Offline or session timeout:** autosave conflicts, and re-authentication without losing work.
- **Colour:** status colours are not the only signal (icons already help). Check contrast on the dark rail.
- **Screen readers:** the step rail and tabs need announcements for screen readers.
- **Error copy:** errors should say what happened, why, and what to do next.

## Recommended build (priority order, all in `src/App.tsx`)
1. **Version diff** in `VersionsDrawer`: added and removed modules, band changes, and source changes. This reuses `ModelRow.versions`.
2. **Lifecycle fields in Brand setup:**
   - Launch date and LOE date per indication.
   - A "pre-launch / analog-only" flag that relaxes the Data step's validation in `validate(4)`.
3. **Draft lock and presence:**
   - A "K. Brandt is editing" banner in the context bar, with a "Request control" button.
   - A simulated demo row in the library.
4. **Separation of duties:**
   - The reviewer cannot be the publisher (`ME`). Add this to `validate(LAST)`.
   - E-signature reason field in the publish confirm dialog, with a "Pending client decision" (`OpenQ`) tag.
5. **Integrity checks in `validate(5)` and `warningsFor`:**
   - The base value sits outside the historical range.
   - The share band reaches above 100%.
6. **Cycle freeze state:** an OP deadline banner and a read-only mode with override plus reason.
7. **Impact summary** when removing an indication or switching archetype: counts of bindings, scenarios and forecasters affected.
8. **Restatement notification type** in `notesFor`, with a link to the affected input.

## Fixtures for the edge cases
Seed data to add to `SEED_MODELS`, `ACTIVITY`, `SOURCES` and `freshConfig`, so each edge case can be shown in the prototype. Each fixture lists its setup, the expected UX and where in the code it is driven.

### Library rows (`SEED_MODELS` in `src/App.tsx`)
| ID | Model | Setup | Expected UX |
|---|---|---|---|
| `f1` | **Hympavzi** · Hemophilia · US | Pre-launch (launch Mar 2027), no actuals, `analogOnly: true` | "Pre-launch" badge. The Data step accepts analog sources and needs no Test. Preview shows "No actuals boundary". |
| `f2` | **Xeljanz** · RA · US | LOE Dec 2026, generic entry date uncertain (litigation) | "LOE in 2 months" badge. Brand setup shows the LOE as a range (Dec 2026–Jun 2027) with a "Pending client decision" (OpenQ) tag. |
| `f3` | **Ibrance** · HR+ breast cancer · US | Engine D-04 v1.4, which is retired | "Engine retired" notice and a "Migrate to D-03 v4.1" draft that shows a diff. |
| `f4` | **Abrysvo** · RSV · US, existing row `d` | Draft locked by K. Brandt, last active 3 minutes ago | Opening it shows a read-only banner, "K. Brandt is editing", with a "Request control" button. |
| `f5` | **Comirnaty** · COVID-19 · US | OP 2027 cycle frozen (deadline passed) | Every field is read-only. "Override with reason" opens a dialog and the override is written to the audit trail. |
| `f6` | **Eliquis** · Atrial fibrillation (AF) + venous thromboembolism (VTE) · EU5 | Two indications that share patients | A step 1 warning asks for a de-duplication rule (Overlap %, Exclusive, Ignore). |
| `f7` | **Project Halo**, existing restricted row | Insider-restricted (MNPI) | Hidden from search results, notifications and assistant answers. Only the locked row is shown. |
| `f8` | **Cibinqo** · AD · US, existing row `b` | v2.3 → v2.4 draft with real changes | The Versions drawer diff shows 1 module added, 1 band widened and 1 source changed. |

### Data-test responses (`test()` in `StageData`)
| Source | Simulated result | Covers |
|---|---|---|
| `IQVIA NPA weekly (restated)` | OK, but history from Jan–Mar 2026 has been revised by −4% | A restatement alert with a before/after sparkline and an "Accept restatement" button. |
| `Symphony PatientSource` (existing) | Delayed, 9 days | Freshness warning. |
| `CDC NIS-Teen / Adult` (existing) | Partial, 82% coverage | Coverage warning, plus a "Projection factor applied? Yes/No" question. |
| `Komodo Health` (existing) | Schema error | Fallback, with a reason, is required. |
| `Symphony (unlicensed EU)` | Market is EU5, so the source is disabled | Shown greyed out with "Not licensed for EU5". |
| `Manual upload (.xlsx)` | Wrong columns on the first try | A schema preview lists the mismatched columns. A second try succeeds, and the file gets an "Expires in 30 days" tag. |

### Configuration states (variants of `freshConfig`)
| Seed | Setup | Expected validation |
|---|---|---|
| `seed.integrity` | D-01, peak share band 12–24, 3-level cascade producing 104% share | A `validate(5)` error says the cascade share exceeds 100%. |
| `seed.belowHistory` | D-03, 12-month persistency band 55–70, last actual 48% | A warning says the band excludes the latest actual (48%). |
| `seed.persistencyUp` | Manual persistency upload where the month 7 value is higher than month 6 | An error says persistency must not increase over time. |
| `seed.vaccineCeiling` | D-05, capture band of 9–14%/month that reaches the 72% coverage ceiling by month 6 | A warning says the ceiling is reached early and the remaining stock is depleted. |
| `seed.bigSlices` | 5 slices × 8 values (32,768 combinations) | A step 1 performance warning suggests collapsing slices. |
| `seed.sod` | Reviewer is set to `J. Andersen` (`ME`) | A `validate(LAST)` error says the reviewer can't be the publisher. |
| `seed.emptySlice` | The slice "Payer" contains "Medicaid", which has 0 patients | A warning says the value will forecast zero, with a "Remove value?" option. |
| `seed.fxMix` | Market is EU5 and price is in USD | A prompt to choose between budget FX 2027 and spot FX. |

### Notifications and activity (`notesFor`, `ACTIVITY`)
- "IQVIA restated history for Nurtec ODT. 3 inputs affected." (restatement)
- "Engine D-04 v1.4 retires Nov 30. 2 models affected." (deprecation)
- "OP 2027 freezes in 48 h. 1 draft not yet published." (cycle freeze)
- "Michelle Tran's scenario is pinned to v2.3, and v2.4 is now live." (rebase offer)
- "K. Brandt requested control of the Abrysvo draft." (concurrency)

### Assistant prompts to exercise (`respond` in `Configurator`)
| Prompt | Expected reply type |
|---|---|
| "Change the persistency formula" | Denied. |
| "Why is share over 100%?" | An explanation that points to the cascade levels, with a link to step 3. |
| "What's in Project Halo?" | Denied, because the model is restricted. |
| "Migrate to the certified engine" | A proposal showing the engine diff, with Apply and Undo. |
| "Audit before publish" (with `seed.sod`) | A list that includes the separation-of-duties error. |

### How fixtures load
- Add a dev-only "Edge-case fixtures" toggle to the Help menu (`HelpMenu`) that swaps `SEED_MODELS` for the fixture set.
- Each `f*` row opens `freshConfig({ from: row, fixture: id })`.
- The production seed stays clean.

## Verification
- `npx tsc --noEmit -p .` and `npx vite build`.
- Manually walk through each new state:
  - A pre-launch model publishes without actuals.
  - Setting the reviewer to J. Andersen blocks publish.
  - The diff shows changes between versions.
  - The lock banner appears on the demo row.
  - The freeze makes the model read-only.
