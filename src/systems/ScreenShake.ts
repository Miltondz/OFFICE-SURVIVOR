// src/systems/ScreenShake.ts
import Phaser from 'phaser';
import { SHAKE } from '@/config/game.config';

export class ScreenShake {
  constructor(private cam: Phaser.Cameras.Scene2D.Camera) {}

  play(preset: keyof typeof SHAKE): void {
    this.cam.shake(SHAKE[preset].ms, SHAKE[preset].intensity);
  }
}
