# Next Gen Forecasting Prototype — Collated Screen-by-Screen Feedback

**Purpose:** A designer-ready consolidation of the prototype feedback captured across the available Next Gen Forecasting discussions. Each section translates the feedback into specific, implementable UI actions.

**Primary sources reviewed:**
- Pfizer Forecasting Project Context & Discovery Call Readiness (transcribed meeting and meeting chat)
- Pfizer Forecasting — Design Context (transcribed meeting summary)

**Coverage note:** The enterprise search returned 17 related meetings. Most recurring/client sessions were not transcribed and contained no usable design-feedback detail. The actions below therefore consolidate every specific prototype action found in the two transcribed sources and the associated meeting chat, without inventing feedback from untranscribed sessions.

---

## 1. Cross-Screen Product and Design Principles

### Targeted actions
- [ ] Treat the current design as an **MVP prototype**, not a permanently locked final-state product.
- [ ] Use the phrase **“confirm prototype requirements”** instead of “lock” or “freeze”.
- [ ] Clearly distinguish the **MVP prototype** from the longer-term target or “most lovable product” vision.
- [ ] Maintain one primary prototype owned by the UX/design team. Do not create parallel, competing mock-ups.
- [ ] Record new ideas against the relevant prototype screen using annotated screenshots, numbered comments, or Figma comments.
- [ ] Before presenting each screen, show a short functional-strategy frame covering:
  - purpose of the screen;
  - primary user;
  - key decisions supported;
  - proposed components;
  - rationale for the recommendation;
  - questions requiring stakeholder input.
- [ ] Build role-specific experiences for **COE/configurator**, **forecaster**, and **viewer/leadership** users.
- [ ] Keep persistent forecast context visible where relevant: region, market/country, brand or asset, forecast cycle, scenario and version.
- [ ] Add a visible guided workflow or step progression across configuration and forecasting tasks.
- [ ] Add a contextual AI guidance rail consistently across applicable screens rather than treating AI as a separate destination.
- [ ] Remove decorative icons that do not communicate meaning, especially generic AI-style icons.
- [ ] Ensure the interface remains deterministic and governed. AI can recommend, explain and assist, but users must review and accept changes.
- [ ] Design for auditability: show who created, edited, submitted, reviewed or published an item, with date, status and version.
- [ ] Avoid showing unverified or non-buildable functionality as committed MVP scope. Mark future concepts visibly.

---

## 2. Screen 0 — Prototype Introduction / Design Rationale

### Objective
Give stakeholders context before they react to surface-level UI details.

### Targeted actions
- [ ] Add a short introduction screen before the clickable prototype.
- [ ] State the prototype scope, intended users and current level of maturity.
- [ ] Explain that the prototype is interactive and is being used to validate workflow and requirements.
- [ ] Show the proposed information architecture and end-to-end flow at a high level.
- [ ] List the major experience hypotheses being tested, including:
  - guided workflow;
  - role-based entry;
  - governed model configuration;
  - contextual AI assistance;
  - assumptions and evidence management;
  - scenario creation and comparison;
  - review and publication.
- [ ] Include an explicit feedback prompt: retain, remove, revise or add.
- [ ] Separate confirmed requirements from open hypotheses and future-state concepts.

---

## 3. Screen 1 — Role Selection / Platform Entry

### Current issue
The initial two-option entry screen was considered too sparse and too similar to the existing experience. It does not sufficiently explain the platform’s value or guide users.

### Targeted actions
- [ ] Replace a simple pair of tiles with a richer mini landing page.
- [ ] Add three role-based entry points:
  1. **Configure models** — for COE/configurator users;
  2. **Create or manage forecasts** — for forecasters;
  3. **View performance and decisions** — for leadership/read-only viewers.
- [ ] Under each role, show what the user can do, not just the role label.
- [ ] Use short capability previews or a visual process summary for each entry point.
- [ ] Clarify that a configurator may also receive forecaster access, while a forecaster may not receive configuration rights. Mark this as a validation question.
- [ ] Make viewer access configurable by geography, brand or portfolio.
- [ ] Consider a neutral platform descriptor such as **Integrated Forecasting** rather than a narrow module label.
- [ ] Add a “recent activity / continue where you left off” area if it can be supported.
- [ ] Make the landing view role-responsive so the most relevant tasks and information appear first.

### Open decision to validate
- Does a forecaster require configurator access because they are closest to the forecast details?

---

## 4. Screen 2 — Portfolio / Model Library

### Objective
Provide a governed repository of available models and a clear starting point for configuration or forecasting.

### Targeted actions
- [ ] Position the library as a governed repository, similar in concept to a model registry.
- [ ] Add summary cards or compact visualisations above the list. Potential categories explicitly raised in feedback include:
  - published models;
  - drafts;
  - models in review;
  - recent activity;
  - models requiring attention;
  - upcoming forecast deadlines.
- [ ] Show status indicators clearly: draft, in review, published, archived or other agreed states.
- [ ] Add columns or metadata for:
  - model/archetype name;
  - subject, brand or asset;
  - geography;
  - forecast cycle;
  - owner;
  - version;
  - last updated;
  - data freshness, if available;
  - publication status.
- [ ] Support filters for country/geography, brand/asset, cycle and status.
- [ ] Prioritise items that require action or have an approaching deadline.
- [ ] Add recent activity and collaboration signals where supported.
- [ ] Provide actions to open, duplicate, continue editing, review or start a forecast from a published model.
- [ ] Clearly distinguish COE governance actions from forecaster consumption actions.
- [ ] Confirm whether advanced repository/governance functionality is MVP-critical or a later enhancement.

---

## 5. Screen 3 — Start a New Model

### Targeted actions
- [ ] Present three start paths:
  1. start from a published model;
  2. start from a blank configuration;
  3. upload an existing Excel model.
- [ ] For “start from published model”, explain that the user is creating a governed derivative or new version.
- [ ] For Excel upload, show that uploaded content must be reviewed before it becomes an accepted configuration.
- [ ] If AI extraction is shown, present it as a recommendation that identifies assumptions, inputs and model structure for user confirmation.
- [ ] Display the destination geography, brand/asset and cycle before the user proceeds.
- [ ] Preserve source lineage so users can see whether the model began from a template, previous version or uploaded file.

---

## 6. Screen 4 — Subject / Forecast Scope Setup

### Current issue
The flow must not force every forecast into a rigid “brand-only” structure.

### Targeted actions
- [ ] Rename the starting object to a flexible term such as **Forecast subject** or **Forecast scope**.
- [ ] Allow the subject type to include brand, pipeline asset, portfolio component or another agreed entity.
- [ ] Allow users to define multiple revenue or forecast streams within a subject.
- [ ] Permit stream dimensions such as indication, country/geography, channel, age, biomarker, line of therapy, competitor or other custom dimension.
- [ ] Display chosen context persistently: subject, geography, brand/asset and cycle.
- [ ] Add clear helper text explaining what a stream is and how it affects downstream configuration.
- [ ] Let users add, rename, duplicate, reorder or remove streams.
- [ ] Show validation for missing required context before continuing.
- [ ] Do not assume every subject follows the same stream structure.

---

## 7. Screen 5 — Archetype Selection

### Targeted actions
- [ ] Present the agreed archetypes as clear selectable options.
- [ ] Remove unnecessary decorative icons that make the screen feel generic or AI-generated.
- [ ] Use concise descriptions explaining when each archetype is appropriate.
- [ ] Allow different streams within the same forecast subject to use different archetypes.
- [ ] Show the implications of selection, such as associated modes, modules, required inputs and expected outputs.
- [ ] Add an AI recommendation in the guidance rail based on subject, geography and available model definitions.
- [ ] Explain why an archetype is recommended and require explicit user acceptance.
- [ ] Provide a comparison view if users need to evaluate multiple archetypes.
- [ ] Mark archetype availability and governance status.
- [ ] Confirm the final taxonomy and naming because some archetype/module boundaries remain fluid.

---

## 8. Screen 6 — Engine Modes and Output Basis

### Targeted actions
- [ ] Show the modes available for the selected archetype.
- [ ] Explain the purpose of each mode and its impact on the calculation flow.
- [ ] Support multiple output units rather than assuming only patient-month output.
- [ ] Include relevant options such as prescriptions or other agreed output types.
- [ ] Make dependencies between mode selection, modules and outputs visible.
- [ ] Add inline validation for incompatible combinations.
- [ ] Let the AI rail recommend modes, but keep the configurator in control.
- [ ] Keep configuration terminology consistent with the client taxonomy.

---

## 9. Screen 7 — Module Selection and Calculation Chain

### Current issue
Checkbox-only module selection does not communicate execution sequence or the assembled forecast logic.

### Targeted actions
- [ ] Replace or supplement checkboxes with a ranked, draggable calculation chain.
- [ ] Allow users to order modules from the top of the funnel through downstream calculations.
- [ ] Update the visual calculation flow dynamically as modules are selected or reordered.
- [ ] Show connections and dependencies between modules.
- [ ] Let users add an additional parameter or module when the standard template does not cover a local need, subject to governance.
- [ ] Distinguish required, optional and unavailable modules.
- [ ] Explain which options will be exposed to forecasters after publication.
- [ ] Provide a preview of the calculation chain from the forecaster’s perspective.
- [ ] Add warnings for missing dependencies or broken calculation sequences.
- [ ] Add AI assistance to propose an initial module sequence based on archetype, product and geography.
- [ ] Require the configurator to accept, edit or reject AI recommendations.
- [ ] Confirm governance: whether only COE can define modules or whether forecasters can propose additions.

---

## 10. Screen 8 — Data Binding / Source Connection

### Targeted actions
- [ ] Add a dedicated step or clearly labelled section for binding source data to model inputs.
- [ ] Show the selected data source and the context it covers, such as brand, market and time period.
- [ ] Display mapping between source fields/KPIs and calculation inputs.
- [ ] Identify actuals, baseline forecast values and other source categories.
- [ ] Show data freshness and readiness where the information is available.
- [ ] Flag missing, incompatible or unmapped fields before users proceed.
- [ ] Provide traceability from an input back to its source.
- [ ] Clarify when historical or competitor data is required for a new forecast versus later actualisation.
- [ ] Do not imply that all markets or archetypes use the same data structure.

---

## 11. Screen 9 — Assumptions Management

### Current issue
A major missing step was identified between constructing the calculation chain and producing a forecast: entering, sourcing and governing assumption values.

### Targeted actions
- [ ] Add a dedicated assumptions step to the configurator and forecaster workflows.
- [ ] Group assumptions according to the calculation chain or module.
- [ ] Support manual input of values such as epidemiology, patient counts, growth rates and other model drivers.
- [ ] Allow authorised users to mark assumptions as locked or editable for forecasters.
- [ ] Provide import options for Excel and, if included in scope, supporting research files or PDFs.
- [ ] Capture source evidence or documentation against each assumption.
- [ ] Show who created or edited an assumption and when.
- [ ] Maintain version history and make changes comparable.
- [ ] Add rationale fields for material changes.
- [ ] Use validation states for missing, stale, out-of-range or conflicting assumptions.
- [ ] Let AI extract or recommend assumptions only as reviewable suggestions.
- [ ] Surface downstream impact when an assumption changes.

---

## 12. Screen 10 — Model Flow Review / Configuration Summary

### Targeted actions
- [ ] Add a consolidated review screen before publication.
- [ ] Summarise:
  - forecast subject and streams;
  - geography and cycle;
  - selected archetype per stream;
  - modes and output units;
  - module sequence;
  - bound data sources;
  - assumptions and edit permissions;
  - assigned users;
  - validation results.
- [ ] Show a readable visual model flow, not only a form summary.
- [ ] Highlight incomplete or invalid steps and link users back to the exact screen.
- [ ] Include a forecaster preview showing what will be available after publication.
- [ ] Provide clear “edit” actions next to each summary section.
- [ ] Include version and audit metadata.

---

## 13. Screen 11 — Publish and Assign

### Targeted actions
- [ ] Allow publication by geography and forecast cycle.
- [ ] Support assignment or access binding for specific forecasters or teams.
- [ ] Show what functionality and assumptions will be editable by forecasters.
- [ ] Include a review/approval state before publishing if required by governance.
- [ ] Distinguish “save draft”, “submit for review” and “publish”.
- [ ] Avoid implying that publication permanently locks the model.
- [ ] Explain that future versions can be created while preserving audit history.
- [ ] After publication, return the user to the library and show the new governed version.
- [ ] Confirm whether onboarding a new archetype requires additional or executive approval.

---

## 14. Screen 12 — Forecaster Workspace Landing

### Targeted actions
- [ ] Build a guided, forecaster-centric workspace rather than opening directly into dense model controls.
- [ ] Show persistent context: region, market, brand/asset, cycle, scenario and version.
- [ ] State the current workflow step and the next best action.
- [ ] Surface forecast priorities and deadlines.
- [ ] Show data readiness before forecasting begins.
- [ ] Provide a left-side workflow navigator with the sequence of forecasting tasks.
- [ ] Clearly separate configured/locked structure from forecaster-editable inputs.
- [ ] Present outstanding validation issues, review comments or missing evidence.
- [ ] Add an AI guidance rail for contextual assistance.
- [ ] Tailor the workspace by geography and role rather than assuming the US and international experiences are identical.

---

## 15. Screen 13 — Scenario Creation and Parameter Editing

### Targeted actions
- [ ] Expose only the parameters and modules published by the configurator.
- [ ] Allow authorised forecasters to adjust assumptions or scenario parameters.
- [ ] Show the baseline value, proposed value and resulting change.
- [ ] Support base, upside and downside scenarios, plus additional versions if required.
- [ ] Make the calculation relationship explicit so users understand how inputs affect outputs.
- [ ] Show whether scenario results are generated through rule/formula logic or consumed from a statistical source.
- [ ] Allow users to save, name, clone and compare scenarios.
- [ ] Capture rationale and evidence for material scenario changes.
- [ ] Add clear warnings when a change affects downstream calculations.
- [ ] Do not show sliders unless the underlying formula and effect are available and validated.

---

## 16. Screen 14 — Forecast Results / Output View

### Targeted actions
- [ ] Add at least a placeholder output screen to complete the prototype flow.
- [ ] Show the summarised forecast result using appropriate charts and tables.
- [ ] Present actuals, baseline and selected scenario together where relevant.
- [ ] Include model-specific outputs rather than a single generic dashboard.
- [ ] Potential views explicitly discussed in the discovery context include:
  - patient funnel;
  - performance summary;
  - scenario comparison;
  - driver and variance analysis;
  - sensitivity analysis;
  - event landscape;
  - reconciliation indicators;
  - model-specific waterfall or persistence views.
- [ ] Display key assumptions and drivers behind the result.
- [ ] Provide traceability from output to assumption, module and evidence source.
- [ ] Mark the selected version and publication/review status.
- [ ] Avoid filling the MVP with an excessive number of charts. Prioritise views by user decision need.

---

## 17. Screen 15 — Scenario Comparison

### Targeted actions
- [ ] Allow side-by-side comparison of base, upside, downside and saved scenarios.
- [ ] Highlight changed inputs, forecast movement and the drivers explaining the difference.
- [ ] Show version, author, date and rationale for each scenario.
- [ ] Provide a concise AI-generated comparison summary in the guidance rail, if included.
- [ ] Allow users to select a preferred scenario for review without deleting alternatives.
- [ ] Show downstream impacts and validation issues before submission.

---

## 18. Screen 16 — Review and Submit

### Targeted actions
- [ ] Add a final review step before submission to COE.
- [ ] Show readiness checks, incomplete items, warnings and outstanding comments.
- [ ] Summarise assumptions, scenarios, evidence and key outputs.
- [ ] Require rationale for material deviations or overrides.
- [ ] Provide governance actions: submit, return to edit or cancel.
- [ ] Confirm what becomes read-only after submission and what can still be revised.
- [ ] Show the reviewer and expected next state without inventing attendance or approval status.

---

## 19. Screen 17 — COE Review and Approval

### Targeted actions
- [ ] Present the submitted forecast with its source model, scenario, assumptions and version.
- [ ] Show changes from the previous approved or submitted version.
- [ ] Surface validation results, evidence and material driver changes.
- [ ] Support reviewer comments and required actions.
- [ ] Provide approve, return for changes and reject actions if confirmed by governance.
- [ ] Record reviewer, decision, timestamp and comments in the audit trail.
- [ ] Make only approved forecasts available to leadership or consolidated portfolio views.

---

## 20. Screen 18 — Leadership / Viewer Command Centre

### Targeted actions
- [ ] Create a dedicated read-only or decision-focused experience rather than reusing the configurator interface.
- [ ] Show portfolio health across relevant brands and regions.
- [ ] Surface forecast-cycle readiness, exceptions, risks and items requiring decision.
- [ ] Support filtering by geography, brand/asset and cycle.
- [ ] Show approved forecasts only, unless a draft-state comparison is explicitly required.
- [ ] Include cross-brand or cross-region visibility only where the data and workflow support valid comparison.
- [ ] Provide a concise view of key KPIs, drivers, risks and decisions.
- [ ] Restrict access according to geography, brand or portfolio responsibility.

---

## 21. Persistent AI Guidance Rail

### Targeted actions
- [ ] Add a persistent contextual assistant on the right or left of applicable screens.
- [ ] Keep its recommendations specific to the current role, screen and workflow step.
- [ ] Prioritise the following functions captured in feedback:
  1. next best action;
  2. explain forecast changes and drivers;
  3. surface data health issues;
  4. retrieve source evidence;
  5. compare scenarios;
  6. explain validation errors and warnings;
  7. guide completion of the current workflow step;
  8. surface reviewer comments;
  9. explain upstream/downstream impact;
  10. prepare a concise review or decision summary.
- [ ] For configurators, allow the assistant to recommend archetypes, modes, modules and sequences based on governed content.
- [ ] For forecasters, focus on guidance, explanations, evidence and scenario implications.
- [ ] Make all recommendations reviewable and reversible.
- [ ] Always explain the basis of a recommendation where possible.
- [ ] Do not let AI silently change the governed configuration.

---

## 22. Feedback Capture and Validation Pattern

### Targeted actions
- [ ] Add structured feedback prompts to the prototype review rather than relying only on free-form comments.
- [ ] For major decisions, ask stakeholders to select retain, remove, revise or defer.
- [ ] Use deterministic choices for decisions such as option preference, MVP inclusion and priority.
- [ ] Capture feedback by stakeholder type: forecasting expert, user, core team and adjacent function.
- [ ] Attach feedback directly to the relevant screen/component.
- [ ] Maintain a decision log with status, owner and resolution.
- [ ] Use meeting notes for iteration feedback and a concise client-facing requirements document for end-to-end confirmation.

---

## 23. Priority Order for the Designer

### P0 — Required to make the prototype coherent
1. Role-based entry with configurator, forecaster and viewer paths.
2. Persistent context for geography, brand/asset and cycle.
3. Guided step navigation.
4. Flexible subject and multi-stream setup.
5. Archetype, mode and module configuration.
6. Draggable calculation-chain sequencing.
7. Dedicated data-binding and assumptions steps.
8. Model-flow review and forecaster preview.
9. Publish-and-assign flow.
10. Forecaster scenario flow with a placeholder output screen.
11. Clear MVP/work-in-progress framing.

### P1 — High-value additions
1. Model-library summary dashboard and prioritised work queue.
2. Excel upload as a starting path.
3. Contextual AI guidance rail.
4. Version history, evidence and audit trail.
5. Scenario comparison and driver explanation.
6. COE review and approval.
7. Leadership/viewer command centre.

### P2 — Validate before committing
1. AI extraction from uploaded research documents or PDFs.
2. Forecaster ability to add new parameters/modules.
3. Cross-market comparison.
4. Executive approval for new archetypes.
5. Advanced collaboration/activity features.
6. Full portfolio analytics and wide chart coverage.

---

## 24. Open Questions to Resolve with the Product and Forecasting Teams

- [ ] Does a forecaster also need configurator access?
- [ ] Who can create, add or reorder modules: COE only, forecasters, or both through a governed proposal flow?
- [ ] Which archetypes and modules are confirmed for MVP?
- [ ] What are the final definitions and boundaries between archetypes, modes and modules?
- [ ] Which output units are required by each archetype?
- [ ] At what stage is historical/competitor data bound to the model?
- [ ] Which assumptions are locked, editable or locally overridable?
- [ ] What approval path is required for a new archetype?
- [ ] Which design capabilities are required for the October prototype versus the December build?
- [ ] Which screens are used in the IS, Richie’s-team and global-team demonstrations?
- [ ] Which views can be shown with real data?
- [ ] How should formula-driven forecasts and statistical-model outputs coexist in the experience?
- [ ] Which model-library governance capabilities are MVP-critical?
- [ ] What differs between US and international forecaster journeys?

---

## 25. Designer Handoff Checklist

- [ ] Every screen has a named user and explicit decision/task.
- [ ] All role permissions are visible and consistent.
- [ ] Geography, brand/asset, cycle, scenario and version context persist appropriately.
- [ ] Step progression is visible throughout the workflow.
- [ ] Archetype, mode, module and assumption terminology is consistent.
- [ ] Every editable value has a source, owner or rationale path.
- [ ] AI recommendations are explainable, optional and reversible.
- [ ] Draft, review, published and approved states are visually distinct.
- [ ] The forecaster preview matches the configuration being published.
- [ ] Scenario controls are backed by genuine calculation logic.
- [ ] Results can be traced back to drivers and evidence.
- [ ] MVP and future-state capabilities are clearly labelled.
- [ ] Feedback questions are attached to the relevant screens.
- [ ] No decorative iconography is used where labels and hierarchy are clearer.
- [ ] The prototype ends with a meaningful output, review or publication state rather than stopping mid-flow.
