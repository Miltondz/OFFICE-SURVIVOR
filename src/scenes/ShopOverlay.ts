// src/scenes/ShopOverlay.ts
// §FASE D — Shop overhaul:
//   D.1  reroll escalable, vender ítem (1×/tienda), timer 20s, slot legendario
//   D.2  precios dinámicos (SHOP.PRICES × factor oleada), rareza proporcional
//   D.3  tope de ítems pasivos (COMBAT.MAX_PASSIVE_ITEMS)

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
const CARD_H = 240;    // era 196 — taller to fit description text below type label (Ticket 3.1)
const CARD_GAP = 16;
const CARD_TOP = 96;   // shifted down a few px to make room for the timer bar

type ShopEntry = { def: ItemDefinition | WeaponDefinition; isWeapon: boolean; price: number; isLegendarySlot?: boolean };

export class ShopOverlay extends Phaser.Scene {
  private ctx!: RunContext;
  private onDone!: () => void;
  private audio = AudioManager.getInstance();

  // Current shop stock
  private stock: ShopEntry[] = [];
  private cardContainers: Phaser.GameObjects.Container[] = [];
  private stockContainer!: Phaser.GameObjects.Container;

  // Coin display
  private coinLabel!: Phaser.GameObjects.Text;

  // Reroll state
  private rerollCount = 0;
  private rerollLabelObj!: Phaser.GameObjects.Text;

  // Sell state
  private sellCount = 0;       // how many sells used this visit
  private sellMode = false;
  private sellBtnLabel!: Phaser.GameObjects.Text;
  private inventoryContainer!: Phaser.GameObjects.Container;
  private weaponSlotsContainer!: Phaser.GameObjects.Container;

  // Timer bar
  private timerBar!: Phaser.GameObjects.Rectangle;
  private timerBarBg!: Phaser.GameObjects.Rectangle;
  private timerRemaining = 0;   // ms
  private timerTotal = 0;       // ms

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

    // Reset per-visit state
    this.rerollCount = 0;
    this.sellCount = 0;
    this.sellMode = false;

    // Notify bus that shop is open (HUD hides itself)
    this.ctx.bus.emit('shop:opened', {});

    // Dim background
    this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.82);

    // ── Timer bar (top strip) ─────────────────────────────────────────────
    const timerH = 6;
    this.timerTotal = SHOP.TIMER_SECONDS * 1000;
    this.timerRemaining = this.timerTotal;
    this.add.rectangle(cx, timerH / 2, W, timerH, 0x222222).setDepth(10);
    this.timerBarBg = this.add.rectangle(cx, timerH / 2, W, timerH, 0x222222).setDepth(10);
    void this.timerBarBg;
    this.timerBar = this.add.rectangle(0, timerH / 2, W, timerH, 0x44ff44)
      .setOrigin(0, 0.5).setDepth(11);

    // ── Title panel ───────────────────────────────────────────────────────
    const titlePanel = makePanel(this, cx - 200, 8, 400, 40, {
      baseColor: 0x0a0a1a, borderColor: 0xffdd88, depth: 5,
    });
    titlePanel.add(this.add.text(200, 20, '🛒  MÁQUINA EXPENDEDORA', {
      fontSize: '20px', color: '#ffdd88', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Wave number
    this.add.text(cx, 56, `Oleada ${this.ctx.wave} completada`, {
      fontSize: '13px', color: '#888888',
    }).setOrigin(0.5).setDepth(6);

    // Coins display
    this.coinLabel = this.add.text(W - 16, 16, `🪙 ${this.ctx.player.coins}`, {
      fontSize: '16px', color: '#ffd700', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(6);

    // Weapon slots row (en contenedor para poder reconstruir tras comprar/vender)
    this.weaponSlotsContainer = this.add.container(0, 0).setDepth(6);
    this.buildWeaponSlots();

    // Cards area
    this.stockContainer = this.add.container(0, 0).setDepth(6);
    this.rollStock();
    this.buildCards();

    // Inventory container (for sell mode)
    this.inventoryContainer = this.add.container(0, 0).setDepth(12);

    // Buttons
    this.buildButtons();

    // ESC to close
    this.input.keyboard?.once('keydown-ESC', () => this.closeShop());

    // Start countdown timer using overlay scene's own time (GameScene is paused)
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: this.tickTimer,
      callbackScope: this,
    });
  }

  // ── Timer ────────────────────────────────────────────────────────────────

  private tickTimer(): void {
    this.timerRemaining -= 16;
    if (this.timerRemaining <= 0) {
      this.timerRemaining = 0;
      this.timerBar.setDisplaySize(0, 6);
      this.closeShop();
      return;
    }
    const frac = this.timerRemaining / this.timerTotal;
    this.timerBar.setDisplaySize(Math.round(GAME.WIDTH * frac), 6);
    // Color: green → yellow → red
    const color = frac > 0.5 ? 0x44ff44 : frac > 0.25 ? 0xffcc00 : 0xff4444;
    this.timerBar.setFillStyle(color);
  }

  // ── Weapon slots ─────────────────────────────────────────────────────────

  private buildWeaponSlots(): void {
    this.weaponSlotsContainer.removeAll(true);
    const cx = GAME.WIDTH / 2;
    const slotSize = 44;
    const gap = 10;
    const slotY = GAME.HEIGHT - 70;
    const maxW = this.ctx.modifiers.maxWeapons;
    const totalW = maxW * (slotSize + gap) - gap;
    const startX = cx - totalW / 2;

    this.weaponSlotsContainer.add(this.add.text(cx, slotY - slotSize / 2 - 12, 'ARMAS EQUIPADAS:', {
      fontSize: '11px', color: '#888888',
    }).setOrigin(0.5).setDepth(6));

    for (let i = 0; i < maxW; i++) {
      const sx = startX + i * (slotSize + gap);
      const filled = i < this.ctx.player.weapons.length;
      const weapId = this.ctx.player.weapons[i];
      this.weaponSlotsContainer.add(
        this.add.rectangle(sx + slotSize / 2, slotY, slotSize, slotSize, filled ? 0x333355 : 0x111122)
          .setStrokeStyle(2, filled ? 0x4444aa : 0x333344).setDepth(6),
      );

      if (filled && weapId) {
        const ikey = iconKey(weapId);
        if (this.textures.exists(ikey)) {
          this.weaponSlotsContainer.add(this.add.image(sx + slotSize / 2, slotY, ikey)
            .setDisplaySize(slotSize - 8, slotSize - 8).setDepth(7));
        } else {
          this.weaponSlotsContainer.add(this.add.text(sx + slotSize / 2, slotY, '⚔', { fontSize: '20px', color: '#aaaacc' })
            .setOrigin(0.5).setDepth(7));
        }
        // Nivel del arma (I..V) en la esquina del slot
        const lvl = this.ctx.weaponLevels[weapId] ?? 1;
        this.weaponSlotsContainer.add(this.add.text(sx + slotSize - 6, slotY + slotSize / 2 - 6,
          ['I', 'II', 'III', 'IV', 'V'][Math.min(4, lvl - 1)], {
            fontSize: '10px', color: '#ffe680', fontStyle: 'bold', stroke: '#000000', strokeThickness: 2,
          }).setOrigin(1, 1).setDepth(8));
      }
    }
  }

  // ── Stock generation ──────────────────────────────────────────────────────

  /** Price shown on card: base × wave scale factor, weapon-levelup also scaled. */
  private scaledPrice(rarity: Rarity, isWeaponLevelup: boolean): number {
    if (isWeaponLevelup) {
      return Math.round(SHOP.PRICE_WEAPON_LEVELUP * (1 + (this.ctx.wave - 1) * SHOP.PRICE_WAVE_SCALE));
    }
    const base = SHOP.PRICES[rarity] ?? SHOP.PRICES['common'];
    return Math.round(base * (1 + (this.ctx.wave - 1) * SHOP.PRICE_WAVE_SCALE));
  }

  private priceFor(rarity: Rarity, isWeapon: boolean, id: string): number {
    const isLevelup = isWeapon && this.ctx.player.weapons.includes(id);
    return this.scaledPrice(rarity, isLevelup);
  }

  private rollStock(): void {
    this.stock = this.generateStock(SHOP.CARD_COUNT);

    // D.1 Slot legendario — only on wave ≥ LEGENDARY_MIN_WAVE, with LEGENDARY_CHANCE probability
    if (this.ctx.wave >= SHOP.LEGENDARY_MIN_WAVE && Math.random() < SHOP.LEGENDARY_CHANCE) {
      const legItem = this.pickLegendaryItem();
      if (legItem) {
        this.stock.push({
          def: legItem,
          isWeapon: false,
          price: SHOP.LEGENDARY_COST,
          isLegendarySlot: true,
        });
      }
    }
  }

  /** Pick a random legendary item not yet owned. */
  private pickLegendaryItem(): ItemDefinition | null {
    const candidates = ITEMS.filter(
      (it) => it.rarity === 'legendary' &&
               it.category !== 'consumable' &&
               !this.ctx.player.items.includes(it.id),
    );
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private generateStock(count: number): ShopEntry[] {
    const entries: ShopEntry[] = [];
    const level = this.ctx.player.level;

    type Candidate = { def: ItemDefinition | WeaponDefinition; isWeapon: boolean; w: number };
    const pool: Candidate[] = [];

    for (const weapon of WEAPONS) {
      if (this.ctx.character.noEpicLegendaryWeapons &&
        (weapon.rarity === 'epic' || weapon.rarity === 'legendary')) continue;
      const owned = this.ctx.player.weapons.includes(weapon.id);
      const wLevel = this.ctx.weaponLevels[weapon.id] ?? 0;
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
      // Rarity gates: epics from EPIC_MIN_LEVEL, legendaries from LEGENDARY_MIN_LEVEL
      if (item.rarity === 'epic' && level < RARITY_RULES.EPIC_MIN_LEVEL) continue;
      if (item.rarity === 'legendary' && level < RARITY_RULES.LEGENDARY_MIN_LEVEL) continue;
      if (this.ctx.curseForbidCommon && item.rarity === 'common') continue;
      pool.push({ def: item, isWeapon: false, w: RARITY_WEIGHTS[item.rarity] });
    }

    if (pool.length === 0) return [];

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

  // ── D.3 passive item count ────────────────────────────────────────────────

  private passiveItemCount(): number {
    return this.ctx.player.items.filter((id) => {
      const def = ITEMS.find((it) => it.id === id);
      return def !== undefined && def.category !== 'consumable';
    }).length;
  }

  // ── Card building ─────────────────────────────────────────────────────────

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
    const isLegSlot = entry.isLegendarySlot === true;
    const { baseColor, borderColor } = isLegSlot
      ? { baseColor: 0x1a1000, borderColor: 0xffaa00 }
      : panelColorByRarity(rarity);

    const panel = makePanel(this, 0, 0, CARD_W, CARD_H, { baseColor, borderColor });
    container.add(panel);

    const cx = CARD_W / 2;

    // 1. Rarity / special label
    const rarityLabel = isLegSlot ? '★ LEGENDARIO ★' : rarity.toUpperCase();
    container.add(this.add.text(cx, 6, rarityLabel, {
      fontSize: '9px', color: isLegSlot ? '#ffaa00' : (RARITY_COLORS[rarity] ?? '#ffffff'),
    }).setOrigin(0.5, 0));

    // 2. Icon
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

    // 3. Name
    const nameText = this.add.text(cx, 88, entry.def.name, {
      fontSize: '12px', color: '#ffffff', fontStyle: 'bold',
      wordWrap: { width: CARD_W - 12 }, align: 'center',
    }).setOrigin(0.5, 0);
    container.add(nameText);

    // 4. Type label
    const typeY = 88 + nameText.height + 2;
    const isWeaponOwned = entry.isWeapon && this.ctx.player.weapons.includes(entry.def.id);
    const typeLabel = isWeaponOwned
      ? 'SUBIR NIV.'
      : (entry.isWeapon ? 'ARMA' : (entry.def as ItemDefinition).category.toUpperCase());
    const typeTxt = this.add.text(cx, typeY, typeLabel, {
      fontSize: '8px', color: '#8a8aa0',
    }).setOrigin(0.5, 0);
    container.add(typeTxt);

    // 4b. Description (Ticket 3.1 — re-added)
    const descY = typeY + typeTxt.height + 3;
    const rawDesc = entry.isWeapon
      ? (entry.def as WeaponDefinition).description
      : (entry.def as ItemDefinition).description;
    const descTxt = this.add.text(cx, descY, rawDesc ?? '', {
      fontSize: '8px', color: '#aaaacc',
      wordWrap: { width: CARD_W - 12 }, align: 'center', lineSpacing: 1,
    }).setOrigin(0.5, 0);
    container.add(descTxt);

    // 4c. Weapon level-up effect hint (Ticket 3.1)
    if (isWeaponOwned) {
      const wLevel = (this.ctx.weaponLevels[entry.def.id] ?? 0) + 1; // current level (1-based after first buy)
      const nextLevel = Math.min(wLevel + 1, COMBAT.WEAPON_MAX_LEVEL);
      const dmgPct = Math.round(COMBAT.WEAPON_LEVEL_DAMAGE_STEP * 100);
      const frPct = Math.round(COMBAT.WEAPON_LEVEL_FIRERATE_STEP * 100);
      const hintY = descY + descTxt.height + 2;
      container.add(this.add.text(cx, hintY, `Niv ${wLevel}→${nextLevel}: +${dmgPct}% daño / +${frPct}% cadencia`, {
        fontSize: '7px', color: '#88ff88',
        wordWrap: { width: CARD_W - 12 }, align: 'center',
      }).setOrigin(0.5, 0));
    }

    // 5. Bottom row: price | COMPRAR
    const rowY = CARD_H - 24;
    const canAfford = this.ctx.player.coins >= entry.price;

    // D.3 — block passive purchase when at cap (unless it's a weapon, consumable, or weapon levelup)
    const wouldBePassive = !entry.isWeapon && (entry.def as ItemDefinition).category !== 'consumable';
    const atCap = wouldBePassive && this.passiveItemCount() >= COMBAT.MAX_PASSIVE_ITEMS;
    const canBuy = canAfford && !atCap;

    const priceW = CARD_W / 2 - 9;
    const priceCx = CARD_W * 0.27;
    const priceBg = makePanel(this, 6, rowY - 10, priceW, 20, {
      baseColor: canAfford ? 0x1a3311 : 0x331111,
      borderColor: canAfford ? 0x44cc44 : 0xcc4444,
    });
    container.add(priceBg);
    container.add(this.add.text(priceCx, rowY + 0, `🪙 ${entry.price}`, {
      fontSize: '10px', color: canAfford ? '#88ff88' : '#ff8888', fontStyle: 'bold',
    }).setOrigin(0.5, 0.5));

    const buyW = CARD_W / 2 - 9;
    const buyCx = CARD_W * 0.73;
    const buyBg = makePanel(this, CARD_W / 2 + 3, rowY - 10, buyW, 20, {
      baseColor: canBuy ? 0x224400 : 0x221111,
      borderColor: canBuy ? 0x44ff44 : 0x553333,
    });
    container.add(buyBg);

    if (atCap) {
      // Show "INV. LLENO" hint instead of COMPRAR
      container.add(this.add.text(buyCx, rowY + 0, 'INV. LLENO', {
        fontSize: '7px', color: '#886644', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5));
    } else {
      const btnLabel = this.add.text(buyCx, rowY + 0, 'COMPRAR', {
        fontSize: '9px', color: canBuy ? '#88ff88' : '#885555', fontStyle: 'bold',
      }).setOrigin(0.5, 0.5);
      container.add(btnLabel);

      if (canBuy) {
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
    }

    return container;
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  private buyEntry(entry: ShopEntry, idx: number): void {
    if (this.ctx.player.coins < entry.price) return;

    // D.3 cap check (defensive)
    if (!entry.isWeapon) {
      const itemDef = entry.def as ItemDefinition;
      if (itemDef.category !== 'consumable' && this.passiveItemCount() >= COMBAT.MAX_PASSIVE_ITEMS) return;
    }

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
    this.buildWeaponSlots();   // refrescar armas equipadas + slots libres tras comprar
    this.updateCoinLabel();
    this.refreshRerollButton();
    this.refreshSellButton();
  }

  /** Escalating reroll: cost = BASE + count * INCREMENT */
  private currentRerollCost(): number {
    return SHOP.REROLL_BASE_COST + this.rerollCount * SHOP.REROLL_COST_INCREMENT;
  }

  private reroll(): void {
    const cost = this.currentRerollCost();
    if (this.ctx.player.coins < cost) return;
    this.ctx.player.coins -= cost;
    this.rerollCount++;
    this.rollStock();
    this.buildCards();
    this.updateCoinLabel();
    this.refreshRerollButton();
    this.refreshSellButton();
  }

  private updateCoinLabel(): void {
    if (this.coinLabel) this.coinLabel.setText(`🪙 ${this.ctx.player.coins}`);
  }

  // ── Sell mode ─────────────────────────────────────────────────────────────

  private enterSellMode(): void {
    if (this.sellCount >= SHOP.MAX_SELLS_PER_SHOP) return;
    this.sellMode = true;
    this.refreshSellButton();
    this.buildInventoryPanel();
  }

  private exitSellMode(): void {
    this.sellMode = false;
    this.inventoryContainer.removeAll(true);
    this.refreshSellButton();
  }

  /** Sell price for an owned item OR weapon: floor(scaledPrice(rarity) * SELL_REFUND_RATIO) */
  private sellPriceFor(id: string): number {
    const item = ITEMS.find((it) => it.id === id);
    const rarity = item?.rarity ?? WEAPONS.find((w) => w.id === id)?.rarity;
    if (!rarity) return 0;
    const sp = this.scaledPrice(rarity, false);
    return Math.floor(sp * SHOP.SELL_REFUND_RATIO);
  }

  private buildInventoryPanel(): void {
    this.inventoryContainer.removeAll(true);

    const W = GAME.WIDTH;
    const H = GAME.HEIGHT;

    // Dark overlay for inventory panel
    const panelW = 400;
    const panelH = 260;
    const panelX = (W - panelW) / 2;
    const panelY = (H - panelH) / 2;

    const bg = makePanel(this, panelX, panelY, panelW, panelH, {
      baseColor: 0x0a0a20, borderColor: 0xffaa00, depth: 12,
    });
    this.inventoryContainer.add(bg);

    this.inventoryContainer.add(this.add.text(W / 2, panelY + 16, 'VENDER — elige arma o ítem', {
      fontSize: '13px', color: '#ffaa00', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(13));

    // Vendibles: armas (solo si hay >1, siempre queda 1) + ítems pasivos.
    type Sellable = { id: string; isWeapon: boolean };
    const sellables: Sellable[] = [];
    if (this.ctx.player.weapons.length > 1) {
      for (const wid of this.ctx.player.weapons) sellables.push({ id: wid, isWeapon: true });
    }
    for (const id of this.ctx.player.items) {
      const def = ITEMS.find((it) => it.id === id);
      if (def && def.category !== 'consumable') sellables.push({ id, isWeapon: false });
    }

    if (sellables.length === 0) {
      this.inventoryContainer.add(this.add.text(W / 2, panelY + 60, 'Nada para vender (debe quedar ≥1 arma).', {
        fontSize: '11px', color: '#888888',
      }).setOrigin(0.5, 0).setDepth(13));
    } else {
      const itemsPerRow = 5;
      const slotSize = 52;
      const slotGap = 8;
      const rowsTotal = Math.ceil(sellables.length / itemsPerRow);
      const gridW = Math.min(sellables.length, itemsPerRow) * (slotSize + slotGap) - slotGap;
      const gridStartX = W / 2 - gridW / 2;
      const gridStartY = panelY + 44;

      sellables.forEach((s, idx) => {
        const col = idx % itemsPerRow;
        const row = Math.floor(idx / itemsPerRow);
        const sx = gridStartX + col * (slotSize + slotGap);
        const sy = gridStartY + row * (slotSize + slotGap);
        const refund = this.sellPriceFor(s.id);
        const rarity = s.isWeapon
          ? WEAPONS.find((w) => w.id === s.id)?.rarity
          : ITEMS.find((it) => it.id === s.id)?.rarity;

        // Armas con borde azul para distinguirlas
        const idle = s.isWeapon ? 0x112244 : 0x221122;
        const hover = s.isWeapon ? 0x224488 : 0x442244;
        const slotBg = this.add.rectangle(sx + slotSize / 2, sy + slotSize / 2, slotSize, slotSize, idle)
          .setStrokeStyle(1, s.isWeapon ? 0x4488cc : 0x884488).setDepth(13).setInteractive({ useHandCursor: true });
        this.inventoryContainer.add(slotBg);

        const ikey = iconKey(s.id);
        if (this.textures.exists(ikey)) {
          this.inventoryContainer.add(this.add.image(sx + slotSize / 2, sy + slotSize / 2 - 4, ikey)
            .setDisplaySize(slotSize - 12, slotSize - 12).setDepth(14));
        } else {
          this.inventoryContainer.add(this.add.text(sx + slotSize / 2, sy + slotSize / 2 - 4, s.isWeapon ? '⚔' : '◆', {
            fontSize: '24px', color: RARITY_COLORS[rarity ?? 'common'] ?? '#ffffff',
          }).setOrigin(0.5).setDepth(14));
        }

        this.inventoryContainer.add(this.add.text(sx + slotSize / 2, sy + slotSize - 10, `🪙${refund}`, {
          fontSize: '8px', color: '#ffd700',
        }).setOrigin(0.5, 1).setDepth(14));

        slotBg.on('pointerover', () => slotBg.setFillStyle(hover));
        slotBg.on('pointerout', () => slotBg.setFillStyle(idle));
        slotBg.on('pointerup', () => {
          this.audio.playBeep('click', 'ui');
          if (s.isWeapon) this.sellWeapon(s.id, refund);
          else this.sellItem(s.id, refund);
        });
      });

      const noteY = gridStartY + rowsTotal * (slotSize + slotGap) + 4;
      this.inventoryContainer.add(this.add.text(W / 2, noteY, 'Clic para vender (50%). Armas azules.', {
        fontSize: '10px', color: '#666666',
      }).setOrigin(0.5, 0).setDepth(13));
    }

    // Cancel button
    const cancelY = panelY + panelH - 18;
    const cancelBg = makePanel(this, W / 2 - 50, cancelY - 12, 100, 24, {
      baseColor: 0x220000, borderColor: 0xaa3333, depth: 13,
    });
    this.inventoryContainer.add(cancelBg);
    const cancelTxt = this.add.text(W / 2, cancelY, 'CANCELAR', {
      fontSize: '11px', color: '#ff8888', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(14).setInteractive({ useHandCursor: true });
    this.inventoryContainer.add(cancelTxt);
    cancelTxt.on('pointerup', () => { this.audio.playBeep('click', 'ui'); this.exitSellMode(); });
  }

  private sellItem(itemId: string, refund: number): void {
    const idx = this.ctx.player.items.indexOf(itemId);
    if (idx === -1) return;
    this.ctx.player.items.splice(idx, 1);
    this.ctx.player.coins += refund;
    this.sellCount++;
    recomputeModifiers(this.ctx);
    this.ctx.bus.emit('upgrade:item_selected', { id: itemId }); // notify HUD
    this.exitSellMode();
    this.buildCards(); // refresh (cap may have freed up)
    this.updateCoinLabel();
    this.refreshRerollButton();
    this.refreshSellButton();
  }

  /** Vender un arma del slot (libera espacio). Nunca deja al jugador sin armas. */
  private sellWeapon(weaponId: string, refund: number): void {
    if (this.ctx.player.weapons.length <= 1) return;   // siempre debe quedar ≥1 arma
    // GameScene escucha 'weapon:sell' y llama a WeaponSystem.removeWeapon (síncrono vía bus).
    this.ctx.bus.emit('weapon:sell', { id: weaponId });
    this.ctx.player.coins += refund;
    this.sellCount++;
    this.exitSellMode();
    this.buildCards();
    this.buildWeaponSlots();   // refrescar slots tras liberar uno
    this.updateCoinLabel();
    this.refreshRerollButton();
    this.refreshSellButton();
  }

  // ── Bottom buttons ────────────────────────────────────────────────────────

  /**
   * Build the button row once. Reroll text / color is refreshed via refreshRerollButton().
   * Sell button state is refreshed via refreshSellButton().
   */
  private buildButtons(): void {
    const W = GAME.WIDTH;
    const btnY = GAME.HEIGHT - 22;

    // ── REROLL button ──
    const cost = this.currentRerollCost();
    const rerollCanAfford = this.ctx.player.coins >= cost;
    void makePanel(this, W / 2 - 185, btnY - 14, 150, 28, {
      baseColor: rerollCanAfford ? 0x222200 : 0x221111,
      borderColor: rerollCanAfford ? 0xaaaa00 : 0x553333,
      depth: 7,
    });
    this.rerollLabelObj = this.add.text(W / 2 - 185 + 75, btnY, `REROLL (🪙${cost})`, {
      fontSize: '11px', color: rerollCanAfford ? '#eeee44' : '#884444', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(8);

    // Persistent hit zone for reroll — always present, guards internally
    const rHit = this.add.rectangle(W / 2 - 185 + 75, btnY, 150, 28, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(9);
    rHit.on('pointerover', () => {
      if (this.ctx.player.coins >= this.currentRerollCost()) this.rerollLabelObj.setColor('#ffffff');
    });
    rHit.on('pointerout', () => this.refreshRerollButton());
    rHit.on('pointerup', () => {
      this.audio.playBeep('click', 'ui');
      this.reroll();
    });

    // ── SELL button ──
    const sellUsed = this.sellCount >= SHOP.MAX_SELLS_PER_SHOP;
    const sellPanel = makePanel(this, W / 2 - 25, btnY - 14, 110, 28, {
      baseColor: sellUsed ? 0x111111 : 0x001122,
      borderColor: sellUsed ? 0x333333 : 0x2277aa,
      depth: 7,
    });
    void sellPanel;
    this.sellBtnLabel = this.add.text(W / 2 - 25 + 55, btnY, 'VENDER ÍTEM', {
      fontSize: '11px', color: sellUsed ? '#555566' : '#44aaff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(8);

    if (!sellUsed) {
      const sHit = this.add.rectangle(W / 2 - 25 + 55, btnY, 110, 28, 0x000000, 0)
        .setInteractive({ useHandCursor: true }).setDepth(9);
      sHit.on('pointerover', () => { if (this.sellCount < SHOP.MAX_SELLS_PER_SHOP) this.sellBtnLabel.setColor('#88ddff'); });
      sHit.on('pointerout', () => this.refreshSellButton());
      sHit.on('pointerup', () => {
        this.audio.playBeep('click', 'ui');
        if (this.sellMode) { this.exitSellMode(); } else { this.enterSellMode(); }
      });
    }

    // ── SIGUIENTE OLEADA button ──
    const nextPanel = makePanel(this, W / 2 + 100, btnY - 14, 160, 28, {
      baseColor: 0x002200, borderColor: 0x44ff44, depth: 7,
    });
    const nextText = this.add.text(W / 2 + 100 + 80, btnY, 'CONTINUAR ▶', {
      fontSize: '12px', color: '#44ff44', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(8);
    void nextPanel;

    const nHit = this.add.rectangle(W / 2 + 100 + 80, btnY, 160, 28, 0x000000, 0)
      .setInteractive({ useHandCursor: true }).setDepth(9);
    nHit.on('pointerover', () => nextText.setColor('#88ff88'));
    nHit.on('pointerout', () => nextText.setColor('#44ff44'));
    nHit.on('pointerup', () => {
      this.audio.playBeep('click', 'ui');
      this.closeShop();
    });
  }

  private refreshRerollButton(): void {
    if (!this.rerollLabelObj) return;
    const cost = this.currentRerollCost();
    const canAfford = this.ctx.player.coins >= cost;
    this.rerollLabelObj.setText(`REROLL (🪙${cost})`);
    this.rerollLabelObj.setColor(canAfford ? '#eeee44' : '#884444');
  }

  private refreshSellButton(): void {
    if (!this.sellBtnLabel) return;
    const used = this.sellCount >= SHOP.MAX_SELLS_PER_SHOP;
    if (this.sellMode) {
      this.sellBtnLabel.setColor('#ff8888').setText('CANCELAR');
    } else {
      this.sellBtnLabel.setColor(used ? '#555566' : '#44aaff').setText('VENDER ÍTEM');
    }
  }

  // ── Close ─────────────────────────────────────────────────────────────────

  private closeShop(): void {
    this.scene.stop();
    this.scene.resume(SCENES.GAME);
    this.ctx.bus.emit('shop:closed', {});
    this.onDone();
  }
}
