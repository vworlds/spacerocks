import { PRE_STORE, type Entity, Module } from '@vworlds/vecs';
import { Position as RenderPosition } from '@vworlds/vecs-phaser';
import { NetworkClient, Networked, View } from '@vworlds/vecs-server';
import { Components } from './components';
import {
  cellTagComponents,
  createCellViewDSL,
  getGridCellIndex,
  InCell,
} from './grid';
import { getOwnedShip } from '../playerSessions/factories';

/**
 * Spatial interest management: assigns each networked entity to a grid cell
 * via the `InCell` relationship, and updates each client's `View` DSL to the
 * cell containing its owned ship (so the client only replicates nearby
 * entities). Depends on `PlayerSessionsModule` for `getOwnedShip`.
 */
export class InterestGridModule extends Module {
  override init(): void {
    this.world.module(Components);
    const world = this.world;

    const cellEntities = cellTagComponents.map((CellTag) =>
      world.entity().add(CellTag),
    );
    const cellViewDSL = cellTagComponents.map((_CellTag, index) =>
      createCellViewDSL(index),
    );

    function assignCell(entity: Entity, position: RenderPosition): void {
      const cell = cellEntities[getGridCellIndex(position)]!;
      if (entity.target(InCell) !== cell) {
        entity.set(InCell, { target: cell });
      }
    }

    function updateClientView(entity: Entity, view: View): void {
      const ship = getOwnedShip(entity);
      const position = ship?.get(RenderPosition);
      const dsl = position ? cellViewDSL[getGridCellIndex(position)]! : false;
      if (view.dsl !== dsl) {
        view.dsl = dsl;
        entity.modified(View);
      }
    }

    world
      .system('AssignCells')
      .with(Networked, RenderPosition)
      .phase(PRE_STORE)
      .enter((entity) => {
        const position = entity.get(RenderPosition);
        if (position) assignCell(entity, position);
      })
      .update(RenderPosition, (entity, position) =>
        assignCell(entity, position),
      );

    world
      .system('UpdatePlayerViews')
      .with(NetworkClient, View)
      .phase(PRE_STORE)
      .enter((entity) => {
        const view = entity.getMut(View);
        if (view) updateClientView(entity, view);
      })
      .each([View], (entity, [view]) => updateClientView(entity, view));
  }
}
