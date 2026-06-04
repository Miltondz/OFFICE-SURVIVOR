import Phaser from 'phaser';
import { COLORS_GAME } from '@/config/game.config';

const TURRET_SIZE = 20;

/**
 * Pooled printer turret entity for Impresora Aliada.
 * Level 1–3 → up to 3 turrets active simultaneously (one per weapon level).
 * Each turret fires independently at nearest enemy.
 */
export class PrinterTurret extends Phaser.GameObjects.Rectangle {
  lastFiredAt = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, TURRET_SIZE, TURRET_SIZE, COLORS_GAME.TURRET);
    scene.add.existing(this);
    this.setActive(false).setVisible(false);
  }

  spawn(x: number, y: number, time: number): void {
    this.setPosition(x, y).setActive(true).setVisible(true);
    this.lastFiredAt = time;
  }

  deactivate(): void {
    this.setActive(false).setVisible(false);
  }
}
