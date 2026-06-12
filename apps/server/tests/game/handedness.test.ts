import { World } from '@vworlds/vecs';
import { phaserNetworkComponents, Triangle } from '@vworlds/vecs-phaser';
import {
  LinearVelocity,
  Rotation as PhysicsRotation,
} from '@vworlds/vecs-physics';
import { Bullet, COLORS } from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { installMovementSystems } from '../../src/game/movement';
import {
  createPlayerShip,
  PlayerInputIntent,
  registerPlayerSessionComponents,
} from '../../src/game/playerSessions';
import {
  createBullet,
  registerShootingComponents,
} from '../../src/game/shooting';

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
  registerShootingComponents(
    world as unknown as Parameters<typeof registerShootingComponents>[0],
  );
  installMovementSystems(
    world as unknown as Parameters<typeof installMovementSystems>[0],
  );
  return world;
}

function createShip(world: World) {
  return createPlayerShip(
    world as unknown as Parameters<typeof createPlayerShip>[0],
    world.entity(),
    0,
  );
}

function countBullets(world: World): number {
  let total = 0;
  world.filter([Bullet]).forEach([], () => {
    total += 1;
  });
  return total;
}

describe('server handedness guards', () => {
  it('maps rotate-left to increasing angle and rotate-right to decreasing angle', () => {
    const leftWorld = createTestWorld();
    const leftShip = createShip(leftWorld);
    leftShip.set(PhysicsRotation, { angle: 0 });
    leftShip.set(PlayerInputIntent, { rotateLeft: true });

    leftWorld.progress(0, 1000 / 60);

    // CoordSpace.rot negates angles, so increasing server angle is visual CCW/left.
    expect(leftShip.get(PhysicsRotation)!.angle).toBeGreaterThan(0);

    const rightWorld = createTestWorld();
    const rightShip = createShip(rightWorld);
    rightShip.set(PhysicsRotation, { angle: 0 });
    rightShip.set(PlayerInputIntent, { rotateRight: true });

    rightWorld.progress(0, 1000 / 60);

    expect(rightShip.get(PhysicsRotation)!.angle).toBeLessThan(0);
  });

  it('keeps forward-fire aim self-consistent in +x and +y directions', () => {
    const world = createTestWorld();
    const owner = createShip(world);

    const forwardX = createBullet(
      world as unknown as Parameters<typeof createBullet>[0],
      owner,
      0,
      0,
      0,
      COLORS.white,
    );
    const velocityX = forwardX.get(LinearVelocity)!;
    expect(velocityX.x).toBeGreaterThan(0);
    expect(Math.abs(velocityX.y)).toBeLessThan(1e-9);

    const forwardY = createBullet(
      world as unknown as Parameters<typeof createBullet>[0],
      owner,
      0,
      0,
      Math.PI / 2,
      COLORS.white,
    );
    const velocityY = forwardY.get(LinearVelocity)!;
    expect(velocityY.y).toBeGreaterThan(0);
    expect(Math.abs(velocityY.x)).toBeLessThan(1e-9);

    expect(countBullets(world)).toBe(2);
  });

  it('keeps the ship triangle nose pointing forward on +x', () => {
    const world = createTestWorld();
    const ship = createShip(world);

    expect(ship.get(Triangle)!.x1).toBeGreaterThan(0);
  });
});
