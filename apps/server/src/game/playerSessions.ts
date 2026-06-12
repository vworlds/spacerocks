import { ChildOf, CleanupPolicy, type Entity } from '@vworlds/vecs';
import {
  NetworkClient,
  NetworkInput,
  Networked,
  type ServerWorld,
} from '@vworlds/vecs-server';
import {
  Position as RenderPosition,
  Rotation as RenderRotation,
  StrokeStyle,
  Triangle,
} from '@vworlds/vecs-phaser';
import {
  Body,
  BodyType,
  Circle,
  CollisionFilter,
  AngularVelocity as PhysicsAngularVelocity,
  LinearVelocity,
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
  DefaultWeapon,
  ENTITY_CONFIG,
  Health,
  HealthView,
  PlayerShip,
  Shield,
  ShieldView,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  Wraps,
  PLAYER_COLORS,
} from '@spacerocks/common';

export class PlayerSession {
  clientId = '';
  playerIndex = 0; // player index
}

export class PlayerInputIntent {
  thrust = false;
  rotateLeft = false;
  rotateRight = false;
  shoot = false;
}

const SPAWN_POSITIONS = [
  { x: -WORLD_WIDTH * 0.2, y: 0 },
  { x: WORLD_WIDTH * 0.2, y: 0 },
  { x: 0, y: WORLD_HEIGHT * 0.2 },
  { x: 0, y: -WORLD_HEIGHT * 0.2 },
] as const;

export function registerPlayerSessionComponents(world: ServerWorld): void {
  world.component(NetworkClient);
  world.component(NetworkInput);
  world.component(PlayerSession);
  world.component(PlayerInputIntent);
  world.component(ChildOf).meta.onDeleteTarget = CleanupPolicy.Delete;
  world.component(Networked);
  world.component(Health);
  world.component(HealthView);
  world.component(Shield);
  world.component(ShieldView);
  world.component(DefaultWeapon);
  world.component(Wraps);
  world.component(PlayerShip);
  world.component(Body);
  world.component(PhysicsPosition);
  world.component(PhysicsRotation);
  world.component(LinearVelocity);
  world.component(PhysicsAngularVelocity);
  world.component(Circle);
  world.component(Sensor);
  world.component(SensorEvents);
  world.component(CollisionFilter);
}

export function installPlayerSessionSystems(world: ServerWorld): void {
  let nextPlayerIndex = 0;

  world
    .system('CreatePlayerSession')
    .with(NetworkClient)
    .enter([NetworkClient], (clientEntity, [client]) => {
      const playerIndex = nextPlayerIndex++;
      console.info(
        `[srv] CreatePlayerSession enter client=${client.id} index=${playerIndex}`,
      );
      const session = world
        .entity()
        .set(PlayerSession, { clientId: client.id, playerIndex })
        .set(ChildOf, { target: clientEntity });

      createPlayerShip(world, session, playerIndex);
    })
    .exit([NetworkClient], (_clientEntity, [client]) => {
      console.info(`[srv] CreatePlayerSession exit client=${client.id}`);
    });

  world
    .system('ApplyNetworkInputToOwnedShip')
    .with(NetworkClient, NetworkInput)
    .each([NetworkInput], (clientEntity, [networkInput]) => {
      const ship = getOwnedShip(clientEntity);
      if (!ship) return;

      const intent = ship.getMut(PlayerInputIntent);
      if (!intent) return;

      const input = parseInputIntent(networkInput.input);
      intent.thrust = input.thrust;
      intent.rotateLeft = input.rotateLeft;
      intent.rotateRight = input.rotateRight;
      intent.shoot = input.shoot;
    });
}

export function createPlayerShip(
  world: ServerWorld,
  session: Entity,
  playerIndex: number,
): Entity {
  const spawn = SPAWN_POSITIONS[playerIndex % SPAWN_POSITIONS.length]!;
  const color = PLAYER_COLORS[playerIndex % PLAYER_COLORS.length]!;
  const categoryBits = CAT_PLAYER;
  const maskBits =
    CAT_ASTEROID | CAT_ENEMY_BULLET | CAT_ENEMY | CAT_PICKUP | CAT_BOOMERANG;

  const ship = world
    .entity()
    .add(Networked)
    .set(ChildOf, { target: session })
    .set(Body, { type: BodyType.Dynamic })
    .set(PhysicsPosition, { x: spawn.x, y: spawn.y })
    .set(PhysicsRotation, { angle: 0 })
    .set(LinearVelocity, { x: 0, y: 0 })
    .set(RenderPosition, { x: spawn.x, y: spawn.y })
    .set(RenderRotation, { angle: 0 })
    .set(Health, {
      hp: ENTITY_CONFIG.SHIP.MAX_HP,
      maxHp: ENTITY_CONFIG.SHIP.MAX_HP,
      healthBarTimer: 0,
    })
    .set(HealthView, {
      hp: ENTITY_CONFIG.SHIP.MAX_HP,
      maxHp: ENTITY_CONFIG.SHIP.MAX_HP,
      barTimer: 0,
    })
    .add(DefaultWeapon)
    .set(PlayerInputIntent, {})
    .set(PlayerShip, { playerIndex, color })
    .add(Wraps)
    .set(StrokeStyle, { color, alpha: 1, width: 2 })
    .set(Triangle, {
      x1: 0.15,
      y1: 0,
      x2: -0.1,
      y2: 0.1,
      x3: -0.1,
      y3: -0.1,
    });

  world
    .entity()
    .childOf(ship)
    .set(Circle, { radius: ENTITY_CONFIG.SHIP.RADIUS })
    .add(Sensor)
    .add(SensorEvents)
    .set(CollisionFilter, {
      categoryBits,
      maskBits,
    });

  return ship;
}

function getOwnedShip(clientEntity: Entity): Entity | undefined {
  for (const session of clientEntity.children(ChildOf)) {
    if (!session.get(PlayerSession)) continue;

    for (const ship of session.children(ChildOf)) {
      if (ship.get(PlayerShip)) return ship;
    }
  }

  return undefined;
}

function parseInputIntent(input: unknown): PlayerInputIntent {
  const intent = new PlayerInputIntent();
  if (typeof input !== 'object' || input === null) return intent;

  const record = input as Partial<Record<keyof PlayerInputIntent, unknown>>;
  intent.thrust = record.thrust === true;
  intent.rotateLeft = record.rotateLeft === true;
  intent.rotateRight = record.rotateRight === true;
  intent.shoot = record.shoot === true;
  return intent;
}
