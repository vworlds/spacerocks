import express from 'express';
import { ServerWorld, VecsListener, View } from '@vworlds/vecs-server';
import { phaserRenderableComponents } from '@vworlds/vecs-phaser';
import { NETWORK_COMPONENTS, TICK_RATE } from '@spacerocks/common';
import { logger } from './logger';
import { corsMiddleware } from './cors';
import {
  installPlayerSessionSystems,
  registerPlayerSessionComponents,
} from './game/playerSessions';
import { installMovementSystems } from './game/movement';
import {
  installSpawningSystems,
  registerSpawningComponents,
} from './game/spawning';
import {
  installShootingSystems,
  registerShootingComponents,
} from './game/shooting';
import { installCombatSystems, registerCombatComponents } from './game/combat';
import {
  installEmbellishmentSystems,
  registerEmbellishmentComponents,
} from './game/embellishments';
import { installHudSystems, registerHudComponents } from './game/hud';
import { listenWithRetry } from './serverLifecycle';
import { installClientViewSystem } from './network/clientViews';

export { stopServer } from './serverLifecycle';

const TICK_INTERVAL_MS = 1000 / TICK_RATE; // ms/frame

export async function startServer(port = Number(process.env.PORT ?? 2567)) {
  const app = express();
  app.use(express.json());
  app.use(corsMiddleware);

  // IdPool layout (18 network components → localComponentMin = 32):
  //   network:    1 – 31
  //   component:  32 – 899
  //   module:     900 – 999
  //   entity:     1000 – ∞ (Note: client will only consider entities up to 999,999 as "network entities")
  const world = new ServerWorld({
    name: 'main',
    networkComponents: NETWORK_COMPONENTS,
  });
  world.setExclusiveComponents(...phaserRenderableComponents);
  registerPlayerSessionComponents(world);
  registerSpawningComponents(world);
  registerShootingComponents(world);
  registerCombatComponents(world);
  registerEmbellishmentComponents(world);
  registerHudComponents(world);
  installPlayerSessionSystems(world);
  installSpawningSystems(world);
  installShootingSystems(world);
  installMovementSystems(world);
  installCombatSystems(world);
  installEmbellishmentSystems(world);
  installHudSystems(world);
  installClientViewSystem(world, View);

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
  await vecsListener.listen(app, { ordered: false, maxRetransmits: 2 });

  const server = await listenWithRetry(app, port);

  let lastTick = performance.now();
  const tick = setInterval(() => {
    const now = performance.now();
    const delta = now - lastTick;
    lastTick = now;
    world.progress(now, delta);
  }, TICK_INTERVAL_MS);

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
