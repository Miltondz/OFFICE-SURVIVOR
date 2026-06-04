import Phaser from 'phaser';
import { ENTITY_SIZES, COLORS_GAME } from '@/config/game.config';

export type PickupKind = 'cafe' | 'galleta' | 'moneda' | 'stress';

const KIND_COLORS: Record<PickupKind, number> = {
  cafe:    COLORS_GAME.PICKUP_CAFE,
  galleta: COLORS_GAME.PICKUP_GALLETA,
  moneda:  COLORS_GAME.PICKUP_MONEDA,
  stress:  COLORS_GAME.PICKUP_STRESS,
};

/**
 * Pooled map consumable pickup (circle rendered as rectangle placeholder).
 */
export class Pickup extends Phaser.GameObjects.Rectangle {
  kind: PickupKind = 'cafe';

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, ENTITY_SIZES.PICKUP, ENTITY_SIZES.PICKUP, COLORS_GAME.PICKUP_CAFE);
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body
    this.setActive(false).setVisible(false);
  }

  spawn(x: number, y: number, kind: PickupKind): void {
    this.kind = kind;
    this.setFillStyle(KIND_COLORS[kind]);
    this.setPosition(x, y).setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.reset(x, y);
  }

  deactivate(): void {
    this.setActive(false).setVisible(false);
  }
}
