# Pharma Forecasting Archetypes
## Documented Context, Design Notes and Impact on the CoE Flow

**Purpose**  
This document consolidates the available project context on forecasting archetypes and translates it into design guidance for a pharma forecasting platform. It is intended to help the design team build a tool that is relevant to CoE Configurators, brand forecasters, finance or leadership viewers, and restricted BD or pipeline users.

## Source limitation

The meeting titled **Next Gen Forecasting - Session - Understanding Archetypes** is present in the calendar, but its transcript and meeting chat were not available when this document was prepared. The notes below therefore use the available requirements backlog, design-context recording, solution notes and related forecasting artefacts. Where the artefacts do not define the detailed pharma mathematics, this document labels the point as a **design interpretation** or **validation question** rather than treating it as confirmed.

---

# 1. Executive Summary

An archetype is not merely a dashboard layout. In this programme, an archetype is the governed starting structure for a forecasting engine. It determines the model family used for an indication, exposes the relevant mode choices, starts the CoE with a defined group of modules, and affects the inputs, calculations, outputs and analytical views subsequently shown to forecasters.

The confirmed archetype catalogue contains six engine families:

1. Patient-Flow
2. Prevalent-Share
3. Rx-Share
4. Market Stock-Flow
5. Trend / Extrapolation
6. Peak-Year Sizing

The intended operating model is:

1. The **CoE Configurator** sets up the brand and its indications.
2. The CoE selects an archetype for each indication.
3. The selected archetype provides a governed engine structure, supported modes and default modules.
4. The CoE adjusts the permitted configuration, binds data and reviews the assembled model.
5. The CoE publishes an immutable model version and assigns it to forecasters.
6. The **Brand Forecaster** works with approved assumptions, events, scenarios and actuals without changing the underlying model logic.
7. Approved outputs roll up for portfolio, finance and leadership consumption.

The core design opportunity is therefore to standardise **how a model is assembled, reviewed, governed and handed off**, while allowing each archetype to render the domain-specific inputs and outputs required for that forecast.

---

# 2. Why Archetypes Exist in This Platform

## 2.1 The underlying problem

The current context describes multiple teams creating forecasts through Excel, existing internal tools and one-off Claude-generated HTML artefacts. Different teams use different flows, inputs, KPIs and levels of detail. The desired platform cannot simply combine those screens into one large dashboard because the differences are tied to the forecasting model, market, brand and available data.

## 2.2 Role of the archetype

The archetype provides a controlled starting point between two undesirable extremes:

- **One rigid universal model**, which would not support different pharma forecasting questions.
- **A fully custom model for every brand**, which would recreate fragmentation and increase governance effort.

The archetype allows the platform to offer a repeatable model family with controlled configuration.

## 2.3 What an archetype governs

Based on the requirements, the archetype affects:

- The certified engine used for an indication.
- The engine version recorded in the model configuration.
- The available mode choices.
- The default Core, Recommended and Governed modules.
- The model's permitted grade or usage level.
- The assembled configuration views.
- The inputs exposed to the forecaster.
- The outputs and analytics relevant to that model.

## 2.4 What an archetype does not replace

An archetype does not replace:

- Brand setup.
- Geography and planning-cycle setup.
- Indication setup.
- Shared brand layers such as GTN, conversion, reconciliation and submission.
- Scenario configuration.
- Actuals ingestion and calibration.
- Governance, validation and approval.
- Brand-specific data and assumption choices.

---

# 3. Key Concepts and Their Relationship

## Brand model

A versioned configuration that contains the brand, geography, planning cycle, indications, shared layers, data sources and governance rules.

## Indication instance

A brand may contain one or more indications. Each indication has its own archetype, modes, attached modules and review state.

## Archetype

The governed model or engine family selected for an indication.

## Mode

A controlled variant within an archetype. Changing a mode changes engine behaviour within the same archetype; it does not turn it into another archetype.

## Module

A reusable block within the calculation chain. Modules are grouped into six buckets and may be marked Core, Recommended, Governed or Mode-controlled.

## Bucket

One stage of the common setup chain:

1. Population and eligibility
2. Share and competition
3. Engine core
4. Actuals and calibration
5. Conversion and finance
6. Outputs, scenarios and submission

## Shared brand layer

A configuration applied across indications, including one governed GTN truth, conversion, reconciliation and submission.

## Published model version

The immutable handoff from the CoE Configurator to the Brand Forecaster.

---

# 4. The Six Forecasting Archetypes

## 4.1 Patient-Flow

### Confirmed context

**Primary audience:** Brand forecasters in oncology and specialty use cases.

**Available mode groups:**

- Persistence specification: Cohort KM, Forward DoT, Aggregate churn
- Line-of-therapy sourcing: Independent pools, Progression-derived, Named feeders
- Retreatment: Excluded, Allowed, Typed re-entry
- Actuals regime: Claims, Aggregate, Pre-launch
- Time basis: Monthly, Annual

### What forecasting question it supports

**Design interpretation:** Patient-Flow is appropriate when the forecast needs to represent how eligible patients move through defined stages, enter treatment, remain on therapy, discontinue, progress or re-enter.

### Likely flow impact

- Requires a visible population and eligibility funnel.
- Requires stage-level rates and counts.
- Requires treatment duration or persistence treatment.
- May require line-of-therapy and retreatment controls.
- Needs a clear actuals-to-forecast boundary.
- Outputs are likely to include patient counts, new starts, patients on treatment and downstream volume or revenue views where configured.

### CoE configuration focus

- Define the funnel stages and order.
- Define which stages are sourced, calculated or editable.
- Select the persistence and treatment modes.
- Set region eligibility and data regimes.
- Establish ownership, source and confidence for assumption slots.
- Ensure the forecaster sees approved levers but cannot change the underlying patient-state structure.

### Forecaster experience

- Review funnel values.
- Adjust permitted rates, events or assumptions.
- Run scenarios.
- View patient impact and connected financial outputs.
- Compare the present cycle with a prior or approved cycle.

### Design risks

- Presenting a generic funnel that cannot adapt to different indications.
- Allowing a forecaster to alter governed calculation stages.
- Hiding persistence or retreatment assumptions.
- Showing revenue without traceability back to patient drivers.

---

## 4.2 Prevalent-Share

### Confirmed context

**Primary audience:** Brand forecasters using patient-share forecasting.

**Available mode groups:**

- Share specification: Curve-generated, Typed, Calibrated, Theft-derived
- Nesting depth: Class to brand, Flat, Three-level
- Unit: Patients, Days of therapy

### What forecasting question it supports

**Design interpretation:** Prevalent-Share applies when a known or estimated prevalent pool is allocated across choices, classes or brands through share assumptions.

### Likely flow impact

- Starts from a defined prevalent or eligible pool.
- Requires share curves or entered share assumptions.
- May require nested allocation across class and brand levels.
- Needs controls for whether the working unit is patients or days of therapy.
- Should expose share totals and allocation integrity.

### CoE configuration focus

- Define the pool and its source.
- Choose the share-generation approach.
- Define hierarchy or nesting depth.
- Define whether the forecaster edits shares directly or edits the drivers of a curve.
- Establish calibration behaviour where actuals are present.

### Forecaster experience

- Work with approved share levers.
- Compare share paths between scenarios.
- Understand the effect of competitor or market events.
- View the translation from share to patient, volume and financial outputs where configured.

### Design risks

- Treating all shares as flat when some models are hierarchical.
- Allowing shares to exceed logical totals without validation.
- Mixing patients and days-of-therapy without prominent unit labelling.
- Making calibration behaviour invisible.

---

## 4.3 Rx-Share

### Confirmed context

**Primary audience:** Finance users where an Rx-based historical or alliance convention is used.

**Available mode groups:**

- Share path: Curve-family menu, Event-anchored, Calibrated
- Rx basis: TRx, NBRx or NRx with mix and refill
- Market trend: Method-driven, Event-driven

### What forecasting question it supports

**Design interpretation:** Rx-Share is appropriate when prescription activity and share are the principal basis for projecting market and brand performance.

### Likely flow impact

- Requires a market prescription trend.
- Requires brand share or share-path controls.
- Requires explicit selection and labelling of the Rx basis.
- May need refill and new-to-brand mix assumptions.
- Requires event overlays or calibrated curves where selected.

### CoE configuration focus

- Select the Rx basis and trend method.
- Define share-path controls.
- Configure which events can affect the trend.
- Define the relationship between prescription metrics and volume or financial conversion.

### Forecaster experience

- Adjust allowed prescription-share or event assumptions.
- Compare market and brand paths by scenario.
- See the difference between TRx, NRx and NBRx-related measures.
- Trace financial outputs back to prescription drivers.

### Design risks

- Using Rx terminology interchangeably.
- Showing a share chart without its denominator or basis.
- Mixing market trend and brand share into one unexplained control.
- Hiding the difference between historical calibration and forward assumptions.

---

## 4.4 Market Stock-Flow

### Confirmed context

**Primary audience:** Vaccine forecasters.

**Available mode groups:**

- Conservation: Depletion for US backlog, Cohort-throughput for international, Seasonal dose-basket
- Inflow rule: Target-seeking, Rate-based
- Re-entry: None, Waning, Booster chain
- Catch-up: On, Off

### What forecasting question it supports

**Design interpretation:** Market Stock-Flow supports forecasts in which a population moves into, through and out of a stock or cohort, including depletion, replenishment, waning, boosters, seasonal demand or catch-up effects.

### Likely flow impact

- Requires explicit representation of starting stock, inflow and outflow.
- May require cohort or time-linked state tracking.
- Requires re-entry, waning or booster logic where selected.
- Requires catch-up and seasonality controls when applicable.
- May differ materially between US and international configurations.

### CoE configuration focus

- Select the conservation logic.
- Define the inflow rule.
- Configure re-entry and catch-up policy.
- Define time granularity and seasonality representations.
- Ensure the model clearly distinguishes observed stock, projected flow and administered or converted output.

### Forecaster experience

- Review cohort or stock movement over time.
- Adjust allowed rates, timing or events.
- Evaluate catch-up, booster and seasonal scenarios.
- Understand constraints and conservation checks.

### Design risks

- Using a patient funnel visual when a state-over-time or stock-and-flow representation is needed.
- Hiding conservation rules.
- Treating re-entry as a simple one-time percentage.
- Combining US depletion and international throughput into one unexplained template.

---

## 4.5 Trend / Extrapolation

### Confirmed context

**Primary audience:** Data science and other teams using the capability as a component.

**Available mode groups:**

- Method: Exponential smoothing, Moving average, Regression, Event-anchored
- Role: Actuals projection, Blend, Standalone sub-segment
- Granularity: Monthly, Weekly, Annual

### What forecasting question it supports

**Design interpretation:** Trend / Extrapolation projects an observed historical series forward, either as the main forecast for a segment or as a component blended into another archetype.

### Likely flow impact

- Begins with a historical time series and data-quality view.
- Requires method selection and parameter configuration.
- Requires event or structural-break treatment where selected.
- May operate as a supporting module rather than the complete brand model.
- Needs forecast intervals or diagnostic information if required by the approved methodology.

### CoE configuration focus

- Select the projection method and role.
- Define the series and granularity.
- Define preprocessing and event treatment.
- Specify whether the output is standalone or consumed by another model.
- Establish calibration and handoff rules.

### Forecaster experience

- Review historical continuity and data freshness.
- Adjust permitted events or selected assumptions.
- Compare alternative permitted methods or scenarios where the governance model allows it.
- Understand where the trend output feeds the broader forecast.

### Design risks

- Presenting a trend line without the method, data window or granularity.
- Allowing arbitrary method switching after publication.
- Treating a component forecast as the total brand forecast.
- Hiding how an event adjustment changes the extrapolation.

---

## 4.6 Peak-Year Sizing

### Confirmed context

**Primary audience:** Business Assessment and BD&L.

**Available mode groups:**

- Parameter sourcing: Analog-anchored, Trial-endpoint, Research
- Regional method: US multiplied by an analogue factor, Bottom-up
- Scenario: Target product profile variants

**Confirmed governance constraint:** Peak-Year Sizing is screening grade. It cannot be converted into valuation grade through forecaster editing. Re-grading requires CoE reconfiguration and a new model version.

### What forecasting question it supports

**Design interpretation:** Peak-Year Sizing supports early or screening-level estimation of potential peak opportunity based on assumptions, analogues, evidence and target product profile variants.

### Likely flow impact

- Requires clear evidence and source treatment for each critical assumption.
- Requires confidence grading.
- Requires scenario comparison across target product profile variants.
- Requires prominent screening-grade labelling.
- Should avoid presenting outputs as valuation-grade certainty.

### CoE configuration focus

- Select the parameter-sourcing approach.
- Define the regional sizing method.
- Establish required evidence and confidence.
- Configure target product profile scenarios.
- Preserve the grade ceiling in all output and export states.

### Forecaster or analyst experience

- Review and adjust permitted screening assumptions.
- Compare target product profile variants.
- Understand sensitivity and evidence confidence.
- Produce outputs that remain visibly labelled as screening grade.

### Design risks

- Removing or minimising the screening-grade label.
- Presenting a single point estimate without uncertainty or assumption context.
- Allowing ordinary edits to imply that the model has become valuation grade.
- Exposing restricted BD information outside its authorised partition.

---

# 5. How Archetypes Change the End-to-End Flow

## 5.1 Flow before archetype selection

The common flow is stable:

1. Select or create a brand model.
2. Select geography and planning cycle.
3. Add or select an indication.
4. Select the archetype for that indication.

At this point, the user is naming and scoping the model. The brand setup itself does not change the mathematics.

## 5.2 Flow immediately after archetype selection

Selecting the archetype should:

- Bind the indication to the relevant certified engine family.
- Load the archetype's permitted modes.
- Load default Core, Recommended and Governed modules.
- Establish the model's grade constraints.
- Create the relevant bucket views.
- Update the persistent build manifest.
- Mark the new indication for review.

If the archetype is changed after modules have been customised, the design should warn the user that attachments will reset and require confirmation.

## 5.3 Common backbone, variable content

The CoE should always progress through the same six bucket stages, but the content assembled within each bucket should change by archetype.

### Bucket 1: Population and eligibility

- Patient-Flow: detailed eligibility or treatment funnel.
- Prevalent-Share: prevalent or addressable pool.
- Rx-Share: market Rx base, if configured through relevant modules.
- Market Stock-Flow: starting stock or eligible cohort.
- Trend: historical series and segmentation context.
- Peak-Year Sizing: addressable population and early assumptions.

### Bucket 2: Share and competition

- Patient-Flow: uptake, access or competitive share components.
- Prevalent-Share: primary working share structure.
- Rx-Share: prescription-share path.
- Market Stock-Flow: share or allocation where attached.
- Trend: optional blending or segment share.
- Peak-Year Sizing: peak-share assumptions and analogue evidence.

### Bucket 3: Engine core

This is where archetype differences are most visible. The UI should show the selected modes and the essential state logic without forcing the CoE to work directly with raw code or formulas.

### Bucket 4: Actuals and calibration

The UX should adapt to the archetype's actuals regime and show the actuals boundary, calibration method, freshness and override status.

### Bucket 5: Conversion and finance

The model translates forecast quantities into units and financial outputs. GTN is a shared governed brand layer rather than a separate fork for every indication.

### Bucket 6: Outputs, scenarios and submission

The flow converges again into comparison, reconciliation, validation and downstream submission, although the domain-specific outputs differ by archetype.

---

# 6. How Archetypes Improve the CoE Experience

## 6.1 A structured starting point

The CoE does not begin with a blank model. Selecting an archetype loads the expected modes and default modules. This reduces the need to reconstruct standard model logic for each brand.

## 6.2 Controlled flexibility

The CoE can configure the selected archetype for an indication without creating a new product experience from scratch. The platform therefore supports brand variation while retaining a common configuration method.

## 6.3 Separation of methodology and usage

The CoE controls the model structure, while the forecaster works with approved assumptions and scenarios. This prevents ordinary forecasting work from silently changing the governed model.

## 6.4 Repeatable reviews

The six-bucket chain gives the CoE a repeatable checklist across different model families. Review status and compatibility warnings make it easier to see what still needs attention before publication.

## 6.5 Better handoff

The published configuration records the indication, archetype, modes, modules, engine version and locked items. The forecaster receives a known model rather than a loosely documented spreadsheet.

## 6.6 Stronger governance

The platform can enforce:

- Certified engine versions.
- Governed modules.
- Module compatibility.
- Grade ceilings.
- Immutable published versions.
- Required source, confidence and ownership.
- Audit trails for configuration and forecast actions.

## 6.7 Easier scaling across indications

A brand can contain multiple indication instances, each using the appropriate archetype. The indication-level outputs then roll up through shared brand layers into the brand total.

## 6.8 Faster onboarding and comprehension

A consistent shell, standard bucket sequence, common terminology and archetype-specific guidance can reduce the effort required to understand a new brand model. The solution notes also call for a common experience with configurable flows rather than hyper-custom interfaces.

---

# 7. Recommended CoE Configurator Flow

## Step 1: Define model context

Capture:

- Brand or asset
- Geography
- Planning cycle
- Indications
- Governance or rigor tier, if applicable

**Design requirement:** Keep a persistent model-context header and build-manifest panel.

## Step 2: Select an archetype per indication

Show six cards containing:

- Archetype name
- Main forecasting question
- Primary audience
- Typical inputs
- Typical outputs
- Available modes
- Grade or limitation
- Suggested use cases

**Design requirement:** Selection should be a methodological decision, not a visual-theme choice.

## Step 3: Configure modes

Show only mode groups valid for the selected archetype. Explain how each mode changes the engine behaviour.

**Design requirement:** Use plain-language descriptions and reveal technical detail progressively.

## Step 4: Review default modules

Pre-attach Core, Recommended and Governed modules. Group them into the six calculation buckets.

**Design requirement:**

- Core: expected foundation.
- Recommended: suggested for this model family.
- Governed: mandatory and not detachable.
- Mode: controlled in the mode-selection step.

## Step 5: Resolve compatibility and gaps

Show requires, excludes and requires-mode rules. Block publication while invalid combinations remain.

**Design requirement:** State the conflict and the action needed to resolve it.

## Step 6: Bind data and define assumption ownership

For each input, show:

- Input name
- Business meaning
- Unit and time grain
- Source
- Owner
- Confidence
- Locked or editable state
- Fallback or override rule

## Step 7: Preview the assembled model

Provide an assembled view for every configured bucket and a high-level model map.

**Design requirement:** Enable the CoE to preview what the forecaster will see without entering the forecaster workspace.

## Step 8: Validate and publish

Before publication, review:

- Indication and archetype assignments
- Engine versions
- Modes
- Module attachments
- Compatibility checks
- Data bindings
- Assumption metadata
- Forecast controls exposed to the forecaster
- Grade restrictions
- Downstream submission configuration

## Step 9: Assign and hand off

Assign the model to authorised forecasters and preserve the published configuration as an immutable version.

---

# 8. Recommended Forecaster Flow After CoE Handoff

1. Enter an assigned brand and planning cycle.
2. See the active indication, archetype, model version and status.
3. Review data freshness and the actuals boundary.
4. Review open assumptions and events.
5. Edit only authorised fields.
6. Create or duplicate a scenario.
7. Run the governed model.
8. Review archetype-relevant outputs.
9. Compare scenarios and prior cycles.
10. Run sensitivity, goal seek or need-to-meet where supported.
11. Resolve validation issues.
12. Add rationale and submit.

The forecaster should not need to understand every module used to assemble the model. However, the interface should preserve traceability by explaining where a field came from, whether it is locked and what it affects.

---

# 9. Pharma-Specific Design Context

## 9.1 Brand and indication are different levels

A brand can have multiple indications, and each indication may use a different engine archetype. The UI should therefore avoid treating archetype as a single brand-wide setting.

## 9.2 Patient, prescription, stock and financial measures are not interchangeable

Every value should display its unit and business meaning. The design must distinguish patient counts, days of therapy, TRx, NRx, NBRx, units, gross sales and net sales.

## 9.3 Evidence and assumptions matter

Inputs should carry source, confidence and ownership. This is especially important when evidence is limited, a market requires manual overrides, or a screening model is based on analogues or research.

## 9.4 Data availability varies by geography and model

The solution context notes that international and pipeline cases may have limited data and may require controlled population, placeholder or override behaviour. The UX should not assume that every model has a complete automated data feed.

## 9.5 Actuals must be separated from forecast

Show the actuals boundary clearly. Users need to know what is observed, what has been calibrated and what is forecast.

## 9.6 Scenario reasoning must be preserved

Store the changes, rationale, evidence and comparison for every scenario. Avoid showing only a final number.

## 9.7 Finance is a governed conversion layer

Financial views should be traceable to demand and volume. The brand should consume one governed GTN truth rather than creating indication-specific GTN forks.

## 9.8 Early sizing must not appear more certain than it is

Peak-Year Sizing requires prominent screening-grade treatment and evidence confidence.

## 9.9 Restricted work requires structural separation

BD or pipeline records require a restricted partition. Hiding a navigation item is not sufficient as the access model.

---

# 10. Dashboard and Component Implications

## Persistent context bar

Always show:

- Role or workspace
- Brand
- Geography
- Planning cycle
- Indication
- Archetype
- Model version
- Scenario
- Status

## Archetype summary panel

Show:

- What this archetype models
- Why it was selected
- Active modes
- Engine version
- Grade
- CoE owner
- Published date

## Build manifest

For CoE users, maintain a live summary of:

- Indications and engines
- Active indication being edited
- Modes
- Modules by bucket
- Locked items
- Review status

## Dynamic workspace

The navigation shell should stay consistent, but components should be assembled from the published configuration.

## Locked-field language

Explain why a field is locked:

- CoE-governed
- Derived by engine
- Bound to source
- Restricted by model grade
- Not available for this archetype

## Archetype-aware analytics

Do not force every archetype into identical charts. Use a modular system that can display the appropriate patient funnel, share path, prescription trend, stock-flow, historical projection or peak-sizing view.

## Common comparison pattern

Despite different archetype outputs, use a common comparison grammar:

- Base versus alternative scenario
- Current versus previous cycle
- Forecast versus actual
- Forecast versus target or budget
- Contribution or bridge explaining the delta

---

# 11. UX Guardrails

- Do not present archetypes as cosmetic templates.
- Do not expose formulas as editable text unless explicitly required and authorised.
- Do not allow a mode change to silently alter the archetype.
- Do not reset customised modules without confirmation.
- Do not allow governed modules to be removed.
- Do not hide the unit, time grain or data source.
- Do not allow derived outputs to be typed manually.
- Do not hide the actuals boundary.
- Do not let a forecaster modify the engine grade.
- Do not show BD-restricted data in general search, export or AI answers.
- Do not make every therapeutic area use an identical KPI dashboard.
- Do not create completely separate navigation for every archetype.

---

# 12. Open Questions to Validate with the CoE

## Catalogue and terminology

1. Are these six archetype names the final user-facing names?
2. Are older terms such as inflow and outflow, Rx Growth, prevalence or PSS synonyms for the present catalogue, earlier concepts or separate models?
3. What decision criteria should guide the selection of each archetype?
4. Can an indication combine more than one archetype, or must it have exactly one primary engine?

## Archetype configuration

5. Which mode options are mandatory for each archetype?
6. Which mode options are mutually exclusive?
7. Which modules are genuinely Core, Recommended and Governed for Wave 1?
8. Who is authorised to change archetype defaults?
9. What review or approval is required when the CoE introduces a new model structure?

## Pharma forecasting content

10. What are the required patient states for the Patient-Flow prototype?
11. What share hierarchies must Prevalent-Share support?
12. Which Rx basis is required for the first Rx-Share use case?
13. Which vaccine stock-flow pattern is required for Wave 1?
14. Which trend methods can an end user see or select?
15. Which Peak-Year Sizing assumptions require confidence grading and evidence attachments?

## Flow and permissions

16. Which settings remain editable after publication?
17. What happens to in-progress scenarios when the CoE publishes a new model version?
18. Does the forecaster choose an archetype, or is the archetype always assigned by the CoE?
19. Who approves a forecast and who can return it?
20. Which output views are visible to leadership before approval?

## Data and localisation

21. Which data sources are expected for each archetype?
22. What is the fallback where actuals are missing or delayed?
23. Which markets require manual or locally informed overrides?
24. Which units and time grains are required by market?
25. How should the system represent different forecast cycles across countries?

## Prototype scope

26. Which archetype should be designed end to end first?
27. Which second archetype is sufficiently different to demonstrate platform flexibility?
28. Which brand or indication provides the most representative test case?
29. Which interactions must be functional in the prototype rather than simulated?
30. Which outputs will provide enough evidence that the builder flow is relevant to real CoE users?

---

# 13. Recommended Prototype Coverage

To prove that the design is a platform rather than a single-brand dashboard, demonstrate:

## End-to-end primary archetype

Use one archetype to show the complete journey:

- CoE setup
- Archetype and mode selection
- Module review
- Data and assumption binding
- Preview
- Publish
- Forecaster assumptions
- Scenario creation
- Analytics
- Validation and submission

## Contrasting secondary archetype

Use a second, materially different archetype to demonstrate that:

- Modes change.
- Default modules change.
- The engine-core view changes.
- Inputs and outputs change.
- The common shell and governance flow remain the same.

**Design suggestion:** Patient-Flow and Market Stock-Flow or Patient-Flow and Peak-Year Sizing would visibly demonstrate different model structures. This is a design recommendation, not a confirmed Wave 1 decision.

---

# 14. Definition of a Relevant and Credible Design

The design is ready for CoE validation when:

- Archetype is treated as a governed engine selection, not a dashboard theme.
- Each indication can carry its own archetype.
- Modes are presented as variants within an archetype.
- Archetype selection loads appropriate defaults.
- The CoE can understand the complete assembled model before publication.
- The forecaster sees only permitted levers.
- The actuals boundary and data freshness are visible.
- The outputs match the model family rather than a universal KPI template.
- Shared finance and submission layers are consistent across indications.
- Scenario changes are traceable.
- Published versions are distinguishable and auditable.
- Screening-grade and restricted contexts are unmistakable.
- The common workflow remains recognisable across multiple archetypes.

---

# 15. Practical Design Takeaway

The key design principle is:

> **Keep the setup and governance journey consistent, while allowing the model content to change by archetype.**

For the CoE, archetypes make the flow better by replacing a blank-canvas model build with a governed starting point. They reduce repeated setup, make reviews more systematic, clarify the handoff to forecasters and preserve enough flexibility for different pharma forecasting questions.

For forecasters, archetypes should remain mostly behind the scenes. The forecaster should receive a relevant set of inputs, scenarios and outputs with clear traceability, rather than having to understand or rebuild the underlying model.

---

# 16. Source Artefacts Used

- `Forecasting CoE Platform — Requirements & Jira Backlog v1.0.docx`
- `PFIZER FORECASTING SOLUTION NOTES.docx`
- `Pfizer Forecasting - Design Context` meeting recording
- `Pfizer Forecasting - Design Scope` meeting recording
- `Daily Standup - Forecasting COE` meeting recording
- `Next Gen Forecasting - Session - Understanding Archetypes` meeting record, with no transcript available

