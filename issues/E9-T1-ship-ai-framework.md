# E9-T1 — Ship AI framework

> **Space Rocks — first iteration.** Ticket E9-T1 of Epic 9 (Fleet) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.
> Epic 9 is feasibility risk #3; the mitigation is **framework before roles, role-per-ticket,
> captain last**. This ticket is the framework.

## Required reading

1. **Design** — issue #40 §7.2 (catalog: default roles + overrides per type), §7.4 (hybrid command: default autonomous roles; overrides persist until revoked; revoke → default role in the current sector; stranded ships keep operating; ships with overrides still self-preserve — return fire if attacked).
2. **Plan** — issue #41 Epic 9 intro ("role components (`DefaultRole`, `Override {kind, beaconRef}`), per-role behavior systems (state as components, vecs-idiomatic — **no BT engine**), self-preservation reflex, spawn-from-shipyard wiring replaces E6-T9's placeholder").
3. **vecs design guide** — §3/§4/§7 (state as components; reactive systems; relationship retargeting for "which mode am I in" — retarget/replace a small component instead of building a state-machine engine).
4. **Code** — E6-T9 (placeholder spawn + `ShipType`), E8-T2's steering helpers (shared seek/arrive/avoidance — lift to a common location if E8-T2 landed them tugbot-local), `weapons/targeting.ts`, `combat/` (damage events for the self-preservation trigger).

## Goal

`modules/fleet/`: the role architecture every ship AI (E9-T2..T4, T7) plugs into — role components, per-role behavior systems, the self-preservation reflex, and real spawns from the shipyard.

## Dependencies

- **E6-T9** (shipyard spawns) — hard; **E8-T2** steering (shareable). Roles land in E9-T2..T4; overrides UI in E9-T5; this ticket ships with one trivial role (park) to prove the shape.

## What to build

1. `apps/server/src/game/modules/fleet/` (D7): components — `ShipType` (from E6-T9, may move here), `DefaultRole { kind }` (kind from the catalog per type), `Override { kind, beaconRef? }` (absent = default behavior; presence = active override; beacon reference by player/session id — beacons are per-player, E9-T6). Role *state* is per-role components owned by the role systems (e.g. `MiningState { targetRock }`) — small, composable, vecs-idiomatic; **no behavior-tree engine, no generic FSM library** (plan's explicit rule).
2. **Behavior dispatch**: each role = one or more systems querying `ShipType` + role/state components (e.g. `.with(ShipType, DefaultRole).without(Override)` for defaults; `.with(Override)` routes by kind). Document the pattern (this framework doc is a deliverable — "framework documented for role authors" is the plan's done-when).
3. **Self-preservation reflex**: any fleet ship taking damage → return fire at the attacker while it stays in range/hostile (a `Retaliating { attacker }` state component + a system; works under both default and override — it's a reflex, not a role; §7.4).
4. **Spawn wiring**: replace E6-T9's `PlaceholderShip` with real fleet ships: `spawnFleetShip(world, type, pos, owner)` sets physics/render/weapons/health per type (config) + `DefaultRole` — ship starts its default role immediately (§7.3).
5. Trivial **park role** included: fly to a clear spot near spawn and hold — proves the dispatch shape; E9-T4 replaces it with real parking.
6. Ownership: fleet ships in the owner's `ChildOf` graph? — decide with E10-T3 (elimination cascade destroys "everything the player owns... the ChildOf ownership graph", §11.2): fleet ships must be reachable from the player's graph. Prefer `ChildOf` the player session/anchor entity; document.

## Done when

- Test: shipyard produces a fighter-type ship → it runs the trivial park role unattended (moves, settles, idles); taking damage → returns fire at the shooter; killed → normal death (explosion, cargo rules N/A).
- Framework doc (md in the module folder): how to add a role — components, system shape, phase choices, config.
- E6-T9's placeholder path removed/redirected.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- State as components; reactive/throttled systems; no `.each` full scans for idle ships (guide §4).
- Per-type stats config (D8); module pattern (D7).
