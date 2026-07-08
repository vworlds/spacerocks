import { describe, expect, it } from 'vitest';

import {
  CONTAINER_SIZE,
  RESOURCE_DISPLAY,
  RESOURCE_TYPES,
  type ResourceType,
} from '../src/index';

describe('ResourceType', () => {
  it('is the three normative resource names in (ore, crystal, alloy) order', () => {
    expect(RESOURCE_TYPES).toEqual(['ore', 'crystal', 'alloy']);
  });

  it('lines up with the Price keys', async () => {
    const { PRICE_RESOURCES } = await import('../src/index');
    expect(PRICE_RESOURCES).toEqual(RESOURCE_TYPES);
  });
});

describe('RESOURCE_DISPLAY', () => {
  it('covers every ResourceType', () => {
    for (const type of RESOURCE_TYPES) {
      expect(RESOURCE_DISPLAY[type]).toBeDefined();
    }
  });

  it('each entry has a u32 RGB color and a single-character string', () => {
    for (const type of RESOURCE_TYPES) {
      const entry = RESOURCE_DISPLAY[type];
      expect(typeof entry.color).toBe('number');
      expect(Number.isInteger(entry.color)).toBe(true);
      expect(entry.color).toBeGreaterThanOrEqual(0);
      expect(entry.color).toBeLessThanOrEqual(0xffffff);
      expect(typeof entry.char).toBe('string');
      expect(entry.char.length).toBe(1);
    }
  });

  it('colors are visually distinct across the three types', () => {
    const colors = RESOURCE_TYPES.map((t) => RESOURCE_DISPLAY[t].color);
    expect(new Set(colors).size).toBe(RESOURCE_TYPES.length);
  });

  it('chars are distinct across the three types', () => {
    const chars = RESOURCE_TYPES.map((t) => RESOURCE_DISPLAY[t].char);
    expect(new Set(chars).size).toBe(RESOURCE_TYPES.length);
  });

  it('uses the expected per-type identity (Ore=O, Crystal=C, Alloy=A)', () => {
    expect(RESOURCE_DISPLAY.ore.char).toBe('O');
    expect(RESOURCE_DISPLAY.crystal.char).toBe('C');
    expect(RESOURCE_DISPLAY.alloy.char).toBe('A');
  });
});

describe('CONTAINER_SIZE', () => {
  it('is a positive number of meters', () => {
    expect(typeof CONTAINER_SIZE).toBe('number');
    expect(CONTAINER_SIZE).toBeGreaterThan(0);
  });
});

describe('exports', () => {
  it('re-exports ResourceType as a type', () => {
    const sample: ResourceType = 'ore';
    expect(sample).toBe('ore');
  });
});
