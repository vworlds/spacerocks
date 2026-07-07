# E6-T2 — Demand + buffer + absorption-on-contact

> **Space Rocks — first iteration.** Ticket E6-T2 of Epic 6 (Buildings, construction & production)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.
> **This is the load-bearing delivery mechanic** — player jettison, tugbot logistics, and stray
> drift all deliver through this one rule (#40 §6.5).

## Required reading

1. **Design** — issue #40 §6.5 (delivery is a property of the building: any building with an active demand absorbs a FREE container of a demanded type on contact; matching types only — mismatch bounces; FREE only — TRAINED never yanked), §6.7 (buffers: small per-input-type internal buffer ~5; demand = fill the buffer while an order is active; Prices atomic).
2. **Plan** — issue #41 Epic 6 intro.
3. **vecs design guide** — §4 (reactive recompute over scanning).
4. **Code** — E6-T1 (buildings), E3-T3 (container states), E1-T1 (Price helpers).

## Goal

The unified demand/buffer/absorption machinery: buildings declare per-resource wanted counts; FREE containers of a demanded type are absorbed on contact (container destroyed, buffer/progress credited); everything else bounces.

## Dependencies

- **E6-T1**, **E3-T3**, **E1-T1** — hard. Consumers: construction sites (E6-T4), producers (E6-T5), turret ammo (E6-T8), shield buffers (E7-T2), docking stations (E8-T3), and tugbot dispatch reads demand (E8-T4).

## What to build

1. `Demand` component (per-resource wanted counts) + `Buffer` component (per-resource held counts, capacity from config ~5 per input type). Demand is **recomputed reactively** from its source: buffer gaps while an order is active (E6-T5 sets/clears orders), construction remainder (E6-T4). Provide `recomputeDemand(entity)` or reactive systems watching Buffer/order changes — no per-tick scans (guide §4).
2. **Absorption**: POST_UPDATE sensor/contact case FREE-container × demanding building (`CAT_CONTAINER` × `CAT_BUILDING`): type demanded → destroy the container, credit `Buffer` (or construction progress), decrement demand; type not demanded → nothing (physics bounce). TRAINED/SNAPPED/seeds exempt (state guards; seeds have their own case, E6-T3).
3. Demand must be **readable by tugbot dispatch** (E8-T4) and eventually type-tagged across zones (E8-T1) — keep the component queryable (`.with(Demand)` + per-type counts public).
4. Multiple same-tick absorptions: bounded by remaining demand — two containers hitting a demand-1 building → one absorbed, one bounces (deterministic entity order — same discipline as E5-T4 claims).
5. A visual cue for "this building wants X" is NOT in scope (the design relies on world legibility; E6-T4 adds construction ghosts/progress).

## Done when

- Tests: jettisoned matching FREE container absorbed on contact (destroyed + buffer credited); mismatch bounces (container survives); TRAINED fly-through never yanked; demand hits zero → subsequent contacts bounce; same-tick over-delivery bounded by demand; buffer capacity respected.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Buffer sizes from config (D8); atomic-Price discipline — absorption credits whole units only (containers are unit-sized by definition).
- One rule, no per-consumer absorption forks: construction/production/turrets/shields all express *demand* and this system does the absorbing (§6.5).
