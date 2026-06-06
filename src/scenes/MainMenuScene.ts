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

  // ─── CONFIGURACIÓN (audio + display/accesibilidad) ───────────────────────
  private showAudioConfig(): void {
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    // Panel: taller to accommodate all controls (3 audio sliders + 6 display controls)
    const PANEL_H = 500;
    const overlay = this.add.container(0, 0).setDepth(200);
    const bg = this.add.rectangle(cx, cy, 400, PANEL_H, 0x111122, 0.97)
      .setStrokeStyle(2, 0x4444aa)
      .setInteractive(); // block clicks
    overlay.add(bg);

    const titleText = this.add.text(cx, cy - PANEL_H / 2 + 18, 'CONFIGURACIÓN', {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    overlay.add(titleText);

    let rowY = cy - PANEL_H / 2 + 50;
    const sliderW = 180;
    const labelX = cx - 140;
    const controlX = cx + 30;

    // ── Section: Audio ───────────────────────────────────────────────────────
    overlay.add(this.add.text(cx, rowY, '— AUDIO —', { fontSize: '12px', color: '#8888cc' }).setOrigin(0.5));
    rowY += 20;

    const audioCats: Array<{ label: string; cat: 'music' | 'sfx' | 'ui' }> = [
      { label: 'Música', cat: 'music' },
      { label: 'Efectos', cat: 'sfx' },
      { label: 'UI', cat: 'ui' },
    ];

    for (const { label, cat } of audioCats) {
      overlay.add(this.add.text(labelX, rowY, label, { fontSize: '13px', color: '#cccccc' }).setOrigin(0, 0.5));

      const trackBg = this.add.rectangle(controlX, rowY, sliderW, 8, 0x333366);
      overlay.add(trackBg);

      const currentVol = this.audio.getVolume(cat);
      const fillW = Math.max(4, currentVol * sliderW);
      const fill = this.add.rectangle(controlX - sliderW / 2 + fillW / 2, rowY, fillW, 8, 0x6666ff);
      overlay.add(fill);

      const handle = this.add.rectangle(controlX - sliderW / 2 + currentVol * sliderW, rowY, 12, 20, 0xaaaaff)
        .setInteractive({ useHandCursor: true, draggable: true });
      overlay.add(handle);
      this.input.setDraggable(handle);

      const trackLeft = controlX - sliderW / 2;
      const trackRight = controlX + sliderW / 2;
      handle.on('drag', (_ptr: Phaser.Input.Pointer, dragX: number) => {
        const clampedX = Phaser.Math.Clamp(dragX, trackLeft, trackRight);
        handle.setX(clampedX);
        const vol = (clampedX - trackLeft) / sliderW;
        this.audio.setVolume(cat, vol);
        const newFillW = Math.max(4, vol * sliderW);
        fill.setPosition(trackLeft + newFillW / 2, rowY).setSize(newFillW, 8);
        const s = SaveManager.load();
        s.settings[cat === 'music' ? 'musicVolume' : cat === 'sfx' ? 'sfxVolume' : 'uiVolume'] = vol;
        SaveManager.save(s);
      });

      rowY += 44;
    }

    // ── Section: Pantalla ────────────────────────────────────────────────────
    overlay.add(this.add.text(cx, rowY + 2, '— PANTALLA —', { fontSize: '12px', color: '#8888cc' }).setOrigin(0.5));
    rowY += 22;

    // Helper: small toggle button (returns the label text for live update)
    const makeToggle = (
      x: number, y: number, labelOn: string, labelOff: string, current: boolean,
      onChange: (v: boolean) => void,
    ): void => {
      let state = current;
      const btn = this.add.rectangle(x, y, 100, 24, state ? 0x2255cc : 0x333355)
        .setStrokeStyle(1, 0x5555aa)
        .setInteractive({ useHandCursor: true });
      overlay.add(btn);
      const lbl = this.add.text(x, y, state ? labelOn : labelOff, { fontSize: '11px', color: '#ffffff' }).setOrigin(0.5);
      overlay.add(lbl);
      btn.on('pointerup', () => {
        state = !state;
        btn.setFillStyle(state ? 0x2255cc : 0x333355);
        lbl.setText(state ? labelOn : labelOff);
        onChange(state);
      });
      btn.on('pointerover', () => btn.setStrokeStyle(2, 0xaaaaff));
      btn.on('pointerout', () => btn.setStrokeStyle(1, 0x5555aa));
    };

    // Helper: small horizontal selector (Auto/×1/×2/×3)
    const makeZoomSelector = (x: number, y: number, current: number, onChange: (v: number) => void): void => {
      const options: Array<{ label: string; value: number }> = [
        { label: 'Auto', value: 0 },
        { label: '×1', value: 1 },
        { label: '×2', value: 2 },
        { label: '×3', value: 3 },
      ];
      let selected = current;
      const btnW = 40;
      const gap = 4;
      const totalW = options.length * btnW + (options.length - 1) * gap;
      const startX = x - totalW / 2 + btnW / 2;

      options.forEach((opt, i) => {
        const bx = startX + i * (btnW + gap);
        const btn = this.add.rectangle(bx, y, btnW, 24, opt.value === selected ? 0x2255cc : 0x333355)
          .setStrokeStyle(1, 0x5555aa)
          .setInteractive({ useHandCursor: true });
        overlay.add(btn);
        overlay.add(this.add.text(bx, y, opt.label, { fontSize: '11px', color: '#ffffff' }).setOrigin(0.5));
        btn.on('pointerup', () => {
          if (selected === opt.value) return;
          selected = opt.value;
          onChange(selected);
          // Recolor all buttons
          overlay.getAll().forEach(obj => {
            if (obj instanceof Phaser.GameObjects.Rectangle) {
              options.forEach((o, j) => {
                const bxj = startX + j * (btnW + gap);
                if (Math.abs(obj.x - bxj) < 2 && Math.abs(obj.y - y) < 2) {
                  obj.setFillStyle(o.value === selected ? 0x2255cc : 0x333355);
                }
              });
            }
          });
        });
        btn.on('pointerover', () => btn.setStrokeStyle(2, 0xaaaaff));
        btn.on('pointerout', () => btn.setStrokeStyle(1, 0x5555aa));
      });
    };

    const displayRow = (labelText: string, controlFn: (cy2: number) => void): void => {
      overlay.add(this.add.text(labelX, rowY, labelText, { fontSize: '13px', color: '#cccccc' }).setOrigin(0, 0.5));
      controlFn(rowY);
      rowY += 38;
    };

    const save0 = SaveManager.load();

    // Pantalla completa
    displayRow('Pantalla completa', (y) => {
      makeToggle(controlX + 10, y, 'ON', 'OFF', save0.settings.fullscreen, (v) => {
        const s = SaveManager.load();
        s.settings.fullscreen = v;
        SaveManager.save(s);
        this.scale.toggleFullscreen();
      });
    });

    // Zoom
    displayRow('Zoom', (y) => {
      makeZoomSelector(controlX + 20, y, save0.settings.zoom, (v) => {
        const s = SaveManager.load();
        s.settings.zoom = v;
        SaveManager.save(s);
      });
    });

    // Nitidez (smoothing — applies on restart)
    displayRow('Nitidez', (y) => {
      makeToggle(controlX + 10, y, 'Suavizado', 'Pixel art', save0.settings.smoothing, (v) => {
        const s = SaveManager.load();
        s.settings.smoothing = v;
        SaveManager.save(s);
      });
      // Note "se aplica al reiniciar"
      overlay.add(this.add.text(cx + 65, y, '(se aplica al reiniciar)', {
        fontSize: '9px', color: '#aaaaaa',
      }).setOrigin(0, 0.5));
    });

    // Sacudida de pantalla (slider 0–100%)
    displayRow('Sacudida', (y) => {
      const currentShake = save0.settings.screenShake;
      const shakeFillW = Math.max(4, currentShake * sliderW);
      const trackBg2 = this.add.rectangle(controlX, y, sliderW, 8, 0x333366);
      overlay.add(trackBg2);
      const shakeFill = this.add.rectangle(controlX - sliderW / 2 + shakeFillW / 2, y, shakeFillW, 8, 0x6666ff);
      overlay.add(shakeFill);
      const shakeHandle = this.add.rectangle(controlX - sliderW / 2 + currentShake * sliderW, y, 12, 20, 0xaaaaff)
        .setInteractive({ useHandCursor: true, draggable: true });
      overlay.add(shakeHandle);
      this.input.setDraggable(shakeHandle);
      const tLeft = controlX - sliderW / 2;
      const tRight = controlX + sliderW / 2;
      const shakePct = this.add.text(controlX + sliderW / 2 + 8, y, `${Math.round(currentShake * 100)}%`, {
        fontSize: '11px', color: '#cccccc',
      }).setOrigin(0, 0.5);
      overlay.add(shakePct);
      shakeHandle.on('drag', (_ptr: Phaser.Input.Pointer, dragX: number) => {
        const clampedX = Phaser.Math.Clamp(dragX, tLeft, tRight);
        shakeHandle.setX(clampedX);
        const val = (clampedX - tLeft) / sliderW;
        const newFillW2 = Math.max(4, val * sliderW);
        shakeFill.setPosition(tLeft + newFillW2 / 2, y).setSize(newFillW2, 8);
        shakePct.setText(`${Math.round(val * 100)}%`);
        const s = SaveManager.load();
        s.settings.screenShake = val;
        SaveManager.save(s);
      });
    });

    // Viñeta de estrés
    displayRow('Viñeta de estrés', (y) => {
      makeToggle(controlX + 10, y, 'ON', 'OFF', save0.settings.vignette, (v) => {
        const s = SaveManager.load();
        s.settings.vignette = v;
        SaveManager.save(s);
      });
    });

    // Números de daño
    displayRow('Números de daño', (y) => {
      makeToggle(controlX + 10, y, 'ON', 'OFF', save0.settings.damageNumbers, (v) => {
        const s = SaveManager.load();
        s.settings.damageNumbers = v;
        SaveManager.save(s);
      });
    });

    // Close button
    const closeBtnY = cy + PANEL_H / 2 - 22;
    const closeBtn = this.add.rectangle(cx, closeBtnY, 140, 34, COLORS.BUTTON)
      .setInteractive({ useHandCursor: true });
    overlay.add(closeBtn);
    overlay.add(this.add.text(cx, closeBtnY, 'CERRAR', { fontSize: '15px', color: COLORS.TEXT }).setOrigin(0.5));
    closeBtn.on('pointerover', () => closeBtn.setFillStyle(COLORS.BUTTON_HOVER));
    closeBtn.on('pointerout', () => closeBtn.setFillStyle(COLORS.BUTTON));
    closeBtn.on('pointerup', () => {
      this.audio.playBeep('click', 'ui');
      overlay.destroy(true);
    });
  }
}
