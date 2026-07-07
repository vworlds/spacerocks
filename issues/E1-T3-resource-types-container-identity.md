# E1-T3 — Resource type & container identity

> **Space Rocks — first iteration.** Ticket E1-T3 of Epic 1 (Foundations) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §8.1 (resource catalog: Ore/Crystal/Alloy, colored squares with a centered character).
2. **Plan** — issue #41 Epic 1 intro, D6 (wire protocol), D8 (config).
3. **vecs design guide** — `lib/vecs/docs/design-guide.md` in `vworlds/vecs`: §3 (small single-purpose components, networked component order = protocol), §10 case study (how `Rectangle` + `Text` render components flow to the client with no per-entity render code).
4. **Code** — `packages/common/src/network/schema.ts` (`NETWORK_COMPONENTS` — note the "ORDER IS THE PROTOCOL" comment), `packages/common/src/color.ts`, and how existing server factories set `Rectangle`/`Text`/`FillStyle` render components (grep `Rectangle` under `apps/server/src/game/modules`).

## Goal

Ore/Crystal/Alloy as data: a shared `ResourceType` identity with per-type color and display character, consumable by server factories and rendered by the existing client render pipeline as a colored square with a centered character (retro look).

## Dependencies

- **E1-T1** (Price primitives) — soft dependency: `priceContainers` should align with `ResourceType`; land the alignment here if E1-T1 merged first.

## What to build

1. In `packages/common` (e.g. `packages/common/src/resources.ts`, exported from the index):
   - `ResourceType` enum (or string-literal union — match repo style): `Ore`, `Crystal`, `Alloy`.
   - Per-type display map: `{ color: number; char: string }` (e.g. Ore = grey/brown "O", Crystal = cyan/magenta "C", Alloy = silver/white "A" — pick legible, visually distinct values; they're config, not logic).
   - Container visual size constant (meters) if not already in config (coordinate with E1-T2).
2. Demonstrate identity → render: a container entity is a `Rectangle` (square, per-type `FillStyle`) plus a centered `Text` child or same-entity `Text` — whichever composition the existing wire components support (check `@vworlds/vecs-phaser`'s `phaserNetworkComponents`: `Rectangle` and `Text` are exclusive renderables on one entity, so the character is likely a **child entity** with `Text` — mirror how `embellishments` composes child visuals).
3. If a networked component is needed for resource identity on the wire (e.g. clients need to know a container's type beyond its color), **append** it to `NETWORK_COMPONENTS` and update the protocol snapshot test. Prefer deriving visuals purely from the existing render components (no new wire component) if that suffices — the design only requires the *look*.

This ticket does **not** build the container state machine (that's E3-T3/E4/E5) — just identity + look.

## Done when

- A hand-spawned container entity (test or demo world) renders as a colored square with its centered character on the client.
- Unit test: display map covers every `ResourceType`; types/colors/chars exported from `@spacerocks/common`.
- If the wire schema changed: snapshot test updated in the same commit (D6).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Colors/characters/sizes are data in the shared module or config — no literals at spawn sites (D8).
- `NETWORK_COMPONENTS` is append-only; never reorder (D6).
- Server-only packages must never be imported from `packages/common` or `apps/client`.
