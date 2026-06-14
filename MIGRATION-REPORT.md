# Spacerocks → vecs-physics + vecs-phaser — Migration Report

**Branch:** `vecs-migration` → PR #30 (base `server`) · **Commits:** 25 (HEAD `db0f7ea`)
**Outcome:** Migration complete and green. Server validated end-to-end headlessly; client builds and renders via Phaser (one item — live browser playtest — is owner-verified, see §5).
**Companion docs:** [`MIGRATION-PLAN.md`](./MIGRATION-PLAN.md) (design + ticket breakdown).

**Update (2026-06-14) — vecs 1.0.27 follow-up.** Upgraded the `@vworlds/vecs*` suite to **1.0.27** and removed the workarounds upstream now obsoletes: **UP-1** (sensor↔solid via the new `Detectable` marker), **UP-3** (laser via `physics(world).rayCastAll`), **UP-4** (rocket homing via `physics(world).overlapCircle`). **UP-2** was discarded upstream (it is now a documented requirement, not a bug). The one API break — Entity `.parent(rel)` → `.target(rel)` — was fixed during the bump. Full gate (typecheck/lint/test/build) green. Per-gap status is marked in §6.

This report covers: what worked out of the box, what was deferred or couldn't be done, recommendations, follow-up tickets, and — the centerpiece — **upstream engine feature gaps** with descriptions, example usage, the workaround built in spacerocks, the upstream ticket to file, and the paired spacerocks follow-up ticket to remove each workaround once fixed upstream.

---

## 1. Executive summary

Spacerocks was moved off its two homemade subsystems onto the vecs ecosystem:

- **Rendering:** bespoke canvas-2D `Drawable`/`DrawContext` + server-authored draw callbacks → **`@vworlds/vecs-phaser` render components + `@vworlds/vecs-phaser-client` (Phaser 4)**. The client now carries **zero game components** and renders purely from replicated render components.
- **Physics:** homemade per-frame integrator + O(n²) category/mask overlap loop → **`@vworlds/vecs-physics` (Box2D v3)**. All motion is integrated by Box2D; all collisions are **sensor overlaps** with `CollisionFilter`.
- **Units:** world recoordinated to **meters, +y up, centered origin** (pixel/Y-flip only at the Phaser frontier, PPM=100).

Executed in two phases (R1–R9 rendering, P1–P12 physics + post-playtest fixes), ≥1 commit per ticket, branch pushed after every commit. Final gate: typecheck ✓, lint ✓, ~74 tests ✓, build ✓.

The single most important discovery — which **changed the architecture** — was the P1 physics probe: see [§6 / UP-1](#up-1).

---

## 2. What worked out of the box

These needed no workarounds and behaved as documented:

| Area | Notes |
| --- | --- |
| **`PhaserRenderModule` auto-render** | The client creates/updates/destroys Phaser GameObjects from replicated render components with **zero per-entity render code**. Shapes, Text, styles, transforms all "just rendered." The biggest win. |
| **`PhaserServerModule` pose-sync** | Zero-config copy of physics `Position`/`Rotation` → render pose in `PRE_STORE`, plus renderable exclusivity. Worked as documented (caveat: it only *copies*, never *creates* — spawn both poses; see §4). |
| **Client interpolation** | `Position` (type 1) interpolated for free; `phaserInterpolators()` added shortest-arc rotation. Smooth motion between server ticks. |
| **`PhysicsModule` core** | Box2D integration, fixed-step stepping, `CollisionFilter` gating, `SensorEvents`, `LinearVelocity`/`AngularVelocity` as authoritative components — all worked once units/ordering were correct. |
| **`CollisionFilter` ↔ legacy `CAT_*`** | The existing category/mask bitmasks mapped 1:1 onto `categoryBits`/`maskBits`. Friendly-fire gating worked unchanged. |
| **`ChildOf` cascade cleanup** | `CleanupPolicy.Delete` cascaded through owner→projectile and body→shape trees: destroying a ship removed its bullets *and* every physics shape child with **no orphan Box2D bodies** (verified by test). |
| **Reactive ECS lifecycle** | `enter`/`update`/`exit`, `setExclusiveComponents` (one renderable per entity), and component-presence-as-lifecycle drove the whole render/embellishment layer cleanly. |
| **npm packaging / WASM** | The four packages (`vecs-physics`, `vecs-phaser`, `vecs-phaser-client`, `vecs-phaser-server`) installed cleanly at `1.0.26`. `box2d3-wasm` loaded via `preloadPhysics()` in Node (vitest) and on the server. WASM stays server-side — the browser bundle has none. |
| **The demo apps as a template** | `~/src/vecs/apps/{server,client}` were an accurate, load-bearing reference; the migration closely mirrors them. |

---

## 3. What shipped (phase recap)

- **Phase 1 — rendering + units (R1–R9):** protocol → `phaserNetworkComponents` + an app `Explosion` effect component; world → meters/+y-up/centered; CSS colors → u32; server emits phaser render components; embellishments (health bar / shield ring / laser beam) and HUD modeled as server-owned entities; client rewritten to a Phaser scene; rotation handedness corrected; pipeline smoke test + full gate.
- **Phase 2 — physics (P1–P8):** sensor/contact probe spike (→ uniform model); fixed-step loop + physics test preload; bodies + Circle sensor shapes + `PhysicsModule` + `PhaserServerModule`; all motion via physics (homemade `Velocity`/`Thrust`/`Friction`/`AngularVelocity` deleted); collision via `SensorEvents` (homemade `Collider` + O(n²) loop deleted); special-motion verification (caught a wrap-ordering bug); `ChildOf` cascade + integration tests + dead `*View` removal; end-to-end soak.
- **Post-playtest fixes (P9–P12):** per-frame→per-second velocity scaling (30× slowness); install physics before spawning (wave-1 collision); mark `LaserWeapon` modified on timer end (stuck laser beam); move client chrome off the HUD (overlap).

---

## 4. Migration lessons (our bugs, not engine gaps)

Worth recording so they aren't re-learned:

1. **Units: per-frame vs per-second.** The legacy model integrated `position += velocity` per frame; Box2D `LinearVelocity` is **meters/second**. Every speed/accel had to be multiplied by `TICK_RATE` when entering physics (helper `perSecond()`). Missing this made everything 30× too slow (fixed in P9).
2. **`PhaserServerModule` never *creates* render pose** — it only copies. Spawn every body with **both** physics `Position` and render `Position` or it renders at the origin.
3. **Spawn order vs module install** — see [UP-2](#up-2); entities created before `PhysicsModule` silently lose collision.
4. **`getMut` auto-flags modified; `.each`/`.update` injection does not** — see [UP-7](#up-7); caused the stuck laser beam.
5. **Fixed timestep is mandatory** for Box2D; we run a fixed-step accumulator loop and pass a constant `DT_MS`.

---

## 5. Deferred / could not be done

| Item | Status / why | Recommendation |
| --- | --- | --- |
| **Live browser playtest** | Could not be done headlessly. Server is validated by boot + 540-tick physics soak (NaN/stability + bounded entities); the client builds and uses the proven demo render path. | Owner playtest pass (in progress — already surfaced P9–P12). |
| **Alien AI (hunting / shooting)** | **No alien-shooting or hunting system exists in the codebase** — aliens only drift and body-collide. This predates the migration (the legacy `createAlien` also only set a drift velocity). `ENTITY_CONFIG.ALIEN.TARGET_DIST_MAX`/`SHOOT_COOLDOWN`/`ASTEROID_AVOID_DIST` are defined but unused. | Decide if aliens should hunt/shoot; if so, build it (see SR-FU-9). Not a vecs gap. |
| **CCD for fast projectiles** | `Body.bullet` (continuous collision) is **not** enabled. At current speeds the per-tick step (~0.14 m) is smaller than the smallest asteroid diameter (~0.2 m), so no tunneling was observed, but small/fast edge cases are a risk. | Enable `Body.bullet = true` on bullets/rockets if tunneling appears (SR-FU-8). |
| **Physics shape vs visual fidelity** | Physics shape is a `Circle(radius)`; the render asteroid is an irregular polygon whose spikes reach ~1.2×radius. Hits on the outer spikes (beyond the circle) miss. | Acceptable arcade feel; if undesired, size the circle to the max spike or use a convex hull (SR-FU-10). |
| **Performance under load** | No load/perf benchmarking (many entities, many clients). | Run a perf pass before scaling player counts. |
| **Interest management** | `View` kept trivial (view-all) — fine for small co-op. | Revisit only if entity/player counts grow. |

---

## 6. Upstream engine feature gaps, workarounds, and paired follow-ups

This is the actionable core. Each gap has: **what's missing**, **expected behavior**, **example usage**, **the workaround in spacerocks (with file refs)**, an **upstream ticket** to file against the vecs ecosystem, and a **spacerocks follow-up ticket** to remove the workaround once upstream ships.

Severity legend: 🔴 blocked/changed architecture · 🟠 forced a non-trivial workaround · 🟡 ergonomics/polish.

| ID | Package | Gap | Severity |
| --- | --- | --- | --- |
| UP-1 | vecs-physics | Sensors do not detect solid (non-sensor) shapes; sensor detection semantics undocumented | 🔴 |
| UP-2 | vecs-physics | Installing `PhysicsModule` after entities exist does not backfill their shapes (collision silently dead) | 🔴 |
| UP-3 | vecs-physics | No ray casts (documented v1 limit) | 🟠 |
| UP-4 | vecs-physics | No spatial / overlap / nearest queries (documented v1 limit) | 🟠 |
| UP-5 | vecs-phaser | No parent-follow / local-transform composition for child render entities | 🟠 |
| UP-6 | vecs-phaser | No particle / effect primitive (explosions) | 🟠 |
| UP-7 | vecs (core) | `.each`/`.update`-injected components don't auto-flag `modified` (asymmetry with `getMut`) | 🟠 |
| UP-8 | vecs-phaser | No screen-space/anchored UI layer and no per-entity Text origin/anchor control | 🟡 |
| UP-9 | vecs-phaser | No sprite/image support (documented post-MVP) | 🟡 |
| UP-10 | vecs-physics | No built-in fixed-step accumulator helper | 🟡 |

---

> **Resolution status (vecs 1.0.27).** **UP-1, UP-3, UP-4 are resolved upstream** and their spacerocks workarounds have been removed (SR-FU-1/3/4 below). **UP-2 was discarded upstream** — resolved by documentation: installing `PhysicsModule` before adding physics components is now a documented requirement (no backfill), which is the correct usage, so the install-before-spawn ordering is kept. **UP-5…UP-10 remain open** as of 1.0.27.

### UP-1 — Sensors don't detect solids; sensor semantics undocumented 🔴 {#up-1}

> **✅ RESOLVED in vecs 1.0.27** via the new `Detectable` marker — a solid shape opts into sensor detection (Box2D v3 requires both sides to opt in). Verified empirically by the updated probe (`apps/server/tests/physics/probe.test.ts`, scenarios A/variant). Spacerocks **retains the uniform sensor model by design** (pure-trigger gameplay), so no gameplay code changed — see SR-FU-1.

**What's missing / wrong.** `lib/vecs-physics/docs/events.md` implies a `Sensor` shape detects overlapping **solid** shapes (the "checkpoint" example pairs a sensor zone with a solid player). Empirically, in the shipped `box2d3-wasm` build (probe `apps/server/tests/physics/probe.test.ts`):

- sensor ↔ **solid** → **no** `SensorEvents` (neither side) ❌
- sensor ↔ **sensor** → `SensorEvents` fire on **both** shapes ✅
- solid ↔ solid (both `ContactEvents`) → both fire ✅
- `CollisionFilter` correctly gates sensor↔sensor ✅

So either it's a bug, or (likely) Box2D v3 requires the **sensed** shape to also have sensor events enabled and vecs-physics neither exposes nor documents that. Net: there is **no documented, working way to make a sensor detect a non-sensor body**.

**Expected.** Either: (a) a sensor detects any filter-matching shape regardless of the other shape's sensor flag (matching the docs); or (b) an explicit, documented opt-in on the *sensed* shape (e.g. `Detectable`/`enableSensorEvents`) so mixed sensor↔solid triggers work; and docs/tests that state the actual rule.

**Example usage (what we wanted):**
```ts
// pickup = sensor zone; player = solid body. Expect the pickup to fire on overlap.
pickupShape.add(Sensor).add(SensorEvents).set(CollisionFilter, { categoryBits: PICKUP, maskBits: PLAYER });
playerShape.set(CollisionFilter, { categoryBits: PLAYER, maskBits: PICKUP }); // solid
// world.system(...).update(SensorEvents, ...) on the pickup → should fire when the player overlaps.
```

**Workaround.** Adopted a **uniform sensor model**: *every* gameplay entity is a Dynamic body + `Circle` + `Sensor` + `SensorEvents` + `CollisionFilter`, so all collisions are sensor↔sensor (which works) with zero physical response. This actually suits Spacerocks' pure-trigger gameplay well. Implemented across `apps/server/src/game/{spawning,shooting,playerSessions}.ts` (`createPhysicsCircleSensor`) and the collision dispatcher in `apps/server/src/game/combat.ts`. Documented in `MIGRATION-PLAN.md` §5.3 and `.vecs-ref/VECS-API-NOTES.md`.

**Upstream ticket (file against vecs-physics):** *"Document and fix sensor↔solid detection semantics."* Clarify which shapes a sensor detects; make the checkpoint-style sensor↔solid example actually work (or replace it); add an `enableSensorEvents`/`Detectable` opt-in if that's the intended model; add parity tests for sensor↔solid, sensor↔sensor, and filter gating across body types.

**Spacerocks follow-up — SR-FU-1. ✅ DONE (vecs 1.0.27).** Probe updated to prove `Detectable` enables sensor↔solid detection; the uniform sensor model is retained by design (no gameplay change). *Original guidance — once UP-1 ships:* re-evaluate the uniform-sensor model. If we ever want **physical response** anywhere (e.g. ships bouncing off a future asteroid type), switch those pairs to solids + `ContactEvents` and use sensors only for triggers. Until then, keep the uniform model but drop the empirical probe's "sensor↔solid fails" assertions if upstream changes the behavior.

---

### UP-2 — `PhysicsModule` installed after entities exist doesn't backfill their shapes 🔴 {#up-2}

> **⛔ DISCARDED upstream — resolved by documentation.** Installing `PhysicsModule` before adding physics components is now a documented requirement (entities created before install are intentionally not backfilled). This is the correct way to use vecs-physics; spacerocks keeps the install-before-spawn ordering in `world.ts` — see SR-FU-2.

**What's missing / wrong.** `docs/systems-and-phases.md` says physics "can be installed after a world already exists" and participates "starting with the next `world.progress()`." In practice, entities that have `Body` + a child shape **before** `world.module(PhysicsModule)` get a body that **integrates velocity (they move)** but whose **sensor shape never functions** — `SensorEvents` never fire, so collisions are silently dead. Entities created **after** install work perfectly. This produced a shipped bug where the entire **wave‑1** of asteroids (spawned at startup, before install) was non-collidable while wave 2+ worked (repro: a wave-1 asteroid survived a point-blank bullet; an identical runtime asteroid was destroyed).

**Expected.** Installing `PhysicsModule` should **backfill all pre-existing `Body`+shape entities** so they are indistinguishable from runtime-created ones — or the docs should explicitly forbid creating physics entities before install (and ideally `debug` should warn).

**Example usage (what should work):**
```ts
const ground = world.entity().set(Body).set(Position, { x: 0, y: -1 });
world.entity().set(ChildOf, { target: ground }).set(Box, { hx: 25, hy: 1 });
await preloadPhysics();
world.module(PhysicsModule);     // EXPECT: ground gets a working body+fixture
world.progress(now, dt);          // ground collides normally
```

**Workaround.** Reordered `apps/server/src/game/world.ts` so `PhysicsModule` + `PhaserServerModule` install **before** any spawning system runs (`installSpawningSystems` spawns wave‑1 at install time). Regression test: `apps/server/tests/game/startupCollision.test.ts`. (Commit `0fe8f09`.)

**Upstream ticket (file against vecs-physics):** *"Late `PhysicsModule` install must backfill existing Body/shape entities (or warn)."* Reproduce: create body+shape, then install module, then step — assert the shape's `SensorEvents`/`ContactEvents` fire. Fix the lifecycle backfill ordering (body created but child shape not attached on backfill), and add a debug warning for physics components present at install time if backfill is intentionally unsupported.

**Spacerocks follow-up — SR-FU-2. ⛔ N/A — UP-2 discarded upstream.** Installing `PhysicsModule` before creating physics entities is now a documented requirement, so the install-before-spawn ordering in `world.ts` **stays** (it is correct usage, not a workaround). `startupCollision.test.ts` is kept as a guard.

---

### UP-3 — No ray casts 🟠 {#up-3}

> **✅ RESOLVED in vecs 1.0.27** via `physics(world).rayCastAll` / `rayCastClosest` (returns shape entities with point/normal/fraction, honoring `CollisionFilter`). The hand-rolled laser raycast was removed — see SR-FU-3.

**What's missing.** vecs-physics v1 has **no ray/segment casts** (documented limitation). The laser is a hitscan beam that should test the beam segment against shapes.

**Expected.**
```ts
const hits = world.raycast({ x, y }, { dx, dy }, maxDistance, { maskBits });
for (const h of hits) damage(h.shape.parent(ChildOf));
```

**Workaround.** Custom geometric raycast: `resolveLaserHits()` in `apps/server/src/game/combat.ts` does an **O(n) scan** of all asteroids/aliens and tests `distToSegment(center, beamStart, beamEnd) < radius`. It uses entity **centers + radius**, not actual shapes, and ignores the broadphase.

**Upstream ticket (file against vecs-physics):** *"Add ray/segment cast queries (`raycastClosest`/`raycastAll`) honoring `CollisionFilter`, returning shape + point + normal + fraction."*

**Spacerocks follow-up — SR-FU-3. ✅ DONE (vecs 1.0.27).** `resolveLaserHits` now casts with `physics(world).rayCastAll` along the beam (filter `CAT_ASTEROID | CAT_ENEMY`), mapping hit shapes to bodies via `.target(ChildOf)`; the hand-rolled `distToSegment` helper was deleted. *Original guidance — once UP-3 ships:* replace `resolveLaserHits` + `distToSegment` with a physics segment cast along the ship's facing (more accurate, shape-aware, broadphase-backed). Remove the hand-rolled `distToSegment` helper.

---

### UP-4 — No spatial / overlap / nearest queries 🟠 {#up-4}

> **✅ RESOLVED in vecs 1.0.27** via `physics(world).overlapCircle` (precise mid-phase) and `overlapAABB` (broad-phase), honoring `CollisionFilter`. The O(n) rocket-homing scan was removed — see SR-FU-4.

**What's missing.** No AABB/region/overlap queries (documented v1 limitation). Gameplay that needs "what's near here?" must scan all entities.

**Expected.**
```ts
const near = world.overlapAABB({ minX, minY, maxX, maxY }, { maskBits });   // or queryCircle(center, r)
```

**Workaround.** O(n) `world.filter([...]).forEach(...)` scans — e.g. rocket homing target selection `findNearest()` in `apps/server/src/game/shooting.ts` scans every alien then every asteroid each homing tick.

**Upstream ticket (file against vecs-physics):** *"Add broadphase-backed spatial queries: `overlapAABB`, `queryCircle`/`queryPoint`, and a `closest`/k-nearest helper, honoring `CollisionFilter`."*

**Spacerocks follow-up — SR-FU-4. ✅ DONE (vecs 1.0.27).** `findNearest` now queries `physics(world).overlapCircle({ center, radius: HOME_RANGE, filter })` and picks the nearest candidate (alien-first, asteroid fallback) instead of scanning every entity. *Original guidance — once UP-4 ships:* replace `findNearest` O(n) scans (rocket homing, and any proximity checks) with a `queryCircle(position, HOME_RANGE)` against the broadphase.

---

### UP-5 — No parent-follow / local-transform for child render entities 🟠 {#up-5}

**What's missing.** vecs-phaser render `Position`/`Rotation` are world-space only. There is no built-in way for a child render entity to **follow its parent's transform with a local offset** (composition). Both the vecs demo *and* spacerocks hand-roll the exact same `Offset` + cascade system.

**Expected.** A local-transform/parenting concept on the render side, e.g.:
```ts
child.set(ChildOf, { target: parent }).set(LocalPosition, { x: 0, y: 0.3 }).add(InheritRotation);
// client composes child world transform = parent world transform ∘ local
```

**Workaround.** Custom server-side components `Offset`, `FollowParent`, `FollowParentRotation` + two `PRE_STORE` cascade systems (`ApplyEmbellishmentLocalPositions`/`...Rotations`) in `apps/server/src/game/embellishments.ts`, computing child `RenderPosition`/`RenderRotation` = parent + offset each tick. Health bar, shield ring, and laser beam all rely on it.

**Upstream ticket (file against vecs-phaser / vecs-phaser-server):** *"Provide parent-relative render transforms (local offset + optional inherited rotation/scale) so child render entities follow a parent without per-app follow systems."*

**Spacerocks follow-up — SR-FU-5.** *Once UP-5 ships:* delete `Offset`/`FollowParent`/`FollowParentRotation` and the two `ApplyEmbellishment*` systems; reattach health bar / shield ring / laser beam as parent-relative children using the upstream primitive.

---

### UP-6 — No particle / effect primitive (explosions) 🟠 {#up-6}

**What's missing.** vecs-phaser has only static shapes/text. There is no replicated **particle/effect** primitive, so transient VFX (explosions) can't be expressed as render components.

**Expected.** A networked effect/particle component (or an effect-spawn protocol) that the client renderer turns into a Phaser emitter — e.g. `Burst { color, size, count, lifespan, seed }`.

**Workaround.** App-defined networked `Explosion` component (`packages/common/src/components/Explosion.ts`) carrying `{ color, size, seed, duration }`; the server spawns a short-lived `Explosion` entity (auto-removed by `Decay`); the client has a bespoke `apps/client/src/render/ExplosionEffectModule.ts` that fires a Phaser `ParticleEmitter` on the `enter` of an `Explosion`. This is the **one** non-vecs-phaser networked component and the **one** piece of bespoke client render code.

**Upstream ticket (file against vecs-phaser + vecs-phaser-client):** *"First-class particle/burst effect render component."* Data-only component in vecs-phaser; client adapter spawns/destroys an emitter; seed for determinism.

**Spacerocks follow-up — SR-FU-6.** *Once UP-6 ships:* replace the app `Explosion` component and `ExplosionEffectModule` with the upstream effect component; remove the bespoke client render module entirely (restores "zero bespoke client render code").

---

### UP-7 — Injected components don't auto-flag `modified` (asymmetry with `getMut`) 🟠 {#up-7}

**What's missing / footgun.** `entity.getMut(C)` auto-flags the component `modified` (reactive `.update(C)` consumers run). But a component **injected** into a `.each([C])` / `.update(C, [...])` callback, when mutated in place, does **not** auto-flag — you must call `entity.modified(C)` manually. This inconsistency is easy to miss and silently breaks reactivity. It caused a shipped bug: `LaserSystem` set `laser.firing = false` via `.each` injection without `modified`, so the reactive laser-beam embellishment never tore the beam down (beam stayed on screen though damage stopped).

**Expected.** Consistent semantics — either injected components flag on mutation like `getMut`, or a documented/lint-enforced rule, or a `mutate(C, fn)` injection helper that flags.

**Example (the trap):**
```ts
.each([LaserWeapon], (ship, [laser]) => { laser.firing = false; /* reactive .update(LaserWeapon) does NOT run */ });
```

**Workaround.** Explicit `ship.modified(LaserWeapon)` after the mutation in `apps/server/src/game/shooting.ts` `LaserSystem`. Regression test: `apps/server/tests/game/laserBeam.test.ts`. (Commit `50765db`.) (Same care taken elsewhere, e.g. `entity.modified(RenderPosition)` in follow systems.)

**Upstream ticket (file against vecs core):** *"Make in-place mutation of `.each`/`.update`-injected components flag `modified` consistently with `getMut` (or add a `mutate()` injection + docs/lint)."*

**Spacerocks follow-up — SR-FU-7.** *Once UP-7 ships:* audit for now-redundant explicit `entity.modified(...)` calls following injected-component mutations and simplify; keep `laserBeam.test.ts` as a guard.

---

### UP-8 — No screen-space/anchored UI layer; no Text origin/anchor control 🟡 {#up-8}

**What's missing.** (a) Render positions are world-space meters only — there is no **screen-space/anchored UI** layer, so HUD (score/wave/message) had to be placed at fixed **world** coordinates that happen to map to screen corners (fragile: breaks with a camera, different aspect, or zoom). (b) The client renderer forces **Text origin to 0.5** (centered) with no per-entity anchor, so corner-aligned labels must be positioned by their center.

**Expected.** A screen-space/anchored render component (e.g. `Anchor { corner, x, y }` rendered in a fixed UI layer) and/or a per-entity `Origin { x, y }` for Text/shapes.

**Workaround.** HUD = server-owned world-space `Text` entities at fixed inset corners (`apps/server/src/game/hud.ts`); client chrome moved to the opposite edge to avoid overlap (`apps/client/src/main.ts`, commit `db0f7ea`). Centered-origin Text accepted.

**Upstream ticket (file against vecs-phaser + vecs-phaser-client):** *"Screen-space/anchored UI render layer + per-entity Text/shape origin (anchor) control."*

**Spacerocks follow-up — SR-FU-8.** *Once UP-8 ships:* move HUD to a proper anchored UI layer (top-left corner anchor, left-aligned), independent of world size/camera; remove the fixed-world-coordinate HUD placement and the manual chrome offset.

---

### UP-9 — No sprite / image support 🟡 {#up-9}

**What's missing.** vecs-phaser is vector-shapes + text only (sprites/images are a documented post-MVP item). Spacerocks is currently all vector art, so this didn't block anything — but any future art pass (textured ships/asteroids, UI icons) needs it.

**Expected.** A networked `Sprite`/`Image` render component + an asset-loading protocol; client adapter creates Phaser sprites.

**Workaround.** None needed (vector art only).

**Upstream ticket (file against vecs-phaser + vecs-phaser-client):** *"Sprite/Image render component + asset-load protocol."*

**Spacerocks follow-up — SR-FU-9 (optional/art-dependent).** *Once UP-9 ships and if we want raster art:* add textured sprites for ships/asteroids/pickups.

---

### UP-10 — No fixed-step accumulator helper 🟡 {#up-10}

**What's missing.** Box2D requires a fixed timestep; the app must hand-roll a real-time→fixed-step accumulator (both the demo and spacerocks do). A small helper would remove boilerplate and prevent the variable-delta footgun.

**Expected.** An opt-in driver, e.g. `world.progressFixed(now, { fixedDeltaMs, maxCatchUp })` or a `FixedStepRunner`.

**Workaround.** Hand-rolled accumulator in `apps/server/src/index.ts` passing a constant `DT_MS`.

**Upstream ticket (file against vecs-physics or vecs core):** *"Provide a fixed-step accumulator/runner helper for physics-driven worlds."*

**Spacerocks follow-up — SR-FU-10.** *Once UP-10 ships:* replace the hand-rolled loop in `index.ts` with the helper.

---

## 7. Consolidated follow-up tickets

**Upstream-dependent (remove a workaround when the engine ships the fix):** SR-FU-1 … SR-FU-10 above, each paired to UP-1 … UP-10. *Status: **SR-FU-1, SR-FU-3, SR-FU-4 are DONE** (vecs 1.0.27); **SR-FU-2 is N/A** (UP-2 discarded upstream); SR-FU-5 … SR-FU-10 remain open.*

**Spacerocks-only (no upstream dependency):**

- **SR-FU-A — Live browser QA pass.** Full playtest of the deployed preview across both players, all weapons, waves, pickups, reconnect. (Owner-driven; already surfacing issues.)
- **SR-FU-B — Alien AI.** Aliens currently only drift. Decide/implement hunting + shooting (the `ALIEN.*` AI constants are defined but unused), producing enemy bullets via the existing sensor-collision path.
- **SR-FU-C — Projectile CCD.** If tunneling appears at high speeds, set `Body.bullet = true` on bullets/rockets/boomerangs and re-test the smallest asteroid case.
- **SR-FU-D — Hit fidelity.** Decide whether the asteroid physics `Circle` should match the polygon's max spike (fairer hits) or stay at mean radius (current). Consider per-shape tuning for the ship too.
- **SR-FU-E — Feel tuning.** Re-balance ship thrust/friction terminal speed, bullet speed, asteroid drift now that they're in true m/s (constants in `packages/common/src/constants.ts`).
- **SR-FU-F — Client bundle size.** Phaser pushes the bundle past Vite's 500 KB warning; consider code-splitting/manual chunks if load time matters for the GitHub Pages preview.
- **SR-FU-G — Documentation sync.** Update README/architecture docs to describe the vecs stack (current docs still describe the pre-migration architecture); `architecture/PLAN.md` (which said "do not use vecs-physics") is superseded by `MIGRATION-PLAN.md`.

---

## 8. Recommendations

1. **Playtest, then tune constants** (SR-FU-A, SR-FU-E) — the architecture is sound; remaining issues are gameplay feel and integration polish, all now simple constant/logic tweaks.
2. **File UP-1 and UP-2 first** — they are genuine engine bugs (or doc/behavior mismatches) that bit hard and will bite the next vecs-physics adopter. They also unlock the cleanest spacerocks simplifications.
3. **Treat UP-5 and UP-6 as the highest-value vecs-phaser features** — they're the only reasons spacerocks has *any* bespoke client render code / extra networked component. Landing them restores the "pure server-driven render, zero client render code" ideal.
4. **Keep the regression tests** added for each shipped bug (`startupCollision`, `laserBeam`, `specialMotion`, the `perSecond` speed tests, the cascade/soak tests) — they encode the engine footguns and will catch upstream behavior changes during version bumps.
5. **When bumping vecs versions,** re-run `apps/server/tests/physics/probe.test.ts` first — it pins the sensor/contact behavior the whole collision model depends on (UP-1).

---

## 9. Appendix

- **Branch / PR:** `vecs-migration`, PR #30 → `server`. 25 commits, HEAD `db0f7ea`.
- **Tests:** ~74 across workspaces (client / server / common); full gate (typecheck, lint, test, build) green; server boots and ticks clean; 540-tick physics soak passes.
- **Key workaround locations (for the follow-ups):**
  - Uniform sensor model + collision dispatch — `apps/server/src/game/combat.ts`, `createPhysicsCircleSensor` in `spawning.ts`/`shooting.ts`/`playerSessions.ts` (UP-1)
  - Install-before-spawn ordering — `apps/server/src/game/world.ts` (UP-2)
  - Laser raycast — `resolveLaserHits`/`distToSegment` in `apps/server/src/game/combat.ts` (UP-3)
  - Nearest-target scan — `findNearest` in `apps/server/src/game/shooting.ts` (UP-4)
  - Parent-follow render — `Offset`/`FollowParent*` + `ApplyEmbellishment*` in `apps/server/src/game/embellishments.ts` (UP-5)
  - Explosion effect — `packages/common/src/components/Explosion.ts` + `apps/client/src/render/ExplosionEffectModule.ts` (UP-6)
  - Explicit `modified` after injected mutation — `LaserSystem` in `apps/server/src/game/shooting.ts` (UP-7)
  - World-space HUD + chrome offset — `apps/server/src/game/hud.ts`, `apps/client/src/main.ts` (UP-8)
  - Fixed-step loop — `apps/server/src/index.ts` (UP-10)
  - Unit conversion — `perSecond()` in `packages/common/src/constants.ts`, applied in `movement.ts`/`shooting.ts`/`spawning.ts`
- **Physics behavior probe (pin this on version bumps):** `apps/server/tests/physics/probe.test.ts`.
