# E11-T1 — Lattice test modes

> **Space Rocks — first iteration.** Ticket E11-T1 of Epic 11 (Playtest harness, soak & balance)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §3.1 (lattice dims are config; 5×5 design target; 2×1 and 1×1 reduced lattices as test harnesses to guarantee player contact and prove the fight loop fast), §11.3 (reduced lattices make PvP contact reliable in playtests).
2. **Plan** — issue #41 Epic 11 intro.
3. **Code** — E2-T1 (lattice config + env override — the mechanism exists; this ticket productizes it), `ci/` (existing CI setup), `README.md` (dev workflow docs).

## Goal

First-class, documented, CI-verified presets: `1x1`, `2x1`, `5x5` — selectable by env var, each booting correctly.

## Dependencies

- **E2-T1/T2** — hard.

## What to build

1. Env-selectable presets (e.g. `LATTICE=1x1 npm run dev:server`): preset = lattice dims + anything else a mode needs (1×1: all bases in the one sector — verify multi-Main placement (E6-T6) works; 2×1: adjacent home sectors). Document precedence (preset vs. individual overrides).
2. npm scripts for each mode (`dev:server:1x1` etc. or documented env usage — match repo script style).
3. **CI boots each**: a CI job (extend the existing `ci/` setup) that boots the server in each preset, waits for ready, asserts N worlds registered + a client (or protocol-level probe) can connect, and exits clean. Keep it fast (no gameplay simulation — that's E11-T2/T3).
4. README section: the three modes, when to use which (5×5 = design target; 2×1 = crossing/handoff testing; 1×1 = PvP-contact playtests), how player home sectors are assigned per mode.

## Done when

- The plan's done-when: presets documented in README; CI boots each preset green.
- Tests/CI: three preset boot jobs pass; preset parsing unit-tested (bad values fail loudly).
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Presets are config compositions (D8) — no mode-conditional gameplay logic anywhere.
