import { ChildOf, type ComponentClass, type Entity } from '@vworlds/vecs';
import { Networked } from '@vworlds/vecs-server';
import {
  phaserRenderableComponents,
  Polygon,
  Position,
  StrokeStyle,
  Text,
} from '@vworlds/vecs-phaser';
import {
  Body,
  Circle,
  CollisionFilter,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  Asteroid,
  COLORS,
  Explosion,
  GameStateView,
  TICK_RATE,
} from '@spacerocks/common';
import { describe, expect, it } from 'vitest';
import { createExplosion } from '../../src/game/combat';
import { createGameWorld } from '../../src/game/world';

function entitiesWith(
  component: ComponentClass,
  world: Awaited<ReturnType<typeof createGameWorld>>,
): Entity[] {
  const entities: Entity[] = [];
  world.filter([component]).forEach([], (entity) => {
    entities.push(entity);
  });
  return entities;
}

function countRenderableComponents(entity: Entity): number {
  return phaserRenderableComponents.reduce(
    (count, component) => count + (entity.get(component) ? 1 : 0),
    0,
  );
}

describe('server game world pipeline', () => {
  it('boots, ticks, and produces authoritative networked render state', async () => {
    const world = await createGameWorld();
    const dt = 1000 / TICK_RATE;

    expect(() => {
      for (let i = 0; i < 60; i += 1) {
        world.progress((i + 1) * dt, dt);
      }
    }).not.toThrow();

    expect(entitiesWith(Asteroid, world).length).toBeGreaterThan(0);
    expect(entitiesWith(GameStateView, world)).toHaveLength(1);
    expect(entitiesWith(Text, world)).toHaveLength(3);

    const asteroid = entitiesWith(Asteroid, world)[0];
    if (!asteroid) throw new Error('Expected spawned asteroid');

    expect(asteroid.get(Polygon)?.points.length).toBeGreaterThan(0);
    expect(asteroid.get(Body)).toBeTruthy();
    expect(asteroid.get(StrokeStyle)).toBeTruthy();
    expect(asteroid.get(Position)).toBeTruthy();
    expect(asteroid.get(Networked)).toBeTruthy();
    expect(countRenderableComponents(asteroid)).toBe(1);

    const shape = Array.from(asteroid.children(ChildOf)).find((child) =>
      child.get(Circle),
    );
    expect(shape?.get(Circle)?.radius).toBeGreaterThan(0);
    expect(shape?.get(Sensor)).toBeTruthy();
    expect(shape?.get(SensorEvents)).toBeTruthy();
    expect(shape?.get(CollisionFilter)).toBeTruthy();

    createExplosion(world, 0, 0, COLORS.white, 0.2);
    const explosion = entitiesWith(Explosion, world)[0];
    expect(explosion?.get(Networked)).toBeTruthy();
  });
});
