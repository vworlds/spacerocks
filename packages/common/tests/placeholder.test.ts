import { describe, expect, it } from 'vitest';

import {
  Position,
  SHARED_COMPONENT_TYPES,
  createWorld,
  getComponentType,
} from '../src/index';

class LocalComponent {}

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
