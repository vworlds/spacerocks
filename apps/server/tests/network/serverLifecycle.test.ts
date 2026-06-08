import { describe, expect, it } from 'vitest';
import type { AddressInfo } from 'node:net';
import { createServer } from 'node:http';
import { stopServer } from '../../src/serverLifecycle';

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
});
