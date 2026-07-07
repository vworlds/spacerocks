# E4-T4 — Train dynamics tuning + mid-train loss

> **Space Rocks — first iteration.** Ticket E4-T4 of Epic 4 (Cargo trains) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. Carries **Experiment 3** (#40 §13.3).

## Required reading

1. **Design** — issue #40 §5.3 (containers make the ship slower and less agile — an emergent physics effect of dragging jointed mass, not a scripted debuff; degree depends on ship type — a tug carries more easily; noticeable but not punishing; mid-train loss: chain re-joints, the following container links to the previous one), §13.3 (Experiment 3: 3-container train through an asteroid field — dangerous and skillful, or annoying?).
2. **Plan** — issue #41 Epic 4 intro.
3. **vecs-physics docs** — `bodies.md` (Damping), `joints.md` (DistanceJoint spring/damper knobs), `materials-and-filters.md` (density → mass).
4. **Code** — E4-T2 (train module, joint knobs), E3-T6 (asteroid impacts destroy containers — your mid-train trigger).

## Goal

Trains feel right ("slower, not immobilized") with per-ship-type carrying character, and a destroyed/yanked middle container heals the chain instead of splitting the train.

## Dependencies

- **E4-T2**, **E4-T3** — hard; **E3-T6** (container destruction events). Per-ship-type differences beyond the all-rounder become real with E9 ships — land the knobs per type now, tuned for the all-rounder.

## What to build

1. **Feel pass**: tune container mass/density, linear/angular damping, joint rest length/stiffness/damping per ship type (config table keyed by ship type; all-rounder tuned now). Target: a 3-container train noticeably slows acceleration and widens turns, but top-speed/handling stays playable (design: "noticeable but not punishing").
2. **Mid-train loss**: when a TRAINED container is destroyed (asteroid impact per E3-T6) or otherwise leaves the chain, re-joint: the following container links to the previous one (or the ship if it was first); update the train representation ordering. Drive it reactively off the container entity's destruction (component/entity `exit` — guide §4; the joint entity teardown is automatic per physics lifecycle, your job is creating the healing joint + fixing the links).
3. Build the **Experiment 3 course**: a repeatable dev/test scene (seeded field dense enough to matter) to fly the train through — can be a test-mode spawn preset; document how to launch it.

## Done when

- Automated: destroy the middle container of a 3-train → chain heals to 2 links, order correct, no dangling joint entities.
- Automated: acceleration with 3 containers is measurably lower than empty (assert a ratio window from config so tuning doesn't break the test).
- Manual (**Experiment 3**): fly the course; record the verdict (dangerous+skillful vs annoying) and the chosen knob values in the PR description.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Every tuning value in the config table (D8) — the balance pass (E11-T4) re-sweeps them.
- No scripted speed debuffs — the slowdown must come from physics mass/joints (design §5.3).
