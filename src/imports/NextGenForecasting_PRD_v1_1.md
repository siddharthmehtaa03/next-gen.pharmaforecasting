# Product Requirements Document (PRD)

# Next Gen Forecasting Platform

## Version
v1.1

## Date
06 October 2026

## Executive Summary

Next Gen Forecasting is a governed enterprise forecasting platform that standardizes forecasting across brands, markets, and business units. The platform replaces fragmented Excel-based forecasting processes with a centralized experience that combines governed forecasting engines, modular forecasting archetypes, scenario planning, role-based workflows, analytics, and AI-assisted forecasting.

The platform enables users to move from a business question to an approved forecast through a governed workflow while maintaining transparency, reproducibility, lineage, and version control.

---

# Problem Statement

Current forecasting processes are characterized by:

- Independent Excel models
- Limited standardization
- Difficult collaboration across teams
- Manual scenario creation and comparison
- Low transparency into assumptions and overrides
- Limited governance and auditability
- Difficulty scaling forecasting methodologies across brands and markets
- Lack of a centralized forecasting system of record

The organization requires a unified forecasting platform that supports multiple forecasting approaches while maintaining governance and flexibility.

---

# Product Vision

Create a single forecasting platform where:

- Forecasting methods are governed centrally.
- Forecasts are configurable by brand and market.
- Users can generate, compare, validate, and approve forecasts.
- Business and technical users operate through role-specific experiences.
- AI assists users throughout the forecasting lifecycle.
- Every forecast remains traceable and reproducible.

---

# Business Goals

## Goal 1
Reduce dependency on spreadsheet-based forecasting.

## Goal 2
Standardize forecasting methodologies through reusable archetypes and modules.

## Goal 3
Improve forecast transparency and explainability.

## Goal 4
Accelerate forecasting cycle times.

## Goal 5
Provide a governed system of record for forecasting activities.

---

# Users and Personas

## 1. CoE Configurator

Responsible for:

- Archetype creation
- Module configuration
- Governance rules
- Version management
- Model publication

Success Metric:

Ability to build and deploy reusable forecasting configurations.

---

## 2. Forecaster

Responsible for:

- Creating forecasts
- Managing assumptions
- Running scenarios
- Comparing outcomes
- Submitting forecasts

Success Metric:

Ability to create a forecast without manual spreadsheet dependencies.

---

## 3. Approver

Responsible for:

- Validating business rationale
- Reviewing assumptions
- Reviewing variances
- Final sign-off

Success Metric:

Ability to confidently approve forecasts with complete transparency.

---

## 4. Consumer

Responsible for:

- Reviewing approved forecasts
- Supporting planning decisions
- Monitoring trends and performance

Success Metric:

Easy access to trusted forecasts.

---

## 5. Administrator

Responsible for:

- User access
- Platform configuration
- Integrations
- Data management

Success Metric:

Stable operation and access control.

---

# Core Concepts

## Forecasting Archetype

A standardized forecasting methodology designed to answer a specific business question.

Examples:

- Patient Flow
- Prevalence Share
- Inflow-Outflow
- Rx Growth / Share
- Trend + Backsolve
- Peak Year Sizing

## Module

Reusable forecasting building blocks attached to archetypes.

## Engine

Governed calculation engine that executes forecasting logic.

## Scenario

A forecast variation based on a set of assumptions.

Examples:

- Base
- Upside
- Downside
- Custom

---

# End-to-End User Journey

## Stage 1: Define Forecasting Need

User identifies:

- Brand
- Market
- Forecast period
- Business objective

Output:

Forecasting intent established.

---

## Stage 2: Select Forecasting Approach

System recommends:

- Archetype
- Engine
- Modules

Output:

Forecast configuration established.

---

## Stage 3: Configure Model

Users:

- Load actuals
- Configure assumptions
- Configure modules
- Define overrides

Output:

Executable forecast model.

---

## Stage 4: Create Forecast

Users:

- Run calculations
- Create scenarios
- Simulate outcomes

Output:

Draft forecast.

---

## Stage 5: Analyze Results

Users review:

- Variance
- Waterfalls
- Forecast summaries
- Diagnostics
- Sensitivities

Output:

Refined forecast.

---

## Stage 6: Review and Approve

Approvers:

- Validate assumptions
- Review rationale
- Review lineage

Output:

Approved forecast.

---

## Stage 7: Publish and Consume

System:

- Publishes approved forecast
- Maintains version history
- Makes forecast available to stakeholders

Output:

Forecast of record.

---

# Functional Requirements

## FR-01 Archetype Management

Platform must allow:

- Creation of archetypes
- Editing archetypes
- Retirement of archetypes
- Version management

## FR-02 Module Library

Platform must support:

- Reusable modules
- Module dependencies
- Module assignment to archetypes

## FR-03 Forecast Creation

Platform must allow:

- Forecast generation
- Assumption modification
- Override management

## FR-04 Scenario Planning

Platform must support:

- Multiple scenarios
- Side-by-side comparison
- Scenario cloning

## FR-05 Forecast Analytics

Platform must provide:

- Waterfalls
- Variance analysis
- Forecast summaries
- Diagnostics
- Sensitivity analysis

## FR-06 Governance

Platform must support:

- Audit logs
- Version history
- Approval workflow
- Role-based permissions

## FR-07 AI Assistant

Platform should support:

- Forecast explanation
- Assumption recommendations
- Scenario generation assistance
- Forecast summarization

## FR-08 Collaboration

Platform should support:

- Comments
- Review workflows
- Notifications

---

# Non-Functional Requirements

## Security

- Role-based access control
- Auditability
- Data governance

## Reliability

- High availability
- Forecast reproducibility

## Performance

- Fast scenario execution
- Scalable forecasting engine execution

## Explainability

- Forecast traceability
- Assumption transparency
- Override visibility

---

# MVP Scope

Included:

- Archetype management
- Forecaster workflow
- Scenario planning
- Forecast comparison
- Role-based access
- Approval workflow
- Forecast versioning
- Forecast summary dashboards

Excluded:

- Advanced voice experiences
- Full agent autonomy
- Large-scale automation workflows

---

# Open Questions

1. How should archetypes be recommended to users?
2. Can multiple archetypes be composed together?
3. What versioning strategy should apply to existing forecasts?
4. Which modules are mandatory versus optional?
5. What level of forecast explainability is required for approvals?
6. What should be the role of AI in decision-making versus user assistance?

---

# Success Metrics

## Adoption

- % forecasts created in platform vs Excel

## Efficiency

- Forecast creation time reduction

## Governance

- Forecasts with full lineage
- Approved forecast audit coverage

## User Experience

- Forecaster satisfaction
- Approver satisfaction

## Quality

- Forecast reproducibility
- Reduced forecast review cycles

---

# Product Principle

The platform should guide users from a business question to an approved forecast through a governed, transparent, and repeatable process rather than forcing users to understand forecasting complexity upfront.

---

# Workflow and Dashboard Lifecycle Model

## Product Decision

The steps displayed at the top of the dashboard must represent the **lifecycle state of a forecast**, not a mandatory sequence of manual tasks performed by one user.

A forecast may move across multiple personas, system processes, governed calculations, and AI-assisted actions. The lifecycle rail must therefore communicate:

- Where the forecast currently sits
- Which stages are complete, active, blocked, or pending
- Who or what owns the current stage
- What user decision or action is required next
- Which stages were completed automatically by the platform

The lifecycle must not imply that every visible stage is manually completed by the signed-in user.

## Proposed Forecast Lifecycle

1. **Business Need**
2. **Model Configuration**
3. **Scenario Planning**
4. **Forecast Generation**
5. **Validation**
6. **Review**
7. **Approval**
8. **Publish**

## Persona and System Ownership

### Business Need

- **Primary owner:** Forecaster or business user
- **User responsibility:** Define the brand, market, forecast cycle, and business objective
- **System responsibility:** Use available context to guide the setup process

### Model Configuration

- **Primary owner:** CoE Configurator or Model Builder
- **User responsibility:** Review and confirm the applicable archetype, modules, assumptions, and rules
- **System or AI responsibility:** Recommend an archetype, suggest modules, pre-populate approved configuration, and identify missing requirements

### Scenario Planning

- **Primary owner:** Forecaster
- **User responsibility:** Create, adjust, and compare meaningful scenarios
- **System or AI responsibility:** Generate a baseline, support scenario cloning, recommend assumption ranges, and flag inconsistent assumptions

### Forecast Generation

- **Primary owner:** Governed calculation engine
- **User responsibility:** Initiate or confirm the forecast run when required
- **System responsibility:** Execute calculations, preserve inputs and configuration, and record the model and module versions used

### Validation

- **Primary owner:** Forecaster with platform support
- **User responsibility:** Review exceptions, diagnostics, sensitivities, and business plausibility
- **System or AI responsibility:** Reconcile outputs, run automated checks, surface anomalies, and explain important changes

### Review

- **Primary owner:** Reviewer or Approver
- **User responsibility:** Review assumptions, overrides, changes, supporting rationale, and scenario selection
- **System responsibility:** Present lineage, comparison with the previous version, unresolved issues, and submitted evidence

### Approval

- **Primary owner:** Authorized Approver
- **User responsibility:** Approve, reject, or return the forecast for revision
- **System responsibility:** Record the decision, comments, timestamp, and approved version

### Publish

- **Primary owner:** CoE or authorized publishing role, subject to workflow design
- **User responsibility:** Confirm publication where governance requires a manual checkpoint
- **System responsibility:** Publish the approved forecast as the forecast of record and make it available to authorized consumers

## Dashboard Lifecycle Rail Requirements

### FR-09 Lifecycle Progress Rail

The dashboard must show the current forecast lifecycle using a persistent progress rail.

The rail must:

- Show all applicable lifecycle stages
- Highlight the current stage
- Differentiate completed, active, pending, blocked, returned, and not-applicable stages
- Show the owner of the active stage
- Show whether a stage was completed by a user, platform process, calculation engine, or AI-assisted workflow
- Allow authorized users to open a stage and review its history, inputs, outputs, and status
- Adjust stage visibility or detail based on the signed-in persona
- Support non-linear movement, including revision and return loops
- Avoid implying that the signed-in user must perform every stage

### FR-10 Contextual Next Action

The dashboard must display a clear next-action area separate from the lifecycle rail.

The next-action area must show:

- Required action
- Responsible persona or owner
- Due status, if configured
- Blocking issues
- Required inputs or decisions
- System-generated recommendations, where available

Examples include:

- Confirm recommended archetype
- Resolve missing input data
- Review flagged assumption
- Compare submitted scenarios
- Approve or return forecast
- Publish approved forecast

### FR-11 Automated Stage Handling

The platform must support stages that are completed partially or fully through automated processes.

The platform must:

- Distinguish automated completion from user confirmation
- Require explicit human confirmation for governed or consequential decisions
- Preserve an audit record of automated actions and recommendations
- Allow users to review the basis of an automated recommendation
- Prevent AI recommendations from being presented as approved business decisions

### FR-12 Ownership and Handoffs

The platform must support handoffs between personas.

Each lifecycle stage must be able to display:

- Current owner
- Previous owner
- Required reviewer or approver
- Handoff status
- Returned-for-revision status
- Comments and supporting evidence

## Interaction Principles

1. **Lifecycle, not wizard:** The rail communicates forecast state. It is not always a linear wizard.
2. **Decision checkpoints:** Users intervene where judgment, confirmation, governance, or approval is required.
3. **Automation with visibility:** System and AI actions should reduce manual effort but remain transparent.
4. **Role-specific relevance:** Each persona sees the stages and actions relevant to their responsibility.
5. **Re-entry and revision:** Users can revisit earlier stages when a forecast is returned or assumptions change.
6. **Traceability:** Every transition must preserve ownership, rationale, inputs, outputs, and version history.

## Updated AI Assistant Requirement

AI assistance should support the lifecycle by:

- Interpreting the user's forecasting objective
- Recommending an archetype and module combination
- Pre-populating approved configurations
- Generating baseline and alternative scenarios
- Explaining forecast movements and key drivers
- Identifying missing inputs, anomalies, and assumption conflicts
- Summarizing the forecast for reviewers and consumers

AI must not independently approve or publish a forecast unless a future governance decision explicitly permits that behavior. Human accountability must remain visible at decision and approval checkpoints.

## Updated MVP Scope

The MVP should include:

- A lifecycle progress rail
- Persona-based stage ownership
- Contextual next actions
- Clear status and blocking indicators
- Manual and automated stage attribution
- Return-for-revision loops
- Audit history for lifecycle transitions
- Human confirmation for approval and publication checkpoints

The MVP does not need fully autonomous lifecycle orchestration. It should establish the workflow model and allow later releases to automate more activities without redesigning the dashboard structure.

## Acceptance Criteria

1. A forecaster can immediately identify the current state of a forecast and the next action required.
2. The dashboard does not imply that the forecaster owns configuration, approval, and publication activities.
3. An approver can identify what requires review without navigating through forecaster setup tasks.
4. A consumer can view an approved forecast without seeing irrelevant creation steps as required actions.
5. Automated calculations and AI-supported actions are visibly distinguished from human decisions.
6. A returned forecast can move back to the relevant stage while preserving its previous review history.
7. Every lifecycle transition records the actor or system, status, and associated forecast version.

## Open Questions for Validation

1. Which lifecycle stages should always be visible to every persona?
2. Which stages can be skipped or marked not applicable for specific archetypes?
3. Who has authority to publish the approved forecast?
4. Which stages require explicit human confirmation?
5. Should archetype recommendation require CoE confirmation for every forecast or only for new configurations?
6. How should due dates and service-level expectations be assigned to handoffs?
7. What information should appear when a user selects a completed lifecycle stage?
8. Should the rail display lifecycle stages only, or also show detailed tasks underneath the active stage?
