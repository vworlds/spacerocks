import { World, type ComponentClass, type Entity } from '@vworlds/vecs';
import {
  Depth,
  phaserNetworkComponents,
  Position,
  Text,
  TextAlign,
} from '@vworlds/vecs-phaser';
import { GameStateView, WORLD_MAX_Y, WORLD_MIN_X } from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { createPrng } from '../../src/game/rng';
import {
  installSpawningSystems,
  registerSpawningComponents,
} from '../../src/game/spawning';
import { installHudSystems, registerHudComponents } from '../../src/game/hud';
import { registerPlayerSessionComponents } from '../../src/game/playerSessions';

vi.mock('@vworlds/vecs-server', () => ({
  NetworkClient: class NetworkClient {
    id = '';
  },
  NetworkInput: class NetworkInput {
    input: unknown;
  },
  Networked: class Networked {},
}));

function createTestWorld(): World {
  const world = new World();
  for (const component of phaserNetworkComponents) world.component(component);
  registerPlayerSessionComponents(
    world as unknown as Parameters<typeof registerPlayerSessionComponents>[0],
  );
  registerSpawningComponents(
    world as unknown as Parameters<typeof registerSpawningComponents>[0],
  );
  registerHudComponents(
    world as unknown as Parameters<typeof registerHudComponents>[0],
  );
  installSpawningSystems(
    world as unknown as Parameters<typeof installSpawningSystems>[0],
    createPrng(1234),
  );
  installHudSystems(
    world as unknown as Parameters<typeof installHudSystems>[0],
  );
  world.progress(0, 16);
  return world;
}

function entitiesWith(world: World, component: ComponentClass): Entity[] {
  const entities: Entity[] = [];
  world.filter([component]).forEach([], (entity) => {
    entities.push(entity);
  });
  return entities;
}

function findText(world: World, value: string): Entity {
  const entity = entitiesWith(world, Text).find(
    (candidate) => candidate.get(Text)?.value === value,
  );
  if (!entity) throw new Error(`Expected Text entity: ${value}`);
  return entity;
}

function gameStateEntity(world: World): Entity {
  const entity = entitiesWith(world, GameStateView)[0];
  if (!entity) throw new Error('Expected GameStateView entity');
  return entity;
}

describe('server HUD Text entities', () => {
  it('creates score, wave, and message Text entities from GameStateView', () => {
    const world = createTestWorld();
    const texts = entitiesWith(world, Text);

    expect(texts).toHaveLength(3);
    expect(findText(world, 'Score: 0').get(Position)).toMatchObject({
      x: WORLD_MIN_X + 1.0,
      y: WORLD_MAX_Y - 0.25,
    });
    expect(findText(world, 'Wave: 1').get(Position)).toMatchObject({
      x: WORLD_MIN_X + 1.0,
      y: WORLD_MAX_Y - 0.55,
    });
    expect(findText(world, '').get(Position)).toMatchObject({ x: 0, y: 0 });

    expect(findText(world, 'Score: 0').get(Text)).toMatchObject({
      fontFamily: 'monospace',
      fontSize: 18,
      color: 0xffffff,
      align: TextAlign.Left,
    });
    expect(findText(world, '').get(Text)).toMatchObject({
      fontFamily: 'sans-serif',
      fontSize: 28,
      color: 0xffffff,
      align: TextAlign.Center,
    });
    for (const entity of texts) {
      expect(entity.get(Depth)).toMatchObject({ value: 1000 });
    }
  });

  it('updates score and wave Text values when GameStateView changes', () => {
    const world = createTestWorld();
    const stateEntity = gameStateEntity(world);
    const scoreText = findText(world, 'Score: 0');
    const waveText = findText(world, 'Wave: 1');

    stateEntity.set(GameStateView, {
      state: 0,
      score: 420,
      wave: 7,
      status: '',
    });
    world.progress(16, 16);

    expect(scoreText.get(Text)?.value).toBe('Score: 420');
    expect(waveText.get(Text)?.value).toBe('Wave: 7');
  });
});
