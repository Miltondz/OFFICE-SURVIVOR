// src/scenes/ShopOverlay.ts
// §7.3 — Shop opened during intermission. Offers weapons + passive items for coins.
// Buttons: COMPRAR / REROLL (15 coins) / SIGUIENTE OLEADA.
// Respects modifiers.maxWeapons and rarity gates (RARITY_RULES).

import Phaser from 'phaser';
import { SCENES, GAME, SHOP, RARITY_RULES, RARITY_WEIGHTS, COMBAT } from '@/config/game.config';
import type { RunContext } from '@/systems/RunContext';
import type { ItemDefinition, Rarity, WeaponDefinition } from '@/types';
import { ITEMS, WEAPONS } from '@/config/items.config';
import { recomputeModifiers } from '@/systems/RunContext';
import { applyItemPickup } from '@/systems/ItemReactions';
import { AudioManager } from '@/systems/AudioManager';
import { iconKey } from '@/config/icons.config';
import { makePanel, panelColorByRarity } from '@/systems/ui/Panel';

const RARITY_COLORS: Record<string, string> = {
  common: '#aaaaaa',
  rare: '#4488ff',
  epic: '#aa44ff',
  legendary: '#ffaa00',
};

const CARD_W = 150;
const CARD_H = 196;
const CARD_GAP = 16;
const CARD_TOP = 92;

type ShopEntry = { def: ItemDefinition | WeaponDefinition; isWeapon: boolean; price: number };

export class ShopOverlay extends Phaser.Scene {
  private ctx!: RunContext;
  private onDone!: () => void;
  private audio = AudioManager.getInstance();

  // Current shop stock
  private stock: ShopEntry[] = [];
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private stockContainer!: Phaser.GameObjects.Container;

  // Coin display (needs frequent update)
  private coinLabel!: Phaser.GameObjects.Text;

  // Weapon slot display (populated in buildWeaponSlots)

  constructor() {
    super({ key: SCENES.SHOP });
  }

  init(data: { ctx: RunContext; onDone: () => void }): void {
    this.ctx = data.ctx;
    this.onDone = data.onDone;
  }

  create(): void {
    const W = GAME.WIDTH;
    const H = GAME.HEIGHT;
    const cx = W / 2;

    // Notify bus that shop is open (HUD hides itself)
    this.ctx.bus.emit('shop:opened', {});

    // Dim background
    this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.82);

    // Title panel
    const titlePanel = makePanel(this, cx - 200, 6, 400, 40, {
      baseColor: 0x0a0a1a, borderColor: 0xffdd88, depth: 5,
    });
    titlePanel.add(this.add.text(200, 20, '🛒  MÁQUINA EXPENDEDORA', {
      fontSize: '20px', color: '#ffdd88', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Wave number
    this.add.text(cx, 54, `Oleada ${this.ctx.wave} completada`, {
      fontSize: '13px', color: '#888888',
    }).setOrigin(0.5).setDepth(6);

    // Coins display
    this.coinLabel = this.add.text(W - 16, 16, `🪙 ${this.ctx.player.coins}`, {
      fontSize: '16px', color: '#ffd700', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(6);

    // Weapon slots row
    this.buildWeaponSlots();

    // Cards area
    this.stockContainer = this.add.container(0, 0).setDepth(6);
    this.rollStock();
    this.buildCards();

    // Buttons
    this.buildButtons();

    // ESC to close
    this.input.keyboard?.once('keydown-ESC', () => this.closeShop());
  }

  private buildWeaponSlots(): void {
    const cx = GAME.WIDTH / 2;
    const slotSize = 44;
    const gap = 10;
    const slotY = GAME.HEIGHT - 70;
    const maxW = this.ctx.modifiers.maxWeapons;
    const totalW = maxW * (slotSize + gap) - gap;
    const startX = cx - totalW / 2;

    this.add.text(cx, slotY - slotSize / 2 - 12, 'ARMAS EQUIPADAS:', {
      fontSize: '11px', color: '#888888',
    }).setOrigin(0.5).setDepth(6);

    for (let i = 0; i < maxW; i++) {
      const sx = startX + i * (slotSize + gap);
      const filled = i < this.ctx.player.weapons.length;
      const weapId = this.ctx.player.weapons[i];
      const bg = this.add.rectangle(sx + slotSize / 2, slotY, slotSize, slotSize, filled ? 0x333355 : 0x111122)
        .setStrokeStyle(2, filled ? 0x4444aa : 0x333344).setDepth(6);
      void bg;

      if (filled && weapId) {
        const ikey = iconKey(weapId);
        if (this.textures.exists(ikey)) {
          this.add.image(sx + slotSize / 2, slotY, ikey)
            .setDisplaySize(slotSize - 8, slotSize - 8).setDepth(7);
        } else {
          this.add.text(sx + slotSize / 2, slotY, '⚔', { fontSize: '20px', color: '#aaaacc' })
            .setOrigin(0.5).setDepth(7);
        }
      }
    }
  }

  // ─── Stock generation ─────────────────────────────────────────────────────

  private rollStock(): void {
    this.stock = this.generateStock(SHOP.CARD_COUNT);
  }

  private generateStock(count: number): ShopEntry[] {
    const entries: ShopEntry[] = [];
    const level = this.ctx.player.level;

    // Build candidate pool: weapons (that can still be added/leveled) + passive items
    type Candidate = { def: ItemDefinition | WeaponDefinition; isWeapon: boolean; w: number };
    const pool: Candidate[] = [];

    for (const weapon of WEAPONS) {
      if (this.ctx.character.noEpicLegendaryWeapons &&
        (weapon.rarity === 'epic' || weapon.rarity === 'legendary')) continue;
      const owned = this.ctx.player.weapons.includes(weapon.id);
      const wLevel = this.ctx.weaponLevels[weapon.id] ?? 0;
      // Can equip new weapon or level up existing (up to WEAPON_MAX_LEVEL)
      const canAdd = !owned && this.ctx.player.weapons.length < this.ctx.modifiers.maxWeapons;
      const canLevel = owned && wLevel < COMBAT.WEAPON_MAX_LEVEL;
      if (!canAdd && !canLevel) continue;
      pool.push({ def: weapon, isWeapon: true, w: RARITY_WEIGHTS[weapon.rarity] });
    }

    for (const item of ITEMS) {
      if (item.category === 'consumable') continue;
      if (this.ctx.player.items.includes(item.id)) {
        if (!item.maxStack || item.maxStack <= 1) continue;
      }
      if (item.rarity === 'epic' && level < RARITY_RULES.EPIC_MIN_LEVEL) continue;
      if (item.rarity === 'legendary' && level < RARITY_RULES.LEGENDARY_MIN_LEVEL) continue;
      if (this.ctx.curseForbidCommon && item.rarity === 'common') continue;
      pool.push({ def: item, isWeapon: false, w: RARITY_WEIGHTS[item.rarity] });
    }

    if (pool.length === 0) return [];

    // Weighted random without replacement
    const available = [...pool];
    for (let i = 0; i < count && available.length > 0; i++) {
      const total = available.reduce((s, e) => s + e.w, 0);
      let rand = Math.random() * total;
      let idx = available.length - 1;
      for (let j = 0; j < available.length; j++) {
        rand -= available[j].w;
        if (rand <= 0) { idx = j; break; }
      }
      const chosen = available[idx];
      available.splice(idx, 1);
      entries.push({
        def: chosen.def,
        isWeapon: chosen.isWeapon,
        price: this.priceFor(chosen.def.rarity, chosen.isWeapon, chosen.def.id),
      });
    }
    return entries;
  }

  private priceFor(rarity: Rarity, isWeapon: boolean, id: string): number {
    // Level-up of owned weapon = PRICE_COMMON
    if (isWeapon && this.ctx.player.weapons.includes(id)) {
      return SHOP.PRICE_WEAPON_LEVELUP;
    }
    switch (rarity) {
      case 'common':    return SHOP.PRICE_COMMON;
      case 'rare':      return SHOP.PRICE_RARE;
      case 'epic':      return SHOP.PRICE_EPIC;
      case 'legendary': return SHOP.PRICE_LEGENDARY;
    }
  }

  // ─── Card building ────────────────────────────────────────────────────────

  private buildCards(): void {
    this.cardContainers = [];
    this.stockContainer.removeAll(true);

    const W = GAME.WIDTH;
    const n = this.stock.length;
    const totalW = n * CARD_W + (n - 1) * CARD_GAP;
    const startX = (W - totalW) / 2;
    const cardY = CARD_TOP;

    this.stock.forEach((entry, i) => {
      const cx = startX + i * (CARD_W + CARD_GAP);
      const container = this.buildCard(cx, cardY, entry, i);
      this.stockContainer.add(container);
      this.cardContainers.push(container);
    });
  }

  private buildCard(
    x: number, y: number,
    entry: ShopEntry,
    idx: number,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const rarity = entry.def.rarity;
    const { baseColor, borderColor } = panelColorByRarity(rarity);

    // Panel background
    const panel = makePanel(this, 0, 0, CARD_W, CARD_H, { baseColor, borderColor });
    container.add(panel);

    const cx = CARD_W / 2;

    // 1. Rarity label (y=6)
    container.add(this.add.text(cx, 6, rarity.toUpperCase(), {
      fontSize: '9px', color: RARITY_COLORS[rarity] ?? '#ffffff',
    }).setOrigin(0.5, 0));

    // 2. Icon at TOP (y=20, 64×64)
    const iconSize = 64;
    const ikey = iconKey(entry.def.id);
    if (this.textures.exists(ikey)) {
      container.add(
        this.add.image(cx, 20, ikey)
          .setDisplaySize(iconSize, iconSize)
          .setOrigin(0.5, 0),
      );
    } else {
      container.add(
        this.add.rectangle(cx, 20, iconSize, iconSize, 0x000000, 0.2)
          .setOrigin(0.5, 0),
      );
      container.add(
        this.add.text(cx, 20 + iconSize / 2, entry.isWeapon ? '⚔' : '◆', {
          fontSize: '36px', color: '#556',
        }).setOrigin(0.5),
      );
    }
    // Icon region: y≈20..84

    // 3. Name (y=88)
    const nameText = this.add.text(cx, 88, entry.def.name, {
      fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
      wordWrap: { width: CARD_W - 12 }, align: 'center',
    }).setOrigin(0.5, 0);
    container.add(nameText);

    // 4. Type label (below name)
    const typeY = 88 + nameText.height + 2;
    const isWeaponOwned = entry.isWeapon && this.ctx.player.weapons.includes(entry.def.id);
    const typeLabel = isWeaponOwned
      ? 'SUBIR NIV.'
      : (entry.isWeapon ? 'ARMA' : (entry.def as ItemDefinition).category.toUpperCase());
    container.add(this.add.text(cx, typeY, typeLabel, {
      fontSize: '8px', color: '#8a8aa0',
    }).setOrigin(0.5, 0));

    // 5. No description — omitted to avoid overlap.

    // 6. Bottom row: price (left half) | COMPRAR (right half) at rowY = CARD_H - 24
    const rowY = CARD_H - 24;
    const canAfford = this.ctx.player.coins >= entry.price;

    // Price panel — left half: x∈[6 .. CARD_W/2-3], centered at CARD_W*0.27
    const priceW = CARD_W / 2 - 9;  // from 6 to CARD_W/2-3
    const priceCx = CARD_W * 0.27;
    const priceBg = makePanel(this, 6, rowY - 10, priceW, 20, {
      baseColor: canAfford ? 0x1a3311 : 0x331111,
      borderColor: canAfford ? 0x44cc44 : 0xcc4444,
    });
    container.add(priceBg);
    container.add(this.add.text(priceCx, rowY + 0, `🪙 ${entry.price}`, {
      fontSize: '10px', color: canAfford ? '#88ff88' : '#ff8888', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    // Buy panel — right half: x∈[CARD_W/2+3 .. CARD_W-6], centered at CARD_W*0.73
    const buyW = CARD_W / 2 - 9;
    const buyCx = CARD_W * 0.73;
    const buyBg = makePanel(this, CARD_W / 2 + 3, rowY - 10, buyW, 20, {
      baseColor: canAfford ? 0x224400 : 0x221111,
      borderColor: canAfford ? 0x44ff44 : 0x553333,
    });
    container.add(buyBg);
    const btnLabel = this.add.text(buyCx, rowY + 0, 'COMPRAR', {
      fontSize: '9px', color: canAfford ? '#88ff88' : '#885555', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    container.add(btnLabel);

    if (canAfford) {
      const hitZone = this.add.rectangle(buyCx, rowY, buyW, 20, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      container.add(hitZone);
      hitZone.on('pointerover', () => btnLabel.setColor('#ffffff'));
      hitZone.on('pointerout', () => btnLabel.setColor('#88ff88'));
      hitZone.on('pointerup', () => {
        this.audio.playBeep('click', 'ui');
        this.buyEntry(entry, idx);
      });
    }

    return container;
  }

  // ─── Actions ──────────────────────────────────────────────────────────────

  private buyEntry(entry: ShopEntry, idx: number): void {
    if (this.ctx.player.coins < entry.price) return;
    this.ctx.player.coins -= entry.price;

    if (entry.isWeapon) {
      this.ctx.bus.emit('upgrade:weapon_selected', { id: entry.def.id });
    } else {
      const itemDef = entry.def as ItemDefinition;
      applyItemPickup(this.ctx, itemDef);
      recomputeModifiers(this.ctx);
      this.ctx.bus.emit('upgrade:item_selected', { id: itemDef.id });
    }

    // Remove card from stock and rebuild
    this.stock.splice(idx, 1);
    this.buildCards();
    this.updateCoinLabel();
  }

  private reroll(): void {
    if (this.ctx.player.coins < SHOP.REROLL_COST) return;
    this.ctx.player.coins -= SHOP.REROLL_COST;
    this.rollStock();
    this.buildCards();
    this.updateCoinLabel();
  }

  private updateCoinLabel(): void {
    if (this.coinLabel) this.coinLabel.setText(`🪙 ${this.ctx.player.coins}`);
  }

  // ─── Bottom buttons ───────────────────────────────────────────────────────

  private buildButtons(): void {
    const W = GAME.WIDTH;
    const btnY = GAME.HEIGHT - 22;

    // REROLL button
    const rerollCanAfford = this.ctx.player.coins >= SHOP.REROLL_COST;
    const rerollPanel = makePanel(this, W / 2 - 185, btnY - 14, 150, 28, {
      baseColor: rerollCanAfford ? 0x222200 : 0x221111,
      borderColor: rerollCanAfford ? 0xaaaa00 : 0x553333,
      depth: 7,
    });
    const rerollText = this.add.text(W / 2 - 185 + 75, btnY, `REROLL (🪙${SHOP.REROLL_COST})`, {
      fontSize: '11px', color: rerollCanAfford ? '#eeee44' : '#884444', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(8);

    if (rerollCanAfford) {
      const rHit = this.add.rectangle(W / 2 - 185 + 75, btnY, 150, 28, 0x000000, 0)
        .setInteractive({ useHandCursor: true }).setDepth(9);
      rHit.on('pointerover', () => rerollText.setColor('#ffffff'));
      rHit.on('pointerout', () => rerollText.setColor('#eeee44'));
      rHit.on('pointerup', () => { this.audio.playBeep('click', 'ui'); this.reroll(); });
    }

    void rerollPanel; // referenced by container

    // SIGUIENTE OLEADA button
    const nextPanel = makePanel(this, W / 2 + 30, btnY - 14, 160, 28, {
      baseColor: 0x002200, borderColor: 0x44ff44, depth: 7,
    });
    const nextText = this.add.text(W / 2 + 30 + 80, btnY, 'SIGUIENTE OLEADA ▶', {
      fontSize: '12px', color: '#44ff44', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(8);
    void nextPanel;

    const nHit = this.add.rectangle(W / 2 + 30 + 80, btnY, 160, 28, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(9);
    nHit.on('pointerover', () => nextText.setColor('#88ff88'));
    nHit.on('pointerout', () => nextText.setColor('#44ff44'));
    nHit.on('pointerup', () => {
      this.audio.playBeep('click', 'ui');
      this.closeShop();
    });
  }

  private closeShop(): void {
    this.scene.stop();
    this.scene.resume(SCENES.GAME);
    this.ctx.bus.emit('shop:closed', {});
    this.onDone();
  }
}
