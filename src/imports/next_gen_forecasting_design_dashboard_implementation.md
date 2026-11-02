# Next Gen Forecasting Design Dashboard
## Consolidated Implementation Context and Design Requirements

**Prepared for:** Design, product, engineering and forecasting CoE teams  
**Purpose:** Consolidate the user-flow context, feedback, confirmed requirements, design implications, open decisions and implementation checklist for the next dashboard iteration.

> **Source limitation:** The live session **Next Gen Forecasting - Session - Understanding Archetypes** was not transcribed and had no accessible meeting chat at the time of collation. The items below therefore consolidate the available design-context recordings, solution notes, workflow mock-up, requirements backlog and related project artefacts. Items that still require client validation are explicitly marked.

---

## 1. Core Product Intent

Build one governed forecasting platform that standardises the **process** across brands, markets and forecasting archetypes without forcing every brand into an identical dashboard or KPI structure.

The experience should:

- Replace fragmented Excel and one-off prototype workflows with a single platform.
- Allow a new brand to be onboarded primarily through configuration rather than rebuilding the application.
- Separate model configuration from forecast execution.
- Keep mathematical logic governed and deterministic.
- Allow forecasters to change approved inputs, assumptions, events and scenarios, but not the underlying model logic.
- Support different levels of forecasting complexity, from simple targeted controls to detailed model configuration.
- Provide a consistent look, navigation system and workflow while allowing brand, market and archetype-specific inputs and outputs.
- Make the source, recency, ownership and confidence of assumptions visible.
- Make scenario creation, comparison, approval and auditability first-class capabilities.
- Use AI to explain, assist, configure and run governed what-if requests, not to independently calculate forecast outputs.

---

## 2. Primary Experience Principle

### Standardise the forecasting process, not every screen

The dashboard should have a consistent shell and predictable workflow, but its detailed controls, funnel stages, KPIs, analytics and inputs must adapt based on:

- Persona and permissions
- Brand
- Market or geography
- Forecast cycle
- Selected archetype
- Selected modes
- Attached modules
- Data availability
- Forecasting depth required

The interface should avoid both extremes:

1. **Over-standardisation:** forcing all brands into the same KPIs, funnel or analytical views.
2. **Hyper-customisation:** creating an entirely separate product experience for every brand or team.

The recommended design direction is a **modular, guided and configurable system**.

---

## 3. Personas and Workspace Separation

### 3.1 CoE Configurator / Model Builder

**Context**  
This persona governs the forecasting structure. They configure the brand model and publish a controlled experience for forecasters.

**Needs**

- Set up brand, geography and forecast cycle.
- Add one or more indications.
- Select the appropriate archetype for each indication.
- Select engine modes and attach modules.
- Bind model inputs to approved data sources.
- Define which assumptions are system-bound versus editable by forecasters.
- Define funnel structure and calculation stages.
- Review the model flow before publishing.
- Publish an immutable model version.
- Assign the model to forecasters.
- View version history and audit trail.
- See who created, changed, published or submitted a forecast and when.
- Configure different levels of depth based on the brand or use case.

**Design implication**  
The builder requires a guided configuration workflow with clear hierarchy. It should not feel like a generic dashboard. It should feel like a structured model-building environment.

### 3.2 Brand Forecaster / Scenario Creator

**Context**  
This persona uses a published model to create, adjust, analyse and submit forecasts. They should not manipulate the governed model structure.

**Needs**

- Select an assigned brand, market and forecast cycle.
- Understand the active archetype and model version.
- Review current assumptions and data freshness.
- Edit open assumptions, share curves, events, funnel rates, duration of treatment and approved dials.
- Use simple or advanced input depth where permitted.
- Ingest or refresh actuals.
- Override missing or inappropriate values with justification.
- Create and compare scenarios.
- Run goal seek, need-to-meet and sensitivity analysis.
- See how assumptions affect patient, volume, revenue and other relevant outputs.
- Validate required fields and model gates.
- Submit a forecast for review or approval.
- Compare the current cycle with previous or approved cycles.
- Add comments and preserve the reasoning behind changes.

**Design implication**  
The forecaster workspace should present a focused left-to-right or top-to-bottom journey. The governed model should be visible enough to create trust, but its structure should not be editable.

### 3.3 Viewer / Executive / Finance Consumer

**Context**  
This persona consumes approved outputs and portfolio views rather than creating the forecast.

**Needs**

- View approved forecasts only.
- See portfolio, brand, region and scenario summaries.
- Compare target, budget, forecast and actuals where relevant.
- Understand major drivers, variances and risks.
- Drill from enterprise or portfolio summaries into a brand detail view.
- Review assumption lineage and the basis of a submitted number.
- View reconciliation flags and unexplained differences.

**Design implication**  
The executive view should prioritise concise summaries, exceptions, comparisons and drill-down paths. It should not expose builder controls.

### 3.4 BD / Pipeline Forecaster

**Context**  
This persona may use similar forecasting capabilities but operates within a restricted partition.

**Needs**

- Separate and protected access.
- Persona-specific records and outputs.
- Similar dials, scenarios and builder capabilities where authorised.
- No leakage of restricted information into general views or AI responses.

**Design implication**  
Treat access restrictions as a structural product requirement, not only a filter.

### 3.5 Platform Administrator

**Needs**

- Manage users, roles and permissions.
- Manage reference data and environments.
- Support enterprise authentication and operational controls.

---

## 4. Recommended End-to-End User Flow

### Stage A: Entry and workspace selection

1. Authenticate through enterprise SSO.
2. Detect user role or roles.
3. If the user has multiple roles, ask them to select a workspace.
4. Allow role switching without signing out.
5. Show only authorised brands, markets and records.

### Stage B: CoE configuration flow

1. **Brand setup**
   - Brand
   - Geography or market
   - Forecast cycle
   - Indication or indications
   - Rigor or governance tier, if applicable

2. **Choose model structure**
   - Select archetype per indication
   - Select engine version
   - Select applicable modes
   - Display archetype grade or ceiling where relevant

3. **Configure buckets and modules**
   - Organise modules into calculation stages or buckets
   - Mark modules as core, recommended or governed
   - Support reusable shared modules
   - Prevent invalid combinations

4. **Bind data and assumptions**
   - Bind approved inputs to registered sources
   - Identify open assumptions owned by the forecaster
   - Require source, confidence and owner metadata
   - Define fallback and override behaviour where data is missing

5. **Review model flow**
   - Visualise the calculation sequence
   - Preview forecaster inputs and outputs
   - Surface missing configuration, broken dependencies or invalid mappings

6. **Publish and assign**
   - Publish an immutable version
   - Assign authorised forecasters
   - Record publisher, date and version
   - Make prior versions available for audit, not editing

### Stage C: Forecaster flow

1. Select an assigned brand, market and cycle.
2. Review model summary, active version, data freshness and current status.
3. Review or edit open assumptions.
4. Add market events and supporting context.
5. Refresh or ingest actuals.
6. Manage missing-data overrides with reasons.
7. Run the forecast through the governed engine.
8. Review relevant outputs and analytical views.
9. Create Base, Upside, Downside or custom scenarios.
10. Compare scenarios and previous cycles.
11. Run sensitivity, goal seek and need-to-meet analysis.
12. Complete validation gates.
13. Add supporting comments and documentation.
14. Submit for approval or publish through the defined governance flow.

### Stage D: Review and consumption

1. Reviewer receives the submitted forecast.
2. Reviewer checks assumptions, lineage, scenario basis and validation results.
3. Reviewer approves, returns or requests clarification.
4. Approved forecast becomes available in executive and portfolio views.
5. Downstream submission status is visible where applicable.

---

## 5. Dashboard Information Architecture

### 5.1 Global application shell

Include:

- Workspace or role switcher
- Brand selector
- Geography or market selector
- Forecast-cycle selector
- Indication selector where relevant
- Active model version
- Forecast status
- Data freshness indicator
- Notifications or validation alerts
- AI assistant access
- Help and documentation
- User profile and access context

### 5.2 Recommended primary navigation

#### For CoE Configurator

- Home / Model Library
- Brand Setup
- Archetypes
- Buckets and Modules
- Data Bindings
- Assumptions and Governance
- Model Flow / Preview
- Publish and Assign
- Versions and Audit

#### For Brand Forecaster

- Home / My Forecasts
- Inputs and Assumptions
- Events
- Actuals
- Forecast Output
- Scenarios
- Analyse
- Compare
- Validate and Submit
- Comments / Evidence

#### For Viewer / Executive

- Portfolio Overview
- Brand Performance
- Forecast vs Target / Budget
- Scenarios and Risks
- Drivers and Variances
- Approved Forecast Detail
- Assumptions and Lineage

---

## 6. Detailed Screen and Component Requirements

### 6.1 Home page / Forecast landing page

**Context**  
Different markets work on different forecast cycles. Users need an immediate view of what requires attention.

**Implement**

- Assigned brand cards with market, cycle, indication, archetype and model version.
- Status labels such as Draft, In progress, Submitted, Returned, Approved and Published.
- Last updated date and user.
- Data freshness state.
- Open issues or validation count.
- Continue forecast action.
- Create scenario or begin forecast action where authorised.
- Locked cards for visible but unauthorised brands, with a clear access explanation.
- Recent work and recent submissions.
- Cycle-to-cycle change summary.

### 6.2 Brand setup

**Implement**

- Brand and geography selection.
- Forecast-cycle definition.
- Indication management.
- Assignment of archetype by indication.
- Shared brand-level layers such as pricing or GTN where applicable.
- Clear separation between brand-level, indication-level and scenario-level configuration.
- Save draft, validate and continue states.

### 6.3 Archetype selection

**Implement**

- Archetype cards with:
  - Name
  - Business question answered
  - Suitable use cases
  - Expected inputs
  - Typical outputs
  - Available modes
  - Grade or limitation
  - Recommended modules
- Side-by-side comparison where selection is unclear.
- Explanation of how the archetype changes the subsequent flow.
- Prevent unsupported combinations.
- Show certification or governed status.

**Important**  
The six archetypes are not simply visual templates. They represent governed math bases. The UI must not reduce them to cosmetic dashboard choices.

### 6.4 Mode and module configuration

**Implement**

- Group modules into calculation buckets or stages.
- Allow adding, removing and reordering only where governance permits.
- Show Core, Recommended and Governed labels.
- Display dependency warnings.
- Provide a clear default configuration by archetype.
- Support progressive disclosure so new users are not overwhelmed.
- Preserve advanced controls for power users.
- Provide a model-map preview.

### 6.5 Inputs and assumptions

**Implement**

- Distinguish clearly between:
  - Bound data from approved systems
  - Derived outputs
  - Open assumptions editable by the forecaster
  - CoE-locked values
- Require owner, source and confidence for editable assumptions.
- Show units, time grain and valid range.
- Allow annual, quarterly or monthly depth where supported.
- Support comments and evidence.
- Show prior-cycle values for comparison.
- Show change history.
- Make it obvious when an assumption affects multiple scenarios.
- Prevent direct typing into derived output fields.

### 6.6 Data freshness and diagnostics

**Context**  
A repeated pain point is uncertainty about whether displayed data is the latest available.

**Implement**

- Last refreshed timestamp.
- Source system name.
- Actuals boundary month.
- Status: current, delayed, partial or missing.
- Data coverage indicator.
- Diagnostic details for failed or partial refreshes.
- Manual override or upload option where authorised.
- Override reason and evidence.
- Warning when a scenario is using stale data.
- Re-anchor behaviour shown after actuals are refreshed.

### 6.7 Event management

**Implement**

- Add market, competitor, access, launch or operational events.
- Capture event name, time period, impact assumption, source, owner and confidence.
- Show events on relevant charts or time series.
- Allow event inclusion or exclusion by scenario.
- Preserve event history.
- Surface events through the AI assistant and scenario comparison.

### 6.8 Scenario management

**Implement**

- Base, Upside and Downside as supported starting patterns, not a hard limit.
- Create a scenario by inheriting from the active scenario.
- Rename, duplicate, archive and compare scenarios.
- Show changed assumptions relative to Base.
- Show impact on key outputs.
- Pin the scenario to a model version and data snapshot.
- Prevent silent changes when the underlying model is updated.
- Provide side-by-side and delta views.
- Enable comments and rationale.

### 6.9 Forecast output and analytics

Do not apply one universal KPI set to every brand. Use a modular analytics framework that renders only relevant views.

Potential views include:

- Patient funnel
- Patient trend
- New patient starts
- Market share and TRx / NRx trends
- Sales and revenue forecast
- Forecast vs budget or target
- Net sales and gross-to-net analysis
- Financial bridge / revenue bridge
- Monthly variance
- Base, Upside and Downside comparison
- Driver contribution
- Sensitivity analysis
- Need-to-meet
- Goal seek
- Reconciliation flags
- Unexplained differences
- Demand versus withdrawals
- Scenario distribution where supported

Each view should show:

- Active scenario
- Active brand, market, cycle and indication
- Time horizon
- Data source and freshness
- Model version
- Ability to drill into assumptions or drivers
- Export or share action where permitted

### 6.10 Comparison experience

**Implement**

- Current versus previous cycle.
- Scenario versus scenario.
- Forecast versus actuals.
- Forecast versus target or budget.
- Submitted versus approved.
- Assumption comparison.
- Revenue or outcome bridge explaining the delta.
- Filtered drill-down from summary to driver.

### 6.11 Validation and submission

**Implement**

- Pre-submit checklist.
- Required-field validation.
- Source, confidence and owner completeness.
- Data freshness warning.
- Model-grade restrictions.
- Reconciliation and parity checks.
- Assumption documentation check.
- Submission summary.
- Reviewer notes and return reasons.
- Submission history and status.
- Immutable submitted record.

### 6.12 Portfolio and executive views

**Implement**

- Portfolio summary across approved forecasts.
- Brand and geography filters.
- Forecast status and model version.
- Forecast, target, budget and actual comparisons where supported.
- Key variance and risk indicators.
- Scenario exposure.
- Drill-down to brand detail.
- Published assumption lineage.
- Clear indication that only approved or published data is shown.

### 6.13 Knowledge and collaboration layer

**Implement**

- Comments attached to forecasts, scenarios or assumptions.
- Decision history.
- Evidence or source attachments.
- Insight board or saved learning items.
- Previous-cycle rationale.
- Review conversation preserved with the forecast record.
- Ability to share an approved view with authorised colleagues.

---

## 7. AI Assistant Requirements

### 7.1 Role of AI

AI should assist users while remaining bounded by the governed forecasting engine.

**AI may:**

- Explain a forecast, assumption or variance.
- Answer questions in business language.
- Recommend where to look.
- Propose a scenario or assumption change.
- Translate a natural-language request into governed input changes.
- Run a what-if through the deterministic engine.
- Summarise differences between scenarios or cycles.
- Surface missing documentation before submission.
- Help configure a model, subject to review and approval.

**AI must not:**

- Invent or directly calculate final forecast values outside the governed engine.
- Modify locked model logic silently.
- submit or publish without an explicit user action.
- expose restricted records across role or BD boundaries.
- present an unsupported assumption as fact.

### 7.2 Chat interaction patterns to design

The prototype should include at least these patterns:

1. **Question and answer**
   - Text explanation
   - Linked source or assumption
   - Optional chart or compact visual

2. **Explain variance**
   - Summary of the change
   - Ranked drivers
   - Link to detailed analysis

3. **Create or modify scenario**
   - AI interprets the request
   - Shows proposed changes
   - User reviews and confirms
   - Engine runs the scenario
   - Results are displayed with deltas

4. **Model or data diagnostic**
   - Identifies missing, stale or conflicting inputs
   - Suggests the next action

5. **Pre-submit audit**
   - Lists incomplete assumptions, missing sources or validation failures
   - Links directly to issues

### 7.3 Chat UI components

- Suggested prompt chips relevant to the current workspace.
- Free-text input.
- Context indicator showing active brand, cycle, indication and scenario.
- Response types for text, charts, tables, links to dashboard sections and proposed actions.
- Confirmation step before changing assumptions or scenarios.
- Undo or revert after AI-assisted changes.
- Clear distinction between an explanation and an executed change.
- Citation or source treatment for evidence-backed responses.
- Error, unsupported request and permission-denied states.
- Persistent session linked to the relevant forecast record where governance requires it.

---

## 8. UX and Visual Design Requirements

### 8.1 Interaction principles

- Guided left-to-right or top-to-bottom progression.
- Progressive disclosure for advanced configuration.
- Clear distinction between editable, read-only, derived and locked fields.
- Persistent context for brand, market, cycle, model version and scenario.
- Consistent terminology across all workspaces.
- Strong empty states and first-time guidance.
- Minimise clicks for common forecaster tasks.
- Keep advanced capabilities available without overwhelming occasional users.
- Use warnings selectively for governance-impacting actions.
- Make the consequences of a change visible before it is committed.

### 8.2 Accessibility

- Do not rely on colour alone.
- Provide colour-blind-safe data visualisations.
- Maintain accessible contrast.
- Support keyboard navigation.
- Use descriptive labels and statuses.
- Ensure charts have supporting text or tabular alternatives.
- Maintain readable density for complex modelling screens.

### 8.3 Design system direction

- Confirm whether Pfizer has an approved design system and component library.
- Reuse approved React/Figma components where available.
- If no suitable system exists, define a compact product-specific component set.
- Ensure the Figma components map to implementable React patterns.
- Include states for default, hover, focus, disabled, error, warning, loading, locked and success.

---

## 9. Governance and Audit Requirements

Implement:

- Model versioning.
- Immutable published configurations.
- Immutable submitted forecast records.
- Input and output lineage.
- User, timestamp and action history.
- Approval states and reviewer comments.
- Scenario-to-model-version linkage.
- Data snapshot linkage.
- Assumption source, confidence and ownership.
- Role-based access.
- Restricted BD partition.
- Clear separation of model configuration and scenario adjustment.
- Reproducible forecast runs.

---

## 10. Prototype Scope Recommendation

### Must demonstrate end to end

1. Role-aware entry.
2. CoE Configurator journey:
   - Brand setup
   - Archetype selection
   - Mode and module configuration
   - Data / assumption binding
   - Preview
   - Publish and assign
3. Brand Forecaster journey:
   - Assigned-brand landing
   - Inputs and assumptions
   - Data freshness
   - Scenario creation
   - Forecast output
   - Comparison
   - Validation and submission
4. Executive / Viewer journey:
   - Portfolio overview
   - Brand drill-down
5. AI assistant:
   - Ask a question
   - Explain a variance
   - Propose and confirm a scenario change
6. Governed states:
   - Locked fields
   - Missing-data state
   - Validation failure
   - Approval state
   - Version history

### Can be represented with realistic static or simulated behaviour

- Actual engine calculations.
- Live Snowflake or downstream integrations.
- Complete approval orchestration.
- Full AI reasoning.
- Every archetype and module.
- Every country-specific flow.

### Prototype quality bar

- High-fidelity and clickable.
- One unified client-facing link.
- Backed by a maintained Figma source file.
- Consistent component behaviour.
- Clearly labelled simulated data.
- Built around one representative end-to-end brand journey, with visible evidence that the system adapts to another archetype or complexity level.

---

## 11. Priority Implementation Checklist

### P0: Flow and structure

- [ ] Confirm workspace and persona model.
- [ ] Lock the Configurator and Forecaster journeys.
- [ ] Define common application shell.
- [ ] Define global context selectors.
- [ ] Define brand model, indication, archetype, mode and module hierarchy.
- [ ] Establish model publish and forecaster assignment flow.
- [ ] Establish scenario and submission flow.

### P0: Governance

- [ ] Show locked versus editable inputs.
- [ ] Require owner, source and confidence on assumptions.
- [ ] Show active model version.
- [ ] Introduce validation gates.
- [ ] Capture comments and audit history.
- [ ] Define restricted BD experience.

### P0: Forecaster usefulness

- [ ] Implement data freshness and diagnostics.
- [ ] Implement cycle-to-cycle comparison.
- [ ] Implement scenario comparison.
- [ ] Implement core analytics modules.
- [ ] Implement goal seek, need-to-meet and sensitivity entry points.
- [ ] Implement submit and review states.

### P1: Builder depth

- [ ] Add bucket and module configuration.
- [ ] Add model-flow preview.
- [ ] Add invalid-combination and dependency states.
- [ ] Add simple versus advanced configuration depth.
- [ ] Add reusable shared modules.

### P1: AI experience

- [ ] Add contextual prompt suggestions.
- [ ] Add explanation response.
- [ ] Add chart or visual response.
- [ ] Add proposed action with confirmation.
- [ ] Add pre-submit audit response.
- [ ] Add AI error and permission states.

### P1: Executive views

- [ ] Add portfolio summary.
- [ ] Add approved brand drill-down.
- [ ] Add variance and driver summaries.
- [ ] Add assumption lineage view.

### P2: Extended capability

- [ ] International low-data and manual-override flow.
- [ ] Additional archetype-specific analytics.
- [ ] Cross-brand or cross-market comparison, only if validated.
- [ ] Knowledge repository and saved insights.
- [ ] Advanced collaboration and sharing.

---

## 12. Open Decisions Requiring Client Validation

1. Which archetypes and brands are included in the first prototype or Wave 1?
2. Is the prototype anchored first on the Configurator journey, the Forecaster journey or both equally?
3. What is the definitive list of modes, buckets and modules for each archetype?
4. Which inputs are bound, open, derived or CoE-locked?
5. What is the approval path for a new archetype or major model change?
6. What is the approval path for a submitted forecast?
7. Which analytical views are common enough to be core modules?
8. Which views are archetype-specific or brand-specific?
9. What are the required default scenarios?
10. Who may create custom scenarios?
11. What level of monthly, quarterly or annual input depth is required?
12. How should low-data international markets populate or override missing inputs?
13. Is cross-market comparison required for forecasters, viewers or neither?
14. What is the exact role of Finance in authoring, reviewing and consuming forecasts?
15. Which downstream systems receive approved forecasts?
16. What should the AI assistant be able to change directly, and what always requires confirmation?
17. Should AI conversations be stored with a forecast record?
18. What data citations and evidence are required in AI responses?
19. What Pfizer design system or approved component library must be used?
20. What accessibility and localisation standards are mandatory?
21. Which prototype interactions must be functional versus simulated?
22. Which actions need export, download or sharing?
23. What is the expected behaviour when a published model is replaced by a new version while scenarios are in progress?
24. What exception workflows are needed for stale, partial or missing actuals?
25. What is the minimum set of information leadership needs on the portfolio landing view?

---

## 13. Acceptance Criteria for the Next Design Iteration

The next design iteration is ready for review when:

- The Configurator and Forecaster journeys are visually distinct but part of one product.
- Users can understand where they are by brand, market, cycle, indication, model version and scenario.
- The difference between model configuration and forecast input adjustment is unmistakable.
- The archetype selection clearly changes the subsequent configuration and analytics.
- The interface supports both simple and detailed forecasting use cases.
- Data freshness and missing-data states are represented.
- At least one full scenario can be created, compared, validated and submitted.
- The AI assistant demonstrates explanation and governed action patterns.
- Executive users can navigate from portfolio summary to an approved forecast detail.
- Locked, derived, editable and restricted states are represented.
- Audit, version and approval information is visible.
- The design clearly identifies open decisions rather than silently inventing behaviour.

---

## 14. Source Artefacts Consulted

- Next Gen Forecasting meeting record and related email thread
- `forecast_platform_workflow_mockup.html`
- `Forecasting CoE Platform — Requirements & Jira Backlog v1.0.docx`
- `PFIZER FORECASTING SOLUTION NOTES.docx`
- `Next Gen Forecasting CoE_Discovery Session Questions.docx`
- `Pfizer Forecasting - Design Context` recording
- `Pfizer Forecasting - Design Scope` recording
- `Daily Standup - Forecasting COE` recordings
- `Clairos Walkthrough` recording
- Existing Next Gen Forecasting prototype and kickoff materials

