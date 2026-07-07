# E8-T5 — Zone chaining (A overlap + B jettison-toward)

> **Space Rocks — first iteration.** Ticket E8-T5 of Epic 8 (Logistics) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **E8-T1's design doc** (filed issue) — demand propagation across zones, hop limits, type-tagging; this ticket implements the multi-zone half.
2. **Design** — issue #40 §6.9 zone chaining ("both mechanisms coexist; the player chooses by placement: **A — overlap handoff** (certain, investment-heavy): overlapping influence radii form a shared zone; one station's tugbot drops the container there, the other's picks it up. **B — jettison-toward** (cheap, risky): a tugbot with a container and no local demand carries it to its zone edge and jettisons toward the nearest other station; the container floats FREE across the gap; the receiving station's tugbots catch it — or it drifts off and may be lost or snatched. Chains are bidirectional").
3. **Code** — E8-T3 (zone overlap queries), E8-T4 (dispatcher — remote-demand entries plug into its demand sources; the receiving side's floater priority does the catching).

## Goal

Containers flow between stations both ways: reliably through overlapping zones, and cheaply-but-riskily via jettison across gaps — driven by propagated remote demand.

## Dependencies

- **E8-T1 (doc)**, **E8-T3**, **E8-T4** — hard.

## What to build

1. **Remote demand propagation** (per the doc): a station aggregates unmet typed demand and exposes it to neighbor stations (overlap graph; hop limit from the doc); E8-T4's dispatcher gains the "remote demand" job source: pickup → hand off **toward the demanding zone**.
2. **A — overlap handoff**: hand-off = carry to the shared (overlap) region, release/stack there (per the doc: drop as FREE in the shared zone, or drop to a stack cell if one exists), claim released; the receiving station's own dispatch (floater priority) takes it from there. No teleporting responsibility — two independent dispatchers cooperating through world state.
3. **B — jettison-toward**: a tugbot carrying with no local demand and a known remote demand (or per the doc's rules, also the no-demand surplus case? — the design text says "no local demand"; follow the doc) carries to its zone edge nearest the target station and jettisons along the station-to-station vector (E4-T3-style release with config impulse); the container floats FREE across the gap — genuinely lossy: no tracking, no guarantee (it may drift away or be snatched — that's design intent, don't "fix" it).
4. **Bidirectional**: nothing directional in the implementation — outpost→main and main→outpost fall out of demand location (test both).
5. Loop prevention: hop limit + claim/cooldown discipline from the doc — a container must not ping-pong between two zones (test the two-station-mutual-demand pathological case).

## Done when

- The plan's done-when: a two-station chain moves Ore from an outpost stack to the Main's factory **both** via overlap handoff and via jettison-toward (two test topologies: overlapping, gapped); bidirectional variant passes.
- Tests: hop-limit respected on a 3-station line; ping-pong case stable; jettisoned container that misses is simply FREE (no leak of claims); receiving-station catch works through the normal floater priority (no special receive code).
- Manual: watch a chain run — the design's "pleasant to watch" bar; verdict in PR.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Implement the doc; divergences update the doc issue in the same PR.
- Jettison impulse, edge margins, hop limit, propagation cadence — config (D8).
