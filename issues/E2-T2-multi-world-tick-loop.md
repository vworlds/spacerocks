# E2-T2 — Multi-world tick loop + asset mounting

> **Space Rocks — first iteration.** Ticket E2-T2 of Epic 2 (Sector runtime — multi-world)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §3.1 (sectors as structural units; slowed clocks are permitted later, not required now — but wall-clock-seconds timing from §8.2 must stay consistent).
2. **Plan** — issue #41 D1 and the Epic 2 intro.
3. **Code** — `apps/server/src/index.ts` (the existing accumulator loop, MAX_FRAME_TIME clamp, `AssetManager` mounting; note the `/rtc/v1/world/<name>` path shape is already parameterized), `apps/server/src/game/modules/assets`.

## Goal

One process ticks all sector worlds from a single accumulator loop, and per-world asset mounting works for every sector world name.

## Dependencies

- **E2-T1** (sector world factory + registry) — hard dependency.

## What to build

1. Single accumulator loop in `apps/server/src/index.ts` that calls `progress(now, delta)` on **every** sector world each tick:
   - keep the `MAX_FRAME_TIME` clamp **global** (one clamp for the frame, not per world) so a stall doesn't compound across 25 worlds;
   - fixed timestep semantics preserved per world (physics assumes fixed step — see `lib/vecs-physics/docs/systems-and-phases.md` in `vworlds/vecs`).
2. `AssetManager.mount` per world name, using the existing parameterized `/rtc/v1/world/<name>` path shape.
3. A cheap per-tick timing measurement (dev-only log or counter): total frame cost across all sectors, so the done-when baseline can be recorded and E11-T3 has something to extend.

## Done when

- 25 empty sectors (5×5) tick at 30Hz within budget on a dev machine — **measure and record the baseline** in the PR description (mean/max frame cost).
- 2×1 and 1×1 modes still boot and play.
- A regression-style test (or at least an assertion-capable harness) exists that boots N worlds and ticks them M times without error.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Don't implement slowed sector clocks — permitted by design, explicitly not first-iteration (#40 §3.1). Just don't preclude it (per-world `progress` calls already leave the door open).
- Tick rate and any loop knobs from config (D8).
