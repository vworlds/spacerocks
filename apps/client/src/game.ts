import { world, gameState, canvasSize, msgEl } from './world';
import './systems/index';
import { createShip } from './factories/Ship';
import { createAsteroid } from './factories/Asteroid';
import { Position, RandomClock, RandomClockKind } from './components/index';
import { GAME_CONFIG } from './constants';
import type { Entity } from '@vworlds/vecs';

function destroyAllGameEntities(): void {
  const toDestroy: Entity[] = [];
  world.filter([Position]).forEach((e) => toDestroy.push(e));
  world.filter([RandomClock]).forEach((e) => toDestroy.push(e));
  for (const e of toDestroy) e.destroy();
}

export function initGame(): void {
  destroyAllGameEntities();

  gameState.state = 'playing';
  gameState.score = 0;
  gameState.wave = 1;

  if (msgEl) msgEl.innerText = '';

  createShip(canvasSize.width * 0.3, canvasSize.height * 0.5, '#00ffcc', 0, {
    thrust: 'KeyW',
    rotateLeft: 'KeyA',
    rotateRight: 'KeyD',
    shoot: 'Space',
  });
  createShip(canvasSize.width * 0.7, canvasSize.height * 0.5, '#ff00ff', 1, {
    thrust: 'ArrowUp',
    rotateLeft: 'ArrowLeft',
    rotateRight: 'ArrowRight',
    shoot: 'Enter',
  });

  world.entity().set(RandomClock, {
    minWait: GAME_CONFIG.ALIEN_SPAWN_MIN_WAIT,
    maxWait: GAME_CONFIG.ALIEN_SPAWN_MAX_WAIT,
    kind: RandomClockKind.Alien,
  });
  world.entity().set(RandomClock, {
    minWait: GAME_CONFIG.SHIELD_SPAWN_MIN_WAIT,
    maxWait: GAME_CONFIG.SHIELD_SPAWN_MAX_WAIT,
    kind: RandomClockKind.ShieldPickup,
  });
  world.entity().set(RandomClock, {
    minWait: GAME_CONFIG.LASER_SPAWN_MIN_WAIT,
    maxWait: GAME_CONFIG.LASER_SPAWN_MAX_WAIT,
    kind: RandomClockKind.LaserPickup,
  });
  world.entity().set(RandomClock, {
    minWait: GAME_CONFIG.AURA_SPAWN_MIN_WAIT,
    maxWait: GAME_CONFIG.AURA_SPAWN_MAX_WAIT,
    kind: RandomClockKind.AuraPickup,
  });
  world.entity().set(RandomClock, {
    minWait: GAME_CONFIG.ROCKET_SPAWN_MIN_WAIT,
    maxWait: GAME_CONFIG.ROCKET_SPAWN_MAX_WAIT,
    kind: RandomClockKind.RocketPickup,
  });
  world.entity().set(RandomClock, {
    minWait: GAME_CONFIG.BOOMERANG_SPAWN_MIN_WAIT,
    maxWait: GAME_CONFIG.BOOMERANG_SPAWN_MAX_WAIT,
    kind: RandomClockKind.BoomerangPickup,
  });
  world.entity().set(RandomClock, {
    minWait: GAME_CONFIG.HEALTH_SPAWN_MIN_WAIT,
    maxWait: GAME_CONFIG.HEALTH_SPAWN_MAX_WAIT,
    kind: RandomClockKind.HealthPickup,
  });

  spawnWave(1);
}

function spawnWave(wave: number): void {
  const count = 3 + wave * 2;
  const { width, height } = canvasSize;
  for (let i = 0; i < count; i++) {
    let x: number;
    let y: number;
    do {
      x = Math.random() * width;
      y = Math.random() * height;
    } while (Math.hypot(x - width / 2, y - height / 2) < 200);
    createAsteroid(x, y, 3);
  }
}
