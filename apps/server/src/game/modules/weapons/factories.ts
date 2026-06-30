import { ChildOf, type Entity, type World } from '@vworlds/vecs';
import { Networked } from '@vworlds/vecs-server';
import {
  FillStyle,
  Line,
  Polygon,
  Position as RenderPosition,
  Rotation as RenderRotation,
  StrokeStyle,
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
  CAT_ASTEROID,
  CAT_BOOMERANG,
  CAT_ENEMY,
  CAT_ENEMY_BULLET,
  CAT_PLAYER,
  CAT_PLAYER_BULLET,
  COLORS,
  ENTITY_CONFIG,
  perSecond,
} from '@spacerocks/common';
import { Decay } from '../decay/components';
import { Wraps } from '../movement/components';
import {
  AuraWeapon,
  Boomerang,
  BoomerangWeapon,
  Bullet,
  DefaultWeapon,
  LaserWeapon,
  Rocket,
  RocketWeapon,
} from './components';

const BULLET_LENGTH = 0.12;
const BULLET_STROKE_WIDTH = 2;

export function createBullet(
  world: World,
  owner: Entity,
  x: number,
  y: number,
  angle: number,
  color: number,
  ownerType: 'player' | 'alien' = 'player',
): Entity {
  const speed = ENTITY_CONFIG.BULLET.SPEED;
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  const radius = 0.02;
  const categoryBits =
    ownerType === 'alien' ? CAT_ENEMY_BULLET : CAT_PLAYER_BULLET;
  const maskBits =
    ownerType === 'alien'
      ? CAT_ASTEROID | CAT_PLAYER
      : CAT_ASTEROID | CAT_ENEMY;
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
    .set(Bullet, { ownerType })
    .set(Decay, { life: ENTITY_CONFIG.BULLET.LIFE, decay: 1 })
    .set(StrokeStyle, {
      color,
      alpha: 1,
      width: BULLET_STROKE_WIDTH,
    })
    .set(Line, {
      x1: 0,
      y1: 0,
      x2: -BULLET_LENGTH,
      y2: 0,
    });

  createPhysicsCircleSensor(world, bullet, radius, categoryBits, maskBits);
  return bullet;
}

export function createRocket(
  world: World,
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
  world: World,
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

export function switchToDefaultWeapon(ship: Entity): void {
  if (ship.get(LaserWeapon)) ship.remove(LaserWeapon);
  if (ship.get(AuraWeapon)) ship.remove(AuraWeapon);
  if (ship.get(RocketWeapon)) ship.remove(RocketWeapon);
  if (ship.get(BoomerangWeapon)) ship.remove(BoomerangWeapon);
  if (!ship.get(DefaultWeapon)) ship.add(DefaultWeapon);
}

function createPhysicsCircleSensor(
  world: World,
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
