# E2-T1 — Sector world factory

> **Space Rocks — first iteration.** Ticket E2-T1 of Epic 2 (Sector runtime — multi-world)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.
> Epic 2 is **feasibility risk #1** — it gates experiments 1 & 8. Start immediately after E1.

## Required reading

1. **Design** — issue #40 §3.1 (sector lattice: wraparound torus, per-sector ECS + Box2D at local `(0,0)`, config dims, 2×1/1×1 test lattices), §3.2 (home sector).
2. **Plan** — issue #41 D1 (sector = named `ServerWorld`; `VecsListener.registerWorld()` supports multiple named worlds under one Express app — verified in `vecs-server/src/vecs_listener.ts` in the `vworlds/vecs` repo).
3. **vecs design guide** — `lib/vecs/docs/design-guide.md` in `vworlds/vecs`: §6 (modules, umbrella install order), §5 (phases).
4. **Code** — `apps/server/src/index.ts` (current single-world boot: physics preload, `ServerWorld` creation, `VecsListener`, accumulator loop), `apps/server/src/game/world.ts` (`WorldModule`), `apps/server/src/game/modules/rng` (seedable RNG).

## Goal

N independent sector worlds in one process: each sector is its own `ServerWorld` named `sector-<col>-<row>` with its own `PhysicsModule` instance (own Box2D world centered at local `(0,0)` — this is what solves Box2D precision decay) and its own `WorldModule` install.

## Dependencies

- **E1-T2** (lattice dims in config). **E1-T4** (clean world install) strongly recommended first.

## What to build

1. Refactor the world-construction code in `apps/server/src/index.ts` into `createSectorWorld(col, row, seed)`:
   - own `ServerWorld('sector-<col>-<row>')`;
   - own `PhysicsModule` install (physics WASM preload stays once per process — verify `preloadPhysics()` is process-global, see `lib/vecs-physics/docs/installation.md`);
   - own `WorldModule` install;
   - per-sector seeded RNG derived from `(worldSeed, col, row)` via the existing `rng` module.
2. `SectorRegistry` (plain module/file, not an ECS module): maps `(col,row)` ↔ world instance and world name; **torus-adjacent lookup** (neighbor of `(0,0)` going west on a 5-wide lattice is `(4,0)`; design §3.1 wraparound).
3. Lattice dims come from config (E1-T2), env-overridable to 2×1 / 1×1.
4. Register every sector world on the single `VecsListener`/Express app (D1); clients connect to a specific world by URL path.

Keep the single-world dev experience working: a 1×1 lattice must boot and behave like today's game.

## Done when

- A 2×1 lattice boots: both worlds tick (wire the loop minimally here; the real multi-world loop is E2-T2), and two clients can connect to the two worlds **by URL** simultaneously.
- Unit tests: `SectorRegistry` torus adjacency on 5×5, 2×1, 1×1 (all four directions, corners).
- Determinism: same seed → same per-sector RNG streams (test via two boots comparing a few draws).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Physics/world state must never be shared between sector worlds — no cross-world entity references (cross-world moves are E2-T3's transfer helper).
- Config-driven dims only; no lattice literals in logic (D8).
- Module pattern per D7 for anything ECS-side; the registry itself is plain infrastructure.
