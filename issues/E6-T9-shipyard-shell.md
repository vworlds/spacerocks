# E6-T9 — Shipyard (shell)

> **Space Rocks — first iteration.** Ticket E6-T9 of Epic 6 (Buildings, construction & production)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §7.3 (the shipyard produces **ships directly** — not seeds; a finished ship appears near the shipyard and immediately starts its default role; type selected via the shipyard's radial menu), §7.2 (ship catalog prices/durations: Fighter `(1,0,1)`/20s, Miner `(2,0,1)`/25s, Tug `(1,0,2)`/25s, Captain `(0,2,3)`/40s), §9 (Shipyard row: 3 segments, construction `(0,0,3)` — 3 Alloy; priced in Alloy so progression falls out of the resource tree).
2. **Plan** — issue #41 Epic 6 intro ("actual ship AI lands in E9; spawns inert placeholder until then") and E9-T1 ("spawn-from-shipyard wiring replaces the placeholder").
3. **Code** — E6-T5 (production framework — ships are recipes with entity-spawn outputs), E6-T4 (buildable), `playerShips/` (what a ship entity aggregate looks like — the placeholder mimics it minus input/AI).

## Goal

The Shipyard building shell: buildable, holds ship-production entries on the framework, and ejects an inert placeholder ship entity per completed recipe — E9-T1 swaps the placeholder for real fleet ships.

## Dependencies

- **E6-T5**, **E6-T3/T4** — hard; E6-T7 (Alloy exists, or tests hand-spawn Alloy containers). E6-T10 wires the menu; orders are programmatic until then.

## What to build

1. Shipyard registration: 3 segments, construction `(0,0,3)`, distinct render; input buffers per the ship recipes' resource types (Ore/Crystal/Alloy — capacity config).
2. Ship recipes from config (all four types + their prices/durations) as production entries whose **output is an entity spawn**, not a container: extend E6-T5's output hook if the container path was hardcoded (the framework ticket anticipated this — outputs eject via the free-area scan either way; ships get the gentle push too and then "move themselves from birth", §7.3 — placeholder just drifts).
3. **Inert placeholder ship**: physics body + render (per-type color/shape variant) + `Owner` + a `ShipType` component + a `PlaceholderShip` marker — no input handling, no AI, no weapons. E9-T1 replaces the marker with the AI framework's role components; design the spawn call so that swap is one function (`spawnFleetShip(world, type, pos, owner)` living where E9 can own it).
4. Type selection: `ProductionOrder` per ship type (menu in E6-T10).

## Done when

- Test: built Shipyard + buffered `(1,0,1)` + fighter order → a placeholder fighter entity ejects near the shipyard ~20s later ("shipyard builds and ejects a ship entity near itself" — the plan's done-when); wrong/insufficient buffer → nothing (atomicity).
- Each of the four types spawnable with correct price/duration from config.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- All catalog data config (D8); no ship AI here (E9); the all-rounder is **not** shipyard-buildable (§7.1 — respawn only).
- Keep the placeholder honest: visible, collidable, killable (it will be a combat test dummy for E6-T8/E10 until E9 lands).
