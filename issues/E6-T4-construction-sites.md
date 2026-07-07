# E6-T4 — Construction sites

> **Space Rocks — first iteration.** Ticket E6-T4 of Epic 6 (Buildings, construction & production)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §6.6 (a stuck seed becomes a construction site — a ghosted building demanding its Construction Price; containers absorbed on contact advance the progress bar; visual becomes progressively more built; full Price → completes. Construction is Price-only — no post-delivery timer, `duration` knob reserved default 0. Sites wait indefinitely, no decay), §6.8 (site destruction: loot rules apply to sites too — Price *delivered so far* is the sensible base; rule: absorbed resources count as buffered-equivalent — apply §6.8 both-clauses with construction-progress as the price basis), §9 (catalog prices).
2. **Plan** — issue #41 Epic 6 intro.
3. **Code** — E6-T1 (building framework: cells, HP, loot), E6-T2 (demand/absorption), E6-T3 (placement handoff), `embellishments/` (progress visuals), `packages/common/src/network/schema.ts`.

## Goal

Construction sites: ghosted, damageable, demand-driven proto-buildings that absorb their Construction Price and complete into real buildings.

## Dependencies

- **E6-T1/T2/T3** — hard.

## What to build

1. `createConstructionSite(buildingType, cells, owner)` (called by E6-T3): a building-framework entity variant — reserves cells, static ghost body (solid; things bounce off sites), `Demand` = the full Construction Price (E1-T2), marker `ConstructionSite` + progress state (delivered per resource).
2. Absorption (via E6-T2) credits **construction progress** instead of an operational buffer; recompute demand from the remainder.
3. **Progress on the wire**: a networked progress component (append to `NETWORK_COMPONENTS` + snapshot test, D6) driving client rendering: ghost alpha ramp and/or progress bar (client-side render; reuse embellishment conventions — keep it one component, simple visuals).
4. **Completion**: full Price absorbed → replace the site with the real building via E6-T1's factory in place (same cells, same owner; the swap must not release/re-claim cells non-atomically — hold the claims across the swap). The reserved `duration` knob (default 0) sits between full-price and completion — implement the timer path but ship it at 0 (§6.6).
5. **No decay**: sites wait indefinitely (§6.6) — ensure nothing TTLs them.
6. Site destruction: dies like a building (E6-T1 damage path); loot per §6.8 with delivered-progress as the price basis (document the interpretation in code — the design gap noted above).

## Done when

- End-to-end test: place a Shield Generator seed, jettison 2 Ore into the site by player jettison alone → site completes into a working Shield Generator building on the same cells (**the plan's done-when**).
- Tests: partial delivery persists indefinitely (tick a long time — no decay); mismatched containers bounce; site destruction mid-build pops the documented loot; progress component updates on the wire (snapshot test updated).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Prices from config (D8); wire append-only (D6).
- One absorption rule (E6-T2) — sites express demand; no special delivery path.
