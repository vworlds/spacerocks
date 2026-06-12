import { describe, expect, it } from 'vitest';
import {
  Position as PhaserPosition,
  phaserNetworkComponents,
} from '@vworlds/vecs-phaser';
import { Decoder, Encoder } from '@vworlds/vecs-wire';

import {
  AsteroidView,
  Explosion,
  ExplosionView,
  GameStateView,
  HealthView,
  NETWORK_COMPONENTS,
  PickupView,
  PlayerShip,
  ProjectileView,
  ShieldView,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  WeaponView,
} from '../src/index';

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

describe('NETWORK_COMPONENTS', () => {
  it('keeps Position as the first network component', () => {
    expect(NETWORK_COMPONENTS).toEqual([...phaserNetworkComponents, Explosion]);
    expect(NETWORK_COMPONENTS.indexOf(PhaserPosition) + 1).toBe(1);
  });

  it('exports fixed world dimensions', () => {
    expect(WORLD_WIDTH).toBe(10.24);
    expect(WORLD_HEIGHT).toBe(7.68);
  });

  it('uses vecs-wire encodable network components', () => {
    const cases = [
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
