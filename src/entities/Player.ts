import Phaser from 'phaser';
import { PLAYER, MAP, COLORS, ITEMS_E1 } from '@/config/game.config';
import { CHAR_SHEET, charFrame } from '@/config/characters.config';
import type { CharDir } from '@/config/characters.config';
import type { RunContext } from '@/systems/RunContext';

const PLAYER_SIZE = 32;          // cuerpo físico (colisiones) — invisible
const HP_BAR_W = 36;
const HP_BAR_H = 4;

export class Player {
  readonly scene: Phaser.Scene;
  private ctx: RunContext;

  body!: Phaser.GameObjects.Rectangle;   // cuerpo de colisión (lo usan los sistemas)
  private sprite!: Phaser.GameObjects.Sprite;
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBar!: Phaser.GameObjects.Rectangle;

  private facing: CharDir = 'down';
  private flip = false;
  private sheetId = 'base';

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };

  private iFrameTimer = 0;
  private modoAvionTimer = 0;
  private modoAvionCooldown = 0;

  constructor(scene: Phaser.Scene, ctx: RunContext) {
    this.scene = scene;
    this.ctx = ctx;

    const cx = MAP.PLAYER_SPAWN_X;
    const cy = MAP.PLAYER_SPAWN_Y;

    // Cuerpo físico (rect pequeño, invisible) — todas las colisiones siguen igual.
    this.body = scene.add.rectangle(cx, cy, PLAYER_SIZE, PLAYER_SIZE, COLORS.PLAYER).setVisible(false);
    scene.physics.add.existing(this.body);

    // Sprite visual desde la hoja del personaje (fallback a 'base' si no existe textura).
    this.sheetId = scene.textures.exists(`charsheet_${ctx.character.id}`) ? ctx.character.id : 'base';
    const spriteScale = CHAR_SHEET.DISPLAY_H / charFrame(this.sheetId).h;
    this.sprite = scene.add.sprite(cx, cy + PLAYER_SIZE / 2, `charsheet_${this.sheetId}`, CHAR_SHEET.IDLE.down)
      .setOrigin(0.5, 1)
      .setScale(spriteScale)
      .setDepth(1);

    this.hpBarBg = scene.add.rectangle(cx, cy, HP_BAR_W, HP_BAR_H, 0x660000).setDepth(2);
    this.hpBar = scene.add.rectangle(cx, cy, HP_BAR_W, HP_BAR_H, 0xff0000).setDepth(2);

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

    this.body.x = Phaser.Math.Clamp(this.body.x + dx * speed * dtS, PLAYER_SIZE / 2, MAP.WIDTH - PLAYER_SIZE / 2);
    this.body.y = Phaser.Math.Clamp(this.body.y + dy * speed * dtS, PLAYER_SIZE / 2, MAP.HEIGHT - PLAYER_SIZE / 2);

    // ---- Dirección + animación ----
    this.updateAnim(dx, dy);

    // Sprite sigue al cuerpo (pies en la base del cuerpo)
    this.sprite.setPosition(this.body.x, this.body.y + PLAYER_SIZE / 2);

    // i-frames → parpadeo del sprite
    if (this.iFrameTimer > 0) {
      this.iFrameTimer -= delta;
      this.sprite.alpha = Math.floor(this.iFrameTimer / 80) % 2 === 0 ? 0.4 : 1.0;
    } else {
      this.sprite.alpha = 1.0;
    }

    if (this.modoAvionTimer > 0) this.modoAvionTimer -= delta;
    if (this.modoAvionCooldown > 0) this.modoAvionCooldown -= delta;

    // Barra de HP encima de la cabeza del sprite
    const ratio = Math.max(0, this.ctx.player.hp / this.ctx.player.maxHp);
    const barY = this.body.y - CHAR_SHEET.DISPLAY_H + PLAYER_SIZE / 2 - 4;
    this.hpBarBg.setPosition(this.body.x, barY);
    this.hpBar.setPosition(this.body.x - (HP_BAR_W * (1 - ratio)) / 2, barY);
    this.hpBar.width = HP_BAR_W * ratio;
  }

  private updateAnim(dx: number, dy: number): void {
    if (dx !== 0 || dy !== 0) {
      if (Math.abs(dx) > Math.abs(dy)) {
        this.facing = 'side';
        this.flip = dx < 0;
      } else {
        this.facing = dy > 0 ? 'down' : 'up';
        this.flip = false;
      }
      this.sprite.setFlipX(this.flip);
      this.sprite.anims.play(`${this.sheetId}_walk_${this.facing}`, true);
    } else {
      this.sprite.anims.stop();
      this.sprite.setFrame(CHAR_SHEET.IDLE[this.facing]);
      this.sprite.setFlipX(this.flip);
    }
  }

  takeDamage(amount: number): void {
    if (this.iFrameTimer > 0 || this.modoAvionTimer > 0) return;
    // §E1 modo_dios_temporal: invencibilidad — nuevo (fase E1)
    if (this.ctx.modoDiosActive) return;
    // §E1 escudo_grapas: absorbe el primer hit de la oleada — nuevo (fase E1)
    if (this.ctx.escudoGrapasActive && this.ctx.player.items.includes('escudo_grapas')) {
      this.ctx.escudoGrapasActive = false;
      this.iFrameTimer = PLAYER.INVINCIBILITY_FRAMES_MS;
      return; // daño bloqueado; no emite player:hit
    }
    // §E1 pelota_stress: 30% de anular el daño — nuevo (fase E1)
    if (this.ctx.player.items.includes('pelota_stress') && Math.random() < ITEMS_E1.PELOTA_BLOCK_CHANCE) {
      this.iFrameTimer = PLAYER.INVINCIBILITY_FRAMES_MS;
      return; // daño bloqueado; no emite player:hit (evita feedback loops)
    }

    const actual = Math.ceil(amount * this.ctx.modifiers.damageTakenMult);
    this.ctx.player.hp -= actual;

    this.iFrameTimer = PLAYER.INVINCIBILITY_FRAMES_MS;
    this.ctx.bus.emit('player:hit', { amount: actual });

    if (this.ctx.player.hp <= 0) {
      this.ctx.player.hp = 0;
      // Frame de muerte de la dirección actual
      this.sprite.anims.stop();
      this.sprite.setFrame(CHAR_SHEET.DEATH[this.facing]);
      this.ctx.bus.emit('player:died');
    }

    if (this.ctx.player.items.includes('modo_avion') && this.modoAvionCooldown <= 0) {
      this.modoAvionTimer = 2000;
      this.modoAvionCooldown = 8000;
    }
  }

  /** Linea Directa IT — survive at 1 HP once per run */
  activateLineaDirecta(): void {
    this.ctx.player.hp = 1;
    this.ctx.player.items = this.ctx.player.items.filter(id => id !== 'linea_directa');
  }

  faceToward(_tx: number, _ty: number): void {
    // La dirección la maneja el movimiento (updateAnim). No-op visual.
  }
}
