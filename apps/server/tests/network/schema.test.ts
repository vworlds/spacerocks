import { describe, expect, it } from 'vitest';
import {
  Position as PhaserPosition,
  phaserNetworkComponents,
} from '@vworlds/vecs-phaser';
import { Explosion, NETWORK_COMPONENTS } from '@spacerocks/common';

describe('server network schema', () => {
  it('imports the shared schema in protocol order with Position type id 1', () => {
    expect(NETWORK_COMPONENTS).toEqual([...phaserNetworkComponents, Explosion]);
    expect(NETWORK_COMPONENTS.indexOf(PhaserPosition) + 1).toBe(1);
  });
});
