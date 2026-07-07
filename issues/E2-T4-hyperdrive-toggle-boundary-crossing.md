# E2-T4 — Hyperdrive toggle + boundary crossing

> **Space Rocks — first iteration.** Ticket E2-T4 of Epic 2 (Sector runtime — multi-world)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`.

## Required reading

1. **Design** — issue #40 §3.4 (hyperspace traversal: armed toggle in the slow zone; crossing with hyperdrive armed jumps to the adjacent sector with position continuity; without it, bodies wrap in place; jumping is free and blind), §10.1 (slow-zone inputs).
2. **Plan** — issue #41 D1/D2/D3 and Epic 2 intro.
3. **vecs design guide** — `lib/vecs/docs/design-guide.md`: §2 (phases — input handling in `ON_LOAD`/`POST_LOAD`), §3 (networked components, append-only protocol).
4. **Code** — `apps/client/src/main.ts` (client `Intent` shape), `apps/server/src/game/modules/playerSessions` (`PlayerInputIntent` parse), `apps/server/src/game/modules/movement/module.ts` (the existing `Wraps` behavior at world bounds), `packages/common/src/components/Hyperspace.ts` (the `seq`-based server-signaled effect pattern), `packages/common/src/network/schema.ts`.

## Goal

An armed hyperdrive toggle that turns a world-bounds crossing into a sector jump: the ship (and later its convoy) is transferred to the torus-adjacent sector world at the mirrored position, and the client is signaled via a networked `SectorTransfer` component. Unarmed bodies keep wrapping exactly as today.

## Dependencies

- **E2-T1** (registry/adjacency), **E2-T3** (`transferEntity`) — hard. **E2-T5** consumes the `SectorTransfer` signal client-side. Convoy integration is **E4-T6** (don't block on trains; transfer the bare ship now, but call the E2-T3 API so the convoy variant slots in).

## What to build

1. **Input protocol**: extend the client `Intent` (`apps/client/src/main.ts`) and the server `PlayerInputIntent` parse (`playerSessions`) with slow-zone toggles — at minimum `hyperdriveArmed` (boolean toggle; keybinding in the slow zone, e.g. `H`; also reserve the pattern for E4-T1's fast buttons and E9-T6's beacon drop so the intent shape doesn't churn three times — coordinate field naming with those tickets in a comment).
2. **Armed state**: server-side component on the ship/session (networked if the HUD must show it — a small indicator is desirable; if networked, append to `NETWORK_COMPONENTS` + snapshot test).
3. **`SectorCrossing` system** (server): for hyperdrive-armed ships at world bounds, replace the `Wrap` behavior: compute destination sector via the `SectorRegistry` torus lookup + mirrored position (exit east at x=max → enter west at x=min, y preserved), call `transferEntity`, and set `SectorTransfer { destWorldName, seq }` — a **new networked component** on the session/ship (same pattern as `Hyperspace.seq`), appended to `NETWORK_COMPONENTS` with a snapshot-test update (D6).
4. Non-armed bodies (containers, tugbots, ships with toggle off) keep the existing `Wraps` behavior untouched — including a jettisoned container drifting across a boundary (design §3.4 gap-fill: it wraps, never changes sector).
5. NPC ships never cross by default; the authorization hook for overrides lands in E9-T5 — leave the check point (`mayCross(entity)`) explicit.

## Done when

- Server-side test: armed ship crossing east appears in the east sector world at the west edge with velocity preserved; unarmed ship wraps in place; a FREE container wraps.
- Torus edges covered (crossing off the lattice edge wraps to the far sector).
- `SectorTransfer` appended to the protocol with the snapshot test updated.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- One system per phase; boundary detection belongs with movement/validation phases — mirror where `Wraps` runs today.
- All thresholds/knobs in config (D8); wire changes append-only (D6); module pattern (D7).
