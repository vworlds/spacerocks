import { ChildOf, POST_UPDATE, type Entity } from '@vworlds/vecs';
import { Networked, type ServerWorld } from '@vworlds/vecs-server';
import { Position, Rotation } from '@vworlds/vecs-phaser';
import {
  LinearVelocity,
  physics,
  Position as PhysicsPosition,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  Alien,
  Asteroid,
  AsteroidView,
  AuraWeapon,
  Boomerang,
  BoomerangWeapon,
  Bullet,
  CAT_ASTEROID,
  CAT_ENEMY,
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
import { asteroidRadius, createAsteroid } from './spawning';
import { createPrng, type Prng } from './rng';
import { createPlayerShip, PlayerSession } from './playerSessions';

const GAME_STATE_PLAYING = 0; // enum id
const LASER_LENGTH = 10; // meters
const RESPAWN_DELAY_FRAMES = toFrames(3_000); // frames

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
  // Bodies destroyed / single-collision-resolved this tick. Guards same-tick
  // multi-hit on a consumed body (e.g. two bullets splitting one asteroid).
  const consumed = new Set<number>();
  // Sensor shapes whose `begin` buffer has already been drained this tick. A
  // `.update(SensorEvents)` callback fires BOTH when the shape enters the query
  // and when physics marks the buffer modified; when a sensor is spawned and
  // collides on the same tick, both fire and read the same `begin`, so without
  // this guard the contact would be processed twice (e.g. an alien taking an
  // asteroid hit twice and dying). Cleared each tick by ResetCollisionFrame.
  const processedShapes = new Set<number>();
  let playing = true;

  function bodyOf(shape: Entity | undefined): Entity | undefined {
    if (!shape || shape.destroyed) return undefined;
    const body = shape.target(ChildOf);
    if (!body || body.destroyed || !world.getEntity(body.eid)) return undefined;
    return body;
  }

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
    .system('ResetCollisionFrame')
    .phase(POST_UPDATE)
    .run(() => {
      consumed.clear();
      processedShapes.clear();
      playing = isPlaying(world);
    });

  world
    .system('ProjectileImpact')
    .with({ parent: { any: [Bullet, Rocket, Boomerang] } })
    .phase(POST_UPDATE)
    .update(SensorEvents, (shape, events) => {
      if (!playing || processedShapes.has(shape.eid)) return;
      processedShapes.add(shape.eid);
      const self = bodyOf(shape);
      if (!self || consumed.has(self.eid)) return;

      for (const event of events.begin) {
        const other = bodyOf(event.other);
        if (!other || other === self || consumed.has(other.eid)) continue;

        if (other.get(Asteroid)) {
          splitAsteroidFromProjectile(world, rng, other, self, true);
          consumed.add(other.eid);
          self.destroy();
          consumed.add(self.eid);
          break;
        }

        if (other.get(Alien)) {
          const killed = damageEnemy(world, other, projectileDamage(self));
          if (killed) consumed.add(other.eid);
          self.destroy();
          consumed.add(self.eid);
          break;
        }

        if (other.get(PlayerShip)) {
          const bullet = self.get(Bullet);
          if (bullet?.ownerType === 'alien') {
            const killed = damagePlayer(world, other, SHIELD_DAMAGE.BULLET);
            if (killed) consumed.add(other.eid);
            self.destroy();
            consumed.add(self.eid);
            break;
          }

          const boomerang = self.get(Boomerang);
          if (boomerang && boomerang.ownerId === other.eid && boomerang.armed) {
            const weapon = other.getMut(BoomerangWeapon);
            if (weapon) {
              weapon.shots = Math.min(
                weapon.shots + 1,
                ENTITY_CONFIG.BOOMERANG.MAX_SHOTS,
              );
            }
            self.destroy();
            consumed.add(self.eid);
            break;
          }
        }
      }
    });

  world
    .system('AlienContact')
    .with({ parent: Alien })
    .phase(POST_UPDATE)
    .update(SensorEvents, (shape, events) => {
      if (!playing || processedShapes.has(shape.eid)) return;
      processedShapes.add(shape.eid);
      const self = bodyOf(shape);
      if (!self || consumed.has(self.eid)) return;

      for (const event of events.begin) {
        const other = bodyOf(event.other);
        if (!other || other === self || consumed.has(other.eid)) continue;

        if (other.get(Asteroid)) {
          const view = other.get(AsteroidView);
          const pos = other.get(Position);
          const killed = damageEnemy(world, self, ENTITY_CONFIG.BULLET.DAMAGE);
          if (pos)
            createExplosion(
              world,
              pos.x,
              pos.y,
              view?.color ?? COLORS.orange,
              0.05,
            );
          if (killed) {
            consumed.add(self.eid);
            break;
          }
        }
      }
    });

  world
    .system('PlayerContact')
    .with({ parent: PlayerShip })
    .phase(POST_UPDATE)
    .update(SensorEvents, (shape, events) => {
      if (!playing || processedShapes.has(shape.eid)) return;
      processedShapes.add(shape.eid);
      const self = bodyOf(shape);
      if (!self || consumed.has(self.eid)) return;

      for (const event of events.begin) {
        const other = bodyOf(event.other);
        if (!other || other === self || consumed.has(other.eid)) continue;

        if (other.get(Asteroid)) {
          const view = other.get(AsteroidView);
          const asteroidPos = other.get(Position);
          const playerPos = self.get(Position);
          const shielded = self.get(Shield) !== undefined;
          const killed = damagePlayer(world, self, SHIELD_DAMAGE.ASTEROID);
          const explosionPos = shielded ? asteroidPos : playerPos;
          if (explosionPos)
            createExplosion(
              world,
              explosionPos.x,
              explosionPos.y,
              view?.color ?? COLORS.asteroidGrey,
              0.05,
            );
          if (killed) {
            consumed.add(self.eid);
            break;
          }
        } else if (other.get(Alien)) {
          const playerPos = self.get(Position);
          const shielded = self.get(Shield) !== undefined;
          const killed = damagePlayer(world, self, SHIELD_DAMAGE.ALIEN_BODY);
          if (playerPos)
            createExplosion(
              world,
              playerPos.x,
              playerPos.y,
              COLORS.orange,
              shielded ? 0.2 : 0.05,
            );
          other.destroy();
          consumed.add(other.eid);
          addScore(world, SCORING.ALIEN);
          if (killed) {
            consumed.add(self.eid);
            break;
          }
        }
      }
    });

  world
    .system('PickupCollect')
    .with({ parent: Pickup })
    .phase(POST_UPDATE)
    .update(SensorEvents, (shape, events) => {
      if (!playing || processedShapes.has(shape.eid)) return;
      processedShapes.add(shape.eid);
      const self = bodyOf(shape);
      if (!self || consumed.has(self.eid)) return;

      for (const event of events.begin) {
        const other = bodyOf(event.other);
        if (!other || other === self || consumed.has(other.eid)) continue;

        if (other.get(PlayerShip)) {
          applyPickupEffect(world, other, self);
          const pos = other.get(Position);
          if (pos) createExplosion(world, pos.x, pos.y, COLORS.white, 0.2);
          self.destroy();
          consumed.add(self.eid);
          break;
        }
      }
    });
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

  const hits = physics(world).rayCastAll({
    from: start,
    to: end,
    filter: { maskBits: CAT_ASTEROID | CAT_ENEMY },
  });

  for (const hit of hits) {
    const body = hit.entity.target(ChildOf);
    if (!body || !world.getEntity(body.eid)) continue;

    if (body.get(Asteroid)) {
      splitAsteroid(
        world,
        rng,
        body,
        hit.point,
        { x: end.x - start.x, y: end.y - start.y },
        true,
      );
    } else if (body.get(Alien)) {
      const position = body.get(Position);
      if (position)
        createExplosion(world, position.x, position.y, COLORS.orange, 0.15);
      body.destroy();
      addScore(world, SCORING.ALIEN);
    }
  }
}

function splitAsteroidFromProjectile(
  world: ServerWorld,
  rng: Prng,
  asteroid: Entity,
  projectile: Entity,
  score: boolean,
): void {
  const hitPoint = getPosition(projectile) ?? getPosition(asteroid);
  const projectileVelocity = projectile.get(LinearVelocity);
  const asteroidPosition = getPosition(asteroid);
  const shotDirection = projectileVelocity
    ? { x: projectileVelocity.x, y: projectileVelocity.y }
    : hitPoint && asteroidPosition
      ? {
          x: hitPoint.x - asteroidPosition.x,
          y: hitPoint.y - asteroidPosition.y,
        }
      : { x: 1, y: 0 };

  splitAsteroid(world, rng, asteroid, hitPoint, shotDirection, score);
}

function splitAsteroid(
  world: ServerWorld,
  rng: Prng,
  asteroid: Entity,
  hitPoint: { x: number; y: number } | undefined,
  shotDirection: { x: number; y: number },
  score: boolean,
): void {
  const asteroidData = asteroid.get(Asteroid);
  const asteroidView = asteroid.get(AsteroidView);
  const position = getPosition(asteroid);
  if (!asteroidData || !position) return;

  createExplosion(
    world,
    position.x,
    position.y,
    asteroidData.color,
    asteroidView?.radius ?? 0.2,
  );

  const fragments = ENTITY_CONFIG.ASTEROID.FRAGMENTS;
  const retainedMass =
    asteroidData.mass * (1 - ENTITY_CONFIG.ASTEROID.MASS_LOSS_RATIO);
  const radius = asteroidView?.radius ?? asteroidRadius(asteroidData.mass);
  const shot = normalize(shotDirection);
  const splitAxis = normalize({ x: -shot.y, y: shot.x });
  const impact = hitPoint
    ? {
        x: hitPoint.x - position.x,
        y: hitPoint.y - position.y,
      }
    : { x: 0, y: 0 };
  const side = Math.sign(dot(impact, splitAxis));
  const centerHit = Math.abs(dot(impact, splitAxis)) <= radius / fragments;
  const asteroidVelocity = asteroid.get(LinearVelocity);
  const parentVelocity = asteroidVelocity
    ? { x: asteroidVelocity.x, y: asteroidVelocity.y }
    : { x: 0, y: 0 };
  const pieces = centerHit
    ? [
        { ratio: 0.5, direction: -1 },
        { ratio: 0.5, direction: 1 },
      ]
    : [
        { ratio: 1 / fragments, direction: side || 1 },
        { ratio: (fragments - 1) / fragments, direction: -(side || 1) },
      ];

  for (const piece of pieces) {
    const mass = retainedMass * piece.ratio;
    const childRadius = asteroidRadius(mass);
    const direction = piece.direction;
    const velocity = {
      x:
        parentVelocity.x +
        (splitAxis.x * direction * ENTITY_CONFIG.ASTEROID.SPLIT_IMPULSE) / mass,
      y:
        parentVelocity.y +
        (splitAxis.y * direction * ENTITY_CONFIG.ASTEROID.SPLIT_IMPULSE) / mass,
    };
    const collidable = mass >= ENTITY_CONFIG.ASTEROID.MIN_COLLIDABLE_MASS;
    createAsteroid(
      world,
      rng,
      position.x + splitAxis.x * direction * childRadius,
      position.y + splitAxis.y * direction * childRadius,
      mass,
      {
        velocity,
        color: asteroidData.color,
        collidable,
        alpha: collidable ? 1 : 0.35,
        ...(collidable
          ? {}
          : { ttlFrames: ENTITY_CONFIG.ASTEROID.DUST_TTL_FRAMES }),
      },
    );
  }

  asteroid.destroy();
  if (score) addScore(world, SCORING.ASTEROID_BASE);
}

function getPosition(entity: Entity): { x: number; y: number } | undefined {
  const position = entity.get(PhysicsPosition) ?? entity.get(Position);
  return position ? { x: position.x, y: position.y } : undefined;
}

function normalize(vector: { x: number; y: number }): { x: number; y: number } {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0.000001) return { x: 1, y: 0 };
  return { x: vector.x / length, y: vector.y / length };
}

function dot(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return a.x * b.x + a.y * b.y;
}

function damageEnemy(
  world: ServerWorld,
  enemy: Entity,
  damage: number,
): boolean {
  const health = enemy.getMut(Health);
  if (health) {
    health.hp -= damage;
    health.healthBarTimer = ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER;
    enemy.modified(Health);
    if (health.hp > 0) return false;
  }

  const position = enemy.get(Position);
  if (position)
    createExplosion(world, position.x, position.y, COLORS.orange, 0.15);
  enemy.destroy();
  addScore(world, SCORING.ALIEN);
  return true;
}

function damagePlayer(
  world: ServerWorld,
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
