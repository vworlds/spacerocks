# E2-T8 — Per-sector interest grid + composition stub

> **Space Rocks — first iteration.** Ticket E2-T8 of Epic 2 (Sector runtime — multi-world)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §3.6 (sector composition is procedural; exact rules are an open tuning question — build the mechanism, not the final rule), §4.2 (finite economy: asteroids do **not** replenish in the first iteration), §3.2 (home sector planetoid at local `(0,0)`).
2. **Plan** — issue #41 Epic 2 intro; E3-T1 owns the ore/crystal mix knob; E5-T2 places the real planetoid.
3. **vecs design guide** — §4 grouped queries (the interest-grid pattern).
4. **Code** — `apps/server/src/game/modules/interestGrid/`, `apps/server/src/game/modules/asteroids/` (`fillInitialAsteroids` and the continuous spawner), `apps/server/src/game/modules/spawning`, `apps/server/src/game/modules/rng`.

## Goal

Each sector world generates its content deterministically from `(worldSeed, col, row)`: seeded asteroid fill (with a composition knob surface), a planetoid placeholder reservation at `(0,0)` in home sectors, per-world interest grid unchanged, and the continuous asteroid spawner disabled for the new mode.

## Dependencies

- **E2-T1** (sector worlds + per-sector RNG) — hard. **E3-T1** provides `ResourceKind` on asteroids; if it lands first, thread the mix knob through; otherwise leave the knob plumbed with a single kind.

## What to build

1. Interest grid: verify it is instantiated per world with no cross-world state (it should already be per-world via module install — add a test proving two sectors' grids are independent).
2. Turn `fillInitialAsteroids` into per-sector composition: driven by the sector's seeded RNG; knobs (density, type mix per E3-T1, planetoid presence) from config; **home sectors reserve a clear zone at local `(0,0)`** for the planetoid (placeholder: a static circle body or just a reserved-radius exclusion for asteroid placement — E5-T2 replaces it).
3. Disable the continuous asteroid spawner for the new mode (#40 §4.2 finite economy). Keep the code path selectable if the legacy demo still needs it, but the sector worlds must not respawn rocks.
4. Determinism: same `(worldSeed, col, row)` → identical asteroid field (positions, sizes, kinds).

## Done when

- Test: two boots with the same seed produce identical sector compositions; different `(col,row)` differ.
- Test: home sector has the `(0,0)` reservation (no asteroid inside the reserved radius).
- Test: after mining/destroying rocks, no replenishment occurs.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Composition knobs in config (D8) — the rule itself is expected to be tuned later (#40 §16).
- Seeded RNG only — no `Math.random` in generation paths (the `rng` module is the source).
