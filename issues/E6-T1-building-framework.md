# E6-T1 — Building framework

> **Space Rocks — first iteration.** Ticket E6-T1 of Epic 6 (Buildings, construction & production)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §6.1 (buildings are multiples of the container unit — the surface-grid grammar), §6.8 (destroying buildings: releases Construction Price × `buildingLootRatio` (default 0.5, rounded down) + 40% of buffered resources (rounded down), as ordinary FREE containers at the building's location), §9 (building catalog: segments per type).
2. **Plan** — issue #41 Epic 6 intro, D7/D8.
3. **vecs design guide** — §6 (feature modules), §3 (small components).
4. **Code** — E5-T3 (surface grid: cell reservation, flat runs), the `CAT_*` bits, `combat/` damage helpers (D5 cannibalization), E1-T1 (`priceContainers`), E1-T2 (catalog config).

## Goal

`modules/buildings/`: the generic building entity — occupies a run of surface cells, has HP and damage routing, and pops the design's loot on destruction. Every concrete building (E6-T6..T9, E7, E8-T3) instantiates through this.

## Dependencies

- **E5-T3** (surface grid) — hard; **E1-T1/T2** (Prices, catalog); **E3-T3** (containers, for loot).

## What to build

1. `apps/server/src/game/modules/buildings/` (D7): `Building { type, segments }` component + factory `spawnBuilding(world, type, cells)`:
   - reserves its surface-run cells in the E5-T3 occupancy (buildings occupy height-0 cells across `segments` consecutive flat cells; reservation fails if any cell is unfree — return failure, caller decides);
   - static physics body sized to the run (box aligned to the surface), `CAT_BUILDING` category;
   - render: simple distinct rectangle per type (colors/config; real art is out of scope);
   - `Owner` (player) on the entity — raids and radial-menu auth (E6-T10) need it.
2. **HP + damage routing**: `Health` on buildings; bullets/asteroid hits route damage via a POST_UPDATE case on `CAT_BUILDING` (reuse/cannibalize `combat/` damage helpers per D5). Shield-protected exemptions come from E7's bubble intercepting — no special casing here.
3. **Destruction loot** (§6.8, shared with construction sites E6-T4): on death, spawn FREE containers = `floor(constructionPrice × buildingLootRatio)` per resource + `floor(0.4 × buffered)` per resource (buffers exist from E6-T2 — read if present), scattered at the building's cells with small drift; release all cell claims; `ChildOf` children (embellishments, bubbles) die with it.
4. Elimination anchor hook: destroying a Main building must be observable by E10-T3 (emit-able via the entity's type — no extra work beyond keeping type queryable).

## Done when

- Test: hand-spawned 2-segment building reserves cells (snap attempts into them bounce), takes bullet damage, dies → correct loot counts for a known price/buffer, claims released.
- Test: reservation failure on an occupied/short run.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Loot ratios, HP per type — config (D8); catalog data (segments, prices) from E1-T2, not literals.
- Module pattern (D7); damage via existing combat path, not a parallel one (D5).
