import { ClientWorld } from '@vworlds/vecs-client';
import type { Entity, Query } from '@vworlds/vecs';
import {
  PhaserRenderModule,
  phaserInterpolators,
  loadAssets,
} from '@vworlds/vecs-phaser-client';
import {
  CLIENT_ENTITY_ID_START,
  NETWORK_COMPONENTS,
  Owner,
  PIXELS_PER_METER,
} from '@spacerocks/common';
import type Phaser from 'phaser';
import { ExplosionEffectModule } from '../render/ExplosionEffectModule';

const DEFAULT_SERVER_PORT = 2567;
const DEFAULT_WORLD_NAME = 'main';
const DEFAULT_API_BASE_PATH = '/rtc/v1';

interface SpacerocksConnectionOptions {
  readonly host: string;
  readonly port: number;
  readonly protocol: 'http' | 'https';
  readonly worldName: string;
  readonly apiBasePath: string;
}

declare global {
  interface Window {
    spacerocksConnectionOptions?: Partial<SpacerocksConnectionOptions>;
  }
}

function readConnectionOptions(): SpacerocksConnectionOptions {
  const overrides = window.spacerocksConnectionOptions ?? {};
  const protocol =
    overrides.protocol ??
    (window.location.protocol === 'https:' ? 'https' : 'http');
  return {
    host: overrides.host ?? window.location.hostname,
    port: overrides.port ?? DEFAULT_SERVER_PORT,
    protocol,
    worldName: overrides.worldName ?? DEFAULT_WORLD_NAME,
    apiBasePath: overrides.apiBasePath ?? DEFAULT_API_BASE_PATH,
  };
}

const localShipByOwnerQueries = new WeakMap<
  ClientWorld,
  Query<[typeof Owner]>
>();

export type ClientWorldConfig = {
  scene: Phaser.Scene;
};

type DgramClientSocket = {
  id: string;
  connect(): Promise<void>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  send(data: Uint8Array): void;
  close(): void;
};

// Build the entire world (component registration + systems)
// BEFORE opening the WebRTC data channel. The server starts a 5-frame (~166ms
// at 30Hz) ack budget the moment its data channel emits open, and the
// initial world setup can take several hundred milliseconds on first load.
// Doing it before the socket connects keeps the first ack well within budget.
export async function createClientWorld(
  config: ClientWorldConfig,
): Promise<{ world: ClientWorld; clientId: string }> {
  const t0 = performance.now();
  const dgramModule = await import('@vworlds/dgram-client');
  const tImport = performance.now();
  // The dgram ClientSocket is structurally a VecsSocket but its eventemitter
  // overloads do not line up at the type level — ClientWorld.connectDgram does
  // the same `as unknown as` cast internally.
  const ClientSocketCtor = dgramModule.ClientSocket as unknown as new (
    url: string,
    rtcConfig: RTCConfiguration,
  ) => DgramClientSocket;

  const { host, port, protocol, worldName, apiBasePath } =
    readConnectionOptions();
  const url = `${protocol}://${host}:${port}${apiBasePath}/world/${worldName}`;
  const socket = new ClientSocketCtor(url, {});

  // Fetch the asset catalog and queue every spritesheet in Phaser's loader
  // before the world starts replicating entities. Player ships render via the
  // Image component, whose texture key is the catalog id; if the spritesheet
  // is not loaded by the time the first ship snapshot arrives, Phaser logs a
  // missing-texture warning and the ship renders as a green placeholder.
  const catalog = await loadAssets(config.scene, {
    host,
    port,
    worldName,
    protocol,
    apiBasePath: `${apiBasePath}/world`,
  });

  // IdPool layout (18 network components → localComponentMin = 32,
  // localEntityIdStart = 1_000_000):
  //   network:         1 – 31
  //   component:       32 – 899
  //   module:          900 – 999
  //   network_entity:  1000 – 999,999 (server-owned entities replicated to the client)
  //   entity:          1,000,000 – ∞ (local entities in the client)
  const world = new ClientWorld({
    networkComponents: NETWORK_COMPONENTS,
    interpolators: phaserInterpolators(),
    localEntityIdStart: CLIENT_ENTITY_ID_START,
  });

  world.module(PhaserRenderModule, {
    scene: config.scene,
    pixelsPerMeter: PIXELS_PER_METER,
    catalog,
  });
  world.module(ExplosionEffectModule, { scene: config.scene });

  const tStarted = performance.now();

  // Attach the socket only once the world is ready to ack. attachSocket only
  // subscribes to "receive"; nothing fires until the data channel opens.
  world.attachSocket(
    socket as unknown as Parameters<ClientWorld['attachSocket']>[0],
  );
  await socket.connect();
  const clientId = socket.id;
  const tConnected = performance.now();

  console.info(
    `[vecs] import=${(tImport - t0).toFixed(0)}ms ` +
      `setup=${(tStarted - tImport).toFixed(0)}ms ` +
      `socket.connect=${(tConnected - tStarted).toFixed(0)}ms ` +
      `(total=${(tConnected - t0).toFixed(0)}ms)`,
  );
  return { world, clientId };
}

export function findLocalShipEntity(
  world: ClientWorld,
  clientId: string,
): Entity | undefined {
  let localShip: Entity | undefined;
  const query = getLocalShipByOwnerQuery(world);
  query.forEach([Owner], (entity, [owner]) => {
    if (localShip || owner.clientId !== clientId) return;
    localShip = entity;
  });
  return localShip;
}

function getLocalShipByOwnerQuery(world: ClientWorld): Query<[typeof Owner]> {
  let query = localShipByOwnerQueries.get(world);
  if (!query) {
    query = world.query('LocalShipByOwner').with(Owner).track().build();
    localShipByOwnerQueries.set(world, query);
  }
  return query;
}
