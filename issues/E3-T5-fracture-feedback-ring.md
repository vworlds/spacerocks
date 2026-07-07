# E3-T5 — Own-meter feedback ring

> **Space Rocks — first iteration.** Ticket E3-T5 of Epic 3 (Mining) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §4.1 feedback gap-fill: "each client renders **only its own** fracture meter, as a subtle progress ring on the asteroid being mined. Other players' meters are invisible to you."
2. **Plan** — issue #41 Epic 3 intro (per-client `View.dsl` filter by `Owner` — the interest-grid pattern).
3. **vecs design guide** — §3 (networked components), §10 (embellishment-style child entities).
4. **Code** — `apps/server/src/game/modules/embellishments/` (child-entity visual pattern — the plan calls out progress rings as an Embellishments use case), `apps/server/src/game/modules/interestGrid/` (how per-client views filter entities), `packages/common/src/network/schema.ts`, `packages/common/src/components/Owner.ts`.

## Goal

While a player mines a rock, that player — and only that player — sees a subtle progress-ring arc on the asteroid showing their own fracture meter.

## Dependencies

- **E3-T2** (meter values to project) — hard.

## What to build

1. A networked `FractureProgress { value }` component (append to `NETWORK_COMPONENTS` + snapshot test, D6) living on a **child embellishment entity** of the asteroid, one per actively-mining *player* shooter, carrying `Owner` = that player.
2. Server system projecting the E3-T2 meter map into these child entities reactively: create on first accrual, update value on change (throttle to meaningful deltas — config epsilon — to keep wire traffic sane), destroy when the meter entry decays away or the rock splits/dies (`ChildOf` cleanup should cover rock death — verify).
3. **Per-client visibility**: filter the entity to the owning shooter's client via the per-client `View.dsl` filter by `Owner` (the same machinery the interest grid uses — study `interestGrid/` and the vecs-server view API; NPC shooters get no ring entity at all).
4. Client render: arc stroke (progress ring) positioned over the asteroid — follow the embellishments client conventions; subtle styling (thin stroke, config).

## Done when

- Two-client test (network test precedent in `apps/server/tests/network`): both mine the same rock; each client's replicated view contains only its own `FractureProgress` entity.
- Ring value tracks fill and disappears on chip/decay/split (server tests).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- The meter store itself stays server-local (E3-T2); only the owner's projected value rides the wire.
- Append-only wire schema + snapshot test (D6); styling and epsilon knobs in config (D8).
