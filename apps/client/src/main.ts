import type { ClientWorld } from '@vworlds/vecs-client';
import { Position } from '@vworlds/vecs-phaser';
import { CoordSpace } from '@vworlds/vecs-phaser-client';
import Phaser from 'phaser';
import { createClientWorld, findLocalShipEntity } from './network/vecsClient';
import { playHyperspaceEffect } from './render/HyperspaceEffect';
import {
  PIXELS_PER_METER,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  WORLD_HEIGHT,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
  WORLD_SCALE,
  WORLD_WIDTH,
} from '@spacerocks/common';

const RECONNECT_DELAY_MS = 1_000; // ms
const STAR_COUNT = 200;
const CANVAS_WIDTH = VIEWPORT_WIDTH * PIXELS_PER_METER;
const CANVAS_HEIGHT = VIEWPORT_HEIGHT * PIXELS_PER_METER;

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
export let localClientId = '';

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
  private _coords: CoordSpace | undefined;
  private _previousLocalShipPosition:
    | { eid: number; x: number; y: number }
    | undefined;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this._coords = new CoordSpace(this, PIXELS_PER_METER);
    this.cameras.main.setBounds(
      this._coords.x(WORLD_MIN_X),
      this._coords.y(WORLD_MAX_Y),
      WORLD_WIDTH * PIXELS_PER_METER,
      WORLD_HEIGHT * PIXELS_PER_METER,
    );

    this.drawStarfield();

    // Client chrome is pinned to the screen so it stays readable as the camera moves.
    this.add
      .text(16, CANVAS_HEIGHT - 28, 'P1: WASD+Space  P2: Arrows+Enter', {
        color: '#e2e8f0',
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
      })
      .setScrollFactor(0)
      .setDepth(10_000);

    this._statusText = this.add
      .text(16, CANVAS_HEIGHT - 50, '', {
        color: '#fecaca',
        fontFamily: 'Courier New, monospace',
        fontSize: '14px',
      })
      .setScrollFactor(0)
      .setDepth(10_000);

    void connect(this);
  }

  override update(time: number, delta: number): void {
    this._statusText?.setText(active ? '' : statusText);
    if (!active) return;

    active.setInput(readIntent());
    active.progress(time, delta);

    const ship = findLocalShipEntity(active, localClientId);
    const position = ship?.get(Position);
    if (ship && position && this._coords) {
      const previous = this._previousLocalShipPosition;
      if (previous?.eid === ship.eid) {
        const wrapped =
          Math.abs(position.x - previous.x) > WORLD_WIDTH / 2 ||
          Math.abs(position.y - previous.y) > WORLD_HEIGHT / 2;
        if (wrapped) playHyperspaceEffect(this);
      }

      this._previousLocalShipPosition = {
        eid: ship.eid,
        x: position.x,
        y: position.y,
      };
      this.cameras.main.centerOn(
        this._coords.x(position.x),
        this._coords.y(position.y),
      );
    } else {
      this._previousLocalShipPosition = undefined;
    }
  }

  private drawStarfield(): void {
    const coords = this._coords;
    if (!coords) return;

    const graphics = this.add.graphics().setDepth(-10_000);
    const starCount = STAR_COUNT * WORLD_SCALE * WORLD_SCALE;

    for (let i = 0; i < starCount; i++) {
      const worldX = WORLD_MIN_X + Math.random() * (WORLD_MAX_X - WORLD_MIN_X);
      const worldY = WORLD_MIN_Y + Math.random() * (WORLD_MAX_Y - WORLD_MIN_Y);
      const radius = Math.max(0.5, Math.random() * 1.5);
      const alpha = 0.25 + Math.random() * 0.75;
      graphics.fillStyle(0xffffff, alpha);
      graphics.fillCircle(coords.x(worldX), coords.y(worldY), radius);
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
    const { world, clientId } = await createClientWorld({ scene });
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
      localClientId = '';
      scheduleReconnect('Disconnected. Reconnecting...', scene);
    });

    active = world;
    localClientId = clientId;
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
  localClientId = '';
  if (reconnectTimer !== undefined) return;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = undefined;
    void connect(scene);
  }, RECONNECT_DELAY_MS);
}
