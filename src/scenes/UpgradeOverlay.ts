import Phaser from 'phaser';
import { SCENES, GAME, COLORS, CURSES } from '@/config/game.config';
import type { RunContext } from '@/systems/RunContext';
import type { ItemDefinition, WeaponDefinition } from '@/types';
import { UpgradePool } from '@/systems/UpgradePool';
import { applyItemPickup } from '@/systems/ItemReactions';
import { recomputeModifiers } from '@/systems/RunContext';
import { AudioManager } from '@/systems/AudioManager';
import { CURSE_LIST, applyCurse } from '@/config/curses.config';

const RARITY_COLORS: Record<string, string> = {
  common: '#aaaaaa',
  rare: '#4488ff',
  epic: '#aa44ff',
  legendary: '#ffaa00',
};
const RARITY_FILL: Record<string, number> = {
  common: 0x333333,
  rare: 0x112244,
  epic: 0x220033,
  legendary: 0x332200,
};
const RARITY_BORDER: Record<string, number> = {
  common: 0xaaaaaa,
  rare: 0x4488ff,
  epic: 0xaa44ff,
  legendary: 0xffaa00,
};

const CARD_W = 200;
const CARD_H = 160;
const CARD_GAP = 20;
const CARD_SCALE_HOVER = 1.05;
const CARD_SCALE_CLICK = 0.95;

export class UpgradeOverlay extends Phaser.Scene {
  private ctx!: RunContext;
  private onDone!: () => void;
  private optionCount = 3;
  private weaponsOnly = false;
  private audio = AudioManager.getInstance();

  constructor() {
    super({ key: SCENES.UPGRADE_OVERLAY });
  }

  init(data: { ctx: RunContext; optionCount: number; weaponsOnly?: boolean; onDone: () => void }): void {
    this.ctx = data.ctx;
    this.optionCount = data.optionCount ?? 3;
    this.weaponsOnly = data.weaponsOnly ?? false;
    this.onDone = data.onDone;
  }

  create(): void {
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    // Semi-transparent overlay
    this.add.rectangle(cx, cy, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0.75);

    const title = this.weaponsOnly ? 'ELIGE TU ARMA INICIAL' : `SUBISTE A NIVEL ${this.ctx.player.level}`;
    this.add.text(cx, cy - 170, title, {
      fontSize: '28px', color: '#ffff00', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(cx, cy - 136, this.weaponsOnly ? 'Con qué empiezas:' : 'Elige una mejora:', {
      fontSize: '16px', color: COLORS.TEXT,
    }).setOrigin(0.5);

    const pool = new UpgradePool();
    const options = pool.pick(
      this.ctx.player, this.ctx.modifiers, this.optionCount,
      this.ctx.weaponLevels, this.weaponsOnly, this.ctx.character.noEpicLegendaryWeapons ?? false,
      this.ctx.curseForbidCommon,
    );

    if (options.length === 0) {
      this.add.text(cx, cy, 'No hay mejoras disponibles.', {
        fontSize: '20px', color: COLORS.TEXT,
      }).setOrigin(0.5);
      this.scene.stop();
      this.scene.resume(SCENES.GAME);
      this.onDone();
      return;
    }

    // Mejora 4: inject a curse beside a legendary (level ≥ MIN, none active yet, ≥1 normal remains).
    if (!this.ctx.curseId && !this.weaponsOnly
      && this.ctx.player.level >= CURSES.MIN_LEVEL
      && options.some(o => o.rarity === 'legendary')) {
      const idx = options.findIndex(o => o.rarity !== 'legendary');
      if (idx >= 0) {
        options[idx] = CURSE_LIST[Math.floor(Math.random() * CURSE_LIST.length)];
      }
    }

    const totalW = options.length * CARD_W + (options.length - 1) * CARD_GAP;
    const startX = cx - totalW / 2 + CARD_W / 2;

    // Collect owned weapon/item ids for synergy check
    const ownedIds = new Set([...this.ctx.player.weapons, ...this.ctx.player.items]);

    options.forEach((option, i) => {
      const isWeapon = !('category' in option);
      const itemDef = option as ItemDefinition;
      const weaponDef = option as WeaponDefinition;
      const isCurse = !isWeapon && itemDef.isCurse === true;
      const rarity = option.rarity;
      const cardX = startX + i * (CARD_W + CARD_GAP);

      // Container for easy scale animation
      const container = this.add.container(cardX, cy);

      const fillColor = isCurse ? 0x1a0000 : (RARITY_FILL[rarity] ?? 0x333333);
      const borderColor = isCurse ? 0x000000 : (RARITY_BORDER[rarity] ?? 0xaaaaaa);

      const card = this.add.rectangle(0, 0, CARD_W, CARD_H, fillColor)
        .setStrokeStyle(isCurse ? 3 : 2, borderColor);
      container.add(card);

      // Rarity / curse label
      const rarityLabel = this.add.text(0, -CARD_H / 2 + 14, isCurse ? '⚠ MALDICIÓN' : rarity.toUpperCase(), {
        fontSize: '10px', color: isCurse ? '#ff3333' : (RARITY_COLORS[rarity] ?? '#ffffff'),
      }).setOrigin(0.5);
      container.add(rarityLabel);

      // Name
      const name = this.add.text(0, -CARD_H / 2 + 36, option.name, {
        fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
        wordWrap: { width: CARD_W - 16 }, align: 'center',
      }).setOrigin(0.5);
      container.add(name);

      // Type badge
      const badge = isWeapon ? '[ARMA]' : `[${itemDef.category.toUpperCase()}]`;
      const badgeText = this.add.text(0, -CARD_H / 2 + 60, badge, {
        fontSize: '10px', color: '#999999',
      }).setOrigin(0.5);
      container.add(badgeText);

      // Description
      const desc = isWeapon ? weaponDef.description : itemDef.description;
      const descText = this.add.text(0, -CARD_H / 2 + 82, desc, {
        fontSize: '11px', color: isCurse ? '#ff8888' : '#cccccc',
        wordWrap: { width: CARD_W - 16 }, align: 'center',
      }).setOrigin(0.5);
      container.add(descText);

      // Curse power (positive half)
      if (isCurse && itemDef.cursePower) {
        container.add(this.add.text(0, CARD_H / 2 - 30, itemDef.cursePower, {
          fontSize: '10px', color: '#66ff66',
          wordWrap: { width: CARD_W - 16 }, align: 'center',
        }).setOrigin(0.5));
      }

      // Tags line (not shown for curses — power line occupies that row)
      const tags = option.tags ?? [];
      if (!isCurse && tags.length > 0) {
        const tagsText = this.add.text(0, CARD_H / 2 - 30, tags.map(t => `#${t}`).join(' '), {
          fontSize: '9px', color: '#777777',
          wordWrap: { width: CARD_W - 16 }, align: 'center',
        }).setOrigin(0.5);
        container.add(tagsText);
      }

      // Synergy mark
      const synergy = !isWeapon ? (itemDef.synergyWith ?? []) : [];
      const hasSynergy = synergy.some(id => ownedIds.has(id));
      if (hasSynergy) {
        const synergyMark = this.add.text(0, CARD_H / 2 - 14, '✦ sinergia', {
          fontSize: '10px', color: '#66ff66',
        }).setOrigin(0.5);
        container.add(synergyMark);
      }

      // Make interactive via a hitzone
      const hitZone = this.add.rectangle(0, 0, CARD_W, CARD_H, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      container.add(hitZone);

      // Hover animations
      hitZone.on('pointerover', () => {
        this.tweens.add({ targets: container, scaleX: CARD_SCALE_HOVER, scaleY: CARD_SCALE_HOVER, duration: 80, ease: 'Cubic.Out' });
        card.setStrokeStyle(3, 0xffffff);
      });
      hitZone.on('pointerout', () => {
        this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80, ease: 'Cubic.Out' });
        card.setStrokeStyle(2, borderColor);
      });

      hitZone.on('pointerup', () => {
        this.audio.playBeep('click', 'ui');
        // Click scale: 1.05 → 0.95
        this.tweens.add({
          targets: container,
          scaleX: CARD_SCALE_CLICK,
          scaleY: CARD_SCALE_CLICK,
          duration: 80,
          ease: 'Cubic.In',
          onComplete: () => {
            this.selectOption(option, isWeapon);
          },
        });
      });
    });
  }

  private selectOption(option: ItemDefinition | WeaponDefinition, isWeapon: boolean): void {
    if (isWeapon) {
      const weaponDef = option as WeaponDefinition;
      this.ctx.bus.emit('upgrade:weapon_selected', { id: weaponDef.id });
    } else if ((option as ItemDefinition).isCurse) {
      applyCurse(this.ctx, option.id);
      recomputeModifiers(this.ctx);
      this.ctx.bus.emit('curse:applied', { id: option.id });
    } else {
      const itemDef = option as ItemDefinition;
      applyItemPickup(this.ctx, itemDef);
      recomputeModifiers(this.ctx);
      this.ctx.bus.emit('upgrade:item_selected', { id: itemDef.id });
    }

    this.scene.stop();
    this.scene.resume(SCENES.GAME);
    this.onDone();
  }
}
