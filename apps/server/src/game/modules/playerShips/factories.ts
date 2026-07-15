import { ChildOf, type Entity, type World } from '@vworlds/vecs';
import { Networked } from '@vworlds/vecs-server';
import {
  Image,
  Position as RenderPosition,
  Rotation as RenderRotation,
  Size,
  Tint,
} from '@vworlds/vecs-phaser';
import {
  Body,
  BodyType,
  Circle,
  CollisionFilter,
  Damping,
  Force,
  LinearVelocity,
  Material,
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  CAT_ASTEROID,
  CAT_BOOMERANG,
  CAT_ENEMY,
  CAT_ENEMY_BULLET,
  CAT_PICKUP,
  CAT_PLAYER,
  ENTITY_CONFIG,
  Hyperspace,
  Owner,
  PLAYER_COLORS,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from '@spacerocks/common';
import { pickShipSprite, SHIP_SPRITE_SIZE_METERS } from '../assets/sprite';
import { Health } from '../combat/components';
import { Wraps } from '../movement/components';
import { PlayerInputIntent, PlayerSession } from '../playerSessions/components';
import { DefaultWeapon } from '../weapons/components';
import { PlayerShip } from './components';

const SPAWN_POSITIONS = [
  { x: -VIEWPORT_WIDTH * 0.2, y: 0 },
  { x: VIEWPORT_WIDTH * 0.2, y: 0 },
  { x: 0, y: VIEWPORT_HEIGHT * 0.2 },
  { x: 0, y: -VIEWPORT_HEIGHT * 0.2 },
] as const;

export function createPlayerShip(
  world: World,
  session: Entity,
  playerIndex: number,
  ownerClientId?: string,
): Entity {
  const spawn = SPAWN_POSITIONS[playerIndex % SPAWN_POSITIONS.length]!;
  const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length]!;
  const categoryBits = CAT_PLAYER;
  const clientId = ownerClientId ?? session.get(PlayerSession)?.clientId ?? '';
  const maskBits =
    CAT_ASTEROID | CAT_ENEMY_BULLET | CAT_ENEMY | CAT_PICKUP | CAT_BOOMERANG;
  const shapeDensity =
    ENTITY_CONFIG.SHIP.MASS /
    (Math.PI * ENTITY_CONFIG.SHIP.RADIUS * ENTITY_CONFIG.SHIP.RADIUS);

  const ship = world
    .entity()
    .add(Networked)
    .set(ChildOf, { target: session })
    .set(Body, { type: BodyType.Dynamic })
    .set(Damping, {
      linear: ENTITY_CONFIG.SHIP.LINEAR_DAMPING,
      angular: ENTITY_CONFIG.SHIP.ANGULAR_DAMPING,
    })
    .set(Force, { x: 0, y: 0 })
    .set(PhysicsPosition, { x: spawn.x, y: spawn.y })
    .set(PhysicsRotation, { angle: 0 })
    .set(LinearVelocity, { x: 0, y: 0 })
    .set(RenderPosition, { x: spawn.x, y: spawn.y })
    .set(RenderRotation, { angle: 0 })
    .set(Health, {
      hp: ENTITY_CONFIG.SHIP.MAX_HP,
      maxHp: ENTITY_CONFIG.SHIP.MAX_HP,
    })
    .add(DefaultWeapon)
    .set(PlayerInputIntent, {})
    .set(PlayerShip, { playerIndex, color })
    .set(Owner, { clientId })
    .set(Hyperspace, { seq: 0 })
    .add(Wraps)
    .set(Image, pickShipSprite(world))
    .set(Size, {
      width: SHIP_SPRITE_SIZE_METERS,
      height: SHIP_SPRITE_SIZE_METERS,
    })
    .set(Tint, { value: color } as Tint);

  world
    .entity()
    .childOf(ship)
    .set(Circle, { radius: ENTITY_CONFIG.SHIP.RADIUS })
    .set(Material, { density: shapeDensity, friction: 0 })
    .set(CollisionFilter, {
      categoryBits,
      maskBits: CAT_ASTEROID,
    });

  world
    .entity()
    .childOf(ship)
    .set(Circle, { radius: ENTITY_CONFIG.SHIP.RADIUS + 0.01 })
    .add(Sensor)
    .add(SensorEvents)
    .set(CollisionFilter, {
      categoryBits,
      maskBits,
    });

  return ship;
}

export { SPAWN_POSITIONS };
