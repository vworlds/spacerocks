# E2-T6 — Arrival clearance nudge

> **Space Rocks — first iteration.** Ticket E2-T6 of Epic 2 (Sector runtime — multi-world)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §3.4 arrival collision rule: "if the ship (or any convoy member) would overlap a body at the arrival position, the whole convoy is nudged along the arrival vector to the nearest clear position (spatial overlap/shape-cast query)."
2. **Plan** — issue #41 D4 (1.0.39 now: `overlapCircle`; switch to `shapeCastClosest` after E1-T5 — mark the site `TODO(1.0.40)`).
3. **vecs-physics docs** — `lib/vecs-physics/docs/queries.md` in `vworlds/vecs` (`physics(world)` query API: overlap queries, `Detectable` marker requirements — check whether asteroids/planetoid need `Detectable` for overlap queries to see them).
4. **Code** — the E2-T3 transfer helper and E2-T4 crossing system (arrival position computation).

## Goal

Hyperspace arrival never inter-penetrates: before placing the transferred ship/convoy in the destination world, find the nearest clear position along the arrival vector and place there.

## Dependencies

- **E2-T3/E2-T4** — hard (this hooks the arrival placement path). **E4-T6** extends the clearance footprint to the whole train — design the API to take a set of body footprints, not just one circle.

## What to build

1. A clearance function in/next to the transfer helper: given the destination world, an arrival position, an arrival direction vector, and the convoy's footprint(s):
   - test overlap at the candidate position (`overlapCircle` over a conservative bounding circle per convoy member, 1.0.39);
   - if blocked, step along the arrival vector (step size = config knob) until clear; cap the search (config) and fall back to the nearest clear candidate found by expanding search rather than failing;
   - return the clear position; the transfer places the convoy with relative offsets preserved.
2. Mark the overlap call site `TODO(1.0.40)` for the `shapeCastClosest` swap (E1-T5).
3. Ensure queried obstacles (asteroids, planetoid, buildings later) are visible to the physics query API (add `Detectable` where the docs require it — verify in `queries.md`).

## Done when

- Test: arrival into an asteroid-occupied point never inter-penetrates (assert no overlap after placement); convoy stays intact (relative offsets within epsilon).
- Test: unobstructed arrival is unchanged (zero nudge).
- Edge case: fully crowded arrival strip still terminates (cap + fallback) — test with a wall of asteroids.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Step size, search cap, bounding-circle padding — all config (D8).
- Keep it server-side only; the client just sees the final pose.
- Mirror production physics module deps in test worlds (guide §6).
