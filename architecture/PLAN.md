# Spacerocks Vecs Client/Server Migration Plan

## Purpose

Spacerocks started as a local-only browser game. This branch began a Colyseus proof of concept, but the game still runs in the browser and only syncs demo circles. The target is a real authoritative client/server architecture using `@vworlds/vecs-client` and `@vworlds/vecs-server` over WebRTC.

The server owns all game simulation and gameplay decisions. The client becomes a thin renderer that runs vecs locally, receives mirrored ECS entities/components from the server, sends player input intent, and draws whatever the server says exists.

## Goals

- Remove Colyseus and the custom `ecsMirror` snapshot/delta protocol.
- Use `@vworlds/vecs-client`, `@vworlds/vecs-server`, and `@vworlds/vecs-wire` as the only network sync layer.
- Move Spacerocks gameplay logic and simple physics from the browser client to the server.
- Support arbitrary multiplayer: every connected user gets a ship.
- Keep rendering in the client only.
- Sync renderable ECS state across the wire using network components.
- Model server-created short-lived effects as coarse networked effect entities, not synced particle clouds.
- Preserve the existing gameplay feel before adding new multiplayer-specific features.

## Non-Goals

- Do not use `vecs-physics`; Spacerocks keeps its existing simple movement/collision model.
- Do not rewrite rendering to WebGL or another renderer.
- Do not implement prediction/rollback in the first migration.
- Do not add matchmaker/lobbies in the first migration.
- Do not sync individual explosion particles.

## Current State

- `apps/client` owns the complete game loop and simulation.
- `apps/server` runs a Colyseus `UniverseRoom` that syncs demo circles only.
- `packages/common` contains a custom ECS snapshot/delta protocol and some shared render components.
- Gameplay systems currently under `apps/client/src/systems` include movement, collision, shooting, AI, wave spawning, pickups, decay, shield, health, and UI.
- Factories under `apps/client/src/factories` create both gameplay and rendering components.
- `Drawable` currently contains runtime draw callbacks. These callbacks cannot cross the wire.

## Target Runtime Topology

Server:

- Runs an Express HTTP server with `VecsListener`.
- Owns a `ServerWorld` named `main`.
- Registers the canonical `NETWORK_COMPONENTS` from `@spacerocks/common`.
- Installs vecs server collect/send systems.
- Runs a fixed-rate authoritative simulation loop.
- Creates, mutates, and destroys all networked gameplay entities.
- Reads each connected client's `NetworkInput` and applies it to that client's ship.
- Sets each client's `View.dsl` so the client can see the game world.

Client:

- Runs a `ClientWorld` connected through `ClientWorld.connectDgram`.
- Registers the same `NETWORK_COMPONENTS` in the same order.
- Captures keyboard input and sends intent through `client.setInput(...)`.
- Runs vecs client apply/send systems and local render/UI systems.
- Creates only client-local resources and cosmetic particles.
- Never mutates authoritative gameplay state.

## Network Schema Rules

All components replicated by vecs must be wire-encodable and registered identically on server and client.

Rules:

- Put `Position` first in `NETWORK_COMPONENTS`; vecs-client interpolates component type `1` as `{ x, y }`.
- Treat `NETWORK_COMPONENTS` ordering as a protocol contract.
- Use `@vworlds/vecs-wire` field decorators on network components.
- Mutating a network component in place on the server requires `entity.modified(Component)`.
- Do not put functions, DOM objects, canvas contexts, `Entity` instances, or `Set<Entity>` in network components.
- Use IDs, enum values, primitive fields, arrays of wire-encodable structs, or relationships instead.

Initial network component set:

1. `Position`
2. `Rotation`
3. `Drawable`
4. `StrokeStyle`
5. `FillStyle`
6. `Shape`
7. `Arc`
8. `FilledRect`
9. `PlayerShip`
10. `AsteroidView`
11. `ProjectileView`
12. `PickupView`
13. `HealthView`
14. `ShieldView`
15. `WeaponView`
16. `GameStateView`
17. `ExplosionView`

This list can be tightened during implementation, but the first useful schema should separate visual/network state from server-only simulation state.

## Ownership Model

Use vecs relationships for ownership instead of ad-hoc entity references in components.

Recommended model:

- Each connected client has a server-side session/player entity created by vecs-server.
- The player ship is a child of that session/player entity via `ChildOf` or a user-defined relationship such as `OwnedBy`.
- Projectiles, boomerangs, rockets, shields, and other owner-scoped entities are children of their owning ship or player entity.
- When a parent is destroyed, child entities are automatically destroyed by vecs relationship lifecycle behavior.
- This gives disconnect cleanup for free: destroying the session/player parent removes its ship and owned child entities.

Use cases:

- Client disconnect destroys session entity, ship, active projectiles, boomerangs, and player-owned effects.
- Ship death destroys or detaches ship-owned entities based on desired gameplay.
- Boomerang ownership checks compare relationship parent, not object identity.
- Per-player score and metadata can live on the player/session parent rather than the ship.

## Server Simulation Boundaries

Move to server:

- Input application and ship control.
- Thrust, movement, angular movement, friction, and wrapping.
- Alien AI.
- Shooting and weapon cooldown/ammo state.
- Laser, rocket, boomerang behavior.
- Collision detection and collision handlers.
- Health, shield, damage, death, scoring, and game state.
- Asteroid, alien, pickup, projectile, wave, and random clock spawning.
- Authoritative TTL/decay for gameplay and effect marker entities.

Keep client-only:

- DOM setup and resize handling.
- Keyboard capture.
- Canvas render context, stars, and presentation resources.
- Render systems and draw statement reconstruction.
- UI text rendering from mirrored server state.
- Local cosmetic particles triggered by `ExplosionView` entities.

## Fixed World Size

The current game uses `canvasSize` for simulation. That cannot be authoritative for multiple clients with different browser sizes.

Migration rule:

- Introduce shared `WORLD_WIDTH` and `WORLD_HEIGHT` constants.
- Server uses those constants for spawning, wrapping, AI, collisions, and wave logic.
- Client maps world coordinates into the current canvas size.
- First implementation can stretch to canvas; later polish can letterbox/preserve aspect ratio.

## Implementation Tickets

Each ticket has a file for subagents to work with under ./architecture/issues

| Ticket   | Title                                                                   | Depends On                                       | Parallelization Notes                                                               |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `SR-001` | Replace dependencies and TypeScript/network build foundation            | None                                             | Start first. Unblocks most other tickets.                                           |
| `SR-002` | Define shared vecs network schema                                       | `SR-001`                                         | Critical path. Server and client work depends on this.                              |
| `SR-003` | Build vecs server shell and connection lifecycle                        | `SR-001`, `SR-002`                               | Can run in parallel with `SR-004` once schema exists.                               |
| `SR-004` | Build thin vecs client connection loop                                  | `SR-001`, `SR-002`                               | Can run in parallel with `SR-003`.                                                  |
| `SR-005` | Split/move gameplay components and constants                            | `SR-002`                                         | Can run alongside server shell work. Required by gameplay migration tickets.        |
| `SR-006` | Implement multiplayer player/session ownership                          | `SR-003`, `SR-005`                               | Critical path for all player input and ownership behavior.                          |
| `SR-007` | Move movement, thrust, friction, rotation, and wrapping to server       | `SR-005`, `SR-006`                               | Can run before spawning/combat is complete.                                         |
| `SR-008` | Move spawning, waves, pickups, aliens, and server RNG                   | `SR-005`, `SR-003`                               | Can run in parallel with `SR-007` and `SR-009`.                                     |
| `SR-009` | Move shooting and weapon/projectile systems to server                   | `SR-005`, `SR-006`, `SR-007`                     | Can run in parallel with `SR-008`; collision integration comes later.               |
| `SR-010` | Move collision, health, score, game state, and death handling to server | `SR-007`, `SR-008`, `SR-009`                     | Integration-heavy. Start after moving enough entities/systems to test interactions. |
| `SR-011` | Rebuild client rendering from network components                        | `SR-004`, `SR-002`                               | Can run in parallel with server gameplay using mocked mirrored entities.            |
| `SR-012` | Implement networked effect markers and local particles                  | `SR-010`, `SR-011`                               | Depends on collision/death events and render reconstruction.                        |
| `SR-013` | Rehome tests and add authoritative server coverage                      | `SR-005`                                         | Can start early, but final assertions depend on `SR-010`.                           |
| `SR-014` | Remove old Colyseus/custom networking and client authority              | `SR-003`, `SR-004`, `SR-010`, `SR-011`, `SR-013` | Final cleanup only after replacement is verified.                                   |

## Critical Path

The minimum sequential path is:

1. `SR-001`
2. `SR-002`
3. `SR-003` and `SR-004`
4. `SR-005`
5. `SR-006`
6. `SR-007`
7. `SR-008` and `SR-009`
8. `SR-010`
9. `SR-011`
10. `SR-012`
11. `SR-013`
12. `SR-014`

## Parallel Work Lanes

Lane A, platform/networking:

- `SR-001`, `SR-002`, `SR-003`, `SR-004`, `SR-014`.

Lane B, authoritative gameplay:

- `SR-005`, `SR-006`, `SR-007`, `SR-008`, `SR-009`, `SR-010`.

Lane C, client rendering/effects:

- `SR-004`, `SR-011`, `SR-012`.

Lane D, tests/verification:

- `SR-013` starts after `SR-005` and tracks each gameplay migration ticket.

Suggested staffing:

- Engineer 1 owns `SR-001`, `SR-002`, `SR-003`.
- Engineer 2 owns `SR-004`, `SR-011`, `SR-012`.
- Engineer 3 owns `SR-005`, `SR-006`, `SR-007`.
- Engineer 4 owns `SR-008`, `SR-009`, `SR-010` after `SR-005` is merged.
- Test owner starts `SR-013` as soon as server gameplay components exist.

## Delegation

Don't get your hands dirty. Delegate to opencode subagents. To do so, follow the instructions here: architecture/opencode_delegation_instructions.md where PROJECT_NAME=spacerocks
and BRANCH=server. $BRANCH is the development branch, so all agent work must end up merged here. You own this branch. After each merge, commit and push.

Depending on the complexity of the task, decide if launching a reviewer is worth it, or if a subagent can handle two or more small and related tasks to save effort.

## Milestones

Milestone 1: Vecs connectivity

- Server starts with `ServerWorld`.
- Client connects with `ClientWorld`.
- A networked debug entity appears in the browser without Colyseus.

Milestone 2: Multiplayer ships

- Each connected client gets one server-owned ship.
- Each client controls only its own ship.
- Disconnect destroys that player's owned entities through relationship ownership.

Milestone 3: Server movement and spawning

- Ships, asteroids, pickups, and aliens are created server-side.
- Movement and wrapping are server-authoritative.
- Clients render mirrored positions.

Milestone 4: Server combat loop

- Shooting, projectiles, weapons, collision, health, score, and wave progression are server-authoritative.
- Multiple clients see the same results.

Milestone 5: Thin client cleanup

- Client no longer initializes gameplay entities or runs authoritative systems.
- Colyseus and the custom delta protocol are removed.
- Tests pass.

## Verification Strategy

Automated checks:

- `npm run typecheck`
- `npm test`
- `npm run lint`
- Server unit tests for each migrated gameplay system.
- Client render tests for reconstructing draw statements from network components.
- Integration tests for connect, input, spawn, disconnect cleanup, and effect TTL where feasible.

Manual QA:

- Start server and two browser clients.
- Confirm each browser sees all ships and game entities.
- Confirm each player controls only their own ship.
- Confirm disconnect removes that player's ship/projectiles.
- Confirm asteroids, pickups, aliens, bullets, rockets, boomerangs, shield, health, score, wave, death, and restart behavior match original gameplay intent.
- Confirm explosions render as local effects from short-lived server `ExplosionView` entities.

## Major Risks

- Network component ordering is brittle. Mitigate with one shared exported array and a test asserting order.
- `Drawable` currently stores callbacks. Mitigate by syncing only render data and rebuilding draw statements client-side.
- Gameplay currently depends on browser canvas size. Mitigate with fixed server world constants.
- Function-valued components (`Pickup.effectFunc`, `RandomClock.effectFunc`) cannot be networked. Mitigate with enum/data-driven server systems.
- Entity references in components do not survive networking. Mitigate with `ChildOf` or user-defined ownership relationships.
- In-place server mutations must call `entity.modified(Component)`. Mitigate with tests and review checklist.
- Moving tests from client to server will expose DOM assumptions. Mitigate by splitting DOM-free gameplay modules from render/client resources.

## Definition of Done

- No runtime dependency on Colyseus or `colyseus.js` remains.
- No custom Spacerocks ECS network protocol remains.
- Server creates and simulates the game world.
- Client renders server state and sends input intent only.
- Multiple clients can join and each receives a ship.
- Ownership cleanup uses relationships so disconnects destroy player-owned entities.
- Existing gameplay loop works with server authority.
- Tests, typecheck, and lint pass.
