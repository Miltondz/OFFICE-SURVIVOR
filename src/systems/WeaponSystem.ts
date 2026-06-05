import Phaser from 'phaser';
import { COMBAT, SPAWN, COLORS_GAME, WAVE_EVENTS, CURSES, ITEMS_E1 } from '@/config/game.config';
import type { RunContext } from './RunContext';
import type { WeaponDefinition } from '@/types';
import { Projectile } from '@/entities/Projectile';
import type { ProjectileEffect } from '@/entities/Projectile';
import type { EnemySystem } from './EnemySystem';
import { getWeaponById } from '@/config/items.config';
import { PrinterTurret } from '@/entities/PrinterTurret';
import { CHAR } from '@/config/characters.config';

export interface WeaponInstance {
  definitionId: string;
  level: number;
  lastFiredAt: number;
  damageMult: number;     // per-weapon multiplicative bonus (default 1)
  fireRateMult: number;   // per-weapon firerate bonus (default 1)
}

export class WeaponSystem {
  private scene: Phaser.Scene;
  private ctx: RunContext;
  private enemySys!: EnemySystem;
  private zonePool!: Phaser.GameObjects.Group;

  weapons: WeaponInstance[] = [];
  projectilePool!: Phaser.GameObjects.Group;

  // Objetivo de jefe/miniboss (no están en enemyPool): proveído por GameScene.
  private bossTargetProvider: (() => { x: number; y: number } | null) | null = null;

  // Pooled turret group for impresora_aliada (PrinterTurret entity)
  turretPool!: Phaser.GameObjects.Group;

  private extinctorCharge = 0;       // ms until next use (recharge)

  // Laser beam visual (reused each tick)
  private laserBeam: Phaser.GameObjects.Rectangle | null = null;
  private laserFlashTimer = 0;

  constructor(scene: Phaser.Scene, ctx: RunContext) {
    this.scene = scene;
    this.ctx = ctx;
  }

  /** GameScene inyecta un getter de la posición del jefe/miniboss activo (o null). */
  setBossTargetProvider(fn: () => { x: number; y: number } | null): void {
    this.bossTargetProvider = fn;
  }

  init(enemySys: EnemySystem, zonePool: Phaser.GameObjects.Group): void {
    this.enemySys = enemySys;
    this.zonePool = zonePool;

    this.projectilePool = this.scene.physics.add.group({
      classType: Projectile,
      maxSize: COMBAT.PROJECTILE_POOL_SIZE,
      runChildUpdate: true,
    });

    // Turret pool — uses PrinterTurret entity
    this.turretPool = this.scene.physics.add.group({
      classType: PrinterTurret,
      maxSize: COMBAT.WEAPON_MAX_LEVEL,
      runChildUpdate: false,
    });
  }

  addOrLevel(id: string): void {
    const existing = this.weapons.find(w => w.definitionId === id);
    if (existing) {
      if (existing.level < COMBAT.WEAPON_MAX_LEVEL) existing.level++;
    } else if (this.weapons.length < this.ctx.modifiers.maxWeapons) {
      this.weapons.push({ definitionId: id, level: 1, lastFiredAt: 0, damageMult: 1, fireRateMult: 1 });
    }
    this.ctx.player.weapons = this.weapons.map(w => w.definitionId);
    this.ctx.weaponLevels = Object.fromEntries(this.weapons.map(w => [w.definitionId, w.level]));
    this.recomputeWeaponMods();
  }

  /** Reset per-weapon mods and re-apply item-driven bonuses. Call after every item pickup and on level-up. */
  recomputeWeaponMods(): void {
    for (const inst of this.weapons) {
      inst.damageMult = 1;
      inst.fireRateMult = 1;
    }

    // grapas_extra: +30% cadence on stapler_gun
    if (this.ctx.player.items.includes('grapas_extra')) {
      const staplerInst = this.weapons.find(w => w.definitionId === 'stapler_gun');
      if (staplerInst) staplerInst.fireRateMult *= 1.30;
    }

    // Freelancer "Sin Jefe": with 2 weapons equipped, both gain +25% firerate.
    if (this.ctx.character.sinJefe && this.weapons.length >= 2) {
      for (const inst of this.weapons) inst.fireRateMult *= CHAR.SIN_JEFE_FIRERATE;
    }

    // pivot: at level 10 — all weapons +50% damage and firerate
    if (this.ctx.player.items.includes('pivot') && this.ctx.player.level >= 10) {
      for (const inst of this.weapons) {
        inst.damageMult *= 1.5;
        inst.fireRateMult *= 1.5;
      }
    }

    // benchmark: top-damage weapon +40% (uses snapshot benchmarkWeaponId)
    if (this.ctx.player.items.includes('benchmark')) {
      const targetId = this.ctx.benchmarkWeaponId ?? this.topDamageWeaponId();
      if (targetId) {
        const inst = this.weapons.find(w => w.definitionId === targetId);
        if (inst) inst.damageMult *= 1.4;
      }
    }

    // Curse exclusivity_contract: locked starting weapon gains +100% damage.
    if (this.ctx.curseLockedWeaponId) {
      const inst = this.weapons.find(w => w.definitionId === this.ctx.curseLockedWeaponId);
      if (inst) inst.damageMult *= CURSES.EXCLUSIVITY_DAMAGE_MULT;
    }
  }

  /** Returns the weapon id with the highest accumulated damage dealt. Falls back to first weapon. */
  topDamageWeaponId(): string | null {
    if (this.weapons.length === 0) return null;
    let topId = this.weapons[0].definitionId;
    let topDmg = this.ctx.damageByWeapon[topId] ?? 0;
    for (const inst of this.weapons) {
      const dmg = this.ctx.damageByWeapon[inst.definitionId] ?? 0;
      if (dmg > topDmg) {
        topDmg = dmg;
        topId = inst.definitionId;
      }
    }
    return topId;
  }

  update(time: number, delta: number, px: number, py: number): void {
    // Extintor recharge
    if (this.extinctorCharge > 0) this.extinctorCharge -= delta;

    // Laser flash timer (hide beam after LASER_FLASH_MS)
    if (this.laserFlashTimer > 0) {
      this.laserFlashTimer -= delta;
      if (this.laserFlashTimer <= 0 && this.laserBeam) {
        this.laserBeam.setVisible(false);
      }
    }

    for (const inst of this.weapons) {
      const def = getWeaponById(inst.definitionId);
      if (!def) continue;

      const range = def.range * this.ctx.modifiers.rangeMult;
      let target: { x: number; y: number } | null = this.enemySys.getNearestEnemy(px, py, range);
      // Sin enemigos normales: apuntar al jefe/miniboss si está en rango.
      if (!target && this.bossTargetProvider) {
        const bt = this.bossTargetProvider();
        if (bt && Phaser.Math.Distance.Between(px, py, bt.x, bt.y) <= range) target = bt;
      }

      // §E1 ultimo_cartucho: ≤20% HP → cadencia ×3 — nuevo (fase E1)
      const ultimoMult = (this.ctx.player.items.includes('ultimo_cartucho')
        && this.ctx.player.hp / this.ctx.player.maxHp <= ITEMS_E1.ULTIMO_HP_THRESHOLD)
        ? ITEMS_E1.ULTIMO_FIRERATE_MULT : 1;
      const fireRate = def.fireRate
        * (1 + (inst.level - 1) * COMBAT.WEAPON_LEVEL_FIRERATE_STEP)
        * inst.fireRateMult
        * this.ctx.modifiers.fireRateMult  // §7.2 stat_firerate upgrade
        * ultimoMult;
      const cooldown = 1000 / fireRate;

      if (time - inst.lastFiredAt < cooldown) continue;
      if (!target && def.id !== 'extintor' && def.id !== 'impresora_aliada') continue;

      // printer_jam wave event: chance to jam this weapon briefly.
      if (this.ctx.weaponJamChance > 0 && Math.random() < this.ctx.weaponJamChance) {
        inst.lastFiredAt = time + WAVE_EVENTS.PRINTER_JAM_DURATION_MS;
        continue;
      }

      inst.lastFiredAt = time;
      this.fireWeapon(def, inst, px, py, target, time);
    }

    // Update turrets
    this.turretPool.getChildren().forEach(go => {
      const t = go as PrinterTurret;
      if (!t.active) return;
      // Follow player at 80px
      const dist = Phaser.Math.Distance.Between(t.x, t.y, px, py);
      if (dist > 80) {
        const angle = Phaser.Math.Angle.Between(t.x, t.y, px, py);
        t.setPosition(
          t.x + Math.cos(angle) * Math.min(dist - 80, 120 * delta / 1000),
          t.y + Math.sin(angle) * Math.min(dist - 80, 120 * delta / 1000),
        );
      }
      // Fire at nearest enemy
      const tgt = this.enemySys.getNearestEnemy(t.x, t.y, 250);
      if (tgt && time - t.lastFiredAt >= 500) {
        t.lastFiredAt = time;
        const a = Phaser.Math.Angle.Between(t.x, t.y, tgt.x, tgt.y);
        this.spawnProjectile(
          t.x, t.y,
          Math.cos(a) * COMBAT.PROJECTILE_DEFAULT_SPEED,
          Math.sin(a) * COMBAT.PROJECTILE_DEFAULT_SPEED,
          10, 'impresora_aliada', 0, this.ctx.modifiers.bounce, 'none',
        );
      }
    });
  }

  private fireWeapon(
    def: WeaponDefinition,
    inst: WeaponInstance,
    px: number, py: number,
    target: { x: number; y: number } | null,
    time: number,
  ): void {
    const { dmg, isCrit } = this.getDamageWithCrit(def, inst);
    const projCount = def.projectileCount + this.ctx.modifiers.projectileBonus;
    const speed = COMBAT.PROJECTILE_DEFAULT_SPEED * this.ctx.modifiers.projectileSpeedMult;
    const pierce = this.ctx.modifiers.pierce ? 99 : 0;
    const bounce = this.ctx.modifiers.bounce;

    if (!target && def.id !== 'extintor') return;

    const tx = target ? target.x : px;
    const ty = target ? target.y : py;
    const baseAngle = Phaser.Math.Angle.Between(px, py, tx, ty);

    switch (def.id) {
      case 'coffee_thrower': {
        for (let i = 0; i < projCount; i++) {
          const a = baseAngle + Phaser.Math.DegToRad((i - (projCount - 1) / 2) * 10);
          this.spawnProjectile(px, py, Math.cos(a) * speed, Math.sin(a) * speed, dmg, def.id, pierce, bounce, 'slow', COMBAT.PROJECTILE_LIFESPAN_MS, isCrit);
        }
        break;
      }
      case 'stapler_gun': {
        // §E1 grapadora_turbo: burst of 3 instead of 1 — nuevo (fase E1)
        const staplerCount = this.ctx.player.items.includes('grapadora_turbo') ? 3 : projCount;
        for (let i = 0; i < staplerCount; i++) {
          const a = baseAngle + Phaser.Math.DegToRad((i - (staplerCount - 1) / 2) * 5);
          this.spawnProjectile(px, py, Math.cos(a) * speed * 1.5, Math.sin(a) * speed * 1.5, dmg, def.id, pierce, bounce, 'none', COMBAT.PROJECTILE_LIFESPAN_MS, isCrit);
        }
        break;
      }
      case 'debug_laser': {
        // True continuous beam: draw a line, damage all enemies in line
        const range = def.range * this.ctx.modifiers.rangeMult;
        for (let i = 0; i < projCount; i++) {
          const a = baseAngle + Phaser.Math.DegToRad((i - (projCount - 1) / 2) * 3);
          const x2 = px + Math.cos(a) * range;
          const y2 = py + Math.sin(a) * range;

          // debug_mode: always crit (×CRIT_MULTIPLIER)
          const laserIsCrit = this.ctx.player.items.includes('debug_mode');
          const beamDmg = laserIsCrit ? dmg * COMBAT.CRIT_MULTIPLIER : dmg;

          // Deal damage to all enemies along the beam line
          this.enemySys.damageInLine(px, py, x2, y2, COMBAT.LASER_WIDTH, beamDmg, def.id, laserIsCrit);

          // Beam visual: thin cyan rectangle along the beam direction
          this.drawLaserBeam(px, py, x2, y2);
        }
        break;
      }
      case 'postit_launcher': {
        const angles = [-15, 0, 15].map(d => baseAngle + Phaser.Math.DegToRad(d));
        for (let i = 0; i < projCount; i++) {
          const a = angles[i % 3] + Phaser.Math.DegToRad((i - (projCount - 1) / 2) * 5);
          this.spawnProjectile(px, py, Math.cos(a) * speed, Math.sin(a) * speed, dmg, def.id, pierce, bounce, 'none', COMBAT.PROJECTILE_LIFESPAN_MS, isCrit);
        }
        break;
      }
      case 'powerpoint_cannon': {
        const stunDur = this.ctx.player.items.includes('powerpoint_feo') ? 3000 : 1500;
        for (let i = 0; i < projCount; i++) {
          const a = baseAngle + Phaser.Math.DegToRad((i - (projCount - 1) / 2) * 8);
          const p = this.spawnProjectile(px, py, Math.cos(a) * 120, Math.sin(a) * 120, dmg, def.id, pierce, bounce, 'stun', COMBAT.PROJECTILE_LIFESPAN_MS, isCrit);
          if (p) { p.stunDur = stunDur; p.setFillStyle(0xff8800); }
        }
        break;
      }
      case 'whiteboard_marker': {
        for (let i = 0; i < projCount; i++) {
          const a = baseAngle + Phaser.Math.DegToRad((i - (projCount - 1) / 2) * 5);
          this.spawnProjectile(px, py, Math.cos(a) * speed * 0.7, Math.sin(a) * speed * 0.7, dmg, def.id, pierce, bounce, 'zoneOnHit', 400, isCrit);
        }
        break;
      }
      case 'teclado_mecanico': {
        for (let i = 0; i < projCount; i++) {
          const a = baseAngle + Phaser.Math.DegToRad((i - (projCount - 1) / 2) * 6);
          this.spawnProjectile(px, py, Math.cos(a) * speed * 0.8, Math.sin(a) * speed * 0.8, dmg, def.id, pierce, bounce, 'knockback', 500, isCrit);
        }
        break;
      }
      case 'botella_termica': {
        for (let i = 0; i < projCount; i++) {
          const a = baseAngle + Phaser.Math.DegToRad((i - (projCount - 1) / 2) * 6);
          const p = this.spawnProjectile(px, py, Math.cos(a) * speed, Math.sin(a) * speed, dmg, def.id, 0, 0, 'aoe', COMBAT.PROJECTILE_LIFESPAN_MS, isCrit);
          if (p) { p.setFillStyle(0x8844ff); }
        }
        break;
      }
      case 'extintor': {
        if (this.extinctorCharge > 0) break;
        this.extinctorCharge = 5000; // 5s recharge
        for (let i = 0; i < 5; i++) {
          const a = baseAngle + Phaser.Math.DegToRad(-45 + i * 22.5);
          const p = this.spawnProjectile(px, py, Math.cos(a) * speed * 0.7, Math.sin(a) * speed * 0.7, dmg, def.id, 99, 0, 'freeze', 600, isCrit);
          if (p) { p.setFillStyle(0xaaddff); }
        }
        break;
      }
      case 'impresora_aliada': {
        // Turrets = weapon level (1–3). Spawn missing turrets up to that count.
        const activeTurrets = this.turretPool.getChildren().filter(g => g.active).length;
        const weaponInst = this.weapons.find(w => w.definitionId === 'impresora_aliada');
        const targetCount = weaponInst ? weaponInst.level : 1;
        if (activeTurrets < targetCount) {
          const t = this.turretPool.get(px + 80, py) as PrinterTurret | null;
          if (t) t.spawn(px + 80, py, time);
        }
        void time;
        break;
      }
    }

    // §E1 doble_disparo: 25% chance to fire 1 extra projectile at same angle — nuevo (fase E1)
    // Applies to projectile weapons only (skip laser, extintor, impresora_aliada, whiteboard_marker zone)
    if (this.ctx.player.items.includes('doble_disparo')
      && def.id !== 'debug_laser' && def.id !== 'extintor' && def.id !== 'impresora_aliada'
      && Math.random() < ITEMS_E1.DOBLE_DISPARO_CHANCE) {
      const speed2 = COMBAT.PROJECTILE_DEFAULT_SPEED * this.ctx.modifiers.projectileSpeedMult;
      const { dmg: dmg2, isCrit: isCrit2 } = this.getDamageWithCrit(def, inst);
      this.spawnProjectile(
        px, py,
        Math.cos(baseAngle) * speed2,
        Math.sin(baseAngle) * speed2,
        dmg2, def.id,
        this.ctx.modifiers.pierce ? 99 : 0,
        this.ctx.modifiers.bounce,
        'none', COMBAT.PROJECTILE_LIFESPAN_MS, isCrit2,
      );
    }
  }

  /** Draw a thin beam rectangle from (x1,y1) to (x2,y2) for LASER_FLASH_MS ms. */
  private drawLaserBeam(x1: number, y1: number, x2: number, y2: number): void {
    const length = Phaser.Math.Distance.Between(x1, y1, x2, y2);
    const angle = Phaser.Math.Angle.Between(x1, y1, x2, y2);
    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;

    if (!this.laserBeam) {
      this.laserBeam = this.scene.add.rectangle(cx, cy, length, COMBAT.LASER_WIDTH, COLORS_GAME.LASER_BEAM, 0.7);
      this.laserBeam.setDepth(5);
    } else {
      this.laserBeam.setPosition(cx, cy).setSize(length, COMBAT.LASER_WIDTH);
    }
    this.laserBeam.setRotation(angle).setVisible(true);
    this.laserFlashTimer = COMBAT.LASER_FLASH_MS;
  }

  private spawnProjectile(
    x: number, y: number,
    vx: number, vy: number,
    damage: number,
    sourceId: string,
    pierceLeft: number,
    bounceLeft: number,
    effect: ProjectileEffect,
    lifespanMs: number = COMBAT.PROJECTILE_LIFESPAN_MS,
    isCrit = false,
  ): Projectile | null {
    const p = this.projectilePool.get(x, y) as Projectile | null;
    if (!p) return null;
    p.fire(x, y, vx, vy, damage, sourceId, pierceLeft, bounceLeft, effect, lifespanMs);
    p.isCrit = isCrit;
    return p;
  }

  /** Returns { dmg, isCrit } — isCrit exposed so projectile can carry it for damage numbers. */
  getDamageWithCrit(def: WeaponDefinition, inst: WeaponInstance): { dmg: number; isCrit: boolean } {
    const stress = this.getStressDmgMult();

    let dmg = def.baseDamage
      * (1 + (inst.level - 1) * COMBAT.WEAPON_LEVEL_DAMAGE_STEP)
      * this.ctx.player.damageMultiplier
      * stress
      * this.ctx.modifiers.damageMult
      * inst.damageMult
      * this.ctx.character.perWeaponDamageMult;   // Freelancer ×1.8

    // §E1 sello_de_goma: next projectile ×3 damage — nuevo (fase E1)
    if (this.ctx.sellaDeGomaReady && this.ctx.player.items.includes('sello_de_goma')) {
      dmg *= ITEMS_E1.SELLO_DAMAGE_MULT;
      this.ctx.sellaDeGomaReady = false;
    }

    // §E1 modo_dios_temporal: damage ×5 during god mode — nuevo (fase E1)
    if (this.ctx.modoDiosDamageBoost && this.ctx.player.items.includes('modo_dios_temporal')) {
      dmg *= ITEMS_E1.MODO_DIOS_DAMAGE_MULT;
    }

    // Crit. Director "Visión Estratégica": all damage crits while in Burnout (90–99).
    let isCrit = false;
    const burnoutCrit = this.ctx.character.critInBurnout
      && this.ctx.player.stress >= 90 && this.ctx.player.stress <= 99;
    // §7.2 critBonus adds flat % to base crit chance
    const effectiveCritChance = COMBAT.CRIT_CHANCE + (this.ctx.modifiers.critBonus ?? 0);
    if (def.id !== 'debug_laser' && (burnoutCrit || Math.random() < effectiveCritChance)) {
      dmg *= COMBAT.CRIT_MULTIPLIER;
      isCrit = true;
    }

    // Per-weapon damage attribution for benchmark
    this.ctx.damageByWeapon[def.id] = (this.ctx.damageByWeapon[def.id] ?? 0) + dmg;

    this.ctx.bus.emit('damage:dealt', { sourceId: def.id, amount: dmg });
    return { dmg, isCrit };
  }

  getDamage(def: WeaponDefinition, inst: WeaponInstance): number {
    return this.getDamageWithCrit(def, inst).dmg;
  }

  private getStressDmgMult(): number {
    const s = this.ctx.player.stress;
    if (s <= 30) return 0.9;
    if (s <= 69) return 1.0;
    if (s <= 89) return 1.2;
    if (s <= 99) return 1.4;
    return 1.0;
  }

  /** Called by EnemySystem when a projectile hits an enemy */
  onProjectileHit(
    proj: Projectile,
    ex: number, ey: number,
    enemyRef: { applyEffect: (e: string, d: number) => void },
  ): void {
    if (proj.effectTag === 'slow') {
      enemyRef.applyEffect('slow', 1000 + (this.ctx.player.items.includes('termo') ? 1000 : 0));
    } else if (proj.effectTag === 'stun') {
      enemyRef.applyEffect('stun', proj.stunDur !== 0 ? proj.stunDur : 1500);
    } else if (proj.effectTag === 'zoneOnHit') {
      this.spawnZone(ex, ey, 30, SPAWN.TOXIC_ZONE_DPS, SPAWN.TOXIC_ZONE_DURATION_MS);
    } else if (proj.effectTag === 'aoe') {
      this.enemySys.damageInRadius(ex, ey, 60, proj.damage * 0.5, proj.sourceId);
    } else if (proj.effectTag === 'knockback') {
      // Knockback applied externally by EnemySystem
    } else if (proj.effectTag === 'freeze') {
      enemyRef.applyEffect('freeze', 2000);
    }
  }

  spawnZone(x: number, y: number, radius: number, dps: number, durationMs: number): void {
    const z = this.zonePool.get(x, y) as import('@/entities/DamageZone').DamageZone | null;
    if (z) z.spawn(x, y, radius, dps, durationMs);
  }
}
