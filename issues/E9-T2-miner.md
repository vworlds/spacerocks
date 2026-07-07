# E9-T2 — Miner

> **Space Rocks — first iteration.** Ticket E9-T2 of Epic 9 (Fleet) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §7.2 (Miner: `(2,0,1)`/25s, train limit 3, default role "find nearest unmined asteroid, mine, haul to base"; override "Mine near beacon" is E9-T5's), §4.1 (miners accrue their own fracture meters — any entity's weapon hits accrue to that entity's meter).
2. **Plan** — issue #41 Epic 9 intro (sequenced first among roles).
3. **Code** — E9-T1 (framework + doc), E3-T2 (meters key by entity — verify miner hits accrue), E4-T2 (train mechanics — miners tow like players), E5-T4/E6-T2 (delivery targets: stacks/demand near base).

## Goal

The miner's default role: an unattended mine → haul → deliver → repeat loop that grows base stock.

## Dependencies

- **E9-T1** — hard; **E3 (mining)**, **E4 (trains)** — hard. Cross-sector behavior is E9-T5's override scope; default miners stay in-sector.

## What to build

Role systems per the E9-T1 pattern, state as components:

1. **Find**: nearest asteroid in-sector with remaining yield, not claimed by another friendly miner (a simple claim component prevents dogpiles; first-wins discipline as in E8) — prefer "unmined" (no active friendly claim, yield high) per the catalog wording.
2. **Mine**: position at weapon range (reuse steering: seek/arrive + avoidance), shoot the rock (miners use the standard weapon path so E3-T2 meters accrue to the miner entity); chip-offs spawn FREE containers nearby.
3. **Collect**: grab its own chipped containers (miners have grab semantics? — tugbot-style: NPC ships bypass the player grab toggle; attach via the E4-T2 train path with an NPC-permission guard; train limit 3 from config).
4. **Haul home**: train full (or rock exhausted with cargo) → fly near the base (its owner's Main/nearest own docking zone) → deliver: jettison at stacks/demand — simplest per the plan: "deliver near base (jettison at stacks/demand)": release containers in the base zone and let snapping/absorption/tugbots do the rest; repeat.
5. **Mined-out sector**: no minable rock → return and park near base (idle state; resumes if new rocks appear — they won't in the finite economy, but fragments count).
6. Self-preservation (E9-T1 reflex) interrupts appropriately: retaliate while attacked, resume the loop after.

## Done when

- The plan's done-when: a miner runs the full loop **unattended for 10 minutes** (sim test at accelerated tick if the harness allows; else a long-running integration test) — base stock (containers snapped/absorbed in the base zone) measurably grows; no stuck states (assert the state component keeps cycling).
- Tests: claim prevents two miners on one rock; full-train → haul; exhausted-sector → park; retaliation interrupt/resume.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- All ranges/thresholds config (D8); no new mining/train mechanics — compose E3/E4's (if something's missing there, fix it there).
- In-sector only (default role never crosses boundaries — §3.4/§7.4).
