import { ChildOf, POST_UPDATE, type Entity } from '@vworlds/vecs';
import { Networked, type ServerWorld } from '@vworlds/vecs-server';
import { Position, Rotation } from '@vworlds/vecs-phaser';
import { CollisionFilter, SensorEvents } from '@vworlds/vecs-physics';
import {
  Alien,
  Asteroid,
  AsteroidView,
  AuraWeapon,
  Boomerang,
  BoomerangWeapon,
  CAT_ASTEROID,
  CAT_BOOMERANG,
  CAT_ENEMY,
  CAT_ENEMY_BULLET,
  CAT_PICKUP,
  CAT_PLAYER,
  CAT_PLAYER_BULLET,
  COLORS,
  Decay,
  DefaultWeapon,
  ENTITY_CONFIG,
  Explosion,
  GameStateView,
  Health,
  HealthPickup,
  LaserWeapon,
  Pickup,
  PickupKind,
  PlayerShip,
  Rocket,
  RocketWeapon,
  SCORING,
  SHIELD_DAMAGE,
  Shield,
  TICK_RATE,
  toFrames,
} from '@spacerocks/common';
import { createAsteroid } from './spawning';
import { createPrng, type Prng } from './rng';
import { createPlayerShip, PlayerSession } from './playerSessions';

type CollisionHandler = (a: Entity, b: Entity) => void;

const GAME_STATE_PLAYING = 0; // enum id
const LASER_LENGTH = 10; // meters
const RESPAWN_DELAY_FRAMES = toFrames(3_000); // frames
const registry = new Map<number, CollisionHandler[]>();

export class RespawnTimer {
  sessionId = 0; // entity id
  playerIndex = 0; // player index
  frames = RESPAWN_DELAY_FRAMES; // frames
}

export function registerCombatComponents(world: ServerWorld): void {
  world.component(LaserWeapon);
  world.component(AuraWeapon);
  world.component(RocketWeapon);
  world.component(BoomerangWeapon);
  world.component(DefaultWeapon);
  world.component(Shield);
  world.component(RespawnTimer);
}

export function installCombatSystems(
  world: ServerWorld,
  rng: Prng = createPrng(readServerSeed()),
): void {
  registry.clear();
  installHandlers(world, rng);

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
    .system('ServerLaserCollisionSystem')
    .with(PlayerShip, Position, Rotation, LaserWeapon)
    .each(
      [Position, Rotation, LaserWeapon],
      (_ship, [position, rotation, laser]) => {
        if (!laser.firing) return;
        resolveLaserHits(world, rng, position, rotation);
      },
    );

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

  world
    .system('ServerCollision')
    .phase(POST_UPDATE)
    .run(() => {
      if (!isPlaying(world)) return;
      const handled = new Set<string>();
      const consumed = new Set<number>();

      world
        .filter([SensorEvents, CollisionFilter])
        .forEach(
          [SensorEvents, CollisionFilter],
          (shapeA, [eventsA, filterA]) => {
            for (const event of eventsA.begin) {
              const shapeB = event.other;
              const filterB = shapeB.get(CollisionFilter);
              const bodyA = shapeA.parent(ChildOf);
              const bodyB = shapeB.parent(ChildOf);
              if (!filterB || !bodyA || !bodyB || bodyA === bodyB) continue;
              if (consumed.has(bodyA.eid) || consumed.has(bodyB.eid)) continue;
              if (!world.getEntity(bodyA.eid) || !world.getEntity(bodyB.eid))
                continue;

              const pairKey = `${Math.min(bodyA.eid, bodyB.eid)}:${Math.max(
                bodyA.eid,
                bodyB.eid,
              )}`;
              if (handled.has(pairKey)) continue;
              handled.add(pairKey);

              dispatchCollision(
                bodyA,
                bodyB,
                filterA.categoryBits,
                filterB.categoryBits,
              );
              if (!world.getEntity(bodyA.eid)) consumed.add(bodyA.eid);
              if (!world.getEntity(bodyB.eid)) consumed.add(bodyB.eid);
            }
          },
        );
    });
}

function installHandlers(world: ServerWorld, rng: Prng): void {
  registerCollisionEffect(CAT_PLAYER, CAT_PICKUP, (player, pickup) => {
    applyPickupEffect(world, player, pickup);
    const position = player.get(Position);
    if (position)
      createExplosion(world, position.x, position.y, COLORS.white, 0.2);
    pickup.destroy();
  });

  registerCollisionEffect(
    CAT_PLAYER_BULLET,
    CAT_ASTEROID,
    (bullet, asteroid) => {
      destroyAsteroid(world, rng, asteroid, true);
      bullet.destroy();
    },
  );

  registerCollisionEffect(CAT_PLAYER_BULLET, CAT_ENEMY, (bullet, alien) => {
    damageEnemy(world, alien, projectileDamage(bullet));
    bullet.destroy();
  });

  registerCollisionEffect(CAT_PLAYER, CAT_ENEMY_BULLET, (player, bullet) => {
    damagePlayer(world, player, SHIELD_DAMAGE.BULLET);
    bullet.destroy();
  });

  registerCollisionEffect(
    CAT_ASTEROID,
    CAT_ENEMY_BULLET,
    (asteroid, bullet) => {
      const asteroidView = asteroid.get(AsteroidView);
      const position = asteroid.get(Position);
      if (position)
        createExplosion(
          world,
          position.x,
          position.y,
          asteroidView?.color ?? COLORS.asteroidGrey,
        );
      asteroid.destroy();
      bullet.destroy();
    },
  );

  registerCollisionEffect(CAT_ASTEROID, CAT_ENEMY, (asteroid, alien) => {
    const asteroidView = asteroid.get(AsteroidView);
    const position = asteroid.get(Position);
    if (position)
      createExplosion(
        world,
        position.x,
        position.y,
        asteroidView?.color ?? COLORS.orange,
        0.2,
      );
    alien.destroy();
    asteroid.destroy();
    addScore(world, SCORING.ALIEN);
  });

  registerCollisionEffect(CAT_PLAYER, CAT_ENEMY, (player, alien) => {
    const playerPosition = player.get(Position);
    damagePlayer(world, player, SHIELD_DAMAGE.ALIEN_BODY);
    if (playerPosition)
      createExplosion(
        world,
        playerPosition.x,
        playerPosition.y,
        COLORS.orange,
        player.get(Shield) ? 0.2 : 0.05,
      );
    alien.destroy();
    addScore(world, SCORING.ALIEN);
  });

  registerCollisionEffect(
    CAT_BOOMERANG,
    CAT_ASTEROID,
    (boomerang, asteroid) => {
      destroyAsteroid(world, rng, asteroid, true);
      boomerang.destroy();
    },
  );

  registerCollisionEffect(CAT_BOOMERANG, CAT_ENEMY, (boomerang, alien) => {
    damageEnemy(world, alien, ENTITY_CONFIG.BOOMERANG.DAMAGE);
    boomerang.destroy();
  });

  registerCollisionEffect(
    CAT_PLAYER,
    CAT_BOOMERANG,
    (player, boomerangEntity) => {
      const boomerang = boomerangEntity.get(Boomerang);
      if (!boomerang || boomerang.ownerId !== player.eid || !boomerang.armed)
        return;
      const weapon = player.getMut(BoomerangWeapon);
      if (weapon) {
        weapon.shots = Math.min(
          weapon.shots + 1,
          ENTITY_CONFIG.BOOMERANG.MAX_SHOTS,
        );
      }
      boomerangEntity.destroy();
    },
  );

  registerCollisionEffect(CAT_PLAYER, CAT_ASTEROID, (player, asteroid) => {
    const asteroidView = asteroid.get(AsteroidView);
    const asteroidPosition = asteroid.get(Position);
    const playerPosition = player.get(Position);
    damagePlayer(world, player, SHIELD_DAMAGE.ASTEROID);
    const explosionPosition = player.get(Shield)
      ? asteroidPosition
      : playerPosition;
    if (explosionPosition)
      createExplosion(
        world,
        explosionPosition.x,
        explosionPosition.y,
        asteroidView?.color ?? COLORS.asteroidGrey,
        0.05,
      );
    destroyAsteroid(world, rng, asteroid, true, false);
  });
}

function registerCollisionEffect(
  categoryA: number,
  categoryB: number,
  handler: CollisionHandler,
): void {
  const low = Math.min(categoryA, categoryB);
  const high = Math.max(categoryA, categoryB);
  const handlers = registry.get(regKey(low, high)) ?? [];
  handlers.push(categoryA <= categoryB ? handler : (a, b) => handler(b, a));
  registry.set(regKey(low, high), handlers);
}

function dispatchCollision(
  a: Entity,
  b: Entity,
  categoryMaskA: number,
  categoryMaskB: number,
): void {
  const catAList = getCategoryBits(categoryMaskA);
  const catBList = getCategoryBits(categoryMaskB);
  for (const categoryA of catAList) {
    for (const categoryB of catBList) {
      const low = Math.min(categoryA, categoryB);
      const high = Math.max(categoryA, categoryB);
      const handlers = registry.get(regKey(low, high));
      if (!handlers) continue;
      for (const handler of handlers) {
        if (categoryA <= categoryB) handler(a, b);
        else handler(b, a);
      }
    }
  }
}

function getCategoryBits(mask: number): number[] {
  const bits: number[] = [];
  let value = mask;
  while (value) {
    const bit = value & -value;
    bits.push(bit);
    value &= value - 1;
  }
  return bits;
}

function regKey(categoryA: number, categoryB: number): number {
  return Math.min(categoryA, categoryB) * 1000 + Math.max(categoryA, categoryB);
}

function resolveLaserHits(
  world: ServerWorld,
  rng: Prng,
  origin: Position,
  rotation: Rotation,
): void {
  const start = { x: origin.x, y: origin.y };
  const end = {
    x: origin.x + Math.cos(rotation.angle) * LASER_LENGTH,
    y: origin.y + Math.sin(rotation.angle) * LASER_LENGTH,
  };

  world
    .filter([Position, Asteroid, AsteroidView])
    .forEach([Position, AsteroidView], (asteroid, [position, asteroidView]) => {
      if (distToSegment(position, start, end) < asteroidView.radius) {
        destroyAsteroid(world, rng, asteroid, true);
      }
    });

  world.filter([Position, Alien]).forEach([Position], (alien, [position]) => {
    if (distToSegment(position, start, end) < ENTITY_CONFIG.ALIEN.RADIUS) {
      createExplosion(world, position.x, position.y, COLORS.orange, 0.15);
      alien.destroy();
      addScore(world, SCORING.ALIEN);
    }
  });
}

function destroyAsteroid(
  world: ServerWorld,
  rng: Prng,
  asteroid: Entity,
  score: boolean,
  explode = true,
): void {
  const asteroidData = asteroid.get(Asteroid);
  const asteroidView = asteroid.get(AsteroidView);
  const position = asteroid.get(Position);
  if (!asteroidData || !position) return;

  if (explode)
    createExplosion(
      world,
      position.x,
      position.y,
      asteroidData.color,
      asteroidView?.radius ?? 0.2,
    );
  if (asteroidData.level > 1) {
    const nextLevel = (asteroidData.level - 1) as 1 | 2;
    createAsteroid(world, rng, position.x, position.y, nextLevel);
    createAsteroid(world, rng, position.x, position.y, nextLevel);
  }

  asteroid.destroy();
  if (score) addScore(world, SCORING.ASTEROID_BASE * asteroidData.level);
}

function damageEnemy(world: ServerWorld, enemy: Entity, damage: number): void {
  const health = enemy.getMut(Health);
  if (health) {
    health.hp -= damage;
    health.healthBarTimer = ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER;
    enemy.modified(Health);
    if (health.hp > 0) return;
  }

  const position = enemy.get(Position);
  if (position)
    createExplosion(world, position.x, position.y, COLORS.orange, 0.15);
  enemy.destroy();
  addScore(world, SCORING.ALIEN);
}

function damagePlayer(
  world: ServerWorld,
  player: Entity,
  shieldDamage: number,
): void {
  const shield = player.getMut(Shield);
  if (shield) {
    shield.shieldTime = Math.max(0, shield.shieldTime - shieldDamage);
    player.modified(Shield);
    if (shield.shieldTime <= 0) clearShield(player);
    return;
  }

  const health = player.getMut(Health);
  if (!health) return;
  health.hp -= 10;
  health.healthBarTimer = ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER;
  player.modified(Health);
  if (health.hp <= 0) killPlayer(world, player);
}

function killPlayer(world: ServerWorld, player: Entity): void {
  const position = player.get(Position);
  if (position)
    createExplosion(world, position.x, position.y, COLORS.white, 0.2);
  const playerShip = player.get(PlayerShip);
  const session = player.get(ChildOf)?.target;
  if (session?.get(PlayerSession) && playerShip) {
    world.entity().set(RespawnTimer, {
      sessionId: session.eid,
      playerIndex: playerShip.playerIndex,
      frames: RESPAWN_DELAY_FRAMES,
    });
  }
  player.destroy();
}

function applyPickupEffect(
  world: ServerWorld,
  player: Entity,
  pickupEntity: Entity,
): void {
  const pickup = pickupEntity.get(Pickup);
  if (!pickup) return;

  if (pickup.kind === PickupKind.Shield) {
    const shield = { shieldTime: ENTITY_CONFIG.SHIP.SHIELD_DURATION };
    player.set(Shield, shield);
    addScore(world, SCORING.SHIELD);
  } else if (pickup.kind === PickupKind.Laser) {
    setActiveWeapon(player, PickupKind.Laser);
    addScore(world, SCORING.LASER);
  } else if (pickup.kind === PickupKind.Aura) {
    setActiveWeapon(player, PickupKind.Aura);
    addScore(world, SCORING.AURA);
  } else if (pickup.kind === PickupKind.Rocket) {
    setActiveWeapon(player, PickupKind.Rocket);
    addScore(world, SCORING.ROCKET);
  } else if (pickup.kind === PickupKind.Boomerang) {
    setActiveWeapon(player, PickupKind.Boomerang);
    addScore(world, SCORING.BOOMERANG);
  } else {
    const healthPickup = pickupEntity.get(HealthPickup);
    const health = player.getMut(Health);
    if (health && healthPickup) {
      health.hp = Math.min(
        health.hp + health.maxHp * healthPickup.amount,
        health.maxHp,
      );
      health.healthBarTimer = ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER;
      player.modified(Health);
      addScore(
        world,
        healthPickup.amount <= 0.25
          ? SCORING.HEALTH_SMALL
          : SCORING.HEALTH_LARGE,
      );
    }
  }
}

function setActiveWeapon(player: Entity, kind: PickupKind): void {
  if (player.get(LaserWeapon)) player.remove(LaserWeapon);
  if (player.get(AuraWeapon)) player.remove(AuraWeapon);
  if (player.get(RocketWeapon)) player.remove(RocketWeapon);
  if (player.get(BoomerangWeapon)) player.remove(BoomerangWeapon);
  if (player.get(DefaultWeapon)) player.remove(DefaultWeapon);

  if (kind === PickupKind.Laser) {
    player.set(LaserWeapon, {
      shots: ENTITY_CONFIG.SHIP.LASER_SHOT_COUNT,
      firing: false,
      timer: 0,
    });
  } else if (kind === PickupKind.Aura) {
    player.set(AuraWeapon, { shots: ENTITY_CONFIG.SHIP.AURA_SHOT_COUNT });
  } else if (kind === PickupKind.Rocket) {
    player.set(RocketWeapon, { shots: ENTITY_CONFIG.ROCKET.SHOT_COUNT });
  } else if (kind === PickupKind.Boomerang) {
    player.set(BoomerangWeapon, {
      shots: ENTITY_CONFIG.BOOMERANG.MAX_SHOTS,
      inFlight: 0,
    });
  }
}

function projectileDamage(projectile: Entity): number {
  if (projectile.get(Rocket)) return ENTITY_CONFIG.ROCKET.DAMAGE;
  if (projectile.get(Boomerang)) return ENTITY_CONFIG.BOOMERANG.DAMAGE;
  return ENTITY_CONFIG.BULLET.DAMAGE;
}

function addScore(world: ServerWorld, amount: number): void {
  const entity = getGameStateEntity(world);
  const state = entity?.getMut(GameStateView);
  if (!entity || !state) return;
  state.score += amount;
  entity.modified(GameStateView);
}

function clearShield(entity: Entity): void {
  if (entity.get(Shield)) entity.remove(Shield);
}

export function createExplosion(
  world: ServerWorld,
  x: number,
  y: number,
  color: number,
  size = 0.2, // meters
): void {
  world
    .entity()
    .add(Networked)
    .set(Position, { x, y })
    .set(Explosion, {
      color,
      size,
      seed: Math.floor(Math.random() * 0xffffffff),
      duration: ENTITY_CONFIG.EXPLOSION.LIFE_FRAMES / TICK_RATE,
    })
    .set(Decay, {
      life: 1,
      decay: 1 / ENTITY_CONFIG.EXPLOSION.LIFE_FRAMES,
    });
}

function distToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const lengthSquared =
    (end.x - start.x) * (end.x - start.x) +
    (end.y - start.y) * (end.y - start.y);
  if (lengthSquared === 0)
    return Math.hypot(point.x - start.x, point.y - start.y);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * (end.x - start.x) +
        (point.y - start.y) * (end.y - start.y)) /
        lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + t * (end.x - start.x)),
    point.y - (start.y + t * (end.y - start.y)),
  );
}

function isPlaying(world: ServerWorld): boolean {
  const state = getGameStateEntity(world)?.get(GameStateView);
  return !state || state.state === GAME_STATE_PLAYING;
}

function getGameStateEntity(world: ServerWorld): Entity | undefined {
  let gameStateEntity: Entity | undefined;
  world.filter([GameStateView]).forEach([], (entity) => {
    gameStateEntity ??= entity;
  });
  return gameStateEntity;
}

function readServerSeed(): number {
  const configuredSeed = Number(process.env.SPACEROCKS_SEED ?? 0x5eed1234);
  return Number.isFinite(configuredSeed) ? configuredSeed : 0x5eed1234;
}
