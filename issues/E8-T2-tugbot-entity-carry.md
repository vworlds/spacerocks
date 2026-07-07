# E8-T2 — Tugbot entity + carry

> **Space Rocks — first iteration.** Ticket E8-T2 of Epic 8 (Logistics) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. Closes **Experiment 5** (#40 §13.5).

## Required reading

1. **Design** — issue #40 §6.9 (tugbots: very small autonomous drones, `(1,0,0)`/8s, not hyperdrive-capable — wrap, never cross sectors; carry one container at a time — a 1-length train; **bypass the grab toggle** — may pick SNAPPED containers off any stack directly; destroyed while carrying → drops the container FREE), §2.8 (pleasant to watch — tugbots must look alive).
2. **Plan** — issue #41 Epic 8 intro ("steering: seek/arrive, asteroid avoidance can reuse alien avoidance math before its deletion"), D4 (MotorJoint for carrying after 1.0.40 — mini-train joint now).
3. **Code** — `apps/server/src/game/modules/aliens/` (avoidance/steering math to cannibalize — E1-T4 kept it in-tree for you), E4-T2 (train joint mechanics — reuse for the 1-length mini-train), E5-T5 (`extractFromStack` tugbot variant), E6-T2 (demanding buildings absorb on contact — your delivery is just "fly the container into the building").

## Goal

The tugbot: a tiny autonomous drone that can fly to a target, extract/catch a container, carry it as a 1-length train, and deliver by contact — the physical layer E8-T4's dispatcher drives.

## Dependencies

- **E4-T2** (joints), **E5-T5** (stack extraction), **E6-T2** (absorption) — hard. E8-T3 (stations) owns spawning/ownership; E8-T4 owns *choosing* targets — this ticket's behaviors take explicit targets (scriptable API).

## What to build

1. Tugbot entity (`modules/tugbots/` or within the logistics module set — coordinate naming with E8-T3/T4; D7): tiny dynamic body, `CAT_TUGBOT`, distinct minimal render, `Owner`, wraps at bounds, never hyperspaces (no armed state, E2-T4's non-armed path).
2. **Steering**: seek/arrive at a target point/entity (accelerate, decelerate on approach, face travel direction) + local obstacle avoidance (asteroids, planetoid) — port/adapt the alien avoidance math (cannibalize per D5: lift it into a shared helper rather than importing from `aliens/`). Config: max speed, accel, arrive radius, avoidance weights. **Look-alive matters** (§2.8): damping/curves over teleport-y motion.
3. **Carry**: pick up FREE (catch: touch while assigned) or SNAPPED (via E5-T5's `extractFromStack` — bypasses grab toggle by design) → joint the container behind (1-length mini-train reusing E4-T2's joint mechanics; mark `TODO(1.0.40): MotorJoint carry` per D4); carrying capacity exactly 1.
4. **Deliver**: fly the carried container into contact with the target demanding building → E6-T2 absorbs it (release the joint on absorption — the container entity is destroyed; verify the joint entity cleans up) — or release at a stack target (jettison-style gentle release; E5-T4 snapping does the rest).
5. **Death**: destroyed while carrying → container drops FREE (reuse E4-T5's carrier-death release — it was built carrier-agnostic).
6. Scriptable behavior API for tests + E8-T4: `assignJob(tugbot, job)` where job = fetch(container)→deliver(target) | catch(floater)→… — keep it data (components), vecs-idiomatic (state as components, not a BT engine — same rule as E9-T1).

## Done when

- **Experiment 5** scripted test (the plan's done-when): tugbot flies to a stack, extracts a container (instant reflow per E5-T5), delivers it to a demanding construction site — absorbed on contact.
- Tests: catch a drifting floater; killed mid-carry drops the container; never crosses a boundary (wraps); avoidance clears a simple asteroid obstacle course.
- Manual: watch it work — "does autonomous logistics look alive?" — record the verdict in the PR.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- All steering/carry knobs config (D8); module pattern (D7).
- No target *selection* here (E8-T4); no station logic (E8-T3).
