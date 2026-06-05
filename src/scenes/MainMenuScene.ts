import Phaser from 'phaser';
import { SCENES, GAME, COLORS } from '@/config/game.config';
import { SceneManager } from '@/systems/SceneManager';
import { AudioManager } from '@/systems/AudioManager';
import { SaveManager } from '@/systems/SaveManager';
import { CHARACTERS, CHAR_SHEET } from '@/config/characters.config';
import { formatTime } from '@/utils';

const BUTTON_W = 170;
const BUTTON_H = 38;
const BUTTON_GAP = 10;

export class MainMenuScene extends Phaser.Scene {
  private audio = AudioManager.getInstance();

  constructor() {
    super({ key: SCENES.MAIN_MENU });
  }

  create(): void {
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    // Background image (+ dark scrim for button legibility)
    this.add.image(cx, cy, 'bg_menu').setDisplaySize(GAME.WIDTH, GAME.HEIGHT);
    this.add.rectangle(cx, cy, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0.4);

    // Panel opaco detrás del título para que resalte
    this.add.rectangle(cx, cy - 158, 590, 124, 0x0a0a14, 0.62).setStrokeStyle(2, 0x000000);

    // Logo (recortado 1319x251)
    this.add.image(cx, cy - 160, 'ui_logo').setOrigin(0.5).setDisplaySize(560, 560 * 251 / 1319);

    // Subtitle
    this.add.text(cx, cy - 115, 'Sobrevive la jornada laboral', {
      fontSize: '18px',
      color: COLORS.TEXT,
      stroke: '#000000',
      strokeThickness: 3,
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

    // Botones: columna a la derecha
    const btnX = GAME.WIDTH - BUTTON_W / 2 - 48;
    const step = BUTTON_H + BUTTON_GAP;
    const startY = cy - 40;

    this.makeButton(btnX, startY, 'JUGAR', true, () => {
      this.audio.resume();
      this.audio.playBeep('click', 'ui');
      this.showCharacterSelect();
    });

    this.makeButton(btnX, startY + step, 'MEJORAS', true, () => {
      this.audio.playBeep('click', 'ui');
      SceneManager.go(this, SCENES.UPGRADE);
    });

    this.makeButton(btnX, startY + step * 2, 'ESTADÍSTICAS', hasRuns, () => {
      this.audio.playBeep('click', 'ui');
      SceneManager.go(this, SCENES.STATISTICS);
    });

    this.makeButton(btnX, startY + step * 3, 'CONFIGURACIÓN', true, () => {
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
    const btn = this.add.sprite(x, y, 'ui_button', 0).setDisplaySize(BUTTON_W, BUTTON_H);
    if (!enabled) btn.setTint(0x666666);

    this.add.text(x, y + 3, label, {
      fontSize: '15px',
      color: enabled ? COLORS.TEXT : COLORS.TEXT_MUTED,
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);

    if (enabled) {
      btn.setInteractive({ useHandCursor: true });
      btn.on('pointerover', () => {
        btn.setFrame(1);
        if (btn.postFX) { btn.postFX.clear(); btn.postFX.addGlow(0xffe680, 4); }
      });
      btn.on('pointerout', () => {
        btn.setFrame(0);
        if (btn.postFX) btn.postFX.clear();
      });
      btn.on('pointerup', onClick);
    }
  }

  private showCharacterSelect(): void {
    const cx = GAME.WIDTH / 2;
    const overlay = this.add.container(0, 0).setDepth(100);
    overlay.add(this.add.rectangle(cx, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0.85).setInteractive());
    overlay.add(this.add.text(cx, 30, 'ELIGE PERSONAJE', {
      fontSize: '26px', color: '#ffff00', fontStyle: 'bold',
    }).setOrigin(0.5));

    // Cards-retrato en 2 filas × 3 columnas (retrato cuadrado, personaje recortado a silueta)
    const cols = 3;
    const cardW = 120;
    const gap = 14;
    const rowGap = 16;
    const iconSize = cardW - 12;
    const ph = iconSize;                            // retrato cuadrado
    const cardH = 8 + ph + 52;
    const top = -cardH / 2;
    const gridW = cols * cardW + (cols - 1) * gap;
    const startX = cx - gridW / 2 + cardW / 2;
    const firstRowY = 168;

    // Excluir 'base' (Empleado) de la pantalla de selección; sigue siendo fallback interno.
    const selectable = CHARACTERS.filter(c => c.id !== 'base');
    selectable.forEach((c, i) => {
      const col = i % cols;
      const rowN = Math.floor(i / cols);
      const container = this.add.container(startX + col * (cardW + gap), firstRowY + rowN * (cardH + rowGap));
      overlay.add(container);

      const card = this.add.rectangle(0, 0, cardW, cardH, 0x222230).setStrokeStyle(2, 0x4a4a66);
      container.add(card);

      const iconY = top + 6 + ph / 2;
      const sheetKey = this.textures.exists(`charsheet_${c.id}`) ? `charsheet_${c.id}` : 'charsheet_base';
      let portrait: Phaser.GameObjects.Sprite | null = null;
      if (this.textures.exists(sheetKey)) {
        portrait = this.add.sprite(0, iconY, sheetKey, CHAR_SHEET.IDLE.down)
          .setDisplaySize(iconSize, ph).setOrigin(0.5);
        container.add(portrait);
      } else {
        container.add(this.add.rectangle(0, iconY, iconSize, ph, 0x000000, 0.25).setStrokeStyle(1, 0x4a4a66));
        container.add(this.add.text(0, iconY, '◆', { fontSize: '38px', color: '#556' }).setOrigin(0.5));
      }
      const walkKey = `${c.id}_walk_down`;

      let ty = top + 6 + ph + 4;
      const name = this.add.text(0, ty, c.name, {
        fontSize: '12px', color: '#ffffff', fontStyle: 'bold', wordWrap: { width: cardW - 10 }, align: 'center',
      }).setOrigin(0.5, 0);
      container.add(name); ty += name.height + 1;
      const tag = this.add.text(0, ty, c.tagline, {
        fontSize: '8px', color: '#9a9ab0', wordWrap: { width: cardW - 10 }, align: 'center',
      }).setOrigin(0.5, 0);
      container.add(tag); ty += tag.height + 1;
      container.add(this.add.text(0, ty, `HP ${c.baseHp}`, { fontSize: '10px', color: '#88ccff' }).setOrigin(0.5, 0));

      const hit = this.add.rectangle(0, 0, cardW, cardH, 0x000000, 0).setInteractive({ useHandCursor: true });
      container.add(hit);
      hit.on('pointerover', () => {
        this.tweens.add({ targets: container, scaleX: 1.06, scaleY: 1.06, duration: 80, ease: 'Cubic.Out' });
        card.setStrokeStyle(3, 0xffe680);
        if (portrait && this.anims.exists(walkKey)) portrait.play(walkKey, true);
      });
      hit.on('pointerout', () => {
        this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: 80, ease: 'Cubic.Out' });
        card.setStrokeStyle(2, 0x4a4a66);
        if (portrait) { portrait.stop(); portrait.setFrame(CHAR_SHEET.IDLE.down); }
      });
      hit.on('pointerup', () => {
        this.audio.playBeep('click', 'ui');
        SceneManager.go(this, SCENES.GAME, { characterId: c.id });
      });
    });

    const back = this.add.rectangle(cx, GAME.HEIGHT - 28, 140, 34, COLORS.BUTTON)
      .setInteractive({ useHandCursor: true });
    overlay.add(back);
    overlay.add(this.add.text(cx, GAME.HEIGHT - 28, 'VOLVER', { fontSize: '14px', color: COLORS.TEXT }).setOrigin(0.5));
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
