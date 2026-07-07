# E5-T5 — Stack grab + reflow

> **Space Rocks — first iteration.** Ticket E5-T5 of Epic 5 (Planetoid & magnetic snapping)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. This is the raiding verb (#40 §6.3) and
> half of **Experiment 9**'s loop.

## Required reading

1. **Design** — issue #40 §6.2 (stack grabbing, player: grab ON + touch a SNAPPED container → TRAINED; containers stacked **above** it go FREE and re-snap to the nearest valid cell or float away — pulling a brick out of a wall. Stack reflow, tugbot: pulling from mid-stack → containers above **instantly re-snap downward** to fill the gap, no physics tumble — tumble is deferred polish), §6.3 (raiding: stacks have no ownership; steal with grab ON + touch), §5.2 (grab semantics on SNAPPED).
2. **Plan** — issue #41 Epic 5 intro (tugbot pull path used by E8).
3. **Code** — E5-T4 (snap/occupancy), E4-T2 (train attach), E8-T2 will call the tugbot variant.

## Goal

Two mid-stack extraction behaviors over the same occupancy machinery: the player's physical yank (things above go FREE and re-settle) and the tugbot's tidy instant downward reflow.

## Dependencies

- **E5-T4**, **E4-T2** — hard. E8-T2 consumes the tugbot variant (export it callable without a player).

## What to build

1. **Player grab path**: extend E4-T2's attach dispatch: grab ON + ship touch on a SNAPPED container (and train below limit) → release the cell claim, container → TRAINED into the train. Then handle the stack above: every container in cells above the grabbed one goes **FREE** (unfreeze to dynamic, small physics wake) and immediately runs the normal snap logic — most will re-snap to the nearest valid cell (often one below, via E5-T4's contact path); some drift away. Don't script their destination — FREE + physics + snap rules is the design.
2. **Tugbot path** `extractFromStack(container, byTugbot)`: exported function — remove the target from its cell, and **instantly re-snap** every container above one cell downward (occupancy update + teleport placement, no physics interlude, no tumble). No grab toggle involved (tugbots bypass it, §6.9).
3. Ownership: none — any player's grab works on any stack (§6.3); no owner checks.
4. Edge cases: grabbing the top container (no reflow needed); grabbing with a full train (touch does nothing — the SNAPPED container stays; §5.2 full-train rule); two entities grabbing the same container same tick (first-in-deterministic-order wins, second no-ops — reuse E5-T4's claim discipline).

## Done when

- Tests: player mid-stack grab → grabbed container TRAINED; above-containers go FREE and end SNAPPED in valid cells or drifting (assert occupancy consistency: no floating claims, no duplicate cells); tugbot extraction → stack compacts instantly, heights consistent; top-grab trivial; full-train touch no-ops; same-tick contention resolves deterministically.
- Manual: pulling a brick out of a wall looks/feels right (**Experiment 9 ingredient**) — note verdict in PR.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- No physics tumble animation for the tugbot path (deferred polish, §12); the player path gets physics for free by going FREE.
- Occupancy consistency is the invariant to test hardest — every claim released exactly once.
