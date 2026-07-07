# E3-T1 — Asteroid resource types

> **Space Rocks — first iteration.** Ticket E3-T1 of Epic 3 (Mining) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §8.1 (Ore from iron-type asteroids — most rocks; Crystal from crystal-type — rarer, visually distinct), §3.6 (composition is a tuning knob).
2. **Plan** — issue #41 Epic 3 intro.
3. **Code** — `apps/server/src/game/modules/asteroids/components.ts` (the `Asteroid` component), `asteroids/factories.ts`/spawn path, how asteroids get their render components (fill/stroke), `packages/common/src/color.ts`.

## Goal

Two visually distinct rock kinds in the field: iron (yields Ore) and crystal (yields Crystal), with the mix controlled by a config ratio.

## Dependencies

- **E1-T3** (`ResourceType`) — hard: the asteroid's kind maps to the resource its containers will carry (E3-T3).

## What to build

1. Add `ResourceKind` (iron → Ore, crystal → Crystal) to the `Asteroid` component (or a sibling component if cleaner — prefer a field on `Asteroid` since every asteroid has exactly one kind; guide §3 favors small components but absence isn't meaningful here).
2. Visual distinction on the client via existing networked render components (fill/stroke color per kind — colors from the E1-T3/`color.ts` palette, not literals). If kind must ride the wire beyond color, append a component to `NETWORK_COMPONENTS` + snapshot test (D6) — prefer color-only if sufficient (clients don't need the kind for logic).
3. Composition ratio knob in config (share it with E2-T8's per-sector composition; if E2-T8 isn't merged, apply the ratio in the current `fillInitialAsteroids`).
4. Splitting (`asteroids/splitting.ts`): fragments inherit the parent's kind.

## Done when

- The field shows two visually distinct rock types at the configured ratio (manual check + a spawn test asserting the ratio over a seeded fill).
- Fragments keep their parent's kind (test).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Ratio and colors in config/shared palette (D8).
- Wire changes append-only + snapshot test (D6).
