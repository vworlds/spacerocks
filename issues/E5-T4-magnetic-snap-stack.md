# E5-T4 — Magnetic snap + stack

> **Space Rocks — first iteration.** Ticket E5-T4 of Epic 5 (Planetoid & magnetic snapping)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. Core of **Experiment 4** (#40 §13.4).

## Required reading

1. **Design** — issue #40 §6.2 (magnetic snapping: FREE container touching the planetoid snaps to the closest snap point; touching a SNAPPED container stacks aligned into an adjacent surface-grid cell; free-space check before sticking else bounce; max height 5; simultaneous snap: deterministic contact order, first claims, second bounces), §5.1 (SNAPPED never auto-attaches; released only by deliberate grab or host destruction).
2. **Plan** — issue #41 D4 (teleport-lerp now; evaluate `MotorJoint` pull after E1-T5 — mark `TODO(1.0.40)`), risk register ("Snap/stack feel: MotorJoint option post-1.0.40; instant-snap fallback").
3. **vecs-physics docs** — `bodies.md` (static bodies; writing Position = teleport), `events.md` (contact events).
4. **Code** — E3-T3 (container module + state representation), E5-T3 (surface grid), E4-T2 (TRAINED exclusion).

## Goal

Jettisoned/free containers click into aligned stacks on the planetoid: snap on touch to the nearest free cell, stack on touch with an existing SNAPPED container, bounce when the target is invalid or full-height, with deterministic claim resolution.

## Dependencies

- **E5-T3** — hard; **E3-T3/E4-T3** (FREE containers arriving with velocity).

## What to build

1. POST_UPDATE contact cases in the containers/planetoid modules (category-pair dispatch, design §2.3):
   - FREE container × planetoid → `closestSnapPoint`; if free → SNAP; else bounce (do nothing — physics bounce).
   - FREE container × SNAPPED container → the adjacent/above cell per the touched container's cell; if free and height < 5 → SNAP aligned; else bounce.
   - TRAINED and seeds excluded (state guards; seeds are E6-T3's case).
2. **SNAP mechanics**: claim the cell in the occupancy index, then place: teleport-lerp to the cell pose (short config-duration lerp from touch pose to cell pose — kinematic or direct Position writes), then freeze: static in the planetoid frame (switch `Body.type` to static, or kinematic pinned — the planetoid never moves so static is simplest) while **keeping contact events on** (grabbing needs touch detection, E5-T5). Mark the placement code `TODO(1.0.40): evaluate MotorJoint pull` (E1-T5).
3. **Deterministic simultaneous claims**: server processes same-tick contacts in deterministic order (entity id) — first claims, second fails free-space and bounces (§6.2 gap-fill). The claim must be transactional within the tick (claim on dispatch, not on lerp completion).
4. SNAPPED containers never auto-attach to passing ships (E4-T2's attach case must exclude SNAPPED — verify/add the guard).

## Done when

- Tests: snap to nearest free cell; stack aligned above/adjacent; height-6 attempt bounces; occupied-cell attempt bounces; concave-invalid cell bounces; same-tick double-touch → one snaps, one bounces (deterministic winner by entity id); SNAPPED ignored by train attach.
- Manual (**Experiment 4 element**): jettison waves visibly click into aligned Tetris-like stacks; record the feel verdict in the PR.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Lerp duration/snap radius in config (D8); module pattern (D7).
- State machine fidelity to §5.1 — SNAPPED release paths are E5-T5 (grab) and host destruction (E6-T1/E10); don't add others.
