import { type Entity, type World } from '@vworlds/vecs';
import { Position } from '@vworlds/vecs-phaser';
import { COLORS, ENTITY_CONFIG, SCORING } from '@spacerocks/common';
import { Health } from '../combat/components';
import { addScore, createExplosion } from '../gameState/helpers';

/**
 * Applies damage to an alien's `Health`, destroys it and scores when hp hits
 * zero, and spawns an explosion at the alien's position. Returns whether the
 * alien died this hit.
 */
export function damageEnemy(
  world: World,
  enemy: Entity,
  damage: number,
): boolean {
  const health = enemy.getMut(Health);
  if (health) {
    health.hp -= damage;
    health.healthBarTimer = ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER;
    enemy.modified(Health);
    if (health.hp > 0) return false;
  }

  const position = enemy.get(Position);
  if (position)
    createExplosion(world, position.x, position.y, COLORS.orange, 0.15);
  enemy.destroy();
  addScore(world, SCORING.ALIEN);
  return true;
}
