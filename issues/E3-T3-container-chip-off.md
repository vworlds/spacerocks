# E3-T3 — Container chip-off

> **Space Rocks — first iteration.** Ticket E3-T3 of Epic 3 (Mining) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. Server half of **Experiment 2** (#40 §13.2).

## Required reading

1. **Design** — issue #40 §4.1 (a full meter chips a container off the asteroid; it floats away as a FREE physics body; anyone can pick it up), §5.1 (the container state machine — this ticket implements the FREE state only), §8.1 (container look).
2. **Plan** — issue #41 D7 (module pattern), Epic 3 intro.
3. **vecs design guide** — §6 (feature module layout: `module.ts`, `components.ts`, `factories.ts`), §3 (collision categories via components).
4. **vecs-physics docs** — `lib/vecs-physics/docs/materials-and-filters.md` (collision categories/masks), `shapes.md` (child shape entities).
5. **Code** — `apps/server/src/game/modules/asteroids/` (yield/mass model), the `CAT_*` collision category bits (grep `CAT_` under `apps/server` — plan references them in `constants.ts` / `combat/module.ts`), E1-T3's resource identity + render composition.

## Goal

A new `containers` feature module owning the container entity (FREE state), plus `chipContainer(asteroid)`: spawn a container of the rock's resource type drifting off the asteroid and decrement the asteroid's yield.

## Dependencies

- **E1-T3** (resource identity/visuals), **E3-T1** (asteroid `ResourceKind`), **E3-T2** (the meter-filled hook that calls this). Later states (TRAINED E4-T2, SNAPPED E5-T4) extend this module — leave the state representation extensible (a `ContainerState`-style component or presence-based markers; presence-based fits vecs idiom: `Trained`/`Snapped` marker components, absence = FREE — decide and document for E4/E5 agents).

## What to build

1. `apps/server/src/game/modules/containers/` (D7): `components.ts` (container marker + resource type), `factories.ts` (`spawnContainer(world, pos, vel, type)`), `module.ts` (registration + any container-lifecycle systems).
2. Physics: small dynamic body, `CAT_CONTAINER` collision category (add the bit next to the existing `CAT_*` set), sensible mass/damping from config; render per E1-T3 (colored square + centered char).
3. `chipContainer(asteroid)`: spawn at the asteroid's rim with a gentle outward drift velocity (config), resource type from the asteroid's `ResourceKind`; decrement asteroid yield/mass; wire it to E3-T2's meter-filled hook.
4. Containers wrap at world bounds (movement module `Wraps`) and never hyperspace (#40 §3.4).
5. Yield accounting: chipping reduces the rock's remaining yield so E3-T4's depletion thresholds have a signal; a depleted-to-zero rock must not chip more than its remaining yield (ties bounded per E3-T2).

## Done when

- Sustained fire on an iron rock pops Ore containers; crystal rock pops Crystal (integration test through the E3-T2 meter path).
- Containers persist, drift, wrap; yield decrements per chip (tests).
- Manual: **Experiment 2 server half** — shoot-to-chip works end-to-end in the demo world.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Drift speed, container physics params — config (D8). Module pattern (D7). Collision verb dispatch stays in POST_UPDATE `SensorEvents`/`ContactEvents` cases keyed by category bits (design §2.3).
- No pickup/attach logic here — that's E4-T2 (grab) and E6-T2 (absorption).
