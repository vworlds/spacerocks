import { Module } from '@vworlds/vecs';
import { InCell, cellTagComponents } from './grid';

export { InCell, cellTagComponents } from './grid';

/**
 * Registers the `InCell` relationship and the per-cell tag components used by
 * the interest grid's `View` DSL.
 */
export class Components extends Module {
  override init(): void {
    this.world.component(InCell);
    for (const CellTag of cellTagComponents) this.world.component(CellTag);
  }
}
