# E11-T4 — Balance sweep pass

> **Space Rocks — first iteration.** Ticket E11-T4 of Epic 11 (Playtest harness, soak & balance)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §14 (tracked tensions — the "time bombs" this pass defuses), §9 rationale (train-limit rule: one all-rounder trip per building; the intended progression), §6.4 (≈30 min shield grace intent).
2. **Plan** — issue #41 Epic 11 intro ("one session tuning the #39/#40 §14 time bombs: fracture fill/decay, train stiffness, tugbot speed×radius, factory push, shield drains, ship costs — all one-file (D8)") and D8.
3. **Code** — `packages/common/src/constants.ts` (everything you touch lives here — if a tunable turns out NOT to be in config, that's a bug to fix first), E11-T2 (bots to measure with), E2-T2/E11-T3 (instrumentation).

## Goal

One deliberate tuning session with measurements: the economy/feel knobs land inside design intent, verified by instrumented runs, not vibes.

## Dependencies

- **E1–E10 playable**, **E11-T1/T2** (modes + bots) — hard. Late-stage by nature.

## What to build

1. **Measurement scripts** (bot-driven where possible): time-to-first-fighter (boot → mine → factory → shipyard → fighter, scripted optimal-ish play); shield grace window (undisturbed Main buffer lifetime); mining trip economics (one all-rounder trip = one building's price? — the §9 rationale); fracture fill/decay feel points (shots-to-chip at design cadence); tugbot throughput (containers/min per station at reference layout).
2. **The sweep**: adjust — fracture fill/decay, train joint stiffness/damping (with E4-T4's feel notes), tugbot speed × influence radius, factory output push, shield maintenance/recharge drains, ship/building prices if measurements demand — every change one-file (D8).
3. **Targets** (the plan's): time-to-first-fighter *lands inside design intent* (derive the target from the progression rationale and state it), grace window ≈ 30 min, one-building-per-trip holds.
4. **Record**: before/after per knob + measurement, in the PR and a committed `docs/balance-notes.md` (or similar) so the next sweep has provenance.

## Done when

- The plan's done-when: time-to-first-fighter and grace-window measurements land inside design intent (~30 min grace; one building per mining trip), evidence attached.
- Measurement scripts committed and re-runnable; balance notes committed.
- `npm run typecheck --workspaces` and `npm run test` pass (feel-dependent tests from earlier epics use config-derived windows — verify none hard-coded old values; fix ratio-window tests that break by design).

## Constraints

- Config-only changes (D8) — mechanics changes discovered here become issues.
- Every adjustment justified by a measurement or a documented feel verdict.
