# E4-T6 — Convoy hyperspace

> **Space Rocks — first iteration.** Ticket E4-T6 of Epic 4 (Cargo trains) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. Closes **Experiment 8** (#40 §13.8).

## Required reading

1. **Design** — issue #40 §3.4 (the cargo train jumps together with the ship as a single convoy; physics not honored 100% during the jump; arrival collision rule covers any convoy member).
2. **Plan** — issue #41 D3 (convoy variant of the transfer helper: relationships/joints rebuilt on the destination side), E2-T6 (clearance includes the train).
3. **Code** — E2-T3 (`transferEntity` + convoy variant), E2-T4 (crossing system), E2-T6 (clearance nudge), E4-T2 (train representation + joints).

## Goal

A hyperdrive-armed ship towing a train crosses a sector boundary as one unit: containers, joint topology, relative offsets and velocities all arrive intact; the arrival nudge accounts for the whole convoy footprint.

## Dependencies

- **E2-T3/T4/T6** and **E4-T2** — hard. This is an integration ticket: most work is wiring + hardening, not new mechanics.

## What to build

1. Extend/finish E2-T3's convoy variant for real trains: enumerate the convoy from the train representation (ship + ordered TRAINED containers), snapshot poses/velocities/resource types, destroy in src under `Transferring` (no cargo drop — E4-T5 guard), recreate in dst and **rebuild** joints + train links in order.
2. Wire E2-T4's crossing to use the convoy variant whenever the ship has a train.
3. Extend E2-T6's clearance to the convoy footprint: the nudge must clear every member (conservative: bounding circle over the chain, or per-member checks along the arrival vector) — the design's arrival rule covers "the ship (or any convoy member)".
4. TRAINED state and no-regrab/grace flags survive the move (whatever E4-T2/T3 store must be on the transfer whitelist).
5. Escorts note: E9-T5's "Follow me" ships jump as convoy members later — keep the convoy enumeration open to non-container members (design §3.4: assembly = convoy membership), even if only trains use it now.

## Done when

- **Experiment 8** automated: a loaded 3-container ship crosses a boundary cleanly **10/10 times** (scripted loop test): joints intact, order preserved, offsets/velocities within epsilon, no containers left in src, no loot fired.
- Arrival-into-obstacle test with a train: whole convoy placed clear, intact.
- Manual 2×1 flight with cargo both directions; client swap (E2-T5) looks seamless with the train.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- One transfer helper (D3) — extend E2-T3; do not fork a train-specific mover.
- Mirror production module deps in test worlds (guide §6).
