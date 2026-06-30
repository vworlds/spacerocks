import { World } from '@vworlds/vecs';
import {
  LinearVelocity,
  PhysicsModule,
  Rotation as PhysicsRotation,
} from '@vworlds/vecs-physics';
import {
  Bullet,
  COLORS,
  NetworkComponentsModule,
  TICK_RATE,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { registerNetworkFoundation } from './modules/helpers';
import { MovementModule } from '../src/game/modules/movement/module';
import { PlayerSessionsModule } from '../src/game/modules/playerSessions/module';
import { PlayerInputIntent } from '../src/game/modules/playerSessions/components';
import { createPlayerShip } from '../src/game/modules/playerSessions/factories';
import { createBullet } from '../src/game/modules/weapons/factories';
import { Components as WeaponsComponents } from '../src/game/modules/weapons/components';
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
  View: class View {
    dsl: unknown;
  },
}));

function createTestWorld(): World {
  const world = new World();
  world.module(NetworkComponentsModule);
  registerNetworkFoundation(world);
  world.module(RngModule);
  world.module(GameStateModule);
  world.module(WeaponsComponents);
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
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
