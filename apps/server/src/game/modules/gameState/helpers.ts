import { type Entity, type World } from '@vworlds/vecs';
import { Networked } from '@vworlds/vecs-server';
import { Position } from '@vworlds/vecs-phaser';
import { ENTITY_CONFIG, Explosion, TICK_RATE } from '@spacerocks/common';
import { Decay } from '../decay/components';
import { GameStateView } from './components';

const GAME_STATE_PLAYING = 0;

/**
 * Creates the singleton `GameStateView` entity that tracks play state.
 * Other modules read it via {@link isPlaying}; combat/weapons reuse
 * {@link createExplosion} for impact effects.
 */
export function createGameStateEntity(world: World): Entity {
  return world.entity().add(Networked).set(GameStateView, {
    state: GAME_STATE_PLAYING,
  });
}

export function getGameStateEntity(world: World): Entity | undefined {
  let gameStateEntity: Entity | undefined;
  world.filter([GameStateView]).forEach([], (entity) => {
    gameStateEntity ??= entity;
  });
  return gameStateEntity;
}

export function getGameState(world: World): GameStateView | undefined {
  return getGameStateEntity(world)?.get(GameStateView);
}

export function isPlaying(world: World): boolean {
  const state = getGameState(world);
  return !state || state.state === GAME_STATE_PLAYING;
}

export function createExplosion(
  world: World,
  x: number,
  y: number,
  color: number,
  size = 0.2,
): void {
  world
    .entity()
    .add(Networked)
    .set(Position, { x, y })
    .set(Explosion, {
      color,
      size,
      seed: Math.floor(Math.random() * 0xffffffff),
      duration: ENTITY_CONFIG.EXPLOSION.LIFE_FRAMES / TICK_RATE,
    })
    .set(Decay, {
      life: 1,
      decay: 1 / ENTITY_CONFIG.EXPLOSION.LIFE_FRAMES,
    });
}
