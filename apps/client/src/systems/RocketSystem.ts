import { world, updatePhase } from '../world';
import {
  Position,
  Velocity,
  Rotation,
  Rocket,
  Alien,
  Asteroid,
} from '../components/index';
import { ENTITY_CONFIG } from '../constants';

const alienQuery = world.query('RocketAliens').requires(Position, Alien);
const asteroidQuery = world
  .query('RocketAsteroids')
  .requires(Position, Asteroid);

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

world
  .system('RocketSystem')
  .requires(Position, Velocity, Rotation, Rocket)
  .phase(updatePhase)
  .each(
    [Position, Velocity, Rotation, Rocket],
    (_e, [pos, vel, rot, rocket]) => {
      if (rocket.straightTimer > 0) {
        rocket.straightTimer--;
        return;
      }

      const range = ENTITY_CONFIG.ROCKET.HOME_RANGE;

      let targetX: number | null = null;
      let targetY: number | null = null;
      let minDist = Infinity;

      for (const ae of alienQuery) {
        const ap = ae.get(Position)!;
        const d = Math.hypot(pos.x - ap.x, pos.y - ap.y);
        if (d < range && d < minDist) {
          minDist = d;
          targetX = ap.x;
          targetY = ap.y;
        }
      }

      if (targetX === null) {
        for (const ae of asteroidQuery) {
          const ap = ae.get(Position)!;
          const d = Math.hypot(pos.x - ap.x, pos.y - ap.y);
          if (d < range && d < minDist) {
            minDist = d;
            targetX = ap.x;
            targetY = ap.y;
          }
        }
      }

      if (targetX === null) return;

      const currentAngle = Math.atan2(vel.vy, vel.vx);
      const targetAngle = Math.atan2(targetY! - pos.y, targetX - pos.x);
      const diff = wrapAngle(targetAngle - currentAngle);
      const turn = Math.max(
        -ENTITY_CONFIG.ROCKET.TURN_RATE,
        Math.min(ENTITY_CONFIG.ROCKET.TURN_RATE, diff),
      );
      const newAngle = currentAngle + turn;

      const speed = ENTITY_CONFIG.ROCKET.SPEED;
      vel.vx = Math.cos(newAngle) * speed;
      vel.vy = Math.sin(newAngle) * speed;
      rot.angle = newAngle;
    },
  );
