import type { ClientWorld } from '@vworlds/vecs-client';
import { createClientWorld } from './network/vecsClient';
import { WORLD_WIDTH, WORLD_HEIGHT } from '@spacerocks/common';
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

function computeViewport(
  windowW: number,
  windowH: number,
  aspectW: number,
  aspectH: number,
): { width: number; height: number } {
  const aspect = aspectW / aspectH;
  let width = windowW;
  let height = Math.round(windowW / aspect);
  if (height > windowH) {
    height = windowH;
    width = Math.round(windowH * aspect);
  }
  return { width, height };
}

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('gameCanvas');
  const scoreEl = document.getElementById('score');
  const waveEl = document.getElementById('wave');
  const msgEl = document.getElementById('msg');
  if (!(canvas instanceof HTMLCanvasElement) || !scoreEl || !waveEl || !msgEl) {
    throw new Error('Required DOM elements not found');
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get 2D canvas context');

  let stars: Star[] = [];

  function resizeCanvas(): void {
    const c = canvas as HTMLCanvasElement;
    const vp = computeViewport(
      window.innerWidth,
      window.innerHeight,
      WORLD_WIDTH,
      WORLD_HEIGHT,
    );
    c.width = vp.width;
    c.height = vp.height;
    c.style.marginLeft = `${Math.round((window.innerWidth - vp.width) / 2)}px`;
    c.style.marginTop = `${Math.round((window.innerHeight - vp.height) / 2)}px`;
    stars = initStars(c.width, c.height);
  }

  resizeCanvas();

  const renderTarget = {
    ctx,
    canvas,
    get stars(): Star[] {
      return stars;
    },
  };
  window.addEventListener('resize', resizeCanvas);

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
      world.events.on('disconnect', () => {
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
