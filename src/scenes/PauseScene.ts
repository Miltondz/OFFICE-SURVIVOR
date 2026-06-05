import Phaser from 'phaser';
import { SCENES, GAME, COLORS } from '@/config/game.config';
import { AudioManager } from '@/systems/AudioManager';

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

    this.makeButton(cx, cy - 24, 'REANUDAR', () => this.resumeGame());
    this.makeButton(cx, cy + 24 + BTN_H, 'SALIR AL MENÚ', () => this.exitToMenu());

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
