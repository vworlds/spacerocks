import { describe, it, expect, beforeEach } from 'vitest';
import {
  Decay,
  Drawable,
  ExplosionView,
  FillStyle,
  FilledRect,
  Position,
  Velocity,
} from '@spacerocks/common';
import { Alpha, Particle } from '@src/components';
import { installExplosionSystem } from '@src/systems/Explosion';
import { createTestWorld, type TestWorld } from '../helpers/world';

let testWorld: TestWorld;

beforeEach(() => {
  testWorld = createTestWorld([
    Position,
    ExplosionView,
    Velocity,
    Decay,
    Drawable,
    FillStyle,
    FilledRect,
    Alpha,
    Particle,
  ]);
  installExplosionSystem(testWorld.world, testWorld.updatePhase);
  testWorld.world.start();
});

function tick() {
  testWorld.tickPhase(testWorld.updatePhase);
}

describe('Explosion', () => {
  it('spawns local particles when an ExplosionView entity appears', () => {
    testWorld.world
      .entity()
      .set(Position, { x: 25, y: 40 })
      .set(ExplosionView, { color: '#fa0', size: 12, seed: 123, duration: 30 });
    tick();
    const particles = [...testWorld.world.entities.values()].filter((entity) =>
      entity.get(Particle),
    );
    expect(particles).toHaveLength(12);
    expect(particles[0]?.get(Position)).toMatchObject({ x: 25, y: 40 });
    expect(particles[0]?.get(FillStyle)?.style).toBe('#fa0');
    expect(particles[0]?.get(Decay)).toMatchObject({ life: 1, decay: 1 / 30 });
  });

  it('spawns deterministically for the same seed', () => {
    testWorld.world
      .entity()
      .set(Position, { x: 0, y: 0 })
      .set(ExplosionView, { color: '#fff', size: 12, seed: 42, duration: 30 });
    tick();
    const first = [...testWorld.world.entities.values()].find((e) =>
      e.get(Particle),
    );
    const firstVel = first?.get(Velocity);

    const fresh = createTestWorld([
      Position,
      ExplosionView,
      Velocity,
      Decay,
      Drawable,
      FillStyle,
      FilledRect,
      Alpha,
      Particle,
    ]);
    installExplosionSystem(fresh.world, fresh.updatePhase);
    fresh.world.start();
    fresh.world
      .entity()
      .set(Position, { x: 0, y: 0 })
      .set(ExplosionView, { color: '#fff', size: 12, seed: 42, duration: 30 });
    fresh.tickPhase(fresh.updatePhase);
    const second = [...fresh.world.entities.values()].find((e) =>
      e.get(Particle),
    );
    expect(second?.get(Velocity)).toEqual(firstVel);
  });
});
