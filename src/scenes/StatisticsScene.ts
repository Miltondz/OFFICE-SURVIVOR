// src/scenes/StatisticsScene.ts
import Phaser from 'phaser';
import { SCENES, GAME, COLORS } from '@/config/game.config';
import { SceneManager } from '@/systems/SceneManager';
import { SaveManager } from '@/systems/SaveManager';
import { AudioManager } from '@/systems/AudioManager';
import { formatTime, formatTimeHMS } from '@/utils';

export class StatisticsScene extends Phaser.Scene {
  private audio = AudioManager.getInstance();

  constructor() {
    super({ key: SCENES.STATISTICS });
  }

  create(): void {
    const cx = GAME.WIDTH / 2;
    const save = SaveManager.load();

    this.add.rectangle(cx, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, COLORS.BG);

    this.add.text(cx, 40, 'ESTADÍSTICAS', {
      fontSize: '36px',
      color: COLORS.TEXT,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const stats: Array<[string, string]> = [
      ['Partidas jugadas', String(save.totalRuns)],
      ['Total de kills', String(save.totalKills)],
      ['Tiempo total jugado', formatTimeHMS(save.totalTimePlayed)],
      ['Jefes derrotados', String(save.bossesDefeated)],
      ['Monedas ganadas (total)', String(save.totalCoinsEarned)],
      ['Monedas disponibles', String(save.coins)],
    ];

    let y = 100;
    const labelX = cx - 200;
    const valueX = cx + 200;

    for (const [label, value] of stats) {
      this.add.text(labelX, y, label, { fontSize: '16px', color: COLORS.TEXT_MUTED }).setOrigin(0, 0.5);
      this.add.text(valueX, y, value, { fontSize: '16px', color: COLORS.TEXT }).setOrigin(1, 0.5);
      y += 30;
    }

    // Best run section
    y += 14;
    this.add.text(cx, y, 'MEJOR RUN', {
      fontSize: '20px',
      color: '#ffcc00',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    y += 32;

    const bestStats: Array<[string, string]> = [
      ['Tiempo', formatTime(save.bestRunTime)],
      ['Nivel máximo', String(save.bestLevel)],
      ['Kills en una run', String(save.bestKillsInRun)],
    ];
    for (const [label, value] of bestStats) {
      this.add.text(labelX, y, label, { fontSize: '16px', color: COLORS.TEXT_MUTED }).setOrigin(0, 0.5);
      this.add.text(valueX, y, value, { fontSize: '16px', color: COLORS.TEXT }).setOrigin(1, 0.5);
      y += 30;
    }

    // Export / Import buttons
    y += 20;
    this.makeButton(cx - 110, y, 'EXPORTAR', () => {
      this.audio.playBeep('click', 'ui');
      const encoded = SaveManager.export();
      const copied = this.tryCopyToClipboard(encoded);
      const msg = copied ? '¡Copiado al portapapeles!' : encoded;
      this.showToast(msg);
    });

    this.makeButton(cx + 110, y, 'IMPORTAR', () => {
      this.audio.playBeep('click', 'ui');
      const input = window.prompt('Pega tu save (base64):');
      if (input) {
        const ok = SaveManager.import(input.trim());
        this.showToast(ok ? '¡Save importado! Reinicia la escena.' : 'Error: save inválido.');
        if (ok) {
          // Reload scene to show updated stats
          SceneManager.go(this, SCENES.STATISTICS);
        }
      }
    });

    // Version
    this.add.text(GAME.WIDTH - 8, GAME.HEIGHT - 8, 'v0.1.0', {
      fontSize: '12px', color: COLORS.TEXT_MUTED,
    }).setOrigin(1, 1);

    // Back button
    this.makeButton(cx, GAME.HEIGHT - 36, 'VOLVER', () => {
      this.audio.playBeep('click', 'ui');
      SceneManager.go(this, SCENES.MAIN_MENU);
    });
  }

  private tryCopyToClipboard(text: string): boolean {
    if (navigator.clipboard) {
      void navigator.clipboard.writeText(text);
      return true;
    }
    return false;
  }

  private showToast(message: string): void {
    const cx = GAME.WIDTH / 2;
    const toast = this.add.text(cx, GAME.HEIGHT / 2, message, {
      fontSize: '14px',
      color: '#ffffff',
      backgroundColor: '#000000cc',
      padding: { x: 12, y: 8 },
      wordWrap: { width: GAME.WIDTH - 60 },
      align: 'center',
    }).setOrigin(0.5).setDepth(100);

    this.time.delayedCall(3000, () => {
      this.tweens.add({ targets: toast, alpha: 0, duration: 400, onComplete: () => toast.destroy() });
    });
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const BW = 200;
    const BH = 44;
    const bg = this.add.rectangle(x, y, BW, BH, COLORS.BUTTON).setInteractive({ useHandCursor: true });
    this.add.text(x, y, label, { fontSize: '18px', color: COLORS.TEXT }).setOrigin(0.5);
    bg.on('pointerover', () => bg.setFillStyle(COLORS.BUTTON_HOVER));
    bg.on('pointerout', () => bg.setFillStyle(COLORS.BUTTON));
    bg.on('pointerup', onClick);
  }
}
