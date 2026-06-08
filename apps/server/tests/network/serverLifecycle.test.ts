import { describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';
import { listenWithRetry, stopServer } from '../../src/serverLifecycle';

describe('server lifecycle', () => {
  it('closes Vecs sessions and releases its listening port for dev watcher restarts', async () => {
    const server = createServer();
    const tick = setInterval(() => undefined, 1000);
    let sessionClosed = false;
    const world = {
      _sessions: new Map([
        ['client-a', { socket: { close: () => (sessionClosed = true) } }],
      ]),
    };

    await new Promise<void>((resolve) => {
      server.listen(0, resolve);
    });
    const port = (server.address() as AddressInfo).port;

    await stopServer({ server, world, tick });

    expect(sessionClosed).toBe(true);

    const nextServer = createServer();
    await new Promise<void>((resolve, reject) => {
      nextServer.once('error', reject);
      nextServer.listen(port, resolve);
    });

    await new Promise<void>((resolve, reject) => {
      nextServer.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  });

  it('waits for the previous watcher child to release the port', async () => {
    const occupyingServer = createServer();

    await new Promise<void>((resolve) => {
      occupyingServer.listen(0, resolve);
    });
    const port = (occupyingServer.address() as AddressInfo).port;

    const nextServerPromise = listenWithRetry(createServer(), port, 10, 20);

    setTimeout(() => {
      occupyingServer.close();
    }, 30);

    const nextServer = await nextServerPromise;

    try {
      expect((nextServer.address() as AddressInfo).port).toBe(port);
    } finally {
      await new Promise<void>((resolve, reject) => {
        nextServer.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    }
  });
});
