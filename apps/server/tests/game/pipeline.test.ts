import { type ComponentClass, type Entity } from '@vworlds/vecs';
import { Networked } from '@vworlds/vecs-server';
import {
  phaserRenderableComponents,
  Polygon,
  Position,
  StrokeStyle,
  Text,
} from '@vworlds/vecs-phaser';
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
  world = createGameWorld(),
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
  it('boots, ticks, and produces authoritative networked render state', () => {
    const world = createGameWorld();
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
    expect(asteroid.get(StrokeStyle)).toBeTruthy();
    expect(asteroid.get(Position)).toBeTruthy();
    expect(asteroid.get(Networked)).toBeTruthy();
    expect(countRenderableComponents(asteroid)).toBe(1);

    createExplosion(world, 0, 0, COLORS.white, 0.2);
    const explosion = entitiesWith(Explosion, world)[0];
    expect(explosion?.get(Networked)).toBeTruthy();
  });
});
