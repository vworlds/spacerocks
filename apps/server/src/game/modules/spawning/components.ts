import { Module, type World } from '@vworlds/vecs';
import { RandomClockKind } from '@spacerocks/common';
import type { Prng } from '../rng/components';

/**
 * Per-kind spawn timer. One entity per active spawn kind (alien, each pickup
 * kind) carries this; the clock system in each feature module fires the
 * matching spawn when `nextTick` elapses.
 */
export class SpawnTimer {
  kind: RandomClockKind = RandomClockKind.Alien;
  minWait = 0;
  maxWait = 0;
  nextTick = 0;
}

/**
 * Registers the `SpawnTimer` component.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(SpawnTimer);
  }
}

export function createSpawnTimer(
  world: World,
  rng: Prng,
  now: number,
  kind: RandomClockKind,
  minWait: number,
  maxWait: number,
): void {
  const timer = new SpawnTimer();
  timer.kind = kind;
  timer.minWait = minWait;
  timer.maxWait = maxWait;
  scheduleTimer(timer, rng, now);
  world.entity().set(SpawnTimer, timer);
}

export function scheduleTimer(timer: SpawnTimer, rng: Prng, now: number): void {
  timer.nextTick = now + rng.range(timer.minWait, timer.maxWait);
}
