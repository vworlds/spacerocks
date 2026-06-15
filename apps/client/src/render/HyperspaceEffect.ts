import Phaser from 'phaser';

const EFFECT_DURATION_MS = 220;
const LINE_COUNT = 20;
const LINE_DEPTH = 20_000;

export function playHyperspaceEffect(scene: Phaser.Scene): void {
  const camera = scene.cameras.main;
  camera.flash(EFFECT_DURATION_MS, 255, 255, 255);

  const centerX = camera.width / 2;
  const centerY = camera.height / 2;
  const graphics = scene.add.graphics().setScrollFactor(0).setDepth(LINE_DEPTH);

  graphics.lineStyle(2, 0xffffff, 0.9);
  for (let i = 0; i < LINE_COUNT; i++) {
    const angle =
      (i / LINE_COUNT) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.08, 0.08);
    const inner = Phaser.Math.Between(28, 70);
    const length = Phaser.Math.Between(80, 180);
    const startX = centerX + Math.cos(angle) * inner;
    const startY = centerY + Math.sin(angle) * inner;
    const endX = centerX + Math.cos(angle) * (inner + length);
    const endY = centerY + Math.sin(angle) * (inner + length);
    graphics.lineBetween(startX, startY, endX, endY);
  }

  scene.tweens.add({
    targets: graphics,
    alpha: 0,
    duration: EFFECT_DURATION_MS,
    ease: 'Cubic.easeOut',
    onComplete: () => graphics.destroy(),
  });
}
