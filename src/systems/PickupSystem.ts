import Phaser from 'phaser';
import { PICKUPS, MAP, ITEMS_E1, COMBAT } from '@/config/game.config';
import { ITEMS } from '@/config/items.config';
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
  private onItemPick: (() => string | null) | null = null;  // pre-roll del ítem al soltar el cofre
  private onItemDrop: ((id: string | null) => void) | null = null;  // otorgar el ítem (id pre-elegido) al recoger
  private onUpgradeDrop: (() => void) | null = null;

  constructor(scene: Phaser.Scene, ctx: RunContext, player: Player) {
    this.scene = scene;
    this.ctx = ctx;
    this.player = player;
  }

  /** Called by GameScene to wire up item/upgrade drop callbacks. */
  setDropCallbacks(
    onItemPick: () => string | null,
    onItemDrop: (id: string | null) => void,
    onUpgradeDrop: () => void,
  ): void {
    this.onItemPick = onItemPick;
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

    // §E1 iman_de_monedas: move moneda pickups toward the player — nuevo (fase E1)
    if (this.ctx.player.items.includes('iman_de_monedas')) {
      const px = this.player.x;
      const py = this.player.y;
      this.pickupPool.getChildren().forEach(go => {
        const pickup = go as import('@/entities/Pickup').Pickup;
        if (!pickup.active || pickup.kind !== 'moneda') return;
        const dist = Phaser.Math.Distance.Between(pickup.x, pickup.y, px, py);
        if (dist <= 0 || dist > ITEMS_E1.IMAN_ATTRACT_RANGE) return;
        const step = Math.min(dist, ITEMS_E1.IMAN_ATTRACT_SPEED * dtS);
        const angle = Phaser.Math.Angle.Between(pickup.x, pickup.y, px, py);
        const nx = pickup.x + Math.cos(angle) * step;
        const ny = pickup.y + Math.sin(angle) * step;
        pickup.setPosition(nx, ny);
        const body = pickup.body as Phaser.Physics.Arcade.StaticBody;
        body.reset(nx, ny);
      });
    }

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
      // §4 — no soltar cofre 'item' si el inventario pasivo está lleno (balance v2)
      const passiveCount = this.ctx.player.items.filter(id => {
        const def = ITEMS.find(i => i.id === id);
        return def !== undefined && def.category !== 'consumable';
      }).length;
      if (passiveCount >= COMBAT.MAX_PASSIVE_ITEMS) return;

      const p = this.pickupPool.get(x, y) as Pickup | null;
      // Pre-elegir el ítem para mostrar su icono real en el cofre del mapa.
      const itemId = this.onItemPick ? this.onItemPick() : null;
      if (p) p.spawn(x, y, 'item', itemId);
    }
  }

  /** Posición de spawn cerca del jugador, dentro del mapa (no en la esquina de pantalla). */
  private mapSpawnPos(): { x: number; y: number } {
    const m = PICKUPS.SPAWN_MARGIN;
    const spread = 360;
    const x = Phaser.Math.Clamp(this.player.x + Phaser.Math.Between(-spread, spread), m, MAP.WIDTH - m);
    const y = Phaser.Math.Clamp(this.player.y + Phaser.Math.Between(-spread, spread), m, MAP.HEIGHT - m);
    return { x, y };
  }

  private spawnPickup(kind: PickupKind): void {
    const { x, y } = this.mapSpawnPos();
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
        // §E1 taza_grande: café stress reduction ×1.5 — nuevo (fase E1)
        const cafeMult = this.ctx.player.items.includes('taza_grande') ? ITEMS_E1.TAZA_GRANDE_CAFE_MULT : 1;
        this.ctx.player.stress = Math.max(0, this.ctx.player.stress - PICKUPS.CAFE_STRESS * cafeMult);
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
        // §7.4 — otorga el ítem pre-elegido (el que mostraba su icono); si no hubo, elige al recoger.
        const grantedId = pickup.itemId;
        pickup.deactivate();
        this.ctx.bus.emit('pickup:collected', { kind: 'item', coins: 0 });
        if (this.onItemDrop) this.onItemDrop(grantedId);
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
