import Phaser from 'phaser';
import { PLAYER, GAME, COLORS } from '@/config/game.config';
import type { RunContext } from '@/systems/RunContext';

const PLAYER_SIZE = 32;
const HP_BAR_W = 36;
const HP_BAR_H = 4;
const HP_BAR_OFFSET_Y = -22;

export class Player {
  readonly scene: Phaser.Scene;
  private ctx: RunContext;

  body!: Phaser.GameObjects.Rectangle;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBar!: Phaser.GameObjects.Rectangle;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  private iFrameTimer = 0;  // ms remaining of invincibility
  private modoAvionTimer = 0; // ms remaining Modo Avión invincibility
  private modoAvionCooldown = 0; // ms remaining cooldown

  constructor(scene: Phaser.Scene, ctx: RunContext) {
    this.scene = scene;
    this.ctx = ctx;

    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    this.body = scene.add.rectangle(cx, cy, PLAYER_SIZE, PLAYER_SIZE, COLORS.PLAYER);
    scene.physics.add.existing(this.body);

    this.hpBarBg = scene.add.rectangle(cx, cy + HP_BAR_OFFSET_Y, HP_BAR_W, HP_BAR_H, 0x660000);
    this.hpBar = scene.add.rectangle(cx, cy + HP_BAR_OFFSET_Y, HP_BAR_W, HP_BAR_H, 0xff0000);

    this.cursors = scene.input.keyboard!.createCursorKeys();
    this.wasd = {
      up: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
  }

  get x(): number { return this.body.x; }
  get y(): number { return this.body.y; }

  /** Called per frame */
  update(delta: number, stressSpeedMult: number): void {
    const dtS = delta / 1000;
    const speed = this.ctx.player.speed * stressSpeedMult;

    let dx = 0, dy = 0;
    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += 1;

    if (dx !== 0 && dy !== 0) {
      const n = Math.SQRT2;
      dx /= n; dy /= n;
    }

    this.body.x = Phaser.Math.Clamp(
      this.body.x + dx * speed * dtS,
      PLAYER_SIZE / 2, GAME.WIDTH - PLAYER_SIZE / 2,
    );
    this.body.y = Phaser.Math.Clamp(
      this.body.y + dy * speed * dtS,
      PLAYER_SIZE / 2, GAME.HEIGHT - PLAYER_SIZE / 2,
    );

    // i-frame countdown
    if (this.iFrameTimer > 0) {
      this.iFrameTimer -= delta;
      this.body.alpha = Math.floor(this.iFrameTimer / 80) % 2 === 0 ? 0.4 : 1.0;
    } else {
      this.body.alpha = 1.0;
    }

    // Modo Avión
    if (this.modoAvionTimer > 0) this.modoAvionTimer -= delta;
    if (this.modoAvionCooldown > 0) this.modoAvionCooldown -= delta;

    // Sync HP bar
    const hp = this.ctx.player.hp;
    const maxHp = this.ctx.player.maxHp;
    const ratio = Math.max(0, hp / maxHp);
    this.hpBarBg.setPosition(this.body.x, this.body.y + HP_BAR_OFFSET_Y);
    this.hpBar.setPosition(this.body.x - (HP_BAR_W * (1 - ratio)) / 2, this.body.y + HP_BAR_OFFSET_Y);
    this.hpBar.width = HP_BAR_W * ratio;
  }

  takeDamage(amount: number): void {
    // Immunity frames or Modo Avión immunity
    if (this.iFrameTimer > 0 || this.modoAvionTimer > 0) return;

    const actual = Math.ceil(amount * this.ctx.modifiers.damageTakenMult);
    this.ctx.player.hp -= actual;
    // Stress on hit is applied in StressSystem.onPlayerHit (supports ergonomia/auriculares_nc)

    this.iFrameTimer = PLAYER.INVINCIBILITY_FRAMES_MS;

    this.ctx.bus.emit('player:hit', { amount: actual });

    if (this.ctx.player.hp <= 0) {
      this.ctx.player.hp = 0;
      this.ctx.bus.emit('player:died');
    }

    // Modo Avión: trigger on hit if cooldown elapsed
    if (this.ctx.player.items.includes('modo_avion') && this.modoAvionCooldown <= 0) {
      this.modoAvionTimer = 2000;  // 2s immunity
      this.modoAvionCooldown = 8000; // 8s cooldown
    }
  }

  /** Linea Directa IT — survive at 1 HP once per run */
  activateLineaDirecta(): void {
    this.ctx.player.hp = 1;
    // Remove the item so it can't trigger again
    this.ctx.player.items = this.ctx.player.items.filter(id => id !== 'linea_directa');
  }

  faceToward(tx: number, ty: number): void {
    const angle = Phaser.Math.Angle.Between(this.body.x, this.body.y, tx, ty);
    this.body.rotation = angle;
  }
}
