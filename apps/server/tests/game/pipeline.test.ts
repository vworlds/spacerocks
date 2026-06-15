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
  Detectable,
  Material,
} from '@vworlds/vecs-physics';
import {
  Alien,
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
    expect(shape?.get(Material)).toBeTruthy();
    expect(shape?.get(Detectable)).toBeTruthy();
    expect(shape?.get(CollisionFilter)).toBeTruthy();

    createExplosion(world, 0, 0, COLORS.white, 0.2);
    const explosion = entitiesWith(Explosion, world)[0];
    expect(explosion?.get(Networked)).toBeTruthy();
  });

  it('progresses waves in the full physics pipeline and spawns asteroid bodies with shapes', async () => {
    const world = await createGameWorld();
    const dt = 1000 / TICK_RATE;
    world.progress(0, dt);
    const stateEntity = entitiesWith(GameStateView, world)[0];
    if (!stateEntity) throw new Error('Expected GameStateView entity');
    const startingWave = stateEntity.get(GameStateView)?.wave ?? 0;

    for (const asteroid of entitiesWith(Asteroid, world)) asteroid.destroy();
    for (const alien of entitiesWith(Alien, world)) alien.destroy();
    world.flush();

    for (let i = 0; i < 20; i += 1) {
      world.progress((i + 1) * dt, dt);
    }

    expect(stateEntity.get(GameStateView)?.wave).toBe(startingWave + 1);
    const asteroids = entitiesWith(Asteroid, world);
    expect(asteroids.length).toBeGreaterThan(0);
    for (const asteroid of asteroids) {
      expect(asteroid.get(Body)).toBeTruthy();
      const shape = Array.from(asteroid.children(ChildOf)).find((child) =>
        child.get(Circle),
      );
      expect(shape?.get(Material)).toBeTruthy();
      expect(shape?.get(Detectable)).toBeTruthy();
      expect(shape?.get(CollisionFilter)).toBeTruthy();
    }
  });
});
