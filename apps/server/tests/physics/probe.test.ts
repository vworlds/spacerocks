import { ChildOf, World, type Entity } from '@vworlds/vecs';
import {
  Body,
  BodyType,
  Circle,
  CollisionFilter,
  ContactEvents,
  Detectable,
  LinearVelocity,
  PhysicsModule,
  Position,
  Sensor,
  SensorEvents,
} from '@vworlds/vecs-physics';
import { describe, expect, it } from 'vitest';

const DT_MS = 1000 / 60;
const DT_SECONDS = 1 / 60;
const CAT_SENSOR = 0b0001;
const CAT_SOLID = 0b0010;
const CAT_BLOCKED = 0b0100;

type SensorBegin = { self: Entity; other: Entity };
type ContactBegin = { self: Entity; other: Entity };

type ProbeWorld = {
  world: World;
  sensorBegins: SensorBegin[];
  contactBegins: ContactBegin[];
};

function createProbeWorld(): ProbeWorld {
  const world = new World();
  const sensorBegins: SensorBegin[] = [];
  const contactBegins: ContactBegin[] = [];

  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: DT_SECONDS,
    subSteps: 4,
  });

  world
    .system('ProbeSensorEvents')
    .phase('physics-post')
    .with(SensorEvents)
    .update({ watch: SensorEvents, onEnter: true }, (self, events) => {
      for (const event of events.begin) {
        sensorBegins.push({ self, other: event.other });
      }
    });

  world
    .system('ProbeContactEvents')
    .phase('physics-post')
    .with(ContactEvents)
    .update({ watch: ContactEvents, onEnter: true }, (self, events) => {
      for (const event of events.begin) {
        contactBegins.push({ self, other: event.other });
      }
    });

  return { world, sensorBegins, contactBegins };
}

function createBody(
  world: World,
  type: BodyType,
  options: {
    x?: number;
    y?: number;
    velocityX?: number;
    velocityY?: number;
  } = {},
): Entity {
  const body = world
    .entity()
    .set(Position, { x: options.x ?? 0, y: options.y ?? 0 })
    .set(Body, { type });

  if (options.velocityX !== undefined || options.velocityY !== undefined) {
    body.set(LinearVelocity, {
      x: options.velocityX ?? 0,
      y: options.velocityY ?? 0,
    });
  }

  return body;
}

function createCircleShape(
  world: World,
  body: Entity,
  options: {
    categoryBits: number;
    maskBits: number;
    sensor?: boolean;
    sensorEvents?: boolean;
    contactEvents?: boolean;
    detectable?: boolean;
  },
): Entity {
  const shape = world
    .entity()
    .childOf(body)
    .set(Circle, { radius: 0.5 })
    .set(CollisionFilter, {
      categoryBits: options.categoryBits,
      maskBits: options.maskBits,
    });

  if (options.sensor) shape.add(Sensor);
  if (options.sensorEvents) shape.add(SensorEvents);
  if (options.contactEvents) shape.add(ContactEvents);
  if (options.detectable) shape.add(Detectable);

  return shape;
}

function stepProbe(world: World, frames = 10): void {
  for (let i = 0; i < frames; i += 1) {
    world.progress((i + 1) * DT_MS, DT_MS);
  }
}

function beginsForSelf<T extends { self: Entity }>(
  events: T[],
  self: Entity,
): T[] {
  return events.filter((event) => event.self === self);
}

function expectBeginAgainst(
  events: { self: Entity; other: Entity }[],
  self: Entity,
  other: Entity,
): void {
  expect(
    beginsForSelf(events, self).some((event) => event.other === other),
  ).toBe(true);
}

describe('vecs-physics Box2D sensor/contact probe', () => {
  it('A: kinematic sensor detects only dynamic solids that opt in with Detectable', () => {
    {
      const { world, sensorBegins } = createProbeWorld();
      const sensorBody = createBody(world, BodyType.Kinematic, {
        x: -1.5,
        velocityX: 10,
      });
      const solidBody = createBody(world, BodyType.Dynamic);
      const sensorShape = createCircleShape(world, sensorBody, {
        sensor: true,
        sensorEvents: true,
        categoryBits: CAT_SENSOR,
        maskBits: CAT_SOLID,
      });
      const solidShape = createCircleShape(world, solidBody, {
        categoryBits: CAT_SOLID,
        maskBits: CAT_SENSOR,
      });

      stepProbe(world);

      expect(beginsForSelf(sensorBegins, sensorShape)).toEqual([]);
      expect(solidShape.target(ChildOf)).toBe(solidBody);
    }

    {
      const { world, sensorBegins } = createProbeWorld();
      const sensorBody = createBody(world, BodyType.Kinematic, {
        x: -1.5,
        velocityX: 10,
      });
      const solidBody = createBody(world, BodyType.Dynamic);
      const sensorShape = createCircleShape(world, sensorBody, {
        sensor: true,
        sensorEvents: true,
        categoryBits: CAT_SENSOR,
        maskBits: CAT_SOLID,
      });
      const solidShape = createCircleShape(world, solidBody, {
        detectable: true,
        categoryBits: CAT_SOLID,
        maskBits: CAT_SENSOR,
      });

      stepProbe(world);

      expectBeginAgainst(sensorBegins, sensorShape, solidShape);
      expect(solidShape.target(ChildOf)).toBe(solidBody);
    }

    // Sensor-vs-solid SensorEvents require the solid shape to opt in with
    // Detectable; plain solids are intentionally invisible to sensors.
  });

  it('B: two dynamic solids with ContactEvents both receive begin events', () => {
    const { world, contactBegins } = createProbeWorld();
    const bodyA = createBody(world, BodyType.Dynamic);
    const bodyB = createBody(world, BodyType.Dynamic);
    const shapeA = createCircleShape(world, bodyA, {
      contactEvents: true,
      categoryBits: CAT_SENSOR,
      maskBits: CAT_SOLID,
    });
    const shapeB = createCircleShape(world, bodyB, {
      contactEvents: true,
      categoryBits: CAT_SOLID,
      maskBits: CAT_SENSOR,
    });

    stepProbe(world);

    expectBeginAgainst(contactBegins, shapeA, shapeB);
    expectBeginAgainst(contactBegins, shapeB, shapeA);
    // PASS => ship/asteroid/alien DYNAMIC solids can all opt into ContactEvents.
  });

  it('C: collision filters gate sensor detection', () => {
    const { world, sensorBegins } = createProbeWorld();
    const sensorBody = createBody(world, BodyType.Kinematic);
    const solidBody = createBody(world, BodyType.Dynamic);
    const sensorShape = createCircleShape(world, sensorBody, {
      sensor: true,
      sensorEvents: true,
      categoryBits: CAT_SENSOR,
      maskBits: CAT_BLOCKED,
    });
    createCircleShape(world, solidBody, {
      categoryBits: CAT_SOLID,
      maskBits: CAT_SENSOR,
    });

    stepProbe(world);

    expect(beginsForSelf(sensorBegins, sensorShape)).toEqual([]);
    // PASS => blocked CollisionFilter pairs remain invisible to SensorEvents.
  });

  it('D: documents sensor-vs-sensor behavior without relying on it', () => {
    const { world, sensorBegins } = createProbeWorld();
    const bodyA = createBody(world, BodyType.Kinematic);
    const bodyB = createBody(world, BodyType.Kinematic);
    const shapeA = createCircleShape(world, bodyA, {
      sensor: true,
      sensorEvents: true,
      categoryBits: CAT_SENSOR,
      maskBits: CAT_SOLID,
    });
    const shapeB = createCircleShape(world, bodyB, {
      sensor: true,
      sensorEvents: true,
      categoryBits: CAT_SOLID,
      maskBits: CAT_SENSOR,
    });

    stepProbe(world);

    const shapeABegins = beginsForSelf(sensorBegins, shapeA);
    const shapeBBegins = beginsForSelf(sensorBegins, shapeB);

    expect(shapeABegins.some((event) => event.other === shapeB)).toBe(true);
    expect(shapeBBegins.some((event) => event.other === shapeA)).toBe(true);
    // INFORMATIONAL: this Box2D build reports sensor-vs-sensor begin events.
    // The migration still avoids depending on projectile/pickup sensor-vs-sensor pairs.
  });

  it('variant: dynamic sensor detects only dynamic solids that opt in with Detectable', () => {
    {
      const { world, sensorBegins } = createProbeWorld();
      const sensorBody = createBody(world, BodyType.Dynamic, {
        x: -1.5,
        velocityX: 10,
      });
      const solidBody = createBody(world, BodyType.Dynamic);
      const sensorShape = createCircleShape(world, sensorBody, {
        sensor: true,
        sensorEvents: true,
        categoryBits: CAT_SENSOR,
        maskBits: CAT_SOLID,
      });
      const solidShape = createCircleShape(world, solidBody, {
        categoryBits: CAT_SOLID,
        maskBits: CAT_SENSOR,
      });

      stepProbe(world);

      expect(beginsForSelf(sensorBegins, sensorShape)).toEqual([]);
      expect(solidShape.target(ChildOf)).toBe(solidBody);
    }

    {
      const { world, sensorBegins } = createProbeWorld();
      const sensorBody = createBody(world, BodyType.Dynamic, {
        x: -1.5,
        velocityX: 10,
      });
      const solidBody = createBody(world, BodyType.Dynamic);
      const sensorShape = createCircleShape(world, sensorBody, {
        sensor: true,
        sensorEvents: true,
        categoryBits: CAT_SENSOR,
        maskBits: CAT_SOLID,
      });
      const solidShape = createCircleShape(world, solidBody, {
        detectable: true,
        categoryBits: CAT_SOLID,
        maskBits: CAT_SENSOR,
      });

      stepProbe(world);

      expectBeginAgainst(sensorBegins, sensorShape, solidShape);
      expect(solidShape.target(ChildOf)).toBe(solidBody);
    }

    // Dynamic sensor bodies follow the same opt-in rule: Detectable solids are
    // reported, while plain solids are not.
  });

  it('E: two dynamic sensor bodies both receive SensorEvents begin events', () => {
    const { world, sensorBegins } = createProbeWorld();
    const bodyA = createBody(world, BodyType.Dynamic);
    const bodyB = createBody(world, BodyType.Dynamic);
    const shapeA = createCircleShape(world, bodyA, {
      sensor: true,
      sensorEvents: true,
      categoryBits: CAT_SENSOR,
      maskBits: CAT_SOLID,
    });
    const shapeB = createCircleShape(world, bodyB, {
      sensor: true,
      sensorEvents: true,
      categoryBits: CAT_SOLID,
      maskBits: CAT_SENSOR,
    });

    stepProbe(world);

    expectBeginAgainst(sensorBegins, shapeA, shapeB);
    expectBeginAgainst(sensorBegins, shapeB, shapeA);
    // PASS => a uniform all-DYNAMIC-sensor model can detect gameplay overlaps
    // from SensorEvents on both participating shapes.
  });

  it('F: collision filters gate dynamic sensor-vs-sensor detection', () => {
    const { world, sensorBegins } = createProbeWorld();
    const bodyA = createBody(world, BodyType.Dynamic);
    const bodyB = createBody(world, BodyType.Dynamic);
    const shapeA = createCircleShape(world, bodyA, {
      sensor: true,
      sensorEvents: true,
      categoryBits: CAT_SENSOR,
      maskBits: CAT_BLOCKED,
    });
    const shapeB = createCircleShape(world, bodyB, {
      sensor: true,
      sensorEvents: true,
      categoryBits: CAT_SOLID,
      maskBits: CAT_SENSOR,
    });

    stepProbe(world);

    expect(beginsForSelf(sensorBegins, shapeA)).toEqual([]);
    expect(beginsForSelf(sensorBegins, shapeB)).toEqual([]);
    // PASS => sensor-vs-sensor events honor CollisionFilter, so friendly-fire
    // prevention can remain category/mask based in the uniform sensor model.
  });

  it('G: a dynamic body with only a sensor shape moves and writes Position back', () => {
    const { world } = createProbeWorld();
    const body = createBody(world, BodyType.Dynamic, { velocityX: 1 });
    createCircleShape(world, body, {
      sensor: true,
      sensorEvents: true,
      categoryBits: CAT_SENSOR,
      maskBits: CAT_SOLID,
    });

    stepProbe(world, 30);

    const position = body.get(Position);
    expect(position?.x).toBeGreaterThan(0.25);
    expect(position?.y).toBe(0);
    // PASS => DYNAMIC sensor-only bodies still integrate LinearVelocity and
    // write the simulated pose back to the ECS Position component.
  });
});
