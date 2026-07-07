# E5-T2 — Planetoid body + rendering

> **Space Rocks — first iteration.** Ticket E5-T2 of Epic 5 (Planetoid & magnetic snapping)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §6.1 (static planetoid at local `(0,0)` in home sectors; angle-0 runs merged into single Box2D chain segments — physics optimization only), §3.2.
2. **Plan** — issue #41 Epic 5 intro (fallback: hand-authored polygon fixture if E5-T1 slips).
3. **vecs-physics docs** — `lib/vecs-physics/docs/shapes.md` in `vworlds/vecs` (`Chain { points, loop }` geometry, child shape entities, chain validity: ≥4 points), `bodies.md` (static bodies).
4. **Code** — E5-T1 (generator + fixture), E2-T8 (the home-sector `(0,0)` reservation this replaces), client render: check what `phaserNetworkComponents` offer for polygons (a `Vertices`/polygon renderable is referenced in the vecs design guide §10; verify in `@vworlds/vecs-phaser`) and how big static geometry interacts with the interest grid.

## Goal

`modules/planetoid/`: a static physics planetoid at local `(0,0)` in home sectors, built from the generator output (angle-0 runs merged into single chain segments), collidable including caves, rendered on the client.

## Dependencies

- **E5-T1** (or its fixture — do not block; build against the fixture and swap the generator in when it lands), **E2-T8** (home-sector placement hook; if absent, spawn in the default world).

## What to build

1. `apps/server/src/game/modules/planetoid/` (D7): spawn a static `Body` at `(0,0)` with a `Chain` child shape from the generator's vertex loop; **merge consecutive angle-0 segments** into single chain edges (fewer segments, identical shape — physics optimization only; the surface-grid metadata (E5-T3) still sees the unmerged segments).
2. Collision category (`CAT_PLANETOID` or reuse a static/terrain bit — add next to the `CAT_*` set); make it `Detectable` if physics queries need to see it (E2-T6/E6-T3 use overlap/shape queries near the surface — check `queries.md`).
3. Client rendering: polygon fill of the loop via the networked renderable that supports arbitrary vertices (triangulated if the renderer requires it). Watch the wire cost: one big vertex list, sent once — verify snapshot size is acceptable and the interest grid doesn't cull the planetoid for players near it (a large entity spanning cells; test this).
4. Keep the sector composition (E2-T8) from placing asteroids inside the planetoid (the reservation radius should derive from the generated extent).

## Done when

- Ship collides with the planetoid everywhere, including inside caves/concavities (targeted contact tests using fixture geometry).
- Renders on the client as a filled shape; visible whenever in viewport (interest-grid test).
- Deterministic: same seed → same planetoid body (test via segment checksum).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Chain merge must not alter geometry (assert merged loop ≡ original polyline).
- Module pattern (D7); knobs in config (D8); wire additions append-only + snapshot test (D6).
