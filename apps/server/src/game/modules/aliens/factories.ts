import { type Entity, type World } from '@vworlds/vecs';
import { Networked } from '@vworlds/vecs-server';
import {
  Position as RenderPosition,
  Rotation as RenderRotation,
  StrokeStyle,
  Polygon,
} from '@vworlds/vecs-phaser';
import {
  Body,
  BodyType,
  Circle,
  CollisionFilter,
  Detectable,
  LinearVelocity,
  Material,
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  CAT_ASTEROID,
  CAT_BOOMERANG,
  CAT_ENEMY,
  CAT_PLAYER,
  CAT_PLAYER_BULLET,
  COLORS,
  ENTITY_CONFIG,
  perSecond,
  VIEWPORT_WIDTH,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@spacerocks/common';
import { Health } from '../combat/components';
import { Wraps } from '../movement/components';
import { PlayerShip } from '../playerShips/components';
import type { Prng } from '../rng/components';
import { Alien } from './components';

const ALIEN_SPAWN_MARGIN = 0.5;

export function createAlien(world: World, rng: Prng): Entity {
  const { x, y } = chooseAlienSpawnPosition(world, rng);
  const vx = rng.range(-0.5, 0.5) * ENTITY_CONFIG.ALIEN.SPEED_FACTOR;
  const vy = rng.range(-0.5, 0.5) * ENTITY_CONFIG.ALIEN.SPEED_FACTOR;
  const angle = rng.range(0, Math.PI * 2);
  const maskBits =
    CAT_PLAYER | CAT_ASTEROID | CAT_PLAYER_BULLET | CAT_BOOMERANG;
  const alien = world
    .entity()
    .add(Networked)
    .set(Body, { type: BodyType.Dynamic })
    .set(PhysicsPosition, { x, y })
    .set(PhysicsRotation, { angle })
    .set(LinearVelocity, { x: perSecond(vx), y: perSecond(vy) })
    .set(RenderPosition, { x, y })
    .set(RenderRotation, { angle })
    .set(Alien, { shootCooldown: ENTITY_CONFIG.ALIEN.SHOOT_COOLDOWN_BASE })
    .set(Health, {
      hp: ENTITY_CONFIG.ALIEN.MAX_HP,
      maxHp: ENTITY_CONFIG.ALIEN.MAX_HP,
    })
    .add(Wraps)
    .set(StrokeStyle, { color: COLORS.orange, alpha: 1, width: 2 })
    .set(Polygon, { points: [0.15, 0, -0.1, 0.1, -0.05, 0, -0.1, -0.1] });

  createPhysicsCircleSolid(
    world,
    alien,
    ENTITY_CONFIG.ALIEN.RADIUS,
    CAT_ENEMY,
    CAT_ASTEROID,
    ENTITY_CONFIG.ALIEN.MASS /
      (Math.PI * ENTITY_CONFIG.ALIEN.RADIUS * ENTITY_CONFIG.ALIEN.RADIUS),
  );
  createPhysicsCircleSensor(
    world,
    alien,
    ENTITY_CONFIG.ALIEN.RADIUS + 0.01,
    CAT_ENEMY,
    maskBits,
  );
  return alien;
}

function chooseAlienSpawnPosition(
  world: World,
  rng: Prng,
): { x: number; y: number } {
  const players: Array<{ x: number; y: number }> = [];
  world
    .filter([PlayerShip, RenderPosition])
    .forEach([RenderPosition], (_entity, [position]) => {
      players.push({ x: position.x, y: position.y });
    });

  if (players.length === 0) {
    return {
      x: rng.bool() ? WORLD_MIN_X - 0.2 : WORLD_MAX_X + 0.2,
      y: rng.range(WORLD_MIN_Y, WORLD_MAX_Y),
    };
  }

  const player = players[rng.int(players.length)]!;
  const angle = rng.range(0, Math.PI * 2);
  const distance = VIEWPORT_WIDTH * 0.6;

  return {
    x: clamp(
      player.x + Math.cos(angle) * distance,
      WORLD_MIN_X + ALIEN_SPAWN_MARGIN,
      WORLD_MAX_X - ALIEN_SPAWN_MARGIN,
    ),
    y: clamp(
      player.y + Math.sin(angle) * distance,
      WORLD_MIN_Y + ALIEN_SPAWN_MARGIN,
      WORLD_MAX_Y - ALIEN_SPAWN_MARGIN,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createPhysicsCircleSolid(
  world: World,
  body: Entity,
  radius: number,
  categoryBits: number,
  maskBits: number,
  density: number,
): void {
  world
    .entity()
    .childOf(body)
    .set(Circle, { radius })
    .set(Material, {
      density,
      friction: 0,
      restitution: 0.85,
    })
    .add(Detectable)
    .set(CollisionFilter, { categoryBits, maskBits });
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
    .set(CollisionFilter, { categoryBits, maskBits });
}
