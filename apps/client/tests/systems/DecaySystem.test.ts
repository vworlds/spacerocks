import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { world, updatePhase } from '@src/world';
import '@src/systems/DecaySystem';
import { Alpha, Decay, Particle, Position, Velocity } from '@src/components';

beforeAll(() => world.start());
afterEach(() => world.clearAllEntities());

function tick() {
  world.beginFrame(16);
  world.runPhase(updatePhase, Date.now(), 16);
  world.endFrame();
}

function createParticle(life = 1.0, decay = 0.1) {
  return world
    .entity()
    .add(Particle)
    .set(Position, { x: 1, y: 2 })
    .set(Velocity, { vx: 3, vy: 4 })
    .set(Decay, { life, decay });
}

describe('LocalParticleSystem', () => {
  it('moves particles by velocity each tick', () => {
    const e = createParticle();
    tick();
    expect(e.get(Position)).toMatchObject({ x: 4, y: 6 });
  });

  it('decrements life by decay amount each tick', () => {
    const e = createParticle(1.0, 0.1);
    tick();
    expect(e.get(Decay)!.life).toBeCloseTo(0.9);
  });

  it('syncs Alpha.value to life when Alpha component present', () => {
    const e = createParticle(0.8, 0.1).set(Alpha, { value: 1.0 });
    tick();
    expect(e.get(Alpha)!.value).toBeCloseTo(0.7);
  });

  it('clamps Alpha.value to 0 minimum', () => {
    const e = createParticle(0.05, 0.1).set(Alpha, { value: 0.05 });
    tick();
    expect(e.get(Alpha)!.value).toBe(0);
  });

  it('destroys entity when life reaches zero', () => {
    let destroyed = false;
    const e = createParticle(0.05, 0.1);
    e.events.on('destroy', () => {
      destroyed = true;
    });
    tick();
    expect(destroyed).toBe(true);
  });

  it('destroys entity when life goes negative', () => {
    let destroyed = false;
    const e = createParticle(0.01, 0.5);
    e.events.on('destroy', () => {
      destroyed = true;
    });
    tick();
    expect(destroyed).toBe(true);
  });

  it('does not destroy entity while life is positive', () => {
    let destroyed = false;
    const e = createParticle(1.0, 0.1);
    e.events.on('destroy', () => {
      destroyed = true;
    });
    tick();
    expect(destroyed).toBe(false);
  });

  it('does not affect entities without Decay', () => {
    const e = world.entity().set(Alpha, { value: 0.5 });
    tick();
    expect(e.get(Alpha)!.value).toBe(0.5);
  });
});
