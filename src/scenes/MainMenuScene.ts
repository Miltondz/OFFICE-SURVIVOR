import Phaser from 'phaser';
import { SCENES, GAME, COLORS } from '@/config/game.config';
import { SceneManager } from '@/systems/SceneManager';
import { AudioManager } from '@/systems/AudioManager';
import { SaveManager } from '@/systems/SaveManager';
import { CHARACTERS } from '@/config/characters.config';
import { formatTime } from '@/utils';

const BUTTON_W = 240;
const BUTTON_H = 52;
const BUTTON_GAP = 14;

export class MainMenuScene extends Phaser.Scene {
  private audio = AudioManager.getInstance();

  constructor() {
    super({ key: SCENES.MAIN_MENU });
  }

  create(): void {
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    // Background
    this.add.rectangle(cx, cy, GAME.WIDTH, GAME.HEIGHT, COLORS.BG);

    // Title
    this.add.text(cx, cy - 175, 'OFFICE SURVIVOR', {
      fontSize: '52px',
      color: COLORS.TEXT,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(cx, cy - 115, 'Sobrevive la jornada laboral', {
      fontSize: '18px',
      color: COLORS.TEXT_MUTED,
    }).setOrigin(0.5);

    const save = SaveManager.load();
    const hasRuns = save.totalRuns > 0;
    const hasBestRun = save.bestRunTime > 0;

    // Best run display
    if (hasBestRun) {
      this.add.text(cx, cy - 82, `Mejor run: ${save.totalKills > 0 ? save.totalKills : '?'} kills en ${formatTime(save.bestRunTime)}`, {
        fontSize: '14px',
        color: '#ffcc00',
      }).setOrigin(0.5);
    }

    const startY = cy - 32;

    this.makeButton(cx, startY, 'JUGAR', true, () => {
      this.audio.resume();
      this.audio.playBeep('click', 'ui');
      this.showCharacterSelect();
    });

    this.makeButton(cx, startY + BUTTON_H + BUTTON_GAP, 'MEJORAS', true, () => {
      this.audio.playBeep('click', 'ui');
      SceneManager.go(this, SCENES.UPGRADE);
    });

    this.makeButton(cx, startY + (BUTTON_H + BUTTON_GAP) * 2, 'ESTADÍSTICAS', hasRuns, () => {
      this.audio.playBeep('click', 'ui');
      SceneManager.go(this, SCENES.STATISTICS);
    });

    this.makeButton(cx, startY + (BUTTON_H + BUTTON_GAP) * 3, 'CONFIGURACIÓN', true, () => {
      this.audio.playBeep('click', 'ui');
      this.showAudioConfig();
    });

    // Version
    this.add.text(GAME.WIDTH - 8, GAME.HEIGHT - 8, 'v0.1.0', {
      fontSize: '12px',
      color: COLORS.TEXT_MUTED,
    }).setOrigin(1, 1);
  }

  private makeButton(
    x: number,
    y: number,
    label: string,
    enabled: boolean,
    onClick: () => void,
  ): void {
    const color = enabled ? COLORS.BUTTON : 0x222233;
    const textColor = enabled ? COLORS.TEXT : COLORS.TEXT_MUTED;

    const bg = this.add.rectangle(x, y, BUTTON_W, BUTTON_H, color)
      .setInteractive({ useHandCursor: enabled });

    this.add.text(x, y, label, {
      fontSize: '20px',
      color: textColor,
    }).setOrigin(0.5);

    if (enabled) {
      bg.on('pointerover', () => bg.setFillStyle(COLORS.BUTTON_HOVER));
      bg.on('pointerout', () => bg.setFillStyle(color));
      bg.on('pointerup', onClick);
    }
  }

  private showCharacterSelect(): void {
    const cx = GAME.WIDTH / 2;
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(this.add.rectangle(cx, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0.85).setInteractive());
    overlay.add(this.add.text(cx, 30, 'ELIGE PERSONAJE', {
      fontSize: '26px', color: '#ffff00', fontStyle: 'bold',
    }).setOrigin(0.5));

    const cardW = 280;
    const cardH = 66;
    const gap = 8;
    const cols = 2;
    const startX = cx - (cols * cardW + (cols - 1) * gap) / 2 + cardW / 2;
    const startY = 90;

    CHARACTERS.forEach((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);

      const card = this.add.rectangle(x, y, cardW, cardH, COLORS.BUTTON)
        .setInteractive({ useHandCursor: true });
      overlay.add(card);
      overlay.add(this.add.text(x - cardW / 2 + 10, y - 16, c.name, {
        fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
      }).setOrigin(0, 0.5));
      overlay.add(this.add.text(x - cardW / 2 + 10, y + 2, c.tagline, {
        fontSize: '10px', color: COLORS.TEXT_MUTED, wordWrap: { width: cardW - 20 },
      }).setOrigin(0, 0.5));
      overlay.add(this.add.text(x - cardW / 2 + 10, y + 20, `HP ${c.baseHp}`, {
        fontSize: '10px', color: '#88ccff',
      }).setOrigin(0, 0.5));

      card.on('pointerover', () => card.setFillStyle(COLORS.BUTTON_HOVER));
      card.on('pointerout', () => card.setFillStyle(COLORS.BUTTON));
      card.on('pointerup', () => {
        this.audio.playBeep('click', 'ui');
        SceneManager.go(this, SCENES.GAME, { characterId: c.id });
      });
    });

    const back = this.add.rectangle(cx, GAME.HEIGHT - 30, 140, 36, COLORS.BUTTON)
      .setInteractive({ useHandCursor: true });
    overlay.add(back);
    overlay.add(this.add.text(cx, GAME.HEIGHT - 30, 'VOLVER', { fontSize: '14px', color: COLORS.TEXT }).setOrigin(0.5));
    back.on('pointerover', () => back.setFillStyle(COLORS.BUTTON_HOVER));
    back.on('pointerout', () => back.setFillStyle(COLORS.BUTTON));
    back.on('pointerup', () => { this.audio.playBeep('click', 'ui'); overlay.destroy(true); });
  }

  private showAudioConfig(): void {
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    // Overlay panel
    const overlay = this.add.container(0, 0);
    const bg = this.add.rectangle(cx, cy, 360, 280, 0x111122, 0.95)
      .setStrokeStyle(2, 0x4444aa)
      .setInteractive(); // block clicks
    overlay.add(bg);

    const titleText = this.add.text(cx, cy - 110, 'CONFIGURACIÓN DE AUDIO', {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    overlay.add(titleText);

    const categories: Array<{ label: string; cat: 'music' | 'sfx' | 'ui' }> = [
      { label: 'Música', cat: 'music' },
      { label: 'Efectos', cat: 'sfx' },
      { label: 'UI', cat: 'ui' },
    ];

    let rowY = cy - 60;
    const sliderW = 200;

    for (const { label, cat } of categories) {
      const lbl = this.add.text(cx - 120, rowY, label, { fontSize: '14px', color: '#cccccc' }).setOrigin(0, 0.5);
      overlay.add(lbl);

      const trackBg = this.add.rectangle(cx + 20, rowY, sliderW, 8, 0x333366);
      overlay.add(trackBg);

      const currentVol = this.audio.getVolume(cat);
      const fillW = Math.max(4, currentVol * sliderW);
      const fill = this.add.rectangle(cx + 20 - sliderW / 2 + fillW / 2, rowY, fillW, 8, 0x6666ff);
      overlay.add(fill);

      const handle = this.add.rectangle(cx + 20 - sliderW / 2 + currentVol * sliderW, rowY, 12, 20, 0xaaaaff)
        .setInteractive({ useHandCursor: true, draggable: true });
      overlay.add(handle);

      this.input.setDraggable(handle);
      const trackLeft = cx + 20 - sliderW / 2;
      const trackRight = cx + 20 + sliderW / 2;

      handle.on('drag', (_ptr: Phaser.Input.Pointer, dragX: number) => {
        const clampedX = Phaser.Math.Clamp(dragX, trackLeft, trackRight);
        handle.setX(clampedX);
        const vol = (clampedX - trackLeft) / sliderW;
        this.audio.setVolume(cat, vol);
        const newFillW = Math.max(4, vol * sliderW);
        fill.setPosition(trackLeft + newFillW / 2, rowY).setSize(newFillW, 8);
        // Persist audio settings on change (per-spec: save on audio settings change)
        const s = SaveManager.load();
        s.settings[cat === 'music' ? 'musicVolume' : cat === 'sfx' ? 'sfxVolume' : 'uiVolume'] = vol;
        SaveManager.save(s);
      });

      rowY += 52;
    }

    // Close button
    const closeBtn = this.add.rectangle(cx, cy + 110, 140, 38, COLORS.BUTTON)
      .setInteractive({ useHandCursor: true });
    overlay.add(closeBtn);
    const closeLbl = this.add.text(cx, cy + 110, 'CERRAR', { fontSize: '16px', color: COLORS.TEXT }).setOrigin(0.5);
    overlay.add(closeLbl);
    closeBtn.on('pointerover', () => closeBtn.setFillStyle(COLORS.BUTTON_HOVER));
    closeBtn.on('pointerout', () => closeBtn.setFillStyle(COLORS.BUTTON));
    closeBtn.on('pointerup', () => {
      this.audio.playBeep('click', 'ui');
      overlay.destroy(true);
    });
  }
}
