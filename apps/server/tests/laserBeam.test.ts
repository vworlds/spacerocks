import { describe, expect, it } from 'vitest';
import { LaserWeapon } from '@spacerocks/common';
import { createGameWorld } from '../src/index';
import { createPlayerShip } from '../src/game/modules/playerSessions/factories';
import { PlayerSession } from '../src/game/modules/playerSessions/components';
import { Embellishments } from '../src/game/modules/embellishments/components';

const DT_MS = 1000 / 30;

// Regression: the laser beam render child appears while LaserWeapon.firing is
// true and must DISAPPEAR when the LaserSystem timer expires. LaserSystem
// mutates `firing` via `.each` injection (which does NOT auto-flag modified),
// so it must call ship.modified(LaserWeapon) for the reactive
// `.update(LaserWeapon)` beam embellishment to tear the beam down. Without that
// the beam stays on screen forever even though damage stops.
describe('laser beam lifecycle', () => {
  it('shows the beam while firing and removes it when the timer expires', async () => {
    const world = await createGameWorld();
    let now = 0;
    const step = (n: number): void => {
      for (let i = 0; i < n; i += 1) {
        now += DT_MS;
        world.progress(now, DT_MS);
      }
    };

    const session = world
      .entity()
      .set(PlayerSession, { clientId: 'laser', playerIndex: 0 });
    const ship = createPlayerShip(world, session, 0);

    // Fire the laser with a short timer.
    ship.set(LaserWeapon, { shots: 5, firing: true, timer: 3 });
    step(1);

    // Beam is on while firing.
    expect(ship.get(LaserWeapon)?.firing).toBe(true);
    expect(ship.get(Embellishments)?.laserBeam).toBeDefined();
    const beam = ship.get(Embellishments)!.laserBeam!;
    expect(world.getEntity(beam.eid)).toBeDefined();

    // Run past the timer.
    step(5);

    // Firing stopped AND the beam entity was torn down.
    expect(ship.get(LaserWeapon)?.firing).toBe(false);
    expect(ship.get(Embellishments)?.laserBeam).toBeUndefined();
    expect(world.getEntity(beam.eid)).toBeUndefined();
  });
});
