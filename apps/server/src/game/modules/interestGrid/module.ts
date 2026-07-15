import { PRE_STORE, type Entity, Module } from '@vworlds/vecs';
import {
  DrawBy,
  DrawIn,
  Position as RenderPosition,
} from '@vworlds/vecs-phaser';
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

    // Cascade InCell from parent to display children that don't have their
    // own RenderPosition (e.g. children parented via DrawIn or DrawBy).
    // Without this, parented children are invisible in cell-based views
    // because they never get an InCell assignment. Uses InCell onSet/onRemove
    // hooks so the cascade is immediate.
    world.component(InCell).onSet((entity) => {
      const cell = entity.target(InCell);
      for (const relationship of [DrawIn, DrawBy]) {
        for (const child of entity.children(relationship)) {
          if (child.has(Networked) && !child.has(RenderPosition)) {
            if (child.target(InCell) !== cell) {
              child.set(InCell, { target: cell! });
            }
          }
        }
      }
    });

    world.component(InCell).onRemove((entity) => {
      for (const relationship of [DrawIn, DrawBy]) {
        for (const child of entity.children(relationship)) {
          if (
            child.has(Networked) &&
            !child.has(RenderPosition) &&
            child.has(InCell)
          ) {
            child.remove(InCell);
          }
        }
      }
    });

    world
      .system('AssignDisplayChildCells')
      .with(Networked)
      .phase(PRE_STORE)
      .update({ watch: DrawBy, onEnter: true }, (entity, drawBy) => {
        const cell = drawBy.target.target(InCell);
        if (cell && entity.target(InCell) !== cell) {
          entity.set(InCell, { target: cell });
        }
      });

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
