import Phaser from 'phaser';
import { EFFECTS } from '@/config/effects.config';

/**
 * Efectos animados one-shot (explosión de muerte, destello de moneda, …).
 * Crea un sprite temporal que reproduce su animación y se autodestruye al terminar.
 * Bajo volumen de uso → no se poolea (los enemigos mueren de a pocos por frame).
 */
export class EffectAnims {
  constructor(private scene: Phaser.Scene) {}

  /** Reproduce el efecto `name` en (x,y). `scaleMult` ajusta el tamaño (élites más grandes). */
  play(name: keyof typeof EFFECTS | string, x: number, y: number, scaleMult = 1): void {
    const key = `fx_${name}`;
    const def = EFFECTS[name];
    if (!def || !this.scene.textures.exists(key) || !this.scene.anims.exists(key)) return;

    const base = def.display / Math.max(def.frameW, def.frameH);
    const s = this.scene.add.sprite(x, y, key, 0)
      .setScale(base * scaleMult)
      .setDepth(15);
    s.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => s.destroy());
    s.play(key);
  }
}
