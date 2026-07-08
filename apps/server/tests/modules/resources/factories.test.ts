import { ChildOf, World, type Entity } from '@vworlds/vecs';
import {
  FillStyle,
  Position,
  Rectangle,
  Size,
  Text,
  TextAlign,
} from '@vworlds/vecs-phaser';
import {
  CONTAINER_SIZE,
  NetworkComponentsModule,
  RESOURCE_DISPLAY,
  RESOURCE_TYPES,
} from '@spacerocks/common';
import { describe, expect, it, vi } from 'vitest';
import { registerNetworkFoundation } from '../helpers';
import { ResourceContainer } from '../../../src/game/modules/resources/components';
import { Components as ResourcesComponents } from '../../../src/game/modules/resources/components';
import { createResourceContainer } from '../../../src/game/modules/resources/factories';
import {
  FollowParent,
  Offset,
} from '../../../src/game/modules/embellishments/components';

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
  it('spawns a square Rectangle parent with per-type FillStyle and ResourceContainer', () => {
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
    expect(container.get(ResourceContainer)?.type).toBe('ore');
  });

  it('spawns a child Text entity carrying the centered character', () => {
    const world = createTestWorld();
    const container = createResourceContainer(world, 'crystal', 0, 0);

    let textChild: Entity | undefined;
    world.filter([Text]).forEach([], (entity) => {
      textChild = entity;
    });
    expect(textChild).toBeDefined();
    expect(textChild!.get(ChildOf)?.target).toBe(container);
    expect(textChild!.get(Text)).toMatchObject({
      value: RESOURCE_DISPLAY.crystal.char,
      align: TextAlign.Center,
    });
    // The character tracks a moving container: FollowParent + zero Offset lets
    // the embellishments position cascade pin it to the square's centre.
    expect(textChild!.get(FollowParent)).toBeDefined();
    expect(textChild!.get(Offset)).toMatchObject({ x: 0, y: 0 });
  });

  it('derives color and char purely from RESOURCE_DISPLAY for every type', () => {
    for (const type of RESOURCE_TYPES) {
      const world = createTestWorld();
      const container = createResourceContainer(world, type, 0, 0);

      expect(container.get(FillStyle)?.color).toBe(
        RESOURCE_DISPLAY[type].color,
      );

      let textChild: Entity | undefined;
      world.filter([Text]).forEach([], (entity) => {
        textChild = entity;
      });
      expect(textChild!.get(Text)?.value).toBe(RESOURCE_DISPLAY[type].char);
    }
  });
});
