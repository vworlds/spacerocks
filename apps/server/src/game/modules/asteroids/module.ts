import { Module, type Entity, type World } from '@vworlds/vecs';
import { Position as RenderPosition } from '@vworlds/vecs-phaser';
import {
  Asteroid,
  GameStateView,
  MAX_ASTEROIDS_TOTAL_MASS,
  PlayerShip,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@spacerocks/common';
import { registerAsteroidsComponents, AsteroidMassTotal } from './components';
import { createAsteroid, randomAsteroidMass } from './factory';
import { WorldRng, type Prng } from '../rng/components';
import { isPlaying } from '../gameState/helpers';
import {
  getGridCellIndex,
  GRID_CELL_COUNT,
  neighbourIndices,
  randomPointInGridCell,
} from '../interestGrid/grid';

const GAME_STATE_PLAYING = 0;

function getTotalAsteroidMass(world: World): number {
  return world.get(AsteroidMassTotal)?.total ?? 0;
}

function fillInitialAsteroids(world: World, rng: Prng): void {
  let filledMass = 0;
  while (filledMass < MAX_ASTEROIDS_TOTAL_MASS) {
    let x: number;
    let y: number;
    do {
      x = rng.range(WORLD_MIN_X, WORLD_MAX_X);
      y = rng.range(WORLD_MIN_Y, WORLD_MAX_Y);
    } while (Math.hypot(x, y) < 2.0);
    const mass = randomAsteroidMass(rng);
    createAsteroid(world, rng, x, y, mass);
    filledMass += mass;
  }
}

function spawnAsteroidIfBelowMassCap(
  world: World,
  rng: Prng,
  players: Iterable<Entity>,
): void {
  if (getTotalAsteroidMass(world) >= MAX_ASTEROIDS_TOTAL_MASS) return;

  const cellIndex = chooseUnseenGridCell(players, rng);
  if (cellIndex === undefined) return;

  const { x, y } = randomPointInGridCell(cellIndex, rng);
  createAsteroid(world, rng, x, y);
}

function chooseUnseenGridCell(
  players: Iterable<Entity>,
  rng: Prng,
): number | undefined {
  const visibleCells = new Set<number>();
  for (const player of players) {
    const position = player.get(RenderPosition);
    if (!position) continue;
    for (const cellIndex of neighbourIndices(getGridCellIndex(position))) {
      visibleCells.add(cellIndex);
    }
  }

  const candidates: number[] = [];
  for (let cellIndex = 0; cellIndex < GRID_CELL_COUNT; cellIndex += 1) {
    if (!visibleCells.has(cellIndex)) candidates.push(cellIndex);
  }
  if (candidates.length === 0) return undefined;

  return candidates[rng.int(candidates.length)];
}

/**
 * Asteroid field lifecycle: spawns the initial field at init time, tracks
 * total live asteroid mass reactively, and continuously spawns new asteroids
 * up to the mass cap in grid cells no player can see.
 *
 * Dependencies: `RngModule`, `GameStateModule` (`isPlaying`),
 * `InterestGridModule` (grid math), `SpawningModule` (unused here now — the
 * asteroid spawner uses its own clock-driven system, not `SpawnTimer`).
 */
export class AsteroidsModule extends Module {
  override init(): void {
    const world = this.world;
    const rng = world.get(WorldRng)?.prng;
    if (!rng) {
      throw new Error('AsteroidsModule requires RngModule to be loaded first');
    }
    registerAsteroidsComponents(world);

    fillInitialAsteroids(world, rng);

    world
      .system('TrackAsteroidMass')
      .with(Asteroid)
      .enter([Asteroid], (_entity, [asteroid]) => {
        world.component(AsteroidMassTotal).getMut(AsteroidMassTotal)!.total +=
          asteroid.mass;
      })
      .exit([Asteroid], (_entity, [asteroid]) => {
        world.component(AsteroidMassTotal).getMut(AsteroidMassTotal)!.total -=
          asteroid.mass;
      });

    const players = world
      .query('SpawnerPlayers')
      .with(PlayerShip, RenderPosition)
      .build();

    world
      .system('ServerAsteroidSpawner')
      .interval(0.5)
      .with(GameStateView)
      .each([GameStateView], (_entity, [state]) => {
        if (state.state !== GAME_STATE_PLAYING) return;
        if (!isPlaying(world)) return;
        spawnAsteroidIfBelowMassCap(world, rng, players);
      });
  }
}
