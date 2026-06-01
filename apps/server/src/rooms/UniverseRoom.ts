import { Room, type Client } from 'colyseus';
import type { Entity } from '@vworlds/vecs';
import {
  Arc,
  Drawable,
  ECS_DELTA_MESSAGE,
  ECS_SNAPSHOT_MESSAGE,
  Networked,
  Position,
  SERIALIZABLE_COMPONENTS,
  StrokeStyle,
  createWorld,
  getComponentType,
  type ComponentSnapshot,
  type ComponentType,
  type EcsDeltaMessage,
  type EcsSnapshotMessage,
  type ISerializable,
  type NetworkEntityId,
  type SerializableComponentClass,
} from '@spacerocks/common';
import { logger } from '../logger';

class DebugMotion {
  centerX = 0;
  centerY = 0;
  orbitRadius = 0;
  angularSpeed = 1;
  phase = 0;
}

const DEBUG_COLORS = [
  '#00ffcc',
  '#ff00ff',
  '#ffaa00',
  '#66ff66',
  '#66aaff',
  '#ff6666',
] as const;

type PendingPatches = Map<
  NetworkEntityId,
  Map<ComponentType, ComponentSnapshot>
>;

export class UniverseRoom extends Room {
  private readonly world = createWorld();
  private readonly simulationPhase = this.world.addPhase('simulation');
  private readonly replicationPhase = this.world.addPhase('replication');
  private readonly sendPhase = this.world.addPhase('send');
  private readonly spawned = new Set<NetworkEntityId>();
  private readonly removed = new Set<NetworkEntityId>();
  private readonly patches: PendingPatches = new Map();
  private readonly componentRemoved = new Map<
    NetworkEntityId,
    Set<ComponentType>
  >();
  private tick = 0;

  override onCreate(): void {
    logger.info({ roomId: this.roomId }, 'universe room created');

    this.autoDispose = false;
    this.registerComponents();
    this.registerSystems();
    this.world.start();
    this.createDebugEntities();

    this.setSimulationInterval((deltaTime) => {
      this.tick++;
      this.world.progress(performance.now(), deltaTime);
    }, 1000 / 60);
  }

  override onJoin(client: Client): void {
    logger.info(
      { roomId: this.roomId, sessionId: client.sessionId },
      'client connected to universe room',
    );

    client.send(ECS_SNAPSHOT_MESSAGE, this.createSnapshot());
  }

  override onLeave(client: Client, consented?: boolean): void {
    logger.info(
      { roomId: this.roomId, sessionId: client.sessionId, consented },
      'client disconnected from universe room',
    );
  }

  private registerComponents(): void {
    this.world.component(DebugMotion);
  }

  private registerSystems(): void {
    this.world
      .system('DebugMotion')
      .phase(this.simulationPhase)
      .requires(Position, DebugMotion)
      .run((now) => {
        const seconds = now / 1000;
        this.world
          .filter([Position, DebugMotion])
          .forEach([Position, DebugMotion], (entity, [position, motion]) => {
            const angle = seconds * motion.angularSpeed + motion.phase;
            position.x = motion.centerX + Math.cos(angle) * motion.orbitRadius;
            position.y = motion.centerY + Math.sin(angle) * motion.orbitRadius;
            entity.modified(Position);
          });
      });

    this.world
      .system('DebugColor')
      .phase(this.simulationPhase)
      .requires(Arc, StrokeStyle)
      .interval(2)
      .each([StrokeStyle], (entity, [strokeStyle]) => {
        strokeStyle.style = randomDebugColor(strokeStyle.style);
        entity.modified(StrokeStyle);
      });

    this.registerReplicationSystems();

    this.world
      .system('SendDeltas')
      .phase(this.sendPhase)
      .rate(3)
      .run(() => {
        this.broadcastDelta();
      });
  }

  private registerReplicationSystems(): void {
    this.world
      .system('ReplicateNetworkedLifecycle')
      .phase(this.replicationPhase)
      .requires(Networked)
      .enter((entity) => {
        this.markEntitySpawned(entity.eid);
      })
      .exit((entity) => {
        this.markEntityRemoved(entity.eid);
      });

    for (const ComponentClass of SERIALIZABLE_COMPONENTS) {
      this.registerComponentReplicationSystem(ComponentClass);
    }
  }

  private registerComponentReplicationSystem(
    ComponentClass: SerializableComponentClass,
  ): void {
    const componentType = getComponentType(this.world, ComponentClass);

    this.world
      .system(`Replicate${ComponentClass.name}`)
      .phase(this.replicationPhase)
      .requires(Networked, ComponentClass)
      .update(ComponentClass, (entity, component) => {
        const serializable = component as ISerializable;
        this.markComponentPatch(
          entity.eid,
          componentType,
          serializable.serialize(),
        );
      })
      .exit((entity) => {
        this.markComponentRemoved(entity.eid, componentType);
      });
  }

  private createDebugEntities(): void {
    this.createDebugCircle(260, 220, 90, 0.8, 0, '#00ffcc', 24);
    this.createDebugCircle(520, 320, 70, -1.1, 1.5, '#ff00ff', 18);
    this.createDebugCircle(780, 240, 110, 0.55, 3, '#ffaa00', 32);
  }

  private createDebugCircle(
    centerX: number,
    centerY: number,
    orbitRadius: number,
    angularSpeed: number,
    phase: number,
    color: string,
    radius: number,
  ): void {
    const startAngle = 0;
    const endAngle = Math.PI * 2;

    this.world
      .entity()
      .add(Networked)
      .set(Position, { x: centerX + orbitRadius, y: centerY })
      .set(DebugMotion, { centerX, centerY, orbitRadius, angularSpeed, phase })
      .set(Drawable, { zIndex: 10 })
      .set(Arc, { radius, startAngle, endAngle })
      .set(StrokeStyle, { style: color, lineWidth: 3 });
  }

  private broadcastDelta(): void {
    if (!this.hasDelta()) return;

    this.broadcast(ECS_DELTA_MESSAGE, this.createDelta());
    this.clearDelta();
  }

  private createSnapshot(): EcsSnapshotMessage {
    const entities: EcsSnapshotMessage['entities'] = [];

    this.world.filter([Networked]).forEach((entity) => {
      entities.push({
        id: entity.eid,
        components: this.serializeEntity(entity),
      });
    });

    return {
      tick: this.tick,
      entities,
      removed: [],
    };
  }

  private serializeEntity(entity: Entity): ComponentSnapshot[] {
    const components: ComponentSnapshot[] = [];

    for (const ComponentClass of SERIALIZABLE_COMPONENTS) {
      const component = entity.get(ComponentClass);
      if (!component) continue;
      const serializable = component as ISerializable;

      components.push({
        componentType: getComponentType(this.world, ComponentClass),
        data: serializable.serialize(),
      });
    }

    return components;
  }

  private markEntitySpawned(id: NetworkEntityId): void {
    if (this.removed.delete(id)) return;
    this.spawned.add(id);
  }

  private markEntityRemoved(id: NetworkEntityId): void {
    this.removed.add(id);
    this.spawned.delete(id);
    this.patches.delete(id);
    this.componentRemoved.delete(id);
  }

  private markComponentPatch(
    id: NetworkEntityId,
    componentType: ComponentType,
    data: Record<string, unknown>,
  ): void {
    if (this.removed.has(id)) return;

    const removedComponents = this.componentRemoved.get(id);
    removedComponents?.delete(componentType);
    if (removedComponents?.size === 0) this.componentRemoved.delete(id);

    const entityPatches = this.patches.get(id) ?? new Map();
    entityPatches.set(componentType, { componentType, data });
    this.patches.set(id, entityPatches);
  }

  private markComponentRemoved(
    id: NetworkEntityId,
    componentType: ComponentType,
  ): void {
    if (this.removed.has(id) || this.spawned.has(id)) return;

    const entityPatches = this.patches.get(id);
    entityPatches?.delete(componentType);
    if (entityPatches?.size === 0) this.patches.delete(id);

    const removedComponents = this.componentRemoved.get(id) ?? new Set();
    removedComponents.add(componentType);
    this.componentRemoved.set(id, removedComponents);
  }

  private hasDelta(): boolean {
    return (
      this.spawned.size > 0 ||
      this.removed.size > 0 ||
      this.patches.size > 0 ||
      this.componentRemoved.size > 0
    );
  }

  private createDelta(): EcsDeltaMessage {
    return {
      tick: this.tick,
      spawned: [...this.spawned],
      removed: [...this.removed],
      patches: [...this.patches].map(([id, components]) => ({
        id,
        components: [...components.values()],
      })),
      componentRemoved: [...this.componentRemoved].map(
        ([id, componentTypes]) => ({
          id,
          componentTypes: [...componentTypes],
        }),
      ),
    };
  }

  private clearDelta(): void {
    this.spawned.clear();
    this.removed.clear();
    this.patches.clear();
    this.componentRemoved.clear();
  }
}

function randomDebugColor(current: string): string {
  const next = DEBUG_COLORS[Math.floor(Math.random() * DEBUG_COLORS.length)]!;
  return next === current ? randomDebugColor(current) : next;
}
