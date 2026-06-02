import express from 'express';
import type { Server as HttpServer } from 'node:http';
import { ServerWorld, VecsListener, View } from '@vworlds/vecs-server';
import { NETWORK_COMPONENTS } from '@spacerocks/common';
import { logger } from './logger';
import {
  installPlayerSessionSystems,
  registerPlayerSessionComponents,
} from './game/playerSessions';

const TICK_RATE = 60;
const TICK_INTERVAL_MS = 1000 / TICK_RATE;

export async function startServer(port = Number(process.env.PORT ?? 2567)) {
  const app = express();
  app.use(express.json());

  const world = new ServerWorld({
    name: 'main',
    networkComponents: NETWORK_COMPONENTS,
  });
  const simulationPhase = world.addPhase('simulation');
  const collectPhase = world.addPhase('collect');
  const sendPhase = world.addPhase('send');
  registerPlayerSessionComponents(world);
  installPlayerSessionSystems(world, simulationPhase);

  world
    .system('SetClientView')
    .phase(collectPhase)
    .requires(View)
    .each([View], (_entity, [view]) => {
      view.dsl = true;
    });

  world.installSystems({ collectPhase, sendPhase });
  world.start();

  const vecsListener = new VecsListener();
  vecsListener.registerWorld(world);
  await vecsListener.listen(app, { ordered: false, maxRetransmits: 2 });

  const server = await new Promise<HttpServer>((resolve, reject) => {
    const listeningServer = app.listen(port);
    const onError = (error: Error) => {
      reject(error);
    };

    listeningServer.once('error', onError);
    listeningServer.once('listening', () => {
      listeningServer.off('error', onError);
      resolve(listeningServer);
    });
  });

  let lastTick = performance.now();
  const tick = setInterval(() => {
    const now = performance.now();
    const delta = now - lastTick;
    lastTick = now;
    world.progress(now, delta);
  }, TICK_INTERVAL_MS);

  return { app, server, world, vecsListener, tick, simulationPhase, port };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
    .then(({ port }) => {
      logger.info(
        { port },
        `spacerocks server listening on http://localhost:${port}`,
      );
    })
    .catch((error: unknown) => {
      logger.error({ error }, 'failed to start spacerocks server');
      process.exitCode = 1;
    });
}
