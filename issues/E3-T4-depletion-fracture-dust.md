# E3-T4 — Depletion → fracture → dust

> **Space Rocks — first iteration.** Ticket E3-T4 of Epic 3 (Mining) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §4.2 (depletion: chipping depletes the rock; sufficiently depleted → fractures into smaller mineable pieces — the existing split mechanic reused as a depletion consequence, not a combat action; fragments mineable further; eventually dust, disappears; mining legibly changes field geometry; all meters reset on fracture/split).
2. **Plan** — issue #41 Epic 3 intro.
3. **Code** — `apps/server/src/game/modules/asteroids/splitting.ts` (existing split), `decay/` (`Decay` TTL — the dust path already exists), E3-T2 (meter reset hook), E3-T3 (yield accounting).

## Goal

Mining a rock to exhaustion plays out as: chips deplete yield → threshold crossings fracture the rock into smaller pieces (fresh meters) → smallest fragments become dust and disappear.

## Dependencies

- **E3-T2** (reset-all-meters hook), **E3-T3** (yield decrement) — hard.

## What to build

1. Depletion thresholds (config): when a rock's remaining yield crosses a threshold for its size class, call the existing `splitAsteroid` as a **depletion consequence** — no score, no combat coupling (E1-T4 removed scoring; verify none leaks back).
2. Fragment yields: children partition the parent's remaining yield (config rule — e.g. proportional to fragment size); kinds inherited (E3-T1).
3. On any split/fracture: call E3-T2's reset-all-meters; fragments start with fresh (empty) meter maps.
4. Dust: fragments below the minimum size class get the existing `Decay` TTL treatment and disappear; make sure their residual yield is small/zero so the finite-economy books roughly balance (a rock's total chip count should approximate its configured yield — assert loosely in tests).
5. Keep combat-driven splitting working if bullets still split rocks anywhere — per the new design they should NOT (hits accrue meters instead, E3-T2); verify the only remaining `splitAsteroid` trigger paths are depletion and (if retained) asteroid-vs-asteroid physics events.

## Done when

- Test: mining a rock to exhaustion ends in dust (entity count returns to zero for that lineage); meters reset on split; fragments mineable.
- Test: total containers chipped from one rock ≈ configured yield (within the partition rounding).
- Manual: a mined-out field is legible at a glance (many small rocks/dust where big rocks were).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Thresholds, partition rule, dust TTL — config (D8).
- Reuse `splitAsteroid` and `Decay` — don't fork parallel mechanisms (plan: "reusing the existing split mechanic").
