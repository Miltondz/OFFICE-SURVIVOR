import Phaser from 'phaser';
import { COMBAT, ENTITY_SIZES, COLORS_GAME } from '@/config/game.config';
import { PROJECTILE_SPRITES } from '@/config/projectiles.config';

export type ProjectileEffect = 'slow' | 'stun' | 'zoneOnHit' | 'knockback' | 'aoe' | 'freeze' | 'none';

export class Projectile extends Phaser.GameObjects.Rectangle {
  damage = 0;
  sourceId = '';
  pierceLeft = 0;
  bounceLeft = 0;
  effectTag: ProjectileEffect = 'none';
  stunDur = 0;
  isCrit = false;          // set by WeaponSystem when crit roll succeeds
  private lifespan = 0;
  private active2 = false; // shadow flag because Phaser active conflicts

  // Sprite visual (si el arma tiene textura de proyectil); el rect queda como cuerpo invisible.
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private hasSprite = false;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, ENTITY_SIZES.PROJECTILE, ENTITY_SIZES.PROJECTILE, COLORS_GAME.PROJECTILE);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
  }

  fire(
    x: number, y: number,
    vx: number, vy: number,
    damage: number,
    sourceId: string,
    pierceLeft: number,
    bounceLeft: number,
    effect: ProjectileEffect,
    lifespanMs: number = COMBAT.PROJECTILE_LIFESPAN_MS,
  ): void {
    this.setActive(true).setPosition(x, y);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.setVelocity(vx, vy);
    this.damage = damage;
    this.sourceId = sourceId;
    this.pierceLeft = pierceLeft;
    this.bounceLeft = bounceLeft;
    this.effectTag = effect;
    this.lifespan = lifespanMs;
    this.isCrit = false;
    this.active2 = true;

    // Sprite por arma si existe textura `proj_<sourceId>`; si no, el rect blanco.
    const cfg = PROJECTILE_SPRITES[sourceId];
    const texKey = `proj_${sourceId}`;
    this.hasSprite = !!cfg && this.scene.textures.exists(texKey);
    if (this.hasSprite && cfg) {
      if (this.sprite === null) {
        this.sprite = this.scene.add.sprite(x, y, texKey).setDepth(1);
      }
      const tex = this.scene.textures.get(texKey).getSourceImage();
      const scale = cfg.display / Math.max(tex.width, tex.height);
      let rot = 0;
      if (cfg.rot !== 'none') {
        const a = Math.atan2(vy, vx);
        rot = cfg.rot === 'up' ? a + Math.PI / 2 : a;
      }
      this.sprite
        .setTexture(texKey)
        .setPosition(x, y)
        .setScale(scale)
        .setRotation(rot)
        .setActive(true)
        .setVisible(true);
      this.setVisible(false);          // ocultar rect: el sprite es el visual
    } else {
      this.setVisible(true);
      if (this.sprite) this.sprite.setActive(false).setVisible(false);
    }
  }

  preUpdate(_time: number, delta: number): void {
    if (!this.active2) return;
    if (this.hasSprite && this.sprite) this.sprite.setPosition(this.x, this.y);
    this.lifespan -= delta;
    if (this.lifespan <= 0) this.deactivate();
  }

  deactivate(): void {
    this.active2 = false;
    this.setActive(false).setVisible(false);
    if (this.sprite) this.sprite.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
  }
}
