import { ChildOf, POST_UPDATE, Module, type Entity } from '@vworlds/vecs';
import {
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  Alien,
  Asteroid,
  AsteroidView,
  COLORS,
  ENTITY_CONFIG,
  GAME_CONFIG,
  PlayerShip,
  RandomClockKind,
} from '@spacerocks/common';
import { Position } from '@vworlds/vecs-phaser';
import { registerAliensComponents } from './components';
import { createAlien } from './factory';
import { damageEnemy } from './damage';
import { createBullet } from '../weapons/factories';
import { findNearestPlayer, rotateTowardTarget } from '../weapons/targeting';
import { WorldRng } from '../rng/components';
import { createSpawnTimer, SpawnTimer } from '../spawning/components';
import { createExplosion, isPlaying } from '../gameState/helpers';

function countEntities(
  world: import('@vworlds/vecs').World,
  component: import('@vworlds/vecs').ComponentClass,
): number {
  let count = 0;
  world.filter([component]).forEach([], () => {
    count += 1;
  });
  return count;
}

function bodyOf(
  world: import('@vworlds/vecs').World,
  shape: Entity | undefined,
): Entity | undefined {
  if (!shape || shape.destroyed) return undefined;
  const body = shape.target(ChildOf);
  if (!body || body.destroyed || !world.getEntity(body.eid)) return undefined;
  return body;
}

/**
 * Alien lifecycle: periodic spawning (gated by `GAME_CONFIG.ALIEN_CAP`), alien
 * shooting (homes toward the nearest player), and alien-vs-asteroid contact
 * (alien takes bullet damage and dies on impact).
 *
 * Dependencies: `RngModule`, `SpawningModule` (`SpawnTimer`),
 * `WeaponsModule` (`createBullet`, targeting helpers), `GameStateModule`
 * (`isPlaying`, `createExplosion`).
 */
export class AliensModule extends Module {
  override init(): void {
    const world = this.world;
    const rng = world.get(WorldRng)?.prng;
    if (!rng) {
      throw new Error('AliensModule requires RngModule to be loaded first');
    }
    registerAliensComponents(world);

    createSpawnTimer(
      world,
      rng,
      Date.now(),
      RandomClockKind.Alien,
      GAME_CONFIG.ALIEN_SPAWN_MIN_WAIT,
      GAME_CONFIG.ALIEN_SPAWN_MAX_WAIT,
    );

    const playerTargetQuery = world
      .query('AlienShootingPlayers')
      .with(PlayerShip, PhysicsPosition)
      .build();

    world
      .system('ServerAlienClockSystem')
      .interval(0.5)
      .with(SpawnTimer)
      .each([SpawnTimer], (_entity, [timer]) => {
        if (!isPlaying(world)) return;
        if (timer.kind !== RandomClockKind.Alien) return;
        const now = Date.now();
        if (now < timer.nextTick) return;

        if (countEntities(world, Alien) < GAME_CONFIG.ALIEN_CAP)
          createAlien(world, rng);
        timer.nextTick = now + rng.range(timer.minWait, timer.maxWait);
      });

    world
      .system('AlienShooting')
      .with(Alien, PhysicsPosition, PhysicsRotation)
      .each(
        [Alien, PhysicsPosition, PhysicsRotation],
        (alienEntity, [alien, position, rotation]) => {
          const target = findNearestPlayer(playerTargetQuery, position);
          const targetAngle = target
            ? Math.atan2(target.y - position.y, target.x - position.x)
            : undefined;
          const facingTarget =
            targetAngle !== undefined
              ? rotateTowardTarget(alienEntity, rotation, targetAngle)
              : false;

          if (alien.shootCooldown > 0) {
            alien.shootCooldown -= 1;
            return;
          }

          if (!target || !facingTarget) return;
          const spawnOffset = ENTITY_CONFIG.ALIEN.RADIUS + 0.04;
          createBullet(
            world,
            alienEntity,
            position.x + Math.cos(rotation.angle) * spawnOffset,
            position.y + Math.sin(rotation.angle) * spawnOffset,
            rotation.angle,
            COLORS.orange,
            'alien',
          );
          alien.shootCooldown = ENTITY_CONFIG.ALIEN.SHOOT_COOLDOWN_BASE;
        },
      );

    const alienContactProcessed = new Set<number>();
    const alienContactConsumed = new Set<number>();

    world
      .system('ResetAlienContactFrame')
      .phase(POST_UPDATE)
      .run(() => {
        alienContactProcessed.clear();
        alienContactConsumed.clear();
      });

    world
      .system('AlienContact')
      .with({ parent: Alien })
      .phase(POST_UPDATE)
      .update(SensorEvents, (shape, events) => {
        if (!isPlaying(world)) return;
        if (alienContactProcessed.has(shape.eid)) return;
        alienContactProcessed.add(shape.eid);
        const self = bodyOf(world, shape);
        if (!self || self.destroyed || alienContactConsumed.has(self.eid))
          return;

        for (const event of events.begin) {
          const other = bodyOf(world, event.other);
          if (
            !other ||
            other === self ||
            other.destroyed ||
            alienContactConsumed.has(other.eid)
          )
            continue;

          if (other.get(Asteroid)) {
            const view = other.get(AsteroidView);
            const pos = other.get(Position);
            damageEnemy(world, self, ENTITY_CONFIG.BULLET.DAMAGE);
            if (pos)
              createExplosion(
                world,
                pos.x,
                pos.y,
                view?.color ?? COLORS.orange,
                0.05,
              );
            alienContactConsumed.add(self.eid);
            continue;
          }
        }
      });
  }
}
