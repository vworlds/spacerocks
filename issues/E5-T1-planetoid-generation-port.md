# E5-T1 — Planetoid generation port

> **Space Rocks — first iteration.** Ticket E5-T1 of Epic 5 (Planetoid & magnetic snapping)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.
> **This is feasibility risk #2 and the schedule risk of the whole plan — start first.**

## Required reading

1. **Design** — issue #40 §6.1 (planetoid: massive, non-mineable, static, Box2D chain, random concave areas/hideouts/caves/tunnels; segments of equal size = container size + visual margin; max turn angle θ=30°; favors runs of angle-0 segments — usable flat surfaces; flat surfaces are multiples of container size — the surface-grid grammar).
2. **Plan** — issue #41 Epic 5 intro + risk register ("Start first; polygon fixture fallback keeps E5–E6 unblocked").
3. **Code** — `packages/common/src` (where this lands — pure and seedable), the `rng` module's seedable RNG idiom, E1-T2/E1-T3 (container unit size constant).

## Goal

The external-research surface-generation algorithm lives in-repo as a pure, seedable `packages/common` module: given a seed + knobs, emit a deterministic planetoid — vertex loop + per-segment metadata (snap point, flatness).

## Dependencies

- Container unit size (E1-T2/T3). **Nothing downstream should wait on perfection**: if the port slips, deliver the documented interface backed by a hand-authored polygon fixture (the risk-gate fallback) so E5-T2+ proceed, and keep porting.

## What to build

1. Locate the external research source: check the repo/org for the referenced algorithm (ask in the PR if it isn't discoverable — the design says "external research, being ported into the repo"; issue #40 §15 lists it as a leverage point). If genuinely unavailable, implement from the spec in §6.1: closed loop of equal-length segments (container size + margin), successive turn angle ≤ 30°, biased toward angle-0 runs, self-intersection-free, with concavities/caves emerging from the angle distribution.
2. API (pure, seedable, no ECS/physics imports): `generatePlanetoid(seed, knobs) → { vertices: Vec2[], segments: SegmentMeta[] }` where `SegmentMeta` = `{ snapPoint: Vec2, angle: number, flat: boolean, runId?: number }` (coordinate the exact shape with E5-T3's surface grid — it consumes this).
3. Knobs (config): segment length (derived from container size + margin), max turn angle (30°), flat-run bias, target circumference/segment count, concavity frequency. Document each knob.
4. **Property tests** (this is the ticket's spine): segment length uniformity (all equal within epsilon), angle bound (every turn ≤ 30°), flat-run distribution (bias produces runs — statistical assertion over many seeds), closed non-self-intersecting loop, determinism (same seed → identical output).
5. The hand-authored **polygon fixture** (a small valid planetoid as data) ships regardless — it's the test fixture and the E5-T2 fallback.

## Done when

- Deterministic planetoids from a seed; property tests green over a seed sweep.
- Knobs documented (doc comments or a short md next to the module).
- Fixture exported for downstream tests.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Pure + seedable, `packages/common`, framework-free (server builds physics from it in E5-T2; tests import it directly).
- All knobs config-fed (D8); no `Math.random`.
