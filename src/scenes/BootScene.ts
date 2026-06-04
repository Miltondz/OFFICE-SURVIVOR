import Phaser from 'phaser';
import { SCENES, GAME, COLORS } from '@/config/game.config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOOT });
  }

  create(): void {
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    this.add.text(cx, cy, 'Loading…', {
      fontSize: '32px',
      color: COLORS.TEXT,
    }).setOrigin(0.5);

    this.scene.start(SCENES.PRELOAD);
  }
}
