import { ChildOf, World } from '@vworlds/vecs';
import { NetworkClient, NetworkInput } from '@vworlds/vecs-server';
import { phaserNetworkComponents } from '@vworlds/vecs-phaser';
import {
  AngularVelocity as PhysicsAngularVelocity,
  Body,
  BodyType,
  Circle,
  CollisionFilter,
  Damping,
  Force,
  LinearVelocity,
  Material,
  PhysicsModule,
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  ENTITY_CONFIG,
  PlayerShip,
  TICK_RATE,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
  Wraps,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { installMovementSystems } from '../../src/game/movement';
import {
  createPlayerShip,
  installPlayerSessionSystems,
  PlayerInputIntent,
  registerPlayerSessionComponents,
} from '../../src/game/playerSessions';

vi.mock('@vworlds/vecs-server', () => ({
  NetworkClient: class NetworkClient {
    id = '';
  },
  NetworkInput: class NetworkInput {
    input: unknown;
  },
  Networked: class Networked {},
}));

type ServerWorldLike = Parameters<typeof registerPlayerSessionComponents>[0];

function createTestWorld(): World {
  const world = new World();
  for (const component of phaserNetworkComponents) world.component(component);
  registerPlayerSessionComponents(world as unknown as ServerWorldLike);
  installPlayerSessionSystems(
    world as unknown as Parameters<typeof installPlayerSessionSystems>[0],
  );
  installMovementSystems(
    world as unknown as Parameters<typeof installMovementSystems>[0],
  );
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
  return world;
}

function addPhysicsShape(
  world: World,
  body: ReturnType<World['entity']>,
): void {
  world
    .entity()
    .set(ChildOf, { target: body })
    .set(Circle, { radius: 0.1 })
    .add(Sensor)
    .add(SensorEvents)
    .set(CollisionFilter, { categoryBits: 1, maskBits: 1 });
}

function stepTicks(world: World, ticks: number): void {
  for (let tick = 0; tick < ticks; tick += 1) {
    world.progress(tick * (1000 / TICK_RATE), 1000 / TICK_RATE);
  }
}

describe('server movement systems', () => {
  it('applies owner input to ship rotation and thrust force at the original frame step', () => {
    const world = createTestWorld();
    world
      .entity()
      .set(NetworkClient, { id: 'client-a' })
      .set(NetworkInput, {
        input: { thrust: true, rotateLeft: false, rotateRight: true },
      });

    world.progress(0, 1000 / 60);
    world.progress(1000 / 60, 1000 / 60);

    let ship = undefined as ReturnType<World['entity']> | undefined;
    world.filter([PlayerShip]).forEach([], (entity) => {
      ship = entity;
    });
    if (!ship) throw new Error('Expected player ship to exist');
    const rotation = ship.get(PhysicsRotation)!;
    const velocity = ship.get(LinearVelocity)!;
    const force = ship.get(Force)!;

    expect(rotation.angle).toBeCloseTo(-ENTITY_CONFIG.SHIP.ROTATION_SPEED * 2);
    expect(force.x).toBeGreaterThan(0);
    expect(force.y).toBeLessThan(0);
    expect(velocity.x).toBeGreaterThan(0);
    expect(velocity.y).toBeLessThan(0);
  });

  it('accelerates and moves a continuously-thrusting ship at visible per-second speed', () => {
    const world = createTestWorld();
    const session = world.entity();
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    ship.set(PhysicsPosition, { x: 0, y: 0 });
    ship.set(PlayerInputIntent, { thrust: true });

    stepTicks(world, TICK_RATE);

    const oneSecondVelocity = ship.get(LinearVelocity)!;
    expect(oneSecondVelocity.x).toBeGreaterThan(1);
    expect(oneSecondVelocity.x).toBeLessThan(3);
    expect(Math.abs(oneSecondVelocity.y)).toBeLessThan(1e-9);

    stepTicks(world, Math.round(TICK_RATE / 2));

    expect(ship.get(PhysicsPosition)!.x).toBeGreaterThan(1);
    expect(
      ENTITY_CONFIG.SHIP.THRUST_FORCE / ENTITY_CONFIG.SHIP.MASS,
    ).toBeCloseTo(3.6);
  });

  it('integrates physics velocity and applies ship damping', () => {
    const world = createTestWorld();
    const drifting = world
      .entity()
      .set(Body, { type: BodyType.Dynamic })
      .set(PhysicsPosition, { x: 1, y: 2 })
      .set(LinearVelocity, { x: 3, y: -2 });
    addPhysicsShape(world, drifting);

    const session = world.entity();
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    ship.set(LinearVelocity, { x: 10, y: -5 });

    world.progress(0, 1000 / 60);

    expect(drifting.get(PhysicsPosition)!.x).toBeGreaterThan(1);
    expect(drifting.get(PhysicsPosition)!.y).toBeLessThan(2);
    expect(ship.get(LinearVelocity)!.x).toBeLessThan(10);
    expect(ship.get(LinearVelocity)!.x).toBeGreaterThan(9);
    expect(ship.get(LinearVelocity)!.y).toBeGreaterThan(-5);
    expect(ship.get(LinearVelocity)!.y).toBeLessThan(-4);
  });

  it('creates ships with physics mass, damping, a solid body, and a sensor shape', () => {
    const world = createTestWorld();
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      world.entity(),
      0,
    );
    const shapes = [...ship.children(ChildOf)].filter((child) =>
      child.get(Circle),
    );
    const solid = shapes.find((child) => child.get(Material));
    const sensor = shapes.find((child) => child.get(Sensor));
    const material = solid?.get(Material);

    expect(ship.get(Body)?.type).toBe(BodyType.Dynamic);
    expect(ship.get(Damping)).toMatchObject({
      linear: ENTITY_CONFIG.SHIP.LINEAR_DAMPING,
      angular: ENTITY_CONFIG.SHIP.ANGULAR_DAMPING,
    });
    expect(ship.get(Force)).toMatchObject({ x: 0, y: 0 });
    expect(shapes).toHaveLength(2);
    expect(sensor?.get(Sensor)).toBeTruthy();
    expect(sensor?.get(SensorEvents)).toBeTruthy();
    expect(material?.density).toBeCloseTo(
      ENTITY_CONFIG.SHIP.MASS /
        (Math.PI * ENTITY_CONFIG.SHIP.RADIUS * ENTITY_CONFIG.SHIP.RADIUS),
    );
  });

  it('integrates physics angular velocity', () => {
    const world = createTestWorld();
    const entity = world
      .entity()
      .set(Body, { type: BodyType.Dynamic })
      .set(PhysicsPosition, { x: 0, y: 0 })
      .set(PhysicsRotation, { angle: 1 })
      .set(PhysicsAngularVelocity, { value: 0.25 });
    addPhysicsShape(world, entity);

    world.progress(0, 1000 / 60);

    expect(entity.get(PhysicsRotation)!.angle).toBeGreaterThan(1);
  });

  it('wraps positions using shared world bounds', () => {
    const world = createTestWorld();
    const entity = world
      .entity()
      .set(PhysicsPosition, { x: WORLD_MAX_X + 1, y: WORLD_MIN_Y - 1 })
      .add(Wraps);
    const modified = vi.spyOn(entity, 'modified');

    world.progress(0, 1000 / 60);

    expect(entity.get(PhysicsPosition)).toMatchObject({
      x: WORLD_MIN_X,
      y: WORLD_MAX_Y,
    });
    expect(modified).toHaveBeenCalledWith(PhysicsPosition);
  });

  it('preserves input isolation between owned ships', () => {
    const world = createTestWorld();
    const session = world.entity();
    const ship = createPlayerShip(
      world as unknown as Parameters<typeof createPlayerShip>[0],
      session,
      0,
    );
    ship.set(PlayerInputIntent, { rotateLeft: true });

    world.progress(0, 1000 / 60);

    expect(ship.get(PhysicsRotation)!.angle).toBeCloseTo(
      ENTITY_CONFIG.SHIP.ROTATION_SPEED,
    );
    expect(ship.get(LinearVelocity)).toMatchObject({ x: 0, y: 0 });
    expect(ship.get(Force)).toMatchObject({ x: 0, y: 0 });
  });
});
