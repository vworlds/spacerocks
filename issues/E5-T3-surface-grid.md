# E5-T3 — Surface grid

> **Space Rocks — first iteration.** Ticket E5-T3 of Epic 5 (Planetoid & magnetic snapping)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.
> The surface grid is shared infrastructure: snapping (E5-T4), stacking, seeds/placement (E6-T3),
> building reservation (E6-T1), fighter parking (E9-T4), and tugbot stacking (E8-T4) all query it.

## Required reading

1. **Design** — issue #40 §6.1 (surface-grid grammar: any flat surface is a multiple of container size; buildings are also multiples of this unit), §6.2 (snap points = segment centers; stack cells adjacent/above; max height 5; free-space check: target cell free of containers, buildings, and concave planetoid edges).
2. **Plan** — issue #41 Epic 5 intro.
3. **vecs design guide** — §4 grouped queries (`groupBy` — a live occupancy index without scans).
4. **Code** — E5-T1 (segment metadata: snap point, flatness, runs), E5-T2 (planetoid module).

## Goal

A queryable surface-grid model over the planetoid's segments: cell = (segment/run position, height 0–4), with an occupancy index and the free-space check every placement mechanic uses.

## Dependencies

- **E5-T1** metadata (fixture acceptable), **E5-T2** (planetoid entity to anchor to). E1-T2 (stack max height 5 knob).

## What to build

1. Cell model in the planetoid module (or `packages/common` for the pure math + a server-side occupancy layer — pure math in common is friendlier to tests; decide and document): cell key = `(segmentIndex, height)`, world-space pose of a cell (position + surface-normal orientation from the segment), adjacency (same-run neighbors, above/below).
2. **Occupancy index**: which entity occupies each cell (SNAPPED containers E5-T4, buildings/sites E6-T1, parked fighters E9-T4). Implement as a grouped query over an `OccupiesCell`-style component (`groupBy` keyed by cell — guide §4) or a map maintained by component hooks; either way it must be reactive, not scanned.
3. **Free-space check** `isCellFree(cell)`: no container, no building, height < 5, and **concave-edge clearance** — a cell whose box would intersect the planetoid chain (concave neighborhoods, cave ceilings) is invalid; compute from segment geometry (angle metadata) once and cache per cell.
4. Queries the consumers need: `closestSnapPoint(pos)` (E5-T4), `flatRunAtLeast(n)` enumeration (E6-T3 seed placement: flat run ≥ building size with clearance at height), `cellsOfRun(runId)`, `stackHeight(segment)`.
5. Determinism: cell claims resolved in deterministic contact order belong to E5-T4; your API just needs to be side-effect-free on query.

## Done when

- Unit-tested cell math on the fixture planetoid: snap-point lookup (nearest cell to arbitrary points, including near concavities), adjacency across runs, height accounting, free-space check incl. concave-edge rejection and height-5 cap, flat-run enumeration.
- Occupancy reacts to add/remove of occupying entities (test with dummy occupiers).
- API documented for the four consumer epics.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Max height and geometric margins from config (D8).
- Reactive index, no per-tick scans (guide §4); keep the pure geometry framework-free.
