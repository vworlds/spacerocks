import { describe, it, expect, beforeEach } from 'vitest';
import { Decay, Position, Velocity } from '@spacerocks/common';
import { Alpha, Particle } from '@src/components';
import { installParticleSystem } from '@src/systems/Particles';
import { createTestWorld, type TestWorld } from '../helpers/world';

let testWorld: TestWorld;

beforeEach(() => {
  testWorld = createTestWorld([Particle, Position, Velocity, Decay, Alpha]);
  installParticleSystem(testWorld.world);
});

function makeParticle(life = 1, decay = 0.1) {
  return testWorld.world
    .entity()
    .add(Particle)
    .set(Position, { x: 1, y: 2 })
    .set(Velocity, { vx: 3, vy: 4 })
    .set(Decay, { life, decay });
}

function tick() {
  testWorld.tickPhase(testWorld.updatePhase);
}

describe('Particles', () => {
  it('moves particles by velocity each tick', () => {
    const e = makeParticle();
    tick();
    expect(e.get(Position)).toMatchObject({ x: 4, y: 6 });
  });

  it('decrements life by decay each tick', () => {
    const e = makeParticle(1, 0.1);
    tick();
    expect(e.get(Decay)!.life).toBeCloseTo(0.9);
  });

  it('syncs Alpha to life when Alpha is present', () => {
    const e = makeParticle(0.8, 0.1).set(Alpha, { value: 1 });
    tick();
    expect(e.get(Alpha)!.value).toBeCloseTo(0.7);
  });

  it('clamps Alpha to a 0 floor', () => {
    let removedAlphaValue: number | undefined;
    testWorld.world.component(Alpha).onRemove((_entity, alpha) => {
      removedAlphaValue = alpha.value;
    });
    const e = makeParticle(0.05, 0.1).set(Alpha, { value: 0.05 });
    tick();
    expect(testWorld.world.entities.has(e.eid)).toBe(false);
    expect(removedAlphaValue).toBe(0);
  });

  it('destroys particles when life reaches zero', () => {
    const e = makeParticle(0.05, 0.1);
    tick();
    expect(testWorld.world.entities.has(e.eid)).toBe(false);
  });

  it('leaves particles alive while life is positive', () => {
    const e = makeParticle(1, 0.1);
    tick();
    expect(testWorld.world.entities.has(e.eid)).toBe(true);
  });
});
