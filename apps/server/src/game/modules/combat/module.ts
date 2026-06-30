import {
  ChildOf,
  Module,
  POST_UPDATE,
  type Entity,
  type World,
} from '@vworlds/vecs';
import { Position } from '@vworlds/vecs-phaser';
import {
  Position as PhysicsPosition,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  Alien,
  Asteroid,
  AsteroidView,
  COLORS,
  ENTITY_CONFIG,
  Health,
  PlayerShip,
  SCORING,
  SHIELD_DAMAGE,
  Shield,
} from '@spacerocks/common';
import { addScore, createExplosion, isPlaying } from '../gameState/helpers';
import { Components, RespawnTimer } from './components';
import { PlayerSession } from '../playerSessions/components';
import { createPlayerShip } from '../playerSessions/factories';

/**
 * Applies shield or health damage to a player. While shielded, damage drains
 * the shield and returns false; once the shield breaks or is absent, health
 * takes 10 hp per hit and returns true if the player dies (spawning a
 * `RespawnTimer`). Asteroid/alien contact and alien-bullet hits route here.
 */
export function damagePlayer(
  world: World,
  player: Entity,
  shieldDamage: number,
): boolean {
  const shield = player.getMut(Shield);
  if (shield) {
    shield.shieldTime = Math.max(0, shield.shieldTime - shieldDamage);
    player.modified(Shield);
    if (shield.shieldTime <= 0) clearShield(player);
    return false;
  }

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

export function clearShield(entity: Entity): void {
  if (entity.get(Shield)) entity.remove(Shield);
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

function getPosition(entity: Entity): { x: number; y: number } | undefined {
  const position = entity.get(PhysicsPosition) ?? entity.get(Position);
  return position ? { x: position.x, y: position.y } : undefined;
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
 * damage) or an alien (mutual destruction, player takes alien-body damage,
 * alien is destroyed and scored).
 *
 * Depends on `PlayerSessionsModule` (respawn uses `createPlayerShip`).
 */
export class CombatModule extends Module {
  override init(): void {
    const world = this.world;
    world.module(Components);

    world
      .system('ServerShieldSystem')
      .with(Shield)
      .each([Shield], (entity, [shield]) => {
        shield.shieldTime -= 1;
        entity.modified(Shield);
        if (shield.shieldTime <= 0) clearShield(entity);
      });

    world
      .system('ServerHealthSystem')
      .with(Health)
      .each([Health], (entity, [health]) => {
        if (health.healthBarTimer > 0) {
          health.healthBarTimer -= 1;
          entity.modified(Health);
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
            const playerPos = self.get(Position);
            const shielded = self.get(Shield) !== undefined;
            damagePlayer(world, self, SHIELD_DAMAGE.ASTEROID);
            const explosionPos = shielded ? asteroidPos : playerPos;
            if (explosionPos)
              createExplosion(
                world,
                explosionPos.x,
                explosionPos.y,
                view?.color ?? COLORS.asteroidGrey,
                0.05,
              );
            contactConsumed.add(self.eid);
            continue;
          }

          if (other.get(Alien)) {
            const playerPos = self.get(Position);
            const shielded = self.get(Shield) !== undefined;
            damagePlayer(world, self, SHIELD_DAMAGE.ALIEN_BODY);
            if (playerPos)
              createExplosion(
                world,
                playerPos.x,
                playerPos.y,
                COLORS.orange,
                shielded ? 0.2 : 0.05,
              );
            const alienPos = getPosition(other);
            if (alienPos)
              createExplosion(
                world,
                alienPos.x,
                alienPos.y,
                COLORS.orange,
                0.15,
              );
            other.destroy();
            addScore(world, SCORING.ALIEN);
            contactConsumed.add(other.eid);
            contactConsumed.add(self.eid);
            continue;
          }
        }
      });
  }
}
