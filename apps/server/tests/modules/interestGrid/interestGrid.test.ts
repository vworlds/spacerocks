import { ChildOf, type Entity } from '@vworlds/vecs';
import { Position as RenderPosition } from '@vworlds/vecs-phaser';
import {
  LinearVelocity,
  Position as PhysicsPosition,
} from '@vworlds/vecs-physics';
import { NetworkClient, NetworkInput, View } from '@vworlds/vecs-server';
import {
  ENTITY_CONFIG,
  TICK_RATE,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@spacerocks/common';
import { describe, expect, it } from 'vitest';
import { PlayerSession } from '../../../src/game/modules/playerSessions/components';
import { PlayerShip } from '../../../src/game/modules/playerShips/components';
import { createPrng } from '../../../src/game/modules/rng/components';
import { createAsteroid } from '../../../src/game/modules/asteroids/factories';
import { createGameWorld } from '../../../src/index';
import {
  createCellViewDSL,
  getGridCellIndex,
  GRID_CELL_HEIGHT,
  GRID_CELL_WIDTH,
  GRID_COLUMNS,
  InCell,
  neighbourIndices,
  randomPointInGridCell,
} from '../../../src/game/modules/interestGrid/grid';

const DT_MS = 1000 / TICK_RATE;

type GameWorld = Awaited<ReturnType<typeof createGameWorld>>;

function connectClient(world: GameWorld, id: string): Entity {
  return world
    .entity()
    .set(NetworkClient, { id })
    .set(NetworkInput, { input: {} })
    .add(View);
}

function getSession(client: Entity): Entity {
  const sessions = [...client.children(ChildOf)].filter((entity) =>
    entity.get(PlayerSession),
  );
  expect(sessions).toHaveLength(1);
  return sessions[0]!;
}

function getShip(session: Entity): Entity {
  const ships = [...session.children(ChildOf)].filter((entity) =>
    entity.get(PlayerShip),
  );
  expect(ships).toHaveLength(1);
  return ships[0]!;
}

function progressTicks(world: GameWorld, count: number, startTick = 0): void {
  for (let tick = 0; tick < count; tick += 1) {
    world.progress((startTick + tick) * DT_MS, DT_MS);
  }
}

describe('server interest grid', () => {
  it('assigns networked entities to cells and updates per-client view DSLs', async () => {
    const world = await createGameWorld();
    const rng = createPrng(0x1757);
    const sameCellA = { x: WORLD_MIN_X + 0.25, y: WORLD_MIN_Y + 0.25 };
    const sameCellB = { x: WORLD_MIN_X + 0.75, y: WORLD_MIN_Y + 0.75 };
    const differentCell = {
      x: WORLD_MIN_X + GRID_CELL_WIDTH * 2 + 0.25,
      y: WORLD_MIN_Y + 0.25,
    };
    const asteroidOptions = { velocity: { x: 0, y: 0 } };
    const asteroidA = createAsteroid(
      world,
      rng,
      sameCellA.x,
      sameCellA.y,
      ENTITY_CONFIG.ASTEROID.MASS,
      asteroidOptions,
    );
    const asteroidB = createAsteroid(
      world,
      rng,
      sameCellB.x,
      sameCellB.y,
      ENTITY_CONFIG.ASTEROID.MASS,
      asteroidOptions,
    );
    const asteroidC = createAsteroid(
      world,
      rng,
      differentCell.x,
      differentCell.y,
      ENTITY_CONFIG.ASTEROID.MASS,
      asteroidOptions,
    );

    expect(asteroidA).toBeTruthy();
    expect(asteroidB).toBeTruthy();
    expect(asteroidC).toBeTruthy();

    progressTicks(world, 2);

    const sameCellTarget = asteroidA!.target(InCell);
    expect(sameCellTarget).toBeTruthy();
    expect(asteroidB!.target(InCell)).toBe(sameCellTarget);
    expect(asteroidC!.target(InCell)).not.toBe(sameCellTarget);
    expect(getGridCellIndex(sameCellA)).toBe(getGridCellIndex(sameCellB));
    expect(getGridCellIndex(differentCell)).not.toBe(
      getGridCellIndex(sameCellA),
    );

    const client = connectClient(world, 'interest-client');
    progressTicks(world, 3, 2);

    const ship = getShip(getSession(client));
    const shipPosition = ship.get(RenderPosition)!;
    expect(client.get(View)?.dsl).toEqual(
      createCellViewDSL(getGridCellIndex(shipPosition)),
    );

    const newShipPosition = {
      x: WORLD_MIN_X + GRID_CELL_WIDTH * 3 + 0.25,
      y: WORLD_MIN_Y + 0.25,
    };
    expect(getGridCellIndex(newShipPosition)).not.toBe(
      getGridCellIndex(shipPosition),
    );
    ship.set(RenderPosition, newShipPosition);
    ship.set(PhysicsPosition, newShipPosition);
    ship.getMut(LinearVelocity, (velocity) => {
      velocity.x = 0;
      velocity.y = 0;
    });

    progressTicks(world, 2, 5);

    expect(client.get(View)?.dsl).toEqual(
      createCellViewDSL(getGridCellIndex(newShipPosition)),
    );
  });

  it('clamps neighbour cells at world edges', () => {
    expect(neighbourIndices(0)).toHaveLength(4);
    expect(neighbourIndices(1)).toHaveLength(6);
    expect(neighbourIndices(GRID_COLUMNS + 1)).toHaveLength(9);
  });

  it('returns random points within the requested cell bounds', () => {
    const cellIndex = GRID_COLUMNS + 2;
    const point = randomPointInGridCell(cellIndex, {
      range: (min, max) => (min + max) / 2,
    });

    const minX = WORLD_MIN_X + 2 * GRID_CELL_WIDTH;
    const minY = WORLD_MIN_Y + GRID_CELL_HEIGHT;
    expect(point.x).toBeGreaterThan(minX);
    expect(point.x).toBeLessThan(minX + GRID_CELL_WIDTH);
    expect(point.y).toBeGreaterThan(minY);
    expect(point.y).toBeLessThan(minY + GRID_CELL_HEIGHT);
    expect(getGridCellIndex(point)).toBe(cellIndex);
  });
});
