import { ChildOf, type Entity } from '@vworlds/vecs';
import { Networked, type ServerWorld } from '@vworlds/vecs-server';
import {
  Arc,
  FillStyle,
  Polygon,
  Position as RenderPosition,
  Rotation as RenderRotation,
  Triangle,
} from '@vworlds/vecs-phaser';
import {
  AngularVelocity as PhysicsAngularVelocity,
  Body,
  BodyType,
  Circle,
  CollisionFilter,
  LinearVelocity,
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  Alien,
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
  COLORS,
  Decay,
  DefaultWeapon,
  ENTITY_CONFIG,
  LaserWeapon,
  PlayerShip,
  perSecond,
  Rocket,
  RocketWeapon,
  Wraps,
} from '@spacerocks/common';
import { PlayerInputIntent } from './playerSessions';

export class ShootingCooldown {
  frames = 0; // frames
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
}

export function installShootingSystems(world: ServerWorld): void {
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
          createBoomerang(world, ship, position.x, position.y, rotation.angle);
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
      // Mark the change so reactive consumers run — notably the laser-beam
      // embellishment (.update(LaserWeapon)) that must DESTROY the beam when
      // firing ends. .each injection does not auto-flag modified the way
      // getMut (used when firing is turned on) does, so without this the beam
      // would stay on screen after the timer expires even though damage stops.
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

        velocity.x = Math.cos(newAngle) * perSecond(ENTITY_CONFIG.ROCKET.SPEED);
        velocity.y = Math.sin(newAngle) * perSecond(ENTITY_CONFIG.ROCKET.SPEED);
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
      (_entity, [position, velocity, boomerang]) => {
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

        _entity.modified(LinearVelocity);

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
    .system('Decay')
    .with(Decay)
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
  color: number,
): Entity {
  const speed = ENTITY_CONFIG.BULLET.SPEED;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  const radius = 0.02;
  const maskBits = CAT_ASTEROID | CAT_ENEMY;
  const bullet = world
    .entity()
    .add(Networked)
    .set(ChildOf, { target: owner })
    .set(Body, { type: BodyType.Dynamic })
    .set(PhysicsPosition, { x, y })
    .set(PhysicsRotation, { angle })
    .set(LinearVelocity, { x: perSecond(vx), y: perSecond(vy) })
    .set(RenderPosition, { x, y })
    .set(RenderRotation, { angle })
    .set(Bullet, { ownerType: 'player' })
    .set(Decay, { life: ENTITY_CONFIG.BULLET.LIFE, decay: 1 })
    .add(Wraps)
    .set(FillStyle, { color, alpha: 1 })
    .set(Arc, { radius });

  createPhysicsCircleSensor(world, bullet, radius, CAT_PLAYER_BULLET, maskBits);
  return bullet;
}

export function createRocket(
  world: ServerWorld,
  owner: Entity,
  x: number,
  y: number,
  angle: number,
): Entity {
  const speed = ENTITY_CONFIG.ROCKET.SPEED;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  const radius = 0.04;
  const maskBits = CAT_ASTEROID | CAT_ENEMY;
  const rocket = world
    .entity()
    .add(Networked)
    .set(ChildOf, { target: owner })
    .set(Body, { type: BodyType.Dynamic })
    .set(PhysicsPosition, { x, y })
    .set(PhysicsRotation, { angle })
    .set(LinearVelocity, { x: perSecond(vx), y: perSecond(vy) })
    .set(RenderPosition, { x, y })
    .set(RenderRotation, { angle })
    .set(Rocket, { straightTimer: ENTITY_CONFIG.ROCKET.STRAIGHT_FRAMES })
    .set(Decay, { life: ENTITY_CONFIG.ROCKET.LIFE, decay: 1 })
    .add(Wraps)
    .set(FillStyle, { color: COLORS.rocket, alpha: 1 })
    .set(Triangle, {
      x1: 0.06,
      y1: 0,
      x2: -0.03,
      y2: 0.03,
      x3: -0.03,
      y3: -0.03,
    });

  createPhysicsCircleSensor(world, rocket, radius, CAT_PLAYER_BULLET, maskBits);
  return rocket;
}

export function createBoomerang(
  world: ServerWorld,
  owner: Entity,
  x: number,
  y: number,
  angle: number,
): Entity {
  const config = ENTITY_CONFIG.BOOMERANG;
  const spawnOffset = ENTITY_CONFIG.SHIP.RADIUS + config.RADIUS + 0.04;
  const spawnX = x + Math.cos(angle) * spawnOffset;
  const spawnY = y + Math.sin(angle) * spawnOffset;
  const vx = Math.cos(angle) * config.SPEED;
  const vy = Math.sin(angle) * config.SPEED;
  const maskBits = CAT_ASTEROID | CAT_ENEMY | CAT_PLAYER;
  const entity = world
    .entity()
    .add(Networked)
    .set(ChildOf, { target: owner })
    .set(Body, { type: BodyType.Dynamic })
    .set(PhysicsPosition, { x: spawnX, y: spawnY })
    .set(PhysicsRotation, { angle })
    .set(LinearVelocity, { x: perSecond(vx), y: perSecond(vy) })
    .set(PhysicsAngularVelocity, { value: perSecond(config.SPIN) })
    .set(RenderPosition, { x: spawnX, y: spawnY })
    .set(RenderRotation, { angle })
    .set(Boomerang, { ownerId: owner.eid, armed: false })
    .set(Decay, { life: 1, decay: 1 / config.LIFE })
    .set(FillStyle, { color: COLORS.boomerang, alpha: 1 })
    .set(Polygon, {
      points: [0, 0, 0.02, 0.05, 0.05, 0.05, 0.03, 0, 0.05, -0.05, 0.02, -0.05],
    });

  createPhysicsCircleSensor(
    world,
    entity,
    config.RADIUS,
    CAT_BOOMERANG,
    maskBits,
  );
  owner.getMut(BoomerangWeapon, (weapon) => {
    weapon.inFlight += 1;
  });
  return entity;
}

function switchToDefaultWeapon(ship: Entity): void {
  if (ship.get(LaserWeapon)) ship.remove(LaserWeapon);
  if (ship.get(AuraWeapon)) ship.remove(AuraWeapon);
  if (ship.get(RocketWeapon)) ship.remove(RocketWeapon);
  if (ship.get(BoomerangWeapon)) ship.remove(BoomerangWeapon);
  if (!ship.get(DefaultWeapon)) ship.add(DefaultWeapon);
}

function findRocketTarget(
  world: ServerWorld,
  position: PhysicsPosition,
): { x: number; y: number } | undefined {
  const alienTarget = findNearest(world, position, Alien);
  return alienTarget ?? findNearest(world, position, Asteroid);
}

function findNearest(
  world: ServerWorld,
  source: PhysicsPosition,
  component: typeof Alien | typeof Asteroid,
): { x: number; y: number } | undefined {
  let target: { x: number; y: number } | undefined;
  let minDistance = Infinity;
  world
    .filter([PhysicsPosition, component])
    .forEach([PhysicsPosition], (_entity, [position]) => {
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

function createPhysicsCircleSensor(
  world: ServerWorld,
  body: Entity,
  radius: number,
  categoryBits: number,
  maskBits: number,
): void {
  world
    .entity()
    .childOf(body)
    .set(Circle, { radius })
    .add(Sensor)
    .add(SensorEvents)
    .set(CollisionFilter, {
      categoryBits,
      maskBits,
    });
}

function wrapAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}
