import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { world, updatePhase, gameState } from '@src/world';
import '@src/systems/RandomClockSystem';
import { RandomClock } from '@src/components';

beforeAll(() => world.start());
afterEach(() => {
  world.clearAllEntities();
  gameState.state = 'playing';
});

// Interval is 0.5s — pass 1000 ms delta so the system body runs.
function tick() {
  world.beginFrame(1000);
  world.runPhase(updatePhase, Date.now(), 1000);
  world.endFrame();
}

describe('RandomClockSystem', () => {
  it('calls effectFunc when nextTick is in the past and state is playing', () => {
    let called = false;
    world.entity().set(RandomClock, {
      effectFunc: () => {
        called = true;
      },
      nextTick: Date.now() - 1000,
    });
    tick();
    expect(called).toBe(true);
  });

  it('does not call effectFunc when gameState is not playing', () => {
    let called = false;
    gameState.state = 'lose';
    const past = Date.now() - 1000;
    world.entity().set(RandomClock, {
      effectFunc: () => {
        called = true;
      },
      nextTick: past,
    });
    tick();
    expect(called).toBe(false);
  });

  it('does not call effectFunc when nextTick is in the future', () => {
    let called = false;
    const future = Date.now() + 100000;
    world.entity().set(RandomClock, {
      effectFunc: () => {
        called = true;
      },
      nextTick: future,
    });
    tick();
    expect(called).toBe(false);
  });

  it('reschedules nextTick after firing (schedule() is called inside effectFunc via clock)', () => {
    // Verify a second tick does not call effectFunc again immediately.
    let callCount = 0;
    const past = Date.now() - 1000;
    const entity = world.entity().set(RandomClock, {
      minWait: 10000,
      maxWait: 20000,
      nextTick: past,
    });
    const clock = entity.get(RandomClock) as RandomClock | undefined;
    if (!clock) throw new Error('RandomClock component was not attached');
    clock.effectFunc = () => {
      callCount++;
      clock.schedule();
    };
    clock.nextTick = past; // override scheduled time so the first tick fires
    tick();
    expect(callCount).toBe(1);
    tick();
    expect(callCount).toBe(1);
  });
});
