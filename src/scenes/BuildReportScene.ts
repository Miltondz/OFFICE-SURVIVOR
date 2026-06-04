import Phaser from 'phaser';
import { SCENES, GAME, COLORS, BUILD_REPORT } from '@/config/game.config';
import { SceneManager } from '@/systems/SceneManager';
import { SaveManager } from '@/systems/SaveManager';
import { AudioManager } from '@/systems/AudioManager';
import { formatTime } from '@/utils';
import { getWeaponById, getItemById, ITEMS } from '@/config/items.config';
import { getCurseById } from '@/config/curses.config';
import type { RunStats } from '@/types';

const BTN_W = 220;
const BTN_H = 46;

const DEFAULT_STATS: RunStats = {
  kills: 0, timeSurvived: 0, coinsEarned: 0, maxLevel: 1, maxStress: 0, bossDefeated: false,
  damageBySource: {}, killsByWeapon: {}, longestWave: { wave: 0, enemies: 0 },
  itemsCollected: [], weaponsOwned: [], activeCurse: null, characterId: 'base',
};

/** Resolve a weapon/item id to its display name (falls back to the raw id). */
function nameOf(id: string): string {
  return getWeaponById(id)?.name ?? getItemById(id)?.name ?? getCurseById(id)?.name ?? id;
}

export class BuildReportScene extends Phaser.Scene {
  private stats: RunStats = DEFAULT_STATS;
  private victory = false;
  private audio = AudioManager.getInstance();

  constructor() {
    super({ key: SCENES.BUILD_REPORT });
  }

  init(data: { stats?: RunStats; victory?: boolean }): void {
    this.stats = data.stats ?? DEFAULT_STATS;
    this.victory = data.victory ?? false;
  }

  create(): void {
    // Persist run stats — once, at run end.
    SaveManager.save(SaveManager.updateRunStats(this.stats, SaveManager.load()));

    const cx = GAME.WIDTH / 2;
    const s = this.stats;

    this.add.rectangle(cx, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, this.victory ? 0x221100 : 0x110000);

    // Header
    this.add.text(40, 24, this.victory ? '¡VICTORIA!' : 'GAME OVER', {
      fontSize: '40px', color: this.victory ? '#ffdd00' : '#ff4444', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.add.text(GAME.WIDTH - 40, 24, `Tiempo: ${formatTime(s.timeSurvived)}`, {
      fontSize: '18px', color: COLORS.TEXT,
    }).setOrigin(1, 0.5);

    // ── Build summary ──
    let y = 64;
    this.add.text(40, y, '── Build ──', { fontSize: '16px', color: '#ffcc00' }).setOrigin(0, 0.5);
    y += 26;
    this.add.text(40, y, `Personaje: ${s.characterId}`, { fontSize: '14px', color: COLORS.TEXT }).setOrigin(0, 0.5);
    this.add.text(GAME.WIDTH - 40, y, `Nivel: ${s.maxLevel}    Estrés máx: ${Math.floor(s.maxStress)}`, {
      fontSize: '14px', color: COLORS.TEXT,
    }).setOrigin(1, 0.5);
    y += 30;

    // Top-3 damage sources
    this.add.text(40, y, 'Top fuentes de daño:', { fontSize: '14px', color: COLORS.TEXT_MUTED }).setOrigin(0, 0.5);
    y += 22;
    const sorted = Object.entries(s.damageBySource).sort((a, b) => b[1] - a[1]);
    const total = sorted.reduce((acc, [, v]) => acc + v, 0) || 1;
    const top = sorted.slice(0, BUILD_REPORT.TOP_DAMAGE_COUNT);
    if (top.length === 0) {
      this.add.text(56, y, '—', { fontSize: '13px', color: COLORS.TEXT_MUTED }).setOrigin(0, 0.5);
      y += 22;
    }
    top.forEach(([id, dmg], i) => {
      const pct = dmg / total;
      this.add.text(56, y, `${i + 1}. ${nameOf(id)}`, { fontSize: '13px', color: COLORS.TEXT }).setOrigin(0, 0.5);
      this.add.rectangle(300, y, BUILD_REPORT.BAR_MAX_W, BUILD_REPORT.BAR_H, 0x333333).setOrigin(0, 0.5);
      this.add.rectangle(300, y, BUILD_REPORT.BAR_MAX_W * pct, BUILD_REPORT.BAR_H, 0x4488ff).setOrigin(0, 0.5);
      this.add.text(300 + BUILD_REPORT.BAR_MAX_W + 10, y, `${Math.round(pct * 100)}%`, {
        fontSize: '12px', color: COLORS.TEXT,
      }).setOrigin(0, 0.5);
      y += 24;
    });

    // Top-kill weapon + longest wave + curse
    y += 6;
    const killEntries = Object.entries(s.killsByWeapon).sort((a, b) => b[1] - a[1]);
    const topKill = killEntries[0];
    this.add.text(40, y, `Arma con más kills: ${topKill ? `${nameOf(topKill[0])} — ${topKill[1]}` : '—'}`, {
      fontSize: '13px', color: COLORS.TEXT,
    }).setOrigin(0, 0.5);
    y += 22;
    this.add.text(40, y, `Oleada más larga: Oleada ${s.longestWave.wave} — ${s.longestWave.enemies} enemigos`, {
      fontSize: '13px', color: COLORS.TEXT,
    }).setOrigin(0, 0.5);
    y += 22;
    this.add.text(40, y, `Maldición activa: ${s.activeCurse ? nameOf(s.activeCurse) : '—'}`, {
      fontSize: '13px', color: COLORS.TEXT,
    }).setOrigin(0, 0.5);
    y += 30;

    // ── Items chips ──
    this.add.text(40, y, '── Ítems de esta run ──', { fontSize: '14px', color: '#ffcc00' }).setOrigin(0, 0.5);
    y += 24;
    const uniqueItems = [...new Set([...s.weaponsOwned, ...s.itemsCollected])];
    let chipX = 40;
    let chipY = y;
    for (const id of uniqueItems) {
      if (chipX + BUILD_REPORT.CHIP_W > GAME.WIDTH - 40) { chipX = 40; chipY += BUILD_REPORT.CHIP_H + 6; }
      this.add.rectangle(chipX, chipY, BUILD_REPORT.CHIP_W, BUILD_REPORT.CHIP_H, 0x2a2a3a).setOrigin(0, 0.5);
      this.add.text(chipX + 6, chipY, nameOf(id), { fontSize: '10px', color: COLORS.TEXT })
        .setOrigin(0, 0.5).setWordWrapWidth(BUILD_REPORT.CHIP_W - 12);
      chipX += BUILD_REPORT.CHIP_W + 6;
    }
    y = chipY + 28;

    // Synergy line: owned items whose synergyWith intersects the owned set
    const owned = new Set(uniqueItems);
    const synergyPairs: string[] = [];
    for (const id of uniqueItems) {
      const def = ITEMS.find(it => it.id === id);
      if (!def?.synergyWith) continue;
      for (const partner of def.synergyWith) {
        if (owned.has(partner)) synergyPairs.push(`${def.name} + ${nameOf(partner)}`);
      }
    }
    if (synergyPairs.length > 0) {
      this.add.text(40, y, `✦ Sinergia: ${[...new Set(synergyPairs)].join(', ')}`, {
        fontSize: '12px', color: '#66ff66', wordWrap: { width: GAME.WIDTH - 80 },
      }).setOrigin(0, 0.5);
    }

    // Buttons
    this.makeButton(cx - BTN_W / 2 - 12, GAME.HEIGHT - 36, 'JUGAR DE NUEVO', () => {
      this.audio.playBeep('click', 'ui');
      SceneManager.go(this, SCENES.GAME);
    });
    this.makeButton(cx + BTN_W / 2 + 12, GAME.HEIGHT - 36, 'MENÚ PRINCIPAL', () => {
      this.audio.playBeep('click', 'ui');
      SceneManager.go(this, SCENES.MAIN_MENU);
    });
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, BTN_W, BTN_H, COLORS.BUTTON).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontSize: '16px', color: COLORS.TEXT }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(COLORS.BUTTON_HOVER));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.BUTTON));
    bg.on('pointerup', onClick);
  }
}
