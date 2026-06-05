import Phaser from 'phaser';
import { ENTITY_SIZES, COLORS_GAME } from '@/config/game.config';
import { PICKUP_SPRITES } from '@/config/projectiles.config';

export type PickupKind = 'cafe' | 'galleta' | 'moneda' | 'stress' | 'item' | 'upgrade';

// §7.4 — 'item' = chest/gift (grants a random passive item), 'upgrade' = star (player stat choice)
const KIND_COLORS: Record<PickupKind, number> = {
  cafe:    COLORS_GAME.PICKUP_CAFE,
  galleta: COLORS_GAME.PICKUP_GALLETA,
  moneda:  COLORS_GAME.PICKUP_MONEDA,
  stress:  COLORS_GAME.PICKUP_STRESS,
  item:    0xff8c00,   // orange chest
  upgrade: 0xffdd00,  // bright yellow star
};

/**
 * Pooled map consumable pickup (circle rendered as rectangle placeholder).
 */
export class Pickup extends Phaser.GameObjects.Rectangle {
  kind: PickupKind = 'cafe';
  private sprite: Phaser.GameObjects.Sprite | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, ENTITY_SIZES.PICKUP, ENTITY_SIZES.PICKUP, COLORS_GAME.PICKUP_CAFE);
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body
    this.setActive(false).setVisible(false);
  }

  spawn(x: number, y: number, kind: PickupKind): void {
    this.kind = kind;
    this.setPosition(x, y).setActive(true);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.reset(x, y);

    // Sprite si la textura `pickup_<kind>` existe; si no, rect de color.
    const cfg = PICKUP_SPRITES[kind];
    const texKey = `pickup_${kind}`;
    const hasSprite = !!cfg && this.scene.textures.exists(texKey);
    if (hasSprite && cfg) {
      if (this.sprite === null) {
        this.sprite = this.scene.add.sprite(x, y, texKey).setDepth(1);
      }
      const tex = this.scene.textures.get(texKey).getSourceImage();
      const scale = cfg.display / Math.max(tex.width, tex.height);
      this.sprite.setTexture(texKey).setPosition(x, y).setScale(scale).setActive(true).setVisible(true);
      this.setVisible(false);
    } else {
      this.setFillStyle(KIND_COLORS[kind]);
      this.setVisible(true);
      if (this.sprite) this.sprite.setActive(false).setVisible(false);
    }
  }

  deactivate(): void {
    this.setActive(false).setVisible(false);
    if (this.sprite) this.sprite.setActive(false).setVisible(false);
  }
}
