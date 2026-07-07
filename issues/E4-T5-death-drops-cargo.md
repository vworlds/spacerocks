# E4-T5 — Death drops cargo

> **Space Rocks — first iteration.** Ticket E4-T5 of Epic 4 (Cargo trains) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §5.4 (carrier killed → all its TRAINED containers go FREE where they are — lootable by anybody, whatever sector, including inside an enemy shield bubble), §5.1 (TRAINED → FREE on ship death).
2. **Plan** — issue #41 Epic 4 intro + E2-T3 (`Transferring` suppression: transfers must NOT drop cargo).
3. **Code** — E4-T2 (train module), the death path in `apps/server/src/game/modules/combat/` (`damagePlayer`/health → death), E2-T3's `Transferring` tag.

## Goal

On carrier death, every TRAINED container in its train becomes FREE in place — joints gone, state reset, grabbable by anyone — while world transfers (which also destroy the src-side entity) drop nothing.

## Dependencies

- **E4-T2** — hard. Applies to any carrier: player ships now; fleet ships (E9) and tugbots (E8-T2) reuse this path — implement it against the train representation, not the player ship specifically.

## What to build

1. A reactive system in the trains module: when a train-owning entity dies (entity destroyed / health-death event — hook the same signal the explosion effect uses), release its whole chain: destroy joint entities, clear TRAINED state → FREE in place with current velocities (they keep drifting), clear the train representation links.
2. Guard: **suppressed during `Transferring`** (E2-T3) — a world transfer destroys the src entity but must not shed cargo; check the tag in the release system.
3. Interplay with E4-T3's no-regrab grace: dropped-on-death containers should be immediately grabbable (no grace) — the killer's loot shouldn't bounce off their ship (§5.4 "lootable by anybody"); verify.
4. Ordering: release must run before/with the ship's entity teardown so containers aren't destroyed with the parent — if containers are `ChildOf` the ship anywhere, they must not be (verify against E4-T2's representation; trained cargo is linked, not owned).

## Done when

- Test: kill a loaded ship → 3 FREE containers at the train's positions, joints gone, grabbable by another ship immediately.
- Test: transfer a loaded ship (E2-T3 convoy variant) → zero containers dropped in src.
- Test: fleet-agnostic — a non-player carrier entity with a train drops cargo the same way.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- No special cases per carrier type — one system over the train representation.
- Death detection reuses the existing combat death signal — don't invent a parallel one (D5: cannibalize `combat/` helpers).
