import { World } from '@vworlds/vecs';
import { NetworkClient, NetworkInput } from '@vworlds/vecs-server';
import {
  AngularVelocity,
  ENTITY_CONFIG,
  Friction,
  PlayerShip,
  Position,
  Rotation,
  Thrust,
  Velocity,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  Wraps,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { installMovementSystems } from '../../src/game/movement';
import {
  createPlayerShip,
  installPlayerSessionSystems,
  PlayerInputIntent,
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

type ServerWorldLike = Parameters<typeof registerPlayerSessionComponents>[0];

function createTestWorld(): World {
  const world = new World();
  const simulationPhase = world.addPhase('simulation');
  registerPlayerSessionComponents(world as unknown as ServerWorldLike);
  installPlayerSessionSystems(
    world as unknown as Parameters<typeof installPlayerSessionSystems>[0],
    simulationPhase,
  );
  installMovementSystems(
    world as unknown as Parameters<typeof installMovementSystems>[0],
    simulationPhase,
  );
  world.start();
  return world;
}

describe('server movement systems', () => {
  it('applies owner input to ship rotation and thrust at the original frame step', () => {
    const world = createTestWorld();
    world
      .entity()
      .set(NetworkClient, { id: 'client-a' })
      .set(NetworkInput, {
        input: { thrust: true, rotateLeft: false, rotateRight: true },
      });

    world.progress(0, 1000 / 60);
    world.progress(1000 / 60, 1000 / 60);

    let ship = undefined as ReturnType<World['entity']> | undefined;
    world.filter([PlayerShip]).forEach([], (entity) => {
      ship = entity;
    });
    if (!ship) throw new Error('Expected player ship to exist');
    const rotation = ship.get(Rotation)!;
    const velocity = ship.get(Velocity)!;

    expect(rotation.angle).toBeCloseTo(ENTITY_CONFIG.SHIP.ROTATION_SPEED * 2);
    expect(velocity.vx).toBeGreaterThan(0);
    expect(velocity.vy).toBeGreaterThan(0);
  });

  it('integrates velocity and friction for moving entities', () => {
    const world = createTestWorld();
    const entity = world
      .entity()
      .set(Position, { x: 10, y: 20 })
      .set(Velocity, { vx: 3, vy: -2 })
      .set(Friction, { value: 0.5 });
    const modified = vi.spyOn(entity, 'modified');

    world.progress(0, 1000 / 60);

    expect(entity.get(Position)).toMatchObject({ x: 13, y: 18 });
    expect(entity.get(Velocity)).toMatchObject({ vx: 1.5, vy: -1 });
    expect(modified).toHaveBeenCalledWith(Position);
  });

  it('updates angular movement and marks Rotation as modified', () => {
    const world = createTestWorld();
    const entity = world
      .entity()
      .set(Rotation, { angle: 1 })
      .set(AngularVelocity, { omega: 0.25 });
    const modified = vi.spyOn(entity, 'modified');

    world.progress(0, 1000 / 60);

    expect(entity.get(Rotation)!.angle).toBeCloseTo(1.25);
    expect(modified).toHaveBeenCalledWith(Rotation);
  });

  it('wraps positions using shared world bounds', () => {
    const world = createTestWorld();
    const entity = world
      .entity()
      .set(Position, { x: WORLD_WIDTH + 1, y: -1 })
      .add(Wraps);
    const modified = vi.spyOn(entity, 'modified');

    world.progress(0, 1000 / 60);

    expect(entity.get(Position)).toMatchObject({ x: 0, y: WORLD_HEIGHT });
    expect(modified).toHaveBeenCalledWith(Position);
  });

  it('preserves input isolation between owned ships', () => {
    const world = createTestWorld();
    const session = world.entity();
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    ship.set(PlayerInputIntent, { rotateLeft: true });

    world.progress(0, 1000 / 60);

    expect(ship.get(Rotation)!.angle).toBeCloseTo(
      -ENTITY_CONFIG.SHIP.ROTATION_SPEED,
    );
    expect(ship.get(Thrust)!.active).toBe(false);
  });
});
