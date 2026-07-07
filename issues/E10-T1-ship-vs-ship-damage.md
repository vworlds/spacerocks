# E10-T1 — Ship-vs-ship damage pass

> **Space Rocks — first iteration.** Ticket E10-T1 of Epic 10 (Combat, death & elimination)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §4.3 (one weapon: shoot a ship → damage), §6.4 (friendly fire passes through friendly shields — the matrix implies an ownership-aware model; friendly fire OFF for v1 per the plan, consistent with that matrix).
2. **Plan** — issue #41 Epic 10 intro ("unify bullet damage vs ships (player + fleet) on the `Health`/`damagePlayer` path (`combat/module.ts`), ownership-aware; explosions on death"), D5 (cannibalize the kept combat helpers; then delete dead code).
3. **Code** — `apps/server/src/game/modules/combat/module.ts` (`damagePlayer`, `Health`, explosion spawn), `weapons/` (bullet dispatch), E9-T1 (fleet ships carry `Health` — verify), E6-T8 (turret bullets), E7-T1 (shield absorption happens before ship damage — masks/dispatch must compose).

## Goal

One damage model: any bullet vs any ship (player or fleet), ownership-aware (no friendly fire in v1), through the single `Health` path, with explosions on death — and the legacy damage code that this obsoletes deleted (D5 endgame).

## Dependencies

- **E9-T1** (fleet ships exist; E6-T9 placeholders acceptable as targets in the interim), **E6-T8** (turret bullets should already ride this path — verify/converge).

## What to build

1. Unify: bullets carry shooter identity (`Owner` chain — turret bullets carry the turret's owner; fleet bullets the ship's owner); POST_UPDATE bullet×ship dispatch (all `CAT_SHIP`-ish categories — align player and fleet ship categories or dispatch both) → same-owner: no damage (friendly fire off, v1); different owner: `damagePlayer`-path damage (rename/generalize to `damageEntity` if it's player-specific — buildings (E6-T1) and shields (E7) should ideally share the health/damage core; refactor conservatively).
2. Explosions on any ship death (players have this; fleet ships must too — reuse the effect).
3. Asteroid-vs-ship collision damage: verify the existing behavior still stands for fleet ships (they need it for avoidance stakes; if the legacy path was player-only, generalize).
4. **Delete dead code** (D5's endgame): with the new combat epic underway, remove the unplugged legacy modules (`aliens/`, `pickups/`) *if* E8-T2 has extracted the avoidance math it needed (coordinate — if not extracted yet, extract it to a shared helper here and then delete).
5. Damage numbers per bullet source/ship type — config (D8).

## Done when

- The plan's done-when: **two clients can kill each other** (manual + automated two-session network test); fleet ships die correctly (explosion, E4-T5 cargo drop for loaded carriers, cell unclaim for parked fighters).
- Tests: friendly fire no-op (own fleet, own turret bullets); cross-owner damage lands; shield-absorbed bullets never reach the ship (compose with E7-T1); turret/fighter/player bullets all converge on the one path.
- Legacy deletion complete (or explicitly deferred with the extraction done and an issue filed).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- One health/damage core — no per-shooter-type damage forks (the matrix stays in dispatch, not in damage math).
- Config damage tables (D8).
