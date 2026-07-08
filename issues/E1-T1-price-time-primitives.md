# E1-T1 — Price + time primitives

> **Space Rocks — first iteration.** Ticket E1-T1 of Epic 1 (Foundations) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §8 (Resources, Prices, and time), especially §8.2 (the Price + time model).
2. **Plan** — issue #41: "Ground rules and platform decisions" D8 (all numbers in config) and the Epic 1 intro.
3. **vecs design guide** — `lib/vecs/docs/design-guide.md` in the `vworlds/vecs` repo: §3 (components are plain data), §8 anti-patterns. This ticket is pure shared types/helpers, but the vocabulary you define will be embedded in components later — keep it plain-data friendly (no methods on data shapes).
4. **Code** — `packages/common/src/constants.ts` (where config lives today), `packages/common/src/index.ts` (public exports).

## Goal

One cost/time vocabulary for the whole economy. Every resource cost in the game — construction, production inputs, maintenance drains, ammo — will be expressed as a `Price`, and every timed process in float wall-clock **seconds** (never ticks; robust to slowed sectors, design §3.1).

## Dependencies

None. This is a week-zero starter and unblocks everything in Epics 1–11.

## What to build

In `packages/common` (new module file, e.g. `packages/common/src/economy.ts`, exported from the package index):

1. `type Price = { ore: number; crystal: number; alloy: number }` — the tuple order `(ore, crystal, alloy)` is normative everywhere (design reconciliation note 1).
2. `type Production = { price: Price; duration: number }` — one-shot: deduct atomically, run timer (float wall-clock seconds), emit output; loops while ordered.
3. `type Maintenance = { price: Price; period: number }` — recurring: deduct every period; if unpayable on a period boundary, the maintained effect drops.
4. Helpers (pure functions, no ECS coupling):
   - `canAfford(buffer: Price, price: Price): boolean`
   - `deduct(buffer: Price, price: Price): Price` (or mutating variant — pick one, document it) — must be **atomic**: only legal when `canAfford`; never partial-pay.
   - `priceContainers(price: Price): ResourceType[]`-style expansion of a Price into its individual container units (coordinate the exact return shape with E1-T3's `ResourceType`; if E1-T3 hasn't landed, return a shape keyed by the three resource names and leave a TODO to align).
   - Consider `addPrice`, `isZero`, `ZERO_PRICE` if the tests want them — keep the surface minimal.

Keep these plain data + pure functions. No classes with behavior, no world/entity imports.

## Done when

- Unit tests in `packages/common/tests` cover: `canAfford` boundary cases (exact afford, one-short per resource), `deduct` atomic semantics (deducting an unaffordable price is impossible/throws/asserts — **no partial pay path exists**), `priceContainers` expansion (e.g. `(2,1,0)` → 2 ore units + 1 crystal unit).
- Types and helpers exported from `@spacerocks/common`.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Server-only packages must never be imported from `packages/common`.
- No tunable numbers here — this ticket defines the *vocabulary*; the actual Prices/durations land in E1-T2's config overhaul.
- Keep it dependency-free and framework-free so both server systems and client HUD code can use it.
