import { type Entity, type World } from '@vworlds/vecs';
import { Networked } from '@vworlds/vecs-server';
import { Position } from '@vworlds/vecs-phaser';
import { ENTITY_CONFIG, Explosion, TICK_RATE } from '@spacerocks/common';
import { Decay } from '../decay/components';
import { GameStateView } from './components';

const GAME_STATE_PLAYING = 0;

/**
 * Creates the singleton `GameStateView` entity that tracks play state, wave,
 * score, and status. Other modules read score/state via {@link addScore} and
 * {@link isPlaying}.
 */
export function createGameStateEntity(world: World): Entity {
  return world.entity().add(Networked).set(GameStateView, {
    state: GAME_STATE_PLAYING,
    wave: 1,
    score: 0,
    status: '',
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

export function addScore(world: World, amount: number): void {
  const entity = getGameStateEntity(world);
  const state = entity?.getMut(GameStateView);
  if (!entity || !state) return;
  state.score += amount;
  entity.modified(GameStateView);
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
