import { World } from '@vworlds/vecs';
import { phaserNetworkComponents } from '@vworlds/vecs-phaser';
import {
  LinearVelocity,
  Rotation as PhysicsRotation,
} from '@vworlds/vecs-physics';
import { Bullet, COLORS } from '@spacerocks/common';
import { Networked } from '@vworlds/vecs-server';
import { describe, expect, it, vi } from 'vitest';
import { MovementModule } from '../src/game/modules/movement/module';
import { PlayerSessionsModule } from '../src/game/modules/playerSessions/module';
import {
  PlayerInputIntent,
  registerPlayerSessionComponents,
} from '../src/game/modules/playerSessions/components';
import { createPlayerShip } from '../src/game/modules/playerSessions/shipFactory';
import { createBullet } from '../src/game/modules/weapons/factories';
import { registerWeaponsComponents } from '../src/game/modules/weapons/components';
import { RngModule } from '../src/game/modules/rng/module';
import { GameStateModule } from '../src/game/modules/gameState/module';

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
  world.component(Networked);
  world.module(RngModule);
  world.module(GameStateModule);
  registerPlayerSessionComponents(world);
  registerWeaponsComponents(world);
  world.module(PlayerSessionsModule);
  world.module(MovementModule);
  return world;
}

function createShip(world: World) {
  return createPlayerShip(world, world.entity(), 0);
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

    const forwardX = createBullet(world, owner, 0, 0, 0, COLORS.white);
    const velocityX = forwardX.get(LinearVelocity)!;
    expect(velocityX.x).toBeGreaterThan(0);
    expect(Math.abs(velocityX.y)).toBeLessThan(1e-9);

    const forwardY = createBullet(
      world,
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
});
