import { describe, expect, it } from 'vitest';
import { NETWORK_COMPONENTS, Position } from '@spacerocks/common';

describe('client network schema', () => {
  it('imports the shared schema with Position first for network type 1', () => {
    expect(NETWORK_COMPONENTS[0]).toBe(Position);
  });
});
