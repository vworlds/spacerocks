import type { ClientWorld } from '@vworlds/vecs-client';
import Phaser from 'phaser';
import { createClientWorld } from './network/vecsClient';
import {
  PIXELS_PER_METER,
  WORLD_HEIGHT,
  WORLD_WIDTH,
} from '@spacerocks/common';

const RECONNECT_DELAY_MS = 1_000; // ms
const STAR_COUNT = 200;
const CANVAS_WIDTH = WORLD_WIDTH * PIXELS_PER_METER;
const CANVAS_HEIGHT = WORLD_HEIGHT * PIXELS_PER_METER;

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

const keys = new Set<string>();
let active: ClientWorld | undefined;
let connecting = false;
let reconnectTimer: number | undefined;
let statusText = 'Connecting...';

window.addEventListener('keydown', (event) => {
  if (GAME_KEYS.has(event.code)) event.preventDefault();
  keys.add(event.code);
});

window.addEventListener('keyup', (event) => {
  if (GAME_KEYS.has(event.code)) event.preventDefault();
  keys.delete(event.code);
});

class GameScene extends Phaser.Scene {
  private _statusText: Phaser.GameObjects.Text | undefined;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.drawStarfield();

    // Client chrome lives along the BOTTOM edge so it never overlaps the
    // server-owned Score/Wave HUD Text entities, which render at the top-left.
    this.add
      .text(16, CANVAS_HEIGHT - 28, 'P1: WASD+Space  P2: Arrows+Enter', {
        color: '#e2e8f0',
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
      })
      .setDepth(10_000);

    this._statusText = this.add
      .text(16, CANVAS_HEIGHT - 50, '', {
        color: '#fecaca',
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
      })
      .setDepth(10_000);

    void connect(this);
  }

  override update(time: number, delta: number): void {
    this._statusText?.setText(active ? '' : statusText);
    if (!active) return;

    active.setInput(readIntent());
    active.progress(time, delta);
  }

  private drawStarfield(): void {
    const graphics = this.add.graphics().setDepth(-10_000);

    for (let i = 0; i < STAR_COUNT; i++) {
      const x = Math.random() * CANVAS_WIDTH;
      const y = Math.random() * CANVAS_HEIGHT;
      const radius = Math.max(0.5, Math.random() * 1.5);
      const alpha = 0.25 + Math.random() * 0.75;
      graphics.fillStyle(0xffffff, alpha);
      graphics.fillCircle(x, y, radius);
    }
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  backgroundColor: '#000010',
  scene: GameScene,
});

function readIntent(): Intent {
  return {
    thrust: keys.has('KeyW') || keys.has('ArrowUp'),
    rotateLeft: keys.has('KeyA') || keys.has('ArrowLeft'),
    rotateRight: keys.has('KeyD') || keys.has('ArrowRight'),
    shoot: keys.has('Space') || keys.has('Enter'),
  };
}

async function connect(scene: Phaser.Scene): Promise<void> {
  if (active || connecting) return;
  connecting = true;
  statusText = 'Connecting...';
  const tStart = performance.now();

  try {
    const world = await createClientWorld({ scene });
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
      scheduleReconnect('Disconnected. Reconnecting...', scene);
    });

    active = world;
    statusText = '';
  } catch (error) {
    console.warn('vecs client connection failed', error);
    scheduleReconnect('Connecting...', scene);
  } finally {
    connecting = false;
  }
}

function scheduleReconnect(status: string, scene: Phaser.Scene): void {
  keys.clear();
  statusText = status;
  active = undefined;
  if (reconnectTimer !== undefined) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = undefined;
    void connect(scene);
  }, RECONNECT_DELAY_MS);
}
