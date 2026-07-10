import {
  ChildOf,
  Module,
  POST_UPDATE,
  type Entity,
  type World,
} from '@vworlds/vecs';
import { Position } from '@vworlds/vecs-phaser';
import { SensorEvents } from '@vworlds/vecs-physics';
import { COLORS, ENTITY_CONFIG } from '@spacerocks/common';
import { ProgressBar } from '@spacerocks/common';
import { createExplosion, isPlaying } from '../gameState/helpers';
import {
  Asteroid,
  AsteroidView,
  Components as AsteroidsComponents,
} from '../asteroids/components';
import { Components as MovementComponents } from '../movement/components';
import { PlayerShip } from '../playerShips/components';
import { createPlayerShip } from '../playerShips/factories';
import { PlayerShipsModule } from '../playerShips/module';
import { Components as WeaponsComponents } from '../weapons/components';
import { Components, Health, RespawnTimer } from './components';
import {
  Components as PlayerSessionsComponents,
  PlayerSession,
} from '../playerSessions/components';

/**
 * Applies health damage to a player. Health takes 10 hp per hit and returns
 * true if the player dies (spawning a `RespawnTimer`). Asteroid contact
 * routes here.
 */
export function damagePlayer(world: World, player: Entity): boolean {
  const health = player.getMut(Health);
  if (!health) return false;
  health.hp -= 10;
  health.healthBarTimer = ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER;
  player.modified(Health);
  if (health.hp <= 0) {
    killPlayer(world, player);
    return true;
  }
  return false;
}

function killPlayer(world: World, player: Entity): void {
  const position = player.get(Position);
  if (position)
    createExplosion(world, position.x, position.y, COLORS.white, 0.2);
  const playerShip = player.get(PlayerShip);
  const session = player.get(ChildOf)?.target;
  if (session?.get(PlayerSession) && playerShip) {
    world.entity().set(RespawnTimer, {
      sessionId: session.eid,
      playerIndex: playerShip.playerIndex,
    });
  }
  player.destroy();
}

function bodyOf(world: World, shape: Entity | undefined): Entity | undefined {
  if (!shape || shape.destroyed) return undefined;
  const body = shape.target(ChildOf);
  if (!body || body.destroyed || !world.getEntity(body.eid)) return undefined;
  return body;
}

/**
 * Player-body collision system: handles a player ship bumping into an
 * asteroid (shields absorb; otherwise the player takes asteroid-collision
 * damage).
 *
 * Depends on `PlayerShipsModule` (respawn uses `createPlayerShip`).
 */
export class CombatModule extends Module {
  override init(): void {
    const world = this.world;
    world.module(PlayerSessionsComponents);
    world.module(PlayerShipsModule);
    world.module(MovementComponents);
    world.module(WeaponsComponents);
    world.module(AsteroidsComponents);
    world.module(Components);

    world
      .system('ServerHealthSystem')
      .with(Health)
      .each([Health], (entity, [health]) => {
        if (health.healthBarTimer > 0) {
          health.healthBarTimer -= 1;
          entity.modified(Health);
        }
        // Sync the networked ProgressBar from Health while the health bar
        // timer is active (recently damaged). When it expires, remove the
        // ProgressBar so the bar hides. The value is a 0–100 percentage.
        if (health.healthBarTimer > 0 && health.maxHp > 0) {
          const value = Math.round((health.hp / health.maxHp) * 100);
          const bar = entity.getMut(ProgressBar);
          if (bar) {
            if (bar.value !== value) {
              bar.value = value;
              entity.modified(ProgressBar);
            }
          } else {
            entity.set(ProgressBar, { value });
          }
        } else {
          if (entity.get(ProgressBar)) entity.remove(ProgressBar);
        }
      });

    world
      .system('ServerRespawnSystem')
      .with(RespawnTimer)
      .each([RespawnTimer], (entity, [timer]) => {
        timer.frames -= 1;
        if (timer.frames > 0) return;

        const session = world.getEntity(timer.sessionId);
        if (session?.get(PlayerSession)) {
          createPlayerShip(world, session, timer.playerIndex);
        }
        entity.destroy();
      });

    const contactConsumed = new Set<number>();
    const contactProcessed = new Set<number>();

    world
      .system('ResetPlayerContactFrame')
      .phase(POST_UPDATE)
      .run(() => {
        contactConsumed.clear();
        contactProcessed.clear();
      });

    world
      .system('PlayerContact')
      .with({ parent: PlayerShip })
      .phase(POST_UPDATE)
      .update(SensorEvents, (shape, events) => {
        if (!isPlaying(world)) return;
        if (contactProcessed.has(shape.eid)) return;
        contactProcessed.add(shape.eid);
        const self = bodyOf(world, shape);
        if (!self || self.destroyed || contactConsumed.has(self.eid)) return;

        for (const event of events.begin) {
          const other = bodyOf(world, event.other);
          if (
            !other ||
            other === self ||
            other.destroyed ||
            contactConsumed.has(other.eid)
          )
            continue;

          if (other.get(Asteroid)) {
            const view = other.get(AsteroidView);
            const asteroidPos = other.get(Position);
            damagePlayer(world, self);
            if (asteroidPos)
              createExplosion(
                world,
                asteroidPos.x,
                asteroidPos.y,
                view?.color ?? COLORS.asteroidGrey,
                0.05,
              );
            contactConsumed.add(self.eid);
            continue;
          }
        }
      });
  }
}
