import { describe, expect, it } from 'vitest';
import {
  Position as PhaserPosition,
  phaserNetworkComponents,
} from '@vworlds/vecs-phaser';
import { Decoder, Encoder } from '@vworlds/vecs-wire';

import {
  AsteroidView,
  Explosion,
  GameStateView,
  NETWORK_COMPONENTS,
  PlayerShip,
  WORLD_HEIGHT,
  WORLD_WIDTH,
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
      [AsteroidView, Object.assign(new AsteroidView(), { mass: 4 })],
      [GameStateView, Object.assign(new GameStateView(), { wave: 13 })],
    ] as const;

    for (const [ComponentClass, value] of cases) {
      expect(roundTrip(ComponentClass, value)).toBeInstanceOf(ComponentClass);
    }
  });
});
