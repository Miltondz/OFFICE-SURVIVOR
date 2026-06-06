import Phaser from 'phaser';
import { SCENES, GAME, COLORS, CURSES } from '@/config/game.config';
import type { RunContext } from '@/systems/RunContext';
import type { ItemDefinition, WeaponDefinition } from '@/types';
import { UpgradePool } from '@/systems/UpgradePool';
import { applyItemPickup } from '@/systems/ItemReactions';
import { recomputeModifiers } from '@/systems/RunContext';
import { AudioManager } from '@/systems/AudioManager';
import { CURSE_LIST, applyCurse } from '@/config/curses.config';
import { iconKey } from '@/config/icons.config';
import { makePanel, panelColorByRarity } from '@/systems/ui/Panel';
import { pickPlayerUpgrades } from '@/config/playerUpgrades.config';
import type { PlayerUpgrade } from '@/config/playerUpgrades.config';

const RARITY_COLORS: Record<string, string> = {
  common: '#aaaaaa',
  rare: '#4488ff',
  epic: '#aa44ff',
  legendary: '#ffaa00',
};

const CARD_GAP = 18;
const CARD_SCALE_HOVER = 1.05;
const CARD_SCALE_CLICK = 0.95;

export class UpgradeOverlay extends Phaser.Scene {
  private ctx!: RunContext;
  private onDone!: () => void;
  private optionCount = 3;
  private weaponsOnly = false;
  private playerUpgradeMode = false;
  private audio = AudioManager.getInstance();

  constructor() {
    super({ key: SCENES.UPGRADE_OVERLAY });
  }

  init(data: {
    ctx: RunContext;
    optionCount: number;
    weaponsOnly?: boolean;
    playerUpgradeMode?: boolean;
    onDone: () => void;
  }): void {
    this.ctx = data.ctx;
    this.optionCount = data.optionCount ?? 3;
    this.weaponsOnly = data.weaponsOnly ?? false;
    this.playerUpgradeMode = data.playerUpgradeMode ?? false;
    this.onDone = data.onDone;
  }

  create(): void {
    if (this.playerUpgradeMode) {
      this.buildPlayerUpgradeUI();
    } else {
      this.buildItemWeaponUI();
    }
  }

  // ─── §7.2 Player stat upgrade UI ────────────────────────────────────────────

  private buildPlayerUpgradeUI(): void {
    const cx = GAME.WIDTH / 2;

    // Semi-transparent overlay
    this.add.rectangle(cx, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0.75);

    // Opaque top strip to cover HUD timer/wave text (Ticket 3.3)
    this.add.rectangle(cx, 20, GAME.WIDTH, 40, 0x000000, 1).setDepth(9);

    // Title and subtitle pushed below HUD strip (Ticket 3.3 — era y:30/60)
    this.add.text(cx, 50, `SUBISTE A NIVEL ${this.ctx.player.level}`, {
      fontSize: '26px', color: '#ffff00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.add.text(cx, 82, 'Elige una mejora de personaje:', {
      fontSize: '15px', color: COLORS.TEXT,
    }).setOrigin(0.5).setDepth(10);

    const options = pickPlayerUpgrades(this.optionCount);

    if (options.length === 0) {
      this.closeAndResume();
      return;
    }

    const cardW = 148;
    const cardH = 130;
    const cardsCY = 116 + cardH / 2;  // era 96 — shifted down to clear HUD strip (Ticket 3.3)
    const totalW = options.length * cardW + (options.length - 1) * CARD_GAP;
    const startX = cx - totalW / 2;

    options.forEach((upgrade, i) => {
      const cardX = startX + i * (cardW + CARD_GAP);
      this.buildPlayerUpgradeCard(cardX, cardsCY, cardW, cardH, upgrade);
    });
  }

  private buildPlayerUpgradeCard(
    x: number, y: number,
    w: number, h: number,
    upgrade: PlayerUpgrade,
  ): void {
    const panel = makePanel(this, x, y, w, h, {
      baseColor: 0x1a2233,
      borderColor: 0x5588ff,
      depth: 10,
    });

    const cx = w / 2;

    // Header badge
    panel.add(this.add.text(cx, 10, 'PERSONAJE', {
      fontSize: '9px', color: '#88aaff',
    }).setOrigin(0.5, 0));

    // Name
    panel.add(this.add.text(cx, 28, upgrade.name, {
      fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      wordWrap: { width: w - 12 }, align: 'center',
    }).setOrigin(0.5, 0));

    // Description
    panel.add(this.add.text(cx, 56, upgrade.desc, {
      fontSize: '10px', color: '#bbccff',
      wordWrap: { width: w - 12 }, align: 'center', lineSpacing: 1,
    }).setOrigin(0.5, 0));

    // Invisible hit zone
    const hit = this.add.rectangle(cx, h / 2, w, h, 0x000000, 0).setInteractive({ useHandCursor: true });
    panel.add(hit);

    hit.on('pointerover', () => {
      this.tweens.add({ targets: panel, scaleX: CARD_SCALE_HOVER, scaleY: CARD_SCALE_HOVER, duration: 80, ease: 'Cubic.Out' });
    });
    hit.on('pointerout', () => {
      this.tweens.add({ targets: panel, scaleX: 1, scaleY: 1, duration: 80, ease: 'Cubic.Out' });
    });
    hit.on('pointerup', () => {
      this.audio.playBeep('click', 'ui');
      this.tweens.add({
        targets: panel,
        scaleX: CARD_SCALE_CLICK, scaleY: CARD_SCALE_CLICK,
        duration: 80, ease: 'Cubic.In',
        onComplete: () => { this.selectPlayerUpgrade(upgrade); },
      });
    });
  }

  private selectPlayerUpgrade(upgrade: PlayerUpgrade): void {
    // Aplica al instante (player + modifiers) y registra el id para reaplicar su parte de
    // modifiers en cada recomputeModifiers (si no, comprar ítems/armas los borraría).
    upgrade.apply(this.ctx.player, this.ctx.modifiers);
    this.ctx.playerUpgradeIds.push(upgrade.id);
    this.ctx.bus.emit('playerUpgrade:selected', { id: upgrade.id });
    this.closeAndResume();
  }

  // ─── Existing item/weapon upgrade UI ────────────────────────────────────────

  private buildItemWeaponUI(): void {
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    // Semi-transparent overlay
    this.add.rectangle(cx, cy, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0.75);

    // Opaque top strip to cover HUD timer/wave text (Ticket 3.3)
    this.add.rectangle(cx, 20, GAME.WIDTH, 40, 0x000000, 1).setDepth(9);

    const title = this.weaponsOnly ? 'ELIGE TU ARMA INICIAL' : `SUBISTE A NIVEL ${this.ctx.player.level}`;
    // Title and subtitle pushed below HUD strip (Ticket 3.3 — era y:30/60)
    this.add.text(cx, 50, title, {
      fontSize: '26px', color: '#ffff00', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(10);

    this.add.text(cx, 82, this.weaponsOnly ? 'Con qué empiezas:' : 'Elige una mejora:', {
      fontSize: '15px', color: COLORS.TEXT,
    }).setOrigin(0.5).setDepth(10);

    const pool = new UpgradePool();
    const forbidHighRarity = this.weaponsOnly || (this.ctx.character.noEpicLegendaryWeapons ?? false);
    const options = pool.pick(
      this.ctx.player, this.ctx.modifiers, this.optionCount,
      this.ctx.weaponLevels, this.weaponsOnly, forbidHighRarity,
      this.ctx.curseForbidCommon,
    );

    if (options.length === 0) {
      this.closeAndResume();
      return;
    }

    // Mejora 4: inject a curse beside a legendary
    if (!this.ctx.curseId && !this.weaponsOnly
      && this.ctx.player.level >= CURSES.MIN_LEVEL
      && options.some(o => o.rarity === 'legendary')) {
      const idx = options.findIndex(o => o.rarity !== 'legendary');
      if (idx >= 0) {
        options[idx] = CURSE_LIST[Math.floor(Math.random() * CURSE_LIST.length)];
      }
    }

    const cardW = options.length <= 3 ? 148 : 110;
    const iconSize = cardW - 10;
    const TEXT_BLOCK = 74;
    const cardH = 16 + iconSize + TEXT_BLOCK;
    const wrapW = cardW - 12;
    const top = -cardH / 2;
    const cardsCY = 116 + cardH / 2;  // era 96 — shifted down to clear HUD strip (Ticket 3.3)
    const totalW = options.length * cardW + (options.length - 1) * CARD_GAP;
    const startX = cx - totalW / 2 + cardW / 2;

    const ownedIds = new Set([...this.ctx.player.weapons, ...this.ctx.player.items]);

    options.forEach((option, i) => {
      const isWeapon = !('category' in option);
      const itemDef = option as ItemDefinition;
      const weaponDef = option as WeaponDefinition;
      const isCurse = !isWeapon && itemDef.isCurse === true;
      const rarity = option.rarity;
      const cardX = startX + i * (cardW + CARD_GAP);

      const container = this.add.container(cardX, cardsCY);

      const { baseColor, borderColor } = isCurse
        ? { baseColor: 0x1a0000, borderColor: 0x880000 }
        : panelColorByRarity(rarity);

      // Use Panel helper (§7.1)
      const panel = makePanel(this, -cardW / 2, -cardH / 2, cardW, cardH, {
        baseColor,
        borderColor,
        depth: 10,
      });
      container.add(panel);

      // Rareza / maldición (franja superior)
      container.add(this.add.text(0, top + 8, isCurse ? '⚠ MALDICIÓN' : rarity.toUpperCase(), {
        fontSize: '9px', color: isCurse ? '#ff3333' : (RARITY_COLORS[rarity] ?? '#ffffff'),
      }).setOrigin(0.5));

      // Icono
      const ikey = iconKey(option.id);
      const iconY = top + 16 + iconSize / 2;
      if (this.textures.exists(ikey)) {
        container.add(this.add.image(0, iconY, ikey).setDisplaySize(iconSize, iconSize).setOrigin(0.5));
      } else {
        container.add(this.add.rectangle(0, iconY, iconSize, iconSize, 0x000000, 0.25).setStrokeStyle(1, borderColor));
        container.add(this.add.text(0, iconY, isWeapon ? '⚔' : '◆', { fontSize: '40px', color: '#556' }).setOrigin(0.5));
      }

      // Text block
      let ty = top + 16 + iconSize + 6;
      const name = this.add.text(0, ty, option.name, {
        fontSize: cardW <= 120 ? '11px' : '13px', color: '#ffffff', fontStyle: 'bold',
        wordWrap: { width: wrapW }, align: 'center',
      }).setOrigin(0.5, 0);
      container.add(name);
      ty += name.height + 2;

      const tipo = this.add.text(0, ty, isWeapon ? 'ARMA' : itemDef.category.toUpperCase(), {
        fontSize: '8px', color: '#8a8aa0',
      }).setOrigin(0.5, 0);
      container.add(tipo);
      ty += tipo.height + 2;

      const desc = this.add.text(0, ty, isWeapon ? weaponDef.description : itemDef.description, {
        fontSize: '9px', color: isCurse ? '#ff9a9a' : '#cfcfe0',
        wordWrap: { width: wrapW }, align: 'center', lineSpacing: 1,
      }).setOrigin(0.5, 0);
      container.add(desc);
      ty += desc.height + 2;

      if (isCurse && itemDef.cursePower) {
        container.add(this.add.text(0, ty, itemDef.cursePower, {
          fontSize: '9px', color: '#66ff66', wordWrap: { width: wrapW }, align: 'center',
        }).setOrigin(0.5, 0));
      } else {
        const synergy = !isWeapon ? (itemDef.synergyWith ?? []) : [];
        if (synergy.some(id => ownedIds.has(id))) {
          container.add(this.add.text(0, ty, '✦ sinergia', { fontSize: '9px', color: '#66ff66' }).setOrigin(0.5, 0));
        }
      }

      // Hitzone
      const hitZone = this.add.rectangle(0, 0, cardW, cardH, 0x000000, 0)
        .setInteractive({ useHandCursor: true });
      container.add(hitZone);

      hitZone.on('pointerover', () => {
        this.tweens.add({ targets: container, scaleX: CARD_SCALE_HOVER, scaleY: CARD_SCALE_HOVER, duration: 80, ease: 'Cubic.Out' });
      });
      hitZone.on('pointerout', () => {
        this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80, ease: 'Cubic.Out' });
      });

      hitZone.on('pointerup', () => {
        this.audio.playBeep('click', 'ui');
        this.tweens.add({
          targets: container,
          scaleX: CARD_SCALE_CLICK, scaleY: CARD_SCALE_CLICK,
          duration: 80, ease: 'Cubic.In',
          onComplete: () => { this.selectOption(option, isWeapon); },
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
    this.closeAndResume();
  }

  private closeAndResume(): void {
    this.scene.stop();
    this.scene.resume(SCENES.GAME);
    this.onDone();
  }
}
