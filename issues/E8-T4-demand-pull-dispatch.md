# E8-T4 — Demand-pull dispatch (single zone)

> **Space Rocks — first iteration.** Ticket E8-T4 of Epic 8 (Logistics) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **E8-T1's design doc** (the filed issue "Tugbot routing & demand propagation — design (E8-T1)") — **this ticket implements it**; single-zone scope.
2. **Design** — issue #40 §6.9 (idle priorities: 1 catch any floating FREE container in zone — cleanup first, tugbots dislike floaters; 2 pull from a stack to fulfill demand. After pickup: local demand → deliver; no demand → stack it, choosing **shield-protected flat surface first** (protection beats proximity), then closest valid cell to its own station, height <5; no valid cell → release FREE — visibly floating containers are the player's cue to expand. Conflict rules: server-authoritative claims, first wins (including vs player pickups), re-plan on vanished targets, never leave radius, abandon chases at the edge), §14.7 (thrash tension).
3. **Plan** — issue #41 Epic 8 intro + risk register.
4. **Code** — E8-T2 (tugbot behavior API), E8-T3 (zones/stations), E6-T2 (Demand), E5-T3/T4 (stack cells, protected = inside a live E7 bubble — you'll need a "cell is shield-protected" query: cell position within any friendly bubble radius; coordinate with E7).

## Goal

The per-station dispatcher: idle tugbots claim jobs by the design's priorities, deliver to local demand, stack surplus with protection-beats-proximity, and degrade visibly (floaters) when the base saturates — without livelock.

## Dependencies

- **E8-T1 (reviewed doc)**, **E8-T2**, **E8-T3**, **E6-T2** — hard. Zone chaining (remote demand) is E8-T5 — keep the demand-source abstraction open to remote entries per the doc, implement local only.

## What to build

1. Per-station dispatcher system (interval-throttled, config cadence): match idle fielded tugbots to jobs:
   - **Priority 1**: FREE floaters in zone (not claimed, not in no-touch cooldown) → catch.
   - **Priority 2**: active demand in zone (E6-T2, type-tagged) + a source (stack cell with that resource, per E5-T3 occupancy) → pull and deliver.
2. **Claims** (per the E8-T1 doc): container claims and demand-slot claims, server-authoritative, first-wins; player pickup of a claimed container voids the claim → re-plan; claim TTL/timeout from config.
3. **Post-pickup routing**: local demand → deliver (E8-T2 delivery); no demand → stacking target: shield-protected flat cells first, then closest-to-station valid cell, height <5; none → carry to a clear spot and release FREE (the design's expansion cue).
4. **Thrash guards** (from the doc + §14.7): release-cooldown (a container released for no-room is untouchable T seconds), catch-count deprioritization, and whatever else the doc specified — all knobs config.
5. Radius discipline: jobs only within the station's zone; a chase reaching the zone edge is abandoned (target unclaimed, tugbot returns idle-in-zone).
6. Re-plan on vanished targets (absorbed/stolen/destroyed mid-flight): pick next job or stack/release per the rules.

## Done when

- Sim test (the plan's done-when): a factory's demand drains a nearby stack — tugbots pull and deliver until demand quiet; a **saturated base** (no demand, no free cells, floaters everywhere) leaves containers visibly floating **without livelock** (assert: no tugbot oscillates catch-release on the same container faster than the cooldown; system reaches a stable state).
- Tests: priority order (floater beats stack-pull); claim contention (two tugbots, one container → one job); player steals claimed container → re-plan; protected-beats-proximity stacking (cell inside a bubble chosen over a nearer unprotected one); zone-edge abandon.
- Manual: watch a working base — calm, alive, legible (§2.8); verdict in PR.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Implement the E8-T1 doc; where reality forces a divergence, update the doc issue in the same PR (keep spec and code in sync).
- Every weight/cooldown/cadence in config (D8); reactive/throttled systems, no full scans per tick (guide §4).
