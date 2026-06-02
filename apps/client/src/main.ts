import type { ClientWorld } from '@vworlds/vecs-client';
import { createClientWorld } from './network/vecsClient';
import { initStars } from './utils';
import type { Star } from './types';

const RECONNECT_DELAY_MS = 1_000;

const GAME_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyD',
  'ArrowUp',
  'ArrowLeft',
  'ArrowRight',
  'Space',
  'Enter',
]);

type Intent = {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  shoot: boolean;
};

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const scoreEl = document.getElementById('score');
  const waveEl = document.getElementById('wave');
  const msgEl = document.getElementById('msg');
  if (!(canvas instanceof HTMLCanvasElement) || !scoreEl || !waveEl || !msgEl) {
    throw new Error('Required DOM elements not found');
  }

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  let stars: Star[] = initStars(canvas.width, canvas.height);
  const renderTarget = {
    ctx,
    canvas,
    get stars(): Star[] {
      return stars;
    },
  };
  window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = initStars(canvas.width, canvas.height);
  });

  const keys = new Set<string>();
  window.addEventListener('keydown', (event) => {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    keys.add(event.code);
  });
  window.addEventListener('keyup', (event) => {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    keys.delete(event.code);
  });
  function readIntent(): Intent {
    return {
      thrust: keys.has('KeyW') || keys.has('ArrowUp'),
      rotateLeft: keys.has('KeyA') || keys.has('ArrowLeft'),
      rotateRight: keys.has('KeyD') || keys.has('ArrowRight'),
      shoot: keys.has('Space') || keys.has('Enter'),
    };
  }

  let active: ClientWorld | undefined;
  let connecting = false;
  let reconnectTimer: number | undefined;

  async function connect(): Promise<void> {
    if (active || connecting) return;
    connecting = true;
    const tStart = performance.now();
    try {
      const world = await createClientWorld({
        renderTarget,
        ui: { scoreEl: scoreEl!, waveEl: waveEl!, msgEl: msgEl! },
      });
      const tReady = performance.now();
      console.info(
        `[main] world ready ${(tReady - tStart).toFixed(1)}ms after connect()`,
      );
      world.onDisconnect(() => {
        if (active !== world) return;
        const lifetime = performance.now() - tReady;
        console.warn(
          `[main] disconnect after ${lifetime.toFixed(1)}ms of active session`,
        );
        keys.clear();
        world.clearAllEntities();
        active = undefined;
        msgEl!.innerText = 'Disconnected. Reconnecting…';
        scheduleReconnect();
      });
      active = world;
      msgEl!.innerText = '';
    } catch (error) {
      console.warn('vecs client connection failed', error);
      msgEl!.innerText = 'Connecting…';
      scheduleReconnect();
    } finally {
      connecting = false;
    }
  }

  function scheduleReconnect(): void {
    if (reconnectTimer !== undefined) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined;
      void connect();
    }, RECONNECT_DELAY_MS);
  }

  void connect();

  let last = performance.now();
  function frame(now: number): void {
    const delta = now - last;
    last = now;
    if (active) {
      active.setInput(readIntent());
      active.progress(now, delta);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
