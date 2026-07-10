import { describe, expect, it } from 'vitest';
import {
  Position as PhaserPosition,
  phaserNetworkComponents,
} from '@vworlds/vecs-phaser';
import { Decoder, Encoder } from '@vworlds/vecs-wire';

import {
  Explosion,
  Hyperspace,
  NETWORK_COMPONENTS,
  Owner,
  ProgressBar,
  ResourceContainer,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  WORLD_HEIGHT,
  WORLD_SCALE,
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
    expect(NETWORK_COMPONENTS).toEqual([
      ...phaserNetworkComponents,
      Explosion,
      Owner,
      Hyperspace,
      ProgressBar,
      ResourceContainer,
    ]);
    expect(NETWORK_COMPONENTS.indexOf(PhaserPosition) + 1).toBe(1);
  });

  it('exports viewport dimensions and scaled world dimensions', () => {
    expect(VIEWPORT_WIDTH).toBe(10.24);
    expect(VIEWPORT_HEIGHT).toBe(7.68);
    expect(WORLD_WIDTH).toBe(VIEWPORT_WIDTH * WORLD_SCALE);
    expect(WORLD_HEIGHT).toBe(VIEWPORT_HEIGHT * WORLD_SCALE);
  });

  it('uses vecs-wire encodable network components', () => {
    const cases = [
      [Explosion, Object.assign(new Explosion(), { color: 0xff00ff })],
      [Owner, Object.assign(new Owner(), { clientId: 'client-1' })],
      [Hyperspace, Object.assign(new Hyperspace(), { seq: 7 })],
    ] as const;

    for (const [ComponentClass, value] of cases) {
      expect(roundTrip(ComponentClass, value)).toBeInstanceOf(ComponentClass);
    }
  });
});
