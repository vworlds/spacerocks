import { describe, expect, it } from 'vitest';
import { Decoder, Encoder } from '@vworlds/vecs-wire';

import {
  Arc,
  AsteroidView,
  Drawable,
  ExplosionView,
  FillStyle,
  FilledRect,
  GameStateView,
  HealthView,
  NETWORK_COMPONENTS,
  PickupView,
  PlayerShip,
  Point,
  Position,
  ProjectileView,
  Rotation,
  SHARED_COMPONENT_TYPES,
  Shape,
  ShieldView,
  StrokeStyle,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  WeaponView,
  createWorld,
  getComponentType,
} from '../src/index';

class LocalComponent {}

type WireEncodable = {
  wireEncode(encoder: Encoder): void;
};

type WireDecodable<T> = {
  wireDecode(decoder: Decoder): T;
};

function roundTrip<T extends object>(ComponentClass: new () => T, value: T): T {
  const encoder = new Encoder(new Uint8Array(1024));
  (value as WireEncodable).wireEncode(encoder);

  return (ComponentClass as unknown as WireDecodable<T>).wireDecode(
    new Decoder(encoder.getBuffer().slice(0, encoder.length)),
  );
}

describe('createWorld', () => {
  it('registers shared component types before local component ids', () => {
    const world = createWorld();
    const positionType = SHARED_COMPONENT_TYPES.find(
      ([ComponentClass]) => ComponentClass === Position,
    )?.[1];

    expect(getComponentType(world, Position)).toBe(positionType);

    world.component(LocalComponent);
    expect(getComponentType(world, LocalComponent)).toBe(
      Math.max(...SHARED_COMPONENT_TYPES.map(([, type]) => type)) + 1,
    );
  });
});

describe('NETWORK_COMPONENTS', () => {
  it('keeps Position as the first network component', () => {
    expect(NETWORK_COMPONENTS[0]).toBe(Position);
    expect(NETWORK_COMPONENTS.indexOf(Position) + 1).toBe(1);
  });

  it('exports fixed world dimensions', () => {
    expect(WORLD_WIDTH).toBe(1024);
    expect(WORLD_HEIGHT).toBe(768);
  });

  it('uses vecs-wire encodable network components', () => {
    const shape = new Shape();
    shape.points = [Object.assign(new Point(), { x: 1, y: 2 })];

    const cases = [
      [Position, Object.assign(new Position(), { x: 1, y: 2 })],
      [Rotation, Object.assign(new Rotation(), { angle: 3 })],
      [Drawable, Object.assign(new Drawable(), { zIndex: 4 })],
      [StrokeStyle, Object.assign(new StrokeStyle(), { style: '#abc' })],
      [FillStyle, Object.assign(new FillStyle(), { style: '#def' })],
      [Shape, shape],
      [Arc, Object.assign(new Arc(), { radius: 5 })],
      [FilledRect, Object.assign(new FilledRect(), { width: 6 })],
      [PlayerShip, Object.assign(new PlayerShip(), { playerIndex: 7 })],
      [AsteroidView, Object.assign(new AsteroidView(), { level: 2 })],
      [ProjectileView, Object.assign(new ProjectileView(), { kind: 1 })],
      [PickupView, Object.assign(new PickupView(), { amount: 9 })],
      [HealthView, Object.assign(new HealthView(), { hp: 10 })],
      [ShieldView, Object.assign(new ShieldView(), { remainingTime: 11 })],
      [WeaponView, Object.assign(new WeaponView(), { ammo: 12, firing: 1 })],
      [GameStateView, Object.assign(new GameStateView(), { wave: 13 })],
      [ExplosionView, Object.assign(new ExplosionView(), { seed: 14 })],
    ] as const;

    for (const [ComponentClass, value] of cases) {
      expect(roundTrip(ComponentClass, value)).toBeInstanceOf(ComponentClass);
    }
  });
});
