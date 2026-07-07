# E3-T2 — Per-shooter fracture meters

> **Space Rocks — first iteration.** Ticket E3-T2 of Epic 3 (Mining) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §4.1 (per-shooter fracture meter: fills on hit, decays when idle; progress not stealable; any entity's weapon hits accrue to its own meter; same-tick tie → each chips its own container in deterministic entity order, bounded by remaining yield; meter resets after chip), §4.2 (all meters reset on split/fracture).
2. **Plan** — issue #41 Epic 3 intro + risk register ("Fracture meter perf (N×M): server-local map, interval decay, no networking of meters").
3. **vecs design guide** — §4 (`.interval` throttling; reactive over scanning), §2 (POST_UPDATE collision dispatch).
4. **Code** — `apps/server/src/game/modules/weapons/` (the existing bullet-hit POST_UPDATE dispatch path that currently splits asteroids on hit), `asteroids/components.ts`, `asteroids/splitting.ts`.

## Goal

Shooting a rock fills the shooter's own meter on that rock instead of instantly splitting it; a full meter chips a container (E3-T3) and resets; idle meters decay. Server-local, cheap, deterministic.

## Dependencies

- **E1-T2** (fill/decay knobs in config). **E3-T3** consumes `onMeterFilled` → chip; until it lands, emit a placeholder event/log. E3-T4 changes what splitting means — this ticket only *stops* hit-splitting and owns the meter lifecycle.

## What to build

1. A server-local (NOT networked) meter store on the asteroid entity: a component holding `Map<shooterEntityId, meterValue>` (plain component, never in `NETWORK_COMPONENTS` — meters are per-shooter private data, plan risk register).
2. Route the existing bullet→asteroid POST_UPDATE dispatch to `accrueFracture(shooter, asteroid)` instead of instant split: bullet ownership (`Owner`/shooter identity) determines whose meter accrues; works for any shooting entity (players now, miner ships in E9-T2 — key by entity, not by player session).
3. Fill semantics: accrual per hit from config; on reaching full — emit the chip hook (E3-T3) and reset **that shooter's** meter; same-tick multi-fill processed in deterministic entity order (ascending entity id), each chip bounded by the asteroid's remaining yield (§4.1 gap-fill).
4. Decay system: `ON_UPDATE` with `.interval(sweepPeriod)` draining idle meters by a config rate; delete zeroed entries (keep the map from growing); an entry is "idle" if not hit since the last sweep (track a last-hit stamp per entry).
5. Reset-all-on-split hook: exported so E3-T4 calls it when a rock splits/fractures (§4.2).
6. Cleanup: meters die with the asteroid entity (component lifecycle handles this if the map lives on the asteroid — verify).

## Done when

- Tests: fill→chip-hook→reset; decay on idle (partial meter drains to zero and entry removed); two shooters accrue independently and stealing never happens; same-tick tie yields two chip events in entity-id order, bounded by remaining yield; meters reset on split.
- Perf sanity: sweep is `.interval`-throttled; no per-tick scan of all asteroids (guide §4).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Meters are never networked (the client-visible ring is E3-T5's separate component).
- Fill amount, decay rate, sweep period — config (D8). Module pattern (D7): this extends the asteroids/weapons modules; put meter ownership where the data lives (asteroids) and dispatch where hits are handled (weapons) — keep imports acyclic (guide §6).
