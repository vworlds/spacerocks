# E10-T3 — Elimination

> **Space Rocks — first iteration.** Ticket E10-T3 of Epic 10 (Combat, death & elimination)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §11.2 in full ("a player is eliminated when their main building is destroyed" — single, structural, server-checkable; elimination cascade gap-fill: everything the player owns — ships, tugbots, buildings, the `ChildOf` ownership graph — destroyed over a short cascade, each entity firing its **normal** destruction-loot rules (§6.8, §5.4); the raider's reward is a base's worth of loose containers; eliminated player sees an elimination screen and becomes a passive spectator; same-tick rule: Main dies on the tick a respawn would complete → elimination wins, respawn cancelled; if the player is alive, the cascade includes their ship — elimination is immediate either way).
2. **Plan** — issue #41 Epic 10 intro.
3. **Code** — E6-T1/E6-T6 (Main destruction observable), E10-T2 (pending-respawn cancellation hook), the ownership graph decisions from E9-T1/E8-T3 (fleet/tugbots reachable via `ChildOf` from a player anchor — verify completeness NOW: every owned entity type must be in the graph or the cascade misses it), `playerSessions/` (session end/spectator), E4-T5/E6-T8 loot rules.

## Goal

Main destroyed → owner eliminated: pending respawn cancelled, everything they own cascaded to destruction (normal loot per entity), and their client dropped to a spectator elimination screen.

## Dependencies

- **E6-T6**, **E10-T1/T2**, and the ownership-graph hygiene from E8-T3/E9-T1 — hard.

## What to build

1. **Trigger**: Main building (type Main + `Owner`) destroyed → eliminate that owner. Cancel any pending respawn (E10-T2's hook; same-tick: elimination wins).
2. **Cascade**: walk the owner's `ChildOf` ownership graph (audit first: buildings sit on the graph? tugbots (E8-T3: yes, by decision)? fleet ships (E9-T1's decision)? construction sites? the live player ship? — fix gaps as part of this ticket) and destroy each entity **over a short stagger** (config; a few entities per tick or timed waves — the design wants a visible demise, not an atomic wipe), each via its normal destruction path so normal loot fires (§6.8 buildings, §5.4 cargo, shield buffers).
3. **The player**: alive → their ship dies in the cascade (immediate elimination regardless); session enters `eliminated`: input dead, camera stays (spectator of the base's demise), an elimination screen overlay client-side (a networked session-state flag → client overlay; simple text is fine).
4. Beacon/session cleanup (E9-T6); the session stays connected as spectator (rejoin/late-join is deferred, §12).
5. **Win condition awareness**: last-player-standing handling is NOT specified for v1 — do not invent one; eliminated players spectate, the world runs on. Note it in the PR if it feels missing (it goes to #40 §16).

## Done when

- The plan's done-when: **integration test on 1×1** — raider destroys the defender's Main → defender eliminated: pending respawn cancelled (kill the defender 1s before Main death to force the race — same-tick rule tested), full cascade (assert zero remaining entities owned by the defender), base becomes a loot field (loot counts match per-entity rules), defender session in spectator (input rejected server-side).
- Tests: cascade stagger (not all on one tick); each entity type loots normally; alive-player variant (ship included).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- One condition — Main destroyed. No resource predicates, no other elimination paths (§11.2).
- Cascade timing config (D8); loot via existing per-entity destruction paths — no cascade-special loot code.
