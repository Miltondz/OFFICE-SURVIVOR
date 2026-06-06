// src/systems/ScreenShake.ts
import Phaser from 'phaser';
import { SHAKE } from '@/config/game.config';
import { SaveManager } from '@/systems/SaveManager';

export class ScreenShake {
  /** 0..1 multiplier applied to shake intensity (0 = disabled). Read from settings. */
  private intensityMult: number;

  constructor(private cam: Phaser.Cameras.Scene2D.Camera) {
    this.intensityMult = SaveManager.load().settings.screenShake;
  }

  /** Re-read the setting at runtime (called when user changes the slider). */
  setIntensityMult(value: number): void {
    this.intensityMult = value;
  }

  play(preset: keyof typeof SHAKE): void {
    if (this.intensityMult <= 0) return;
    this.cam.shake(SHAKE[preset].ms, SHAKE[preset].intensity * this.intensityMult);
  }
}
