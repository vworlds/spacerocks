import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { world, updatePhase, gameState } from '@src/world';
import '@src/systems/RandomClockSystem';
import { Pickup, RandomClock, RandomClockKind } from '@src/components';

beforeAll(() => world.start());
afterEach(() => {
  world.clearAllEntities();
  gameState.state = 'playing';
});

const pickupQuery = world.query('RandomClockPickupCount').requires(Pickup);

// Interval is 0.5s — pass 1000 ms delta so the system body runs.
function tick() {
  world.beginFrame(1000);
  world.runPhase(updatePhase, Date.now(), 1000);
  world.endFrame();
}

function countPickups(): number {
  return pickupQuery.count;
}

describe('RandomClockSystem', () => {
  it('dispatches clock kind when nextTick is in the past and state is playing', () => {
    world.entity().set(RandomClock, {
      kind: RandomClockKind.ShieldPickup,
      nextTick: Date.now() - 1000,
    });
    tick();
    expect(countPickups()).toBe(1);
  });

  it('does not dispatch clock kind when gameState is not playing', () => {
    gameState.state = 'lose';
    const past = Date.now() - 1000;
    world.entity().set(RandomClock, {
      kind: RandomClockKind.ShieldPickup,
      nextTick: past,
    });
    tick();
    expect(countPickups()).toBe(0);
  });

  it('does not dispatch clock kind when nextTick is in the future', () => {
    const future = Date.now() + 100000;
    world.entity().set(RandomClock, {
      kind: RandomClockKind.ShieldPickup,
      nextTick: future,
    });
    tick();
    expect(countPickups()).toBe(0);
  });

  it('reschedules nextTick after firing', () => {
    const past = Date.now() - 1000;
    const entity = world.entity().set(RandomClock, {
      kind: RandomClockKind.ShieldPickup,
      minWait: 10000,
      maxWait: 20000,
      nextTick: past,
    });
    const clock = entity.get(RandomClock) as RandomClock | undefined;
    if (!clock) throw new Error('RandomClock component was not attached');
    clock.nextTick = past;
    tick();
    expect(countPickups()).toBe(1);
    tick();
    expect(countPickups()).toBe(1);
  });
});
