import {
  type ComponentClass,
  type QueryDSL,
  Relationship,
  type World,
} from '@vworlds/vecs';
import { Position as RenderPosition } from '@vworlds/vecs-phaser';
import {
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  WORLD_HEIGHT,
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
  WORLD_WIDTH,
} from '@spacerocks/common';

export const GRID_COLUMNS = Math.round(WORLD_WIDTH / VIEWPORT_WIDTH);
export const GRID_ROWS = Math.round(WORLD_HEIGHT / VIEWPORT_HEIGHT);
export const GRID_CELL_COUNT = GRID_COLUMNS * GRID_ROWS;
export const GRID_CELL_WIDTH = WORLD_WIDTH / GRID_COLUMNS;
export const GRID_CELL_HEIGHT = WORLD_HEIGHT / GRID_ROWS;
const RANDOM_POINT_CELL_MARGIN = 0.1;

type GridRandom = {
  range(min: number, max: number): number;
};

/**
 * Relationship pointing each networked entity at the grid-cell entity it
 * currently occupies. Retargeting it as an entity moves between cells is a
 * plain data change — no archetype churn, unlike swapping marker components.
 */
export class InCell extends Relationship {}

export const cellTagComponents: ComponentClass[] = Array.from(
  { length: GRID_CELL_COUNT },
  () => class CellTag {},
);

export function registerInterestGridComponents(world: World): void {
  world.component(InCell);
  for (const CellTag of cellTagComponents) world.component(CellTag);
}

export function createCellViewDSL(cellIndex: number): QueryDSL {
  return {
    any: neighbourIndices(cellIndex).map((index) => ({
      target: [InCell, cellTagComponents[index]!],
    })),
  };
}

export function neighbourIndices(cellIndex: number): number[] {
  const column = cellIndex % GRID_COLUMNS;
  const row = Math.floor(cellIndex / GRID_COLUMNS);
  const indices: number[] = [];

  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = row + dr;
      const c = column + dc;
      if (r < 0 || r >= GRID_ROWS || c < 0 || c >= GRID_COLUMNS) continue;
      indices.push(r * GRID_COLUMNS + c);
    }
  }

  return indices;
}

export function forEachNearbyCell(
  position: RenderPosition,
  visit: (cellIndex: number) => void,
): void {
  for (const cellIndex of neighbourIndices(getGridCellIndex(position))) {
    visit(cellIndex);
  }
}

export function getGridCellIndex(
  position: Pick<RenderPosition, 'x' | 'y'>,
): number {
  return gridRow(position.y) * GRID_COLUMNS + gridColumn(position.x);
}

export function randomPointInGridCell(
  cellIndex: number,
  rng: GridRandom,
): { x: number; y: number } {
  const column = cellIndex % GRID_COLUMNS;
  const row = Math.floor(cellIndex / GRID_COLUMNS);
  const minX = WORLD_MIN_X + column * GRID_CELL_WIDTH;
  const minY = WORLD_MIN_Y + row * GRID_CELL_HEIGHT;

  return {
    x: rng.range(
      minX + RANDOM_POINT_CELL_MARGIN,
      minX + GRID_CELL_WIDTH - RANDOM_POINT_CELL_MARGIN,
    ),
    y: rng.range(
      minY + RANDOM_POINT_CELL_MARGIN,
      minY + GRID_CELL_HEIGHT - RANDOM_POINT_CELL_MARGIN,
    ),
  };
}

export function gridColumn(x: number): number {
  return clampGridIndex(
    Math.floor(
      (clamp(x, WORLD_MIN_X, WORLD_MAX_X - Number.EPSILON) - WORLD_MIN_X) /
        GRID_CELL_WIDTH,
    ),
    GRID_COLUMNS,
  );
}

export function gridRow(y: number): number {
  return clampGridIndex(
    Math.floor(
      (clamp(y, WORLD_MIN_Y, WORLD_MAX_Y - Number.EPSILON) - WORLD_MIN_Y) /
        GRID_CELL_HEIGHT,
    ),
    GRID_ROWS,
  );
}

export function clampGridIndex(index: number, count: number): number {
  return Math.max(0, Math.min(count - 1, index));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
