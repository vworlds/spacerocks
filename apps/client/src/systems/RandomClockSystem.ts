import { world, updatePhase, gameState } from '../world';
import { Alien, RandomClock, RandomClockKind } from '../components/index';
import { createAlien } from '../factories/Alien';
import { createPickup } from '../factories/Pickup';
import { GAME_CONFIG } from '../constants';

const alienQuery = world.query('AlienClockCap').requires(Alien);

function dispatchRandomClock(kind: RandomClockKind): void {
  if (kind === RandomClockKind.Alien) {
    if (alienQuery.count < GAME_CONFIG.ALIEN_CAP) createAlien();
  } else if (kind === RandomClockKind.ShieldPickup) {
    createPickup('shield');
  } else if (kind === RandomClockKind.LaserPickup) {
    createPickup('laser');
  } else if (kind === RandomClockKind.AuraPickup) {
    createPickup('aura');
  } else if (kind === RandomClockKind.RocketPickup) {
    createPickup('rocket');
  } else if (kind === RandomClockKind.BoomerangPickup) {
    createPickup('boomerang');
  } else {
    createPickup('health');
  }
}

world
  .system('RandomClockSystem')
  .interval(0.5)
  .requires(RandomClock)
  .phase(updatePhase)
  .each([RandomClock], (_e, [clock]) => {
    if (gameState.state !== 'playing') return;
    if (Date.now() >= clock.nextTick) {
      dispatchRandomClock(clock.kind);
      clock.schedule();
    }
  });
