import { ClientWorld } from '@vworlds/vecs-client';
import { CLIENT_ENTITY_ID_START, NETWORK_COMPONENTS } from '@spacerocks/common';

const SERVER_PORT = 2567;
const WORLD_NAME = 'main';
const RECONNECT_DELAY_MS = 1_000;
const NETWORK_TICK_INTERVAL_MS = 1000 / 60;

export type PlayerInputIntent = {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  shoot: boolean;
};

type KeyboardInputSource = {
  readInput(): PlayerInputIntent;
};

let client: ClientWorld | null = null;
let reconnectTimer: number | null = null;
let networkTimer: number | null = null;
let lastNetworkTick = 0;
let connecting = false;
let latestInput: PlayerInputIntent = {
  thrust: false,
  rotateLeft: false,
  rotateRight: false,
  shoot: false,
};

export function createKeyboardInputSource(
  target: Pick<Window, 'addEventListener'> = window,
): KeyboardInputSource {
  const keys = new Set<string>();

  target.addEventListener('keydown', (event) => {
    keys.add(event.code);
  });
  target.addEventListener('keyup', (event) => {
    keys.delete(event.code);
  });

  return {
    readInput: () => ({
      thrust: keys.has('KeyW') || keys.has('ArrowUp'),
      rotateLeft: keys.has('KeyA') || keys.has('ArrowLeft'),
      rotateRight: keys.has('KeyD') || keys.has('ArrowRight'),
      shoot: keys.has('Space') || keys.has('Enter'),
    }),
  };
}

export async function connectVecsClient(): Promise<void> {
  if (client || connecting) return;
  connecting = true;

  try {
    const nextClient = await ClientWorld.connectDgram({
      host: window.location.hostname,
      port: SERVER_PORT,
      protocol: window.location.protocol === 'https:' ? 'https' : 'http',
      worldName: WORLD_NAME,
      networkComponents: NETWORK_COMPONENTS,
      localEntityIdStart: CLIENT_ENTITY_ID_START,
    });

    const applyPhase = nextClient.addPhase('apply');
    const sendPhase = nextClient.addPhase('send');
    nextClient.installSystems({ applyPhase, sendPhase });
    nextClient.start();
    nextClient.onDisconnect(() => {
      if (client !== nextClient) return;
      stopNetworkTicker();
      nextClient.clearAllEntities();
      client = null;
      scheduleReconnect();
    });

    client = nextClient;
    startNetworkTicker(nextClient);
    console.info(`Connected to vecs world "${WORLD_NAME}"`);
  } catch (error) {
    console.warn('Vecs client connection unavailable', error);
    scheduleReconnect();
  } finally {
    connecting = false;
  }
}

export function tickVecsClient(
  input: PlayerInputIntent,
  _now: number,
  _delta: number,
): void {
  latestInput = input;
}

export function getVecsClientWorld(): ClientWorld | null {
  return client;
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) return;

  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    void connectVecsClient();
  }, RECONNECT_DELAY_MS);
}

function startNetworkTicker(nextClient: ClientWorld): void {
  stopNetworkTicker();
  lastNetworkTick = performance.now();
  progressNetworkClient(nextClient, lastNetworkTick);
  networkTimer = window.setInterval(() => {
    progressNetworkClient(nextClient, performance.now());
  }, NETWORK_TICK_INTERVAL_MS);
}

function stopNetworkTicker(): void {
  if (networkTimer === null) return;

  window.clearInterval(networkTimer);
  networkTimer = null;
}

function progressNetworkClient(nextClient: ClientWorld, now: number): void {
  if (client !== nextClient) return;

  const delta = Math.max(0, now - lastNetworkTick);
  lastNetworkTick = now;
  nextClient.setInput(latestInput);
  nextClient.progress(now, delta);
}
