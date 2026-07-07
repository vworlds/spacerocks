# E9-T6 — Beacon

> **Space Rocks — first iteration.** Ticket E9-T6 of Epic 9 (Fleet) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §10.3 (a beacon is an unconfigured virtual point — marks a location, nothing else; **one per player**, re-drop moves it; dropped at the player's current position via slow-button — always somewhere the player has been, no blind sends; visible **only to its owner**, rendered when in viewport; exists as an order reference regardless; stale beacons are the player's problem), §10.2 (HUD `BEACON: c-r` readout, `BEACON: —` when absent).
2. **Plan** — issue #41 Epic 9 intro ("server-side on session, networked only to owner via view filter").
3. **Code** — E2-T7 (the HUD slot you fill), E4-T1/E2-T4 (the slow-zone intent surface — add the drop input), E3-T5 (per-owner view filtering precedent — reuse the mechanism), `playerSessions/`.

## Goal

The per-player beacon: a slow-button drop at the ship's position, one per player (re-drop moves), owner-only visibility, cross-sector order reference, and the HUD readout.

## Dependencies

- **E2-T7**, **E4-T1** (intent surface), the view-filter mechanism (E3-T5 or the interest-grid machinery). **E9-T5** consumes `beaconRef` — land before or with it.

## What to build

1. **Drop input**: slow-zone key/button (coordinate with the E2-T4/E4-T1 intent shape) → server records the beacon: position + sector (world name) on the player's session state; re-drop **moves** it (one per player, §10.3).
2. **Server representation**: session-scoped data + a networked beacon entity in the beacon's sector world (a small marker renderable), **view-filtered to the owner's client only** (the per-owner filter mechanism from E3-T5/interest grid). Note the player may be in a *different world* than their beacon — the beacon entity lives in its sector's world and simply isn't replicated to anyone else; the owner sees it only when connected to that world and it's in viewport (§10.3's "rendered when in viewport" + "exists as an order reference regardless").
3. **Order reference API**: `getBeacon(playerId) → { sector, pos } | none` — E9-T5's beacon orders read this (cross-sector: the reference includes the sector; ships navigate by it).
4. **HUD readout**: fill E2-T7's slot: `BEACON: c-r` (sector coords of the beacon), `BEACON: —` when none — needs the beacon's sector networked to the owner (session-state component filtered to owner, or derive client-side from the beacon entity when co-world + a tiny networked readout component otherwise; pick the simplest that works cross-sector and document).
5. Lifecycle: beacon survives player death/respawn (nothing in the design clears it — stale is the player's problem); cleared on elimination (session gone).

## Done when

- Tests: drop → recorded at ship position/sector; re-drop moves (never two); owner-only replication (two-client test: other client's view has no beacon entity); readout correct cross-sector (`BEACON: 3-2` while player is in `3-1`), `—` when absent.
- Integration with E9-T5 (if landed): a beacon order references it cross-sector (the plan's done-when).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- No beacon configuration menu — removed by design (§10.4, issue-11 resolution); no attract-types, no labels (deferred).
- Wire additions append-only + snapshot test (D6); render/marker styling config (D8).
