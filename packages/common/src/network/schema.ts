import type { ComponentClass } from '@vworlds/vecs';
import { phaserNetworkComponents } from '@vworlds/vecs-phaser';
import {
  Explosion,
  Hyperspace,
  Owner,
  ProgressBar,
  ResourceContainer,
} from '../components';

export const NETWORK_COMPONENTS = [
  ...phaserNetworkComponents, // type ids 1..21 — ORDER IS THE PROTOCOL, do not reorder
  Explosion, // type id 22
  Owner, // type id 23
  Hyperspace, // type id 24
  ProgressBar, // type id 25
  ResourceContainer, // type id 26
] satisfies readonly ComponentClass[];
