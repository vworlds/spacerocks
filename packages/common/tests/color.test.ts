import { describe, expect, it } from 'vitest';

import { parseColor, PICKUP_COLORS, PLAYER_COLORS } from '../src/index';

describe('parseColor', () => {
  it('parses supported hex forms to u32 RGB', () => {
    expect(parseColor('#fff')).toBe(0xffffff);
    expect(parseColor('#0f0')).toBe(0x00ff00);
    expect(parseColor('#ff6600')).toBe(0xff6600);
    expect(parseColor('#00ffcc')).toBe(0x00ffcc);
    expect(parseColor('aaa')).toBe(0xaaaaaa);
  });

  it('throws on invalid input', () => {
    expect(() => parseColor('not-a-color')).toThrow();
  });
});

describe('color palettes', () => {
  it('exports player colors as u32 RGB values', () => {
    expect(PLAYER_COLORS[0]).toBe(0x00ffcc);
  });

  it('exports pickup colors by kind', () => {
    expect(PICKUP_COLORS.shield).toBe(0x00ff00);
    expect(PICKUP_COLORS.boomerang).toBe(0x006400);
  });
});
