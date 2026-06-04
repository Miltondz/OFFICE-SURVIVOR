import Phaser from 'phaser';
import { PICKUPS, GAME } from '@/config/game.config';
import type { RunContext } from './RunContext';
import { Pickup } from '@/entities/Pickup';
import type { PickupKind } from '@/entities/Pickup';
import type { Player } from '@/entities/Player';

/**
 * Manages map-consumable pickups (café, galleta, moneda, stress).
 * Pickups spawn on timed intervals; player overlap collects them.
 */
export class PickupSystem {
  private scene: Phaser.Scene;
  private ctx: RunContext;
  private player: Player;
  pickupPool!: Phaser.GameObjects.Group;

  private cafeTimer = 0;
  private galletaTimer = 0;
  private monedaTimer = 0;

  constructor(scene: Phaser.Scene, ctx: RunContext, player: Player) {
    this.scene = scene;
    this.ctx = ctx;
    this.player = player;
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
    }
    pickup.deactivate();
    // Single emit per pickup — stock_options reads coins, audio/particles read kind.
    this.ctx.bus.emit('pickup:collected', { kind: pickup.kind, coins });
  }
}
