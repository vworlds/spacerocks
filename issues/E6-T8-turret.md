# E6-T8 — Turret

> **Space Rocks — first iteration.** Ticket E6-T8 of Epic 6 (Buildings, construction & production)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §6.7 (turret ammo: per-turret buffer of 5 Ore slots; demands Ore whenever a slot is empty; 1 Ore → 5 shots, instant conversion `duration 0`; max 25 shots loaded; firing decrements; at 0 with Ore buffered, one Ore converts), §9 (Turret row: 1 segment, construction `(1,0,0)` — throwaway-cheap, built in multiples), §4.1 (turrets never target asteroids), §6.5 (turret demanding Ore bounces Crystal).
2. **Plan** — issue #41 Epic 6 intro ("targeting: nearest enemy ship in range, reuse `weapons/targeting.ts`, never asteroids/containers").
3. **Code** — E6-T5 (production/conversion), E6-T2 (demand), `apps/server/src/game/modules/weapons/targeting.ts` (reuse), `weapons/` bullet spawning, `Owner` (friend/foe: enemy = different owner).

## Goal

The static defense building: buffers Ore, converts to shots, and autonomously fires at the nearest enemy ship in range — never at asteroids or containers.

## Dependencies

- **E6-T1/T2/T5** — hard; buildable via **E6-T3/T4**. Ship-vs-ship damage unification (E10-T1) receives your bullets — use the standard bullet path so it Just Works.

## What to build

1. Turret type registration: 1 segment, price `(1,0,0)`, distinct render (small barrel indicator rotating toward target is nice-to-have, only if cheap via existing render components).
2. **Ammo**: 5-slot Ore buffer with standing demand for empty slots (unlike producers, no order needed — a turret always wants ammo; E6-T2 demand with a constant source); `shots` counter (max 25): when `shots == 0 && oreBuffered > 0` → instant conversion (1 Ore → 5 shots, duration 0 — via E6-T5's recipe machinery or a trivial dedicated system; prefer the framework, duration-0 path must exist anyway per §6.7).
3. **Targeting + fire**: reuse `weapons/targeting.ts` — nearest **enemy ship** (different `Owner`; includes fleet ships and players) within range (config); fire at config cadence using the standard bullet factory (turret's owner on the bullet for damage attribution); never target asteroids/containers/buildings (§4.1 gap-fill: turrets never accrue fracture meters — using standard bullets means hits WOULD accrue per E3-T2's dispatch; prevent it: turrets don't *aim* at rocks, but a stray bullet hitting a rock accruing a meter for the turret is acceptable and harmless — note this in a comment; the design only forbids targeting).
4. Hold fire with 0 shots; demand keeps pulling Ore (§6.7).
5. Friendly fire: bullets from a turret must not damage its owner's ships — consistent with the E10-T1 ownership-aware damage (friendly fire off for v1); shield interaction comes from E7's matrix (friendly fire passes through own bubbles).

## Done when

- Tests: turret with empty buffer demands Ore and holds fire; feed 1 Ore → 5 shots, fires at a target drone entity in range and kills it (the plan's done-when); shots decrement; auto-reconversion at 0 with buffered Ore; ignores asteroids/containers/out-of-range enemies; never fires at own-owner ships; Crystal bounces off (demand mismatch).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Range, cadence, buffer/shot constants — config (D8).
- Standard bullet path — no turret-specific damage code (E10-T1 unifies damage).
