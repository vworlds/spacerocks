# E2-T5 — Client world switch

> **Space Rocks — first iteration.** Ticket E2-T5 of Epic 2 (Sector runtime — multi-world)
> from the engineering plan vworlds/spacerocks#41, implementing the design vworlds/spacerocks#40.
> Repo: `vworlds/spacerocks`. Target branch: `dev`. This ticket closes **Experiment 1** (#40 §13.1).

## Required reading

1. **Design** — issue #40 §3.4 (position continuity; you jump blind), §13 experiment 1 (two-sector handoff: does it feel seamless? does "you left home" read?).
2. **Plan** — issue #41 D2 (client holds one `ClientWorld` at a time; server pre-spawns in the destination, then signals via `SectorTransfer`; the client disconnects, connects to the destination world path, and the jump flash hides the swap latency).
3. **vecs design guide** — §10 case study (client render lifecycle: `clearAllEntities()` → attached GameObjects destroyed — a baseline reset/disconnect is free).
4. **Code** — `apps/client/src/network/vecsClient.ts` (connect/reconnect machinery), `apps/client/src/main.ts` (world/scene wiring, local-ship acquisition by `Owner`), `apps/client/src/render/HyperspaceEffect.ts` (the visual mask, plan D2).

## Goal

The client observes `SectorTransfer`, tears down its `ClientWorld`, connects to the destination world path, re-acquires its ship, and plays the hyperspace flash over the swap — a seamless sector handoff.

## Dependencies

- **E2-T4** (`SectorTransfer` networked component + server-side pre-spawn) — hard.

## What to build

1. Client system watching `SectorTransfer` on the local player's entity (match by `Owner`, dedupe by `seq` — same idiom as the existing `Hyperspace.seq` effect).
2. On trigger: start the hyperspace flash → disconnect/tear down the current `ClientWorld` (verify attached Phaser objects are released via the existing lifecycle — no leaked GameObjects) → connect to `/rtc/v1/world/<destWorldName>` reusing the reconnect machinery → wait for the snapshot → re-acquire the local ship by `Owner` → snap the camera to it → end the flash.
3. Failure handling: if the destination connect fails, retry with the existing reconnect policy; surface a console-visible error rather than a black screen.
4. Keep HUD state (E2-T7's sector readout) updated from the new world name.

## Done when

- Manual: fly across a 2×1 lattice both directions seamlessly — this is **Experiment 1**; record the feel verdict (seamless? "you left home" reads?) in the PR description.
- Reconnect-storm soak: 10 rapid crossings back and forth stays stable — no entity leaks (Phaser object count returns to baseline), no double connections.
- An automated client test where feasible (`apps/client/tests/network` has precedent) covering the observe→switch→reacquire flow against a stubbed transport.
- `npm run typecheck --workspaces` and `npm run test` pass.

## Constraints

- One `ClientWorld` connection at a time (D2) — never overlap two live connections.
- Don't hand-roll teardown: rely on the resource-as-component lifecycle (guide §7/§10); if you find yourself keeping maps of GameObjects, stop.
- Server-only packages must not be imported from `apps/client`.
