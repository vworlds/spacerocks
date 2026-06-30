import { type Entity, type World } from '@vworlds/vecs';
import { Position } from '@vworlds/vecs-phaser';
import {
  LinearVelocity,
  Position as PhysicsPosition,
} from '@vworlds/vecs-physics';
import { ENTITY_CONFIG, SCORING } from '@spacerocks/common';
import type { Prng } from '../rng/components';
import { addScore, createExplosion } from '../gameState/helpers';
import { Asteroid, AsteroidView } from './components';
import { asteroidRadius, createAsteroid } from './factories';

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

/**
 * Splits an asteroid into fragments along the axis perpendicular to the
 * projectile/impact direction, destroys the original, and scores. The small
 * fragment becomes non-collidable "dust" with a TTL when below the collidable
 * mass threshold.
 */
export function splitAsteroid(
  world: World,
  rng: Prng,
  asteroid: Entity,
  hitPoint: { x: number; y: number } | undefined,
  shotDirection: { x: number; y: number } | undefined,
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
  const shot = normalize(shotDirection ?? { x: 1, y: 0 });
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

/**
 * Splits an asteroid hit by a projectile, deriving the hit point and shot
 * direction from the projectile's position and velocity.
 */
export function splitAsteroidFromProjectile(
  world: World,
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
