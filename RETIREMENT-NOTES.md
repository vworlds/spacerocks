# E1-T4 — Legacy Content Retirement Notes

Ticket: E1-T4 (Retire legacy game content), plan #41, design #40.
Branch: `tickets/e1-t4-retire-legacy-content`

## What was retired (unplugged from the world install)

- **AliensModule** — removed from `apps/server/src/game/world.ts`. No alien
  entities ever spawn; the alien spawn clock (`RandomClockKind.Alien`) is no
  longer scheduled by any active module.
- **PickupsModule** — removed from `apps/server/src/game/world.ts`. No pickup
  entities ever spawn; none of the pickup spawn clocks
  (`ShieldPickup`/`LaserPickup`/`AuraPickup`/`RocketPickup`/`BoomerangPickup`/
  `HealthPickup`) are scheduled by any active module.
- **Wave/score/status state** — `GameStateView` reduced to a single `state`
  field (0 = playing, anything else = paused/lobby). The `addScore` helper was
  removed; all callers (combat, weapons, asteroids/splitting, aliens/damage,
  pickups/module) were updated. `SCORING` is no longer referenced by any
  active server module.
- **Alien-targeting paths** — removed from `combat/module.ts` (PlayerContact
  alien block), `weapons/module.ts` (ProjectileImpact alien block + alien-
  bullet-damages-player block + laser alien block), and
  `weapons/targeting.ts` (`findRocketTarget` now homes on asteroids only).
- **Alien render radius** — removed from `embellishments/module.ts`
  (`getBodyRadius`).

## What was KEPT in-tree for later cannibalization (D5)

These directories/files are **unplugged from the world install** but **left
in-tree and compiling** so later epics can cannibalize them:

| Kept for                                                      | Where                                               | Notes                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Combat explosions + `damagePlayer` helpers                    | `apps/server/src/game/modules/combat/`              | `CombatModule` is still installed; `damagePlayer`, `clearShield`, `killPlayer`, `Health`/`Shield`/`RespawnTimer` components all remain. Epic 10 cannibalizes these.                                                                                                             |
| `createExplosion` helper                                      | `apps/server/src/game/modules/gameState/helpers.ts` | Still used by combat, weapons, asteroids/splitting. Reused by the new mode.                                                                                                                                                                                                     |
| Alien steering/avoidance math + `damageEnemy`                 | `apps/server/src/game/modules/aliens/`              | **Unplugged** (`AliensModule` not installed) but the full directory (`module.ts`, `factories.ts`, `damage.ts`, `components.ts`) stays in-tree and compiles. `damageEnemy` no longer calls `addScore` (scoring retired). Epic 8 (tugbots) may reuse the steering/avoidance math. |
| Pickup collection + weapon-swap logic                         | `apps/server/src/game/modules/pickups/`             | **Unplugged** (`PickupsModule` not installed) but the full directory (`module.ts`, `factories.ts`, `components.ts`) stays in-tree and compiles. `addScore` calls removed from `applyPickupEffect`.                                                                              |
| Spawn timer scaffolding                                       | `apps/server/src/game/modules/spawning/`            | `SpawningModule` + `SpawnTimer` component still installed (scaffolding for reuse). `RandomClockKind` enum kept as-is. No active module schedules alien/pickup clocks.                                                                                                           |
| Weapon factories (incl. `ownerType: 'alien'` bullet)          | `apps/server/src/game/modules/weapons/factories.ts` | `createBullet` still supports `ownerType: 'alien'` for reuse; no active module creates alien bullets.                                                                                                                                                                           |
| Targeting helpers (`findNearestPlayer`, `rotateTowardTarget`) | `apps/server/src/game/modules/weapons/targeting.ts` | Kept exported; used by the kept-in-tree `aliens/module.ts`. `findRocketTarget` simplified to asteroids-only.                                                                                                                                                                    |
| All collision categories                                      | `packages/common/src/constants.ts`                  | `CAT_ENEMY`, `CAT_ENEMY_BULLET`, `CAT_PICKUP` etc. kept (append-only bitmask constants). No longer referenced by active modules but kept for reuse + to avoid renumbering.                                                                                                      |
| `SCORING` table                                               | `packages/common/src/constants.ts`                  | Kept in-tree; no active server module references it. Removed from client re-exports (`apps/client/src/constants.ts`) since it was dead there.                                                                                                                                   |

## Client

- `apps/client/src/render/ExplosionEffectModule.ts` — KEPT (reused by new
  mode, plan D2).
- `apps/client/src/render/HyperspaceEffect.ts` — KEPT (reused by new mode).
- `apps/client/src/constants.ts` — removed dead re-exports of
  `CAT_ENEMY`, `CAT_ENEMY_BULLET`, `CAT_PICKUP`, `SCORING` (nothing in the
  client reads them). `SHIELD_DAMAGE` kept (shields still exist server-side;
  the client re-export is harmless and may be needed by future client HUD
  code).

## Verification

- `npm run typecheck --workspaces` — clean.
- `npm run test --workspaces` — fully green (69 server tests, 2 client tests,
  33 common tests).
- Grep confirms no `AliensModule`/`PickupsModule` in the world install, no
  `createSpawnTimer` calls scheduling alien/pickup clocks in active modules,
  and no `createAlien`/`createPickup` calls outside the kept-in-tree
  aliens/pickups directories.
- World-boot tests (`pipeline.test.ts`, `startupCollision.test.ts`,
  `soak.test.ts`) pass — proving an asteroid-only world boots and runs.
