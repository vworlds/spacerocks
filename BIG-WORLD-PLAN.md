# Big World + Camera Viewport + Interest Management

## Goal

Grow the play area to an arbitrary multiple of the current size (default 5× each
dimension) while the client renders only a **1024×768 viewport** centered on the
local player via a Phaser camera. The server splits the world into a grid and
replicates to each client only the entities in the surrounding cells (area-of-interest
replication), modelled on `~/src/vecs/apps/server/src/main.ts`.

## Current baseline (before this work)

- World == viewport: `WORLD_WIDTH/HEIGHT = 10.24×7.68 m` (= 1024×768 px @ `PIXELS_PER_METER=100`).
- `installClientViewSystem` sets `view.dsl = true` — every client receives every entity.
- Toroidal wrap via the `Wraps` component + `Wrap` system (`apps/server/src/game/movement.ts`).
- Only render components are on the wire: `NETWORK_COMPONENTS = phaserNetworkComponents + Explosion`.
  `PlayerShip` / `NetworkClient` / `GameStateView` are NOT replicated.
- HUD (score/wave/message) = server-owned world-anchored `Text` entities (`apps/server/src/game/hud.ts`).
- Client canvas = whole world; camera never moves; `CoordSpace` maps world-origin to canvas center.

## Confirmed vecs capabilities

- Per-client `View.dsl: QueryDSL` drives replication. DSL supports `{any}`, `{all}`,
  `{not}`, `{target:[Rel,dsl]}`, `true`/`false` (`lib/vecs/src/dsl.ts`), so
  "my cell + neighbours" is one `{any:[…]}` expression.
- Demo spatial pattern: per-cell anchor entity + per-cell tag component + an `InCell`
  relationship retargeted every tick from position (a data change → no archetype churn).
  Per-cell DSLs are shared by all clients in the same cell via the server `TrackerCache`.
- `ClientSocket.id` (browser, after `connect()`) equals the server's
  `NetworkClient.id` (`= socket.id`) — the bridge for identifying the local ship.
- `CoordSpace` fixes world-origin at canvas-center and places objects in Phaser
  scene-world space, so a Phaser camera can scroll/follow over a larger world
  WITHOUT modifying `@vworlds/vecs-phaser-client`.

## Design decisions (locked)

- **Topology: toroidal wrap kept, with a visible "hyperspace line".** The world stays
  a torus (keep `Wraps`/`Wrap`). Crossing a world edge is presented as a discrete
  hyperspace jump (lines + flash effect) rather than a seamless slide. This avoids the
  seam-rendering problem entirely: the player teleports, the camera snaps, the flash
  masks the world repopulating around the new position.
  - **Grid neighbour lookup clamps at edges (NO modulo wrap).** You cannot see past the
    hyperspace line until you cross it, so edge cells simply have fewer neighbours.
  - **Client-side wrap detection:** `phaserInterpolators()` only interpolates `Rotation`,
    not `Position`, so wraps are already clean single-frame position jumps with no smear.
    The client detects the owned ship jumping more than half the world in either axis,
    snaps the camera from that position as usual, and plays the lines+flash effect.
- **HUD: removed entirely** (to be redone later). Delete `hud.ts` systems and its
  server-owned Text entities; drop them from world setup. The client's connection-status
  text stays but is screen-fixed (`setScrollFactor(0)`).

## Conventions (must follow)

- Every commit MUST pass `npm run typecheck --workspaces` (husky pre-commit). NEVER use `--no-verify`.
- Phase-end state MUST also pass `npm run test`.
- Server-only packages (`@vworlds/vecs-physics`, `@vworlds/vecs-phaser-server`, box2d)
  must NEVER be imported from `packages/common` or `apps/client`.
- Never commit `.vecs-ref/` (local-only reference dir).
- ≥1 commit per phase, clear message.

## Phases

- **Phase 0 — Size params.** `packages/common/src/constants.ts`: add `VIEWPORT_WIDTH/HEIGHT`
  (10.24/7.68) and `WORLD_SCALE` (5); set `WORLD_WIDTH/HEIGHT = VIEWPORT × WORLD_SCALE`.
  Repoint screen-relative gameplay to `VIEWPORT_*` (laser-beam length; player-spawn
  offsets). Fix test fallout from the larger world.
- **Phase 1 — Server interest management.** Port the demo grid (cell anchors + per-cell
  tag components + `InCell` relationship + edge-clamped cell index + `AssignCells` system).
  One precomputed `{any:[own cell + ≤8 clamped neighbours]}` DSL per cell. Rewrite
  `installClientViewSystem` so each client's `View.dsl` follows its owned ship's cell.
- **Phase 2 — Self-identification.** Networked `Owner {clientId}` appended to
  `NETWORK_COMPONENTS` (order-stable), set on the ship at spawn = session client id.
  Client reads `socket.id`, finds the ship with matching `Owner` → camera target.
- **Phase 3 — Camera + rendering.** Canvas = viewport (1024×768). Camera follows the
  owned ship's replicated `Position`. World-sized/tiled parallax starfield. Pin
  connection-status text screen-fixed.
- **Phase 4 — Hyperspace effect + gameplay tuning.** Client-side wrap detection from the
  owned ship's single-frame `Position` jump; client lines+flash + camera snap on wrap.
  Alien spawning near active players; asteroid wave counts/caps scaled to the larger area.
- **Phase 5 — Tests & manual verify.** Extend network/soak tests; verify in the real app.
