import { World } from '@vworlds/vecs';
import { FillStyle, Position, Rectangle, Size } from '@vworlds/vecs-phaser';
import {
  CONTAINER_SIZE,
  NetworkComponentsModule,
  RESOURCE_DISPLAY,
  RESOURCE_TYPES,
  ResourceContainer,
  fromResourceWire,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { registerNetworkFoundation } from '../helpers';
import { Components as ResourcesComponents } from '../../../src/game/modules/resources/components';
import { createResourceContainer } from '../../../src/game/modules/resources/factories';

vi.mock('@vworlds/vecs-server', () => ({
  NetworkClient: class NetworkClient {
    id = '';
  },
  NetworkInput: class NetworkInput {
    input: unknown;
  },
  Networked: class Networked {},
  View: class View {
    dsl: unknown;
  },
}));

function createTestWorld(): World {
  const world = new World();
  world.module(NetworkComponentsModule);
  registerNetworkFoundation(world);
  world.module(ResourcesComponents);
  return world;
}

describe('createResourceContainer', () => {
  it('spawns a square Rectangle with per-type FillStyle and networked ResourceContainer', () => {
    const world = createTestWorld();
    const container = createResourceContainer(world, 'ore', 1, 2);

    expect(container.get(Rectangle)).toBeDefined();
    expect(container.get(Size)).toMatchObject({
      width: CONTAINER_SIZE,
      height: CONTAINER_SIZE,
    });
    expect(container.get(FillStyle)).toMatchObject({
      color: RESOURCE_DISPLAY.ore.color,
      alpha: 1,
    });
    expect(container.get(Position)).toMatchObject({ x: 1, y: 2 });
    expect(container.get(ResourceContainer)).toBeDefined();
    expect(
      fromResourceWire(container.get(ResourceContainer)!.resourceType),
    ).toBe('ore');
  });

  it('does not spawn a child Text entity (client-side rendering)', () => {
    const world = createTestWorld();
    const container = createResourceContainer(world, 'crystal', 0, 0);

    // The container is the only entity with ResourceContainer — no child
    // Text entity is spawned (the character is drawn client-side).
    let count = 0;
    world.filter([ResourceContainer]).forEach([], () => {
      count++;
    });
    expect(count).toBe(1);
    expect(container.get(ResourceContainer)).toBeDefined();
  });

  it('derives color from RESOURCE_DISPLAY and sets resourceType for every type', () => {
    for (const type of RESOURCE_TYPES) {
      const world = createTestWorld();
      const container = createResourceContainer(world, type, 0, 0);

      expect(container.get(FillStyle)?.color).toBe(
        RESOURCE_DISPLAY[type].color,
      );
      expect(
        fromResourceWire(container.get(ResourceContainer)!.resourceType),
      ).toBe(type);
    }
  });
});
