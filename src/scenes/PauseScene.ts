import Phaser from 'phaser';
import { SCENES, GAME, COLORS } from '@/config/game.config';
import { AudioManager } from '@/systems/AudioManager';
import { SaveManager } from '@/systems/SaveManager';

const BTN_W = 220;
const BTN_H = 46;

/** Overlay de pausa: se lanza desde GameScene (que queda en scene.pause()). ESC reanuda. */
export class PauseScene extends Phaser.Scene {
  private audio = AudioManager.getInstance();

  constructor() {
    super({ key: SCENES.PAUSE });
  }

  create(): void {
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    this.add.rectangle(cx, cy, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0.7).setInteractive();
    this.add.text(cx, cy - 120, 'PAUSA', {
      fontSize: '42px', color: '#ffff00', fontStyle: 'bold', stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);

    this.makeButton(cx, cy - 40, 'REANUDAR', () => this.resumeGame());
    this.makeButton(cx, cy + 14 + BTN_H, 'OPCIONES', () => this.showOptions());
    this.makeButton(cx, cy + 14 + BTN_H * 2 + 8, 'SALIR AL MENÚ', () => this.exitToMenu());

    const esc = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    esc.on('down', () => this.resumeGame());
  }

  private resumeGame(): void {
    this.audio.playBeep('click', 'ui');
    this.scene.resume(SCENES.GAME);
    this.scene.stop();
  }

  private exitToMenu(): void {
    this.audio.playBeep('click', 'ui');
    this.scene.stop(SCENES.HUD);
    this.scene.stop(SCENES.GAME);
    this.scene.start(SCENES.MAIN_MENU);
  }

  /** FASE H — in-game options panel (display/accessibility toggles, no audio sliders) */
  private showOptions(): void {
    this.audio.playBeep('click', 'ui');
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    const PANEL_H = 340;
    const panel = this.add.container(0, 0).setDepth(200);
    const bg = this.add.rectangle(cx, cy, 380, PANEL_H, 0x111122, 0.98)
      .setStrokeStyle(2, 0x4444aa)
      .setInteractive();
    panel.add(bg);
    panel.add(this.add.text(cx, cy - PANEL_H / 2 + 18, 'OPCIONES DE PANTALLA', {
      fontSize: '15px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5));

    let rowY = cy - PANEL_H / 2 + 50;
    const labelX = cx - 130;
    const controlX = cx + 40;
    const sliderW = 140;

    const makeToggle = (x: number, y: number, labelOn: string, labelOff: string, current: boolean,
      onChange: (v: boolean) => void): void => {
      let state = current;
      const btn = this.add.rectangle(x, y, 90, 22, state ? 0x2255cc : 0x333355)
        .setStrokeStyle(1, 0x5555aa).setInteractive({ useHandCursor: true });
      panel.add(btn);
      const lbl = this.add.text(x, y, state ? labelOn : labelOff, { fontSize: '11px', color: '#ffffff' }).setOrigin(0.5);
      panel.add(lbl);
      btn.on('pointerup', () => {
        state = !state;
        btn.setFillStyle(state ? 0x2255cc : 0x333355);
        lbl.setText(state ? labelOn : labelOff);
        onChange(state);
      });
    };

    const makeZoomSel = (x: number, y: number, current: number, onChange: (v: number) => void): void => {
      const opts: Array<{ label: string; value: number }> = [
        { label: 'Auto', value: 0 }, { label: '×1', value: 1 }, { label: '×2', value: 2 }, { label: '×3', value: 3 },
      ];
      let sel = current;
      const btnW = 36;
      const gap = 3;
      const totalW = opts.length * btnW + (opts.length - 1) * gap;
      const sx = x - totalW / 2 + btnW / 2;
      opts.forEach((opt, i) => {
        const bx = sx + i * (btnW + gap);
        const btn = this.add.rectangle(bx, y, btnW, 22, opt.value === sel ? 0x2255cc : 0x333355)
          .setStrokeStyle(1, 0x5555aa).setInteractive({ useHandCursor: true });
        panel.add(btn);
        panel.add(this.add.text(bx, y, opt.label, { fontSize: '11px', color: '#ffffff' }).setOrigin(0.5));
        btn.on('pointerup', () => {
          if (sel === opt.value) return;
          sel = opt.value;
          onChange(sel);
          panel.getAll().forEach(obj => {
            if (obj instanceof Phaser.GameObjects.Rectangle) {
              opts.forEach((o, j) => {
                const bxj = sx + j * (btnW + gap);
                if (Math.abs(obj.x - bxj) < 2 && Math.abs(obj.y - y) < 2) {
                  obj.setFillStyle(o.value === sel ? 0x2255cc : 0x333355);
                }
              });
            }
          });
        });
      });
    };

    const row = (labelText: string, ctrlFn: (y: number) => void): void => {
      panel.add(this.add.text(labelX, rowY, labelText, { fontSize: '12px', color: '#cccccc' }).setOrigin(0, 0.5));
      ctrlFn(rowY);
      rowY += 36;
    };

    const s0 = SaveManager.load();

    row('Pantalla completa', (y) => makeToggle(controlX, y, 'ON', 'OFF', s0.settings.fullscreen, (v) => {
      const s = SaveManager.load(); s.settings.fullscreen = v; SaveManager.save(s);
      this.scale.toggleFullscreen();
    }));

    row('Zoom', (y) => makeZoomSel(controlX + 10, y, s0.settings.zoom, (v) => {
      const s = SaveManager.load(); s.settings.zoom = v; SaveManager.save(s);
    }));

    row('Sacudida', (y) => {
      const cur = s0.settings.screenShake;
      const fillW = Math.max(4, cur * sliderW);
      panel.add(this.add.rectangle(controlX, y, sliderW, 8, 0x333366));
      const fill = this.add.rectangle(controlX - sliderW / 2 + fillW / 2, y, fillW, 8, 0x6666ff);
      panel.add(fill);
      const handle = this.add.rectangle(controlX - sliderW / 2 + cur * sliderW, y, 12, 18, 0xaaaaff)
        .setInteractive({ useHandCursor: true, draggable: true });
      panel.add(handle);
      this.input.setDraggable(handle);
      const pct = this.add.text(controlX + sliderW / 2 + 6, y, `${Math.round(cur * 100)}%`,
        { fontSize: '11px', color: '#cccccc' }).setOrigin(0, 0.5);
      panel.add(pct);
      const tL = controlX - sliderW / 2;
      const tR = controlX + sliderW / 2;
      handle.on('drag', (_p: Phaser.Input.Pointer, dx: number) => {
        const cx2 = Phaser.Math.Clamp(dx, tL, tR);
        handle.setX(cx2);
        const val = (cx2 - tL) / sliderW;
        fill.setPosition(tL + Math.max(4, val * sliderW) / 2, y).setSize(Math.max(4, val * sliderW), 8);
        pct.setText(`${Math.round(val * 100)}%`);
        const s = SaveManager.load(); s.settings.screenShake = val; SaveManager.save(s);
      });
    });

    row('Viñeta de estrés', (y) => makeToggle(controlX, y, 'ON', 'OFF', s0.settings.vignette, (v) => {
      const s = SaveManager.load(); s.settings.vignette = v; SaveManager.save(s);
    }));

    row('Números de daño', (y) => makeToggle(controlX, y, 'ON', 'OFF', s0.settings.damageNumbers, (v) => {
      const s = SaveManager.load(); s.settings.damageNumbers = v; SaveManager.save(s);
    }));

    // Note for nitidez (no slider here — restart needed)
    panel.add(this.add.text(cx, rowY, 'Nitidez: cambiar desde el menú principal', {
      fontSize: '10px', color: '#777799',
    }).setOrigin(0.5));
    rowY += 20;

    const closeBtnY = cy + PANEL_H / 2 - 20;
    const closeBtn = this.add.rectangle(cx, closeBtnY, 120, 30, COLORS.BUTTON)
      .setInteractive({ useHandCursor: true });
    panel.add(closeBtn);
    panel.add(this.add.text(cx, closeBtnY, 'CERRAR', { fontSize: '13px', color: COLORS.TEXT }).setOrigin(0.5));
    closeBtn.on('pointerover', () => closeBtn.setFillStyle(COLORS.BUTTON_HOVER));
    closeBtn.on('pointerout', () => closeBtn.setFillStyle(COLORS.BUTTON));
    closeBtn.on('pointerup', () => { this.audio.playBeep('click', 'ui'); panel.destroy(true); });
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): void {
    const btn = this.add.sprite(x, y, 'ui_button', 0).setDisplaySize(BTN_W, BTN_H);
    this.add.text(x, y + 2, label, {
      fontSize: '17px', color: COLORS.TEXT, stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5);
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
