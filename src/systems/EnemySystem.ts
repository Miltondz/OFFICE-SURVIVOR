import Phaser from 'phaser';
import { COMBAT, SPAWN, BOSS, ITEMS_E2 } from '@/config/game.config';
import { CHAR } from '@/config/characters.config';
import type { RunContext } from './RunContext';
import type { EnemyType } from '@/types';
import { Enemy } from '@/entities/Enemy';
import { getEnemyById } from '@/config/enemies.config';
import type { WeaponSystem } from './WeaponSystem';
import type { Projectile } from '@/entities/Projectile';
import type { DamageZone } from '@/entities/DamageZone';

export class EnemySystem {
  private scene: Phaser.Scene;
  private ctx: RunContext;
  enemyPool!: Phaser.GameObjects.Group;
  private zonePool!: Phaser.GameObjects.Group;
  private weaponSys!: WeaponSystem;
  private playerRef!: import('@/entities/Player').Player;

  // Enemy projectiles (for possessed_printer and CEO)
  enemyProjectilePool!: Phaser.GameObjects.Group;

  // Track HR aura effect
  private hrAliveCount = 0;

  constructor(scene: Phaser.Scene, ctx: RunContext) {
    this.scene = scene;
    this.ctx = ctx;

    ctx.bus.on('enemy:killed', (p: { type: EnemyType; isElite: boolean; x: number; y: number; sourceId: string }) => {
      if (p.type === 'hr_rep') this.hrAliveCount = Math.max(0, this.hrAliveCount - 1);
      if (p.type === 'toxic_manager') {
        this.spawnZone(p.x, p.y, 30, SPAWN.TOXIC_ZONE_DPS, SPAWN.TOXIC_ZONE_DURATION_MS);
      }
    });
  }

  init(
    playerRef: import('@/entities/Player').Player,
    weaponSys: WeaponSystem,
    zonePool: Phaser.GameObjects.Group,
    enemyProjPool: Phaser.GameObjects.Group,
  ): void {
    this.playerRef = playerRef;
    this.weaponSys = weaponSys;
    this.zonePool = zonePool;
    this.enemyProjectilePool = enemyProjPool;

    this.enemyPool = this.scene.physics.add.group({
      classType: Enemy,
      maxSize: COMBAT.ENEMY_POOL_SIZE,
      runChildUpdate: true,
    });

    // Collisions: projectiles ↔ enemies
    this.scene.physics.add.overlap(
      this.weaponSys.projectilePool,
      this.enemyPool,
      (projGO, enemyGO) => {
        const proj = projGO as Projectile;
        const enemy = enemyGO as Enemy;
        if (!proj.active || !enemy.isActive2 || enemy.ally) return;  // no friendly fire on allies

        // Meeting Overflow: on kill explosion
        const wasAlive = enemy.hp > 0;
        enemy.takeDamage(proj.damage, proj.sourceId, proj.isCrit);
        if (wasAlive && enemy.hp <= 0 && this.ctx.player.items.includes('meeting_overflow')) {
          this.damageInRadius(enemy.x, enemy.y, 80, proj.damage * 0.5, 'meeting_overflow');
        }

        this.weaponSys.onProjectileHit(proj, enemy.x, enemy.y, enemy);

        // §E2 avalancha: primary hit → spawn secondary projectile toward nearest enemy — nuevo (fase E2)
        if (!proj.isSecondary && this.ctx.player.items.includes('avalancha')) {
          this.weaponSys.spawnAvalanchaSecondary(enemy.x, enemy.y, proj.damage, proj.sourceId);
        }

        // Knockback
        if (proj.effectTag === 'knockback') {
          const angle = Phaser.Math.Angle.Between(this.playerRef.x, this.playerRef.y, enemy.x, enemy.y);
          const body = enemy.body as Phaser.Physics.Arcade.Body;
          body.setVelocity(Math.cos(angle) * 300, Math.sin(angle) * 300);
          this.scene.time.delayedCall(200, () => { body.setVelocity(0, 0); });
        }

        if (proj.pierceLeft <= 0) {
          proj.deactivate();
        } else {
          proj.pierceLeft--;
        }
      },
    );

    // Collisions: player ↔ enemies (contact damage)
    this.scene.physics.add.overlap(
      this.playerRef.body,
      this.enemyPool,
      (_playerGO, enemyGO) => {
        const enemy = enemyGO as Enemy;
        if (!enemy.isActive2 || enemy.ally) return;  // allies don't damage the player
        if (enemy.isBonus) return;  // §B bonus enemies deal no contact damage
        if (enemy.contactCooldown > 0) return;
        // NDAs: HR Rep can't slow
        if (enemy.enemyType === 'hr_rep' && this.ctx.player.items.includes('ndas_firmadas')) return;

        enemy.contactCooldown = COMBAT.CONTACT_DAMAGE_COOLDOWN_MS;
        this.playerRef.takeDamage(enemy.def.damage);
      },
    );

    // Enemy projectiles ↔ player
    this.scene.physics.add.overlap(
      this.playerRef.body,
      this.enemyProjectilePool,
      (_playerGO, eProjGO) => {
        const eProj = eProjGO as Projectile;
        if (!eProj.active) return;
        this.playerRef.takeDamage(eProj.damage);
        eProj.deactivate();
      },
    );

    // Damage zones ↔ player (handled manually in update)
  }

  /** §B — spawn a bonus enemy (no contact damage, ×2 coins, auto-despawn). */
  spawnBonus(typeId: EnemyType, x: number, y: number): void {
    this.spawn(typeId, x, y);
    // Mark the most-recently activated enemy as bonus
    const children = this.enemyPool.getChildren();
    for (let i = children.length - 1; i >= 0; i--) {
      const e = children[i] as Enemy;
      if (e.isActive2 && e.enemyType === typeId) {
        e.markAsBonus();
        break;
      }
    }
  }

  spawn(typeId: EnemyType, x: number, y: number): void {
    const def = getEnemyById(typeId);
    if (!def) return;

    const enemy = this.enemyPool.get(x, y) as Enemy | null;
    if (!enemy) return;

    // ceo_memo: normal enemies -20% HP. Apply via scaled def.
    let spawnDef = def;
    if (this.ctx.player.items.includes('ceo_memo') && typeId !== 'ceo') {
      spawnDef = { ...def, hp: Math.max(1, Math.floor(def.hp * BOSS.CEO_MEMO_ENEMY_HP_MULT)) };
    }

    // RRHH: Auditores con +50% HP.
    const ch = this.ctx.character;
    if (typeId === 'auditor' && ch.auditorHpMult) {
      spawnDef = { ...spawnDef, hp: Math.ceil(spawnDef.hp * ch.auditorHpMult) };
    }

    // difficultyMult: ipo infinite scaling applied to hp and damage
    if (this.ctx.difficultyMult > 1) {
      spawnDef = {
        ...spawnDef,
        hp: Math.ceil(spawnDef.hp * this.ctx.difficultyMult),
        damage: Math.ceil(spawnDef.damage * this.ctx.difficultyMult),
      };
    }

    enemy.spawn(spawnDef, x, y, this.ctx);
    enemy.ally = false;

    // Auditor: set invincible for first AUDITOR_INVINCIBLE_MS
    if (typeId === 'auditor') {
      enemy.invincible = true;
      enemy.invincibleTimer = SPAWN.AUDITOR_INVINCIBLE_MS;
    }

    // badge: enemies detect player 0.5s late
    if (this.ctx.player.items.includes('badge')) {
      enemy.detectionDelayMs = SPAWN.BADGE_DETECTION_DELAY_MS;
    }

    // RRHH "Política de Empresa": HR Reps se unen como aliados (no cuentan para el aura de lentitud).
    if (typeId === 'hr_rep' && ch.hrAllies) {
      enemy.ally = true;
      enemy.setFillStyle(0x44aa88);
    } else if (typeId === 'hr_rep') {
      this.hrAliveCount++;
    }

    this.ctx.bus.emit('enemy:spawned', { type: typeId });
  }

  update(time: number, delta: number): void {
    // Store player position in scene data for Enemy preUpdate
    this.scene.data.set('playerX', this.playerRef.x);
    this.scene.data.set('playerY', this.playerRef.y);

    // HR aura slow is applied in GameScene via the hrSlowActive getter.

    // Printer fan attack + ally AI
    this.enemyPool.getChildren().forEach(go => {
      const e = go as Enemy;
      if (!e.isActive2) return;

      // RRHH allies: chase nearest real enemy and damage it on contact.
      if (e.ally) {
        const target = this.getNearestEnemy(e.x, e.y, 99999);
        const body = e.body as Phaser.Physics.Arcade.Body;
        if (target) {
          const ang = Phaser.Math.Angle.Between(e.x, e.y, target.x, target.y);
          body.setVelocity(Math.cos(ang) * e.def.speed, Math.sin(ang) * e.def.speed);
          if (e.contactCooldown <= 0 && Phaser.Math.Distance.Between(e.x, e.y, target.x, target.y) < 28) {
            e.contactCooldown = COMBAT.CONTACT_DAMAGE_COOLDOWN_MS;
            target.takeDamage(CHAR.RRHH_ALLY_DAMAGE, 'hr_ally');
          }
        } else {
          body.setVelocity(0, 0);
        }
        return;
      }

      // Off-screen skip
      const dx = e.x - this.playerRef.x;
      const dy = e.y - this.playerRef.y;
      if (Math.abs(dx) > 600 || Math.abs(dy) > 600) return;

      if (e.enemyType === 'possessed_printer') {
        e.fanTimer += delta;
        if (e.fanTimer >= SPAWN.PRINTER_FAN_INTERVAL_MS) {
          e.fanTimer = 0;
          this.firePrinterFan(e, time);
        }
      } else if (e.enemyType === 'cleaning_lady') {
        // Carrito eléctrico de pulido: deja rastro de piso pulido (zona que daña) al moverse.
        e.polishTimer += delta;
        if (e.polishTimer >= SPAWN.POLISH_INTERVAL_MS) {
          e.polishTimer = 0;
          this.spawnZone(e.x, e.y, SPAWN.POLISH_RADIUS, SPAWN.POLISH_DPS, SPAWN.POLISH_DURATION_MS);
        }
      }

      // §E2 cable_trampa: stun nearby enemy if in radius and cooldown ready — nuevo (fase E2)
      if (this.ctx.player.items.includes('cable_trampa') && this.ctx.cableTrapCooldownMs <= 0) {
        const dist = Phaser.Math.Distance.Between(e.x, e.y, this.playerRef.x, this.playerRef.y);
        if (dist <= ITEMS_E2.CABLE_RADIUS) {
          e.applyEffect('stun', ITEMS_E2.CABLE_STUN_MS);
          this.ctx.cableTrapCooldownMs = ITEMS_E2.CABLE_COOLDOWN_MS;
        }
      }
    });

    // §E2 cable_trampa: tick cooldown — nuevo (fase E2)
    if (this.ctx.cableTrapCooldownMs > 0) {
      this.ctx.cableTrapCooldownMs -= delta;
    }

    // Damage zones DPS to player
    this.zonePool.getChildren().forEach(go => {
      const z = go as DamageZone;
      if (!z.active) return;
      const dist = Phaser.Math.Distance.Between(z.x, z.y, this.playerRef.x, this.playerRef.y);
      const radius = z.width / 2;
      if (dist < radius) {
        this.playerRef.takeDamage(z.dps * delta / 1000);
      }
    });
  }

  get hrSlowActive(): boolean {
    return this.hrAliveCount > 0 && !this.ctx.player.items.includes('ndas_firmadas');
  }

  private firePrinterFan(printer: Enemy, _time: number): void {
    for (let i = 0; i < SPAWN.PRINTER_FAN_COUNT; i++) {
      const angle = Phaser.Math.DegToRad(i * SPAWN.PRINTER_FAN_SPREAD_DEG);
      const p = this.enemyProjectilePool.get(printer.x, printer.y) as Projectile | null;
      if (!p) continue;
      p.fire(
        printer.x, printer.y,
        Math.cos(angle) * 150,
        Math.sin(angle) * 150,
        printer.def.damage,
        'possessed_printer',
        0, 0, 'none',
      );
      p.setFillStyle(0xff6600);
    }
  }

  getNearestEnemy(x: number, y: number, maxRange: number): Enemy | null {
    let nearest: Enemy | null = null;
    let bestDist = maxRange * maxRange;

    this.enemyPool.getChildren().forEach(go => {
      const e = go as Enemy;
      if (!e.isActive2 || e.ally) return;   // allies aren't valid targets
      const dx = e.x - x;
      const dy = e.y - y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        nearest = e;
      }
    });
    return nearest;
  }

  damageInRadius(cx: number, cy: number, radius: number, damage: number, sourceId: string): void {
    this.enemyPool.getChildren().forEach(go => {
      const e = go as Enemy;
      if (!e.isActive2) return;
      const dist = Phaser.Math.Distance.Between(cx, cy, e.x, e.y);
      if (dist <= radius) {
        e.takeDamage(damage, sourceId);
      }
    });
  }

  /**
   * Deal damage to all active enemies whose center is within (halfWidth) of the
   * line segment from (x1,y1) to (x2,y2). Used by debug_laser beam.
   */
  damageInLine(x1: number, y1: number, x2: number, y2: number, width: number, damage: number, sourceId: string, isCritical = false): void {
    const halfW = width / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    this.enemyPool.getChildren().forEach(go => {
      const e = go as Enemy;
      if (!e.isActive2) return;

      // Project enemy position onto the line segment
      const t = lenSq > 0
        ? Phaser.Math.Clamp(((e.x - x1) * dx + (e.y - y1) * dy) / lenSq, 0, 1)
        : 0;
      const closestX = x1 + t * dx;
      const closestY = y1 + t * dy;
      const dist = Phaser.Math.Distance.Between(e.x, e.y, closestX, closestY);
      if (dist <= halfW) {
        e.takeDamage(damage, sourceId, isCritical);
      }
    });
  }

  killAll(): void {
    this.enemyPool.getChildren().forEach(go => {
      const e = go as Enemy;
      if (e.isActive2) e.deactivate();
    });
  }

  private spawnZone(x: number, y: number, radius: number, dps: number, durationMs: number): void {
    const z = this.zonePool.get(x, y) as DamageZone | null;
    if (z) z.spawn(x, y, radius, dps, durationMs);
  }

  getActiveCount(): number {
    return this.enemyPool.getChildren().filter(g => (g as Enemy).isActive2).length;
  }

  /**
   * §E2 singularidad: pull all active enemies within radius toward (cx,cy) for one tick,
   * and deal dps × delta/1000 damage. Called from GameScene.update while singularidad active.
   * — nuevo (fase E2)
   */
  applySingularidadPull(cx: number, cy: number, delta: number): void {
    const dps = ITEMS_E2.SINGULARIDAD_DPS;
    const pull = ITEMS_E2.SINGULARIDAD_PULL_FORCE;
    const radius = ITEMS_E2.SINGULARIDAD_RADIUS;
    this.enemyPool.getChildren().forEach(go => {
      const e = go as Enemy;
      if (!e.isActive2) return;
      const dist = Phaser.Math.Distance.Between(cx, cy, e.x, e.y);
      if (dist <= radius && dist > 1) {
        // Pull: move enemy toward center
        const angle = Phaser.Math.Angle.Between(e.x, e.y, cx, cy);
        const step = pull * delta / 1000;
        e.setPosition(e.x + Math.cos(angle) * step, e.y + Math.sin(angle) * step);
        // Damage DPS
        e.takeDamage(dps * delta / 1000, 'singularidad');
      }
    });
  }
}
