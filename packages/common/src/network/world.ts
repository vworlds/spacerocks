import { World, type ComponentClass } from '@vworlds/vecs';
import {
  Arc,
  Drawable,
  FillStyle,
  FilledRect,
  type ISerializable,
  Networked,
  Position,
  Rotation,
  Shape,
  StrokeStyle,
} from '../components';

type SharedComponentTypeEntry = readonly [ComponentClass, number];

export const SHARED_COMPONENT_TYPES = [
  [Position, 7],
  [Rotation, 8],
  [Drawable, 9],
  [Arc, 10],
  [Shape, 11],
  [StrokeStyle, 12],
  [FillStyle, 13],
  [FilledRect, 14],
  [Networked, 15],
] satisfies readonly SharedComponentTypeEntry[];

export type ComponentType = number;

export type SerializableComponentClass = ComponentClass<ISerializable>;

export const SERIALIZABLE_COMPONENTS = SHARED_COMPONENT_TYPES.map(
  ([ComponentClass]) => ComponentClass,
).filter(
  (ComponentClass) => ComponentClass !== Networked,
) as SerializableComponentClass[];

export type SharedSerializableComponent = InstanceType<
  (typeof SERIALIZABLE_COMPONENTS)[number]
>;

type CreateWorldOptions = {
  entityIdStart?: number;
};

export function createWorld(options: CreateWorldOptions = {}): World {
  const world = new World(
    options.entityIdStart === undefined
      ? undefined
      : {
          idPools: [
            { name: 'component', min: 1, max: 899 },
            { name: 'module', min: 900, max: options.entityIdStart - 1 },
            { name: 'entity', min: options.entityIdStart },
          ],
        },
  );
  registerSharedComponents(world);

  return world;
}

export function registerSharedComponents(world: World): void {
  for (const [ComponentClass, type] of SHARED_COMPONENT_TYPES) {
    world.component(ComponentClass, type);
  }
}

export function getComponentType(
  world: World,
  ComponentClass: ComponentClass,
): ComponentType {
  return world.component(ComponentClass).eid;
}
