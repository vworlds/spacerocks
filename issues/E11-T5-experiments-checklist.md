# E11-T5 — Experiments checklist run

> **Space Rocks — first iteration.** Ticket E11-T5 of Epic 11 (Playtest harness, soak & balance)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. **The final gate.**

## Required reading

1. **Design** — issue #40 §13, all ten experiments (each validates one assumption; several were exercised inside their owning tickets — this run executes the checklist as a whole, on the finished build):
   1. Two-sector handoff (E2-T5)
   2. Fracture meter + chip-off + grab-ON auto-attach (E3/E4-T2)
   3. Train towing through asteroids (E4-T4)
   4. Planetoid + snapping + shield + explicit-jettison delivery (E5-T4/E6/E7)
   5. Tugbot moves one container to a demanding site (E8-T2)
   6. Shipyard fighter: park/engage/land + die→5s→respawn (E9-T4/E10-T2)
   7. Tap ship → Follow me + escort jump (E9-T5)
   8. Train + sector boundary convoy (E4-T6)
   9. Raid loop, 2 players, 1×1 (E10-T4)
   10. Grace-window pressure (E7-T3/E10-T4)
2. **Plan** — issue #41 Epic 11 intro; the per-ticket PRs above recorded their first-run verdicts — collect them.

## Goal

Execute all ten design experiments on the integrated build, file findings as issues, and leave issue #41 with a pass/fail note per experiment — the evidence the first iteration proves its loop.

## Dependencies

- Everything (E1–E10, E11-T1/T2). Run when the PvP-provable milestone is assembled.

## What to do

1. For each experiment: run it on the integrated `dev` build (scripted where harnesses exist — E10-T4/E11-T2 — manual otherwise; 2-player experiments on the 1×1/2×1 presets with a second human or bot), against the design's *question* (each §13 entry asks one — answer that question, not just "it works").
2. **File findings as issues**: one issue per experiment with a finding worth acting on (bug, feel-miss, tuning need), labeled and cross-linked to #40 §13; trivial passes need no issue, just the note.
3. **Report on #41**: a comment with the ten-row checklist — experiment, pass/fail, one-line verdict, links to findings issues (the plan's done-when: "each experiment has a pass/fail note linked here").
4. Where a run contradicts an earlier per-ticket verdict (things integrate badly), say so explicitly — that's the value of the final run.

## Done when

- All ten executed on the integrated build; the checklist comment posted on issue #41; findings issues filed and linked.
- Any run that required code/config fixes to complete has those landed via normal PRs (this ticket itself should be near-codeless: scenario scripts/preset tweaks at most).

## Constraints

- Answer the design questions (§13's phrasing) — "passes" without the feel verdict is an incomplete run.
- Findings are issues, not drive-by patches.
