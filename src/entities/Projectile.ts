import Phaser from 'phaser';
import { COMBAT, ENTITY_SIZES, COLORS_GAME } from '@/config/game.config';

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
    this.setActive(true).setVisible(true).setPosition(x, y);
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
  }

  preUpdate(_time: number, delta: number): void {
    if (!this.active2) return;
    this.lifespan -= delta;
    if (this.lifespan <= 0) this.deactivate();
  }

  deactivate(): void {
    this.active2 = false;
    this.setActive(false).setVisible(false);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
  }
}
