import Phaser from 'phaser';
import { ENTITY_SIZES, COLORS_GAME } from '@/config/game.config';
import { PICKUP_SPRITES } from '@/config/projectiles.config';
import { iconKey } from '@/config/icons.config';

const ITEM_ICON_DISPLAY = 26;   // tamaño en pantalla del icono del ítem en el cofre del mapa

/**
 * Fallback icon key used when an item has no dedicated `item_<id>` texture loaded.
 * Reuses an existing icon that is always loaded (lapicero_roto is in ICON_IDS). (balance v2)
 */
const GENERIC_ITEM_ICON = iconKey('lapicero_roto');

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
  itemId: string | null = null;   // §item-drop: id del ítem pre-elegido (cofre 'item')
  private sprite: Phaser.GameObjects.Sprite | null = null;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, ENTITY_SIZES.PICKUP, ENTITY_SIZES.PICKUP, COLORS_GAME.PICKUP_CAFE);
    scene.add.existing(this);
    scene.physics.add.existing(this, true); // static body
    this.setActive(false).setVisible(false);
  }

  spawn(x: number, y: number, kind: PickupKind, itemId: string | null = null): void {
    this.kind = kind;
    this.itemId = itemId;
    this.setPosition(x, y).setActive(true);
    const body = this.body as Phaser.Physics.Arcade.StaticBody;
    body.reset(x, y);

    // Cofre 'item': mostrar el icono real del ítem si existe, o el icono genérico si no. (balance v2)
    // Para items E1/E2 que no tienen item_<id> cargado se usa GENERIC_ITEM_ICON (lapicero_roto).
    // El cofre nunca debe verse como un cuadro de color liso.
    let itemTex: string | null = null;
    if (kind === 'item') {
      const specific = itemId ? iconKey(itemId) : null;
      if (specific && this.scene.textures.exists(specific)) {
        itemTex = specific;
      } else if (this.scene.textures.exists(GENERIC_ITEM_ICON)) {
        itemTex = GENERIC_ITEM_ICON; // fallback genérico (balance v2)
      }
    }
    const cfg = PICKUP_SPRITES[kind];
    const texKey = `pickup_${kind}`;

    if (itemTex && this.scene.textures.exists(itemTex)) {
      if (this.sprite === null) this.sprite = this.scene.add.sprite(x, y, itemTex).setDepth(1);
      const tex = this.scene.textures.get(itemTex).getSourceImage();
      const scale = ITEM_ICON_DISPLAY / Math.max(tex.width, tex.height);
      this.sprite.setTexture(itemTex).setPosition(x, y).setScale(scale).clearTint().setActive(true).setVisible(true);
      this.setVisible(false);
    } else if (cfg && this.scene.textures.exists(texKey)) {
      // Sprite genérico del pickup (moneda/café/galleta/stress).
      if (this.sprite === null) this.sprite = this.scene.add.sprite(x, y, texKey).setDepth(1);
      const tex = this.scene.textures.get(texKey).getSourceImage();
      const scale = cfg.display / Math.max(tex.width, tex.height);
      this.sprite.setTexture(texKey).setPosition(x, y).setScale(scale).clearTint().setActive(true).setVisible(true);
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
