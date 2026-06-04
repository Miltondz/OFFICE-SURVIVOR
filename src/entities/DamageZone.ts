import Phaser from 'phaser';
import { COLORS_GAME } from '@/config/game.config';

/** A ground-effect zone that deals DPS to the player while they stand in it. */
export class DamageZone extends Phaser.GameObjects.Ellipse {
  dps = 0;
  duration = 0; // ms remaining
  private active2 = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, 60, 60, COLORS_GAME.TOXIC_ZONE, 0.45);
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = false;
  }

  spawn(x: number, y: number, radius: number, dps: number, durationMs: number): void {
    this.setPosition(x, y).setSize(radius * 2, radius * 2);
    this.dps = dps;
    this.duration = durationMs;
    this.active2 = true;
    this.setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = true;
    body.reset(x, y);
  }

  preUpdate(_time: number, delta: number): void {
    if (!this.active2) return;
    this.duration -= delta;
    if (this.duration <= 0) this.deactivate();
  }

  deactivate(): void {
    this.active2 = false;
    this.setActive(false).setVisible(false);
    (this.body as Phaser.Physics.Arcade.StaticBody).enable = false;
  }
}
