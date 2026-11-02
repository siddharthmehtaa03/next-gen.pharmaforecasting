# Next Gen Forecasting CoE: Understanding Archetypes

## Meeting details

- **Date:** 6 October 2026
- **Time:** 5:30 PM to 6:30 PM IST
- **Meeting:** Next Gen Forecasting COE - Session - Understanding Archetypes
- **Format:** Microsoft Teams
- **Status when captured:** In progress
- **Cadence:** Weekly recurring session
- **Organizer:** Saravanan Mohanram

> **Source limitation:** The meeting was not transcribed and no meeting chat was available when this document was created. Therefore, this is not a verbatim recap. It consolidates the verified meeting context, related project material, and the working questions, insights, and persona flows developed during the call.

---

## 1. Purpose of the session

The session is intended to help the project team understand Pfizer's forecasting archetypes before translating them into platform capabilities, user journeys, screens, and workflows.

The immediate goal is to establish shared context around:

- How archetypes fit into the broader forecasting process
- The business question each archetype is designed to answer
- How users select or combine archetypes and modules
- The inputs, assumptions, calculations, and outputs involved
- What is standardized by the Forecasting CoE versus configurable by brands and markets
- How different personas create, review, approve, and consume forecasts
- How archetype and module versioning should work

---

## 2. Broader program context

The Next Gen Forecasting program is positioned as a governed enterprise forecasting platform that replaces fragmented, hand-built Excel models with:

1. A single front end for forecasting
2. A shared and governed math layer
3. A clean source for actuals and assumptions
4. A governed forecasting record

The platform is expected to support multiple forecasting contexts, including US inline, international inline, pipeline and business development, and finance planning.

Key platform components referenced in project material include:

- Governed forecasting engines and a reusable module library
- Brand and market configuration
- Scenario creation, comparison, and simulation
- Actuals versus forecast views
- Forecast summaries, waterfalls, variance, sensitivity, and diagnostic views
- Role-based user access
- Chat and agentic AI capabilities
- Versioning, lineage, override logging, and governance
- Integration between the user interface, math engines, data, and repository

---

## 3. Suggested opening statement

> Before we dive into the individual archetypes, we would like to understand the broader forecasting context: how the archetypes fit into the end-to-end process, the business decisions they support, who uses them, and how they come together to create a forecast. This will help us design the right experience and workflows around them.

---

## 4. Foundational context-setting questions

### Overall forecasting process

1. Before we go into individual archetypes, how do the archetypes fit into Pfizer's overall forecasting process?
2. What business question is each archetype designed to answer?
3. How does a user determine which archetype is appropriate for a given brand, market, or forecasting problem?
4. Can we walk through one representative brand from model selection and configuration through scenario creation, review, and submission?
5. Are archetypes used independently, or can multiple archetypes and modules be combined within one forecast?

### Standardization and configuration

6. Which parts of an archetype are standardized and governed by the CoE?
7. Which inputs, assumptions, modules, or rules can be modified for a brand or market?
8. What should be treated as configuration, and what would require a new model or workflow?
9. Which modules are mandatory for each archetype, and which are optional?
10. Where do archetypes overlap, and what criteria distinguish similar archetypes?

### Inputs, outputs, and decisions

11. What are the required inputs and assumptions for each archetype?
12. Which calculations or intermediate outputs are important for users to see and understand?
13. What final outputs does each archetype produce?
14. What business decisions are made using those outputs?
15. What supporting evidence or rationale must be captured with a forecast?

### Governance and change

16. How should archetype and module versioning work?
17. When the CoE updates an archetype or module, what happens to forecasts created with the previous version?
18. What approvals are required before a configured model can be used?
19. How should overrides and manual changes be captured and explained?
20. What evidence confirms that an archetype has been implemented correctly?

---

## 5. Key archetype clarification

A specific question requiring clarification is the relationship between **Brand Inflow-Outflow** and **Patient Flow**:

> Why is Brand Inflow-Outflow treated within Patient Flow rather than retained as a separate archetype? Does it answer the same business question at a more aggregated level, with less cohort detail, or should it remain a distinct forecasting approach?

Other archetype-level questions include:

- Is there an example of Peak-Year Sizing used together with additional modules?
- How should LES-related components that do not map one-to-one to the current module taxonomy be classified?
- What is the expected relationship between a forecasting engine, an archetype, a module, a mode, and a configured brand model?

---

## 6. High-level persona flows

The following flows are a **working design hypothesis** and should be validated with the Forecasting CoE.

### A. CoE Configurator / Model Builder

**Primary goal:** Create and govern reusable forecasting methods.

**High-level flow:**

1. Identify the forecasting business problem
2. Select or define the appropriate archetype
3. Assemble required and optional modules
4. Define calculation logic, assumptions, and business rules
5. Map source data and transformations
6. Configure brand and market variations
7. Test and reconcile outputs against reference models
8. Define permissions and governance requirements
9. Publish an approved version
10. Maintain versions and manage future changes

**Key clarification:** Which of these activities belong exclusively to the CoE, and which can be delegated to brand teams or power users?

### B. Forecaster

**Primary goal:** Develop a defensible forecast for a brand, market, and forecast cycle.

**High-level flow:**

1. Select forecast cycle, brand, market, and indication
2. Open an approved configured model
3. Review actuals, baseline assumptions, and data freshness
4. Review the system-generated baseline forecast
5. Create or clone scenarios
6. Adjust assumptions and document overrides
7. Run the model or simulation
8. Review sensitivities, diagnostics, and variances
9. Compare scenarios and select a recommended forecast
10. Submit the forecast for review or approval

**Key clarification:** What is the actual sequence followed in today's Excel process, and where does it differ by forecaster type?

### C. Approver / Reviewer

**Primary goal:** Validate the forecast and its business rationale.

**High-level flow:**

1. Receive a submitted forecast
2. Review key outputs and changes from the previous version
3. Review assumptions and overrides
4. Examine actuals versus forecast and key drivers
5. Compare scenarios and sensitivities
6. Review model lineage and supporting rationale
7. Approve, reject, or return for revision
8. Capture the decision and comments

**Key clarification:** What minimum information enables an approver to confidently sign off a forecast?

### D. Consumer / Decision Maker

**Primary goal:** Use approved forecast outputs for business planning and decision-making.

**High-level flow:**

1. Access an approved forecast
2. View summary metrics and key drivers
3. Compare brands, markets, regions, or scenarios
4. Explore trends, variances, risks, and sensitivities
5. Use outputs in finance, commercial, supply, or strategy processes
6. Export or share the approved view where required

**Key clarification:** Which decisions are made by each consumer group, and what level of detail does each group need?

### E. Platform / Data Administrator

**Primary goal:** Ensure reliable access, data, environments, and integrations.

**High-level flow:**

1. Provision users and role-based access
2. Connect approved data sources
3. Monitor data refreshes and quality
4. Maintain environments and integrations
5. Support releases and configuration deployment
6. Investigate access, data, or platform issues
7. Maintain audit and operational records

**Key clarification:** Where does platform administration end and CoE model governance begin?

---

## 7. Cross-persona end-to-end flow

A simplified end-to-end journey can be framed as:

1. **Define:** CoE defines the archetype, modules, rules, and governance.
2. **Configure:** The archetype is configured for a brand, market, and use case.
3. **Forecast:** The forecaster reviews data, adjusts assumptions, and creates scenarios.
4. **Validate:** The system and user check calculations, sensitivities, diagnostics, and variance.
5. **Review:** An approver assesses the forecast, assumptions, rationale, and lineage.
6. **Publish:** The approved forecast becomes the governed version of record.
7. **Consume:** Business users use the forecast for planning and decisions.
8. **Learn and update:** Actuals, feedback, and model changes inform the next cycle and future versions.

---

## 8. UX and service-design insights

### Insight 1: Archetype selection should be framed around business questions

Users may not naturally think in technical archetype names. The experience should help users begin with the decision or forecasting problem and then guide them toward the appropriate archetype.

**Design implication:** Explore guided selection, recommendations, examples, and eligibility rules rather than relying only on a dropdown of archetype names.

### Insight 2: Configuration and forecasting are different experiences

Building a governed model and using it to produce a forecast require different skills, permissions, and interface depth.

**Design implication:** Separate builder/configurator workflows from forecaster workflows while preserving traceability between them.

### Insight 3: Transparency is essential for adoption

Users and approvers need to understand how inputs, assumptions, modules, and overrides affect the final forecast.

**Design implication:** Provide visible lineage, assumption summaries, change history, driver decomposition, and explainability at the point of decision.

### Insight 4: Modules create flexibility but can increase complexity

A modular system enables reuse across brands and markets, but it may be difficult for users to understand which modules are required or compatible.

**Design implication:** Make module dependencies, prerequisites, compatibility, and recommended combinations explicit.

### Insight 5: Versioning affects the complete journey

Versioning is not only a technical concern. It affects model configuration, scenario creation, approvals, comparison, reproducibility, and auditability.

**Design implication:** Distinguish clearly between archetype version, module version, configured-model version, scenario version, and approved forecast version.

### Insight 6: Each persona needs a different level of detail

Configurators need model depth, forecasters need decision-oriented controls, approvers need evidence and change visibility, and consumers need concise summaries.

**Design implication:** Use role-specific views and progressive disclosure rather than exposing the same interface to everyone.

### Insight 7: The workflow must support exceptions

Forecasting is unlikely to be completely linear. Missing data, market events, assumption overrides, model exceptions, and review rework need to be supported.

**Design implication:** Capture exception paths, return-for-revision loops, override rationale, and ownership explicitly in the journey.

---

## 9. Information to capture for every archetype

Use the following template during future archetype sessions:

### Archetype name

- **Business question answered:**
- **Typical brands / markets / use cases:**
- **Primary persona:**
- **Trigger to use this archetype:**
- **Required inputs:**
- **Optional inputs:**
- **Core assumptions:**
- **Mandatory modules:**
- **Optional modules:**
- **Calculation overview:**
- **Key intermediate outputs:**
- **Final outputs:**
- **Available scenarios / simulations:**
- **User-configurable elements:**
- **CoE-governed elements:**
- **Validation and reconciliation approach:**
- **Approval requirements:**
- **Known exceptions:**
- **Versioning behavior:**
- **Reference brand or example model:**
- **Open questions:**

---

## 10. Decisions and open questions to track

### Decisions needed

- Final definition and boundaries of each archetype
- Relationship between archetypes, engines, modules, and modes
- Rules for archetype selection and combination
- CoE versus forecaster configuration rights
- Required personas for the first release
- Minimum outputs required in the initial prototype
- Versioning and backward-compatibility behavior
- Review and approval workflow
- Scope of chat and AI assistance within forecasting
- Definition of model validation and business acceptance

### Open questions

- Should the user select an archetype directly or should the platform recommend one?
- Can a forecast use more than one archetype?
- What happens when a module does not fit the standard taxonomy?
- How should older forecasts behave after an archetype or module update?
- Which calculations must be visible to users?
- Which assumptions can be edited, and by which roles?
- What is the expected relationship between baseline, named scenarios, and approved forecast?
- Which analytics belong within the forecaster workflow versus a separate analytics persona?
- What role should chat play for the forecaster and the CoE?
- Which parts of the current Excel process must be preserved, improved, or removed?

---

## 11. Recommended next steps

1. Validate the persona definitions and high-level flows with the CoE.
2. Select one representative brand and document its end-to-end forecasting journey.
3. Complete the archetype capture template for each archetype.
4. Map common versus archetype-specific steps.
5. Identify decision points, exceptions, approvals, and handoffs.
6. Translate the validated flow into a service blueprint and screen-level user journey.
7. Define the minimum prototype scope around a complete end-to-end forecast rather than isolated screens.

---

## 12. One-line synthesis

The core design challenge is to translate governed forecasting archetypes and reusable modules into role-specific workflows that remain flexible for brands and markets while preserving transparency, version control, and business confidence.

---

## 13. Live update as of 6 October 2026, 5:37 PM IST

### Meeting-source status

- The meeting was still in progress when this update was made.
- No meeting transcript was available.
- No meeting chat content was available through the meeting source.
- Because no new source-grounded discussion content was retrievable, no additional decisions, statements, or participant viewpoints have been attributed to the meeting.

### Discussion themes captured in the working conversation so far

The design team's immediate need is to use the archetype discussion to establish context, rather than move prematurely into detailed screens or functionality. The questions should help the team understand:

1. How each archetype fits into the broader forecasting process
2. The business question and decision supported by each archetype
3. How a forecaster identifies or is guided toward an archetype
4. How archetypes, engines, modules, and modes relate to one another
5. What is governed centrally versus configurable for a brand or market
6. The end-to-end journey for configurators, forecasters, approvers, consumers, and administrators
7. The inputs, assumptions, outputs, approval points, and handoffs involved
8. How exceptions, overrides, lineage, and version changes should be handled

### Refined framing for the design team

The session should be treated as an opportunity to build a shared mental model of forecasting before defining the product experience. For every archetype, the team should try to capture:

- The user and their objective
- The triggering business question
- The required inputs and assumptions
- The governed and configurable components
- The key calculation stages
- The outputs and decisions enabled
- The review and approval requirements
- The exception and revision paths
- The lineage and versioning expectations

### Refined high-level end-to-end flow

1. **Understand the forecasting need:** Identify the brand, market, lifecycle stage, forecast cycle, and business question.
2. **Determine the modelling approach:** Select or recommend the appropriate archetype, engine, and modules.
3. **Configure the model:** Apply data mappings, assumptions, rules, market-specific factors, and permissions.
4. **Create the forecast:** Load actuals and baseline values, adjust assumptions, create scenarios, and run calculations.
5. **Interpret the result:** Review key drivers, sensitivities, diagnostics, variances, and scenario comparisons.
6. **Review and refine:** Validate the business rationale, return for changes where required, and document overrides.
7. **Approve and publish:** Confirm the governed forecast version and make it available as the approved record.
8. **Consume and learn:** Use outputs in business planning, compare forecast against actuals, and feed learning into the next cycle.

### Priority questions for the remainder of the session

If time is limited, prioritize these questions:

1. Can you walk us through one actual brand from selecting an archetype to producing and approving its forecast?
2. What business question should lead a user to each archetype?
3. What is standardized by the CoE, and what can a forecaster change?
4. Can archetypes and modules be combined, and what determines valid combinations?
5. What does each persona need to see, do, and hand off to the next persona?
6. What information gives an approver confidence that the forecast is valid?
7. What happens to existing forecasts when an archetype or module is updated?
8. What must the first prototype demonstrate end to end for the CoE to consider it directionally correct?

### Current synthesis

The experience should not begin with screens or a list of technical archetypes. It should begin with the user's forecasting objective and guide each persona through a governed but flexible path from business question to approved forecast.
