# E2-T3 — Entity transfer helper (server)

> **Space Rocks — first iteration.** Ticket E2-T3 of Epic 2 (Sector runtime — multi-world)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.
> This helper is load-bearing: player hyperspace (E2-T4), convoy jumps (E4-T6), NPC override
> crossings and miner haul-home loops (E9-T5), and cross-world respawn (E10-T2) all reuse it.

## Required reading

1. **Design** — issue #40 §3.4 (hyperspace traversal: the cargo train jumps together as one convoy; physics not honored 100% during the jump).
2. **Plan** — issue #41 D3 (one shared helper: component snapshot → despawn → respawn; relationships and joints are **rebuilt on the destination side, not serialized**).
3. **vecs design guide** — `lib/vecs/docs/design-guide.md` in `vworlds/vecs`: §2.3 (deferred structural changes), §3 (relationships are not serializable — `Relationship.target` is an `Entity`), §8 anti-patterns.
4. **vecs-physics docs** — `lib/vecs-physics/docs/bodies.md` (Position/Rotation/velocity write-back semantics), `joints.md` (joint entity structure: `JointBodyA`/`JointBodyB` + type component).
5. **Code** — `apps/server/src/game/modules/playerShips` and `asteroids/factories` (what a ship/container aggregate looks like), `packages/common/src/components/Owner.ts`.

## Goal

`transferEntity(src, dst, entity, pos)`: move an entity subtree (ship + TRAINED containers + AI state) from sector world A to sector world B at position P, exactly once, with no loot drops and no death-side effects firing.

## Dependencies

- **E2-T1** (multiple worlds to transfer between). Trains (E4) and AI state (E9) extend the whitelist later — design the whitelist to be extensible.

## What to build

1. A server module (e.g. `apps/server/src/game/modules/sectorTransfer/` or a shared helper under `apps/server/src/game/`) exposing:
   - `transferEntity(src: World, dst: World, entity: Entity, pos: {x,y}): Entity` — snapshot **whitelisted** components (physics pose/velocity, render components, gameplay identity (`Owner`, ship type, health), AI state when it exists), destroy in src, recreate in dst via factories/plain component sets.
   - A convoy variant (`transferConvoy` or an option) that moves the whole jointed train **as one unit**: relative offsets and velocities preserved, joints **rebuilt** in dst (never serialized), `ChildOf` relationships re-established by structure.
2. A `Transferring` tag component set on the subtree during the src-side destroy, so death-side effects (cargo drop E4-T5, destruction loot §6.8, explosion spawns) are **suppressed** — those systems must check `.without(Transferring)` (add the guard to existing death paths you touch; later tickets add their own).
3. Whitelist is explicit and centralized — a component not on the list does not survive transfer (fail-safe: better to drop server-local scratch state than to leak it).
4. Deterministic ordering: destroy after snapshot completes; the recreate happens in dst on the same server tick (both worlds live in one process — no async).

## Done when

- Unit test: move a ship + 3-container jointed train between two test worlds — velocities and relative offsets preserved (within epsilon), joints functional in dst, no loot/no explosion spawned in src, src world has zero leftover entities from the subtree.
- Unit test: `Transferring` suppression — a death-side-effect system does not fire during transfer.
- Helper documented (doc comment) for the reusing tickets (E2-T4, E4-T6, E9-T5, E10-T2).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Never serialize `Relationship` targets or joint entities across worlds — rebuild (D3, guide §3).
- Mirror production module deps in the test worlds (guide §6): install `PhysicsModule` + the real modules that own the whitelisted components.
- Module pattern (D7) if this ships as an ECS module; a plain helper file is acceptable since it spans worlds — justify the choice in the PR.
