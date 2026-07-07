# E4-T2 — Train attach + joints

> **Space Rocks — first iteration.** Ticket E4-T2 of Epic 4 (Cargo trains) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. Client-feel half of **Experiment 2** (#40 §13.2).

## Required reading

1. **Design** — issue #40 §5.1 (state machine: FREE → TRAINED on touch with grab ON), §5.2 (grab toggle; full train → container bounces off; per-ship-type limit, all-rounder 3), §5.3 (train = jointed physics chain; slowdown is emergent, not scripted).
2. **Plan** — issue #41 D4 (trains use `DistanceJoint` on 1.0.39) + risk register ("Networked joint trains: joint filters + interpolation soak early").
3. **vecs-physics docs** — `lib/vecs-physics/docs/joints.md` in `vworlds/vecs` (joint entities: `JointBodyA`/`JointBodyB` + `DistanceJoint` + `JointFrame`; `FilterJoint` for disabling collision between connected bodies), `materials-and-filters.md`.
4. **Code** — `containers` module (E3-T3, container states), E4-T1 (grab state), `apps/server/src/game/modules/playerShips/`.

## Goal

`modules/trains/`: touching a FREE container with grab ON and train below the ship-type limit joints it to the train's tail; the container becomes TRAINED; a full train bounces containers off; grab OFF ignores containers entirely.

## Dependencies

- **E3-T3** (containers), **E4-T1** (grab state) — hard. E4-T3/T4/T5/T6 build on your train representation — document it.

## What to build

1. `apps/server/src/game/modules/trains/` (D7). Train representation: ordered chain ship → c1 → c2 → c3. Recommended: a relationship/link component per trained container (`TrainedBy { target: ship }` + `TrainLink { prev }`-style) so order is queryable and E4-T3's rotation and E4-T4's re-joint have something structural to work with (guide §3 relationships; not networkable — the client sees only physics poses, which is all it needs).
2. Attach: POST_UPDATE contact case ship-shape × FREE-container (grab ON, `trainLength < limit(shipType)` from config): create a `DistanceJoint` entity linking the new container to the current tail (ship if empty), plus collision filtering so the train doesn't collide with its own ship (FilterJoint or group index — decide via `materials-and-filters.md`; document the choice); set TRAINED state (per the state representation E3-T3 chose).
3. Joint tuning: rest length, stiffness/damping (`DistanceJoint` spring params if enabled) from config — E4-T4 does the feel pass; just expose knobs.
4. Full-train and grab-OFF cases: no joint, natural bounce (no special physics needed — just don't attach; §5.2 gap-fill).
5. TRAINED containers: never auto-snap, never absorbed (guard flags for E5/E6 — set the state so their systems can exclude).

## Done when

- Test: fly-through with grab ON picks up 3 containers into a following chain (joint entities exist, order recorded); 4th touch does not attach; grab OFF attaches nothing.
- Test: train containers don't collide with their own ship; do collide with asteroids.
- Manual (**Experiment 2 feel**): chain follows visibly and smoothly on the client at 30Hz — note interpolation verdict in the PR (risk register).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Train limits per ship type, joint params — config (D8).
- Joints/relationships are server-local; never networked (guide §3, D6 untouched).
- Module pattern (D7); collision verb in POST_UPDATE category case (design §2.3).
