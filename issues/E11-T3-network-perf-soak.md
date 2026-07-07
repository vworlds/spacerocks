# E11-T3 — Network/perf soak

> **Space Rocks — first iteration.** Ticket E11-T3 of Epic 11 (Playtest harness, soak & balance)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Plan** — issue #41 Epic 11 intro + risk register ("Networked joint trains: joint filters + interpolation soak early"), E2-T2 (the recorded 25-sector tick baseline this extends), E2-T5 (reconnect storms).
2. **Code** — `apps/server/tests/network` (the existing network tests to extend), E11-T2 (bot harness), E2-T2's timing instrumentation.

## Goal

Multi-world network and performance characteristics measured, budgeted, and regression-gated: reconnect storms, joint-train replication smoothness, and the 25-sector + 4-player tick budget.

## Dependencies

- **E2 (sector runtime)**, **E4-T2 (trains)**, **E11-T2 (bots)** — hard.

## What to build

1. **Reconnect storms**: automate E2-T5's soak — a bot performing rapid sector crossings (10+ in quick succession, repeatedly): assert stability, no session/entity leaks server-side, client view consistent after each swap.
2. **Joint-train replication**: a bot towing a 3-train at 30Hz while another session observes: measure replicated pose smoothness (inter-frame position deltas of chain members — jitter metric) and assert against a budget; this is the risk-register's "interpolation soak" — if smoothness is unacceptable, file the tuning issue with data (interpolation is client-side render work; don't fix it here unless trivial).
3. **Tick budget**: 25 sectors + 4 bot players active (mining/hauling): per-sector and total `progress()` cost sampled over a soak window; record budgets (extend E2-T2's baseline records — a committed budgets file, e.g. `ci/perf-budgets.json`).
4. **Regression gating**: CI job (nightly with E11-T2, or separate) failing on budget regression beyond a tolerance; budgets updatable deliberately, not silently.
5. Snapshot/bandwidth sanity: bytes-per-second per client under the 4-player scenario recorded (informational — the planetoid vertex payload from E5-T2 and container swarms are the suspects).

## Done when

- The plan's done-when: budgets recorded; regressions gate CI.
- All three scenario suites green and repeatable; findings (jitter numbers, budget headroom) in the PR description.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Measure on defined reference conditions (CI machine class documented next to the budgets) — perf gates that flake get deleted; build in tolerance.
- No gameplay changes from this ticket — file issues with data instead.
