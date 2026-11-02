# Product Requirements Document
# Next Gen Forecasting Platform

- **Version:** 2.0, User Testing Definition
- **Date:** 6 October 2026
- **Status:** Working product and design hypothesis for validation

## 1. Executive summary

Next Gen Forecasting is a governed forecasting platform that separates two connected jobs. The **CoE Configurator** builds, validates, versions, and releases reusable brand and market configurations. The **Forecaster** uses a released configuration to adjust approved assumptions, create and compare scenarios, understand forecast drivers, document rationale, and submit a forecast without changing governed model logic.

The product should standardize the forecasting process without requiring identical KPIs, funnels, or analytical views for every brand. Brand, market, archetype, available data, and forecast cycle determine the configured experience.

This PRD defines the detailed views, problem statements, flows, KPI framework, information architecture, requirements, and usability-testing scenarios for the Forecaster and CoE experiences.

## 2. Product context

Today, forecasting depends heavily on manually managed models and assumptions. Users need a common portal that provides approved configurations, scenario planning, visible data freshness, explainable outputs, validation, versioning, approvals, and traceability.

The central product handoff is a **validated and versioned brand configuration**:

- The CoE controls engines, modes, modules, data mappings, validation rules, defaults, permissions, and the Forecaster-editable surface.
- The Forecaster controls permitted assumptions, scenarios, rationale, and submission.
- AI may explain, recommend, and assist, but it must not silently change governed mathematics or approve the Forecast of Record.

## 3. Core problem statements

### P1. Forecasters cannot confidently identify the correct starting point

**Problem:** Files, versions, cycles, brands, markets, and baselines can make it difficult to know which setup is current.

**The product must clearly identify:**

- Brand and indication
- Market and country
- Forecast cycle
- Approved baseline
- Model, template, or archetype
- Data freshness
- Configuration version
- Current workflow state
- Required next action

**Desired outcome:** The user can answer: “What am I forecasting, which approved setup am I using, what is current, and what do I need to do next?”

### P2. Forecasters need flexibility without changing governed logic

**Problem:** Users need to reflect market knowledge and local events, but unrestricted editing reduces consistency and auditability.

**The product must distinguish:**

- Editable business assumptions
- Locked model structure
- Data-derived values
- Manual overrides
- Structural changes requiring CoE action

**Desired outcome:** Forecasters can explore and defend scenarios while the model remains governed and reproducible.

### P3. Users need to understand why the forecast changed

**Problem:** A final number is not enough to build confidence or secure approval.

**The product must connect outcomes to:**

- Baseline and prior-cycle comparison
- Actual-versus-forecast performance
- Assumption changes
- Driver contribution
- Funnel movement
- Sensitivity
- Goal seek
- Variance explanation
- Data and model updates

**Desired outcome:** The Forecaster can explain the result in business language and defend it during review.

### P4. CoE needs to reduce bespoke model rebuilding

**Problem:** The CoE needs independence from repeated specialist or vendor-led builds.

**The product must provide governed configuration for:**

- Archetypes and engines
- Modes and modules
- Brand and market composition
- Data mappings
- Assumptions and defaults
- Input bounds
- Validation rules
- Exceptions
- Versioning and release

**Desired outcome:** The CoE configures new brands and markets using approved reusable components.

### P5. CoE lacks a consolidated readiness and risk view

**Problem:** Configuration status, data readiness, validation evidence, exceptions, approvals, and release state can be fragmented.

**The product must show:**

- Configurations by lifecycle state
- Forecast-cycle readiness
- Data readiness and freshness
- Validation status
- Open exceptions
- Pending handoffs and approvals
- Engine and module versions
- Brands and markets affected by changes

**Desired outcome:** The CoE can identify risk, prioritize action, and govern the model estate from one workspace.

### P6. Standardization conflicts with brand-specific needs

**Problem:** Brands and countries can require different funnels, segments, frequencies, data sources, and outputs. Hyper-customization limits scale, while rigid standardization reduces adoption.

**The product should standardize:**

- Workflow structure
- Component behavior
- Status language
- Governance
- Validation
- Versioning
- Handoffs

**The product should allow controlled configuration of:**

- Funnel stages
- Segments and slices
- Assumption granularity
- Time granularity
- Modules
- KPI cards
- Analytical views
- Local overrides

## 4. Experience principles

1. **Two workspaces, one governed lifecycle.**
2. **Guided, not restrictive.**
3. **Trust before sophistication.**
4. **Standardize the process, not every KPI.**
5. **Business question first.**
6. **Progressive disclosure.**
7. **Human accountability for consequential decisions.**
8. **Visible ownership and handoffs.**
9. **Support exceptions and revision loops.**
10. **Accessible enterprise design.** Status must not rely on color alone.

## 5. Shared information architecture

### 5.1 Shared context header

Every detailed view should preserve:

- Brand
- Market / country
- Indication or use case
- Forecast cycle
- Scenario
- Configuration version
- Data release or last refresh
- Workflow status
- Current owner

Changing context must never silently discard working changes.

### 5.2 Forecast lifecycle rail

The rail represents forecast state, not tasks performed by one user:

1. Context selected
2. Data ready
3. Assumptions prepared
4. Scenario generated
5. Results validated
6. Submitted for review
7. Approved
8. Published

Supported states:

- Not started
- In progress
- Complete
- Blocked
- Returned for revision
- Awaiting another persona
- Automated check complete
- Not applicable

Each stage should expose owner, status, evidence, and next action.

### 5.3 Shared navigation

- Home
- Forecast Workspace
- Scenarios
- Results and Analytics
- Reviews and Approvals
- AI Assistant
- Knowledge and Documentation

### 5.4 CoE-only navigation

- Configuration Builder
- Template and Module Library
- Model Validation
- Portfolio and Cycle Readiness
- Exceptions and Change Requests
- Release and Version Management
- Access Administration, if in scope

# 6. Forecaster views

## 6.1 Forecaster home

### Purpose

Help users identify active work, required actions, recent forecasts, due tasks, and the correct approved starting point.

### Questions answered

- Which cycles require my attention?
- Which brands and markets are assigned to me?
- What is due, blocked, returned, or awaiting review?
- Is the latest data available?
- What changed since my previous session?

### Page structure

#### A. Priority action

Show:

- Required action
- Forecast and cycle
- Due status
- Blocker
- Primary CTA

#### B. My forecast cycles

Fields:

- Brand
- Market
- Cycle
- Current scenario
- Lifecycle stage
- Status
- Last updated
- Data freshness
- Next action
- Owner

#### C. Recent work

- Draft scenarios
- Recently opened forecasts
- Recent submissions
- Returned forecasts
- Approved reference forecasts

#### D. Alerts and changes

Only actionable items:

- New data release available
- Baseline updated
- Configuration version changed
- Assumption outside expected range
- Validation failed
- Reviewer requested changes

### Forecaster-home KPIs

These are personal operational KPIs, not executive portfolio metrics:

- Forecasts requiring action
- Draft scenarios
- Returned for revision
- Forecasts blocked by data or validation
- Submitted and awaiting review
- Upcoming cycle deadlines

**Validate with users:** Whether counts are useful or users navigate primarily by brand and cycle.

## 6.2 Forecast context setup

### Required fields

- Brand
- Market / country
- Indication, segment, or use case
- Forecast cycle
- Baseline version
- Approved template or archetype
- Time horizon and periodicity, where configurable

### Requirements

- Preselect context when opened from an assigned task.
- Show only approved configurations available to the user.
- Display engine and configuration versions.
- Display data availability and freshness.
- Explain unavailable or blocked contexts.
- Block progress when mandatory role access, baseline, or data is unavailable.

### Readiness summary

- Configuration: approved / issue
- Data: ready / incomplete / stale
- Baseline: selected / missing
- Access: confirmed / issue
- Open exception: yes / no

## 6.3 Assumptions and scenario builder

### Purpose

Allow the Forecaster to adjust permitted assumptions and create scenarios without modifying governed structure.

### Layout hypothesis

- **Left:** Assumption navigation and editing
- **Center:** Funnel, trend, or configured model visualization
- **Right:** Impact summary, warnings, and AI explanation
- **Persistent actions:** Save draft, Run, Compare, Review, Submit

### Configurable assumption categories

- Epidemiology or eligible population
- Diagnosis and treatment rates
- Patient flow or transitions
- Class and brand share
- Uptake and launch curves
- Persistence or duration
- Market events
- Pricing and gross-to-net
- Supply constraints
- Segment mix
- Local-market overrides

### Every assumption control must show

- Business label and definition
- Current value
- Baseline or prior-cycle value
- Unit and frequency
- Data source or manual status
- Last refresh, where available
- Editable or locked state
- Permitted range
- Override status
- Impact indicator
- Rationale requirement

### Interaction requirements

- Support direct entry, sliders, or tables based on the assumption.
- Support monthly, quarterly, or annual detail where configured.
- Preserve baseline values.
- Show unsaved changes.
- Require rationale for material overrides according to configurable rules.
- Allow reset at assumption, section, and scenario levels.
- Route structural changes to CoE as change requests.

### AI support

- Explain assumptions in business language.
- Identify the inputs with the greatest impact.
- Suggest scenarios from a user-stated objective.
- Flag unusual or conflicting assumptions.
- Draft rationale from visible changes.

AI content must be labeled and confirmed by the user.

## 6.4 Results and decision-support view

### Purpose

Help users determine whether a scenario is plausible, understand what changed, and decide whether it is ready for review.

### KPI framework

KPIs are configured by the CoE for each brand and use case.

#### Outcome KPIs

- Patient volume
- Units or prescriptions
- Gross sales
- Net sales / revenue
- Growth versus baseline
- Growth versus prior cycle
- Growth versus plan
- Peak sales or peak year, when relevant

#### Funnel and driver KPIs

- Eligible patients
- Diagnosed patients
- Treated patients
- Class share
- Brand share
- Persistence or duration
- Conversion between funnel stages
- Price and gross-to-net

#### Scenario and uncertainty KPIs

- Base, upside, and downside outcomes
- Difference from baseline
- Sensitivity range
- Top positive and negative drivers
- Confidence or uncertainty band
- Chance to meet plan only when methodologically supported

#### Quality and readiness KPIs

- Data freshness
- Validation status
- Missing inputs
- Overrides requiring review
- Configuration and engine version
- Backtesting metrics, when applicable
- Review readiness

### Configurable visualizations

- Forecast trend with actuals and baseline
- Patient or demand funnel
- Scenario comparison
- Assumption comparison
- Financial or driver bridge
- Waterfall
- Sensitivity tornado
- Variance decomposition
- Goal-seek result
- Data-source diagnostic

### KPI display rules

Every KPI must include:

- Definition
- Unit
- Period
- Comparison basis
- Source or calculation context
- Scenario and version context
- Drill-down path

Do not show a generic “Forecast Accuracy” KPI unless its calculation, benchmark, period, and data basis are defined.

### Insight panel priority

1. What changed
2. Why it changed
3. Whether it is material
4. What requires attention
5. What the user can do next

## 6.5 Scenario comparison

### Requirements

- Compare baseline and multiple named scenarios.
- Compare headline outcomes and assumptions.
- Highlight changed and unchanged inputs.
- Show driver contribution.
- Preserve owner, date, and rationale.
- Open, clone, archive, or select a scenario.
- Select a recommended scenario for submission.

### Comparison hierarchy

1. Outcome summary
2. Key driver differences
3. Assumption differences
4. Funnel or stage differences
5. Quality and validation differences

**Validate with users:** Side-by-side cards versus comparison table, and the maximum useful scenario count.

## 6.6 Review and submit

### Required information

- Selected scenario
- Headline outputs
- Delta versus baseline and prior approved cycle
- Changed assumptions
- Manual overrides
- Data freshness
- Validation results
- Business rationale
- Outstanding warnings
- Reviewer and route

### Actions

- Save draft
- Request peer review, if applicable
- Submit
- Withdraw before review, if permitted
- Respond to returned comments
- Request structural change from CoE

### Guardrails

Mandatory failures block submission. Warnings may permit submission only with rationale and recorded exception handling.

# 7. CoE views

## 7.1 CoE home: portfolio and cycle readiness

### Purpose

Provide an operating view of configurations, cycles, risks, exceptions, validation, and pending work.

### Questions answered

- Which brands and markets are ready for the next cycle?
- Which configurations are draft, validating, released, or retired?
- Where are data, validation, approval, or access blockers?
- Which engines and templates are reused?
- Which configurations use older versions?
- Which structural changes require action?

### A. Readiness summary KPIs

- Configurations by state
- Cycles ready to start
- Configurations blocked
- Validation failures
- Open exceptions
- Pending releases
- Structural change requests
- Configurations using outdated components

### B. Portfolio table

Fields:

- Brand
- Market
- Cycle
- Archetype or engine
- Template version
- Data readiness
- Validation state
- Release state
- Forecaster activity
- Open exception
- Current owner
- Next action

### C. Risk and exception panel

Prioritize by:

- Impact
- Urgency
- Brands affected
- Cycle deadline
- Validation severity
- Data dependency

### D. Reuse and usage panel

Potential insights:

- Most-used engines and modules
- Template reuse
- Bespoke requests
- Components generating repeated exceptions
- Configurations not used in recent cycles

**Validate with users:** Whether usage analytics is useful in the MVP.

## 7.2 Configuration Builder

### Purpose

Compose approved forecasting templates and brand configurations from governed components.

### Builder flow

1. Define brand, market, indication, and business question.
2. Select archetype or engine.
3. Select mode, where applicable.
4. Define streams, segments, and slices.
5. Attach modules.
6. Bind data sources.
7. Define assumptions, defaults, and granularity.
8. Define Forecaster-editable inputs.
9. Configure KPIs and analytical views.
10. Add validation rules and thresholds.
11. Preview the Forecaster experience.
12. Validate against reference expectations.
13. Submit for expert review.
14. Release the configuration.

### A. Configuration specification view

- Metadata and business purpose
- Engine and mode
- Modules
- Inputs and outputs
- Data mappings
- Assumption definitions
- Permissions
- Validation suite
- Owner and version

### B. Visual composition canvas

- Add approved components
- Understand dependencies
- View required and optional modules
- Identify incompatible combinations
- Reorder stages where permitted
- See outputs affected by changes

### C. Forecaster experience preview

Show exactly what the Forecaster sees:

- Editable assumptions
- Locked values
- KPIs
- Funnel stages
- Analytics tabs
- Warnings
- Scenario capabilities

Support preview by role and data state.

### D. Configuration comparison

Compare:

- Draft versus released version
- Template versions
- Brand configurations sharing an engine
- Defaults, modules, mappings, and rules

## 7.3 Engine, module, and template library

### Library item information

- Name and type
- Business purpose
- Supported use cases
- Dependencies
- Inputs and outputs
- Owner
- Version and status
- Brands and markets using it
- Validation evidence
- Documentation
- Change history

### Actions

- Search and filter
- View dependencies
- Create draft version
- Compare versions
- Deprecate with impact analysis
- Identify affected configurations
- Link test evidence and documentation

## 7.4 Validation workspace

### Validation categories

- Specification completeness
- Data mapping readiness
- Input bounds
- Module compatibility
- Mathematical parity
- Regression behavior
- Accuracy or bias, where applicable
- Business logic review
- Scenario behavior
- Output reconciliation
- Role and permission checks
- Audit and lineage completeness
- AI grounding tests when AI explanation is present

### Validation KPIs

- Checks passed, failed, and warning
- Blocking issues
- Reference parity result
- Last validation run
- Configuration version tested
- Data release tested
- Reviewer and decision

### Evidence record

- Test case
- Expected result
- Actual result
- Tolerance
- Status
- Evidence
- Reviewer
- Resolution note

## 7.5 Exceptions and change requests

### Request types

- New assumption
- New segment or slice
- New funnel stage
- Different time granularity
- New data source
- New output or KPI
- Rule override
- Module change
- Engine change
- Access change

### Request fields

- Requester
- Brand, market, and cycle
- Business rationale
- Expected impact
- Urgency
- Workaround
- Affected configuration
- CoE decision
- Implementation status

### CoE actions

- Approve as configuration change
- Approve temporary exception
- Reject with reason
- Request clarification
- Link to roadmap
- Route to data, platform, or governance owner

## 7.6 Release and version management

### Release gates

- Data mapping ready
- Validation complete
- Expert review complete
- Forecaster preview accepted
- Version and change notes recorded
- Affected-user impact understood
- Prior version remains traceable

### Version-impact view

- Configurations and forecasts using current version
- Proposed changes
- Breaking versus non-breaking changes
- Migration requirement
- Existing-forecast behavior
- Users and cycles affected

# 8. KPI and insight architecture

## 8.1 KPI principle

The platform provides a configurable KPI framework, not a universal fixed KPI set. The CoE defines the KPI configuration; the Forecaster receives the approved set.

## 8.2 KPI layers

1. **Outcome:** sales, revenue, patients, units, growth, peak outcome.
2. **Drivers:** population, diagnosis, treatment, share, uptake, persistence, price, GTN.
3. **Comparison:** baseline, prior cycle, target, actual, alternative scenario.
4. **Confidence and quality:** freshness, missing data, overrides, validation, uncertainty, approval, lineage.
5. **CoE operations:** readiness, exceptions, failures, pending releases, outdated versions, reuse.

## 8.3 Insight rules

Insights must be:

- Specific to brand, market, cycle, scenario, and version
- Traceable to visible data and assumptions
- Ranked by decision relevance
- Written in business language
- Labeled as descriptive, diagnostic, predictive, or recommended
- Labeled when AI-generated
- Supported by inspectable evidence

# 9. Detailed cross-persona flow

## Phase A: Configure and release

### CoE

1. Receive brand and market need.
2. Select engine and modules.
3. Configure data, assumptions, permissions, outputs, and validation.
4. Preview Forecaster experience.
5. Validate against reference expectations.
6. Resolve exceptions.
7. Release versioned configuration.

### Handoff artifact

- Engine and module versions
- Data mappings
- Assumption definitions
- Editable surface
- KPI and analytics configuration
- Validation evidence
- Owner and change history

## Phase B: Create and analyze

### Forecaster

1. Open assigned cycle.
2. Confirm context, baseline, data freshness, and version.
3. Review baseline assumptions.
4. Adjust permitted inputs.
5. Add rationale for overrides.
6. Run forecast.
7. Review outputs, drivers, and diagnostics.
8. Create and compare scenarios.
9. Select recommended scenario.
10. Submit with rationale.

## Phase C: Review and return

### Reviewer

1. Review outcome and differences.
2. Inspect changes, overrides, validation, and lineage.
3. Approve or return with comments.

### Forecaster on return

1. See reason for return.
2. Open affected assumptions and evidence.
3. Revise scenario.
4. Resubmit while preserving history.

## Phase D: Publish and operate

### CoE or authorized publisher

1. Confirm approval and release gates.
2. Publish Forecast of Record.
3. Make approved output available downstream.
4. Monitor version, exceptions, usage, and future changes.

# 10. User-testing plan

## 10.1 Objective

Test whether the separation between CoE configuration and Forecaster scenario planning is understandable, useful, trusted, and scalable across brands and markets.

## 10.2 Participants

- New and experienced Forecasters
- CoE configurators and power users
- Reviewers or approvers
- International or data-sparse market representatives

Core tests should prioritize Forecasters and CoE users.

## 10.3 Forecaster scenarios

### F1. Find and start the correct forecast

Tasks:

- Locate a brand and cycle.
- Confirm baseline and data readiness.
- Begin a working scenario.

Success signals:

- Correct context selected without help.
- Model and template status understood.
- Freshness issue noticed.

### F2. Create a scenario

Tasks:

- Adjust selected assumptions.
- Understand downstream impact.
- Save a named scenario.

Success signals:

- Editable and locked values distinguished.
- Data origins understood.
- Changed result explained.

### F3. Compare and select

Tasks:

- Compare baseline, upside, and downside.
- Identify main drivers.
- Select a scenario.

Success signals:

- Correct scenario selected.
- Key driver identified.
- Comparison supports explanation.

### F4. Submit and respond to return

Tasks:

- Add rationale.
- Resolve a warning.
- Submit.
- Respond to reviewer feedback.

Success signals:

- Blocking and non-blocking issues understood.
- Returned state and next action are clear.
- History remains understandable.

## 10.4 CoE scenarios

### C1. Configure a new brand

- Select approved engine.
- Add modules.
- Bind data.
- Define editable inputs and outputs.

Success signals:

- Dependencies understood.
- Configuration states are clear.
- Forecaster experience previewed.

### C2. Validate and release

- Review failed check.
- Resolve or route exception.
- Release configuration.

Success signals:

- Blocking issue interpreted correctly.
- Evidence and decision rights are clear.
- Release impact understood.

### C3. Respond to structural change

- Review request for a new segment or KPI.
- Assess affected configurations.
- Approve, reject, or defer.

Success signals:

- Rationale and impact visible.
- Decision captured.
- Reusable versus brand-specific change understood.

### C4. Manage a version update

- Compare current and proposed versions.
- Identify brands affected.
- Determine migration approach.

Success signals:

- Breaking change noticed.
- Impacted configurations understood.
- Existing lineage remains clear.

## 10.5 Test metrics

### Behavioral

- Task completion
- Critical error rate
- Wrong-context selection
- Missed blocker
- Successful scenario explanation
- Successful version-impact interpretation

### Efficiency

- Time to locate forecast
- Time to create and compare scenario
- Time to identify blocker
- Navigation loops and backtracking

### Perception

- Confidence in result
- Transparency
- Control
- Learnability
- Trust in AI suggestions
- Preference versus current process

### Qualitative prompts

- What did you expect to happen?
- What helped you trust the result?
- What felt hidden or overly controlled?
- What would make you return to Excel?
- Which part felt different from real work?
- What would you need before submitting or releasing?

## 10.6 Prototype requirements

The user-test prototype must include:

- Realistic brand, market, cycle, scenario, and version context
- One complete Forecaster flow
- One complete CoE flow
- Editable and locked assumptions
- Data freshness issue
- Validation warning or failure
- Scenario comparison
- Submission and returned state
- Forecaster preview from Builder
- Release gate
- Version-impact example

Synthetic data must be clearly labeled and internally consistent.

# 11. MVP for testing

## Must include

### Forecaster

- Home and assigned work
- Context setup
- Assumption editing
- Scenario save and compare
- Results and explanation
- Review and submit
- Returned-for-revision flow

### CoE

- Portfolio and readiness home
- Configuration Builder
- Editable-input and KPI configuration
- Forecaster preview
- Validation workspace
- Release flow
- Change-request review

## Should include

- Goal seek
- Sensitivity analysis
- AI explanation
- AI-assisted scenario creation
- Data diagnostics
- Version comparison

## Later

- Autonomous configuration
- Voice interaction
- Cross-brand optimization
- Automated version migration
- Advanced recommendation system

# 12. Decisions required before design sign-off

1. Confirm first Forecaster brand and archetype for testing.
2. Confirm first CoE configuration scenario.
3. Define release and publish authority.
4. Confirm approval and validation gates.
5. Confirm KPI categories for the first use case.
6. Confirm data-freshness fields available to the UI.
7. Confirm whether analytics sit within Forecaster or a separate persona.
8. Confirm handling of local-market overrides.
9. Confirm how version updates affect existing forecasts.
10. Confirm access to real Forecasters and CoE users.
