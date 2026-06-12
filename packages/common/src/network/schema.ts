import type { ComponentClass } from '@vworlds/vecs';
import { phaserNetworkComponents } from '@vworlds/vecs-phaser';
import { Explosion } from '../components';

export const NETWORK_COMPONENTS = [
  ...phaserNetworkComponents, // type ids 1..16 — ORDER IS THE PROTOCOL, do not reorder
  Explosion, // type id 17
] satisfies readonly ComponentClass[];
