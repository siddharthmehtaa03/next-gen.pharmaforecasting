# Modes Step: Designer Change Brief

## Context

This brief captures the specific feedback discussed for the **Modes** step in the **Daily Brainstorming Session**. It is intended to help the designer update the current prototype without changing the underlying flow unnecessarily.

## Primary design objective

Redesign the Modes step so that it is **less rigid, easier to extend, and lighter to use**. Options such as time basis and output units should be driven by configurable lists rather than permanently displayed as fixed radio-button groups.

---

## Point-by-point feedback and required changes

### 1. Replace fixed radio-button groups with dynamic selectors

**Feedback**

The current treatment appears rigid because values such as **Monthly** and **Annual** are shown as fixed radio-button options. Additional values may need to be supported later, such as **Weekly**, **Quarterly**, **Multi-year**, or other grains.

**Required design change**

- Replace fixed radio-button groups with a **dropdown, searchable select, or another compact dynamic selector**.
- Ensure the component can render additional values without redesigning the screen.
- Do not hard-code the visible layout around the current number of choices.

**Acceptance criteria**

- New options can appear in the same component without changing the page structure.
- The selected value remains clearly visible.
- The control does not become visually heavy when the list grows.

---

### 2. Apply the same scalable pattern to Output Units

**Feedback**

The rigidity concern is not limited to time basis. The current output-unit options, including **Patient**, **Patient Months**, and **Units**, may also need to support additional units in the future, such as an HCP-related unit.

**Required design change**

- Convert the Output Units control into a configurable selector using the same interaction pattern as Time Basis.
- Keep the component independent of the present number of unit options.
- Use consistent controls for similar single-select fields across the Modes step.

**Acceptance criteria**

- A fourth or later output unit can be added without altering the screen layout.
- Time Basis and Output Units use a consistent visual and interaction model.

---

### 3. Source options from a configurable list

**Feedback**

The options should behave like a list that can be updated outside the interface and then reflected in the selector, rather than requiring the product screen to be redesigned whenever an option is added.

**Required design change**

- Design the selectors as **data-driven controls**.
- Do not visually imply that the displayed choices are the complete or permanent set.
- Account for loading, empty, and unavailable-list states if these are part of the design system.

**Design note**

The prototype only needs to communicate this flexible behaviour. The technical source and refresh mechanism should be confirmed with engineering.

---

### 4. Add a Custom option for time granularity

**Feedback**

A **Custom** option was suggested so users are not restricted to predefined values. The discussion referenced allowing a custom year or month range, alongside common options such as weekly and quarterly.

**Required design change**

- Add **Custom** to the Time Basis selector.
- When Custom is selected, reveal the minimum fields needed to define the custom basis or range.
- Use progressive disclosure so the extra controls appear only when required.

**Open question for validation**

Confirm what Custom represents:

- a custom granularity, such as every six months;
- a custom date range;
- or both.

Do not finalise the field structure until this distinction is confirmed.

---

### 5. Keep the Modes step light and uncluttered

**Feedback**

The current approach was described as potentially clunky and heavy. The revised design should solve for flexibility without exposing too many controls at once.

**Required design change**

- Reduce the number of always-visible choices.
- Use compact selectors and progressive disclosure.
- Maintain clear labels and selected-state visibility.
- Avoid introducing a large configuration panel solely to solve future extensibility.

**Acceptance criteria**

- The default state is easy to scan.
- Advanced or custom inputs appear only after a relevant selection.
- The user can understand what is selected without opening every control.

---

### 6. Follow the flexible pattern used in Revenue Stream setup

**Feedback**

The Modes interaction was suggested to follow a pattern similar to the Revenue Stream setup, where users select from available values and the interface can accommodate additional values rather than presenting a static set.

**Required design change**

- Reuse the established interaction logic and component style from Revenue Stream selection where appropriate.
- Preserve consistency in dropdown behaviour, adding/selecting values, labels, spacing, and validation.
- Do not copy the complete Revenue Stream flow if a simpler single-select component solves the Modes requirement.

---

### 7. Revisit the order of mode sections

**Feedback**

A comment was made that the current list or section order should be flipped from top-to-bottom. The transcript wording around the exact labels was unclear.

**Required design change**

- Review the current section sequence in the Modes step.
- Prepare an alternate ordering in the next design iteration.
- Validate the intended priority order with the product team before finalising.

**Important**

The meeting did not clearly establish the exact final order. Treat this as an unresolved design decision, not a confirmed sequence.

---

### 8. Do not use Chat AI as the primary way to configure modes

**Feedback**

Using chat to select or add archetypes, modes, and modules was considered potentially too complex for users and for development. The feedback favoured direct UI controls for this step.

**Required design change**

- Keep mode selection and configuration available through explicit form controls.
- Do not make Chat AI the primary or required interaction for adding or selecting mode values.
- If chat remains in the overall product, position it as optional assistance rather than the core configuration path.

**Acceptance criteria**

- The Modes step is fully usable without chat.
- Users can see, select, and revise all required values directly in the interface.

---

## Recommended revised interaction

1. User enters the **Modes** step after choosing the relevant archetype.
2. Each mode attribute is presented as a clearly labelled configurable field.
3. **Time Basis** uses a dynamic single-select control.
4. Selecting **Custom** reveals the associated custom fields.
5. **Output Unit** uses the same scalable selector pattern.
6. Additional mode attributes follow the same component logic wherever possible.
7. A concise summary shows the selected configuration before the user continues.

---

## Suggested UI states to design

Prepare the following states for the next prototype iteration:

1. Default state with no selection.
2. Standard predefined value selected.
3. Selector opened with a longer list of options.
4. Custom Time Basis selected with conditional fields visible.
5. Validation state for incomplete custom inputs.
6. Long option label or newly added value.
7. Read-only summary of selected modes.

---

## Decisions captured

- Fixed radio buttons should be replaced with a more dynamic and scalable control.
- Time Basis must be able to support more than Monthly and Annual.
- Output Units must also support future values.
- Direct UI controls are preferred over making chat responsible for configuration.
- The screen should become lighter, not more complex, while adding flexibility.

## Items requiring product or engineering confirmation

- Whether Time Basis and Output Units are single-select or may support multiple selections.
- Whether Custom means a custom granularity, a custom date range, or both.
- The exact final ordering of fields or sections in the Modes step.
- Which values will be available in the first release.
- Whether authorised users can add new values in the product or values are maintained elsewhere.
- Whether Chat AI should remain as optional assistance after the direct UI is established.

## Designer hand-off checklist

- [ ] Replace fixed Time Basis radio buttons with a dynamic selector.
- [ ] Replace fixed Output Unit radio buttons with the same scalable pattern.
- [ ] Add and prototype the Custom Time Basis state.
- [ ] Use progressive disclosure for custom inputs.
- [ ] Align component behaviour with the Revenue Stream setup pattern.
- [ ] Reduce visual weight and avoid showing all options simultaneously.
- [ ] Provide an alternate section-order option for review.
- [ ] Keep Chat AI optional and separate from the core configuration flow.
- [ ] Design default, selected, custom, validation, long-list, and summary states.
- [ ] Flag unresolved product questions directly in the design file.
