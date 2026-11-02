# Pfizer Next-Generation Forecasting Prototype
## UAT Feedback, Workflow Understanding, and Functional Change Requirements

**Source:** Pfizer Prototype UAT discussion  
**Purpose:** Consolidate the discussion into an implementation-ready list of workflow, functional, content, and UX changes.  
**Status:** Working requirements document based on the prototype walkthrough and feedback session.

---

## 1. Purpose of the UAT

The prototype walkthrough was conducted as a user acceptance test. The reviewer role-played as a user and evaluated each stage to identify:

- Missing functions or workflow steps
- Incorrect or unnecessary content
- Gaps between the prototype and the expected forecasting workflow
- Confusing interactions and navigation
- Responsive layout issues
- Areas where AI assistance could simplify model configuration

The intended experience is a guided forecasting-model creation workflow in which a Centre of Excellence (CoE) user configures a model, binds data, defines governed assumptions, generates a baseline forecast, reviews the complete setup, and publishes or assigns it to a forecaster.

---

## 2. Target End-to-End Workflow

The updated workflow should follow this sequence:

1. **Model Setup**
2. **Archetype Selection**
3. **Modes Configuration**
4. **Modules Configuration**
5. **Data Binding**
6. **Assumptions Register**
7. **Baseline Forecast Generation**
8. **Review**
9. **Publish and Assign**

A collapsible AI assistant should support the user throughout the workflow without replacing user control or introducing unsupported recommendation logic.

---

# 3. Step-by-Step Changes and Functions

## Step 1: Model Setup

### Current understanding

The user begins by entering model-level information such as brand, asset type, therapeutic area, lifecycle stage, revenue stream, and geography. The current experience relies heavily on manual form entry, while the right-hand panel displays a model summary before enough information exists to make that summary useful.

### Changes required

- Replace the early **Model Summary** panel with a collapsible AI assistant.
- Rename the assistant from **Casper** to **Charles**. The final spelling should be validated against the internal naming convention before release.
- Allow users to describe the model using natural language.
- Use the conversation to populate relevant model fields.
- Keep populated values visible and editable before progressing.
- Allow the assistant to guide the user to the next step.
- Remove irrelevant or automatically generated content carried over from earlier prototype iterations.

### Functions to add

- **Conversational model creation**
- **Natural-language input for model details**
- **Automatic field population from the conversation**
- **Editable AI-populated fields**
- **Field-level validation before continuing**
- **Missing-information prompts**
- **Save and continue**
- **Collapsible or expandable AI assistant panel**

### Model information to support

- Model name
- Brand or asset name
- Asset type
- Therapeutic area
- Lifecycle stage
- Revenue stream
- Geography
- Other required metadata defined by the model taxonomy

### Remove or relocate

- Remove Model Summary from this step.
- Remove unsupported recommendation content.
- Remove unexplained prototype-generated fields.

### Acceptance criteria

- A user can create a model through either direct form entry or a conversation with the assistant.
- Information entered through the assistant is mapped to the correct fields.
- AI-populated values can be reviewed and changed by the user.
- The model cannot progress if required information is missing.
- The assistant does not occupy the full right-hand panel permanently.

---

## Step 2: Archetype Selection / Engine Architect

### Current understanding

The user selects the model archetype that determines the relevant downstream modes and modules. The prototype currently includes an AI recommendation, but the discussion highlighted that a defensible recommendation would require historical model data, contextual training, engineering support, and explainable recommendation logic.

### Changes required

- Keep archetype selection explicit and user-controlled.
- Remove the current AI-recommended archetype card and its rationale.
- Show enough information for users to understand and compare available archetypes.
- Ensure the selected archetype controls the downstream configuration.
- Preserve the option to reconsider recommendation capabilities in a future phase.

### Functions to add

- **Archetype list or catalogue**
- **Archetype details and descriptions**
- **Manual archetype selection**
- **Selected-state confirmation**
- **Selection validation**
- **Archetype-to-modes mapping**
- **Archetype-to-modules mapping**
- **Change archetype with downstream impact warning**

### Remove

- AI Archetype Recommendation
- Unverified recommendation rationale
- Recommendation states such as "recommended but not applied"

### Future-phase dependency

AI-based archetype recommendations should only be reconsidered when the platform has:

- Historical model examples
- Validated brand, asset, lifecycle, and archetype relationships
- Recommendation rules or trained logic
- Explainability for why an archetype is suggested
- Governance and engineering support

### Acceptance criteria

- Users can select an archetype without relying on AI.
- The system displays only the modes and modules valid for that archetype.
- Changing an archetype clearly communicates the effect on completed downstream configuration.

---

## Step 3: Modes Configuration

### Current understanding

The prototype displays an incomplete set of modes. The discussion identified a broader set of configuration modes needed in the workflow. Modes should be relevant to the selected archetype rather than appearing as unrelated or static fields.

### Changes required

- Replace the incomplete mode setup with the full valid mode list.
- Display modes based on the selected archetype.
- Remove random or unrelated mode content.
- Clarify the relationship between an archetype and its available modes.
- Improve the layout so that larger sets remain easy to understand and configure.

### Modes referenced in the discussion

1. Output Units
2. Time Basis
3. Actual Regimen Mode
4. Retreatment Mode
5. LT Source Mode
6. Persistence Mode

> Note: The transcript also refers to "five" modes while naming six. The taxonomy or source configuration should be treated as the final authority for the exact count and names.

### Functions to add

- **Dynamic mode retrieval by archetype**
- **Mode selection controls**
- **Required versus optional mode indicators**
- **Mode descriptions or helper text**
- **Mode-level validation**
- **Save mode configuration**
- **Restore prior selections when navigating back**
- **Dependency handling between modes, where defined by the taxonomy**

### Acceptance criteria

- Only valid modes for the selected archetype are displayed.
- Required modes must be completed before continuing.
- Mode values remain intact when navigating backwards and forwards.
- The source taxonomy determines the definitive list and labels.

---

## Step 4: Modules Configuration

### Current understanding

The module screen was identified as one of the most confusing areas. The prototype displayed unexplained module counts, random content, weak grouping, and sections carried over from earlier iterations. The valid module list must come from the taxonomy file and should be grouped and presented in a user-friendly structure.

### Changes required

- Use the taxonomy file as the source of truth for modules.
- Show only modules valid for the selected archetype.
- Group modules into clear categories or buckets.
- Display the module name clearly.
- Make large sets discoverable without overwhelming the user.
- Remove random, duplicate, or prototype-generated modules.
- Redesign the hierarchy so users can understand how modules relate to the archetype and model flow.
- Fix the broken module display and inconsistent rendering.

### Functions to add

- **Taxonomy-driven module loading**
- **Module grouping by category or bucket**
- **Module count by group and overall set**
- **Expand and collapse module groups**
- **Module search or filter for larger lists**
- **Module selection and deselection**
- **Required versus optional module indicators**
- **Module details or descriptions**
- **Module configuration validation**
- **Selected-module summary**
- **Preserve module selection across navigation**
- **Display the model flow before or alongside the assistant panel**

### Remove or relocate

- Remove **Module Sequence** from the current configuration view if it is not part of the taxonomy-defined task.
- Remove **Calculation Chain** from this step.
- Move the relevant end-to-end flow or calculation representation to Review.
- Remove unexplained lower-page prototype content.

### Open point

The discussion referenced both a larger module set and a smaller valid set. The taxonomy file must determine the final number, grouping, and mapping. No count should be hard-coded until validated.

### Acceptance criteria

- Module data comes from the current taxonomy file.
- Users can clearly understand the module groups and selected modules.
- Invalid modules are not shown for the chosen archetype.
- No unexplained sequence or calculation-chain content appears on this page.
- Larger module sets remain usable through grouping, expansion, search, or filtering.

---

## Step 5: Data Binding

### Current understanding

The discussion indicates that data binding occurs before assumptions and forecast generation. Although detailed data-binding interactions were not fully covered, this step is a required bridge between structural model configuration and forecast creation.

### Changes required

- Retain data binding as a distinct workflow step.
- Ensure that bound data corresponds to the selected archetype, modes, and modules.
- Prevent the user from progressing when required data inputs are missing.
- Show the status of each required data connection or mapping.

### Functions to add

- **Data source selection**
- **Input-to-module mapping**
- **Binding status indicators**
- **Required-input validation**
- **Missing-data warnings**
- **Review and edit mappings**
- **Save data-binding configuration**
- **Data-source metadata display**, where available

### Important limitation

The UAT discussion did not define the exact connectors, file formats, mapping rules, or validation logic. These implementation details require confirmation from the product and data teams.

### Acceptance criteria

- Required model inputs can be mapped to available data.
- The system identifies missing required mappings before allowing users to proceed.
- Mapping choices are retained when users navigate between steps.

---

## Step 6: Assumptions Register

### Current understanding

The assumptions experience is not simply a pair of input fields. It should function as a governed register of assumptions established by the CoE and handed over to forecasters. Each assumption should communicate ownership, editability, source, and confidence. Some values may be locked by CoE, while others may be editable by the forecaster.

### Changes required

- Replace the limited assumptions view with a full Assumptions Register.
- Display the assumptions defined or logged by CoE.
- Show which assumptions can be modified by a forecaster.
- Lock assumptions that the forecaster must not change.
- Show source, confidence, and owner for each assumption.
- Connect assumptions to the relevant model inputs, modes, or modules.
- Remove irrelevant or generated assumptions carried from previous prototypes.

### Functions to add

- **Assumptions Register table or structured list**
- **Assumption name and value**
- **Assumption category**
- **Source**
- **Confidence level**
- **Owner**
- **Set-by role**, such as CoE or forecaster
- **Editable or locked status**
- **Forecaster-editable value control**
- **Validation and missing-value states**
- **Change tracking or audit indication**
- **Notes or rationale field**
- **Filter assumptions by ownership, confidence, or editability**
- **Save assumptions**

### Governance behaviour

- CoE-defined structural defaults should remain visible.
- Locked CoE assumptions should not be editable by the forecaster.
- Forecaster-editable slots should be clearly marked.
- Source, confidence, and owner should be present for every row where required.

### Acceptance criteria

- The user can distinguish locked assumptions from editable assumptions.
- Every assumption clearly communicates its source, confidence, owner, and role ownership where configured.
- Changes made by a forecaster are identifiable.
- The assumptions used in forecast generation are reviewable later.

---

## Step 7: Baseline Forecast Generation

### Current understanding

A baseline forecast step is missing between assumptions and review. Once data is bound and assumptions are established, the user should generate or enter the baseline forecast before reviewing charts and the complete model flow.

### Changes required

- Add a dedicated baseline forecast stage after Assumptions.
- Allow the model to generate or capture the baseline forecast using the configured inputs.
- Show baseline output before the user enters Review.
- Prevent Review from displaying final charts before a baseline exists.
- Allow the user to return to assumptions if baseline results expose an issue.

### Functions to add

- **Generate baseline forecast**
- **Baseline forecast status**
- **Baseline result preview**
- **Error and incomplete-input handling**
- **Regenerate baseline after inputs change**
- **Version or last-generated indication**
- **Navigate back to assumptions or configuration**
- **Continue to Review once generation succeeds**

### Important limitation

The transcript confirms the need for baseline forecast generation but does not define its calculation engine, input formulae, processing rules, or output granularity. These must be supplied by the forecasting and engineering teams.

### Acceptance criteria

- A baseline can only be generated when required data and assumptions are complete.
- The user can see whether baseline generation succeeded or failed.
- Updating an upstream input makes clear that the baseline may need to be regenerated.
- Review is enabled only after a valid baseline is available.

---

## Step 8: Review

### Current understanding

Review is the appropriate point for the user to see the complete model summary, calculation or model flow, assumptions, baseline forecast, charts, modes, and modules. The current prototype places some of this information too early.

### Changes required

- Move Model Summary to Review.
- Move the Calculation Chain or relevant model-flow representation to Review.
- Display configured modes and modules.
- Display the Assumptions Register used for forecast generation.
- Display the baseline forecast and relevant charts.
- Provide a coherent top-to-bottom funnel or flow view.
- Allow users to navigate back to the relevant step to resolve issues.
- Add a clear final validation state before publishing.

### Functions to add

- **Complete model summary**
- **Archetype summary**
- **Modes summary**
- **Modules summary**
- **Model or calculation flow visualisation**
- **Assumptions summary/register view**
- **Baseline forecast chart or output view**
- **Configuration validation summary**
- **Warnings and incomplete-item links**
- **Edit links back to each relevant step**
- **Submit or continue to Publish**

### Acceptance criteria

- Review presents the complete configured model in one coherent experience.
- Summary content is generated from actual user selections, not placeholders.
- Users can trace the baseline forecast back to configured inputs and assumptions.
- Errors or incomplete information link to the appropriate configuration step.
- Publish remains unavailable until required review checks are complete.

---

## Step 9: Publish and Assign

### Current understanding

The publishing step should capture where and how the model will be used, who will own the forecast, who can access it, and whether the CoE user will also act as a forecaster. The current prototype includes some publishing information but requires additional assignment and governance options.

### Changes required

- Retain geography and planning-cycle selection.
- Add the option for the CoE user to act as a forecaster.
- Allow assignment to one or more appropriate forecasters, subject to the product rules.
- Add model visibility or access controls.
- Show the configuration team or relevant ownership details.
- Present a final summary before submission.
- Confirm successful publishing and assignment.

### Functions to add

- **Publish geography selection**
- **Planning-cycle selection**
- **Forecaster assignment**
- **"I will also act as a forecaster" option**
- **Model visibility controls**
- **Configuration-team display or selection**
- **Final publish summary**
- **Publish validation**
- **Publish and assign action**
- **Success confirmation**
- **Published-model status**

### Acceptance criteria

- The user can specify geography and planning cycle.
- The CoE user can assign a forecaster or identify themselves as a forecaster where permitted.
- Visibility and ownership are clear before publishing.
- The system confirms the published state and assignment outcome.

---

# 4. AI Assistant Requirements

## Role of the assistant

The assistant should guide and accelerate model creation, not make opaque decisions on the user's behalf.

## Functions to add

- Accept natural-language model instructions.
- Populate supported model fields.
- Ask for missing required information.
- Explain the current step.
- Help the user complete fields and selections.
- Retain context within the active model workflow.
- Remain collapsible when not required.
- Allow users to use the workflow without opening the assistant.

## Functions not to add in the current phase

- Automated archetype recommendation without validated logic
- Unsupported recommendation rationale
- Autonomous publishing
- Autonomous changes to governed or locked assumptions

## Naming requirement

The meeting feedback indicates that the existing name **Casper** is incorrect and should be replaced. The transcript refers to **Charles**, although the spoken spelling is unclear. Confirm the approved internal name before final implementation.

---

# 5. Navigation and Workflow Behaviour

## Changes required

- Make every completed prior step accessible through the stepper.
- Allow users to move backwards and forwards without losing data.
- Clearly distinguish completed, current, incomplete, and blocked steps.
- Ensure direct step navigation works consistently.
- Warn users when an upstream change will invalidate downstream configuration.
- Preserve valid configurations when users return to earlier steps.
- Do not allow users to skip required stages.

## Functions to add

- **Clickable step navigation**
- **Previous and Next controls**
- **Progress status per step**
- **Unsaved-change handling**
- **Dependency-impact warning**
- **State persistence across steps**
- **Validation before continuing**
- **Return-to-error links from Review**

---

# 6. Responsive and Visual UX Fixes

## Observed issues

- The UI broke at the reviewer's screen resolution.
- Controls and content were not consistently selectable.
- Some views appeared different between users.
- The layout did not accommodate all screen sizes.
- The module experience lacked a clear hierarchy.
- The assistant consumed too much permanent screen space.

## Changes required

- Support the agreed range of desktop resolutions.
- Prevent card, stepper, panel, and content overlap.
- Ensure all selectable elements remain accessible at smaller widths.
- Add scrolling only within intentional containers.
- Keep critical actions visible.
- Use clear hierarchy for categories, modules, modes, and summaries.
- Collapse the assistant by default or make it easily collapsible.
- Test browser zoom and common enterprise laptop resolutions.

## Functions and behaviours to add

- **Responsive desktop layout**
- **Adaptive side-panel behaviour**
- **Overflow and scroll handling**
- **Minimum-width behaviour for configuration tables**
- **Accessible focus and selected states**
- **Consistent click targets**
- **Loading, empty, error, and disabled states**

---

# 7. Content and Data Clean-up

## Remove

- Old prototype-generated content
- Random or unexplained fields
- Unsupported AI recommendations
- Early Model Summary
- Calculation Chain from Modules
- Module Sequence where it does not serve a validated workflow purpose
- Duplicate controls and content
- Incorrect assistant name

## Validate against source material

- Archetype names
- Mode names and counts
- Module names, counts, buckets, and taxonomy mapping
- Assumption fields and role permissions
- Geography options
- Planning-cycle options
- Forecaster assignment rules
- Model visibility rules

---

# 8. Consolidated Functional Inventory

## Model creation

- Create a new model
- Enter model details manually
- Create model details conversationally
- Auto-populate supported fields
- Edit populated information
- Validate required fields
- Save model progress

## Archetype

- Browse archetypes
- View archetype details
- Select an archetype
- Change an archetype
- Warn about downstream impact
- Load relevant modes and modules

## Modes

- Load modes by archetype
- Configure mode values
- Explain each mode
- Validate required modes
- Save mode selections

## Modules

- Load modules from taxonomy
- Group modules into buckets
- Search, filter, expand, and collapse modules
- Select modules
- View module details
- Validate the configured module set
- Display selected-module summary

## Data binding

- Select a data source
- Map inputs to modules
- Show mapping status
- Identify missing inputs
- Save and review mappings

## Assumptions

- Display an Assumptions Register
- Show source, confidence, owner, and set-by role
- Distinguish locked and editable assumptions
- Allow permitted forecaster edits
- Capture notes or rationale
- Validate assumptions
- Track changes or provide an audit indication

## Forecast

- Generate a baseline forecast
- Display generation status
- Preview baseline results
- Regenerate after upstream changes
- Handle errors and incomplete inputs

## Review

- Display complete model summary
- Display modes and modules
- Display model or calculation flow
- Display assumptions
- Display baseline forecast and charts
- Show validation issues
- Link back to the source step

## Publish and assign

- Select geography
- Select planning cycle
- Assign a forecaster
- Let the CoE user act as a forecaster
- Configure model visibility
- Display configuration ownership
- Validate publish settings
- Publish and confirm success

## AI assistant

- Accept natural-language instructions
- Populate fields
- Ask for missing information
- Explain steps
- Retain workflow context
- Collapse and expand

## Platform UX

- Responsive desktop experience
- Clickable stepper
- Previous and Next navigation
- State persistence
- Validation and error states
- Upstream-change warnings
- Accessible selected, focus, loading, empty, and disabled states

---

# 9. Priority Backlog

## P0: Required before the next usable prototype review

- Fix responsive layout and broken screen behaviour.
- Fix step navigation and allow backward navigation.
- Remove unsupported AI archetype recommendations.
- Move Model Summary to Review.
- Make archetype selection explicit and user-controlled.
- Replace modes with the taxonomy-aligned set.
- Rebuild Modules using the current taxonomy file.
- Remove random module content, Module Sequence, and early Calculation Chain.
- Add the Assumptions Register structure.
- Add the missing Baseline Forecast stage.
- Add Review with model flow, assumptions, baseline output, and summary.
- Add the CoE-as-forecaster option in Publish.
- Rename and collapse the AI assistant.
- Remove legacy prototype-generated content.

## P1: Required for a complete functional workflow

- Conversational model creation and field population.
- Archetype-driven mode and module loading.
- Data-binding status and required-input validation.
- Assumption ownership, confidence, source, and lock states.
- Baseline regeneration after upstream changes.
- Review validation with links back to incomplete steps.
- Forecaster assignment, geography, planning cycle, and visibility controls.
- State persistence and upstream dependency warnings.

## P2: Enhancements after the core workflow is validated

- Search and filter for large module sets.
- Richer assistant guidance across steps.
- Detailed audit and version history.
- Explainable model-flow visualisation.
- AI-based archetype recommendations, only after data, governance, and explainability requirements are established.

---

# 10. Dependencies and Items Requiring Confirmation

The following were referenced but not fully defined in the UAT conversation:

1. Current taxonomy file and its version
2. Final archetype catalogue
3. Definitive mode names and count
4. Definitive module names, count, categories, and mappings
5. Data-source and data-binding rules
6. Baseline forecast calculation logic
7. Assumption ownership and permission rules
8. Confidence-level definitions
9. Audit and versioning requirements
10. Geography and planning-cycle values
11. Forecaster assignment and role rules
12. Model visibility and access-control rules
13. Final approved AI assistant name and spelling
14. Supported browsers, resolutions, and zoom levels
15. Exact publish and submission workflow

---

# 11. Definition of Done for the Next Prototype

The next prototype can be considered ready for review when:

- The workflow contains all nine agreed stages.
- The interface works at the agreed desktop resolutions.
- Navigation works in both directions without losing data.
- Archetypes, modes, and modules are sourced from validated taxonomy content.
- Unsupported recommendation content has been removed.
- Assumptions are shown as a governed register.
- A baseline forecast stage exists before Review.
- Review shows the complete model configuration and forecast output.
- Publish supports geography, planning cycle, assignment, visibility, and the CoE-as-forecaster option.
- The AI assistant is correctly named, collapsible, and limited to supported functions.
- All legacy, random, and placeholder prototype data has been removed.

---

# 12. Suggested Validation Scenarios

## Scenario A: Create a new model manually

- Enter model metadata.
- Select an archetype.
- Configure valid modes and modules.
- Bind required data.
- Review governed assumptions.
- Generate a baseline forecast.
- Review and publish.

## Scenario B: Create a model using the assistant

- Describe the model conversationally.
- Review populated fields.
- Complete missing information.
- Continue through the same governed workflow.

## Scenario C: Change an archetype after configuration

- Configure modes and modules.
- Navigate back and change the archetype.
- Verify that the user receives a downstream-impact warning.
- Confirm that invalid downstream selections are reset or flagged.

## Scenario D: Forecaster edits permitted assumptions

- Open a model handed over by CoE.
- Confirm that governed assumptions are locked.
- Edit only forecaster-enabled assumptions.
- Regenerate and review the baseline forecast.

## Scenario E: CoE user also acts as forecaster

- Configure and review the model.
- Select the option to act as a forecaster.
- Choose geography, planning cycle, and visibility.
- Publish and verify assignment.

---

## Final Product Understanding

The product is not only a multi-step configuration form. It is a governed forecasting-model creation and handover platform. The CoE defines the structure, data relationships, assumptions, and baseline. The forecaster receives a controlled model with clear editable boundaries. AI should reduce manual effort and guide users, while taxonomy, governance, ownership, and explicit user control remain the foundations of the workflow.
