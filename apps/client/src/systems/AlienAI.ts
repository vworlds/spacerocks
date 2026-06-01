import { world, updatePhase } from '../world';
import {
  Position,
  Velocity,
  Alien,
  Rotation,
  Asteroid,
  Player,
} from '../components/index';
import { createBullet } from '../factories/Bullet';
import {
  CAT_ENEMY_BULLET,
  CAT_PLAYER,
  CAT_ASTEROID,
  ENTITY_CONFIG,
} from '../constants';
import type { Entity } from '@vworlds/vecs';

const asteroidQuery = world.query('AIAsteroids').requires(Position, Asteroid);
const playerQuery = world.query('AIPlayers').requires(Position, Player);

world
  .system('AlienAI')
  .requires(Position, Velocity, Alien, Rotation)
  .phase(updatePhase)
  .each([Position, Velocity, Alien, Rotation], (e, [pos, vel, alien, rot]) => {
    rot.angle += 0.05;
    alien.shootCooldown--;

    // Find closest asteroid
    let closestAst: Entity | null = null;
    let minAstDist = Infinity;
    for (const ae of asteroidQuery) {
      const ap = ae.get(Position)!;
      const d = Math.hypot(pos.x - ap.x, pos.y - ap.y);
      if (d < minAstDist) {
        minAstDist = d;
        closestAst = ae;
      }
    }

    if (
      closestAst !== null &&
      minAstDist < ENTITY_CONFIG.ALIEN.ASTEROID_AVOID_DIST
    ) {
      const ap = closestAst.get(Position)!;
      const angleToAst = Math.atan2(ap.y - pos.y, ap.x - pos.x);
      if (Math.random() < 0.5) {
        vel.vx += Math.cos(angleToAst + Math.PI) * 0.1;
        vel.vy += Math.sin(angleToAst + Math.PI) * 0.1;
      } else if (alien.shootCooldown <= 0) {
        createBullet(
          pos.x,
          pos.y,
          angleToAst,
          '#ffaa00',
          'alien',
          CAT_ENEMY_BULLET,
          CAT_PLAYER | CAT_ASTEROID,
        );
        alien.shootCooldown = 30;
      }
      return;
    }

    if (alien.shootCooldown <= 0) {
      let closestPlayer: Entity | null = null;
      let minDist = Infinity;
      for (const pe of playerQuery) {
        const pp = pe.get(Position)!;
        const d = Math.hypot(pos.x - pp.x, pos.y - pp.y);
        if (d < minDist) {
          minDist = d;
          closestPlayer = pe;
        }
      }
      if (
        closestPlayer !== null &&
        minDist < ENTITY_CONFIG.ALIEN.TARGET_DIST_MAX
      ) {
        const pp = closestPlayer.get(Position)!;
        createBullet(
          pos.x,
          pos.y,
          Math.atan2(pp.y - pos.y, pp.x - pos.x),
          '#ffaa00',
          'alien',
          CAT_ENEMY_BULLET,
          CAT_PLAYER | CAT_ASTEROID,
        );
        alien.shootCooldown =
          ENTITY_CONFIG.ALIEN.SHOOT_COOLDOWN_BASE +
          Math.random() * ENTITY_CONFIG.ALIEN.SHOOT_COOLDOWN_RANGE;
      } else {
        alien.shootCooldown = ENTITY_CONFIG.ALIEN.SHOOT_COOLDOWN_BASE;
      }
    }
  });
