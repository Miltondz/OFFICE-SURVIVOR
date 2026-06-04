// src/scenes/UpgradeScene.ts
import Phaser from 'phaser';
import { SCENES, GAME, COLORS } from '@/config/game.config';
import { SceneManager } from '@/systems/SceneManager';
import { AudioManager } from '@/systems/AudioManager';
import { SaveManager } from '@/systems/SaveManager';
import { META_UPGRADES } from '@/config/meta.config';
import type { SaveData } from '@/types';

const CARD_W = 260;
const CARD_H = 150;
const CARD_GAP_X = 20;
const CARD_GAP_Y = 16;
const COLS = 3;

export class UpgradeScene extends Phaser.Scene {
  private audio = AudioManager.getInstance();

  // Live-updated UI refs per upgrade card
  private levelTexts: Phaser.GameObjects.Text[] = [];
  private costTexts: Phaser.GameObjects.Text[] = [];
  private buyBtns: Phaser.GameObjects.Rectangle[] = [];
  private buyBtnLabels: Phaser.GameObjects.Text[] = [];
  private coinsText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENES.UPGRADE });
  }

  create(): void {
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    this.add.rectangle(cx, cy, GAME.WIDTH, GAME.HEIGHT, COLORS.BG);

    this.add.text(cx, 24, 'MEJORAS PERMANENTES', {
      fontSize: '30px',
      color: COLORS.TEXT,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const save = SaveManager.load();

    // Coin wallet display
    this.coinsText = this.add.text(cx, 54, `Monedas: ${save.coins}`, {
      fontSize: '18px',
      color: '#ffd700',
    }).setOrigin(0.5);

    // Grid of meta-upgrade cards
    const gridW = COLS * CARD_W + (COLS - 1) * CARD_GAP_X;
    const gridStartX = cx - gridW / 2 + CARD_W / 2;
    const gridStartY = 80;

    META_UPGRADES.forEach((upgrade, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cardX = gridStartX + col * (CARD_W + CARD_GAP_X);
      const cardY = gridStartY + row * (CARD_H + CARD_GAP_Y) + CARD_H / 2;

      const level = save.metaUpgrades[upgrade.id] ?? 0;
      const atMax = level >= upgrade.maxLevel;
      const nextCost = atMax ? 0 : upgrade.costPerLevel[level];
      const canBuy = !atMax && save.coins >= nextCost;

      // Card background
      this.add.rectangle(cardX, cardY, CARD_W, CARD_H, 0x1a1a2e)
        .setStrokeStyle(1, 0x444466);

      // Name
      this.add.text(cardX, cardY - CARD_H / 2 + 16, upgrade.name, {
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
        wordWrap: { width: CARD_W - 16 }, align: 'center',
      }).setOrigin(0.5);

      // Description
      this.add.text(cardX, cardY - CARD_H / 2 + 40, upgrade.description, {
        fontSize: '11px', color: '#aaaacc',
        wordWrap: { width: CARD_W - 16 }, align: 'center',
      }).setOrigin(0.5);

      // Level: X/max (stored for live update)
      const lvlText = this.add.text(cardX - 60, cardY + CARD_H / 2 - 58, `Nivel: ${level}/${upgrade.maxLevel}`, {
        fontSize: '11px', color: COLORS.TEXT_MUTED,
      }).setOrigin(0, 0.5);
      this.levelTexts[i] = lvlText;

      // Cost (stored for live update)
      const costLabel = atMax ? 'MÁX' : `🪙 ${nextCost}`;
      const costTxt = this.add.text(cardX + 20, cardY + CARD_H / 2 - 58, costLabel, {
        fontSize: '11px', color: atMax ? '#44ff88' : '#ffd700',
      }).setOrigin(0, 0.5);
      this.costTexts[i] = costTxt;

      // Buy button
      const btnW = CARD_W - 24;
      const btnH = 28;
      const btnY = cardY + CARD_H / 2 - 20;
      const btnColor = canBuy ? COLORS.BUTTON : (atMax ? 0x224422 : 0x222233);
      const btn = this.add.rectangle(cardX, btnY, btnW, btnH, btnColor)
        .setStrokeStyle(1, canBuy ? 0x6666cc : 0x444455);
      if (canBuy) btn.setInteractive({ useHandCursor: true });
      this.buyBtns[i] = btn;

      const btnLabel = atMax ? 'MÁX' : 'COMPRAR';
      const btnTxtColor = canBuy ? COLORS.TEXT : COLORS.TEXT_MUTED;
      const btnTxt = this.add.text(cardX, btnY, btnLabel, {
        fontSize: '12px', color: btnTxtColor,
      }).setOrigin(0.5);
      this.buyBtnLabels[i] = btnTxt;

      if (canBuy) {
        btn.on('pointerover', () => btn.setFillStyle(COLORS.BUTTON_HOVER));
        btn.on('pointerout', () => btn.setFillStyle(btnColor));
        btn.on('pointerup', () => {
          this.audio.playBeep('click', 'ui');
          this.onBuy(i);
        });
      }
    });

    // Back button
    this.makeButton(cx, GAME.HEIGHT - 28, 'VOLVER', () => {
      this.audio.playBeep('click', 'ui');
      SceneManager.go(this, SCENES.MAIN_MENU);
    });
  }

  /** Handle purchase of meta upgrade at index i. Refreshes UI in place. */
  private onBuy(index: number): void {
    const upgrade = META_UPGRADES[index];
    const save: SaveData = SaveManager.load();
    const level = save.metaUpgrades[upgrade.id] ?? 0;
    if (level >= upgrade.maxLevel) return;
    const cost = upgrade.costPerLevel[level];
    if (save.coins < cost) return;

    // Apply purchase
    save.metaUpgrades[upgrade.id] = level + 1;
    save.coins -= cost;
    SaveManager.save(save);

    // Refresh wallet display
    this.coinsText.setText(`Monedas: ${save.coins}`);

    // Refresh this card's UI
    const newLevel = level + 1;
    const atMax = newLevel >= upgrade.maxLevel;
    const nextCost = atMax ? 0 : upgrade.costPerLevel[newLevel];
    const canBuy = !atMax && save.coins >= nextCost;

    this.levelTexts[index].setText(`Nivel: ${newLevel}/${upgrade.maxLevel}`);
    this.costTexts[index].setText(atMax ? 'MÁX' : `🪙 ${nextCost}`);
    this.costTexts[index].setColor(atMax ? '#44ff88' : '#ffd700');

    const btn = this.buyBtns[index];
    const lbl = this.buyBtnLabels[index];

    // Disable old listeners before replacing
    btn.removeAllListeners();
    btn.disableInteractive();

    if (atMax) {
      btn.setFillStyle(0x224422).setStrokeStyle(1, 0x444455);
      lbl.setText('MÁX').setColor(COLORS.TEXT_MUTED);
    } else if (canBuy) {
      btn.setFillStyle(COLORS.BUTTON).setStrokeStyle(1, 0x6666cc);
      btn.setInteractive({ useHandCursor: true });
      lbl.setText('COMPRAR').setColor(COLORS.TEXT);
      btn.on('pointerover', () => btn.setFillStyle(COLORS.BUTTON_HOVER));
      btn.on('pointerout', () => btn.setFillStyle(COLORS.BUTTON));
      btn.on('pointerup', () => {
        this.audio.playBeep('click', 'ui');
        this.onBuy(index);
      });
    } else {
      btn.setFillStyle(0x222233).setStrokeStyle(1, 0x444455);
      lbl.setText('COMPRAR').setColor(COLORS.TEXT_MUTED);
    }

    // Also refresh all other buttons in case coin change made them affordable/unaffordable
    this.refreshAllButtons(save);
  }

  /** Re-evaluate enabled/disabled state of all buy buttons after a coin change. */
  private refreshAllButtons(save: SaveData): void {
    META_UPGRADES.forEach((upgrade, i) => {
      const level = save.metaUpgrades[upgrade.id] ?? 0;
      const atMax = level >= upgrade.maxLevel;
      if (atMax) return; // already handled in onBuy

      const nextCost = upgrade.costPerLevel[level];
      const canBuy = save.coins >= nextCost;
      const btn = this.buyBtns[i];
      const lbl = this.buyBtnLabels[i];

      btn.removeAllListeners();
      btn.disableInteractive();

      if (canBuy) {
        btn.setFillStyle(COLORS.BUTTON).setStrokeStyle(1, 0x6666cc);
        btn.setInteractive({ useHandCursor: true });
        lbl.setColor(COLORS.TEXT);
        btn.on('pointerover', () => btn.setFillStyle(COLORS.BUTTON_HOVER));
        btn.on('pointerout', () => btn.setFillStyle(COLORS.BUTTON));
        btn.on('pointerup', () => {
          this.audio.playBeep('click', 'ui');
          this.onBuy(i);
        });
      } else {
        btn.setFillStyle(0x222233).setStrokeStyle(1, 0x444455);
        lbl.setColor(COLORS.TEXT_MUTED);
      }
    });
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void,
  ): void {
    const BW = 200;
    const BH = 44;
    const bg = this.add.rectangle(x, y, BW, BH, COLORS.BUTTON).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontSize: '18px', color: COLORS.TEXT }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(COLORS.BUTTON_HOVER));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.BUTTON));
    bg.on('pointerup', onClick);
  }
}
