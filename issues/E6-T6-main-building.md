# E6-T6 — Main building

> **Space Rocks — first iteration.** Ticket E6-T6 of Epic 6 (Buildings, construction & production)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §6.3 (starting base: one Main building, 3 segments, pre-built, built-in shield generator), §9 (Main row: produces tugbots + seeds; fields 5 tugbots — IS a standard docking station, no special case; built-in efficient shield generator with pre-filled 5/5 Crystal buffer; lose it = eliminated), §6.6 (seed production: all 5 seed types orderable from the start, `(1,0,0)`/5s each), §11.2 (elimination anchor).
2. **Plan** — issue #41 Epic 6 intro.
3. **Code** — E6-T1 (framework), E6-T5 (production), E5-T3 (grid placement), E2-T8/E5-T2 (home sector planetoid), E7-T3 (starting shield — theirs; you provide the mount point), E8-T3 (docking-station component — theirs; you register it).

## Goal

Every player's home sector boots with a pre-built 3-segment Main on their planetoid: seed + tugbot producer, elimination anchor, and (via E7-T3/E8-T3) efficient shield host and standard docking station.

## Dependencies

- **E6-T1/T5**, **E5-T2/T3** — hard. **E7-T3** and **E8-T3** plug into the entity you create — land the mount points (a stable factory + documented composition) even if those tickets follow; where they haven't landed, leave clearly-marked attachment TODOs rather than stub behavior.

## What to build

1. `spawnMainBuilding(world, owner)` in the buildings module: 3-segment building-framework entity (`type: Main`) placed on a **flat run of ≥3 cells** chosen deterministically from the planetoid's longest flat runs (seeded; E5-T3 enumeration), owner set.
2. Wire it into world/player setup: when a player's home sector initializes (player join flow — coordinate with `playerSessions`/`gameState`), the planetoid + Main spawn before the player's ship (respawn location, E10-T2). One Main per player; 1×1 test lattices host multiple Mains on one planetoid (§3.1) — placement must handle N players claiming runs on one planetoid (deterministic, non-overlapping).
3. **Production entries** (E6-T5 recipes): all 5 seed types (Shield, Factory, Shipyard, Turret, Docking Station) at `(1,0,0)`/5s + tugbot at `(1,0,0)`/8s. Order via `ProductionOrder` (menu lands in E6-T10). Produced seeds/tugbots carry the Main's owner.
4. **Composition mounts**: register the docking-station component (E8-T3) on the Main (fields 5 tugbots, standard radius — no special case, §9) and the built-in shield generator mount (E7-T3: efficient-rate generator, pre-filled buffer). If those components don't exist yet, define the composition point (factory assembles from feature components) and mark TODOs.
5. Elimination: nothing to implement here beyond the Main being identifiable (`Building.type === Main` + `Owner`) — E10-T3 watches it.

## Done when

- Test/boot: fresh player world = planetoid + Main (+ starting shield + 5 tugbots once E7-T3/E8-T3 land — the plan's full done-when; assert what's mergeable now and leave the integration assertion with the later ticket).
- Tests: Main produces each seed type and tugbots through E6-T5 (correct prices/durations); two players on a 1×1 get non-overlapping Mains; produced entities carry the right owner.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Main is a **standard** docking station and its generator a **normal** shield at a different config rate — no special-case code paths, only config (§9, §6.4).
- Placement deterministic from the sector seed (D8, seeded RNG).
