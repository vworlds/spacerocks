# E1-T2 — Config overhaul

> **Space Rocks — first iteration.** Ticket E1-T2 of Epic 1 (Foundations) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40: §3.1 (lattice dims + test lattices), §6.4 (shield economics), §6.7 (buffers, turret ammo), §6.8 (`buildingLootRatio`, 40% buffer loot), §6.9 (tugbots, influence radius), §7.2 (ship catalog — all Prices/durations/train limits), §9 (building catalog — construction Prices and seeds), §11.1 (death timer), §8.2 (Price + time model).
2. **Plan** — issue #41 D8 (all numbers in config) and Epic 1 intro.
3. **Code** — `packages/common/src/constants.ts` (`GAME_CONFIG` at line ~39, `ENTITY_CONFIG` at line ~65, plus the world-size constants at the top).

## Goal

All first-iteration tuning knobs exist in centralized config with the design's defaults, expressed via the E1-T1 Price/time primitives. Balance sweeps must be a one-file change (#40 §2.9, plan D8).

## Dependencies

- **E1-T1** (Price/Production/Maintenance types) — required; config entries use those types.

## What to build

Restructure `GAME_CONFIG`/`ENTITY_CONFIG` in `packages/common/src/constants.ts`:

1. **Lattice**: dims config (design target 5×5), env-overridable for `2×1` / `1×1` test modes (read an env var server-side; keep the common package env-free — e.g. config takes defaults and `apps/server` applies the override).
2. **Construction Prices + seeds** (#40 §9): Main (pre-built, no price), Shield Generator `(2,0,0)`, Factory `(2,1,0)`, Shipyard `(0,0,3)`, Turret `(1,0,0)`, Docking Station `(2,0,0)`; every seed `{ price: (1,0,0), duration: 5 }`. Include a per-building `segments` count (Main 3, Shield 1, Factory 2, Shipyard 3, Turret 1, Docking 2) and a reserved construction `duration` knob defaulting to 0 (#40 §6.6).
3. **Ship catalog** (#40 §7.2): Fighter `(1,0,1)`/20s, Miner `(2,0,1)`/25s, Tug `(1,0,2)`/25s, Captain `(0,2,3)`/40s, Tugbot `(1,0,0)`/8s; train limits (all-rounder 3, miner 3, tug 6, tugbot 1, fighter/captain 0); captain recruitment radius knob.
4. **Shields** (#40 §6.4): maintenance `{ price: (0,1,0), period }`, recharge `{ price: (0,1,0), period, rate }` (hp/s), shield max HP, buffer size 5, and the Main building's **efficient maintenance rate** knob (target ≈30 min of grace from 5 Crystal).
5. **Factory recipe**: `{ price: (2,1,0), duration: 10 }` → 1 Alloy.
6. **Turret**: 5-slot Ore ammo buffer, 1 Ore = 5 shots, duration 0, max 25 shots, range knob.
7. **Misc**: default building input-buffer size (~5), tugbot influence radius, stack max height 5, death timer 5 (seconds), `buildingLootRatio` 0.5, buffered-loot ratio 0.4, grab toggle default ON, fracture meter fill/decay knobs (placeholders for E3), train joint stiffness/damping placeholders (E4).
8. **Cross-reference table**: a code comment table mapping each knob group to its #40 section.
9. Remove (or clearly quarantine pending E1-T4) legacy knobs that nothing will read after the retirement of aliens/pickups/waves — coordinate with E1-T4; do not leave dead knobs that look live.

All durations/periods are **float wall-clock seconds** (not ms, not ticks) — note the existing file uses ms and tick helpers (`toFrames`, `perFrame`); new economy knobs must not use those.

## Done when

- Constants compile; every knob above exists with the design default and its #40 section reference.
- Nothing reads removed legacy knobs (`grep` the workspaces).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- No tunable in logic anywhere downstream — this file is the single source (D8).
- Server-only packages must never be imported from `packages/common`.
- Don't reorder/repurpose existing live knobs used by systems that survive E1-T4 (weapons, asteroids, movement) unless you update their readers in the same commit.
