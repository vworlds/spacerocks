# E7-T3 — Starting shield + efficient rate

> **Space Rocks — first iteration.** Ticket E7-T3 of Epic 7 (Shields) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. Enables **Experiment 10** (#40 §13.10).

## Required reading

1. **Design** — issue #40 §6.4 ("the starting shield is a normal shield with a pre-filled buffer (5/5 Crystal); the Main's built-in generator runs at a more efficient maintenance rate (config knob), making 5 Crystal ≈ 30 minutes of grace; built generators run at the standard rate; the pre-fill is real Crystal in a real buffer — lootable on destruction like any buffer, no special case"), reconciliation note 2 (the starting shield is NOT free), §13.10 (Experiment 10: grace-window pressure — let the buffer run to ~1 Crystal; does demand → tugbot refill → player crystal-mining pressure read from the viewport?).
2. **Plan** — issue #41 Epic 7 intro.
3. **Code** — E7-T1/T2 (generator + economics), E6-T6 (the Main's composition mount for the built-in generator), E6-T1 (destruction loot: 40% of buffers).

## Goal

The Main's built-in shield generator: a standard E7 generator at an efficient config rate with a pre-filled 5/5 Crystal buffer — giving new players ≈30 minutes of shield grace to learn the Crystal loop.

## Dependencies

- **E7-T1/T2**, **E6-T6** — hard.

## What to build

1. Wire the built-in generator into the Main's factory composition (E6-T6's mount): a shield generator component set on/childed to the Main (decide with E6-T6's structure: the Main IS the generator building — same entity carrying both building type and generator components — or a child; prefer whatever keeps "no special case" true: same components as a standalone Shield Generator, different config row).
2. Config: `mainShieldMaintenance` period/rate such that 5 Crystal ≈ 30 min grace (i.e. period ≈ 6 min at 1 Crystal per boundary — derive and document the arithmetic next to the knob); standard generators keep the standard rate (E1-T2).
3. Pre-fill: buffer starts 5/5 **real** Crystal (not a flag): destruction loot (§6.8 40% of buffers) must see it; demand stays quiet until it drains below capacity.
4. Verify the whole E6-T6 boot done-when now holds: fresh player world = planetoid + Main + starting shield (+ 5 tugbots once E8-T3 lands).

## Done when

- Tests: fresh Main has a live bubble + 5/5 buffer; buffer drains at the efficient rate (simulated clock: first drop no earlier than the derived grace if undamaged and unfed); a standalone built generator drains at the standard rate; destroying the Main releases `floor(0.4 × remaining Crystal)` containers (no special case).
- Base survives "asteroid rain" (test: sustained asteroid impacts damage the bubble, not the Main, while HP lasts).
- Manual (**Experiment 10** setup): run the buffer to ~1 Crystal, watch demand → refill pressure; record the read-from-viewport verdict in the PR.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Config-only differentiation from standard shields (D8; §6.4 "no special case").
- The grace target (~30 min) is a balance intent — E11-T4 re-measures it; land the derivation, not magic numbers.
