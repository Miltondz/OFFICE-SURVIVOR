// src/scenes/InventoryScene.ts
// Overlay de inventario: muestra armas equipadas + ítems pasivos, permite vender sin límite.
// Abierto con I (desde GameScene); cerrado con I, ESC o el botón CERRAR.
// GameScene queda pausada mientras esta escena está activa.

import Phaser from 'phaser';
import { SCENES, GAME, SHOP } from '@/config/game.config';
import type { RunContext } from '@/systems/RunContext';
import { recomputeModifiers } from '@/systems/RunContext';
import { ITEMS, WEAPONS } from '@/config/items.config';
import { iconKey } from '@/config/icons.config';
import { makePanel } from '@/systems/ui/Panel';
import { AudioManager } from '@/systems/AudioManager';

const RARITY_COLORS: Record<string, string> = {
  common: '#aaaaaa',
  rare: '#4488ff',
  epic: '#aa44ff',
  legendary: '#ffaa00',
};

// Layout constants
const PANEL_W = 680;
const PANEL_H = 400;
const SLOT_SIZE = 54;
const SLOT_GAP = 10;

export class InventoryScene extends Phaser.Scene {
  private ctx!: RunContext;
  private audio = AudioManager.getInstance();

  // Containers rebuilt on each sell
  private weaponGrid!: Phaser.GameObjects.Container;
  private itemGrid!: Phaser.GameObjects.Container;
  private coinLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENES.INVENTORY });
  }

  init(data: { ctx: RunContext }): void {
    this.ctx = data.ctx;
  }

  create(): void {
    const W = GAME.WIDTH;
    const H = GAME.HEIGHT;
    const cx = W / 2;
    const cy = H / 2;

    // Dim background (fixed to camera)
    this.add.rectangle(cx, cy, W, H, 0x000000, 0.80).setScrollFactor(0);

    // Main panel
    const panelX = cx - PANEL_W / 2;
    const panelY = cy - PANEL_H / 2;
    makePanel(this, panelX, panelY, PANEL_W, PANEL_H, {
      baseColor: 0x0a0a1a, borderColor: 0x6688cc, depth: 10,
    });

    // Title
    this.add.text(cx, panelY + 18, 'INVENTARIO', {
      fontSize: '22px', color: '#aabbff', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(12);

    // Hint
    this.add.text(cx, panelY + 46, 'I o ESC para cerrar  ·  clic en un ítem para vender (reembolso 50%)', {
      fontSize: '10px', color: '#666688',
    }).setOrigin(0.5, 0).setDepth(12);

    // Coin label (top-right of panel)
    this.coinLabel = this.add.text(panelX + PANEL_W - 12, panelY + 18, `🪙 ${this.ctx.player.coins}`, {
      fontSize: '14px', color: '#ffd700', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0).setDepth(12);

    // Grids (rebuilt on sells)
    this.weaponGrid = this.add.container(0, 0).setDepth(12);
    this.itemGrid = this.add.container(0, 0).setDepth(12);
    this.buildWeaponGrid(panelX, panelY);
    this.buildItemGrid(panelX, panelY);

    // CERRAR button
    const btnY = panelY + PANEL_H - 20;
    makePanel(this, cx - 60, btnY - 14, 120, 28, {
      baseColor: 0x002244, borderColor: 0x4466aa, depth: 11,
    });
    const closeText = this.add.text(cx, btnY, 'CERRAR', {
      fontSize: '13px', color: '#88aaff', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(13).setInteractive({ useHandCursor: true });
    closeText.on('pointerover', () => closeText.setColor('#ffffff'));
    closeText.on('pointerout', () => closeText.setColor('#88aaff'));
    closeText.on('pointerup', () => { this.audio.playBeep('click', 'ui'); this.closeInventory(); });

    // Keyboard: I and ESC both close
    const iKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.I);
    iKey.on('down', () => this.closeInventory());
    const escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.on('down', () => this.closeInventory());
  }

  // ── Weapon grid ──────────────────────────────────────────────────────────

  private buildWeaponGrid(panelX: number, panelY: number): void {
    this.weaponGrid.removeAll(true);
    const startY = panelY + 70;
    const labelX = panelX + 20;

    this.weaponGrid.add(this.add.text(labelX, startY, 'ARMAS EQUIPADAS', {
      fontSize: '11px', color: '#8899cc', fontStyle: 'bold',
    }));

    const gridY = startY + 22;
    const weapons = this.ctx.player.weapons;
    const canSell = weapons.length > 1; // guard: never leaves player weaponless

    weapons.forEach((wid, i) => {
      const sx = labelX + i * (SLOT_SIZE + SLOT_GAP);
      this.buildSlot(this.weaponGrid, sx, gridY, wid, true, canSell, i);
    });

    // Section separator line
    const sepY = gridY + SLOT_SIZE + 16;
    this.weaponGrid.add(
      this.add.rectangle(panelX + 20, sepY, PANEL_W - 40, 1, 0x334466, 0.8)
        .setOrigin(0, 0),
    );
  }

  // ── Item grid ────────────────────────────────────────────────────────────

  private buildItemGrid(panelX: number, panelY: number): void {
    this.itemGrid.removeAll(true);

    // Passive items only (no consumables)
    const passiveItems = this.ctx.player.items.filter(id => {
      const def = ITEMS.find(it => it.id === id);
      return def !== undefined && def.category !== 'consumable';
    });

    const startY = panelY + 70 + 22 + SLOT_SIZE + 32; // below weapon section + separator
    const labelX = panelX + 20;

    this.itemGrid.add(this.add.text(labelX, startY, 'ÍTEMS PASIVOS', {
      fontSize: '11px', color: '#8899cc', fontStyle: 'bold',
    }));

    if (passiveItems.length === 0) {
      this.itemGrid.add(this.add.text(labelX, startY + 22, 'Sin ítems pasivos.', {
        fontSize: '11px', color: '#555577',
      }));
      return;
    }

    const itemsPerRow = Math.floor((PANEL_W - 40) / (SLOT_SIZE + SLOT_GAP));
    passiveItems.forEach((id, i) => {
      const col = i % itemsPerRow;
      const row = Math.floor(i / itemsPerRow);
      const sx = labelX + col * (SLOT_SIZE + SLOT_GAP);
      const sy = startY + 22 + row * (SLOT_SIZE + SLOT_GAP);
      this.buildSlot(this.itemGrid, sx, sy, id, false, true, i);
    });
  }

  // ── Shared slot builder ───────────────────────────────────────────────────

  private buildSlot(
    container: Phaser.GameObjects.Container,
    sx: number, sy: number,
    id: string,
    isWeapon: boolean,
    sellable: boolean,
    originalIndex: number,
  ): void {
    const def = isWeapon
      ? WEAPONS.find(w => w.id === id)
      : ITEMS.find(it => it.id === id);
    const rarity = def?.rarity ?? 'common';
    const refund = this.refundFor(rarity);
    const rarityColor = RARITY_COLORS[rarity] ?? '#aaaaaa';

    const idleColor = isWeapon ? 0x112244 : 0x221133;
    const hoverColor = isWeapon ? 0x224488 : 0x442255;
    const borderColor = isWeapon ? 0x4488cc : 0x884499;
    const disabledBorderColor = 0x333355;

    const slotBg = this.add.rectangle(
      sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2,
      SLOT_SIZE, SLOT_SIZE,
      idleColor,
    ).setStrokeStyle(1, sellable ? borderColor : disabledBorderColor).setDepth(13);
    container.add(slotBg);

    // Icon or fallback glyph
    const ikey = iconKey(id);
    if (this.textures.exists(ikey)) {
      container.add(
        this.add.image(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2 - 4, ikey)
          .setDisplaySize(SLOT_SIZE - 14, SLOT_SIZE - 14)
          .setDepth(14),
      );
    } else {
      container.add(
        this.add.text(sx + SLOT_SIZE / 2, sy + SLOT_SIZE / 2 - 4,
          isWeapon ? '⚔' : '◆', {
            fontSize: '22px', color: rarityColor,
          }).setOrigin(0.5).setDepth(14),
      );
    }

    // Weapon level badge (I–V)
    if (isWeapon) {
      const lvl = this.ctx.weaponLevels[id] ?? 1;
      container.add(
        this.add.text(sx + SLOT_SIZE - 5, sy + SLOT_SIZE - 5,
          ['I', 'II', 'III', 'IV', 'V'][Math.min(4, lvl - 1)], {
            fontSize: '9px', color: '#ffe680', fontStyle: 'bold',
            stroke: '#000000', strokeThickness: 2,
          }).setOrigin(1, 1).setDepth(15),
      );
    }

    // Refund label at bottom
    const refundColor = sellable ? '#ffd700' : '#444455';
    container.add(
      this.add.text(sx + SLOT_SIZE / 2, sy + SLOT_SIZE - 8, `🪙${refund}`, {
        fontSize: '8px', color: refundColor,
      }).setOrigin(0.5, 1).setDepth(14),
    );

    // "Last weapon" label if unsellable
    if (!sellable) {
      container.add(
        this.add.text(sx + SLOT_SIZE / 2, sy - 2, 'NO VENDER', {
          fontSize: '7px', color: '#554455',
        }).setOrigin(0.5, 1).setDepth(14),
      );
    }

    // Interactivity — only if sellable
    if (sellable) {
      slotBg.setInteractive({ useHandCursor: true });
      slotBg.on('pointerover', () => slotBg.setFillStyle(hoverColor));
      slotBg.on('pointerout', () => slotBg.setFillStyle(idleColor));
      slotBg.on('pointerup', () => {
        this.audio.playBeep('click', 'ui');
        if (isWeapon) {
          this.sellWeapon(id, refund);
        } else {
          this.sellItem(id, refund, originalIndex);
        }
      });
    }
  }

  // ── Refund calculation ────────────────────────────────────────────────────

  private refundFor(rarity: string): number {
    const price = SHOP.PRICES[rarity] ?? 10;
    return Math.floor(price * SHOP.SELL_REFUND_RATIO);
  }

  // ── Sell actions ──────────────────────────────────────────────────────────

  private sellWeapon(weaponId: string, refund: number): void {
    // Guard: never leave player weaponless (WeaponSystem.removeWeapon also guards, but be explicit)
    if (this.ctx.player.weapons.length <= 1) return;
    // GameScene listens to 'weapon:sell' → WeaponSystem.removeWeapon + recomputeModifiers
    this.ctx.bus.emit('weapon:sell', { id: weaponId });
    this.ctx.player.coins += refund;
    this.rebuildGrids();
    this.updateCoinLabel();
  }

  private sellItem(itemId: string, refund: number, _originalIndex: number): void {
    const idx = this.ctx.player.items.indexOf(itemId);
    if (idx === -1) return;
    this.ctx.player.items.splice(idx, 1);
    this.ctx.player.coins += refund;
    recomputeModifiers(this.ctx);
    this.ctx.bus.emit('upgrade:item_selected', { id: itemId }); // HUD refresh
    this.rebuildGrids();
    this.updateCoinLabel();
  }

  // ── Refresh ───────────────────────────────────────────────────────────────

  private rebuildGrids(): void {
    const W = GAME.WIDTH;
    const H = GAME.HEIGHT;
    const panelX = W / 2 - PANEL_W / 2;
    const panelY = H / 2 - PANEL_H / 2;
    this.buildWeaponGrid(panelX, panelY);
    this.buildItemGrid(panelX, panelY);
  }

  private updateCoinLabel(): void {
    if (this.coinLabel) this.coinLabel.setText(`🪙 ${this.ctx.player.coins}`);
  }

  // ── Close ─────────────────────────────────────────────────────────────────

  private closeInventory(): void {
    this.scene.stop();
    this.scene.resume(SCENES.GAME);
  }
}
