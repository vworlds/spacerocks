import type { Server as HttpServer } from 'node:http';

type ServerSession = { socket?: { close: () => void } };

export type ServerLifecycleHandle = {
  server: HttpServer;
  world: unknown;
  tick: NodeJS.Timeout;
};

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
