import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { corsMiddleware } from '../../src/cors';

let server: Server | null = null;

afterEach(async () => {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server?.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  server = null;
});

describe('CORS preflight', () => {
  it('answers browser preflight requests for the vecs RTC connection endpoint', async () => {
    const app = express();
    app.use(corsMiddleware);
    server = await new Promise<Server>((resolve) => {
      const listeningServer = app.listen(0, () => resolve(listeningServer));
    });
    const address = server.address() as AddressInfo;

    const response = await fetch(
      `http://127.0.0.1:${address.port}/rtc/v1/world/main/connection`,
      {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5173',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'content-type',
        },
      },
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
    expect(response.headers.get('access-control-allow-methods')).toBe(
      'GET,POST,OPTIONS',
    );
    expect(response.headers.get('access-control-allow-headers')).toBe(
      'Content-Type',
    );
  });
});
