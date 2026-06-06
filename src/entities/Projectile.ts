import Phaser from 'phaser';
import { COMBAT, ENTITY_SIZES, COLORS_GAME, MAP, ITEMS_E2 } from '@/config/game.config';
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

  // §E2 rebote_de_pared: wall-bounce budget (0 = no wall bounce) — nuevo (fase E2)
  wallBounceLeft = 0;

  // §E2 avalancha guard: secondary projectiles don't spawn tertiaries — nuevo (fase E2)
  isSecondary = false;

  // §E2 magnetismo_balas: getter for nearest enemy position — nuevo (fase E2)
  static getNearestEnemyFn: ((x: number, y: number, range: number) => { x: number; y: number } | null) | null = null;
  // Whether this projectile should home (set by WeaponSystem when item owned) — nuevo (fase E2)
  magnetic = false;

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
    this.wallBounceLeft = 0;   // reset; caller sets after fire() if needed — nuevo (fase E2)
    this.isSecondary = false;  // reset — nuevo (fase E2)
    this.magnetic = false;     // reset — nuevo (fase E2)

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
    if (this.lifespan <= 0) { this.deactivate(); return; }

    // §E2 rebote_de_pared: reflect velocity off map bounds — nuevo (fase E2)
    if (this.wallBounceLeft > 0) {
      const body = this.body as Phaser.Physics.Arcade.Body;
      const r = ENTITY_SIZES.PROJECTILE / 2;
      let vx = body.velocity.x;
      let vy = body.velocity.y;
      let bounced = false;
      if (this.x - r <= 0 && vx < 0) { vx = Math.abs(vx); bounced = true; }
      else if (this.x + r >= MAP.WIDTH && vx > 0) { vx = -Math.abs(vx); bounced = true; }
      if (this.y - r <= 0 && vy < 0) { vy = Math.abs(vy); bounced = true; }
      else if (this.y + r >= MAP.HEIGHT && vy > 0) { vy = -Math.abs(vy); bounced = true; }
      if (bounced) {
        body.setVelocity(vx, vy);
        this.wallBounceLeft--;
        if (this.wallBounceLeft < 0) this.deactivate();
      }
    }

    // §E2 magnetismo_balas: gently steer toward nearest enemy — nuevo (fase E2)
    if (this.magnetic && Projectile.getNearestEnemyFn) {
      const target = Projectile.getNearestEnemyFn(this.x, this.y, ITEMS_E2.MAGNET_RANGE);
      if (target) {
        const body = this.body as Phaser.Physics.Arcade.Body;
        const vx = body.velocity.x;
        const vy = body.velocity.y;
        const speed = Math.sqrt(vx * vx + vy * vy);
        if (speed > 0) {
          const desiredAngle = Math.atan2(target.y - this.y, target.x - this.x);
          const currentAngle = Math.atan2(vy, vx);
          // Clamp turn angle by turn rate × delta
          const maxTurn = ITEMS_E2.MAGNET_TURN_RATE * delta / 1000;
          let diff = Phaser.Math.Angle.Wrap(desiredAngle - currentAngle);
          if (diff > maxTurn) diff = maxTurn;
          else if (diff < -maxTurn) diff = -maxTurn;
          const newAngle = currentAngle + diff;
          body.setVelocity(Math.cos(newAngle) * speed, Math.sin(newAngle) * speed);
        }
      }
    }
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
