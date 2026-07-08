import { World, type Entity } from '@vworlds/vecs';
import {
  Body,
  BodyType,
  Circle,
  CollisionFilter,
  PhysicsModule,
  Position,
  physics,
  type ShapeCastHit,
} from '@vworlds/vecs-physics';
import { describe, expect, it } from 'vitest';

const DT_MS = 1000 / 60;
const DT_SECONDS = 1 / 60;

function createShapeCastWorld(): World {
  const world = new World();
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: DT_SECONDS,
    subSteps: 4,
  });
  return world;
}

function createStaticObstacle(
  world: World,
  x: number,
  y: number,
  radius = 0.5,
): Entity {
  const body = world
    .entity()
    .set(Position, { x, y })
    .set(Body, { type: BodyType.Static });
  const shape = world
    .entity()
    .childOf(body)
    .set(Circle, { radius })
    .set(CollisionFilter, {
      categoryBits: 0xffff_ffff,
      maskBits: 0xffff_ffff,
    });
  return shape;
}

function stepOnce(world: World): void {
  world.progress(DT_MS, DT_MS);
}

describe('vecs-physics 1.0.40 shapeCastClosest query', () => {
  it('returns the closest hit entity, point, normal, and a fraction in [0,1]', () => {
    const world = createShapeCastWorld();
    const obstacleShape = createStaticObstacle(world, 5, 2, 0.5);

    stepOnce(world);

    const probe = new Circle();
    probe.radius = 0.5;
    const hit = physics(world).shapeCastClosest({
      shape: probe,
      from: { x: 0, y: 2 },
      to: { x: 10, y: 2 },
    }) as ShapeCastHit | undefined;

    expect(hit).toBeDefined();
    expect(hit!.entity).toBe(obstacleShape);
    expect(hit!.fraction).toBeGreaterThan(0);
    expect(hit!.fraction).toBeLessThanOrEqual(1);
    // Two circles of radius 0.5 each, centres 5 apart along the sweep.
    // First touch when centres are 1.0 apart => travelled 4.0 => fraction 0.4.
    expect(hit!.fraction).toBeCloseTo(0.4, 1);
    // Contact point sits on the obstacle's surface, facing the probe.
    expect(hit!.point.x).toBeCloseTo(4.5, 1);
    expect(hit!.point.y).toBeCloseTo(2, 1);
    // Surface normal points back toward the probe origin (-x direction).
    expect(hit!.normal.x).toBeCloseTo(-1, 1);
    expect(hit!.normal.y).toBeCloseTo(0, 1);
  });

  it('returns undefined when the sweep passes through empty space', () => {
    const world = createShapeCastWorld();

    stepOnce(world);

    const probe = new Circle();
    probe.radius = 0.5;
    const hit = physics(world).shapeCastClosest({
      shape: probe,
      from: { x: 0, y: 50 },
      to: { x: 10, y: 50 },
    });

    expect(hit).toBeUndefined();
  });

  it('reports fraction 0 with a zero normal when the cast starts overlapping', () => {
    const world = createShapeCastWorld();
    const obstacleShape = createStaticObstacle(world, 0, 0, 0.5);

    stepOnce(world);

    const probe = new Circle();
    probe.radius = 0.5;
    const hit = physics(world).shapeCastClosest({
      shape: probe,
      from: { x: 0, y: 0 },
      to: { x: 10, y: 0 },
    }) as ShapeCastHit | undefined;

    expect(hit).toBeDefined();
    expect(hit!.entity).toBe(obstacleShape);
    expect(hit!.fraction).toBe(0);
    expect(hit!.normal.x).toBe(0);
    expect(hit!.normal.y).toBe(0);
  });
});
