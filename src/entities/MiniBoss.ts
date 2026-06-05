/**
 * §C — MiniBoss framework + 3 concrete minibosses.
 *
 * Pattern mirrors CEOBoss:
 *   - Invisible physics rectangle as hitbox/body
 *   - Placeholder visual (sprite if texture exists, else colored rect + label)
 *   - HP, optional phase 2, timed attacks
 *   - Slow drift toward player
 *   - Emits boss:spawned / boss:hp (ratio) → reuses HUD bossBarContainer
 *   - On death: drops item by rarity + coins, emits miniboss:defeated {id}
 *   - Does NOT emit boss:defeated (that triggers victory)
 */

import Phaser from 'phaser';
import { MINIBOSS } from '@/config/game.config';
import type { RunContext } from '@/systems/RunContext';
import type { WeaponSystem } from '@/systems/WeaponSystem';
import type { EnemySystem } from '@/systems/EnemySystem';
import { Projectile } from './Projectile';
import { ITEMS } from '@/config/items.config';
import { RARITY_WEIGHTS, RARITY_RULES } from '@/config/game.config';
import { applyItemPickup } from '@/systems/ItemReactions';
import { recomputeModifiers } from '@/systems/RunContext';
import type { Rarity } from '@/types';

// ─── Base class ──────────────────────────────────────────────────────────────

export abstract class MiniBoss {
  readonly id: string;
  body!: Phaser.GameObjects.Rectangle;
  protected visual: Phaser.GameObjects.GameObject | null = null;

  protected scene: Phaser.Scene;
  protected ctx: RunContext;
  protected enemySys: EnemySystem;
  protected weaponSys: WeaponSystem;

  hp: number;
  protected maxHp: number;
  alive = false;

  protected phase: 1 | 2 = 1;
  protected phase2Triggered = false;

  // Each subclass sets these
  protected readonly contactDamage: number;
  protected readonly contactRange: number;
  protected readonly dropRarity: Rarity;
  protected readonly dropCoins: number;

  constructor(
    id: string,
    scene: Phaser.Scene,
    ctx: RunContext,
    weaponSys: WeaponSystem,
    enemySys: EnemySystem,
    hp: number,
    size: number,
    color: number,
    contactDamage: number,
    dropRarity: Rarity,
    dropCoins: number,
  ) {
    this.id = id;
    this.scene = scene;
    this.ctx = ctx;
    this.enemySys = enemySys;
    this.weaponSys = weaponSys;
    this.hp = hp;
    this.maxHp = hp;
    this.contactDamage = contactDamage;
    this.contactRange = MINIBOSS.CONTACT_RANGE;
    this.dropRarity = dropRarity;
    this.dropCoins = dropCoins;

    // Spawn near top-center of the viewport (like CEO)
    const view = scene.cameras.main.worldView;
    const cx = view.centerX;
    const cy = view.y + 80;

    // Physics body (invisible hitbox)
    this.body = scene.add.rectangle(cx, cy, size, size, color, 0);
    scene.physics.add.existing(this.body);
    const phys = this.body.body as Phaser.Physics.Arcade.Body;
    phys.setCollideWorldBounds(true);

    // Placeholder visual
    this.buildVisual(cx, cy, size, color);

    this.alive = true;

    // Player projectiles → miniboss
    scene.physics.add.overlap(
      weaponSys.projectilePool,
      this.body,
      (a, b) => {
        const proj = (a instanceof Projectile ? a : b instanceof Projectile ? b : null);
        if (!proj || !proj.active || !this.alive) return;
        this.takeDamage(proj.damage);
        proj.deactivate();
      },
    );

    // Tell HUD to show boss bar
    ctx.bus.emit('boss:spawned');
  }

  protected buildVisual(cx: number, cy: number, size: number, color: number): void {
    // Default placeholder: colored filled rect + text label
    const rect = this.scene.add.rectangle(cx, cy, size, size, color, 0.85)
      .setDepth(3)
      .setStrokeStyle(3, 0xffffff);
    this.visual = rect;

    this.scene.add.text(cx, cy, this.id.slice(0, 3).toUpperCase(), {
      fontSize: '10px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(4);
  }

  protected syncVisual(): void {
    if (this.visual instanceof Phaser.GameObjects.Rectangle) {
      this.visual.setPosition(this.body.x, this.body.y);
    } else if (this.visual instanceof Phaser.GameObjects.Sprite) {
      this.visual.setPosition(this.body.x, this.body.y);
    }
  }

  takeDamage(amount: number): void {
    if (!this.alive) return;
    this.hp -= amount;

    // Hit flash
    if (this.visual instanceof Phaser.GameObjects.Rectangle) {
      this.visual.setFillStyle(0xffffff, 0.95);
      this.scene.time.delayedCall(60, () => {
        if (this.alive && this.visual instanceof Phaser.GameObjects.Rectangle) {
          this.visual.setFillStyle(this.getColor(), 0.85);
        }
      });
    } else if (this.visual instanceof Phaser.GameObjects.Sprite) {
      (this.visual as Phaser.GameObjects.Sprite).setTintFill(0xffffff);
      this.scene.time.delayedCall(60, () => {
        if (this.alive) (this.visual as Phaser.GameObjects.Sprite).clearTint();
      });
    }

    this.onTakeDamage();

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  /** Override for phase-transition or special on-hit logic. */
  protected onTakeDamage(): void { /* default: nothing */ }

  /** Override to return the fill color used for placeholder. */
  protected getColor(): number { return 0x888888; }

  update(_time: number, delta: number): void {
    if (!this.alive) return;

    this.syncVisual();

    const px = this.scene.data.get('playerX') as number ?? 480;
    const py = this.scene.data.get('playerY') as number ?? 270;

    // Slow drift toward player
    const angle = Phaser.Math.Angle.Between(this.body.x, this.body.y, px, py);
    const phys = this.body.body as Phaser.Physics.Arcade.Body;
    if (!this.isDashing()) {
      phys.setVelocity(
        Math.cos(angle) * MINIBOSS.DRIFT_SPEED,
        Math.sin(angle) * MINIBOSS.DRIFT_SPEED,
      );
    }

    this.updateAttacks(delta, px, py);

    // HP bar via HUD event
    const ratio = Math.max(0, this.hp / this.maxHp);
    this.ctx.bus.emit('boss:hp', { ratio });
  }

  /** Override to return true when the boss is executing a dash (suppress drift). */
  protected isDashing(): boolean { return false; }

  /** Override in subclass to run attack timers. */
  protected abstract updateAttacks(delta: number, px: number, py: number): void;

  private die(): void {
    this.alive = false;
    const phys = this.body.body as Phaser.Physics.Arcade.Body;
    phys.setVelocity(0, 0);
    phys.enable = false;

    // Grant drop
    this.grantDrop();

    // Death tween
    this.scene.tweens.add({
      targets: this.body, scaleX: 2, scaleY: 2, alpha: 0,
      duration: 600, ease: 'Cubic.Out',
      onComplete: () => this.body.setVisible(false),
    });
    if (this.visual) {
      this.scene.tweens.add({
        targets: this.visual, alpha: 0,
        duration: 600, ease: 'Cubic.Out',
      });
    }

    // Tell SpawnDirector/GameScene to continue (SpawnDirector also triggers wave:cleared)
    // NOTE: do NOT emit 'boss:defeated' — that triggers CEO victory logic.
    this.ctx.bus.emit('miniboss:defeated', { id: this.id });
  }

  private grantDrop(): void {
    // Coins
    this.ctx.player.coins += this.dropCoins;
    this.ctx.stats.coinsEarned += this.dropCoins;

    // Item by rarity (weighted pick restricted to dropRarity, fallback to common)
    const level = this.ctx.player.level;
    const pool = ITEMS.filter(item => {
      if (item.category === 'consumable') return false;
      if (item.rarity !== this.dropRarity) return false;
      if (this.ctx.player.items.includes(item.id) && (!item.maxStack || item.maxStack <= 1)) return false;
      if (item.rarity === 'epic' && level < RARITY_RULES.EPIC_MIN_LEVEL) return false;
      if (item.rarity === 'legendary' && level < RARITY_RULES.LEGENDARY_MIN_LEVEL) return false;
      return true;
    });

    // Fallback: any eligible item if desired rarity has no candidates
    const pickPool = pool.length > 0 ? pool : ITEMS.filter(item => {
      if (item.category === 'consumable') return false;
      if (this.ctx.player.items.includes(item.id) && (!item.maxStack || item.maxStack <= 1)) return false;
      return true;
    });

    if (pickPool.length === 0) return;

    const totalW = pickPool.reduce((s, i) => s + RARITY_WEIGHTS[i.rarity], 0);
    let rand = Math.random() * totalW;
    let picked = pickPool[pickPool.length - 1];
    for (const item of pickPool) {
      rand -= RARITY_WEIGHTS[item.rarity];
      if (rand <= 0) { picked = item; break; }
    }

    applyItemPickup(this.ctx, picked);
    recomputeModifiers(this.ctx);
    this.ctx.bus.emit('upgrade:item_selected', { id: picked.id });
  }
}

// ─── §C.1 — Supervisor General ───────────────────────────────────────────────

export class SupervisorBoss extends MiniBoss {
  private sonicTimer = 0;
  private kickTimer = 0;
  private reunionTimer = 0;
  private megaTimer = 0;

  private kicking = false;
  private kickEndMs = 0;

  constructor(scene: Phaser.Scene, ctx: RunContext, weaponSys: WeaponSystem, enemySys: EnemySystem) {
    const cfg = MINIBOSS.SUPERVISOR;
    super(
      'supervisor', scene, ctx, weaponSys, enemySys,
      cfg.HP, cfg.SIZE, cfg.COLOR,
      cfg.CONTACT_DAMAGE, cfg.DROP_RARITY, cfg.DROP_COINS,
    );
    this.updateBossLabel('SUPERVISOR');
  }

  private updateBossLabel(label: string): void {
    // Update the HUD label by emitting a custom event (HUD reads boss:spawned label from CEO)
    // We set scene data so GameScene can pass it when emitting boss:spawned.
    this.scene.data.set('minibossLabel', label);
  }

  protected getColor(): number { return MINIBOSS.SUPERVISOR.COLOR; }

  protected isDashing(): boolean { return this.kicking; }

  protected onTakeDamage(): void {
    const cfg = MINIBOSS.SUPERVISOR;
    if (this.phase === 1 && this.hp <= this.maxHp * cfg.PHASE2_HP_FRAC) {
      this.phase = 2;
      // Flash white
      if (this.visual instanceof Phaser.GameObjects.Rectangle) {
        this.visual.setFillStyle(0xffffff, 1);
        this.scene.time.delayedCall(300, () => {
          if (this.alive && this.visual instanceof Phaser.GameObjects.Rectangle) {
            this.visual.setFillStyle(cfg.COLOR, 0.85);
          }
        });
      }
    }
  }

  protected updateAttacks(delta: number, px: number, py: number): void {
    const cfg = MINIBOSS.SUPERVISOR;
    const mult = this.phase === 2 ? 0.75 : 1.0;

    this.sonicTimer += delta;
    this.kickTimer += delta;
    this.reunionTimer += delta;
    if (this.phase === 2) this.megaTimer += delta;

    // Kick (dash toward player)
    if (this.kicking) {
      this.kickEndMs -= delta;
      if (this.kickEndMs <= 0) {
        this.kicking = false;
        (this.body.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      }
      return; // no other attacks during kick
    }

    // Grito Sónico — push player away
    if (this.sonicTimer >= cfg.SONIC_CD * mult) {
      this.sonicTimer = 0;
      this.fireSonicScream(px, py);
    }

    // Patada — dash at player
    if (this.kickTimer >= cfg.KICK_CD * mult) {
      this.kickTimer = 0;
      this.startKick(px, py);
    }

    // ¡Reunión! — summon 4 angry_email
    if (this.reunionTimer >= cfg.REUNION_CD * mult) {
      this.reunionTimer = 0;
      const view = this.scene.cameras.main.worldView;
      const corners = [
        { x: view.left + 20, y: view.top + 20 },
        { x: view.right - 20, y: view.top + 20 },
        { x: view.left + 20, y: view.bottom - 20 },
        { x: view.right - 20, y: view.bottom - 20 },
      ];
      for (const c of corners) {
        this.enemySys.spawn('angry_email', c.x, c.y);
      }
    }

    // Megáfono Total (phase 2) — shockwave with center gap
    if (this.phase === 2 && this.megaTimer >= cfg.MEGA_CD * mult) {
      this.megaTimer = 0;
      this.fireMegaphone(px, py);
    }
  }

  private fireSonicScream(px: number, py: number): void {
    const cfg = MINIBOSS.SUPERVISOR;
    // Damage + knockback push via radius check — we deal damage in radius and push player
    this.enemySys.damageInRadius(this.body.x, this.body.y, cfg.SONIC_PUSH, 15, 'supervisor_sonic');
    // Push player
    const dist = Phaser.Math.Distance.Between(this.body.x, this.body.y, px, py);
    if (dist < cfg.SONIC_PUSH) {
      const angle = Phaser.Math.Angle.Between(this.body.x, this.body.y, px, py);
      const playerBody = this.scene.data.get('playerBodyRef') as Phaser.GameObjects.Rectangle | undefined;
      if (playerBody) {
        const pb = playerBody.body as Phaser.Physics.Arcade.Body | undefined;
        if (pb) {
          pb.setVelocity(Math.cos(angle) * 350, Math.sin(angle) * 350);
          this.scene.time.delayedCall(300, () => { pb.setVelocity(0, 0); });
        }
      }
      // Also emit player:hit so it applies damage
      this.ctx.bus.emit('player:hit', { amount: 12 });
    }
    // Visual flash
    if (this.visual instanceof Phaser.GameObjects.Rectangle) {
      this.visual.setFillStyle(0xffff00, 0.95);
      this.scene.time.delayedCall(150, () => {
        if (this.alive && this.visual instanceof Phaser.GameObjects.Rectangle) {
          this.visual.setFillStyle(cfg.COLOR, 0.85);
        }
      });
    }
  }

  private startKick(px: number, py: number): void {
    const cfg = MINIBOSS.SUPERVISOR;
    this.kicking = true;
    this.kickEndMs = cfg.KICK_DURATION_MS;
    const angle = Phaser.Math.Angle.Between(this.body.x, this.body.y, px, py);
    (this.body.body as Phaser.Physics.Arcade.Body).setVelocity(
      Math.cos(angle) * cfg.KICK_SPEED,
      Math.sin(angle) * cfg.KICK_SPEED,
    );
  }

  private fireMegaphone(px: number, py: number): void {
    void px; void py;
    const cfg = MINIBOSS.SUPERVISOR;
    // 16 radial projectiles from boss, with gap in front (inner radius gap = center gap)
    const count = 16;
    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.DegToRad(i * (360 / count));
      const tx = this.body.x + Math.cos(angle) * cfg.MEGA_INNER_R;
      const ty = this.body.y + Math.sin(angle) * cfg.MEGA_INNER_R;
      const proj = this.enemySys.enemyProjectilePool.get(tx, ty) as Projectile | null;
      if (!proj) continue;
      proj.fire(tx, ty, Math.cos(angle) * 200, Math.sin(angle) * 200, cfg.MEGA_DAMAGE, 'supervisor_mega', 0, 0, 'none', 2000);
      proj.setFillStyle(0xff8800);
    }
  }
}

// ─── §C.2 — Impresora Industrial ─────────────────────────────────────────────

export class PrinterIndustrialBoss extends MiniBoss {
  private tornadoTimer = 0;
  private inkTimer = 0;
  private wallTimer = 0;
  private paperTimer = 0;

  constructor(scene: Phaser.Scene, ctx: RunContext, weaponSys: WeaponSystem, enemySys: EnemySystem) {
    const cfg = MINIBOSS.PRINTER_INDUSTRIAL;
    super(
      'printer_industrial', scene, ctx, weaponSys, enemySys,
      cfg.HP, cfg.SIZE, cfg.COLOR,
      cfg.CONTACT_DAMAGE, cfg.DROP_RARITY, cfg.DROP_COINS,
    );
    // Override visual: use possessed_printer sprite scaled large if available
    this.buildPrinterVisual(cfg.SIZE, cfg.COLOR);
  }

  private buildPrinterVisual(size: number, color: number): void {
    const view = this.scene.cameras.main.worldView;
    const cx = view.centerX;
    const cy = view.y + 80;

    const key = 'enemysheet_possessed_printer';
    if (this.scene.textures.exists(key)) {
      if (this.visual) (this.visual as Phaser.GameObjects.Rectangle).setVisible(false);
      const spr = this.scene.add.sprite(cx, cy, key)
        .setDisplaySize(size, size)
        .setTint(color)
        .setDepth(3);
      this.visual = spr;
    }
    // else keep the rect placeholder from base constructor
  }

  protected getColor(): number { return MINIBOSS.PRINTER_INDUSTRIAL.COLOR; }

  protected onTakeDamage(): void {
    const cfg = MINIBOSS.PRINTER_INDUSTRIAL;
    if (this.phase === 1 && this.hp <= this.maxHp * cfg.PHASE2_HP_FRAC) {
      this.phase = 2;
      if (this.visual instanceof Phaser.GameObjects.Sprite) {
        this.visual.setTint(0xff44ff);
      } else if (this.visual instanceof Phaser.GameObjects.Rectangle) {
        this.visual.setFillStyle(0xff44ff, 0.85);
      }
    }
  }

  protected updateAttacks(delta: number, px: number, py: number): void {
    const cfg = MINIBOSS.PRINTER_INDUSTRIAL;
    const mult = this.phase === 2 ? 0.75 : 1.0;

    this.tornadoTimer += delta;
    this.inkTimer += delta;
    this.wallTimer += delta;
    if (this.phase === 2) this.paperTimer += delta;

    if (this.tornadoTimer >= cfg.TORNADO_CD * mult) {
      this.tornadoTimer = 0;
      this.fireTornado();
    }

    if (this.inkTimer >= cfg.INK_CD * mult) {
      this.inkTimer = 0;
      this.fireInkJet(px, py);
    }

    if (this.wallTimer >= cfg.WALL_CD * mult) {
      this.wallTimer = 0;
      this.firePaperWall(px, py);
    }

    if (this.phase === 2 && this.paperTimer >= cfg.PAPER_CD) {
      this.paperTimer = 0;
      this.firePaperInfinite();
    }
  }

  private fireTornado(): void {
    const cfg = MINIBOSS.PRINTER_INDUSTRIAL;
    for (let i = 0; i < cfg.TORNADO_COUNT; i++) {
      const angle = Phaser.Math.DegToRad(i * (360 / cfg.TORNADO_COUNT));
      const proj = this.enemySys.enemyProjectilePool.get(this.body.x, this.body.y) as Projectile | null;
      if (!proj) continue;
      proj.fire(
        this.body.x, this.body.y,
        Math.cos(angle) * 220, Math.sin(angle) * 220,
        18, 'printer_tornado', 0, 0, 'none',
      );
      proj.setFillStyle(0xdddddd);
    }
  }

  private fireInkJet(px: number, py: number): void {
    const baseAngle = Phaser.Math.Angle.Between(this.body.x, this.body.y, px, py);
    // 3-spread arc
    for (let s = -1; s <= 1; s++) {
      const angle = baseAngle + Phaser.Math.DegToRad(s * 18);
      const proj = this.enemySys.enemyProjectilePool.get(this.body.x, this.body.y) as Projectile | null;
      if (!proj) continue;
      proj.fire(
        this.body.x, this.body.y,
        Math.cos(angle) * 200, Math.sin(angle) * 200,
        14, 'printer_ink', 0, 0, 'zoneOnHit',
      );
      proj.setFillStyle(0x220066);
    }
    // Spawn ink zone at current position (the blot grows behind the spray)
    this.spawnInkZone(this.body.x, this.body.y);
  }

  private spawnInkZone(x: number, y: number): void {
    const cfg = MINIBOSS.PRINTER_INDUSTRIAL;
    // Emit a bus event — GameScene listens and spawns from its zonePool.
    this.ctx.bus.emit('miniboss:spawnZone', {
      x, y,
      radius: cfg.INK_ZONE_R,
      dps: cfg.INK_ZONE_DPS,
      durationMs: cfg.INK_ZONE_DUR_MS,
      color: 0x220066,
    });
  }

  private firePaperWall(px: number, py: number): void {
    const cfg = MINIBOSS.PRINTER_INDUSTRIAL;
    // Line of projectiles perpendicular to player direction, with an 80px gap centered on the player
    const angle = Phaser.Math.Angle.Between(this.body.x, this.body.y, px, py);
    const perpAngle = angle + Math.PI / 2;

    const halfSpan = (cfg.WALL_PROJ_COUNT * 60) / 2;
    const halfGap = cfg.WALL_GAP_PX / 2;

    for (let i = 0; i < cfg.WALL_PROJ_COUNT; i++) {
      const offset = -halfSpan + i * 60;
      if (Math.abs(offset) < halfGap) continue; // gap around center

      const sx = this.body.x + Math.cos(perpAngle) * offset;
      const sy = this.body.y + Math.sin(perpAngle) * offset;
      const proj = this.enemySys.enemyProjectilePool.get(sx, sy) as Projectile | null;
      if (!proj) continue;
      proj.fire(
        sx, sy,
        Math.cos(angle) * 160, Math.sin(angle) * 160,
        20, 'printer_wall', 0, 0, 'none', 2500,
      );
      proj.setFillStyle(0xaaaaaa);
    }
  }

  private firePaperInfinite(): void {
    // 8 directions, phase 2 rapid fire
    for (let i = 0; i < 8; i++) {
      const angle = Phaser.Math.DegToRad(i * 45);
      const proj = this.enemySys.enemyProjectilePool.get(this.body.x, this.body.y) as Projectile | null;
      if (!proj) continue;
      proj.fire(
        this.body.x, this.body.y,
        Math.cos(angle) * 240, Math.sin(angle) * 240,
        16, 'printer_paper', 0, 0, 'none', 1800,
      );
      proj.setFillStyle(0xeeeeee);
    }
  }
}

// ─── §C.3 — Comité de Evaluación (3 auditores compartiendo HP) ────────────────

interface CommitteeMember {
  body: Phaser.GameObjects.Rectangle;
  sprite: Phaser.GameObjects.Sprite | null;
  hp: number;
  alive: boolean;
  chargeTimer: number;
  damageMult: number;
  speedMult: number;
}

export class CommitteeBoss extends MiniBoss {
  private members: CommitteeMember[] = [];
  private sharedHp: number;
  private sharedMaxHp: number;
  private chargeTimer = 0;

  // Expose the three member bodies for contact damage
  memberBodies: Phaser.GameObjects.Rectangle[] = [];

  constructor(scene: Phaser.Scene, ctx: RunContext, weaponSys: WeaponSystem, enemySys: EnemySystem) {
    const cfg = MINIBOSS.COMMITTEE;
    // Dummy: base class body won't be used as-is; we'll hide it
    super(
      'committee', scene, ctx, weaponSys, enemySys,
      cfg.HP_TOTAL, 1, 0x000000,   // size 1: hidden placeholder body
      cfg.CONTACT_DAMAGE, cfg.DROP_RARITY, cfg.DROP_COINS,
    );

    // Hide the base body / visual (not used for committee)
    this.body.setVisible(false);
    (this.body.body as Phaser.Physics.Arcade.Body).enable = false;

    this.sharedHp = cfg.HP_TOTAL;
    this.sharedMaxHp = cfg.HP_TOTAL;

    const view = scene.cameras.main.worldView;
    const cx = view.centerX;
    const cy = view.y + 80;

    // Spawn 3 members side-by-side
    for (let i = 0; i < 3; i++) {
      const mx = cx + (i - 1) * cfg.SPREAD;
      const my = cy;
      const tint = cfg.COLORS[i];
      const member = this.spawnMember(mx, my, tint, cfg.HP_EACH, weaponSys);
      this.members.push(member);
      this.memberBodies.push(member.body);
    }
    this.chargeTimer = 0;
  }

  private spawnMember(
    x: number, y: number, tint: number, memberHp: number,
    weaponSys: WeaponSystem,
  ): CommitteeMember {
    const cfg = MINIBOSS.COMMITTEE;

    const body = this.scene.add.rectangle(x, y, cfg.SIZE, cfg.SIZE, tint, 0);
    this.scene.physics.add.existing(body);
    (body.body as Phaser.Physics.Arcade.Body).setCollideWorldBounds(true);

    let sprite: Phaser.GameObjects.Sprite | null = null;
    const key = 'enemysheet_auditor';
    if (this.scene.textures.exists(key)) {
      sprite = this.scene.add.sprite(x, y, key).setTint(tint).setScale(1.4).setDepth(3);
    } else {
      this.scene.add.rectangle(x, y, cfg.SIZE, cfg.SIZE, tint, 0.85).setDepth(3);
    }

    // Player projectiles → this member
    this.scene.physics.add.overlap(
      weaponSys.projectilePool,
      body,
      (a, b) => {
        const proj = (a instanceof Projectile ? a : b instanceof Projectile ? b : null);
        if (!proj || !proj.active || !this.alive) return;
        const member = this.members.find(m => m.body === body);
        if (!member || !member.alive) return;
        this.takeDamageMember(member, proj.damage);
        proj.deactivate();
      },
    );

    return {
      body,
      sprite,
      hp: memberHp,
      alive: true,
      chargeTimer: 0,
      damageMult: 1,
      speedMult: 1,
    };
  }

  private takeDamageMember(member: CommitteeMember, amount: number): void {
    if (!member.alive) return;
    member.hp -= amount;
    this.sharedHp -= amount;

    // Hit flash
    if (member.sprite) {
      member.sprite.setTintFill(0xffffff);
      this.scene.time.delayedCall(60, () => {
        if (member.alive && member.sprite) member.sprite.clearTint();
      });
    } else {
      member.body.setFillStyle(0xffffff, 0.9);
      const idx = this.members.indexOf(member);
      const tint = idx >= 0 ? MINIBOSS.COMMITTEE.COLORS[idx] : 0x888888;
      this.scene.time.delayedCall(60, () => {
        if (member.alive) member.body.setFillStyle(tint, 0.85);
      });
    }

    if (member.hp <= 0) {
      member.hp = 0;
      this.killMember(member);
    }

    if (this.sharedHp <= 0 && this.alive) {
      this.sharedHp = 0;
      // takeDamage in base sets this.hp; force it
      this.hp = 0;
      // Manually call die via parent mechanism
      this.forceKill();
    }
  }

  private killMember(member: CommitteeMember): void {
    member.alive = false;
    (member.body.body as Phaser.Physics.Arcade.Body).enable = false;
    this.scene.tweens.add({
      targets: member.body, alpha: 0, scaleX: 1.5, scaleY: 1.5,
      duration: 400, ease: 'Cubic.Out',
      onComplete: () => member.body.setVisible(false),
    });
    if (member.sprite) {
      this.scene.tweens.add({
        targets: member.sprite, alpha: 0,
        duration: 400, ease: 'Cubic.Out',
        onComplete: () => { if (member.sprite) member.sprite.setVisible(false); },
      });
    }

    // Enrage remaining members
    const cfg = MINIBOSS.COMMITTEE;
    for (const m of this.members) {
      if (m.alive) {
        m.damageMult *= cfg.ENRAGE_DMG_MULT;
        m.speedMult *= cfg.ENRAGE_SPD_MULT;
      }
    }
  }

  private forceKill(): void {
    if (!this.alive) return;
    this.alive = false;

    // Kill all remaining members visually
    for (const m of this.members) {
      if (m.alive) this.killMember(m);
    }

    this.grantDropAndEmit();
  }

  private grantDropAndEmit(): void {
    // Replicate grantDrop from base + emit events
    const cfg = MINIBOSS.COMMITTEE;
    this.ctx.player.coins += cfg.DROP_COINS;
    this.ctx.stats.coinsEarned += cfg.DROP_COINS;

    const level = this.ctx.player.level;
    const dropRarity = cfg.DROP_RARITY as string;
    const pool = ITEMS.filter(item => {
      if (item.category === 'consumable') return false;
      if ((item.rarity as string) !== dropRarity) return false;
      if (this.ctx.player.items.includes(item.id) && (!item.maxStack || item.maxStack <= 1)) return false;
      if ((item.rarity as string) === 'epic' && level < RARITY_RULES.EPIC_MIN_LEVEL) return false;
      if ((item.rarity as string) === 'legendary' && level < RARITY_RULES.LEGENDARY_MIN_LEVEL) return false;
      return true;
    });
    const pickPool = pool.length > 0 ? pool : ITEMS.filter(item => {
      if (item.category === 'consumable') return false;
      if (this.ctx.player.items.includes(item.id) && (!item.maxStack || item.maxStack <= 1)) return false;
      return true;
    });
    if (pickPool.length > 0) {
      const totalW = pickPool.reduce((s, i) => s + RARITY_WEIGHTS[i.rarity], 0);
      let rand = Math.random() * totalW;
      let picked = pickPool[pickPool.length - 1];
      for (const item of pickPool) {
        rand -= RARITY_WEIGHTS[item.rarity];
        if (rand <= 0) { picked = item; break; }
      }
      applyItemPickup(this.ctx, picked);
      recomputeModifiers(this.ctx);
      this.ctx.bus.emit('upgrade:item_selected', { id: picked.id });
    }

    // NOTE: do NOT emit 'boss:defeated' — that triggers CEO victory logic.
    this.ctx.bus.emit('miniboss:defeated', { id: this.id });
  }

  // Override takeDamage: committee damage is distributed to members individually via overlap
  // so base class takeDamage should NOT be called from projectile overlaps.
  // The base class overlap callback is bypassed (body physics disabled above).
  // But contact damage from GameScene calls takeDamage(amount) on this object —
  // route that to the nearest member.
  override takeDamage(amount: number): void {
    if (!this.alive) return;
    // Find the nearest alive member to the player as the target
    const px = this.scene.data.get('playerX') as number ?? 480;
    const py = this.scene.data.get('playerY') as number ?? 270;
    let nearest: CommitteeMember | null = null;
    let bestDist = Infinity;
    for (const m of this.members) {
      if (!m.alive) continue;
      const d = Phaser.Math.Distance.Between(m.body.x, m.body.y, px, py);
      if (d < bestDist) { bestDist = d; nearest = m; }
    }
    if (nearest) this.takeDamageMember(nearest, amount);
  }

  update(time: number, delta: number): void {
    if (!this.alive) return;

    const px = this.scene.data.get('playerX') as number ?? 480;
    const py = this.scene.data.get('playerY') as number ?? 270;

    this.chargeTimer += delta;

    // Move each alive member toward player, apply drift + individual speed mults
    for (const m of this.members) {
      if (!m.alive) continue;
      const angle = Phaser.Math.Angle.Between(m.body.x, m.body.y, px, py);
      const speed = MINIBOSS.DRIFT_SPEED * m.speedMult;
      (m.body.body as Phaser.Physics.Arcade.Body).setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
      );
      if (m.sprite) m.sprite.setPosition(m.body.x, m.body.y);
      else m.body.setVisible(true);
    }

    // Coordinated charge every 10s
    if (this.chargeTimer >= MINIBOSS.COMMITTEE.CHARGE_CD) {
      this.chargeTimer = 0;
      this.coordinatedCharge(px, py);
    }

    // HP bar via HUD
    const ratio = Math.max(0, this.sharedHp / this.sharedMaxHp);
    this.ctx.bus.emit('boss:hp', { ratio });

    void time;
  }

  private coordinatedCharge(px: number, py: number): void {
    const cfg = MINIBOSS.COMMITTEE;
    for (const m of this.members) {
      if (!m.alive) continue;
      const angle = Phaser.Math.Angle.Between(m.body.x, m.body.y, px, py);
      const phys = m.body.body as Phaser.Physics.Arcade.Body;
      phys.setVelocity(
        Math.cos(angle) * cfg.CHARGE_SPEED * m.speedMult,
        Math.sin(angle) * cfg.CHARGE_SPEED * m.speedMult,
      );
      this.scene.time.delayedCall(cfg.CHARGE_DURATION_MS, () => {
        if (m.alive) phys.setVelocity(0, 0);
      });
    }
  }

  // Stub: committee doesn't use base updateAttacks
  protected updateAttacks(_delta: number, _px: number, _py: number): void { /* handled in update() */ }

  // Contact range check for GameScene: check per-member
  getAliveMemberBodies(): Array<{ body: Phaser.GameObjects.Rectangle; damage: number }> {
    return this.members
      .filter(m => m.alive)
      .map(m => ({ body: m.body, damage: Math.round(MINIBOSS.COMMITTEE.CONTACT_DAMAGE * m.damageMult) }));
  }

  // Return combined HP for GameScene boss bar (already handled via bus in update)
  get combinedHpRatio(): number {
    return this.sharedHp / this.sharedMaxHp;
  }
}
