# v183: Finish separating COE AI and Forecast AI

Source brief: `Next_Gen_Forecasting_Targeted_UX_Changes.md`. Core principle: **don't design this as two versions of the same chatbot.**

## Where things stand (already in `11c881d`, no rework needed)
- Persona labels and purposes: `COE_AI` (`src/App.tsx` `AI_EXP.build`) and `FORECAST_AI` (`src/forecaster/ForecasterChat.tsx`). Nav entries are "Build & Configure" (CoE) and "Ask & Understand" (Forecaster).
- Scope guards: Forecast AI refuses config (`CONFIG_Q`), edits (`EDIT_Q`), restricted or blocked brands (`RESTRICTED_Q`, `fcBlocked`) and brands with nothing submitted. COE AI refuses restricted partitions (`RESTRICTED_RE`).
- Answers include citations (`AskAnswer` in `src/chat/ChatShell.tsx`). There are no manual source pickers, and the forecast is chosen from the question.
- Model flow visual in Review. COE AI fills steps up to Review and never finalises.

## What's left
1. **Grounding is a static map that doesn't match the rest of the app.** `APPROVED` in `ForecasterChat.tsx` is hardcoded and ignores submissions made in the workspace.
2. **Both experiences use the same shell, look and empty state.** Only the persona pill and copy differ.
3. **Role access is enforced but not visible.** Users can't see what scope they're in.
4. **Forecast AI can still render write controls.** `FCard` `event` (Draft event with Save) and `goal` (goal seek) are unreachable through the guards, but still rendered.

## Decisions (defaults used because the questions were skipped)
- **Grounding source:** use one seeded **published-forecast registry** that updates live. When a forecaster confirms a submit in the workspace, a new version is written to the registry, and Forecast AI answers from it straight away. Drafts are never written to it.
- **Visual distinction:** keep the unified green Charles branding the user asked for earlier. Separate the two through **layout, header, empty state and composer**, not colour:
  - COE AI is a **workbench**: a green-tinted "Model configuration mode" header band, step progress, and the split sandbox showing the live model flow and build cards.
  - Forecast AI is a **briefing desk**: a neutral white surface, a grounding bar above the thread, answers inline with no sandbox split, citation footers, and no write cards.

## Implementation

### 1. Published-forecast registry (new `src/forecaster/published.ts`)
- Move `Approved`, `APPROVED`, `approvedOf` and `approvedLabel` out of `ForecasterChat.tsx`. Rename to `Published`, `SEED_PUBLISHED`, `publishedOf(id, reg?)` and `publishedLabel`, and keep re-exports of the old names from `ForecasterChat.tsx` so existing imports still compile.
- Type: `Published = { cycle; version; state: 'Approved' | 'Submitted'; date; by; scenario?: string }`. Registry type: `Record<string, Published | null>`.
- Make the seed match the homepage `BRANDS` statuses in `workspace/Home.tsx`:
  - Corvane (Submitted, Q3 reforecast): `v4 Submitted`.
  - Vyndaq (In review, AOP 2027): `v2 Submitted`.
  - Nurtec, Lumera and Halden: prior-cycle `Approved` (Q2 2026 reforecast), since the current AOP 2027 work is still a draft.
  - Zavzpret: `null`.
- State lives in `App.tsx`: `const [published, setPublished] = useState(SEED_PUBLISHED)`.
- `forecastAnswer(text, brandId, insights, opts)` takes `opts.published`, which falls back to the seed. Replace every internal `approvedOf(...)` with a lookup in this registry. `ForecasterChat` (new `published` prop) and the collapsed top-bar `Charles persona="ask"` respond handler (App.tsx ~951) both pass it in.
- Live write: add an `onPublished?: (brandId: string, scenario: string) => void` prop to `Forecaster`, then pass it down to the workspace. Call it where the submit is confirmed (`Forecaster.tsx` ~310–313, next to `onSaved(... submitted: true)`). App sets `published[brandId] = { cycle: brand.cycle, version: 'v' + (n+1), state: 'Submitted', date: today, by: ME, scenario }`. Version numbers go up within the same cycle; a new cycle starts at `v1`.
- Copy: the grounding bar and citations read "<Brand> <cycle> <version> · Submitted, in review / Approved". The `fc` citation `meta` shows that state.

### 2. Forecast AI briefing-desk layout
- `ChatShell` gets an optional `variant?: 'workbench' | 'briefing'` prop (default `'workbench'`, so COE AI layout is unchanged). With `'briefing'`:
  - The sandbox split is never shown (`split = false`), and any card renders inline under its answer.
  - A sticky **grounding bar** sits above the thread and the empty state, built from a new `grounding?: ReactNode` prop. It shows the "Answering from" badge (currently the composer `context` chip, which moves here), plus the access chip (section 4).
  - The empty state shows the persona pill, the purpose line and **"Questions people ask"** as a list of short rows (question text plus arrow) instead of the six-card grid. It uses the same `cards` data with a different render.
  - Answer bubbles use a white card with a thin border, and citation pills form a footer row ("Cited: …"), reusing `AskAnswer`.
  - The composer has no context chip and keeps the placeholder "Ask a business question about the submitted <Brand> forecast".
- `ForecasterChat` passes `variant="briefing"`, `grounding={…}`, and no `context`.

### 3. COE AI workbench header
- With `'workbench'` plus a `persona`, `ChatShell` shows a slim green-tinted header band above the thread: the persona icon and label, the "Model configuration mode" tag, and, once a build is running, `Model build · step n of 7` (from `th.build`, passed in through a new `status?: string` prop from `CoeChat`). The empty state keeps its card grid.

### 4. Role access made visible
- Access chip in the Forecast AI grounding bar: `ShieldCheck` with "Your access · {n} forecasts". Clicking it opens a small popover listing the accessible brands, then the blocked ones (`fcBlocked`, already computed in App) with a "Restricted" tag, plus the line "Forecast AI only reads forecasts your role can access." `ForecasterChat` gets `access={{ allowed: string[]; blocked: string[] }}` from App.
- COE AI header band: a matching small chip, "Restricted partitions hidden", with a tooltip. Display only; enforcement stays as it is now.
- Add the `access` citation to normal Forecast AI answers too (refusals already cite it), so every answer shows the role check as evidence.

### 5. Remove write controls from Forecast AI
- In `ForecasterChat.tsx`, remove the `event` and `goal` variants from `FCard`, along with their `ChatCard` branches, `CARD_TITLE`, `FC_TAKE` and `FC_SRC` entries, and any `reply()` branches that produce them (they sit behind `EDIT_Q` already). Also remove imports that become unused. "Save to Insights" stays on bridge, compare and brief cards. That counts as annotation, not a forecast edit.

## Out of scope (open questions in the brief; do not build)
AI rationale for configuration choices, data-availability checks before archetype recommendations, trend and analogue recommendations, leadership analytics views, LLM governance. The LLM model picker stays as it is.

## Edge cases
- If a brand with a `null` registry entry gets its first submit, it now has `v1 Submitted`, and the "nothing submitted yet" refusal no longer fires.
- A thread opened before a submit keeps its old answers. New questions use the new version, and the grounding bar updates straight away.
- Naming a blocked brand still returns the access refusal; the grounding bar keeps showing the last brand that was allowed.
- The collapsed top-bar Forecast AI panel uses the same registry, so its answers match the full page.

## Files
- New: `src/forecaster/published.ts`
- Edit: `src/forecaster/ForecasterChat.tsx`, `src/chat/ChatShell.tsx`, `src/App.tsx` (state, props, `CoeChat` status, ask-panel respond), `src/forecaster/Forecaster.tsx` (`onPublished` plumbing and call), `src/forecaster/workspace/InsightsBoard.tsx` (import rename only, if needed)

## Verification
- The repo's typecheck (`npx tsc -b` or existing script) and `npm run build`, both clean.
- Manual walkthrough on the running dev server:
  1. Ask & Understand, Nurtec: the grounding bar shows "Q2 2026 reforecast v3 · Approved", there's no sandbox split, and answers carry citations including the access policy.
  2. Ask about Project Halo: access refusal.
  3. Open the Nurtec workspace, submit Base Case, return to Ask & Understand: the bar shows "AOP 2027 v1 · Submitted, in review" and new answers cite it.
  4. Ask "add a competitor event": read-only refusal, with no draft event card.
  5. Build & Configure: the green header band shows "Model configuration mode", the step counter appears during a build, and the sandbox split still works.
- Commit with `figma make versions create --commit -m "Finish COE AI / Forecast AI separation"`.
