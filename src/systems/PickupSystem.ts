import Phaser from 'phaser';
import { PICKUPS, GAME } from '@/config/game.config';
import type { RunContext } from './RunContext';
import { Pickup } from '@/entities/Pickup';
import type { PickupKind } from '@/entities/Pickup';
import type { Player } from '@/entities/Player';

/**
 * Manages map-consumable pickups (café, galleta, moneda, stress, item, upgrade).
 * Pickups spawn on timed intervals; player overlap collects them.
 * §7.4: enemy deaths can drop 'item' or 'upgrade' pickups.
 */
export class PickupSystem {
  private scene: Phaser.Scene;
  private ctx: RunContext;
  private player: Player;
  pickupPool!: Phaser.GameObjects.Group;

  private cafeTimer = 0;
  private galletaTimer = 0;
  private monedaTimer = 0;

  // Callbacks injected by GameScene for item/upgrade pickups
  private onItemDrop: (() => void) | null = null;
  private onUpgradeDrop: (() => void) | null = null;

  constructor(scene: Phaser.Scene, ctx: RunContext, player: Player) {
    this.scene = scene;
    this.ctx = ctx;
    this.player = player;
  }

  /** Called by GameScene to wire up item/upgrade drop callbacks. */
  setDropCallbacks(
    onItemDrop: () => void,
    onUpgradeDrop: () => void,
  ): void {
    this.onItemDrop = onItemDrop;
    this.onUpgradeDrop = onUpgradeDrop;
  }

  init(): void {
    this.pickupPool = this.scene.physics.add.staticGroup({
      classType: Pickup,
      maxSize: PICKUPS.POOL_SIZE,
      runChildUpdate: false,
    });

    // Player–pickup overlap
    this.scene.physics.add.overlap(
      this.player.body,
      this.pickupPool,
      (_playerGO, pickupGO) => {
        const pickup = pickupGO as Pickup;
        if (!pickup.active) return;
        this.collect(pickup);
      },
    );

    // §7.4 Listen for enemy deaths to drop item/upgrade pickups
    this.ctx.bus.on('enemy:killed', (p: { isElite: boolean; x: number; y: number }) => {
      this.tryEnemyDrop(p.x, p.y, p.isElite);
    });
  }

  update(delta: number): void {
    const dtS = delta / 1000;

    // Café interval (halved if cafeteria_vip owned)
    const cafeInterval = this.ctx.player.items.includes('cafeteria_vip')
      ? PICKUPS.CAFE_INTERVAL_S / 2
      : PICKUPS.CAFE_INTERVAL_S;

    this.cafeTimer += dtS;
    if (this.cafeTimer >= cafeInterval) {
      this.cafeTimer = 0;
      this.spawnPickup('cafe');
    }

    this.galletaTimer += dtS;
    if (this.galletaTimer >= PICKUPS.GALLETA_INTERVAL_S) {
      this.galletaTimer = 0;
      this.spawnPickup('galleta');
    }

    this.monedaTimer += dtS;
    if (this.monedaTimer >= PICKUPS.MONEDA_INTERVAL_S) {
      this.monedaTimer = 0;
      this.spawnPickup('moneda');
    }
  }

  /** Called by ItemReactions for reunion_cancelada: drop stress pickup at enemy death position. */
  spawnStressPickup(x: number, y: number): void {
    const p = this.pickupPool.get(x, y) as Pickup | null;
    if (!p) return;
    p.spawn(x, y, 'stress');
  }

  /** free_coffee wave event: spawn N café pickups at random map positions. */
  spawnCafes(count: number): void {
    for (let i = 0; i < count; i++) this.spawnPickup('cafe');
  }

  /** §7.4 — Chance to spawn an item or upgrade pickup on enemy death. */
  private tryEnemyDrop(x: number, y: number, isElite: boolean): void {
    const mult = isElite ? PICKUPS.ITEM_DROP_ELITE_MULT : 1;
    const r = Math.random();
    if (r < PICKUPS.UPGRADE_DROP_CHANCE * mult) {
      const p = this.pickupPool.get(x, y) as Pickup | null;
      if (p) p.spawn(x, y, 'upgrade');
    } else if (r < (PICKUPS.UPGRADE_DROP_CHANCE + PICKUPS.ITEM_DROP_CHANCE) * mult) {
      const p = this.pickupPool.get(x, y) as Pickup | null;
      if (p) p.spawn(x, y, 'item');
    }
  }

  private spawnPickup(kind: PickupKind): void {
    const m = PICKUPS.SPAWN_MARGIN;
    const x = Phaser.Math.Between(m, GAME.WIDTH - m);
    const y = Phaser.Math.Between(m, GAME.HEIGHT - m);
    const p = this.pickupPool.get(x, y) as Pickup | null;
    if (!p) return;
    p.spawn(x, y, kind);
  }

  private collect(pickup: Pickup): void {
    // Director "ignora físicamente" el café: no lo recoge (lo deja en el mapa).
    if (pickup.kind === 'cafe' && this.ctx.character.ignoresCafe) return;

    let coins = 0;
    switch (pickup.kind) {
      case 'cafe': {
        this.ctx.player.stress = Math.max(0, this.ctx.player.stress - PICKUPS.CAFE_STRESS);
        // cafeteria_vip: café also heals +CAFE_VIP_BONUS_HP
        if (this.ctx.player.items.includes('cafeteria_vip')) {
          this.ctx.player.hp = Math.min(this.ctx.player.maxHp, this.ctx.player.hp + PICKUPS.CAFE_VIP_BONUS_HP);
        }
        this.ctx.bus.emit('stress:changed', { value: this.ctx.player.stress });
        break;
      }
      case 'galleta': {
        this.ctx.player.hp = Math.min(this.ctx.player.maxHp, this.ctx.player.hp + PICKUPS.GALLETA_HP);
        break;
      }
      case 'moneda': {
        coins = Math.floor(PICKUPS.MONEDA_COINS * this.ctx.modifiers.coinMult);
        this.ctx.player.coins += coins;
        this.ctx.stats.coinsEarned += coins;
        break;
      }
      case 'stress': {
        this.ctx.player.stress = Math.max(0, this.ctx.player.stress - PICKUPS.STRESS_PICKUP_DECREASE);
        this.ctx.bus.emit('stress:changed', { value: this.ctx.player.stress });
        break;
      }
      case 'item': {
        // §7.4 — grants a random eligible item (like the shop, free)
        pickup.deactivate();
        this.ctx.bus.emit('pickup:collected', { kind: 'item', coins: 0 });
        if (this.onItemDrop) this.onItemDrop();
        return;
      }
      case 'upgrade': {
        // §7.4 — opens a player-upgrade choice
        pickup.deactivate();
        this.ctx.bus.emit('pickup:collected', { kind: 'upgrade', coins: 0 });
        if (this.onUpgradeDrop) this.onUpgradeDrop();
        return;
      }
    }
    pickup.deactivate();
    // Single emit per pickup — stock_options reads coins, audio/particles read kind.
    this.ctx.bus.emit('pickup:collected', { kind: pickup.kind, coins });
  }
}
