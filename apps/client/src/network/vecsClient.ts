import { ClientWorld } from '@vworlds/vecs-client';
import type { Entity, Query } from '@vworlds/vecs';
import {
  PhaserRenderModule,
  phaserInterpolators,
} from '@vworlds/vecs-phaser-client';
import {
  CLIENT_ENTITY_ID_START,
  NETWORK_COMPONENTS,
  Owner,
  PIXELS_PER_METER,
} from '@spacerocks/common';
import type Phaser from 'phaser';
import { ExplosionEffectModule } from '../render/ExplosionEffectModule';

const SERVER_PORT = 2567; // port
const WORLD_NAME = 'main';
const API_BASE_PATH = '/rtc/v1';
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

  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const host = window.location.hostname;
  const url = `${protocol}://${host}:${SERVER_PORT}${API_BASE_PATH}/world/${WORLD_NAME}`;
  const socket = new ClientSocketCtor(url, {});

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
