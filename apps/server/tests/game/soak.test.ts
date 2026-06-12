import { ChildOf, type ComponentClass, type Entity } from '@vworlds/vecs';
import { NetworkClient, NetworkInput } from '@vworlds/vecs-server';
import {
  Position as RenderPosition,
  Rotation as RenderRotation,
} from '@vworlds/vecs-phaser';
import {
  Body,
  Circle,
  LinearVelocity,
  Position as PhysicsPosition,
  Rotation as PhysicsRotation,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import {
  Asteroid,
  Bullet,
  Explosion,
  GameStateView,
  PlayerShip,
  TICK_RATE,
} from '@spacerocks/common';
import { describe, expect, it } from 'vitest';
import { PlayerSession } from '../../src/game/playerSessions';
import { createPrng } from '../../src/game/rng';
import { createAsteroid } from '../../src/game/spawning';
import { createGameWorld } from '../../src/game/world';

const DT_MS = 1000 / TICK_RATE;

type GameWorld = Awaited<ReturnType<typeof createGameWorld>>;

function connectClient(
  world: GameWorld,
  id: string,
  input: unknown = {},
): Entity {
  return world.entity().set(NetworkClient, { id }).set(NetworkInput, { input });
}

function getSession(client: Entity): Entity {
  const sessions = [...client.children(ChildOf)].filter((entity) =>
    entity.get(PlayerSession),
  );
  expect(sessions).toHaveLength(1);
  return sessions[0]!;
}

function getShip(session: Entity): Entity {
  const ships = [...session.children(ChildOf)].filter((entity) =>
    entity.get(PlayerShip),
  );
  expect(ships).toHaveLength(1);
  return ships[0]!;
}

function setClientInput(client: Entity, input: unknown): void {
  if (!client.get(NetworkInput))
    throw new Error('Expected NetworkInput on client');
  client.set(NetworkInput, { input });
}

function entitiesWith(world: GameWorld, component: ComponentClass): Entity[] {
  const entities: Entity[] = [];
  world.filter([component]).forEach([], (entity) => {
    entities.push(entity);
  });
  return entities;
}

function count(world: GameWorld, component: ComponentClass): number {
  return entitiesWith(world, component).length;
}

function getGameState(world: GameWorld): GameStateView {
  const state = entitiesWith(world, GameStateView)[0]?.get(GameStateView);
  if (!state) throw new Error('Expected GameStateView entity');
  return state;
}

function assertFiniteVector(
  entity: Entity,
  componentName: string,
  vector: { x: number; y: number },
): void {
  expect(Number.isFinite(vector.x), `${componentName}.x on ${entity.eid}`).toBe(
    true,
  );
  expect(Number.isFinite(vector.y), `${componentName}.y on ${entity.eid}`).toBe(
    true,
  );
}

function assertFinitePhysicsState(world: GameWorld): void {
  for (const entity of entitiesWith(world, PhysicsPosition)) {
    const position = entity.get(PhysicsPosition)!;
    assertFiniteVector(entity, 'PhysicsPosition', position);
  }
  for (const entity of entitiesWith(world, RenderPosition)) {
    const position = entity.get(RenderPosition)!;
    assertFiniteVector(entity, 'RenderPosition', position);
  }
  for (const entity of entitiesWith(world, LinearVelocity)) {
    const velocity = entity.get(LinearVelocity)!;
    assertFiniteVector(entity, 'LinearVelocity', velocity);
  }
}

function assertShipPhysicsShape(ship: Entity): void {
  expect(ship.get(Body)).toBeTruthy();
  const shape = [...ship.children(ChildOf)].find((child) => child.get(Circle));
  expect(shape?.get(Circle)?.radius).toBeGreaterThan(0);
  expect(shape?.get(Sensor)).toBeTruthy();
  expect(shape?.get(SensorEvents)).toBeTruthy();
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function seedDeterministicTarget(world: GameWorld, ship: Entity): void {
  const shipPosition = ship.get(PhysicsPosition);
  if (!shipPosition) throw new Error('Expected ship physics position');
  const target = { x: shipPosition.x + 0.35, y: shipPosition.y };
  const asteroid = createAsteroid(
    world,
    createPrng(0x508a),
    target.x,
    target.y,
    1,
  );

  asteroid.getMut(LinearVelocity, (velocity) => {
    velocity.x = 0;
    velocity.y = 0;
  });
}

describe('server game world soak', () => {
  it('drives the full physics game loop with simulated players without instability or leaks', async () => {
    const world = await createGameWorld();
    const clientA = connectClient(world, 'soak-client-a');
    const clientB = connectClient(world, 'soak-client-b');

    world.progress(0, DT_MS);

    const shipA = getShip(getSession(clientA));
    const shipB = getShip(getSession(clientB));
    assertShipPhysicsShape(shipA);
    assertShipPhysicsShape(shipB);
    seedDeterministicTarget(world, shipA);

    const startPosition = { ...shipA.get(PhysicsPosition)! };
    const startScore = getGameState(world).score;
    const initialAsteroids = count(world, Asteroid);
    let maxBodies = count(world, Body);
    let maxCircles = count(world, Circle);
    let maxBullets = 0;
    let maxExplosions = 0;
    let minAsteroidsAfterHit = initialAsteroids;
    let minBulletAsteroidDistance = Infinity;

    expect(() => {
      for (let tick = 1; tick <= 540; tick += 1) {
        const shootingWindow = tick <= 420;
        const shipPosition = shipA.get(PhysicsPosition);
        const target = entitiesWith(world, Asteroid)
          .map((asteroid) => asteroid.get(PhysicsPosition))
          .filter((position): position is PhysicsPosition => !!position)
          .sort(
            (a, b) =>
              distance(shipPosition ?? startPosition, a) -
              distance(shipPosition ?? startPosition, b),
          )[0];

        if (shipPosition && target) {
          const aimAngle = Math.atan2(
            target.y - shipPosition.y,
            target.x - shipPosition.x,
          );
          shipA.set(PhysicsRotation, { angle: aimAngle });
          shipA.set(RenderRotation, { angle: aimAngle });
        }

        setClientInput(clientA, {
          thrust: tick % 3 !== 0,
          rotateLeft: shootingWindow && tick > 180 && tick % 40 < 20,
          rotateRight: shootingWindow && tick > 180 && tick % 40 >= 20,
          shoot: shootingWindow,
        });
        setClientInput(clientB, {
          thrust: tick % 4 === 0,
          rotateLeft: shootingWindow && tick % 50 >= 25,
          rotateRight: shootingWindow && tick % 50 < 25,
          shoot: shootingWindow && tick % 2 === 0,
        });

        world.progress(tick * DT_MS, DT_MS);
        assertFinitePhysicsState(world);

        const bodyCount = count(world, Body);
        const circleCount = count(world, Circle);
        maxBodies = Math.max(maxBodies, bodyCount);
        maxCircles = Math.max(maxCircles, circleCount);
        maxBullets = Math.max(maxBullets, count(world, Bullet));
        maxExplosions = Math.max(maxExplosions, count(world, Explosion));
        minAsteroidsAfterHit = Math.min(
          minAsteroidsAfterHit,
          count(world, Asteroid),
        );
        for (const bullet of entitiesWith(world, Bullet)) {
          const bulletPosition = bullet.get(PhysicsPosition);
          if (!bulletPosition) continue;
          for (const asteroid of entitiesWith(world, Asteroid)) {
            const asteroidPosition = asteroid.get(PhysicsPosition);
            if (!asteroidPosition) continue;
            minBulletAsteroidDistance = Math.min(
              minBulletAsteroidDistance,
              distance(bulletPosition, asteroidPosition),
            );
          }
        }

        expect(bodyCount).toBeLessThan(160);
        expect(circleCount).toBeLessThan(160);
        expect(Math.abs(bodyCount - circleCount)).toBeLessThanOrEqual(1);
      }
    }).not.toThrow();

    const endPosition = shipA.get(PhysicsPosition)!;
    expect(distance(startPosition, endPosition)).toBeGreaterThan(0.01);
    assertFinitePhysicsState(world);
    expect(maxBullets).toBeGreaterThan(0);
    expect(
      getGameState(world).score,
      `minimum bullet/asteroid distance: ${minBulletAsteroidDistance}`,
    ).toBeGreaterThan(startScore);
    expect(count(world, Bullet)).toBeLessThan(maxBullets);
    expect(minAsteroidsAfterHit).toBeLessThan(initialAsteroids);
    expect(maxExplosions).toBeGreaterThan(0);
    expect(count(world, Explosion)).toBeLessThan(maxExplosions);
    expect(maxBodies).toBeLessThan(160);
    expect(maxCircles).toBeLessThan(160);
  });
});
