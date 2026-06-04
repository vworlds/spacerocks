import { ClientWorld } from '@vworlds/vecs-client';
import {
  CLIENT_ENTITY_ID_START,
  Decay,
  NETWORK_COMPONENTS,
  Velocity,
} from '@spacerocks/common';
import { Alpha } from '../components/Alpha';
import { Label } from '../components/Label';
import { Particle } from '../components/Particle';
import { installRenderSystem, type RenderTarget } from '../systems/Render';
import { installUISystem, type UITargets } from '../systems/UI';
import { installParticleSystem } from '../systems/Particles';
import { installExplosionSystem } from '../systems/Explosion';
import { installAlphaDrawSystem } from '../systems/draw/AlphaSystem';
import { installArcDrawSystem } from '../systems/draw/ArcSystem';
import { installFilledRectDrawSystem } from '../systems/draw/FilledRectSystem';
import { installFillStyleDrawSystem } from '../systems/draw/FillStyleSystem';
import { installHealthDrawSystem } from '../systems/draw/HealthDraw';
import { installLabelDrawSystem } from '../systems/draw/LabelSystem';
import { installLaserBeamDrawSystem } from '../systems/draw/LaserBeamDraw';
import { installShapeDrawSystem } from '../systems/draw/ShapeSystem';
import { installShieldDrawSystem } from '../systems/draw/ShieldDraw';
import { installStrokeStyleDrawSystem } from '../systems/draw/StrokeStyleSystem';

const SERVER_PORT = 2567; // port
const WORLD_NAME = 'main';
const API_BASE_PATH = '/rtc/v1';

export type ClientWorldConfig = {
  renderTarget: RenderTarget;
  ui: UITargets;
};

type DgramClientSocket = {
  connect(): Promise<void>;
  on(event: string, handler: (...args: unknown[]) => void): void;
  send(data: Uint8Array): void;
  close(): void;
};

// Build the entire world (component registration + phases + systems + start)
// BEFORE opening the WebRTC data channel. The server starts a 5-frame (~166ms
// at 30Hz) ack budget the moment its data channel emits open, and the
// build-and-start work can take several hundred milliseconds on first load.
// Doing it before the socket connects keeps the first ack well within budget.
export async function createClientWorld(
  config: ClientWorldConfig,
): Promise<ClientWorld> {
  const t0 = performance.now();
  const dgramModule = await import('@vworlds/dgram-client');
  const tImport = performance.now();
  // The dgram ClientSocket is structurally a VecsSocket but its eventemitter
  // overloads do not line up at the type level — ClientWorld.connectDgram does
  // the same `as unknown as` cast internally.
  const ClientSocketCtor = dgramModule.ClientSocket as unknown as new (
    url: string,
    rtcConfig: RTCConfiguration,
  ) => DgramClientSocket;

  const protocol = window.location.protocol === 'https:' ? 'https' : 'http';
  const host = window.location.hostname;
  const url = `${protocol}://${host}:${SERVER_PORT}${API_BASE_PATH}/world/${WORLD_NAME}`;
  const socket = new ClientSocketCtor(url, {});

  // IdPool layout (18 network components → localComponentMin = 32,
  // localEntityIdStart = 1_000_000):
  //   network:         1 – 31
  //   component:       32 – 899
  //   module:          900 – 999
  //   network_entity:  1000 – 999,999 (server-owned entities replicated to the client)
  //   entity:          1,000,000 – ∞ (local entities in the client)
  const world = new ClientWorld({
    networkComponents: NETWORK_COMPONENTS,
    localEntityIdStart: CLIENT_ENTITY_ID_START,
  });

  world.component(Velocity);
  world.component(Decay);
  world.component(Alpha);
  world.component(Label);
  world.component(Particle);

  const applyPhase = world.addPhase('apply');
  const updatePhase = world.addPhase('update');
  const renderPhase = world.addPhase('render');

  world.installSystems({ applyPhase });

  installParticleSystem(world, updatePhase);
  installExplosionSystem(world, updatePhase);

  installAlphaDrawSystem(world, renderPhase);
  installArcDrawSystem(world, renderPhase);
  installFilledRectDrawSystem(world, renderPhase);
  installFillStyleDrawSystem(world, renderPhase);
  installStrokeStyleDrawSystem(world, renderPhase);
  installShapeDrawSystem(world, renderPhase);
  installLabelDrawSystem(world, renderPhase);
  installHealthDrawSystem(world, renderPhase);
  installShieldDrawSystem(world, renderPhase);
  installLaserBeamDrawSystem(world, renderPhase);

  installRenderSystem(world, renderPhase, config.renderTarget);
  installUISystem(world, renderPhase, config.ui);

  world.start();
  const tStarted = performance.now();

  // Attach the socket only once the world is ready to ack. attachSocket only
  // subscribes to "receive"; nothing fires until the data channel opens.
  world.attachSocket(
    socket as unknown as Parameters<ClientWorld['attachSocket']>[0],
  );
  await socket.connect();
  const tConnected = performance.now();

  console.info(
    `[vecs] import=${(tImport - t0).toFixed(0)}ms ` +
      `setup+start=${(tStarted - tImport).toFixed(0)}ms ` +
      `socket.connect=${(tConnected - tStarted).toFixed(0)}ms ` +
      `(total=${(tConnected - t0).toFixed(0)}ms)`,
  );
  return world;
}
