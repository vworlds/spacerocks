# E6-T7 — Factory

> **Space Rocks — first iteration.** Ticket E6-T7 of Epic 6 (Buildings, construction & production)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §6.7 (factory recipe: `{ price: (2,1,0) — 2 Ore + 1 Crystal, duration: 10s }` → 1 Alloy container), §9 (Factory row: 2 segments, seed `(1,0,0)`/5s, construction `(2,1,0)`; "teaches both rocks" — first two-resource Price; gates the Shipyard via the resource tree), §14.2 (design tension: output drift direction is a placement decision — the gentle push just drifts; players place factories so output drifts toward demand).
2. **Plan** — issue #41 Epic 6 intro.
3. **Code** — E6-T5 (production framework — this ticket is its first real consumer), E6-T4 (buildable via seed), E1-T2 (recipe config), E1-T3/E3-T3 (Alloy containers).

## Goal

The Factory building: consumes 2 Ore + 1 Crystal from its buffer, 10 seconds, emits 1 Alloy container that drifts out — entirely on the production framework.

## Dependencies

- **E6-T5** — hard (if gaps surface in the framework while wiring the first real recipe, fix them there, not with factory-local workarounds); **E6-T3/T4** (buildable path).

## What to build

1. Register the Factory type in the building catalog wiring: 2 segments, construction price `(2,1,0)`, its `ProductionOrder` recipe from config (`(2,1,0) → 1 Alloy /10s`), distinct render color.
2. Buffer shape: input buffer slots for Ore and Crystal (~5 each, config); demand while ordered (E6-T2/T5 give this — verify the two-resource case works: partial affordability must not deduct anything).
3. Output: an Alloy container entity (E1-T3 identity) via the framework's ejection (free-area scan + gentle push) — then normal container rules (FREE: grabbable, snappable, absorbable).
4. This is deliberately a thin ticket — its value is proving the framework end-to-end and landing the first Alloy source (the Shipyard's construction price needs it).

## Done when

- End-to-end test: build a Factory from seed (E6-T3/T4), order production, feed 2 Ore + 1 Crystal by jettison → an Alloy container drifts out ~10s later; loops while fed and ordered ("ore+crystal in → alloy containers drift out", the plan's done-when).
- Tests: one-resource-short → no deduction, no timer; stop order mid-buffer → inputs stay buffered, no output.
- Manual: watch output drift — confirm placement decides direction (§14.2); note in PR.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Recipe and buffers purely config (D8) — zero factory-specific logic beyond registration; if you need factory-only code, the framework is missing something — fix E6-T5's module instead.
