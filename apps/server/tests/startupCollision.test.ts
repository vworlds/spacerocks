import { describe, expect, it } from 'vitest';
import { Position as PhysicsPosition } from '@vworlds/vecs-physics';
import { Asteroid } from '@spacerocks/common';
import { createGameWorld } from '../src/index';
import { createBullet } from '../src/game/modules/weapons/factories';
import { createPlayerShip } from '../src/game/modules/playerSessions/shipFactory';
import { PlayerSession } from '../src/game/modules/playerSessions/components';

const DT_MS = 1000 / 30;

// Regression for the startup collision bug: the initial asteroids were spawned BEFORE
// PhysicsModule was installed, so those asteroids never got working Box2D sensor
// shapes. PhysicsModule is now installed before the spawning systems; this
// proves a startup asteroid is collidable.
describe('startup asteroid physics collision', () => {
  it('lets a bullet destroy a startup asteroid', async () => {
    const world = await createGameWorld();
    let now = 0;
    const step = (n: number): void => {
      for (let i = 0; i < n; i += 1) {
        now += DT_MS;
        world.progress(now, DT_MS);
      }
    };

    step(2);

    // Grab one of the startup asteroids.
    let asteroid: ReturnType<typeof createBullet> | undefined;
    world.filter([Asteroid, PhysicsPosition]).forEach([], (entity) => {
      asteroid ??= entity;
    });
    expect(asteroid).toBeDefined();
    const pos = asteroid!.get(PhysicsPosition)!;

    // Fire a bullet right on top of it.
    const session = world
      .entity()
      .set(PlayerSession, { clientId: 'test', playerIndex: 0 });
    const ship = createPlayerShip(world, session, 0);
    createBullet(world, ship, pos.x, pos.y, 0, 0xffffff);

    const asteroidEid = asteroid!.eid;
    step(6);

    // The startup asteroid must have been hit (destroyed / split).
    expect(world.getEntity(asteroidEid)).toBeUndefined();
  });
});
