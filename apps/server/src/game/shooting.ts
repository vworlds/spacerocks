import { ChildOf, type Entity } from '@vworlds/vecs';
import { Networked, type ServerWorld } from '@vworlds/vecs-server';
import {
  Alien,
  AngularVelocity,
  Arc,
  Asteroid,
  AuraWeapon,
  Boomerang,
  BoomerangWeapon,
  Bullet,
  CAT_ASTEROID,
  CAT_BOOMERANG,
  CAT_ENEMY,
  CAT_PLAYER,
  CAT_PLAYER_BULLET,
  Collider,
  Decay,
  DefaultWeapon,
  Drawable,
  ENTITY_CONFIG,
  FillStyle,
  LaserWeapon,
  PlayerShip,
  Position,
  ProjectileView,
  Rocket,
  RocketWeapon,
  Rotation,
  Shape,
  StrokeStyle,
  Velocity,
  WeaponView,
  Wraps,
} from '@spacerocks/common';
import { PlayerInputIntent } from './playerSessions';

type ServerPhase = ReturnType<ServerWorld['addPhase']>;

const PROJECTILE_KIND_BULLET = 0;
const PROJECTILE_KIND_ROCKET = 3;
const PROJECTILE_KIND_BOOMERANG = 4;

const WEAPON_KIND_DEFAULT = 0;
const WEAPON_KIND_LASER = 1;
const WEAPON_KIND_AURA = 2;
const WEAPON_KIND_ROCKET = 3;
const WEAPON_KIND_BOOMERANG = 4;

export class ShootingCooldown {
  frames = 0;
}

export function registerShootingComponents(world: ServerWorld): void {
  world.component(ShootingCooldown);
  world.component(LaserWeapon);
  world.component(AuraWeapon);
  world.component(RocketWeapon);
  world.component(BoomerangWeapon);
  world.component(Bullet);
  world.component(Rocket);
  world.component(Boomerang);
  world.component(Decay);
  world.component(ProjectileView);
  world.component(WeaponView);
  world.component(FillStyle);
}

export function installShootingSystems(
  world: ServerWorld,
  simulationPhase: ServerPhase,
): void {
  world
    .system('InitializeWeaponState')
    .requires(PlayerShip)
    .phase(simulationPhase)
    .enter([PlayerShip], (ship) => {
      if (!ship.get(ShootingCooldown))
        ship.set(ShootingCooldown, { frames: 0 });
      if (!ship.get(WeaponView))
        ship.set(WeaponView, { activeWeapon: 0, ammo: 0 });
      updateWeaponView(ship);
    });

  world
    .system('ShootingCooldown')
    .requires(PlayerShip, ShootingCooldown)
    .phase(simulationPhase)
    .each([ShootingCooldown], (_entity, [cooldown]) => {
      if (cooldown.frames > 0) cooldown.frames -= 1;
    });

  world
    .system('Shooting')
    .requires(
      PlayerShip,
      PlayerInputIntent,
      Position,
      Rotation,
      ShootingCooldown,
    )
    .phase(simulationPhase)
    .each(
      [PlayerInputIntent, Position, Rotation, ShootingCooldown],
      (ship, [input, position, rotation, cooldown]) => {
        if (!input.shoot || cooldown.frames > 0) return;

        const color = ship.get(StrokeStyle)?.style ?? '#fff';
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
          updateWeaponView(ship);
          cooldown.frames = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
        } else if (laser && laser.shots > 0) {
          laser.firing = true;
          laser.timer = ENTITY_CONFIG.SHIP.LASER_TIMER;
          laser.shots -= 1;
          updateWeaponView(ship);
          cooldown.frames = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
        } else if (rocketWeapon && rocketWeapon.shots > 0) {
          createRocket(world, ship, position.x, position.y, rotation.angle);
          rocketWeapon.shots -= 1;
          if (rocketWeapon.shots <= 0) switchToDefaultWeapon(ship);
          updateWeaponView(ship);
          cooldown.frames = ENTITY_CONFIG.SHIP.SHOOT_COOLDOWN;
        } else if (boomerangWeapon && boomerangWeapon.shots > 0) {
          createBoomerang(world, ship, position.x, position.y, rotation.angle);
          boomerangWeapon.shots -= 1;
          updateWeaponView(ship);
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
    .requires(PlayerShip, LaserWeapon)
    .phase(simulationPhase)
    .each([LaserWeapon], (ship, [laser]) => {
      if (!laser.firing) return;

      laser.timer -= 1;
      if (laser.timer > 0) return;

      laser.firing = false;
      if (laser.shots <= 0) switchToDefaultWeapon(ship);
      updateWeaponView(ship);
    });

  world
    .system('RocketSystem')
    .requires(Position, Velocity, Rotation, Rocket)
    .phase(simulationPhase)
    .each(
      [Position, Velocity, Rotation, Rocket],
      (entity, [position, velocity, rotation, rocket]) => {
        if (rocket.straightTimer > 0) {
          rocket.straightTimer -= 1;
          return;
        }

        const target = findRocketTarget(world, position);
        if (!target) return;

        const currentAngle = Math.atan2(velocity.vy, velocity.vx);
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

        velocity.vx = Math.cos(newAngle) * ENTITY_CONFIG.ROCKET.SPEED;
        velocity.vy = Math.sin(newAngle) * ENTITY_CONFIG.ROCKET.SPEED;
        rotation.angle = newAngle;
        entity.modified(Rotation);
      },
    );

  world
    .system('BoomerangSystem')
    .requires(Position, Velocity, Boomerang)
    .phase(simulationPhase)
    .each(
      [Position, Velocity, Boomerang],
      (_entity, [position, velocity, boomerang]) => {
        const owner =
          boomerang.ownerId === null
            ? undefined
            : world.getEntity(boomerang.ownerId);
        const ownerPosition = owner?.get(Position);
        if (!ownerPosition) return;

        const dx = ownerPosition.x - position.x;
        const dy = ownerPosition.y - position.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 0.001) {
          velocity.vx += (dx / distance) * ENTITY_CONFIG.BOOMERANG.PULL;
          velocity.vy += (dy / distance) * ENTITY_CONFIG.BOOMERANG.PULL;
        }

        const speed = Math.hypot(velocity.vx, velocity.vy);
        if (speed > ENTITY_CONFIG.BOOMERANG.MAX_SPEED) {
          velocity.vx =
            (velocity.vx / speed) * ENTITY_CONFIG.BOOMERANG.MAX_SPEED;
          velocity.vy =
            (velocity.vy / speed) * ENTITY_CONFIG.BOOMERANG.MAX_SPEED;
        }

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
      updateWeaponView(owner);
    });

  world
    .system('Decay')
    .requires(Decay)
    .phase(simulationPhase)
    .each([Decay], (entity, [decay]) => {
      decay.life -= decay.decay;
      if (decay.life <= 0) entity.destroy();
    });
}

export function createBullet(
  world: ServerWorld,
  owner: Entity,
  x: number,
  y: number,
  angle: number,
  color: string,
): Entity {
  const speed = ENTITY_CONFIG.BULLET.SPEED;
  return world
    .entity()
    .add(Networked)
    .set(ChildOf, { target: owner })
    .set(Position, { x, y })
    .set(Velocity, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed })
    .set(Rotation, { angle })
    .set(Bullet, { ownerType: 'player' })
    .set(ProjectileView, { kind: PROJECTILE_KIND_BULLET, team: 0 })
    .set(Collider, {
      radius: 2,
      category: CAT_PLAYER_BULLET,
      mask: CAT_ASTEROID | CAT_ENEMY,
    })
    .set(Decay, { life: ENTITY_CONFIG.BULLET.LIFE, decay: 1 })
    .set(Drawable, { zIndex: 20 })
    .add(Wraps)
    .set(FillStyle, { style: color })
    .set(Arc, { radius: 2 });
}

export function createRocket(
  world: ServerWorld,
  owner: Entity,
  x: number,
  y: number,
  angle: number,
): Entity {
  const speed = ENTITY_CONFIG.ROCKET.SPEED;
  return world
    .entity()
    .add(Networked)
    .set(ChildOf, { target: owner })
    .set(Position, { x, y })
    .set(Velocity, { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed })
    .set(Rotation, { angle })
    .set(Rocket, { straightTimer: ENTITY_CONFIG.ROCKET.STRAIGHT_FRAMES })
    .set(ProjectileView, { kind: PROJECTILE_KIND_ROCKET, team: 0 })
    .set(Collider, {
      radius: 4,
      category: CAT_PLAYER_BULLET,
      mask: CAT_ASTEROID | CAT_ENEMY,
    })
    .set(Decay, { life: ENTITY_CONFIG.ROCKET.LIFE, decay: 1 })
    .set(Drawable, { zIndex: 20 })
    .add(Wraps)
    .set(FillStyle, { style: '#ff6600' })
    .set(Shape, {
      points: [
        { x: 6, y: 0 },
        { x: -3, y: 3 },
        { x: -3, y: -3 },
      ],
    });
}

export function createBoomerang(
  world: ServerWorld,
  owner: Entity,
  x: number,
  y: number,
  angle: number,
): Entity {
  const config = ENTITY_CONFIG.BOOMERANG;
  const spawnOffset = ENTITY_CONFIG.SHIP.RADIUS + config.RADIUS + 4;
  const entity = world
    .entity()
    .add(Networked)
    .set(ChildOf, { target: owner })
    .set(Position, {
      x: x + Math.cos(angle) * spawnOffset,
      y: y + Math.sin(angle) * spawnOffset,
    })
    .set(Velocity, {
      vx: Math.cos(angle) * config.SPEED,
      vy: Math.sin(angle) * config.SPEED,
    })
    .set(Rotation, { angle })
    .set(AngularVelocity, { omega: config.SPIN })
    .set(Boomerang, { ownerId: owner.eid, armed: false })
    .set(ProjectileView, { kind: PROJECTILE_KIND_BOOMERANG, team: 0 })
    .set(Collider, {
      radius: config.RADIUS,
      category: CAT_BOOMERANG,
      mask: CAT_ASTEROID | CAT_ENEMY | CAT_PLAYER,
    })
    .set(Decay, { life: 1, decay: 1 / config.LIFE })
    .set(Drawable, { zIndex: 20 })
    .set(FillStyle, { style: '#006400' })
    .set(Shape, {
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 5 },
        { x: 5, y: 5 },
        { x: 3, y: 0 },
        { x: 5, y: -5 },
        { x: 2, y: -5 },
      ],
    });

  owner.getMut(BoomerangWeapon, (weapon) => {
    weapon.inFlight += 1;
  });
  updateWeaponView(owner);
  return entity;
}

function switchToDefaultWeapon(ship: Entity): void {
  if (ship.get(LaserWeapon)) ship.remove(LaserWeapon);
  if (ship.get(AuraWeapon)) ship.remove(AuraWeapon);
  if (ship.get(RocketWeapon)) ship.remove(RocketWeapon);
  if (ship.get(BoomerangWeapon)) ship.remove(BoomerangWeapon);
  if (!ship.get(DefaultWeapon)) ship.add(DefaultWeapon);
}

function updateWeaponView(ship: Entity): void {
  const weapon = currentWeapon(ship);
  const view = ship.getMut(WeaponView, (weaponView) => {
    weaponView.activeWeapon = weapon.kind;
    weaponView.ammo = weapon.ammo;
  });
  if (view) ship.modified(WeaponView);
}

function currentWeapon(ship: Entity): { kind: number; ammo: number } {
  const laser = ship.get(LaserWeapon);
  if (laser) return { kind: WEAPON_KIND_LASER, ammo: laser.shots };
  const aura = ship.get(AuraWeapon);
  if (aura) return { kind: WEAPON_KIND_AURA, ammo: aura.shots };
  const rocket = ship.get(RocketWeapon);
  if (rocket) return { kind: WEAPON_KIND_ROCKET, ammo: rocket.shots };
  const boomerang = ship.get(BoomerangWeapon);
  if (boomerang) return { kind: WEAPON_KIND_BOOMERANG, ammo: boomerang.shots };
  return { kind: WEAPON_KIND_DEFAULT, ammo: 0 };
}

function findRocketTarget(
  world: ServerWorld,
  position: Position,
): { x: number; y: number } | undefined {
  const alienTarget = findNearest(world, position, Alien);
  return alienTarget ?? findNearest(world, position, Asteroid);
}

function findNearest(
  world: ServerWorld,
  source: Position,
  component: typeof Alien | typeof Asteroid,
): { x: number; y: number } | undefined {
  let target: { x: number; y: number } | undefined;
  let minDistance = Infinity;
  world
    .filter([Position, component])
    .forEach([Position], (_entity, [position]) => {
      const distance = Math.hypot(source.x - position.x, source.y - position.y);
      if (
        distance >= ENTITY_CONFIG.ROCKET.HOME_RANGE ||
        distance >= minDistance
      )
        return;
      minDistance = distance;
      target = { x: position.x, y: position.y };
    });
  return target;
}

function wrapAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}
