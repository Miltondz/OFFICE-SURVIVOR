import Phaser from 'phaser';
import { SCENES, GAME, COLORS } from '@/config/game.config';
import { SceneManager } from '@/systems/SceneManager';
import { SaveManager } from '@/systems/SaveManager';
import { AudioManager } from '@/systems/AudioManager';

const BAR_WIDTH = 400;
const BAR_HEIGHT = 20;
const LOAD_DURATION_MS = 1200;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.PRELOAD });
  }

  create(): void {
    // Restore audio volumes from persisted settings before the game starts
    const save = SaveManager.load();
    const audio = AudioManager.getInstance();
    audio.setVolume('music', save.settings.musicVolume);
    audio.setVolume('sfx', save.settings.sfxVolume);
    audio.setVolume('ui', save.settings.uiVolume);

    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    this.add.text(cx, cy - 40, 'Cargando…', {
      fontSize: '24px',
      color: COLORS.TEXT,
    }).setOrigin(0.5);

    // Background bar
    this.add.rectangle(cx, cy, BAR_WIDTH, BAR_HEIGHT, 0x444444);

    // Fill bar starts at width 0, anchored left
    const fill = this.add.rectangle(
      cx - BAR_WIDTH / 2,
      cy,
      0,
      BAR_HEIGHT,
      COLORS.PLAYER,
    ).setOrigin(0, 0.5);

    this.tweens.add({
      targets: fill,
      width: BAR_WIDTH,
      duration: LOAD_DURATION_MS,
      ease: 'Linear',
      onComplete: () => {
        SceneManager.go(this, SCENES.MAIN_MENU);
      },
    });
  }
}
