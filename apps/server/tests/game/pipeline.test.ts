import { ChildOf, type ComponentClass, type Entity } from '@vworlds/vecs';
import { Networked } from '@vworlds/vecs-server';
import {
  FillStyle,
  phaserRenderableComponents,
  Polygon,
  Position,
  StrokeStyle,
} from '@vworlds/vecs-phaser';
import {
  Body,
  CollisionFilter,
  Detectable,
  Material,
  Polygon as PhysicsPolygon,
} from '@vworlds/vecs-physics';
import {
  Alien,
  Asteroid,
  COLORS,
  Explosion,
  GameStateView,
  TICK_RATE,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
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

    const asteroid = entitiesWith(Asteroid, world)[0];
    if (!asteroid) throw new Error('Expected spawned asteroid');

    expect(asteroid.get(Polygon)?.points.length).toBeGreaterThan(0);
    expect(asteroid.get(Body)).toBeTruthy();
    expect(asteroid.get(FillStyle)).toBeTruthy();
    expect(asteroid.get(StrokeStyle)).toBeTruthy();
    expect(asteroid.get(Position)).toBeTruthy();
    expect(asteroid.get(Networked)).toBeTruthy();
    expect(countRenderableComponents(asteroid)).toBe(1);

    const shape = Array.from(asteroid.children(ChildOf)).find((child) =>
      child.get(PhysicsPolygon),
    );
    expect(shape?.get(PhysicsPolygon)?.vertices.length).toBeGreaterThan(0);
    expect(shape?.get(Material)).toBeTruthy();
    expect(shape?.get(Detectable)).toBeTruthy();
    expect(shape?.get(CollisionFilter)).toBeTruthy();

    createExplosion(world, 0, 0, COLORS.white, 0.2);
    const explosion = entitiesWith(Explosion, world)[0];
    expect(explosion?.get(Networked)).toBeTruthy();
  });

  it('continuously spawns asteroid bodies with shapes without incrementing wave state', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const world = await createGameWorld();
    const dt = 1000 / TICK_RATE;
    world.progress(0, dt);
    const stateEntity = entitiesWith(GameStateView, world)[0];
    if (!stateEntity) throw new Error('Expected GameStateView entity');
    const startingWave = stateEntity.get(GameStateView)?.wave ?? 0;

    for (const asteroid of entitiesWith(Asteroid, world)) asteroid.destroy();
    for (const alien of entitiesWith(Alien, world)) alien.destroy();
    world.flush();

    for (let i = 0; i < 40; i += 1) {
      world.progress((i + 1) * dt, dt);
    }

    expect(stateEntity.get(GameStateView)?.wave).toBe(startingWave);
    const asteroids = entitiesWith(Asteroid, world);
    expect(asteroids.length).toBeGreaterThan(0);
    for (const asteroid of asteroids) {
      expect(asteroid.get(Body)).toBeTruthy();
      const shape = Array.from(asteroid.children(ChildOf)).find((child) =>
        child.get(PhysicsPolygon),
      );
      expect(shape?.get(Material)).toBeTruthy();
      expect(shape?.get(Detectable)).toBeTruthy();
      expect(shape?.get(CollisionFilter)).toBeTruthy();
    }
  });
});
