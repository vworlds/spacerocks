import { type Entity, type World } from '@vworlds/vecs';
import {
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
  physics,
} from '@vworlds/vecs-physics';
import {
  Alien,
  Asteroid,
  CAT_ASTEROID,
  CAT_ENEMY,
  ENTITY_CONFIG,
} from '@spacerocks/common';
import { ChildOf } from '@vworlds/vecs';

export function findNearestPlayer(
  players: Iterable<Entity>,
  source: PhysicsPosition,
): { x: number; y: number } | undefined {
  let target: { x: number; y: number } | undefined;
  let minDistance = Infinity;

  for (const player of players) {
    const position = player.get(PhysicsPosition);
    if (!position) continue;

    const distance = Math.hypot(source.x - position.x, source.y - position.y);
    if (distance > ENTITY_CONFIG.ALIEN.TARGET_DIST_MAX) continue;
    if (distance >= minDistance) continue;
    minDistance = distance;
    target = { x: position.x, y: position.y };
  }

  return target;
}

export function findRocketTarget(
  world: World,
  position: PhysicsPosition,
): { x: number; y: number } | undefined {
  const alienTarget = findNearest(world, position, CAT_ENEMY, Alien);
  return alienTarget ?? findNearest(world, position, CAT_ASTEROID, Asteroid);
}

export function findNearest(
  world: World,
  source: PhysicsPosition,
  maskBits: number,
  component: typeof Alien | typeof Asteroid,
): { x: number; y: number } | undefined {
  let target: { x: number; y: number } | undefined;
  let minDistance = Infinity;

  const shapes = physics(world).overlapCircle({
    center: { x: source.x, y: source.y },
    radius: ENTITY_CONFIG.ROCKET.HOME_RANGE,
    filter: { maskBits },
  });

  for (const shape of shapes) {
    const body = shape.target(ChildOf);
    if (!body || !body.get(component)) continue;
    const position = body.get(PhysicsPosition);
    if (!position) continue;

    const distance = Math.hypot(source.x - position.x, source.y - position.y);
    if (distance >= minDistance) continue;
    minDistance = distance;
    target = { x: position.x, y: position.y };
  }

  return target;
}

export function rotateTowardTarget(
  entity: Entity,
  rotation: PhysicsRotation,
  targetAngle: number,
): boolean {
  const diff = wrapAngle(targetAngle - rotation.angle);
  const turn = Math.max(
    -ENTITY_CONFIG.ALIEN.ROTATION_SPEED,
    Math.min(ENTITY_CONFIG.ALIEN.ROTATION_SPEED, diff),
  );

  if (Math.abs(turn) > 0) {
    rotation.angle = wrapAngle(rotation.angle + turn);
    entity.modified(PhysicsRotation);
  }

  return (
    Math.abs(wrapAngle(targetAngle - rotation.angle)) <=
    ENTITY_CONFIG.ALIEN.FIRE_ANGLE
  );
}

export function wrapAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}
