# E6-T3 — Seeds

> **Space Rocks — first iteration.** Ticket E6-T3 of Epic 6 (Buildings, construction & production)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §5.1 (seeds are a collision subclass of container: FREE ⇄ TRAINED like normal containers — towable; **never** SNAPPED, cannot stack/be stacked on, never absorbed as resources; jettisoned at a planetoid → placement-validity check instead of snapping), §6.6 (construction: tow the seed, jettison at the spot; sticks only if placement valid — flat run ≥ building size with clearance; invalid → bounces, stays FREE and pickupable; every seed `(1,0,0)`/5s, no prerequisites).
2. **Plan** — issue #41 Epic 6 intro; design §2.3 (a new entity class = a collision category + a POST_UPDATE case — the extension grammar).
3. **Code** — E3-T3 (containers), E4-T2 (train attach), E5-T3 (surface grid: `flatRunAtLeast`), E5-T4 (the snap cases seeds must NOT enter), E6-T4 (consumes valid placement → construction site).

## Goal

Seeds: towable container-subclass entities carrying a target building type, with their own planetoid-contact verb — placement validation instead of snapping.

## Dependencies

- **E3-T3/E4-T2** (container/train mechanics), **E5-T3/T4** (grid + snap-case exclusion), **E1-T2** (seed price/duration, building sizes). E6-T4 turns valid placements into sites; E6-T6's Main produces seeds — until then, spawn via test factory.

## What to build

1. Seed entity in the containers module (or a `seeds` submodule): `Seed { buildingType }`, `CAT_SEED` collision category (own bit — the extension grammar §2.3), rendered as a distinct container variant (per-type char/color from config; visually a container with the building's initial, e.g. "F" ghost-tint).
2. State rules: FREE ⇄ TRAINED — attaches to trains exactly like a container (E4-T2's case should match seeds too — verify the category mask lets ships touch them); **excluded** from E5-T4's snap/stack cases and E6-T2's absorption (guards by category/marker).
3. **Placement verb**: POST_UPDATE case seed × planetoid (and seed × building/SNAPPED-container contact → just bounce): run validity via E5-T3 — a flat run ≥ `segments(buildingType)` cells whose height-0 cells are all free with clearance (concave edges, containers, buildings), anchored nearest the contact point. Valid → hand off to E6-T4 (`createConstructionSite(buildingType, cells, owner)`) and destroy the seed. Invalid → nothing: it bounces, stays FREE, pickupable (§6.6).
4. Owner: the seed carries the ordering player's `Owner` (from production, E6-T6) → the site/building inherits it.

## Done when

- Tests: seed tows like cargo (train attach/jettison); never snaps/stacks (planetoid touch with invalid placement → still FREE); never absorbed by a demanding building; valid jettison at a ≥-sized flat run → construction site created at the right cells, seed gone; invalid (short run, occupied cell, concave) → bounce.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Building sizes/prices from E1-T2 config (D8); no prerequisites — all seed types placeable from the start (§6.6).
- Follow the extension grammar: new category bit + POST_UPDATE case; don't widen existing cases with seed-conditionals beyond simple guards (design §2.3).
