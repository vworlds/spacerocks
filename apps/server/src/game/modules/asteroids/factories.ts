import { type Entity, type World } from '@vworlds/vecs';
import { Networked } from '@vworlds/vecs-server';
import {
  FillStyle,
  Polygon,
  Position as RenderPosition,
  Rotation as RenderRotation,
  StrokeStyle,
} from '@vworlds/vecs-phaser';
import {
  AngularVelocity as PhysicsAngularVelocity,
  Body,
  BodyType,
  CollisionFilter,
  Detectable,
  LinearVelocity,
  Material,
  Polygon as PhysicsPolygon,
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
  type Vec2,
} from '@vworlds/vecs-physics';
import {
  ASTEROID_FILL_COLORS,
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
import { randomNormal, type Prng } from '../rng/components';

import { Asteroid, AsteroidMassTotal, AsteroidView } from './components';

const ASTEROID_OUTLINE_COLOR = 0xcccccc;

type AsteroidOptions = {
  velocity?: { x: number; y: number };
  color?: number;
  collidable?: boolean;
  ttlFrames?: number;
  alpha?: number;
};

export function asteroidRadius(mass: number): number {
  return Math.sqrt(mass / (Math.PI * ENTITY_CONFIG.ASTEROID.DENSITY));
}

export function getTotalAsteroidMass(world: World): number {
  return world.get(AsteroidMassTotal)?.total ?? 0;
}

export function randomAsteroidMass(rng: Prng): number {
  for (;;) {
    const z = randomNormal(rng);
    const mass =
      ENTITY_CONFIG.ASTEROID.MASS *
      Math.exp(ENTITY_CONFIG.ASTEROID.MASS_SIGMA * z);

    if (
      mass >= ENTITY_CONFIG.ASTEROID.MIN_MASS &&
      mass <= ENTITY_CONFIG.ASTEROID.MAX_MASS
    ) {
      return mass;
    }
  }
}

export function createAsteroid(
  world: World,
  rng: Prng,
  x: number,
  y: number,
  mass: number = randomAsteroidMass(rng),
  options: AsteroidOptions = {},
): Entity | undefined {
  const collidable = options.collidable ?? true;
  if (collidable && mass < ENTITY_CONFIG.ASTEROID.MIN_COLLIDABLE_MASS)
    return undefined;

  const radius = asteroidRadius(mass);
  const speedFactor = ENTITY_CONFIG.ASTEROID.SPEED_FACTOR;
  const fillColor =
    options.color ??
    ASTEROID_FILL_COLORS[rng.int(ASTEROID_FILL_COLORS.length)] ??
    COLORS.asteroidGrey;
  const alpha = options.alpha ?? 1;
  const vertCount = ENTITY_CONFIG.ASTEROID.VERTICES + rng.int(4);
  const velocity = options.velocity ?? {
    x: perSecond(rng.range(-0.5, 0.5) * speedFactor),
    y: perSecond(rng.range(-0.5, 0.5) * speedFactor),
  };
  const spin = perSecond(rng.range(-1, 1) * ENTITY_CONFIG.ASTEROID.SPIN);
  const angle = rng.range(0, Math.PI * 2);
  const maskBits =
    CAT_ASTEROID |
    CAT_PLAYER |
    CAT_PLAYER_BULLET |
    CAT_ENEMY_BULLET |
    CAT_ENEMY |
    CAT_BOOMERANG;
  const vertices = generateAsteroidPolygon(rng, radius, vertCount);
  const points: number[] = [];
  for (const v of vertices) {
    points.push(v.x, v.y);
  }

  const asteroid = world
    .entity()
    .add(Networked)
    .set(Body, { type: BodyType.Dynamic })
    .set(PhysicsPosition, { x, y })
    .set(PhysicsRotation, { angle })
    .set(PhysicsAngularVelocity, { value: spin })
    .set(LinearVelocity, velocity)
    .set(RenderPosition, { x, y })
    .set(RenderRotation, { angle })
    .set(AsteroidView, { color: fillColor, radius, mass })
    .add(Wraps)
    .set(FillStyle, { color: fillColor, alpha })
    .set(StrokeStyle, { color: ASTEROID_OUTLINE_COLOR, alpha, width: 2 })
    .set(Polygon, { points });

  if (collidable) {
    asteroid.set(Asteroid, { mass, color: fillColor });
    const area = polygonArea(vertices);
    const density = area > 0 ? mass / area : ENTITY_CONFIG.ASTEROID.DENSITY;
    createPhysicsPolygonSolid(
      world,
      asteroid,
      vertices,
      CAT_ASTEROID,
      maskBits,
      density,
    );
  } else if (options.ttlFrames) {
    asteroid.set(Decay, { life: options.ttlFrames, decay: 1 });
  }

  return asteroid;
}

/**
 * Generates a convex polygon for an asteroid, shared by render and physics.
 */
export function generateAsteroidPolygon(
  rng: Prng,
  radius: number,
  count: number,
): Vec2[] {
  const n = Math.max(3, Math.min(6, count));
  const vertices: Vec2[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2;
    const r = radius * rng.range(0.85, 1.15);
    vertices.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  for (let pass = 0; pass < 2; pass += 1) {
    for (let i = 0; i < n; i += 1) {
      const prev = vertices[(i - 1 + n) % n]!;
      const curr = vertices[i]!;
      const next = vertices[(i + 1) % n]!;
      const cross =
        (curr.x - prev.x) * (next.y - curr.y) -
        (curr.y - prev.y) * (next.x - curr.x);
      if (cross <= 0) {
        const len = Math.hypot(curr.x, curr.y) || 1;
        vertices[i] = {
          x: (curr.x / len) * radius * 1.15,
          y: (curr.y / len) * radius * 1.15,
        };
      }
    }
  }
  return vertices;
}

export function polygonArea(vertices: Vec2[]): number {
  let sum = 0;
  const n = vertices.length;
  for (let i = 0; i < n; i += 1) {
    const curr = vertices[i]!;
    const next = vertices[(i + 1) % n]!;
    sum += curr.x * next.y - next.x * curr.y;
  }
  return Math.abs(sum) / 2;
}

function createPhysicsPolygonSolid(
  world: World,
  body: Entity,
  vertices: Vec2[],
  categoryBits: number,
  maskBits: number,
  density: number,
): void {
  world
    .entity()
    .childOf(body)
    .set(PhysicsPolygon, { vertices })
    .set(Material, {
      density,
      friction: 0,
      restitution: 0.85,
    })
    .add(Detectable)
    .set(CollisionFilter, {
      categoryBits,
      maskBits,
    });
}
