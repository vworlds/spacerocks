# E7-T2 — Shield HP, color, drop/restore

> **Space Rocks — first iteration.** Ticket E7-T2 of Epic 7 (Shields) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §6.4 (Crystal economics: 5-slot Crystal buffer generating demand below capacity; **maintenance** `{(0,1,0), period}` — recurring drain, unpayable on a boundary → bubble **drops** until Crystal flows; **recharge** `{(0,1,0), period, rate hp/s}` — while below max HP, regenerates at rate consuming Crystal; health display: stroke color encodes HP, green→yellow→red via the existing `shieldColor()` convention — **no HUD element**; generator destroyed/starved: bubble disappears immediately, §6.8 buffer-loot rules), §8.2 (Maintenance shape).
2. **Plan** — issue #41 Epic 7 intro ("reuse `embellishments/module.ts:74`" for `shieldColor()`).
3. **Code** — E7-T1 (bubble), E6-T2 (demand/buffer — refills the generator's buffer), E1-T1 (`Maintenance`), `apps/server/src/game/modules/embellishments/module.ts` (the `shieldColor()` green→yellow→red helper, ~line 74).

## Goal

Shield HP with visible in-world health color, plus the Crystal economy: recurring maintenance that drops the bubble when unpayable, and Crystal-fed HP recharge.

## Dependencies

- **E7-T1**, **E6-T2**, **E1-T1/T2** — hard.

## What to build

1. **HP + color**: bubble HP (max config); E7-T1's damage rows decrement it; at 0 → bubble drops (despawn/disable body) and stays down until recharged above a config re-raise threshold (design says the bubble is a damageable body; a 0-HP bubble can't block — decide drop-at-zero vs. linger and document; drop is the defensible read). Stroke color from `shieldColor(hp/maxHp)` — reuse the existing helper/convention via the networked stroke-style component (client needs no new code if the server writes StrokeStyle; verify).
2. **Buffer + demand**: the generator building's 5-slot Crystal buffer with standing demand below capacity (E6-T2; standard buffer rules — tugbots/players deliver).
3. **Maintenance system**: wall-clock period boundaries (`nextDue = now + period`); on boundary: `canAfford` → atomic deduct 1 Crystal; else **bubble drops** (disabled, not destroyed) until a later boundary (or immediate check on refill — pick the simplest correct: re-check on buffer credit) pays and re-raises it.
4. **Recharge system**: while bubble HP < max AND Crystal available: consume 1 Crystal per period, regenerating `rate` hp/s continuously during the paid period (implement as: pay to start/continue a recharge window; HP ramps at rate; window unpaid → recharge stalls, shield stays damaged).
5. Rates are per-generator config so E7-T3's efficient Main generator is pure config (§6.4).

## Done when

- Starve test (the plan's done-when): drain the buffer → maintenance boundary unpayable → bubble drops; deliver Crystal → bubble restores. Color tracks HP through damage and recharge (green→yellow→red thresholds).
- Tests: recharge consumes Crystal only while below max; no Crystal → stays damaged; maintenance and recharge draw from the same buffer without double-spend; timers are wall-clock (simulated now).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Periods/rates/maxHp/thresholds — config (D8); Price atomicity (E1-T1) at every deduct.
- No HUD element — in-world stroke only (reconciliation note 3).
