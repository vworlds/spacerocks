import { ChildOf, CleanupPolicy, type Entity } from '@vworlds/vecs';
import {
  NetworkClient,
  NetworkInput,
  Networked,
  type ServerWorld,
} from '@vworlds/vecs-server';
import {
  CAT_ASTEROID,
  CAT_BOOMERANG,
  CAT_ENEMY,
  CAT_ENEMY_BULLET,
  CAT_PICKUP,
  CAT_PLAYER,
  AngularVelocity,
  DefaultWeapon,
  Drawable,
  ENTITY_CONFIG,
  Friction,
  Health,
  HealthView,
  PlayerShip,
  Point,
  Position,
  Rotation,
  Shape,
  Shield,
  ShieldView,
  StrokeStyle,
  Thrust,
  Velocity,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  Wraps,
  Collider,
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

const PLAYER_COLORS = ['#00ffcc', '#ff00ff', '#ffff66', '#66aaff'] as const;

const SPAWN_POSITIONS = [
  { x: WORLD_WIDTH * 0.3, y: WORLD_HEIGHT * 0.5 },
  { x: WORLD_WIDTH * 0.7, y: WORLD_HEIGHT * 0.5 },
  { x: WORLD_WIDTH * 0.5, y: WORLD_HEIGHT * 0.3 },
  { x: WORLD_WIDTH * 0.5, y: WORLD_HEIGHT * 0.7 },
] as const;

export function registerPlayerSessionComponents(world: ServerWorld): void {
  world.component(NetworkClient);
  world.component(NetworkInput);
  world.component(PlayerSession);
  world.component(PlayerInputIntent);
  world.component(ChildOf).meta.onDeleteTarget = CleanupPolicy.Delete;
  world.component(Networked);
  world.component(Position);
  world.component(Velocity);
  world.component(AngularVelocity);
  world.component(Rotation);
  world.component(Thrust);
  world.component(Friction);
  world.component(Health);
  world.component(HealthView);
  world.component(Shield);
  world.component(ShieldView);
  world.component(DefaultWeapon);
  world.component(Collider);
  world.component(Drawable);
  world.component(Wraps);
  world.component(StrokeStyle);
  world.component(Shape);
  world.component(PlayerShip);
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

  return world
    .entity()
    .add(Networked)
    .set(ChildOf, { target: session })
    .set(Position, { x: spawn.x, y: spawn.y })
    .add(Velocity)
    .set(Rotation, { angle: 0 })
    .set(Thrust, { force: ENTITY_CONFIG.SHIP.THRUST_POWER, active: false })
    .set(Friction, { value: ENTITY_CONFIG.SHIP.FRICTION })
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
    .set(Collider, {
      radius: ENTITY_CONFIG.SHIP.RADIUS,
      category: CAT_PLAYER,
      mask:
        CAT_ASTEROID |
        CAT_ENEMY_BULLET |
        CAT_ENEMY |
        CAT_PICKUP |
        CAT_BOOMERANG,
    })
    .set(PlayerInputIntent, {})
    .set(PlayerShip, { playerIndex, color })
    .set(Drawable, { zIndex: 60 })
    .add(Wraps)
    .set(StrokeStyle, { style: color, lineWidth: 2 })
    .set(Shape, {
      points: [new Point(15, 0), new Point(-10, 10), new Point(-10, -10)],
    });
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
