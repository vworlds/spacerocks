# E1-T4 — Retire legacy game content

> **Space Rocks — first iteration.** Ticket E1-T4 of Epic 1 (Foundations) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Plan** — issue #41 D5 (legacy retires in place: modules stay in-tree until the combat epic cannibalizes what it needs, then dead code is deleted).
2. **Code** — `apps/server/src/game/world.ts` (the `WorldModule` install list), `apps/server/src/game/modules/{aliens,pickups,gameState,spawning,combat}`, client effects in `apps/client/src/render/`, and the tests under `apps/server/tests/modules`.

## Goal

A clean slate for the new loop: the server boots an asteroid-only world with players, movement, weapons, physics, and networking — no aliens, no pickups, no scoring, no waves.

## Dependencies

- None hard. Coordinate with **E1-T2** on which legacy config knobs die with the content.

## What to build

1. In `WorldModule` (`apps/server/src/game/world.ts`): remove `AliensModule` and `PickupsModule` from the install; remove wave/game-state progression wiring from the install path.
2. `GameStateModule`: reduce to lobby/playing (strip wave counters, boss logic, scoring state). Keep the module — the new mode still needs join/session state.
3. **Keep for reuse** (D5): explosion effects and `damagePlayer`-style helpers in `combat/` — Epic 10 will cannibalize them. Do not delete `aliens/` steering math yet either (E8-T2 may reuse the avoidance math); just unplug the modules from the world install.
4. Client: delete dead effect code paths for removed content (pickup visuals, alien-specific rendering) — but keep `ExplosionEffectModule` and `HyperspaceEffect` (reused by the new mode, plan D2).
5. If any removed content owned networked components in `NETWORK_COMPONENTS` (`packages/common/src/network/schema.ts`): **do not remove or reorder entries** — the order is the protocol (D6). Leave tombstone entries/comments if the component class must survive for the slot.
6. Update/remove tests that exercised removed behavior; keep the module-pattern test scaffolding intact for reuse.

## Done when

- `npm run dev:server` boots an asteroid-only world; a client can connect, fly, shoot rocks.
- No wave/score/pickup/alien entities ever spawn.
- `npm run typecheck --workspaces` and `npm run test` green.
- A short note in the PR description lists what was **kept in-tree for later cannibalization** (explosions, damage helpers, alien avoidance math) so Epic 8/10 agents can find it.

## Constraints

- `NETWORK_COMPONENTS` is append-only even during retirement (D6).
- Don't delete `combat/`, `weapons/`, `asteroids/`, `movement/`, `embellishments/`, `interestGrid/`, `decay/`, `rng/`, `spawning/` — the new mode builds on them.
- Every commit passes typecheck + tests.
