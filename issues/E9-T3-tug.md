# E9-T3 — Tug

> **Space Rocks — first iteration.** Ticket E9-T3 of Epic 9 (Fleet) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §7.2 (Tug: `(1,0,2)`/25s, train limit 6, default role "haul loose containers near base to demand points"; override "Haul from beacon" is E9-T5's; tugs carry heavy loads more easily — per-type train dynamics from E4-T4), §5.3 (type-dependent slowdown).
2. **Plan** — issue #41 Epic 9 intro ("complements tugbots at ship scale, train 6, config").
3. **Code** — E9-T1 (framework), E9-T2 (the miner's collect/deliver states — heavy reuse potential; share state components/helpers where honest), E8-T4 (tugbot dispatch — the tug is the *ship-scale* cousin: bigger capacity, not station-bound; don't duplicate the claim discipline — reuse the claim components).

## Goal

The tug's default role: sweep loose FREE containers in the base area into demand points/stacks, six at a time.

## Dependencies

- **E9-T1**, **E4 (trains)**, **E6-T2 (demand)** — hard. E8's claims (shared discipline) — coordinate if E8-T4 landed; otherwise land a compatible claim component and note it for E8.

## What to build

1. **Sweep**: find FREE containers in the base zone (own Main/docking zone radius — config; unclaimed — share the container-claim discipline with tugbots so tugs and tugbots don't fight over the same floater); collect up to train limit 6 (multi-pickup route: nearest-next heuristic is fine).
2. **Deliver**: demand points first (E6-T2, type-matched: jettison the matching container at the demanding building — train rotation logic NPC-side to bring the right container to front, or simpler: deliver in train order to whatever demands it; pick the simplest visible-correct behavior and document), else stack surplus (release at stack cells — snapping does the rest).
3. Idle: no floaters, no demand → park near base.
4. Train dynamics: 6-limit config + E4-T4's per-type carrying character (tug hauls heavy more easily — its config row).
5. Self-preservation reflex applies (E9-T1).

## Done when

- The plan's done-when: a tug clears a scattered debris field near the base into stacks/buildings unattended (sim test: N containers scattered → all snapped/absorbed within a time budget; no stuck states).
- Tests: respects claims (tugbot-claimed floater skipped); type-matched delivery; 6-limit enforced; idle-park.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Zone radius, heuristics, limits — config (D8).
- Reuse miner/tugbot state helpers and claim components — three haulers, one discipline.
