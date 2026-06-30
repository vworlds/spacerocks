import express from 'express';
import { ServerWorld, VecsListener } from '@vworlds/vecs-server';
import { AssetManager, PhaserServerModule } from '@vworlds/vecs-phaser-server';
import { PhysicsModule, preloadPhysics } from '@vworlds/vecs-physics';
import { NETWORK_COMPONENTS, TICK_RATE } from '@spacerocks/common';
import { logger } from './logger';
import { corsMiddleware } from './cors';
import { listenWithRetry } from './serverLifecycle';
import { WorldModule } from './game/world';

export { stopServer } from './serverLifecycle';
export { WorldModule } from './game/world';

const DT_MS = 1000 / TICK_RATE; // ms/frame
const MAX_FRAME_TIME_MS = 250;
const ASSETS_PATH = 'assets';
// Matches the client's `${API_BASE_PATH}/world/${WORLD_NAME}` URL shape, i.e.
// the `worldPath` base the AssetManager routes mount under.
const ASSET_API_BASE_PATH = '/rtc/v1/world';

// Optional WebRTC UDP advertisement. When the server runs behind a port
// mapping (e.g. vrunner's per-branch Docker Compose), browsers can't reach
// the container's internal UDP port; advertise the externally-exposed host
// and port instead so ICE candidates point at the reachable address.
const WEBRTC_UDP_HOST = process.env.SPACEROCKS_WEBRTC_UDP_HOST;
const WEBRTC_UDP_PORT = process.env.SPACEROCKS_WEBRTC_UDP_PORT
  ? Number(process.env.SPACEROCKS_WEBRTC_UDP_PORT)
  : undefined;

function createDgramOptions(): Record<string, unknown> {
  return {
    ordered: false,
    maxRetransmits: 2,
    ...(WEBRTC_UDP_PORT === undefined
      ? {}
      : {
          enableIceUdpMux: true,
          advertisedUdpHost: WEBRTC_UDP_HOST,
          advertisedUdpPort: WEBRTC_UDP_PORT,
          portRange: { min: WEBRTC_UDP_PORT, max: WEBRTC_UDP_PORT },
        }),
  };
}

export async function createGameWorld(
  assets?: AssetManager,
): Promise<ServerWorld> {
  const world = new ServerWorld({
    name: 'main',
    networkComponents: NETWORK_COMPONENTS,
  });

  // Physics + render modules MUST be installed BEFORE any system that spawns
  // physics bodies. AsteroidsModule spawns the initial field at install time;
  // entities created before PhysicsModule never get working Box2D sensor
  // shapes, so their collisions silently never fire. PhaserServerModule stays
  // ahead of the embellishment systems so its PRE_STORE pose-sync runs before
  // the PRE_STORE child-follow systems.
  await preloadPhysics();
  world.module(PhysicsModule, {
    gravity: { x: 0, y: 0 },
    fixedTimeStep: 1 / TICK_RATE,
    subSteps: 4,
  });
  world.module(PhaserServerModule);

  world.module(WorldModule, assets ? { manager: assets } : {});

  return world;
}

export async function startServer(port = Number(process.env.PORT ?? 2567)) {
  const app = express();
  app.use(express.json());
  app.use(corsMiddleware);

  // Asset catalog: the server owns the tileset, serves it over HTTP, and refers
  // to assets on the wire by short numeric ids. The AssetManager is created here
  // (where the Express app lives) and passed into createGameWorld; ShipModule
  // resolves the spaceship tileset from it. `mount` registers the catalog JSON +
  // static file routes; the catalog is built lazily per request, so any tileset
  // loaded before the client fetches it is included.
  const assets = new AssetManager({ assetsPath: ASSETS_PATH });

  // IdPool layout (18 network components → localComponentMin = 32):
  //   network:    1 – 31
  //   component:  32 – 899
  //   module:     900 – 999
  //   entity:     1000 – ∞ (Note: client will only consider entities up to 999,999 as "network entities")
  const world = await createGameWorld(assets);

  assets.mount(app, world.name, ASSET_API_BASE_PATH);

  // Instrument the world's connect/disconnect plumbing so we can see who
  // joins, who leaves, and which side initiates the close.
  const debug = world as unknown as {
    _onNewConnection: (socket: { id: string }) => void;
    _onDisconnect: (socketId: string) => void;
    _sessions: Map<string, unknown>;
  };
  const origOnNew = debug._onNewConnection.bind(debug);
  debug._onNewConnection = (socket: { id: string }) => {
    origOnNew(socket);
    console.info(
      `[srv] _onNewConnection id=${socket.id} sessions=${debug._sessions.size}`,
    );
  };
  const origOnDisc = debug._onDisconnect.bind(debug);
  debug._onDisconnect = (socketId: string) => {
    origOnDisc(socketId);
    console.info(
      `[srv] _onDisconnect id=${socketId} sessions=${debug._sessions.size}`,
    );
  };

  const vecsListener = new VecsListener();
  vecsListener.registerWorld(world);
  await vecsListener.listen(app, createDgramOptions());

  const server = await listenWithRetry(app, port);

  let previousTickTime = performance.now();
  let accumulator = 0;
  let tickCounter = 0;
  const tick = setInterval(() => {
    const now = performance.now();
    const elapsed = Math.min(now - previousTickTime, MAX_FRAME_TIME_MS);
    previousTickTime = now;
    accumulator += elapsed;

    while (accumulator >= DT_MS) {
      tickCounter += 1;
      world.progress(tickCounter * DT_MS, DT_MS);
      accumulator -= DT_MS;
    }
  }, DT_MS);

  return { app, server, world, vecsListener, tick, port };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
    .then((serverHandle) => {
      logger.info(
        { port: serverHandle.port },
        `spacerocks server listening on http://localhost:${serverHandle.port}`,
      );
    })
    .catch((error: unknown) => {
      logger.error({ error }, 'failed to start spacerocks server');
      process.exitCode = 1;
    });
}
