import { ChildOf, World, type Entity } from '@vworlds/vecs';
import { NetworkClient, NetworkInput } from '@vworlds/vecs-server';
import {
  phaserNetworkComponents,
  Position,
  Triangle,
} from '@vworlds/vecs-phaser';
import {
  PLAYER_COLORS,
  PlayerShip,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import {
  installPlayerSessionSystems,
  PlayerInputIntent,
  PlayerSession,
  registerPlayerSessionComponents,
} from '../../src/game/playerSessions';

vi.mock('@vworlds/vecs-server', () => ({
  NetworkClient: class NetworkClient {
    id = '';
  },
  NetworkInput: class NetworkInput {
    input: unknown;
  },
  Networked: class Networked {},
}));

type PlayerSessionWorld = Parameters<typeof registerPlayerSessionComponents>[0];

function createTestWorld(): World {
  const world = new World();
  for (const component of phaserNetworkComponents) world.component(component);
  registerPlayerSessionComponents(world as unknown as PlayerSessionWorld);
  installPlayerSessionSystems(
    world as unknown as Parameters<typeof installPlayerSessionSystems>[0],
  );
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
    const positionA = shipA.get(Position)!;
    const positionB = shipB.get(Position)!;

    expect(shipA).not.toBe(shipB);
    expect(playerShipA.playerIndex).toBe(0);
    expect(playerShipB.playerIndex).toBe(1);
    expect(playerShipA.color).not.toBe(playerShipB.color);
    expect(positionA).not.toEqual(positionB);
    expect(positionA.x).toBeGreaterThanOrEqual(WORLD_MIN_X);
    expect(positionA.x).toBeLessThanOrEqual(WORLD_MAX_X);
    expect(positionB.y).toBeGreaterThanOrEqual(WORLD_MIN_Y);
    expect(positionB.y).toBeLessThanOrEqual(WORLD_MAX_Y);
    expect(playerShipA.color).toBe(PLAYER_COLORS[0]);
    expect(shipA.get(Triangle)).toMatchObject({
      x1: 0.15,
      y1: 0,
      x2: -0.1,
      y2: 0.1,
      x3: -0.1,
      y3: -0.1,
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
