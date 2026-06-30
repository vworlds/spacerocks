/** Shared u32 RGB colors for vecs-phaser FillStyle/StrokeStyle components. */
export function parseColor(css: string): number {
  const value = css.trim().replace(/^#/, '');

  if (/^[0-9a-f]{3}$/i.test(value)) {
    const r = value[0]!;
    const g = value[1]!;
    const b = value[2]!;
    return Number.parseInt(`${r}${r}${g}${g}${b}${b}`, 16);
  }

  if (/^[0-9a-f]{6}$/i.test(value)) {
    return Number.parseInt(value, 16);
  }

  throw new Error(`Invalid hex color: ${css}`);
}

export const PLAYER_COLORS = [
  0x00ffcc, 0xff00ff, 0xffff66, 0x66aaff,
] as const satisfies readonly number[];

export const ASTEROID_COLORS = [
  0xaaaaaa, 0x888888, 0xbbbbbb, 0x999999, 0x777777,
] as const satisfies readonly number[];

export const ASTEROID_FILL_COLORS = [
  0x161616, 0x555555, 0xb0b0b0,
] as const satisfies readonly number[];

export const PICKUP_COLORS = {
  shield: 0x00ff00,
  laser: 0xff0000,
  aura: 0x33aaff,
  rocket: 0xff6600,
  boomerang: 0x006400,
  health: 0xffffff,
} as const;

export const COLORS = {
  white: 0xffffff,
  asteroidGrey: 0xaaaaaa,
  orange: 0xffaa00,
  rocket: 0xff6600,
  boomerang: 0x006400,
  healthGreen: 0x00ff00,
} as const;
