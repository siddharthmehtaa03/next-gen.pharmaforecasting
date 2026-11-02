# Plan: Simplify User Flow Language

## Context
The User Flow diagram (Simple and Detailed modes) has node titles that are too technical and descriptions that don't clearly communicate *who is doing what*. Titles mix acronyms (DAG, MAT, SLA, FRC-PUB), passive system language, and numeric prefixes in a way that obscures the human action. The persona row labels exist but the node copy doesn't reinforce the actor clearly.

## Goal
Rewrite every node's `title`, `desc` (serious mode), and `childDesc` (child mode) in `SIMPLE_FLOW_NODES` and `DETAILED_FLOW_NODES` so that:
1. **Title** = short action phrase (verb + object, ≤5 words), no acronyms, no numbers
2. **desc** = one plain sentence saying who does what and why — no cryptographic hashes, no raw SLA numbers, no system-internal IDs
3. **childDesc** = one plain sentence using everyday language (keep the light tone but make it actually clarifying, not a non-sequitur baking analogy)
4. Edge/connector labels simplified to match (e.g. "Published v2.4" → "Model published")

## What to change

### File
`src/App.tsx` — `SIMPLE_FLOW_NODES` (lines ~820–1037) and `DETAILED_FLOW_NODES` (lines ~1063–~1395), plus `SIMPLE_FLOW_CONNECTORS` and `DETAILED_FLOW_CONNECTORS` connector labels.

### Rewrite table — Simple Flow Nodes

| Current title | New title | New desc (serious) | New childDesc |
|---|---|---|---|
| 1. Brand & Stream Definition | Set Up the Brand | CoE sets up the brand, indications, and any parallel country or indication tracks to forecast. | The CoE decides which products to forecast and creates a separate lane for each one. |
| 2. Archetype & Modes per Stream | Choose the Model Type | CoE picks one of six governed archetypes that best fits how the market works (share-based, patient-flow, etc.). | The CoE picks the type of math model that matches how patients use the drug. |
| 3. Review Module Graph & DAG | Review the Calculation Steps | CoE reviews how the chosen modules connect and confirms the calculation order makes sense. | The CoE checks that all the calculation steps are lined up in the right order. |
| 4. Bind Data & File Inputs | Connect the Data | CoE links live data feeds or uploads certified input files so the model has real numbers to work with. | The CoE plugs in the real-world data the model needs. |
| 5. Define Editable Bounds & UI | Set What Forecasters Can Change | CoE locks the core math and decides which levers the forecaster can adjust and how far. | The CoE decides which dials the forecaster is allowed to turn — and how far. |
| 6. Validate Parity & Publish | Publish the Model | CoE runs checks to confirm the model is correct, then publishes it for forecasters to use. | The CoE does a final check and makes the model live for the team. |
| 7. Open Published Brand Model | Open the Model | Forecaster opens the published model for their assigned brand and forecast cycle. | The forecaster opens the model built by the CoE. |
| 8. Review Actuals & Baseline | Check Recent Results | Forecaster reviews the latest sales actuals and the previously approved baseline to understand where things stand. | The forecaster checks the most recent sales data to see how the brand is tracking. |
| 9. Market Events & Permitted Dials | Adjust Assumptions | Forecaster logs any market events and tunes the assumptions they're allowed to change. | The forecaster notes anything unusual happening in the market and adjusts their assumptions. |
| 10. Multi-Scenario Trajectories | Build Scenarios | Forecaster creates a base case, upside, and downside scenario and compares the results. | The forecaster creates a few different futures — optimistic, realistic, and cautious — and compares them. |
| 11. Sensitivity & Goal Seeking | Test Key Drivers | Forecaster runs sensitivity analysis to see which assumptions matter most and back-solves for a revenue target. | The forecaster asks "what would need to be true to hit our goal?" and checks which inputs drive the outcome. |
| 12. Record Rationale & Submit | Write Up and Submit | Forecaster documents why they made any significant changes, then submits the forecast for review. | The forecaster explains their choices in writing and sends the forecast to the approver. |
| 13. Executive Audit & Lineage | Review the Forecast | Approver reviews the headline numbers, the change vs. plan, and the forecaster's written rationale. | The approver reads the final number and the forecaster's explanation. |
| 14. Sign-Off Decision | Approve or Send Back | Approver either approves the forecast or sends it back to the forecaster with revision notes. | The approver stamps it approved — or asks for changes. |
| 15. Immutable Forecast of Record | Forecast Locked | The approved forecast is locked and shared with supply chain, manufacturing, and finance. | The number is final and the rest of the business can act on it. |

### Connector label simplifications
- "Census Match" → "Archetype matched"
- "Published v2.4" → "Model published"
- "SLA < 7d" → "Data verified"
- "Package Submit" → "Forecast submitted"
- "Approved" → "Approved"
- "Revision" → "Sent back"

### Detailed flow nodes
Apply the same plain-language rewrite pattern to all ~24 nodes in `DETAILED_FLOW_NODES`. Titles stay short action phrases; descriptions stay one plain sentence. No cryptographic IDs, no raw percentages or version numbers in the node copy.

## What NOT to change
- Node IDs, positions, phases, types, dimensions — layout is untouched
- `taxonomyLink` data inside nodes
- The guided walkthrough `GUIDES` step copy (separate concern, not the flow diagram)
- `OFFICIAL_ARCHETYPES` or `OFFICIAL_MODULE_LIBRARY` data

## Verification
Open the app preview → click "User Flow" → confirm Simple mode shows plain readable titles and one-sentence descriptions in both child and serious mode → click Detailed mode and confirm the same → click a node and confirm the side-panel description is clear without jargon.
