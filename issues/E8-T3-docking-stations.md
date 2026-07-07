# E8-T3 — Docking stations (and Main as one)

> **Space Rocks — first iteration.** Ticket E8-T3 of Epic 8 (Logistics) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §6.9 docking stations (2 segments; construction `(2,0,0)` pure raw — a logistics-first build order is viable pre-Factory; seed `(1,0,0)`/5s; starts empty; produces and fields **up to 5 tugbots** at the tugbot Price and **replenishes destroyed ones** — each replacement costs the Price, losing tugbots is not free; no ongoing drain; influence radius = `tugbotInfluenceRadius` config, same for all stations; **the Main IS a standard docking station** — fields 5, same radius, same production/replenishment, no special case), §9 (catalog row).
2. **Plan** — issue #41 Epic 8 intro.
3. **Code** — E6-T1/T4 (buildable), E6-T5 (production framework — tugbot production `(1,0,0)`/8s), E6-T6 (Main composition mount), E8-T2 (tugbot entity).

## Goal

The `DockingStation` capability: a building component that fields up to 5 tugbots, produces replacements at cost, and defines the influence zone tugbots operate in — registered identically on standalone stations and the Main.

## Dependencies

- **E6-T1/T5**, **E8-T2** — hard; **E6-T6** (Main registration). E8-T4's dispatcher reads your zone/fielded-tugbot state.

## What to build

1. `DockingStation` **component** (not a building subclass — composition, so the Main carries it too): `{ maxTugbots: 5, influenceRadius: config }` + tracking of fielded tugbots (relationship: tugbot `ChildOf`/`FieldedBy` its station — pick with E8-T2/E8-T4; `ChildOf` gives elimination-cascade cleanup for free, §11.2 — prefer it and document).
2. Standalone Docking Station building type registration: 2 segments, construction `(2,0,0)`, seed from catalog; on completion the station component activates.
3. **Field + replenish**: while fielded < max, keep a standing tugbot production order on the framework (`(1,0,0)`/8s from the station's own Ore buffer → E6-T2 demand pulls the Ore in): station starts empty and fills to 5 as Ore arrives; a destroyed tugbot lowers the count → production resumes → **each replacement costs the Price** (§6.9 — falls out of the framework; test it).
4. **Zone**: influence radius around the station — the geometric authority for E8-T4 ("a tugbot never leaves its influence radius"). Expose zone membership/overlap queries (station-to-station overlap for E8-T5's shared zones).
5. Main registration: E6-T6's mount gets this same component (5, standard radius, standard production) — config only, zero special code (§9).

## Done when

- Tests: built station + fed Ore → fields up to 5 tugbots; kill one → exactly one replacement produced at 1 Ore cost; no Ore → no replacement (and demand shows it); Main fields 5 identically; radius/overlap queries correct.
- Boot integration (with E6-T6/E7-T3): fresh player world = planetoid + Main + starting shield + 5 tugbots — the Epic 6 done-when completes here (Main starts with enough Ore buffered to field its initial 5, or they field as the player delivers — **check the design**: §9 says Main "fields 5 tugbots" from the start; pre-fill the Main's Ore buffer for the initial 5 via config, mirroring the shield pre-fill pattern, and document the choice).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- One component, no Main special case (§6.9/§9); all knobs config (D8).
- Tugbot ownership/cleanup via the ownership graph (elimination cascade needs it, §11.2).
