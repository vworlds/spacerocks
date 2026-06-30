import { ChildOf, World, type Entity } from '@vworlds/vecs';
import { NetworkClient, NetworkInput } from '@vworlds/vecs-server';
import { Image, Position, Size, Tint } from '@vworlds/vecs-phaser';
import { PhysicsModule } from '@vworlds/vecs-physics';
import {
  PLAYER_COLORS,
  Hyperspace,
  NetworkComponentsModule,
  Owner,
  PlayerShip,
  TICK_RATE,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { registerNetworkFoundation } from '../helpers';
import {
  Components as PlayerSessionsComponents,
  PlayerInputIntent,
  PlayerSession,
} from '../../../src/game/modules/playerSessions/components';
import { PlayerSessionsModule } from '../../../src/game/modules/playerSessions/module';
import { SHIP_SPRITE_SIZE_METERS } from '../../../src/game/modules/assets/sprite';
import {
  Components as AssetsComponents,
  WorldAssets,
} from '../../../src/game/modules/assets/components';
import { RngModule } from '../../../src/game/modules/rng/module';
import { GameStateModule } from '../../../src/game/modules/gameState/module';

vi.mock('@vworlds/vecs-server', () => ({
  NetworkClient: class NetworkClient {
    id = '';
  },
  NetworkInput: class NetworkInput {
    input: unknown;
  },
  Networked: class Networked {},
  View: class View {
    dsl: unknown;
  },
}));

// Fake AssetManager exposing just the surface pickShipSprite reads: a
// `getTileset(key)` returning a tileset-like object with `id` + `tileCount`.
const SHIP_TEXTURE_ID = 1;
const SHIP_FRAME_COUNT = 16;
function fakeAssetManager() {
  return {
    getTileset: () => ({ id: SHIP_TEXTURE_ID, tileCount: SHIP_FRAME_COUNT }),
  };
}

function createTestWorld(): World {
  const world = new World();
  world.module(NetworkComponentsModule);
  registerNetworkFoundation(world);
  world.module(RngModule);
  world.module(GameStateModule);
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
  world.module(PlayerSessionsComponents);
  world.module(AssetsComponents);
  world.set(WorldAssets, { manager: fakeAssetManager() as never });
  world.module(PlayerSessionsModule);
  return world;
}

function connectClient(world: World, id: string, input: unknown = {}): Entity {
  return world.entity().set(NetworkClient, { id }).set(NetworkInput, { input });
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

describe('player session ownership', () => {
  it('creates one distinct server-owned ship per connected client', () => {
    const world = createTestWorld();
    const clientA = connectClient(world, 'client-a');
    const clientB = connectClient(world, 'client-b');

    world.progress(0, 16);

    const shipA = getShip(getSession(clientA));
    const shipB = getShip(getSession(clientB));
    const playerShipA = shipA.get(PlayerShip)!;
    const playerShipB = shipB.get(PlayerShip)!;
    const ownerA = shipA.get(Owner)!;
    const ownerB = shipB.get(Owner)!;
    const hyperspaceA = shipA.get(Hyperspace)!;
    const hyperspaceB = shipB.get(Hyperspace)!;
    const positionA = shipA.get(Position)!;
    const positionB = shipB.get(Position)!;

    expect(shipA).not.toBe(shipB);
    expect(playerShipA.playerIndex).toBe(0);
    expect(playerShipB.playerIndex).toBe(1);
    expect(ownerA.clientId).toBe('client-a');
    expect(ownerB.clientId).toBe('client-b');
    expect(hyperspaceA.seq).toBe(0);
    expect(hyperspaceB.seq).toBe(0);
    expect(playerShipA.color).not.toBe(playerShipB.color);
    expect(positionA).not.toEqual(positionB);
    expect(positionA.x).toBeGreaterThanOrEqual(WORLD_MIN_X);
    expect(positionA.x).toBeLessThanOrEqual(WORLD_MAX_X);
    expect(positionB.y).toBeGreaterThanOrEqual(WORLD_MIN_Y);
    expect(positionB.y).toBeLessThanOrEqual(WORLD_MAX_Y);
    expect(playerShipA.color).toBe(PLAYER_COLORS[0]);
    expect(shipA.get(Image)).toMatchObject({
      texture: SHIP_TEXTURE_ID,
      frame: expect.any(Number),
    });
    expect(shipA.get(Image)!.frame).toBeGreaterThanOrEqual(0);
    expect(shipA.get(Image)!.frame).toBeLessThan(SHIP_FRAME_COUNT);
    expect(shipA.get(Size)).toMatchObject({
      width: SHIP_SPRITE_SIZE_METERS,
      height: SHIP_SPRITE_SIZE_METERS,
    });
    // Player color is reapplied via the new Tint component (multiplicative tint
    // over the spritesheet frame); restores the colored-ship feel the old
    // StrokeStyle triangle carried, now on the Image renderable.
    expect(shipA.get(Tint)).toMatchObject({
      topLeft: PLAYER_COLORS[0],
      topRight: PLAYER_COLORS[0],
      bottomLeft: PLAYER_COLORS[0],
      bottomRight: PLAYER_COLORS[0],
      monochromatic: true,
    });
  });

  it('applies network input only to the owning ship', () => {
    const world = createTestWorld();
    const clientA = connectClient(world, 'client-a', {
      thrust: true,
      rotateLeft: true,
      rotateRight: false,
      shoot: true,
    });
    const clientB = connectClient(world, 'client-b', {
      thrust: false,
      rotateLeft: false,
      rotateRight: true,
      shoot: false,
    });

    world.progress(0, 16);
    world.progress(16, 16);

    expect(getShip(getSession(clientA)).get(PlayerInputIntent)).toMatchObject({
      thrust: true,
      rotateLeft: true,
      rotateRight: false,
      shoot: true,
    });
    expect(getShip(getSession(clientB)).get(PlayerInputIntent)).toMatchObject({
      thrust: false,
      rotateLeft: false,
      rotateRight: true,
      shoot: false,
    });
  });

  it('cascades disconnect cleanup through session and ship ownership', () => {
    const world = createTestWorld();
    const client = connectClient(world, 'client-a');
    world.progress(0, 16);

    const session = getSession(client);
    const ship = getShip(session);

    client.destroy();
    world.flush();

    expect(world.getEntity(session.eid)).toBeUndefined();
    expect(world.getEntity(ship.eid)).toBeUndefined();
  });
});
