import Phaser from 'phaser';
import { ENTITY_SIZES, COLORS_GAME, ECONOMY, FEEL, CURSES } from '@/config/game.config';
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

  // For possessed_printer
  fanTimer = 0;
  lastDamageSource = '';
  ally = false;             // rrhh: HR Rep allied to player (movement driven by EnemySystem)

  private ctx!: RunContext;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpLabel: Phaser.GameObjects.Text | null = null;
  private lastHpShown = -1;
  private active2 = false;
  private baseColor: number = COLORS_GAME.ENEMY; // restored after hit-flash

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
    this.lastDamageSource = '';
    this.lastHpShown = -1;

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

    this.active2 = true;
    this.setActive(true).setVisible(true);
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = true;
    body.reset(x, y);

    this.hpBarBg.setActive(true).setVisible(true);
    this.hpBar.setActive(true).setVisible(true);
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

    // HP bar sync
    const ratio = Math.max(0, this.hp / this.maxHp);
    const bw = (this.def.isElite ? ENTITY_SIZES.ELITE : ENTITY_SIZES.ENEMY);
    const by = this.y - bw / 2 - 6;
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
    this.setFillStyle(0xffffff);
    this.scene.time.delayedCall(FEEL.ENEMY_FLASH_MS, () => {
      if (this.active2) this.setFillStyle(this.baseColor);
    });

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
    const xp = this.def.xpValue * this.ctx.modifiers.xpMult;
    const coinRange = this.def.isElite
      ? { min: ECONOMY.ELITE_COINS_MIN, max: ECONOMY.ELITE_COINS_MAX }
      : { min: ECONOMY.ENEMY_COINS_MIN, max: ECONOMY.ENEMY_COINS_MAX };
    const coins = Phaser.Math.Between(coinRange.min, coinRange.max) * this.ctx.modifiers.coinMult;

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

  deactivate(): void {
    if (!this.active2) return;
    this.active2 = false;
    this.setActive(false).setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).enable = false;
    this.hpBarBg.setActive(false).setVisible(false);
    this.hpBar.setActive(false).setVisible(false);
    if (this.hpLabel) this.hpLabel.setVisible(false);
  }
}
