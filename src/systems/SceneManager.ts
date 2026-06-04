import Phaser from 'phaser';

export class SceneManager {
  static go(from: Phaser.Scene, to: string, data?: object): void {
    from.scene.start(to, data);
  }
  static overlay(from: Phaser.Scene, to: string, data?: object): void {
    from.scene.launch(to, data);
    from.scene.pause();
  }
  static closeOverlay(overlay: Phaser.Scene, resume: string): void {
    overlay.scene.stop();
    overlay.scene.resume(resume);
  }
}
