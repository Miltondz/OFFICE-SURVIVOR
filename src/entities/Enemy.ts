import Phaser from 'phaser';
import { ENTITY_SIZES, COLORS_GAME, ECONOMY, FEEL, CURSES, PROGRESSION, WAVES } from '@/config/game.config';
import { ENEMY_SHEET, ENEMY_DISPLAY_H, ENEMY_FRAME } from '@/config/enemies.config';
import type { EnemyDir } from '@/config/enemies.config';
import type { EnemyDefinition, EnemyType } from '@/types';
import type { RunContext } from '@/systems/RunContext';

export class Enemy extends Phaser.GameObjects.Rectangle {
  def!: EnemyDefinition;
  hp = 0;
  maxHp = 0;
  invincible = false;
  invincibleTimer = 0;      // ms remaining of invincibility
  stunned = false;
  stunTimer = 0;
  slowed = false;
  slowTimer = 0;
  slowFactor = 1.0;
  frozen = false;
  frozenTimer = 0;
  contactCooldown = 0;      // per-enemy contact damage cooldown ms
  detectionDelayMs = 0;     // badge: ms remaining before enemy chases player

  // §B — bonus enemy flag
  isBonus = false;          // bonus waves: no contact damage, ×2 coins on death, auto-despawn 20s
  private bonusTimer = 0;   // ms remaining before auto-despawn (bonus enemies only)

  // For possessed_printer
  fanTimer = 0;
  // For cleaning_lady: timer del rastro de piso pulido
  polishTimer = 0;
  lastDamageSource = '';
  ally = false;             // rrhh: HR Rep allied to player (movement driven by EnemySystem)

  private ctx!: RunContext;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpLabel: Phaser.GameObjects.Text | null = null;
  private lastHpShown = -1;
  private active2 = false;
  private baseColor: number = COLORS_GAME.ENEMY; // restored after hit-flash

  // Sprite visual animado (si el enemigo tiene hoja). El rect queda como cuerpo invisible.
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private hasSheet = false;
  private facing: EnemyDir = 'down';

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0, ENTITY_SIZES.ENEMY, ENTITY_SIZES.ENEMY, COLORS_GAME.ENEMY);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setActive(false).setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;

    this.hpBarBg = scene.add.rectangle(0, 0, ENTITY_SIZES.ENEMY, 3, 0x660000);
    this.hpBar = scene.add.rectangle(0, 0, ENTITY_SIZES.ENEMY, 3, 0xff4444);
    this.hpBarBg.setActive(false).setVisible(false);
    this.hpBar.setActive(false).setVisible(false);
  }

  spawn(def: EnemyDefinition, x: number, y: number, ctx: RunContext): void {
    this.def = def;
    this.ctx = ctx;
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.invincible = false;
    this.invincibleTimer = 0;
    this.stunned = false;
    this.stunTimer = 0;
    this.slowed = false;
    this.slowTimer = 0;
    this.slowFactor = 1.0;
    this.frozen = false;
    this.frozenTimer = 0;
    this.contactCooldown = 0;
    this.detectionDelayMs = 0;
    this.fanTimer = 0;
    this.polishTimer = 0;
    this.lastDamageSource = '';
    this.lastHpShown = -1;
    this.isBonus = false;
    this.bonusTimer = 0;

    const size = def.isElite ? ENTITY_SIZES.ELITE : ENTITY_SIZES.ENEMY;
    this.setSize(size, size).setPosition(x, y);

    // Color by type
    if (def.id === 'auditor') {
      this.baseColor = COLORS_GAME.AUDITOR;
    } else if (def.isElite) {
      this.baseColor = COLORS_GAME.ELITE;
    } else {
      this.baseColor = COLORS_GAME.ENEMY;
    }
    this.setFillStyle(this.baseColor);

    // Reset visual state from possible previous death tween
    this.setScale(1).setAlpha(1);

    // Sprite animado si hay hoja para este enemigo; si no, el rect de color queda visible.
    const sheetKey = `enemysheet_${def.id}`;
    this.hasSheet = this.scene.textures.exists(sheetKey);
    if (this.hasSheet) {
      const frameH = ENEMY_FRAME[def.id]?.h ?? 298;
      const scale = (ENEMY_DISPLAY_H[def.id] ?? size * 1.5) / frameH;
      if (this.sprite === null) {
        this.sprite = this.scene.add.sprite(x, y, sheetKey, ENEMY_SHEET.IDLE.down)
          .setOrigin(0.5, 1).setDepth(0);
      }
      this.facing = 'down';
      this.sprite
        .setTexture(sheetKey, ENEMY_SHEET.IDLE.down)
        .setScale(scale)
        .setFlipX(false)
        .clearTint()
        .setAlpha(1)
        .setActive(true)
        .setVisible(true);
      this.setVisible(false);          // ocultar rect: el sprite es el visual
    } else if (this.sprite) {
      this.sprite.setActive(false).setVisible(false);
    }

    this.active2 = true;
    this.setActive(true).setVisible(!this.hasSheet);   // rect visible solo si no hay sprite
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);

    this.hpBarBg.setActive(true).setVisible(true);
    this.hpBar.setActive(true).setVisible(true);
  }

  /** Mark this enemy as a bonus enemy (dorado, sin daño, ×2 monedas, auto-despawn 20s). */
  markAsBonus(): void {
    this.isBonus = true;
    this.bonusTimer = WAVES.BONUS_DESPAWN_S * 1000;
    // Golden tint to distinguish bonus enemies visually
    if (this.hasSheet && this.sprite) {
      this.sprite.setTint(0xffd700);
    } else {
      this.setFillStyle(0xffd700);
      this.baseColor = 0xffd700;
    }
  }

  get isActive2(): boolean { return this.active2; }
  get enemyType(): EnemyType { return this.def.id; }

  preUpdate(_time: number, delta: number): void {
    if (!this.active2) return;

    // Timers
    if (this.invincibleTimer > 0) {
      this.invincibleTimer -= delta;
      if (this.invincibleTimer <= 0) this.invincible = false;
    }
    if (this.stunTimer > 0) {
      this.stunTimer -= delta;
      if (this.stunTimer <= 0) this.stunned = false;
    }
    if (this.slowTimer > 0) {
      this.slowTimer -= delta;
      if (this.slowTimer <= 0) { this.slowed = false; this.slowFactor = 1.0; }
    }
    if (this.frozenTimer > 0) {
      this.frozenTimer -= delta;
      if (this.frozenTimer <= 0) this.frozen = false;
    }
    if (this.contactCooldown > 0) {
      this.contactCooldown -= delta;
    }
    // badge: detection delay countdown
    if (this.detectionDelayMs > 0) {
      this.detectionDelayMs -= delta;
    }

    // §B bonus: auto-despawn after BONUS_DESPAWN_S seconds
    if (this.isBonus && this.bonusTimer > 0) {
      this.bonusTimer -= delta;
      if (this.bonusTimer <= 0) {
        this.deactivate();
        return;
      }
    }

    // Sprite animado sigue al cuerpo (pies en la base del rect)
    this.updateSprite();

    // HP bar sync — sobre la cabeza del sprite si lo hay, si no sobre el rect
    const ratio = Math.max(0, this.hp / this.maxHp);
    const bw = (this.def.isElite ? ENTITY_SIZES.ELITE : ENTITY_SIZES.ENEMY);
    const displayH = ENEMY_DISPLAY_H[this.def.id] ?? bw * 1.5;
    const by = this.hasSheet ? this.y + bw / 2 - displayH - 4 : this.y - bw / 2 - 6;
    this.hpBarBg.setPosition(this.x, by).setSize(bw, 3);
    this.hpBar.setPosition(this.x - (bw * (1 - ratio)) / 2, by).setSize(bw * ratio, 3);

    // excel_sheet: show exact HP label when item owned
    if (this.ctx.player.items.includes('excel_sheet')) {
      const hpInt = Math.ceil(this.hp);
      if (this.hpLabel === null) {
        this.hpLabel = this.scene.add.text(this.x, this.y - bw / 2 - 16, String(hpInt), {
          fontSize: '10px', color: '#ffffff',
        }).setOrigin(0.5).setDepth(8);
        this.lastHpShown = hpInt;
      } else {
        this.hpLabel.setPosition(this.x, this.y - bw / 2 - 16).setVisible(true);
        if (hpInt !== this.lastHpShown) {
          this.hpLabel.setText(String(hpInt));
          this.lastHpShown = hpInt;
        }
      }
    } else if (this.hpLabel) {
      this.hpLabel.setVisible(false);
    }

    // Allies (rrhh): movement + targeting driven by EnemySystem, not player-chase.
    if (this.ally) return;

    // AI movement — badge: idle while detection delay active
    if (this.stunned || this.frozen || this.detectionDelayMs > 0) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return;
    }

    const px = this.ctx.player.hp > 0 ? this.scene.data.get('playerX') as number : this.x;
    const py = this.ctx.player.hp > 0 ? this.scene.data.get('playerY') as number : this.y;

    let speed = this.def.speed * (this.slowed ? this.slowFactor : 1.0) * this.ctx.enemySpeedMult;
    // Curse open_office: player aura slows enemies within radius.
    if (this.ctx.curseOpenOfficeAura
      && Phaser.Math.Distance.Between(this.x, this.y, px, py) < CURSES.OPEN_OFFICE_AURA_RADIUS) {
      speed *= (1 - CURSES.OPEN_OFFICE_AURA_SLOW);
    }
    const angle = Phaser.Math.Angle.Between(this.x, this.y, px, py);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(vx, vy);
  }

  /** Posiciona el sprite a los pies del cuerpo y elige dirección/animación por velocidad. */
  private updateSprite(): void {
    if (!this.hasSheet || !this.sprite) return;
    const bw = (this.def.isElite ? ENTITY_SIZES.ELITE : ENTITY_SIZES.ENEMY);
    this.sprite.setPosition(this.x, this.y + bw / 2);

    const body = this.body as Phaser.Physics.Arcade.Body;
    const vx = body.velocity.x, vy = body.velocity.y;
    const moving = Math.abs(vx) > 1 || Math.abs(vy) > 1;
    if (moving) {
      if (Math.abs(vx) > Math.abs(vy)) {
        this.facing = 'side';
        this.sprite.setFlipX(vx < 0);
      } else {
        this.facing = vy > 0 ? 'down' : 'up';
        this.sprite.setFlipX(false);
      }
      this.sprite.anims.play(`enemy_${this.def.id}_walk_${this.facing}`, true);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(ENEMY_SHEET.IDLE[this.facing]);
    }
  }

  takeDamage(amount: number, sourceId = '', isCritical = false): void {
    if (!this.active2) return;
    if (this.invincible) return;

    // NDAs Firmadas: auditors die in one hit
    if (this.def.id === 'auditor' && this.ctx.player.items.includes('ndas_firmadas')) {
      this.hp = 0;
    } else {
      this.hp -= amount;
    }

    if (sourceId) this.lastDamageSource = sourceId;
    this.ctx.bus.emit('enemy:hit', { enemy: this, amount, sourceId, isCritical });

    // Hit flash (presentation only — no gameplay effect)
    if (this.hasSheet && this.sprite) {
      this.sprite.setTintFill(0xffffff);
      this.scene.time.delayedCall(FEEL.ENEMY_FLASH_MS, () => {
        if (this.active2 && this.sprite) this.sprite.clearTint();
      });
    } else {
      this.setFillStyle(0xffffff);
      this.scene.time.delayedCall(FEEL.ENEMY_FLASH_MS, () => {
        if (this.active2) this.setFillStyle(this.baseColor);
      });
    }

    if (this.hp <= 0) this.die();
  }

  applyEffect(effect: string, duration: number): void {
    if (effect === 'slow') {
      this.slowed = true;
      this.slowTimer = duration;
      this.slowFactor = 0.5;
    } else if (effect === 'stun') {
      this.stunned = true;
      this.stunTimer = duration;
    } else if (effect === 'freeze') {
      this.frozen = true;
      this.frozenTimer = duration;
    } else if (effect === 'knockback') {
      // knockback handled externally
    }
  }

  die(): void {
    if (!this.active2) return;
    this.active2 = false;

    // Gameplay resolution (XP, coins, kills, events) — immediate
    // §7.6: xp = round(xpValue · XP_KILL_MULT · modifiers.xpMult)
    const xp = Math.round(this.def.xpValue * PROGRESSION.XP_KILL_MULT * this.ctx.modifiers.xpMult);
    const coinRange = this.def.isElite
      ? { min: ECONOMY.ELITE_COINS_MIN, max: ECONOMY.ELITE_COINS_MAX }
      : { min: ECONOMY.ENEMY_COINS_MIN, max: ECONOMY.ENEMY_COINS_MAX };
    // §B bonus enemies: drop ×2 coins
    const coinMult = this.isBonus ? this.ctx.modifiers.coinMult * 2 : this.ctx.modifiers.coinMult;
    const coins = Phaser.Math.Between(coinRange.min, coinRange.max) * coinMult;

    this.ctx.player.xp += xp;
    this.ctx.player.coins += Math.floor(coins);
    this.ctx.stats.coinsEarned += Math.floor(coins);
    this.ctx.stats.kills++;

    this.ctx.bus.emit('enemy:killed', {
      type: this.def.id,
      isElite: this.def.isElite,
      x: this.x,
      y: this.y,
      sourceId: this.lastDamageSource,
    });

    // Disable physics immediately so no further collisions
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;
    body.setVelocity(0, 0);
    this.hpBarBg.setActive(false).setVisible(false);
    this.hpBar.setActive(false).setVisible(false);
    if (this.hpLabel) this.hpLabel.setVisible(false);

    // Death tween (presentation only)
    if (this.hasSheet && this.sprite) {
      this.sprite.anims.stop();
      this.sprite.setFrame(ENEMY_SHEET.DEATH[this.facing]);
      const baseScale = this.sprite.scaleX;
      this.scene.tweens.add({
        targets: this.sprite,
        alpha: 0,
        duration: FEEL.ENEMY_DEATH_MS,
        ease: 'Linear',
        onComplete: () => {
          if (this.sprite) this.sprite.setActive(false).setVisible(false).setScale(baseScale).setAlpha(1);
        },
      });
      this.setActive(false);
    } else {
      this.scene.tweens.add({
        targets: this,
        scaleX: FEEL.ENEMY_DEATH_SCALE,
        scaleY: FEEL.ENEMY_DEATH_SCALE,
        alpha: 0,
        duration: FEEL.ENEMY_DEATH_MS,
        ease: 'Linear',
        onComplete: () => {
          this.setActive(false).setVisible(false);
          this.setScale(1).setAlpha(1); // reset for next spawn
        },
      });
    }
  }

  deactivate(): void {
    if (!this.active2) return;
    this.active2 = false;
    this.setActive(false).setVisible(false);
    if (this.sprite) this.sprite.setActive(false).setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.hpBarBg.setActive(false).setVisible(false);
    this.hpBar.setActive(false).setVisible(false);
    if (this.hpLabel) this.hpLabel.setVisible(false);
  }
}
