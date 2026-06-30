import { ChildOf, POST_UPDATE, Module, type Entity } from '@vworlds/vecs';
import {
  Position as RenderPosition,
  Rotation as RenderRotation,
} from '@vworlds/vecs-phaser';
import {
  LinearVelocity,
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
  SensorEvents,
  physics,
} from '@vworlds/vecs-physics';
import {
  CAT_ASTEROID,
  CAT_ENEMY,
  COLORS,
  ENTITY_CONFIG,
  SCORING,
  perSecond,
} from '@spacerocks/common';
import { Alien } from '../aliens/components';
import { Components as AliensComponents } from '../aliens/components';
import {
  Asteroid,
  Components as AsteroidsComponents,
} from '../asteroids/components';
import { DecayModule } from '../decay/module';
import { MovementModule } from '../movement/module';
import { PlayerInputIntent, PlayerShip } from '../playerSessions/components';
import { PlayerSessionsModule } from '../playerSessions/module';
import { WorldRng } from '../rng/components';
import { RngModule } from '../rng/module';
import { addScore, createExplosion, isPlaying } from '../gameState/helpers';
import {
  splitAsteroid,
  splitAsteroidFromProjectile,
} from '../asteroids/splitting';
import { damageEnemy } from '../aliens/damage';
import { damagePlayer } from '../combat/module';
import {
  AuraWeapon,
  Boomerang,
  BoomerangWeapon,
  Bullet,
  Components,
  DefaultWeapon,
  LaserWeapon,
  Rocket,
  RocketWeapon,
  ShootingCooldown,
} from './components';
import {
  createBoomerang,
  createBullet,
  createRocket,
  switchToDefaultWeapon,
} from './factories';
import { findRocketTarget, wrapAngle } from './targeting';

const LASER_LENGTH = 10;

/**
 * Player + projectile weapon systems: cooldown, firing (default/aura/laser/
 * rocket/boomerang), laser-beam collision ray, rocket homing, boomerang
 * return, decay, and projectile-impact collision (`ProjectileImpact`).
 *
 * Dependencies: `PlayerSessionsModule` (`PlayerInputIntent`), `RngModule`
 * (splitting/damage use the seeded Prng), `AsteroidsModule` (`splitAsteroid`),
 * `AliensModule` (`damageEnemy`), `CombatModule` (`damagePlayer`),
 * `GameStateModule` (`addScore`/`isPlaying`/`createExplosion`).
 */
export class WeaponsModule extends Module {
  override init(): void {
    const world = this.world;
    this.world.module(RngModule);
    this.world.module(PlayerSessionsModule);
    this.world.module(MovementModule);
    this.world.module(DecayModule);
    this.world.module(AsteroidsComponents);
    this.world.module(AliensComponents);
    this.world.module(Components);
    const rng = world.get(WorldRng)!.prng!;

    world
      .system('InitializeWeaponState')
      .with(PlayerShip)
      .enter([PlayerShip], (ship) => {
        if (!ship.get(ShootingCooldown))
          ship.set(ShootingCooldown, { frames: 0 });
      });

    world
      .system('ShootingCooldown')
      .with(PlayerShip, ShootingCooldown)
      .each([ShootingCooldown], (_entity, [cooldown]) => {
        if (cooldown.frames > 0) cooldown.frames -= 1;
      });

    world
      .system('Shooting')
      .with(
        PlayerShip,
        PlayerInputIntent,
        RenderPosition,
        RenderRotation,
        ShootingCooldown,
      )
      .each(
        [PlayerInputIntent, RenderPosition, RenderRotation, ShootingCooldown],
        (ship, [input, position, rotation, cooldown]) => {
          if (!input.shoot || cooldown.frames > 0) return;

          const color = ship.get(PlayerShip)?.color ?? COLORS.white;
          const aura = ship.getMut(AuraWeapon);
          const laser = ship.getMut(LaserWeapon);
          const rocketWeapon = ship.getMut(RocketWeapon);
          const boomerangWeapon = ship.getMut(BoomerangWeapon);

          if (aura && aura.shots > 0) {
            for (let i = 0; i < 8; i += 1) {
              createBullet(
                world,
                ship,
                position.x,
                position.y,
                (i * Math.PI) / 4,
                color,
              );
            }
            aura.shots -= 1;
            if (aura.shots <= 0) switchToDefaultWeapon(ship);
            cooldown.frames = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
          } else if (laser && laser.shots > 0) {
            laser.firing = true;
            laser.timer = ENTITY_CONFIG.SHIP.LASER_TIMER;
            laser.shots -= 1;
            cooldown.frames = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
          } else if (rocketWeapon && rocketWeapon.shots > 0) {
            createRocket(world, ship, position.x, position.y, rotation.angle);
            rocketWeapon.shots -= 1;
            if (rocketWeapon.shots <= 0) switchToDefaultWeapon(ship);
            cooldown.frames = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
          } else if (boomerangWeapon && boomerangWeapon.shots > 0) {
            createBoomerang(
              world,
              ship,
              position.x,
              position.y,
              rotation.angle,
            );
            boomerangWeapon.shots -= 1;
            cooldown.frames = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
          } else if (ship.get(DefaultWeapon)) {
            createBullet(
              world,
              ship,
              position.x,
              position.y,
              rotation.angle,
              color,
            );
            cooldown.frames = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
          }
        },
      );

    world
      .system('LaserSystem')
      .with(PlayerShip, LaserWeapon)
      .each([LaserWeapon], (ship, [laser]) => {
        if (!laser.firing) return;

        laser.timer -= 1;
        if (laser.timer > 0) return;

        laser.firing = false;
        ship.modified(LaserWeapon);
        if (laser.shots <= 0) switchToDefaultWeapon(ship);
      });

    world
      .system('RocketSystem')
      .with(PhysicsPosition, LinearVelocity, PhysicsRotation, Rocket)
      .each(
        [PhysicsPosition, LinearVelocity, PhysicsRotation, Rocket],
        (entity, [position, velocity, rotation, rocket]) => {
          if (rocket.straightTimer > 0) {
            rocket.straightTimer -= 1;
            return;
          }

          const target = findRocketTarget(world, position);
          if (!target) return;

          const currentAngle = Math.atan2(velocity.y, velocity.x);
          const targetAngle = Math.atan2(
            target.y - position.y,
            target.x - position.x,
          );
          const diff = wrapAngle(targetAngle - currentAngle);
          const turn = Math.max(
            -ENTITY_CONFIG.ROCKET.TURN_RATE,
            Math.min(ENTITY_CONFIG.ROCKET.TURN_RATE, diff),
          );
          const newAngle = currentAngle + turn;

          velocity.x =
            Math.cos(newAngle) * perSecond(ENTITY_CONFIG.ROCKET.SPEED);
          velocity.y =
            Math.sin(newAngle) * perSecond(ENTITY_CONFIG.ROCKET.SPEED);
          rotation.angle = newAngle;
          entity.modified(LinearVelocity);
          entity.modified(PhysicsRotation);
        },
      );

    world
      .system('BoomerangSystem')
      .with(PhysicsPosition, LinearVelocity, Boomerang)
      .each(
        [PhysicsPosition, LinearVelocity, Boomerang],
        (entity, [position, velocity, boomerang]) => {
          const owner =
            boomerang.ownerId === null
              ? undefined
              : world.getEntity(boomerang.ownerId);
          const ownerPosition = owner?.get(PhysicsPosition);
          if (!ownerPosition) return;

          const dx = ownerPosition.x - position.x;
          const dy = ownerPosition.y - position.y;
          const distance = Math.hypot(dx, dy);
          if (distance > 0.001) {
            const pull = perSecond(ENTITY_CONFIG.BOOMERANG.PULL);
            velocity.x += (dx / distance) * pull;
            velocity.y += (dy / distance) * pull;
          }

          const speed = Math.hypot(velocity.x, velocity.y);
          const maxSpeed = perSecond(ENTITY_CONFIG.BOOMERANG.MAX_SPEED);
          if (speed > maxSpeed) {
            velocity.x = (velocity.x / speed) * maxSpeed;
            velocity.y = (velocity.y / speed) * maxSpeed;
          }

          entity.modified(LinearVelocity);

          if (
            !boomerang.armed &&
            distance > ENTITY_CONFIG.BOOMERANG.ARM_DISTANCE
          ) {
            boomerang.armed = true;
          }
        },
      )
      .exit([Boomerang], (_entity, [boomerang]) => {
        const owner =
          boomerang.ownerId === null
            ? undefined
            : world.getEntity(boomerang.ownerId);
        if (!owner) return;
        const weapon = owner?.getMut(BoomerangWeapon);
        if (!weapon) return;

        weapon.inFlight = Math.max(0, weapon.inFlight - 1);
        if (weapon.shots === 0 && weapon.inFlight === 0)
          switchToDefaultWeapon(owner);
      });

    world
      .system('ServerLaserCollisionSystem')
      .with(PlayerShip, RenderPosition, RenderRotation, LaserWeapon)
      .each(
        [RenderPosition, RenderRotation, LaserWeapon],
        (_ship, [position, rotation, laser]) => {
          if (!laser.firing) return;
          resolveLaserHits(world, rng, position, rotation);
        },
      );

    const projectileConsumed = new Set<number>();

    world
      .system('ResetProjectileConsumed')
      .phase(POST_UPDATE)
      .run(() => projectileConsumed.clear());

    world
      .system('ProjectileImpact')
      .with({ parent: { any: [Bullet, Rocket, Boomerang] } })
      .phase(POST_UPDATE)
      .update(SensorEvents, (shape, events) => {
        if (!isPlaying(world)) return;
        const self = bodyOf(world, shape);
        if (!self || self.destroyed || projectileConsumed.has(self.eid)) return;

        for (const event of events.begin) {
          const other = bodyOf(world, event.other);
          if (
            !other ||
            other === self ||
            other.destroyed ||
            projectileConsumed.has(other.eid)
          )
            continue;

          if (other.get(Asteroid)) {
            splitAsteroidFromProjectile(world, rng, other, self, true);
            projectileConsumed.add(other.eid);
            projectileConsumed.add(self.eid);
            self.destroy();
            continue;
          }

          if (other.get(Alien)) {
            const killed = damageEnemy(world, other, projectileDamage(self));
            if (killed) projectileConsumed.add(other.eid);
            projectileConsumed.add(self.eid);
            self.destroy();
            continue;
          }

          if (other.get(PlayerShip)) {
            const bullet = self.get(Bullet);
            if (bullet?.ownerType === 'alien') {
              damagePlayer(world, other, ENTITY_CONFIG.BULLET.DAMAGE);
              projectileConsumed.add(self.eid);
              self.destroy();
              continue;
            }

            const boomerang = self.get(Boomerang);
            if (
              boomerang &&
              boomerang.ownerId === other.eid &&
              boomerang.armed
            ) {
              const weapon = other.getMut(BoomerangWeapon);
              if (weapon) {
                weapon.shots = Math.min(
                  weapon.shots + 1,
                  ENTITY_CONFIG.BOOMERANG.MAX_SHOTS,
                );
              }
              projectileConsumed.add(self.eid);
              self.destroy();
              continue;
            }
          }
        }
      });
  }
}

function projectileDamage(projectile: Entity): number {
  if (projectile.get(Rocket)) return ENTITY_CONFIG.ROCKET.DAMAGE;
  if (projectile.get(Boomerang)) return ENTITY_CONFIG.BOOMERANG.DAMAGE;
  return ENTITY_CONFIG.BULLET.DAMAGE;
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

function resolveLaserHits(
  world: import('@vworlds/vecs').World,
  rng: import('../rng/components').Prng,
  origin: RenderPosition,
  rotation: RenderRotation,
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
      const position = body.get(RenderPosition);
      if (position)
        createExplosion(world, position.x, position.y, COLORS.orange, 0.15);
      body.destroy();
      addScore(world, SCORING.ALIEN);
    }
  }
}
