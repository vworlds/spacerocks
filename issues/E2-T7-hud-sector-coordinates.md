# E2-T7 — HUD sector coordinates

> **Space Rocks — first iteration.** Ticket E2-T7 of Epic 2 (Sector runtime — multi-world)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §10.2 (HUD readouts: own sector `3-1`, `BEACON: 3-2` or `BEACON: —`; two tokens of text — no minimap, no breadcrumb, no god-view), §3.1 (tiled coordinates `col-row`).
2. **Plan** — issue #41 Epic 2 intro; E9-T6 later fills the beacon slot.
3. **Code** — `apps/client/src/main.ts` and the repo's `BIG-WORLD-PLAN.md` (the `setScrollFactor(0)` screen-fixed HUD pattern referenced by the plan); `apps/client/src/constants.ts`.

## Goal

A screen-fixed HUD text readout showing the player's current sector coordinates, updating on every crossing, plus a placeholder slot for the beacon readout.

## Dependencies

- **E2-T1/E2-T5** (world names to derive coordinates from; world switching to update on). Can be developed against a single world by parsing its name.

## What to build

1. Client HUD element (Phaser text, `setScrollFactor(0)`, fixed depth above game objects): own sector coordinates in `c-r` form, derived from the current world name (`sector-<col>-<row>` → `<col>-<row>`). Single-world/legacy world names should degrade gracefully (hide the readout rather than showing garbage).
2. A second line/slot rendering `BEACON: —` for now — E9-T6 will populate it. Structure the HUD code so E4-T1's button indicators and E9-T6's beacon readout extend it rather than rewrite it (one small HUD module/file, e.g. `apps/client/src/render/Hud.ts`).
3. Update the readout on `SectorTransfer`-driven world switches (hook the E2-T5 flow; if E2-T5 isn't merged yet, read the world name at connect time and leave the hook point marked).

## Done when

- Coordinates render screen-fixed and update on every crossing (manual check on a 2×1 lattice).
- `BEACON: —` placeholder renders.
- A client test (`apps/client/tests/render` precedent) asserting the world-name → `c-r` derivation, including the degrade path.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Exactly what §10.2 specifies — resist adding arrows, distances, maps (design §3.5 forbids any enemy/location reveal).
- HUD styling values (font size, margins) in client constants, not inline literals.
