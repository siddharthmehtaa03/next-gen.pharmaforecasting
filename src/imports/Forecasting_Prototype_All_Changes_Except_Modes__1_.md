# Forecasting Prototype: Consolidated UX Change Brief

## Scope

This document captures all prototype changes and clarification points discussed in the **Daily Brainstorming Session**, excluding the **Modes** step because those changes have already been implemented.

The brief separates:

- confirmed changes to implement;
- items to represent carefully in the prototype;
- questions that still require client or product confirmation;
- a final reusable prompt for applying the changes consistently across the experience.

---

# 1. Landing Page and Persona Entry

## 1.1 Make each persona entry more descriptive

### Feedback

The landing page is the first screen users will see. The current persona cards need to communicate more clearly what each user can enter and accomplish.

### Required changes

- Retain the three principal pathways:
  - Configurator;
  - Forecaster;
  - Leadership.
- Add a short, action-led description to every persona card.
- Explain the primary outcome of each pathway instead of relying only on the persona title.
- Establish stronger visual differentiation between the pathways without making them feel like separate products.
- Elevate the landing page visually so it does not look like a basic navigation screen or closely resemble the reference prototype.

### Suggested card descriptions

- **Configurator:** Build, configure, govern and publish reusable forecasting models.
- **Forecaster:** Create forecasts from approved baselines, assumptions, scenarios and events.
- **Leadership:** Review consolidated forecast performance and visualisations across approved models.

### UX acceptance criteria

- A first-time user can understand where each pathway leads before selecting it.
- Persona cards have a clear title, one-line description and explicit call to action.
- The landing page feels purposeful and differentiated, not decorative.

---

# 2. Configurator Model Library

## 2.1 Add a visual summary above the model list

### Feedback

The Configurator view should surface what is important to the persona before presenting the complete list of models. A visual summary was requested above the table or list view.

### Required changes

Add a compact, actionable summary strip above the model library covering:

- active models;
- forecast priorities;
- status metrics;
- upcoming deadlines.

The discussion also referenced examples such as:

- needs attention;
- drafts and returns;
- with reviewer;
- data not current;
- live versions.

### Interaction requirements

- Summary cards should act as filters or shortcuts into the relevant model records wherever the metric maps directly to the list.
- Selecting a card must visibly update the list and show the active filter.
- Provide a clear way to reset the filtered state.
- Avoid introducing a full executive dashboard into the Configurator experience.

### UX acceptance criteria

- The summary reflects the Configurator's operational priorities.
- Every actionable status card has a clear relationship to the records below.
- Users can understand why a count matters and what they can do next.
- Forecast-versus-actual visualisations are not shown here unless they become a confirmed Configurator requirement.

---

## 2.2 Preserve the model library's operational purpose

### Feedback

The library is intended to let Configurator users see published models, work-in-progress models and interrupted drafts that may need to be resumed.

### Required changes

- Clearly distinguish model states such as:
  - published;
  - draft;
  - interrupted or resumable;
  - awaiting review, if reviewer governance is confirmed.
- Make the primary action state-aware:
  - resume for an unfinished model;
  - view for a published model;
  - continue review for a review-stage model;
  - create new model as a page-level action.
- Ensure status, current step, latest update and next action are easy to scan.
- Keep the summary strip and list complementary rather than repetitive.

---

# 3. Create New Model Entry Options

## 3.1 Remove the Excel-upload option from the new-model flow

### Feedback

The Excel-upload route was questioned because the client had previously indicated that new archetypes were not expected to be onboarded through this flow. The call concluded that Excel should be removed from the new-brand or new-model path.

### Required changes

- Remove **Upload Excel Model** from the Create New Model entry options.
- Retain the two relevant starting paths:
  - start from blank;
  - start from a published model or template.
- Do not replace Excel upload with a skill-upload option inside this flow.

### Important separation

Skill definition or upload was discussed as a separate capability and separate flow. It should not appear as part of creating a new brand model unless the product team later defines that relationship.

### UX acceptance criteria

- The user is not asked to choose an unsupported or misleading Excel route.
- The distinction between blank setup and template reuse is clear.
- No skill-related action is inserted into the new-model journey as a placeholder.

---

## 3.2 Make template reuse explicit

### Required changes

For **Start from a Published Model**:

- label the source as an approved or published model/template;
- show enough metadata for the user to choose the correct template;
- explain that the selected model will become the starting point for a new version or configuration;
- avoid implying that the original published model will be overwritten.

### Suggested metadata

- model name;
- brand or asset;
- archetype;
- geography;
- version;
- publication status;
- last updated date, if available.

---

# 4. Basic Model Setup

## 4.1 Support the agreed model-identification fields

### Required changes

The setup screen should visibly support:

- model name;
- brand name;
- asset or model type;
- therapeutic area;
- lifecycle stage.

The model or asset type examples discussed included:

- franchise;
- portfolio;
- market-level assessment;
- pipeline asset.

Lifecycle examples discussed included:

- launch;
- growth;
- mature;
- loss of exclusivity.

### UX guidance

- Use clear field labels and supporting text where domain terms may be ambiguous.
- Keep the field order aligned with the user's mental model: identify the model first, then define its business and lifecycle context.
- Use configurable selectors where the option set may expand.

---

## 4.2 Support optional forecast breakdowns

### Feedback

The flow needs to accommodate forecast breakdowns such as regions, channels, categories and subnational forecasting.

### Required changes

- Provide an optional section for selecting forecast breakdowns.
- Allow more than one breakdown where the product logic supports it.
- Make selected breakdowns visible as part of the model configuration summary.
- Do not force users to configure every possible breakdown.

### Open product question

Confirm which breakdowns are available by default and whether combinations have constraints.

---

## 4.3 Represent competing assets carefully

### Feedback

The setup discussed modelling assets that draw from the same patient pool while competing through different positioning or compositions.

### Required changes

- Include a clearly labelled option for modelling competing assets from the same patient pool.
- Use concise helper text to explain the implication before the option is enabled.
- If enabled, reveal only the fields required to identify or connect the competing assets.
- Do not expose this as a default mandatory configuration.

### Open product question

The meeting did not define the complete set of fields or rules for this capability. Treat the detailed configuration as requiring confirmation.

---

# 5. Revenue Streams

## 5.1 Allow multiple revenue streams

### Feedback

The flow must demonstrate more than one revenue stream so that subsequent archetype, module, data and forecast behaviour can be understood.

### Required changes

- Allow users to add multiple revenue streams.
- Ensure multiple streams are carried forward into later steps.
- During the demonstration, use realistic, relatable names instead of placeholders such as X, Y and Z.
- Show the relationship between each stream and its selected dimension.

### UX acceptance criteria

- Users can add, rename, duplicate and remove a stream.
- The interface clearly distinguishes one stream from another.
- Later screens preserve the same names and ordering.

---

## 5.2 Retain and clarify stream duplication

### Feedback

The copy action creates a new revenue stream using the selected stream's values and identifies it as a copy.

### Required changes

- Keep the duplicate or copy action.
- Rename the action to **Duplicate stream** if that is clearer than an icon-only treatment.
- After duplication:
  - create a separate stream record;
  - copy the selected dimension and related setup;
  - give the copy a distinguishable default name;
  - place focus on the new stream name so the user can rename it immediately.
- Add a tooltip if an icon is retained.

---

## 5.3 Clarify the Other dimension behaviour

### Feedback

When the user chooses **Other** as the stream dimension, the interface should provide a field to name the custom dimension. The existing stream name remains a separate field.

### Required changes

- Keep **Stream name** as the identifier for the revenue stream.
- When **Other** is selected under Stream dimension, reveal a separate **Custom dimension name** field.
- Do not duplicate the Stream name field.
- Use progressive disclosure and retain the custom value if the user temporarily changes the selection and returns, where technically feasible.

### UX acceptance criteria

The user can distinguish clearly between:

- what the revenue stream is called;
- which dimension structures the stream;
- the name of a custom dimension when Other is selected.

---

# 6. Archetype Assignment

## 6.1 Carry revenue streams into archetype selection

### Required changes

- Display the actual revenue-stream names created in the previous step.
- Allow an archetype to be selected for each stream.
- Retain an **Apply to all streams** action where the same archetype is intended across all streams.
- Clearly show whether an archetype was individually selected or inherited through Apply to all.

### UX acceptance criteria

- Users can review the stream-to-archetype mapping at a glance.
- Applying one archetype to all streams does not obscure the ability to modify an individual stream afterwards, if the product supports overrides.
- Placeholder stream names are removed from the client demo.

---

# 7. Module Selection and Model Flow

## 7.1 Update the model-flow visual dynamically

### Feedback

The model flow must update based on the modules selected by the user. The existing prototype had an incomplete or incorrect visual in this area.

### Required changes

- Generate or update the model-flow visual as modules are selected or removed.
- Present the flow in a clear top-to-bottom sequence.
- Reflect the correct relationship between the selected archetype, modules and downstream steps.
- Remove random, unrelated or placeholder nodes currently appearing in the flow.
- Use the same model-flow representation consistently in:
  - module selection;
  - review;
  - any later summary where the configured model is represented.

### Interaction requirements

- Selecting a module updates the flow without requiring the user to leave the step.
- Removing a module removes it from the flow after appropriate confirmation if dependencies exist.
- The selected module and its corresponding node can be visually related.
- Long flows remain legible through scrolling, collapsing, zooming or sectioning without reducing text to unreadable sizes.

### UX acceptance criteria

- The flow is an accurate reflection of the configuration, not a decorative diagram.
- The visual has a clear start, sequence and end.
- Repeated modules or branches are labelled unambiguously.

---

# 8. Bind Data and Governance

## 8.1 Resolve whether users select sources or only review bindings

### Feedback

The call identified a conflict between two reference prototypes:

- one suggested that users select input data sources;
- another appeared to show governed sources that users review without selecting them.

### Required prototype treatment

Until confirmed, do not present the interaction as a finalised product decision.

Prepare one primary flow and document the alternative:

### Option A: User selects governed sources

- Show available governed sources for each revenue stream.
- Provide an explicit selection control.
- Allow users to test or validate the connection.
- Show the selected sources before proceeding.

### Option B: Sources are automatically bound

- Present the sources as a review list rather than selectable inputs.
- Explain that the platform has fetched or bound governed sources.
- Let users inspect source information and connection status, then continue.

### Required client question

Confirm whether Configurator users actively choose data sources or only review automatically bound sources.

---

## 8.2 Remove Owner and Confidence as user-input fields

### Feedback

Owner and Confidence were challenged and should not appear as ordinary user-input fields. Confidence was reframed as a possible data-quality output rather than a manual selection.

### Required changes

- Remove **Owner** from the current table unless a clear downstream purpose is confirmed.
- Remove **Confidence** as a manually editable field.
- If a quality indicator is retained, relabel it as **Data quality** and display it as a system-generated assessment only when the underlying mechanism is confirmed.
- Do not show unsupported High, Medium or Low values merely as placeholders.

---

## 8.3 Improve source information shown in the table

### Feedback

Instead of unsupported owner and confidence fields, the table should provide useful information about each dataset.

### Required changes

Keep or prioritise fields such as:

- input source;
- latest refresh;
- connection or test status.

Consider including one of the following only if supported:

- row count;
- dataset description;
- metadata summary;
- AI-generated explanation of what the dataset contains and where it may be used.

### Important qualification

The call did not finalise which replacement metadata will be technically available. Do not present row count, AI summary or data quality as confirmed until engineering or product validates it.

---

## 8.4 Make binding behaviour explicit per revenue stream

### Required changes

- Use the actual revenue-stream names instead of X, Y and Z.
- Clearly show whether each source applies to:
  - one stream;
  - multiple selected streams;
  - or all streams automatically.
- If all available data is incorporated automatically, remove controls that imply manual multi-selection.
- If users choose sources, use explicit checkboxes, selection states or another clear pattern rather than ambiguous rows.
- After testing, provide a visible success, warning or failure state.

### UX acceptance criteria

- Users can tell what has been connected.
- Users can tell which revenue stream receives which data.
- Users can distinguish review-only information from editable controls.

---

# 9. Assumptions

## 9.1 Differentiate locked and editable assumptions

### Feedback

Some assumptions may be locked by the Centre of Excellence because they are treated as high-confidence or governed values, while other assumptions remain available to Forecasters.

### Required changes

- Clearly distinguish locked assumptions from editable assumptions.
- Explain why a value is locked and who governs it.
- Do not use disabled styling alone; pair it with a lock indicator and explanatory text or tooltip.
- Ensure locked values remain readable.
- Show how editable assumptions will be consumed by the baseline forecast.

### Open product question

Confirm which persona can lock or unlock assumptions and whether that action occurs in this flow.

---

# 10. Baseline Forecast

## 10.1 Replace the bar chart with a line chart

### Feedback

A line chart was identified as the more familiar representation for forecasting and as a better way to compare multiple revenue streams over time.

### Required changes

- Replace the current bar chart with a multi-series line chart.
- Use a distinct but accessible colour for each revenue stream.
- Use the actual stream names in the legend and tooltips.
- Ensure the chart supports comparison across the same time axis.
- Keep stream colours consistent across the remainder of the workflow.

### UX acceptance criteria

- All configured revenue streams are represented.
- The time period and measure are labelled clearly.
- Tooltips identify stream, period and value.
- The chart remains readable when three or more streams are present.
- Colour is not the only means of distinguishing series.

---

# 11. Review Step

## 11.1 Replace placeholder content with the configured model flow

### Feedback

The review screen was showing unrelated or randomly generated content where the model flow should appear.

### Required changes

- Remove unrelated placeholder cards, nodes and text.
- Show the same dynamically generated model-flow visual used earlier.
- Summarise the user's selections across:
  - model setup;
  - revenue streams;
  - archetypes;
  - modules;
  - data bindings;
  - assumptions;
  - baseline output.
- Provide Edit links that return users to the relevant step without discarding other completed work.

### UX acceptance criteria

- Every review item corresponds to an earlier user selection or system output.
- The model flow shown is current and internally consistent.
- Users can identify incomplete or invalid sections before publishing.

---

# 12. Publish and Assign

## 12.1 Clarify rollout scope

### Required changes

The publishing flow should make visible how a model is rolled out across:

- geographies;
- planning cycles;
- assigned Forecasters;
- version or release information.

If the Configurator may also act as a Forecaster, allow self-assignment only if this is a supported rule.

### Open questions

- Is the same flow applicable to US, international and VDI contexts?
- Does international forecasting require a separate persona or separate workflow?
- Are US and international model libraries isolated from each other?
- What permissions control cross-geography visibility?

Do not hard-code geography-specific access rules until these questions are answered.

---

## 12.2 Clarify whether a reviewer or approval step is required

### Feedback

A possible reviewer or super-user role within the Centre of Excellence was discussed, but the need for a formal approval step was not confirmed.

### Required changes

- Do not present formal approval as confirmed unless validated with the client.
- Prepare the flow so an approval stage can be introduced without restructuring the complete journey.
- If represented in the prototype, label it clearly as a point for discussion.

### Client questions

- Must every configured model be reviewed before publication?
- Who acts as reviewer?
- Can the creator also publish?
- What happens when a model is returned for changes?
- Does the reviewer belong to the same persona or a separate super-user persona?

---

## 12.3 Retain publication notes as version notes

### Feedback

The notes entered during publication are intended to appear in the model's audit trail with information about who made the change and when.

### Required changes

- Relabel the field as **Version notes** or **Release notes**.
- Add helper text explaining that the notes will appear in version history or the audit trail.
- Keep the field close to version and publication details.
- Show the notes in the model's history after publication.
- Do not position the field as a message to assigned users unless that additional purpose is confirmed.

---

# 13. Back in the Model Library

## 13.1 Make publication outcomes visible

### Required changes

After publication:

- return the user to the Model Library or provide a direct route back;
- show the newly published model or version in the list;
- surface its publication status, version and rollout scope;
- make the history or audit trail accessible;
- show the entered version notes in the relevant history entry;
- preserve the model's actual name rather than a placeholder.

---

# 14. Demo and Prototype Content Quality

## 14.1 Remove placeholder terminology

### Required changes

Replace prototype placeholders such as:

- X, Y and Z revenue streams;
- generic model names;
- random model-flow content;
- unexplained sample data.

Use coherent examples throughout the journey so that:

- revenue-stream names remain consistent across all steps;
- archetypes and modules map logically to those streams;
- the baseline chart uses the same streams;
- the review and publish screens reflect the same configuration.

---

## 14.2 Use the template path for the client demonstration

### Feedback

Using an existing template was suggested for the demonstration because it can pre-populate fields and avoid spending the session manually configuring every setup input.

### Required changes

- Prepare a realistic published-model template for the demo.
- Pre-populate the relevant setup, streams, archetypes, modules, data and assumptions.
- Ensure all pre-populated values remain editable where the product permits.
- Use the shortened configuration journey for the demo without implying that the omitted steps do not exist.

---

# 15. Prioritised Implementation Checklist

## Must implement before the next prototype review

- [ ] Improve landing-page persona descriptions and visual hierarchy.
- [ ] Add an actionable visual summary above the Configurator model list.
- [ ] Remove Excel upload from Create New Model.
- [ ] Keep skill upload out of the new-model flow.
- [ ] Retain blank and published-template starting paths.
- [ ] Replace X, Y and Z with realistic revenue-stream names.
- [ ] Support multiple revenue streams.
- [ ] Clarify Duplicate stream behaviour.
- [ ] Show Custom dimension name only when Other is selected.
- [ ] Carry stream names into archetype assignment and later steps.
- [ ] Update the model-flow visual based on selected modules.
- [ ] Remove incorrect or random flow content.
- [ ] Clarify data-binding interaction as either selection or review, and mark it for confirmation.
- [ ] Remove Owner and editable Confidence fields.
- [ ] Use line charts for baseline forecast comparison.
- [ ] Show the configured model flow on the Review step.
- [ ] Relabel publication notes as Version notes or Release notes.
- [ ] Ensure the published version and audit trail are visible from the library.

## Requires confirmation before final implementation

- [ ] Whether users select data sources or review automatic bindings.
- [ ] Which replacement dataset metadata is technically available.
- [ ] Whether a system-generated data-quality rating is available.
- [ ] Whether the model requires formal reviewer approval.
- [ ] Reviewer persona, permissions and return-for-change behaviour.
- [ ] US, international and VDI workflow differences.
- [ ] Cross-geography visibility and governance.
- [ ] Competing-asset configuration details.
- [ ] Who can lock or unlock assumptions.
- [ ] Whether Configurators can assign themselves as Forecasters.

---

# 16. Consolidated UX Prompt for Updating the Prototype

Use the following prompt after adding the functional changes above to ensure that the overall experience is coherent, scalable and presentation-ready.

```text
Refine the complete forecasting-platform prototype as a cohesive enterprise workflow for Configurator, Forecaster and Leadership users. Apply the requested functional changes without redesigning the product into disconnected screens.

Overall UX principles

1. Create one consistent workflow
- Preserve a clear progression from persona selection to model library, model setup, revenue streams, archetypes, modules, data binding, assumptions, baseline creation, review, publish and version history.
- Keep names, statuses, selected values and colour assignments consistent across every step.
- Do not introduce screen-level interactions that contradict earlier selections.

2. Prioritise clarity over visual density
- Use a strong information hierarchy with a clear page title, concise context, primary task area and obvious next action.
- Reduce decorative elements that do not support a user decision.
- Use progressive disclosure for advanced, optional or conditional inputs.
- Avoid displaying every option and every explanation at once.

3. Design for configurability and scale
- Use data-driven selectors for option sets that may grow.
- Ensure the layout can accommodate longer labels, additional options, multiple revenue streams and more complex model flows.
- Avoid hard-coded UI patterns that require a layout redesign when a new value is introduced.

4. Make system behaviour transparent
- Clearly distinguish editable fields, system-generated values, governed values, read-only information and unresolved placeholders.
- Explain why a value is locked, where system information comes from and what will happen after a user action.
- Do not style review-only rows as editable inputs.
- Do not show unsupported confidence scores, owners, metrics or statuses as if they are final product data.

5. Make actions specific and state-aware
- Use explicit labels such as Create model, Resume configuration, Duplicate stream, Test connection, Review model, Publish version and View history.
- Avoid ambiguous icon-only actions. Add labels or tooltips when necessary.
- Keep one clear primary action per screen and visually subordinate secondary actions.

6. Provide immediate and visible feedback
- Show loading, success, warning, error, empty and validation states for important interactions.
- When a summary card filters a list, display the active filter and provide a reset action.
- When modules change, update the model-flow visual immediately.
- When data is tested, show the result next to the relevant source.
- When a model is published, show the resulting version, status and audit-trail entry.

7. Use accessible enterprise UI patterns
- Maintain readable typography, adequate contrast, visible focus states and keyboard-compatible controls.
- Do not rely on colour alone to communicate model status, validation or chart series.
- Keep touch targets and action spacing sufficient even though the prototype is desktop-first.
- Use concise helper text and reserve tooltips for supplementary information.

8. Maintain visual consistency
- Use a consistent grid, spacing system, field height, card treatment, table density, icon style and border radius across the prototype.
- Reuse the same component for the same interaction type.
- Keep revenue-stream colours consistent in mappings, flows, charts and review summaries.
- Avoid making the Configurator library look like an executive analytics dashboard.

9. Improve information architecture
- Group inputs by user intent rather than implementation structure.
- Keep model identity, business context, forecast structure, data, assumptions and publication details in distinct sections.
- Provide a persistent step indicator for the multi-step configuration flow.
- Preserve completed-step data when users navigate backwards to edit.

10. Design the review and governance experience carefully
- Summarise only values that were selected, entered or generated earlier in the workflow.
- Provide direct Edit links to the relevant step.
- Use the same generated model-flow visual in configuration and review.
- Present Version notes as part of the publication record and audit trail.
- Treat reviewer approval, geography permissions and source-selection behaviour as configurable or pending decisions until confirmed.

Screen-specific requirements

- Landing page: clearly explain what Configurator, Forecaster and Leadership users can accomplish.
- Model Library: add an actionable visual summary for active models, priorities, statuses and upcoming deadlines, with cards filtering the list where relevant.
- Create New Model: provide Start from blank and Start from published model/template. Remove Excel upload and do not include skill upload in this flow.
- Model Setup: support model name, brand, asset/model type, therapeutic area, lifecycle stage, optional breakdowns and the competing-assets option.
- Revenue Streams: support multiple streams, meaningful names, duplication and a conditional Custom dimension name when Other is selected.
- Archetypes: map each named revenue stream to an archetype and provide Apply to all streams.
- Modules: ensure selections update a legible top-to-bottom model-flow visual.
- Bind Data: clearly represent either user selection of governed sources or review of automatically bound sources. Do not mix both interaction models. Remove Owner and editable Confidence.
- Assumptions: clearly distinguish governed locked assumptions from editable values.
- Baseline: use an accessible multi-series line chart with consistent revenue-stream colours and clear labels.
- Review: remove placeholder content, show the current model flow and summarise all earlier choices with Edit links.
- Publish: show geography, planning cycle, assignees, version details and Version notes. Represent approval as pending confirmation unless validated.
- Model History: show version, publisher, date, rollout scope and Version notes in the audit trail.

Content rules

- Replace X, Y, Z and random placeholder content with coherent, realistic examples.
- Use concise domain language and avoid technical jargon where a business term is available.
- Use sentence case for headings, labels and actions.
- Ensure all sample values remain consistent from setup through publication.

Final quality check

Before completing the prototype, verify that every screen has a clear purpose, every primary action has a visible outcome, every editable control looks editable, every read-only value looks read-only, every status is explained, and all data shown in Review and History can be traced to an earlier selection or system event.
```

---

# 17. Final Design Review Criteria

Before sharing the updated prototype, verify:

- [ ] No Modes-step changes have been reintroduced or overwritten.
- [ ] No Excel-upload or skill-upload action appears in Create New Model.
- [ ] Revenue-stream names are realistic and consistent across the flow.
- [ ] The model-flow visual responds to module selections.
- [ ] Data-binding controls do not imply both automatic and manual binding simultaneously.
- [ ] Owner and editable Confidence are removed from the source table.
- [ ] The baseline is represented as a line chart.
- [ ] Review contains real configuration data rather than placeholders.
- [ ] Version notes clearly feed the audit trail.
- [ ] Pending client decisions are labelled and are not presented as confirmed functionality.
- [ ] Landing, library, setup, review and publish screens use one coherent visual system.
