# E10-T4 — Raid loop verification

> **Space Rocks — first iteration.** Ticket E10-T4 of Epic 10 (Combat, death & elimination)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. Runs **Experiments 9 and 10** (#40 §13).

## Required reading

1. **Design** — issue #40 §13.9 (Experiment 9 — raid loop, 2 players, 1×1 lattice: break shield, grab a SNAPPED container from a stack, escape; is risk/reward legible?), §13.10 (Experiment 10 — grace-window pressure: let the starting shield buffer run to ~1 Crystal; does demand → tugbot refill → player crystal-mining pressure read from the viewport?), §6.3 (raiding), §14 (tensions to watch: grab-state confusion §14.6, tugbot thrash §14.7).
2. **Plan** — issue #41 Epic 10 intro; E11-T2's bot harness may help automate (coordinate — if the harness exists, script the scenario; else drive two manual clients).
3. **Code** — everything this exercises: E5-T5 (stack grab), E7 (shields), E8 (tugbot refill), E10-T1..T3.

## Goal

Scripted, repeatable 2-player scenarios proving the raid loop and the grace-window pressure — with findings documented and tuning knobs adjusted.

## Dependencies

- **E5-T5, E7-T1..T3, E10-T1..T3** — hard; **E8-T2..T4** for the Experiment-10 refill leg; **E11-T1** (1×1 mode) and ideally **E11-T2** (bots).

## What to build

1. **Experiment 9 scenario** (1×1): defender base with stocked stacks + live shield; raider: shoot the bubble down (or wait out a starved one — try both), fly in, grab-ON a SNAPPED brick from a wall (E5-T5: above-containers scatter), escape under turret/fighter fire. Script it as far as the harness allows (bot driving intents; server-side assertions: bubble dropped, container TRAINED by raider, raider escaped alive/dead) + a manual playthrough for feel.
2. **Experiment 10 scenario**: starting shield buffer forced to ~1 Crystal (test hook/config); observe: generator demand → tugbot pulls Crystal from stacks → buffer refills; then starve the stacks → does the player feel the "go mine Crystal" pressure from the viewport alone (bubble color/drop, tugbot behavior)? Manual observation, plus automated assertions on the refill chain.
3. **Findings document**: for each experiment — pass/fail against its design question, what read well, what didn't, grab-state confusion observations (§14.6), thrash observations (§14.7).
4. **Tuning**: adjust the involved config knobs (shield HP/drain, turret damage, grab radii, tugbot cadence) where the scenarios expose obvious misfits — one-file changes (D8); record before/after.

## Done when

- The plan's done-when: **both experiments documented with findings** (in the PR + linked from issue #41 as experiment results), **tuning knobs adjusted** with rationale.
- The Experiment-9 scripted core is committed as a repeatable integration test (even if the full raid needs manual play, the shield-break → grab → escape chain should assert server-side).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- This ticket changes config and tests, not mechanics — mechanics gaps it finds become filed issues, not drive-by patches.
- File findings issues cross-linked to #40 §13/§14.
