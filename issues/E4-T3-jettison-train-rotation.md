# E4-T3 — Jettison + train rotation

> **Space Rocks — first iteration.** Ticket E4-T3 of Epic 4 (Cargo trains) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §5.5 (jettison always releases the container **closest to the ship**, shooting it forward slower than a bullet; hold = wave; train rotation: containers teleport-swap 1→3, 2→1, 3→2, no physics/visual effects — resource selection without a cursor), §10.1 (S = rotate; btn2 = jettison).
2. **Plan** — issue #41 Epic 4 intro.
3. **Code** — E4-T1 (edge-triggered intents), E4-T2 (train representation, joints), `weapons/` (bullet speed constant — jettison speed must be slower, config-related).

## Goal

Jettison pops the front (closest-to-ship) container forward as FREE with a no-regrab grace; holding produces a wave. Train rotation teleport-swaps container positions so the player can bring any resource to the front.

## Dependencies

- **E4-T1**, **E4-T2** — hard.

## What to build

1. **Jettison** (on the E4-T1 intent): take the front container: break its joint, re-joint the next container directly to the ship (chain shortens from the head), set the released container FREE with a forward impulse along the ship's facing (speed = config, < bullet speed), and a short **no-regrab grace** (a timed tag, e.g. reuse the `Decay`-style timer or a `NoRegrab { until }` component checked by E4-T2's attach case) so it isn't instantly re-attached (§ plan). Hold = wave: each repeat intent releases the next front container.
2. **Train rotation** (on the rotate intent): teleport-swap the container *bodies'* positions/joint anchors in the pattern 1→3, 2→1, 3→2 (front goes to back, everyone advances) — the design says the **containers swap positions**, not the labels: physically swap body poses (write `Position` — physics treats it as a teleport, see `bodies.md`) while keeping the joint chain topology fixed. No impulses, no VFX (§5.5). Guard: rotation with 0–1 containers is a no-op; with 2, a swap.
3. Watch solver stability: swapping poses inside joint constraints can pop — do the swap in one tick (all writes before the next physics step), keep swapped poses at the same chain offsets, and test for explosion (velocities bounded after rotate).
4. Jettisoned-container outcomes (§5.5 list — absorbed/snap/stack/bounce) belong to E5/E6; here it just becomes FREE with velocity.

## Done when

- Tests: jettison always releases the current front; chain re-joints head correctly (n → n−1 links); wave release on held intent (3 containers in ~3 repeat intervals); released container not re-grabbed during grace but grabbable after; rotation permutes order 1→3, 2→1, 3→2 (assert via the train representation) with no solver explosion (velocity magnitude bounded).
- Manual: rotate-then-jettison selects the intended resource (**Experiment 3 element**).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Jettison speed, grace duration, hold-repeat cadence — config (D8).
- No targeting UI, no front-selection input — always-front is the design (§5.5).
