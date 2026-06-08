import type { Server as HttpServer } from 'node:http';

type ListenApp = { listen: (port: number) => HttpServer };
type ServerSession = { socket?: { close: () => void } };

export type ServerLifecycleHandle = {
  server: HttpServer;
  world: unknown;
  tick: NodeJS.Timeout;
};

export async function listenWithRetry(
  app: ListenApp,
  port: number,
  retryAttempts = 50,
  retryDelayMs = 100,
) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await listenOnce(app, port);
    } catch (error) {
      if (
        (error as NodeJS.ErrnoException).code !== 'EADDRINUSE' ||
        attempt >= retryAttempts
      ) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}

export async function stopServer({
  server,
  world,
  tick,
}: ServerLifecycleHandle) {
  clearInterval(tick);

  const sessions = (world as { _sessions?: Map<string, ServerSession> })
    ._sessions;
  sessions?.forEach((session) => session.socket?.close());

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (
        error &&
        (error as NodeJS.ErrnoException).code !== 'ERR_SERVER_NOT_RUNNING'
      ) {
        reject(error);
        return;
      }

      resolve();
    });

    server.closeAllConnections?.();
  });
}

async function listenOnce(app: ListenApp, port: number) {
  return await new Promise<HttpServer>((resolve, reject) => {
    const listeningServer = app.listen(port);
    const onError = (error: Error) => {
      listeningServer.off('listening', onListening);
      reject(error);
    };
    const onListening = () => {
      listeningServer.off('error', onError);
      resolve(listeningServer);
    };

    listeningServer.once('error', onError);
    listeningServer.once('listening', onListening);
  });
}
