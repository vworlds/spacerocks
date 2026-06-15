import { describe, expect, it } from 'vitest';
import {
  WORLD_MAX_X,
  WORLD_MAX_Y,
  WORLD_MIN_X,
  WORLD_MIN_Y,
} from '@spacerocks/common';
import {
  cellTagComponents,
  createCellViewDSL,
  getGridCellIndex,
  GRID_COLUMNS,
  GRID_ROWS,
  gridColumn,
  gridRow,
  InCell,
  neighbourIndices,
} from '../../src/network/interestGrid';

describe('server view replication', () => {
  it('derives a viewport-sized grid from the world dimensions', () => {
    expect(GRID_COLUMNS).toBe(5);
    expect(GRID_ROWS).toBe(5);
  });

  it('maps positions to edge-clamped grid cells', () => {
    expect(gridColumn(WORLD_MIN_X)).toBe(0);
    expect(gridRow(WORLD_MIN_Y)).toBe(0);
    expect(getGridCellIndex({ x: 0, y: 0 })).toBe(12);
    expect(getGridCellIndex({ x: WORLD_MAX_X, y: WORLD_MAX_Y })).toBe(24);
    expect(
      getGridCellIndex({ x: WORLD_MIN_X - 100, y: WORLD_MIN_Y - 100 }),
    ).toBe(0);
    expect(
      getGridCellIndex({ x: WORLD_MAX_X + 100, y: WORLD_MAX_Y + 100 }),
    ).toBe(24);
  });

  it('returns clamped 3x3 neighbourhoods for corners, edges, and centers', () => {
    expect(neighbourIndices(0)).toEqual([0, 1, 5, 6]);
    expect(neighbourIndices(2)).toEqual([1, 2, 3, 6, 7, 8]);
    expect(neighbourIndices(10)).toEqual([5, 6, 10, 11, 15, 16]);
    expect(neighbourIndices(12)).toEqual([6, 7, 8, 11, 12, 13, 16, 17, 18]);
  });

  it('builds per-cell view DSLs from neighbour cell tags', () => {
    expect(createCellViewDSL(12)).toEqual({
      any: [6, 7, 8, 11, 12, 13, 16, 17, 18].map((index) => ({
        target: [InCell, cellTagComponents[index]],
      })),
    });
  });
});
