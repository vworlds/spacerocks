# E6-T5 — Production framework

> **Space Rocks — first iteration.** Ticket E6-T5 of Epic 6 (Buildings, construction & production)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §6.7 (buffers + production: order active → demand fills buffer; Prices atomic — deduct full input Price, run `duration`, emit output, repeat while ordered; output ejection: free area adjacent to the building, scan starts at a random spot in the building's frame, gentle push to drift away; no free area → item stays inside, production **halts**, blocked-status icon shows above the building — not a silent soft-lock; inputs held, not refunded; resumes when space frees), §8.2 (Production shape `{price, duration}` — wall-clock seconds).
2. **Plan** — issue #41 Epic 6 intro + risk register ("Silent soft-locks: blocked icon is part of the framework ticket, not polish").
3. **Code** — E1-T1 (`Production`, `canAfford`, `deduct`), E6-T2 (Buffer/Demand), `embellishments/` (status-icon child entities), `rng` (seeded random for the scan start).

## Goal

The generic producer: any building with an active production order pulls inputs through its buffer, runs a wall-clock timer, and ejects outputs — with the blocked-state behavior built in. Factory (E6-T7), turret conversion (E6-T8), shipyard (E6-T9), seed/tugbot production (E6-T6, E8-T3) all run on this.

## Dependencies

- **E1-T1**, **E6-T1/T2** — hard. Order-setting UX is E6-T10 (radial menu); until then orders are set programmatically/tests.

## What to build

1. `ProductionOrder { recipeId | recipe }` component (set/cleared by E6-T10 later): while present, the building's Demand includes the recipe's input gaps (E6-T2 recompute).
2. Producer system: order present + `canAfford(buffer, price)` → **atomic deduct** → start `duration` timer (**wall-clock now-based**, not tick counts — store `readyAt = now + duration`; robust to slowed sectors, §8.2) → on expiry, attempt output emission → repeat while ordered. Partial buffer never advances anything (atomicity tests from E1-T1 apply at this level too).
3. **Output emission** — recipe outputs are either container-like entities (Alloy containers, seeds) or ships (E6-T9 provides the spawn hook): find a free area adjacent to the building — scan around the building's frame starting at a seeded-random offset; free = no overlap with planetoid/buildings/containers (physics overlap query); spawn there with a **gentle push** outward (config impulse); then normal container rules apply.
4. **Blocked state**: no free area → hold the finished output internally, set `ProductionBlocked` → an Embellishments child status icon above the building (networked via existing embellishment components; visible from the viewport); halt further cycles; a cheap `.interval` retry frees it when space opens → icon clears, held output ejects, cycles resume. Inputs already consumed are held, never refunded (§6.7).
5. Recipe registry in config (E1-T2): factory recipe, seed recipes, tugbot, ship entries — data, not code.

## Done when

- Tests: atomicity (buffer 1-short → nothing deducted, no timer); wall-clock duration honored (simulated `now`); ejection places output in free space with drift; fully-enclosed building → blocked icon appears, production halts, inputs held; space freed → resumes, icon clears; loop-while-ordered produces N outputs from N×price inputs.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- All recipes/impulses/scan knobs in config (D8); timers in float seconds, never ticks (§8.2).
- Blocked icon ships with this ticket — it is framework, not polish (risk register).
- Module pattern (D7); reuse E6-T2's demand rather than duplicating buffer logic.
