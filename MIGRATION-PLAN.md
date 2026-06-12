# Spacerocks → vecs-physics + vecs-phaser Migration Plan

**Status:** approved design, pre-implementation
**Audience:** engineering manager + implementing engineers
**Author:** architecture pass over `~/src/vecs` (core + physics + phaser stack) and the current `spacerocks` codebase
**Supersedes:** `architecture/PLAN.md` §Non-Goals ("Do not use `vecs-physics`; Spacerocks keeps its existing simple movement/collision model"). That constraint is **reversed** by this plan.

---

## 1. Intent

Replace Spacerocks' two homemade subsystems with the vecs ecosystem libraries:

1. **Rendering** — the bespoke `Drawable`/`DrawContext` canvas-2D layer (server-authored draw callbacks reconstructed client-side from `Shape`/`Arc`/`FilledRect`/`FillStyle`/`StrokeStyle` + per-visual draw systems) → **`@vworlds/vecs-phaser` + `@vworlds/vecs-phaser-client` + Phaser 4**.
2. **Physics** — the homemade per-frame integrator (`Velocity`/`AngularVelocity`/`Friction`/`Thrust`) + the O(n²) category/mask overlap loop in `combat.ts` → **`@vworlds/vecs-physics` (Box2D v3) + `@vworlds/vecs-phaser-server`**.

The end state mirrors the **vecs reference demo** (`~/src/vecs/apps/server/src/main.ts` and `apps/client/src/main.ts`), which migrated an equivalent canvas-2D + custom-physics game to exactly this stack. **Read those two files first — they are the canonical template for everything below.**

### Locked decisions (confirmed with product owner)

| Decision | Choice |
| --- | --- |
| **Physics scope** | **Full.** Box2D bodies for all moving entities; collisions become sensor/contact **events** driven by `CollisionFilter`, replacing the `combat.ts` overlap loop. |
| **Units / coordinates** | **Meters, +y up, centered origin.** Convert all constants; pixel/Y-flip conversion lives only at the Phaser frontier (`CoordSpace`/PPM). |
| **Render fidelity** | **Pure render-components.** The client carries **zero game components**; embellishments (health bar, shield, laser, HUD) become server-owned shape entities; explosions/starfield are client-local Phaser effects. |
| **Sequencing** | **Phased: rendering first (incl. units conversion), then physics.** Each phase is independently shippable to the GitHub Pages preview. |

---

## 2. How the target stack works (orientation for implementers)

vecs is an ECS: **components are data, systems are behavior, lifecycle is driven by component presence/change.** Two ecosystem facts dominate this migration:

- **vecs-phaser is server-driven UI.** The server owns authoritative entities and attaches small, networked *render components* (`Position`, `Rotation`, `Arc`, `Polygon`, `Text`, `FillStyle`, …). `@vworlds/vecs-phaser-client`'s `PhaserRenderModule` observes the replicated `ClientWorld` and **creates/updates/destroys Phaser GameObjects automatically** — there is **no per-entity render code on the client**. (Source: `lib/vecs-phaser-client/src/modules/*`, design guide §10.)
- **vecs-physics is server-side simulation.** `world.module(PhysicsModule)` plugs a Box2D v3 solver in as physics phases after `ON_UPDATE`. A physics object is **two entities**: a *body* entity (`Body` + physics `Position`/`Rotation` + velocities) and one or more *shape* child entities (`Circle`/`Polygon`/… + `CollisionFilter` + event components), linked by the built-in `ChildOf` relationship. (Source: `lib/vecs-physics/docs/*`.)

### Coordinate model (single source of truth at the frontier)

Components carry **meters, +y up, origin at world center** on both server and client. The only place pixels exist is the client's `CoordSpace` (PPM, Y-flip, centering). vecs-physics and vecs-phaser **agree on this convention by design**, so `PhaserServerModule` pose-sync is a *plain copy* of physics pose → render pose.

```
CoordSpace (client only, default PPM=64; we use PPM=100):
  x(mx)   = canvas.width/2  + PPM·mx
  y(my)   = canvas.height/2 − PPM·my        (Y flip)
  len(m)  = PPM·m
  rot(rad)= −rad                            (Y flip inverts handedness)
  deg(rad)= (−rad)·180/π                    (arc angles)
```

> **Handedness gotcha (calibrate in-game).** Spacerocks is currently authored in screen space (+y **down**). Moving to +y **up** plus the frontier angle-negation can visually invert "rotate left/right", "thrust forward", and arc sweep direction. The math stays self-consistent (ship and its bullets share one angle and one transform, so **aim is always correct relative to the sprite**), but key-to-direction mapping must be verified. See ticket **R7**.

---

## 3. Package & dependency changes

All four new packages are **published on npm at `1.0.26`** (verified), matching the pinned `@vworlds/vecs` version. `vecs-physics` pulls `box2d3-wasm` (server/Node only — **no WASM ships to the browser**). `vecs-phaser-client` needs `phaser@^4.1` as a peer dep provided by the client app.

| Workspace | Add | Remove (by end of Phase 2) |
| --- | --- | --- |
| `packages/common` | `@vworlds/vecs-phaser` | homemade render component files (`Drawable`, `Shape`, `Arc`, `FilledRect`, `FillStyle`, `StrokeStyle`, `Position`, `Rotation`, `Point`, `ISerializable`), the `ViewComponents`, and homemade physics components (`Velocity`, `AngularVelocity`, `Friction`, `Thrust`, `Collider`) |
| `apps/server` | `@vworlds/vecs-physics`, `@vworlds/vecs-phaser`, `@vworlds/vecs-phaser-server` (Phase 2 adds physics; Phase 1 only needs `vecs-phaser`) | — |
| `apps/client` | `@vworlds/vecs-phaser`, `@vworlds/vecs-phaser-client`, `phaser@^4.1` | `@vworlds/vecs` draw systems, canvas render/UI/particle code, local components |

Keep the existing `@vworlds/vecs` override pin pattern (root `overrides`, `"*"` in app `package.json`s). Extend `scripts/hot-update-vecs.mjs` to also build+copy the new packages when developing against a local `~/src/vecs` checkout (optional; npm versions work out of the box). **Server-only packages (`vecs-physics`, `vecs-phaser-server`) must never be imported from `packages/common` or `apps/client`** or WASM/`vecs-server` will leak into the browser bundle.

---

## 4. Target network protocol

Replace `NETWORK_COMPONENTS` (18 homemade components) with the canonical **`phaserNetworkComponents`** from `@vworlds/vecs-phaser`, plus **one** app-specific effect component appended at the end:

```ts
// packages/common/src/network/schema.ts
import { phaserNetworkComponents } from '@vworlds/vecs-phaser';
import { Explosion } from '../components/Explosion'; // app effect, wire-encoded

export const NETWORK_COMPONENTS = [
  ...phaserNetworkComponents, // type ids 1..16 — DO NOT REORDER (this is the protocol)
  Explosion,                  // type id 17 (client-local Phaser effect trigger)
] as const;
```

Rules (unchanged from vecs conventions):
- **Order is the protocol** (type id = index + 1). `Position` must stay type 1 — `vecs-client` interpolates component type 1 as `{x,y}` for free.
- Append app components **after** the phaser block so phaser type ids stay stable.
- The client registers the **same array**. `PhaserRenderModule` keys off the phaser component classes and ignores `Explosion`; our small client effect module handles `Explosion`.
- **The client carries no game-logic components.** All of `PlayerShip`, `AsteroidView`, `Health`, `Shield`, weapons, `Asteroid`, `Alien`, etc. become **server-local** (registered, not networked) or are deleted.

`Explosion` (the only non-phaser networked component) is a small wire-encoded effect marker:

```ts
export class Explosion {
  @wireType('u32') color = 0xffffff;   // RGB int (converted from CSS strings)
  @wireType('f32') size = 1;           // meters
  @wireType('u32') seed = 0;           // deterministic particle RNG
  @wireType('f32') duration = 0.5;     // seconds
}
```

---

## 5. Entity model (target)

### 5.1 Hierarchy and the two roles of `ChildOf`

`ChildOf` is used for **three** distinct trees that coexist on the same relationship. This is legal because physics only treats *immediate children carrying physics geometry* as fixtures, and only physics geometry classes (`Circle`/`Box`/`Polygon` from `vecs-physics`) count — phaser render shapes and bodies are invisible to it.

```
client (NetworkClient)
└─ session (PlayerSession)                         [ChildOf, CleanupPolicy.Delete]
   └─ ship  ── BODY: Body(Dynamic), PhysicsPosition/Rotation, LinearVelocity,
   │           Damping, RenderPosition/Rotation, Triangle, StrokeStyle, Networked,
   │           + server-local: Player, Health, Shield, weapon comps, Wraps
   │     ├─ ship physics shape   (ChildOf ship; Circle(SHIP.RADIUS), CollisionFilter, ContactEvents)
   │     ├─ health-bar render    (ChildOf ship; Rectangle + Size + FillStyle + RenderPosition + Offset)
   │     ├─ shield render        (ChildOf ship; Arc full-circle + StrokeStyle + RenderPosition + Offset) [while shielded]
   │     ├─ laser render         (ChildOf ship; Line + StrokeStyle + RenderPosition/Rotation) [while firing]
   │     └─ bullets …            (ChildOf ship; each its own BODY+shape — see below)
```

> **Why circles for every physics shape.** Spacerocks collisions are radius-overlap today (`Collider.radius`). Box2D polygons must be **convex**, but asteroid render polygons are irregular/possibly concave. So the **physics shape is always a `Circle` using the existing `Collider.radius`**, while the **render shape is the detailed phaser `Polygon`/`Triangle`/`Arc`**. This preserves the current collision feel exactly and avoids all convexity problems.

### 5.2 Per-object mapping

| Game object | Physics body | Physics shape (child) | Render components | Notes |
| --- | --- | --- | --- | --- |
| **Ship** | Dynamic, `Damping.linear` (=friction), thrust via `Force`/`Impulse`, turn via `Rotation` teleport | `Circle(SHIP.RADIUS)` solid, `ContactEvents`, filter `CAT_PLAYER` | `Triangle` + `StrokeStyle(color)` | + health-bar/shield/laser child entities |
| **Asteroid** | Dynamic, initial `LinearVelocity` + `AngularVelocity`, zero damping | `Circle(radius)` solid, `ContactEvents`, filter `CAT_ASTEROID` | `Polygon(points)` + `StrokeStyle` | irregular render polygon; circle physics |
| **Alien** | Dynamic, AI sets `LinearVelocity` | `Circle(ALIEN.RADIUS)` solid, `ContactEvents`, filter `CAT_ENEMY` | `Polygon` + `StrokeStyle` | + health-bar child |
| **Bullet (player/enemy)** | **Kinematic**, velocity set at spawn | `Circle(2)` **Sensor + SensorEvents**, filter `CAT_PLAYER_BULLET`/`CAT_ENEMY_BULLET` | `Arc(2)` + `FillStyle` | sensor → no bounce |
| **Rocket** | **Kinematic**, homing sets velocity | `Circle(4)` **Sensor + SensorEvents**, `CAT_PLAYER_BULLET` | `Triangle` + `FillStyle(#ff6600)` | homing in gameplay system |
| **Boomerang** | **Kinematic**, pull sets velocity, spin via `AngularVelocity` | `Circle(RADIUS)` **Sensor + SensorEvents**, `CAT_BOOMERANG` | `Polygon` + `FillStyle(#006400)` | catch logic on sensor begin |
| **Pickup** | **Kinematic**, drift velocity | `Circle(POWERUP.RADIUS)` **Sensor + SensorEvents**, `CAT_PICKUP` | `Arc(radius)` + `StrokeStyle(kind color)` | |
| **Explosion** | — | — | networked `Explosion` effect + `Position` | client-local Phaser particle emitter |
| **HUD (score/wave/msg)** | — | — | `Text` entities at fixed world corners + high `Depth` | replaces the HTML overlay |

### 5.3 Collision model (sensors + contacts)

The current `CAT_*` category bits and per-entity `mask` map **directly** onto `CollisionFilter.categoryBits`/`maskBits` (Box2D filtering predicate is the same: shapes interact iff `(catA & maskB) && (catB & maskA)`).

The interaction graph is **not bipartite** (e.g. asteroid↔alien and boomerang↔alien conflict), so a single sensor/solid 2-coloring is impossible. Use a **hybrid** that guarantees overlap detection with **zero physical response** for every interacting pair:

- **Projectiles & pickups are `Sensor` + `SensorEvents`** (player/enemy bullets, rockets, boomerangs, pickups). A sensor detects solid shapes per filter and imparts no force. **All projectile/pickup gameplay is driven from the projectile's own `SensorEvents.begin`** (read `event.other.parent(ChildOf)` to get the target body). This also fixes a latent bug-class: an unarmed boomerang overlapping its owner never bounces.
- **Bodies are solid + `ContactEvents`** (ship, asteroid, alien). The only solid-vs-solid pairs that actually touch are ship↔asteroid, ship↔alien, asteroid↔alien — and in every one of those at least one party is destroyed on the same tick. With `Material.restitution = 0` and the ship's linear damping, the residual one-frame impulse is negligible. Asteroid↔asteroid never interacts (filter mask excludes `CAT_ASTEROID`), so asteroids pass through each other exactly as today.
- **Laser** is a **ray cast**, which **vecs-physics v1 does not provide**. Keep the existing `resolveLaserHits` (`distToSegment` against asteroid/alien `Position`) as a custom gameplay system reading replicated positions. (Source: `lib/vecs-physics/README.md` V1 Limitations.)
- **Screen wrap, rocket homing, boomerang pull-back** have no physics primitive. Keep them as gameplay systems that write `LinearVelocity` (homing/pull) or teleport `Position` (wrap). Physics treats user `Position`/`Velocity` writes as authoritative. (Source: physics `docs/components.md`.)

> **De-risk first (ticket P1).** The above relies on three Box2D v3 behaviors that must be confirmed empirically before building on them: (a) a `Sensor` on a **kinematic** body detects a **dynamic** solid; (b) two solid bodies that **both** carry `ContactEvents` each receive begin events; (c) sensor-vs-sensor overlaps (which we deliberately avoid) — confirm they are *not* required. Write a probe test in `apps/server/tests` that builds these exact combos and asserts event delivery. If (a) fails, make projectiles dynamic with `density>0`; if (b) fails, drive body-body pairs from one designated side.

---

## 6. Server pipeline (phase placement)

With physics installed, the effective per-tick order is:

```
ON_LOAD      vecs-server apply (receive NetworkInput), SetClientView
POST_LOAD/…  parse input → PlayerInputIntent
ON_UPDATE    gameplay: shooting, alien AI, weapon timers, spawn entities,
             thrust (set Force), ship turn (teleport Rotation),
             rocket homing & boomerang pull (set LinearVelocity)
physics-pre  ── vecs-physics: read ECS changes
physics-step ── vecs-physics: integrate
physics-post ── vecs-physics: write PhysicsPosition/Rotation, publish events
             + collision handlers (read SensorEvents/ContactEvents → destroy/damage/score)
             + laser raycast, screen wrap (teleport PhysicsPosition), decay/lifetime
PRE_STORE    PhaserServerModule pose-sync (PhysicsPosition → RenderPosition),  ← registered first
             then: health-bar/shield/laser child follow (Offset → RenderPosition),
                   HUD Text updates, View/interest (kept trivial: dsl=true)
ON_STORE     vecs-server collect & send snapshots
```

Key points:
- `PhysicsModule` inserts `physics-pre/step/post` **after `ON_UPDATE`** automatically (default config). Reactions to physics results go in `physics-post` or later. (Source: physics `docs/systems-and-phases.md`.)
- `PhaserServerModule` only **copies** physics pose into an already-present `RenderPosition`/`RenderRotation` — so **spawn every body with both** `PhysicsPosition` *and* `RenderPosition` set (the demo does `.set(RenderPosition, p).set(PhysicsPosition, p)`).
- Register child-follow / HUD systems **after** `world.module(PhaserServerModule)` so within `PRE_STORE` they run after the pose-sync (lag-free child positions).
- **Fixed timestep is required.** Switch the server loop from real `delta` to a fixed-step accumulator passing a constant `DT_MS` to `world.progress` (copy the demo's `loop()`/`simulate()`).

---

## 7. Client architecture (target — tiny)

The client collapses to: connect → register render module → feed input. (Template: `~/src/vecs/apps/client/src/main.ts`.)

```ts
const world = await ClientWorld.connectDgram({
  host, port, worldName: 'main',
  networkComponents: NETWORK_COMPONENTS,        // phaser block + Explosion
  interpolators: phaserInterpolators(),         // smooth Position + shortest-arc Rotation
  localEntityIdStart: CLIENT_ENTITY_ID_START,
});
world.module(PhaserRenderModule, { scene, pixelsPerMeter: 100 });
world.module(ExplosionEffectModule, { scene });  // app: .with(Explosion).enter → Phaser emitter
// each frame: world.setInput(readIntent()); world.progress(now, delta);
```

- **Phaser scene** (1024×768 or responsive) replaces the canvas context. The **starfield** becomes a one-time Phaser graphics/tilesprite in `create()` (no networking). The **instructions/connection-status** chrome is client-local Phaser `Text`.
- **HUD (score/wave/message)** is rendered by the render module from **server `Text` entities** — so `apps/client/src/systems/UI.ts` and the `#score`/`#wave`/`#msg` HTML overlay are removed. *(Fallback if a screen-anchored DOM HUD is preferred: keep a tiny networked `GameState` component the client reads — a minor deviation from "pure render-components"; not recommended.)*
- **Explosions** are a client-local Phaser `ParticleEmitter` fired on the `enter` of a networked `Explosion` entity, seeded by its fields. No particle clouds cross the wire.
- **Delete:** `systems/Render.ts`, `systems/UI.ts`, `systems/Explosion.ts`, `systems/Particles.ts`, all of `systems/draw/*`, `components/{Alpha,Label,Particle}.ts`, and their tests.

---

## 8. Phase 1 — Rendering migration (canvas → vecs-phaser/Phaser) + units conversion

**Goal:** identical gameplay, now rendered by Phaser, networked via `phaserNetworkComponents`, with **all units in meters/+y-up**. Homemade movement & collision are **kept but rescaled to meters**. Independently shippable to the preview.

> Rationale for doing the units conversion here: the renderer (`CoordSpace`/PPM) and the network protocol (`Position` type 1) both assume meters, so the conversion is unavoidable in Phase 1 and Phase 2 then drops cleanly onto an already-metric world.

| # | Ticket | Detail |
| --- | --- | --- |
| **R1** | Add deps & protocol | Add `@vworlds/vecs-phaser` to `common` & client; `phaser`+`@vworlds/vecs-phaser-client` to client. Rewrite `schema.ts` to `phaserNetworkComponents` (+ `Explosion`). Update both `schema.test.ts` snapshots. |
| **R2** | Units & constants | Introduce `PIXELS_PER_METER = 100`, `WORLD_WIDTH/HEIGHT` in meters (10.24×7.68), center-origin bounds (`±5.12, ±3.84`). Convert **every** length in `constants.ts` to meters and **every per-frame speed/accel to per-second** (replace `perFrame`/`toFrames` frame-rate scaling with seconds-based values). Flip y-origin to center, +y up, for spawns/bounds. |
| **R3** | Color model | Convert all CSS color strings (`'#00ffcc'`, asteroid/pickup palettes, etc.) to `u32` RGB ints for `FillStyle.color`/`StrokeStyle.color`. Add a `parseColor` helper or change literals. |
| **R4** | Render components on spawns | In `playerSessions`/`spawning`/`shooting`/`combat`, replace homemade `Drawable`/`Shape`/`Arc`/`FilledRect`/`FillStyle`/`StrokeStyle` with phaser `Triangle`/`Polygon`/`Arc`/`Rectangle+Size`/`Line`/`FillStyle`/`StrokeStyle` + `Position`/`Rotation`. Call `setExclusiveComponents(...phaserRenderableComponents)` in server setup (PhaserServerModule does this in Phase 2). Keep homemade `Velocity`/`Thrust`/`Collider`/etc. as **server-local** components driving movement in meters. |
| **R5** | Embellishments as entities | Health bar → child `Rectangle`+`Size` entity (width = ratio·barWidth, color by ratio, removed when `barTimer≤0`). Shield → child `Arc` full-circle entity present only while shielded (stroke color by remaining time). Laser → child `Line` entity present while firing. Child follow via an `Offset` component + a `PRE_STORE` system (pattern: demo `ApplyLocalPositions`). |
| **R6** | HUD + explosions | HUD score/wave/message → server `Text` entities at fixed world corners (high `Depth`); update `Text.value` on change. Explosion → networked `Explosion` effect entity + server lifetime; client `ExplosionEffectModule` fires a Phaser emitter on `enter`. |
| **R7** | Client rewrite | Replace canvas bootstrap with `Phaser.Game` + one scene; connect `ClientWorld` with `phaserInterpolators()`; `world.module(PhaserRenderModule, {pixelsPerMeter:100})`; keep input/reconnect logic. Starfield + status as client chrome. Delete all draw/render/UI/particle systems, local components, and the HTML HUD. |
| **R8** | Handedness calibration | Verify rotate-left/right, thrust-forward, and arc sweep visually. Add a regression test: spawn a bullet at a known ship angle, assert its `Position` advances in the visually-forward direction after N ticks. Swap key mapping / negate the turn step if inverted. |
| **R9** | Phase-1 test pass | Update/replace server game tests for meters & render components; delete client draw-system tests; add a `CoordSpace` math test and an explosion-effect smoke test (mock Phaser). `npm run test|typecheck|lint|build` green. Ship to preview, manual QA. |

**Phase 1 exit criteria:** the game renders in Phaser from replicated phaser components, plays identically (in meters), client has no game components, preview build works.

---

## 9. Phase 2 — Physics migration (homemade → vecs-physics)

**Goal:** delete the homemade integrator and the `combat.ts` overlap loop; Box2D owns motion and collision events. Client is unchanged.

| # | Ticket | Detail |
| --- | --- | --- |
| **P1** | Sensor/contact probe (spike) | Add `@vworlds/vecs-physics` + `@vworlds/vecs-phaser-server` to server. Stand up `preloadPhysics()` + `PhysicsModule({ gravity:{x:0,y:0}, fixedTimeStep: DT, subSteps:4 })`. Write the probe test from §5.3 confirming kinematic-sensor↔dynamic-solid and solid↔solid (both `ContactEvents`) event delivery. Lock the body-type/sensor choices. |
| **P2** | Test & loop infra | Add a vitest setup that calls `preloadPhysics()` before physics tests (ref `lib/vecs-physics/tests/setup.ts`). Convert the server tick loop to a fixed-step accumulator passing constant `DT_MS`. |
| **P3** | Bodies & shapes | Convert each spawn to body + `Circle` shape child per §5.2: ship/asteroid/alien = Dynamic solid + `ContactEvents`; bullets/rockets/boomerangs/pickups = Kinematic + `Sensor`+`SensorEvents`. Set `CollisionFilter` from existing `CAT_*`/mask. Set `Material.restitution=0` on bodies. Spawn with both `PhysicsPosition` and `RenderPosition`. Install `PhaserServerModule` (takes over exclusivity + pose-sync). |
| **P4** | Movement → physics | Replace `movement.ts`: thrust → `Force`/`Impulse` on ship; friction → `Damping.linear`; ship turn → teleport `PhysicsRotation`; asteroid drift/spin → initial `LinearVelocity`/`AngularVelocity`. Delete `Velocity`/`AngularVelocity`/`Friction`/`Thrust` homemade components and the `Movement`/`Thrust`/`Friction`/`AngularMovement` systems. |
| **P5** | Collision → events | Replace the `ServerCollision` O(n²) loop + registry. Drive projectile/pickup outcomes from **`SensorEvents`** systems; ship/asteroid/alien outcomes from **`ContactEvents`** systems (both in `physics-post`). Port every `registerCollisionEffect` handler (asteroid split, damage, score, pickup apply, boomerang catch) to event handlers. Delete `Collider`; collision identity now comes from `CollisionFilter` + server-local markers (`Asteroid`/`Alien`/`Player`/`Bullet`/`Pickup`/`Boomerang`). |
| **P6** | Special motion | Rocket homing & boomerang pull → gameplay systems writing `LinearVelocity` (pre-physics, `ON_UPDATE`). Laser → keep `resolveLaserHits` raycast reading `Position`. Screen wrap → teleport `PhysicsPosition` in `physics-post`. Decay/lifetime → keep as server-local gameplay. |
| **P7** | Cleanup & wiring | Resolve `ChildOf` overloading per §5.1 (physics shapes are dedicated leaf children; ownership cascade preserved with `CleanupPolicy.Delete`). Verify alien-bullet shooting, respawn timers, wave spawning under physics. |
| **P8** | Phase-2 test pass | Rewrite `combat`/`movement`/`shooting`/`spawning` server tests against the physics model (step the world, assert events/positions). `npm run test|typecheck|lint|build` green. Ship to preview, manual QA: collisions, splitting, pickups, weapons, boss/wave flow, multiplayer. |

**Phase 2 exit criteria:** no homemade physics/collision code remains; Box2D drives motion & collision events; gameplay feel preserved; preview build works.

---

## 10. Component disposition (quick reference)

| Current component | Disposition |
| --- | --- |
| `Position`, `Rotation` (common) | **Replace** with vecs-phaser `Position`/`Rotation` (render, networked) + vecs-physics `Position`/`Rotation` (server-local). Import aliased (`RenderPosition`/`PhysicsPosition`). |
| `Drawable`, `Shape`, `Arc`, `FilledRect`, `FillStyle`, `StrokeStyle`, `Point`, `ISerializable` | **Delete.** Use vecs-phaser shapes/styles. |
| `PlayerShip`, `AsteroidView`, `ProjectileView`, `PickupView`, `HealthView`, `ShieldView`, `WeaponView`, `GameStateView`, `ExplosionView` | **Delete from the wire.** Fold display state into server-local markers + render components/`Text`. `ExplosionView` → networked `Explosion` effect. |
| `Velocity`, `AngularVelocity`, `Friction`, `Thrust`, `Collider` | **Delete** (Phase 2). Use `LinearVelocity`/`AngularVelocity`/`Damping`/`Force`/`CollisionFilter`. |
| `Health`, `Shield`, `LaserWeapon`, `AuraWeapon`, `RocketWeapon`, `BoomerangWeapon`, `DefaultWeapon`, `Boomerang`, `Pickup`, `HealthPickup`, `Player`, `ShipInput`, `Bullet`, `Rocket`, `Asteroid`, `Alien`, `Decay`, `Wraps`, `RandomClock` | **Keep server-local** (move into `apps/server` or keep in `common` but unnetworked). These are gameplay state. |
| `PlayerSession`, `PlayerInputIntent`, `SpawnTimer`, `RespawnTimer`, `ShootingCooldown` | **Keep server-local** (unchanged). |
| Client `Alpha`, `Label`, `Particle` | **Delete** (Phaser owns visuals). |

---

## 11. Testing strategy

- **Schema:** snapshot `NETWORK_COMPONENTS === [...phaserNetworkComponents, Explosion]`, `Position` type id 1 (both apps).
- **Physics probe (P1):** the sensor/contact delivery matrix — gates the whole physics model.
- **Server gameplay:** step a `ServerWorld` with physics installed and a fixed delta; assert collision outcomes via events (asteroid split, damage, score, pickup, boomerang catch), homing/pull velocity, wrap teleport, laser hits, respawn/wave flow.
- **Client:** `CoordSpace` math (center/flip/negate); `PhaserRenderModule` create-on-enter / update / destroy-on-exit / type-swap with **mock Phaser** objects (node env); `ExplosionEffectModule` fires once per `Explosion` enter.
- **Handedness (R8):** forward-fire regression test.
- **Gates:** `npm run test|typecheck|lint|build` across workspaces per phase; manual preview QA each phase.

---

## 12. Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| Box2D v3 sensor/contact semantics differ from assumptions | **P1 probe spike runs first**; body-type fallbacks documented in §5.3. |
| No raycast in v1 (laser) | Keep custom `distToSegment` raycast reading replicated `Position`. |
| Units conversion is wide (every constant) + handedness flip | Isolate in Phase 1; pixel/flip only in `CoordSpace`; R8 calibration + forward-fire test. |
| Residual physical response on solid body-body contacts | `restitution=0` + destroy-on-contact same tick + ship damping; asteroid-asteroid filtered off. |
| `ChildOf` overloaded (ownership + physics + render) | Physics only sees children with physics geometry; document leaf-shape rule; keep cascade-delete. |
| `PhaserServerModule` never *creates* render pose | Spawn bodies with both `PhysicsPosition` **and** `RenderPosition`. |
| Variable delta breaks Box2D | Fixed-step accumulator loop (P2). |
| Client bundle grows (Phaser); WASM in browser | Phaser is client-only and expected; **physics/WASM are server-only** — never import them from `common`/client. |
| Child-follow lag | Register child-follow after `PhaserServerModule` within `PRE_STORE`. |

---

## 13. Success criteria

1. Server creates entities with phaser render components **in meters**; client auto-renders them in Phaser with **no per-entity render code** and **zero game components**.
2. Origin-at-center, +y-up meters (server) ↔ y-down pixels (client) is correct and lives only in `CoordSpace`.
3. Box2D owns motion and collision; `combat.ts` overlap loop and the homemade integrator are deleted; gameplay feel (splitting, damage, pickups, weapons, waves, multiplayer) is preserved.
4. Laser/homing/boomerang/wrap work as physics-aware gameplay systems; explosions/starfield are client-local Phaser effects.
5. Both phases ship green to the GitHub Pages preview.

---

## 14. Reference reading (in `~/src/vecs`)

- **`apps/server/src/main.ts`, `apps/client/src/main.ts`** — the end-to-end template (read first).
- `lib/vecs/docs/design-guide.md` §§7,10 — companion-component lifecycle, the Phaser case study.
- `lib/vecs-physics/docs/{getting-started,components,shapes,events,systems-and-phases}.md`, README (V1 limitations).
- `lib/vecs-phaser/architecture/README.md` — coordinate model, lifecycle, demo migration §9.
- `lib/vecs-phaser-client/src/modules/*`, `coord_space.ts`, `sync.ts` — the client render adapter.
- `lib/vecs-phaser-server/src/PhaserServerModule.ts` — exclusivity + pose-sync (zero-config).
