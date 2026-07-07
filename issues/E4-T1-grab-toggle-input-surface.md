# E4-T1 — Grab toggle + new input surface

> **Space Rocks — first iteration.** Ticket E4-T1 of Epic 4 (Cargo trains) from the
> engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §10.1 (input map: fast zone = W/A/D throttle-rotate, S = rotate train, btn1 fire, btn2 jettison with rapid-fire/hold, btn3 grab toggle default ON; slow zone = beacon drop, hyperdrive toggle), §5.2 (grab toggle semantics).
2. **Plan** — issue #41 Epic 4 intro; coordinate the intent-shape extension with E2-T4 (hyperdrive toggle) and E9-T6 (beacon drop) — one intent-protocol churn, not three.
3. **Code** — `apps/client/src/main.ts` (client `Intent` + key handling), `apps/server/src/game/modules/playerSessions/` (`PlayerInputIntent` parse), E2-T7's HUD module if merged.

## Goal

The full new input surface exists end-to-end: grab toggle (fast button 3, default ON), jettison (button 2, repeat-on-hold), train-rotate (S/down) — client capture → intent wire → server-visible state, plus HUD button-state rendering in the two-zone skeleton.

## Dependencies

- Merge-order coordination with **E2-T4** (which extends the same intent surface). Consumers: E4-T2 (grab), E4-T3 (jettison/rotate). This ticket lands the plumbing + state; the consumers implement behavior.

## What to build

1. **Client**: key/button bindings — grab toggle (e.g. `E`/btn3; toggle, not hold), jettison (e.g. `Space`-adjacent btn2 with repeat-on-hold semantics: initial press + repeat at config interval while held), train-rotate on `S`/down (discrete presses). Extend the `Intent` payload; keep it lean (booleans/counters, not event lists — mirror the existing intent style).
2. **Server**: `PlayerInputIntent` parsing → per-ship state: a `GrabToggle { on }`-style component (default ON at spawn — config), and edge-triggered jettison/rotate intents consumable by E4-T3 (frame-consumed intent components or counters — pick the idiom used by fire today).
3. **HUD**: render the two-zone skeleton state (E2-T7's HUD module): grab ON/OFF indicator at minimum; keep it text/simple.
4. Respawn/new-ship default: grab ON (config, #40 §10.1).

## Done when

- Server tests: intents visible server-side — toggling grab flips the component; hold-jettison produces repeated server-side intents at the config cadence; rotate presses arrive discretely.
- Client HUD shows grab state; manual sanity in the demo world.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- Keybindings, repeat interval, defaults — config/client constants (D8).
- Input → `ON_LOAD`/`POST_LOAD` phases server-side (guide §2/§5).
- Don't implement pickup/jettison physics here — E4-T2/T3 own behavior.
