# E9-T4 — Fighter

> **Space Rocks — first iteration.** Ticket E9-T4 of Epic 9 (Fleet) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. Carries **Experiment 6** (#40 §13.6),
> together with E10-T2's respawn micro-test.

## Required reading

1. **Design** — issue #40 §7.2 (Fighter: `(1,0,1)`/20s, train 0, default role "park on planetoid, engage enemies in range, land when clear"; overrides "Follow me"/"Go to beacon" are E9-T5's), §7.5–7.6 (fighters operate alone or under a captain — recruitment is E9-T7's; on captain death fighters keep fighting), §4.1 (fighters never target asteroids).
2. **Plan** — issue #41 Epic 9 intro ("park on planetoid (free surface cell), engage, land when clear; parking-spot-occupied → hover").
3. **Code** — E9-T1 (framework), E5-T3 (surface grid — parking uses free cells), `weapons/targeting.ts` (reuse), E6-T8 (turret targeting conventions — same enemy predicate).

## Goal

The fighter's default role: parked on the planetoid until an enemy enters range, scramble → dogfight → land when clear.

## Dependencies

- **E9-T1**, **E5-T3** — hard. Combat damage unification (E10-T1) should ideally land near this — coordinate; fighters shoot the standard bullet path regardless.

## What to build

1. **Park**: claim a free surface cell (E5-T3 occupancy — coordinate the occupier kind with snapping/buildings; parked fighter occupies its cell), land: settle onto the cell pose, static-ish (kinematic hold or zeroed dynamics), weapons hot (detection while parked); **spot occupied → hover** near the planetoid until one frees (plan).
2. **Engage**: enemy ship (different owner; players and fleet alike) within detection range (config) → launch: unclaim the cell, dogfight — steering + fire using the standard weapon/targeting path; **never target asteroids/containers** (§4.1); keep engagement within a leash radius of the base/park point (config; the default role is defensive — don't chase across the sector; document the leash since the design doesn't specify: smallest rule consistent with "park on planetoid, engage in range, land when clear").
3. **Disengage/land**: no hostiles in range for a config cool-down → return, claim a free cell (maybe a different one), land.
4. Self-preservation is subsumed (its default role IS fighting) — but the E9-T1 reflex must not conflict (attacked while parked = engage trigger; verify no double-dispatch).
5. Captain-related behavior: none here (E9-T7 layers recruitment/formation on top — keep the engage/land states clean for reuse under formation).

## Done when

- The plan's done-when (**Experiment 6**): fighter scrambles against a hostile drone (spawned target), kills it, and re-parks — scripted test + manual watch (record the "does the autonomous fleet feel right?" verdict in the PR).
- Tests: parked cell claimed/unclaimed correctly (no leak after N scramble cycles); hover when no free cell → lands when one frees; never engages asteroids; leash respected.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Detection range, leash, cooldowns — config (D8).
- Standard weapons/damage path (E10-T1 unifies — no fighter-specific damage).
- Parking must not fight the container/building occupancy — one grid, one claim discipline (E5-T3).
