import Phaser from 'phaser';
import { GAME, MAP } from '@/config/game.config';
import { EFFECTS } from '@/config/effects.config';
import type { RunContext } from './RunContext';
import { recomputeModifiers } from './RunContext';
import type { Player } from '@/entities/Player';
import type { EnemySystem } from './EnemySystem';
import type { WeaponSystem } from './WeaponSystem';
import type { PickupSystem } from './PickupSystem';
import type { UpgradePool } from './UpgradePool';
import { applyItemPickup } from './ItemReactions';
import type { ItemDefinition } from '@/types';

/**
 * Interactive map (Mejora 2): static obstacles (desks/cabinets/plants) with physics colliders,
 * a coffee machine that spawns café pickups, a vending machine (auto-buy on approach), and
 * destructible wall extinguishers that relieve stress.
 */
export class MapSystem {
  private scene: Phaser.Scene;
  private ctx: RunContext;
  private player: Player;
  private enemySys: EnemySystem;
  private weaponSys: WeaponSystem;
  private pickupSys: PickupSystem;
  private upgradePool: UpgradePool;

  private vending!: Phaser.GameObjects.Rectangle;
  private coffeeTimer = 0;
  private vendingCooldown = 0;

  constructor(
    scene: Phaser.Scene, ctx: RunContext, player: Player,
    enemySys: EnemySystem, weaponSys: WeaponSystem, pickupSys: PickupSystem, upgradePool: UpgradePool,
  ) {
    this.scene = scene;
    this.ctx = ctx;
    this.player = player;
    this.enemySys = enemySys;
    this.weaponSys = weaponSys;
    this.pickupSys = pickupSys;
    this.upgradePool = upgradePool;
  }

  init(): void {
    const solid = this.scene.physics.add.staticGroup();   // blocks player AND enemies
    const plants = this.scene.physics.add.staticGroup();  // blocks enemies only
    const extintores = this.scene.physics.add.staticGroup();

    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    // Random obstacles (avoid the center spawn zone).
    const count = Phaser.Math.Between(MAP.OBSTACLE_COUNT_MIN, MAP.OBSTACLE_COUNT_MAX);
    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      const spec = roll < 0.45 ? MAP.DESK : roll < 0.8 ? MAP.CABINET : MAP.PLANT;
      let x = 0, y = 0, tries = 0;
      do {
        x = Phaser.Math.Between(60, GAME.WIDTH - 60);
        y = Phaser.Math.Between(60, GAME.HEIGHT - 60);
        tries++;
      } while (Phaser.Math.Distance.Between(x, y, cx, cy) < MAP.CENTER_EXCLUSION && tries < 10);

      const key = spec === MAP.DESK ? 'desk' : spec === MAP.CABINET ? 'cabinet' : 'plant';
      const rect = this.scene.add.rectangle(x, y, spec.w, spec.h, spec.color).setDepth(1);
      this.addProp(key, x, y, rect);
      (spec === MAP.PLANT ? plants : solid).add(rect);
    }

    // Functional objects
    const coffee = this.scene.add.rectangle(cx, 70, MAP.FUNC_SIZE, MAP.FUNC_SIZE, MAP.COFFEE_COLOR).setDepth(1);
    if (!this.addProp('coffee', cx, 70, coffee)) {
      this.scene.add.text(cx, 70, '☕', { fontSize: '20px' }).setOrigin(0.5).setDepth(2);
    }
    this.addSteam(cx, 70 - 22);   // vaho en bucle sobre la cafetera

    this.vending = this.scene.add.rectangle(cx, GAME.HEIGHT - 70, MAP.FUNC_SIZE, MAP.FUNC_SIZE, MAP.VENDING_COLOR).setDepth(1);
    if (!this.addProp('vending', cx, GAME.HEIGHT - 70, this.vending)) {
      this.scene.add.text(cx, GAME.HEIGHT - 70, '🥤', { fontSize: '20px' }).setOrigin(0.5).setDepth(2);
    }
    solid.add(this.vending); // staticGroup.add creates the static body

    // Wall extinguishers in the corners (destructible).
    const corners = [[60, 60], [GAME.WIDTH - 60, 60], [60, GAME.HEIGHT - 60], [GAME.WIDTH - 60, GAME.HEIGHT - 60]];
    for (const [ex, ey] of corners) {
      const e = this.scene.add.rectangle(ex, ey, 24, 24, MAP.EXTINTOR_COLOR)
        .setStrokeStyle(2, MAP.EXTINTOR_BORDER).setDepth(1);
      const img = this.addProp('extintor', ex, ey, e);
      if (img) e.setData('img', img);   // para destruir el sprite al romper el extintor
      extintores.add(e);
    }

    // Colliders: player + enemies blocked by solid; enemies also blocked by plants & extintores.
    this.scene.physics.add.collider(this.player.body, solid);
    this.scene.physics.add.collider(this.enemySys.enemyPool, solid);
    this.scene.physics.add.collider(this.enemySys.enemyPool, plants);
    this.scene.physics.add.collider(this.player.body, extintores);
    this.scene.physics.add.collider(this.enemySys.enemyPool, extintores);

    // Projectiles destroy extinguishers → relieve stress.
    this.scene.physics.add.overlap(this.weaponSys.projectilePool, extintores, (_proj, extGO) => {
      const ext = extGO as Phaser.GameObjects.Rectangle;
      if (!ext.active) return;
      const img = ext.getData('img') as Phaser.GameObjects.Image | undefined;
      if (img) img.destroy();
      ext.destroy(); // removes from static group + physics
      this.ctx.player.stress = Math.max(0, this.ctx.player.stress - MAP.EXTINTOR_STRESS);
      this.ctx.bus.emit('stress:changed', { value: this.ctx.player.stress });
    });
  }

  /**
   * Reemplaza el visual de un collider por el sprite del prop (oculta el rect, devuelve la imagen).
   * Escala al alto MAP.SPRITE_H[key] conservando aspecto. Devuelve null si no hay textura.
   */
  private addProp(key: keyof typeof MAP.SPRITE_H, x: number, y: number,
    rect: Phaser.GameObjects.Rectangle): Phaser.GameObjects.Image | null {
    const tex = `map_${key}`;
    if (!this.scene.textures.exists(tex)) return null;
    rect.setVisible(false);
    const src = this.scene.textures.get(tex).getSourceImage();
    const scale = MAP.SPRITE_H[key] / src.height;
    return this.scene.add.image(x, y, tex).setScale(scale).setDepth(0);
  }

  /** Vaho de café animado en bucle (origen abajo-centro para que suba desde la cafetera). */
  private addSteam(x: number, y: number): void {
    const key = 'fx_steam';
    if (!this.scene.textures.exists(key) || !this.scene.anims.exists(key)) return;
    const fx = EFFECTS.steam;
    const scale = fx.display / Math.max(fx.frameW, fx.frameH);
    const s = this.scene.add.sprite(x, y, key, 0).setOrigin(0.5, 1).setScale(scale).setDepth(1).setAlpha(0.8);
    s.play(key);
  }

  update(delta: number): void {
    const dtS = delta / 1000;

    // Coffee machine: spawn a café pickup periodically.
    this.coffeeTimer += dtS;
    if (this.coffeeTimer >= MAP.COFFEE_MACHINE_INTERVAL_S) {
      this.coffeeTimer = 0;
      this.pickupSys.spawnCafes(1);
    }

    // Vending machine: auto-buy a random item when the player is close and can afford it.
    if (this.vendingCooldown > 0) this.vendingCooldown -= dtS;
    const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, this.vending.x, this.vending.y);
    if (dist < MAP.VENDING_RANGE && this.vendingCooldown <= 0 && this.ctx.player.coins >= MAP.VENDING_COST) {
      this.buyFromVending();
    }
  }

  private buyFromVending(): void {
    const picks = this.upgradePool.pick(
      this.ctx.player, this.ctx.modifiers, 1, this.ctx.weaponLevels,
      false, this.ctx.character.noEpicLegendaryWeapons ?? false, this.ctx.curseForbidCommon,
    );
    if (picks.length === 0) return;

    this.ctx.player.coins -= MAP.VENDING_COST;
    this.vendingCooldown = MAP.VENDING_COOLDOWN_S;

    const pick = picks[0];
    if (!('category' in pick)) {
      this.ctx.bus.emit('upgrade:weapon_selected', { id: pick.id });
    } else {
      applyItemPickup(this.ctx, pick as ItemDefinition);
      recomputeModifiers(this.ctx);
      this.ctx.bus.emit('upgrade:item_selected', { id: pick.id });
    }
  }
}
