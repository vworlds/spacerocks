import { type Entity, type World } from '@vworlds/vecs';
import { Position } from '@vworlds/vecs-phaser';
import { COLORS, ENTITY_CONFIG } from '@spacerocks/common';
import { Health } from '../combat/components';
import { Decay } from '../decay/components';
import { createExplosion } from '../gameState/helpers';
import { HealthBar } from '../healthBar/components';

/**
 * Applies damage to an alien's `Health`, destroys it when hp hits zero, and
 * spawns an explosion at the alien's position. Returns whether the alien died
 * this hit.
 *
 * Kept in-tree for cannibalization by Epic 8 (tugbots may reuse the
 * damage/explosion pattern). Unplugged from the world install by E1-T4.
 */
export function damageEnemy(
  world: World,
  enemy: Entity,
  damage: number,
): boolean {
  const health = enemy.getMut(Health);
  if (health) {
    health.hp -= damage;
    enemy.modified(Health);
    enemy.ensureTarget(HealthBar).set(Decay, {
      life: ENTITY_CONFIG.SHIP.HEALTH_BAR_TIMER,
      decay: 1,
    });
    if (health.hp > 0) return false;
  }

  const position = enemy.get(Position);
  if (position)
    createExplosion(world, position.x, position.y, COLORS.orange, 0.15);
  enemy.destroy();
  return true;
}
