import { world, updatePhase, gameState } from '../world';
import {
  Position,
  LaserWeapon,
  Rotation,
  Collider,
  Asteroid,
  Alien,
  DefaultWeapon,
} from '../components/index';
import { distToSegment } from '../utils';
import { createAsteroid } from '../factories/Asteroid';
import { explode } from '../factories/Particle';
import { SCORING } from '../constants';

const LASER_LEN = 1000;

const asteroidQuery = world
  .query('LaserAsteroids')
  .requires(Position, Asteroid, Collider);
const alienOnlyQuery = world
  .query('LaserAlienOnly')
  .requires(Position, Alien, Collider);

world
  .system('LaserSystem')
  .requires(Position, LaserWeapon, Rotation)
  .phase(updatePhase)
  .each([Position, LaserWeapon, Rotation], (e, [pos, laser, rot]) => {
    if (!laser.firing) return;

    laser.timer--;
    if (laser.timer <= 0) {
      laser.firing = false;
      if (laser.shots <= 0) {
        e.remove(LaserWeapon);
        e.add(DefaultWeapon);
      }
      return;
    }

    const v = { x: pos.x, y: pos.y };
    const w = {
      x: pos.x + Math.cos(rot.angle) * LASER_LEN,
      y: pos.y + Math.sin(rot.angle) * LASER_LEN,
    };

    for (const ae of asteroidQuery) {
      const apos = ae.get(Position)!;
      const acol = ae.get(Collider)!;
      const acomp = ae.get(Asteroid)!;
      if (distToSegment({ x: apos.x, y: apos.y }, v, w) < acol.radius) {
        explode(apos.x, apos.y, acomp.color);
        if (acomp.level > 1) {
          const nl = (acomp.level - 1) as 1 | 2;
          createAsteroid(apos.x, apos.y, nl);
          createAsteroid(apos.x, apos.y, nl);
        }
        ae.destroy();
        gameState.score += SCORING.ASTEROID_BASE * acomp.level;
      }
    }

    for (const ale of alienOnlyQuery) {
      const alpos = ale.get(Position)!;
      const alcol = ale.get(Collider)!;
      if (distToSegment({ x: alpos.x, y: alpos.y }, v, w) < alcol.radius) {
        explode(alpos.x, alpos.y, '#ffaa00', 15);
        ale.destroy();
        gameState.score += SCORING.ALIEN;
      }
    }
  });
