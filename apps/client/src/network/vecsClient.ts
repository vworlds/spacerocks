import { ClientWorld } from '@vworlds/vecs-client';
import { CLIENT_ENTITY_ID_START, NETWORK_COMPONENTS } from '@spacerocks/common';

const SERVER_PORT = 2567;
const WORLD_NAME = 'main';
const RECONNECT_DELAY_MS = 1_000;

export type PlayerInputIntent = {
  thrust: boolean;
  rotateLeft: boolean;
  rotateRight: boolean;
  shoot: boolean;
};

type KeyboardInputSource = {
  readInput(): PlayerInputIntent;
};

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

let client: ClientWorld | null = null;
let reconnectTimer: number | null = null;
let connecting = false;

export function createKeyboardInputSource(
  target: Pick<Window, 'addEventListener'> = window,
): KeyboardInputSource {
  const keys = new Set<string>();

  target.addEventListener('keydown', (event) => {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
    keys.add(event.code);
  });
  target.addEventListener('keyup', (event) => {
    if (GAME_KEYS.has(event.code)) event.preventDefault();
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
      nextClient.clearAllEntities();
      client = null;
      scheduleReconnect();
    });

    client = nextClient;
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
  now: number,
  delta: number,
): void {
  if (!client) return;

  client.setInput(input);
  client.progress(now, delta);
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
