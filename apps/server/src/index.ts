import express from 'express';
import { VecsListener } from '@vworlds/vecs-server';
import { TICK_RATE } from '@spacerocks/common';
import { logger } from './logger';
import { corsMiddleware } from './cors';
import { listenWithRetry } from './serverLifecycle';
import { createGameWorld } from './game/world';

export { stopServer } from './serverLifecycle';
export { createGameWorld } from './game/world';

const DT_MS = 1000 / TICK_RATE; // ms/frame
const MAX_FRAME_TIME_MS = 250;

export async function startServer(port = Number(process.env.PORT ?? 2567)) {
  const app = express();
  app.use(express.json());
  app.use(corsMiddleware);

  // IdPool layout (18 network components → localComponentMin = 32):
  //   network:    1 – 31
  //   component:  32 – 899
  //   module:     900 – 999
  //   entity:     1000 – ∞ (Note: client will only consider entities up to 999,999 as "network entities")
  const world = createGameWorld();

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
