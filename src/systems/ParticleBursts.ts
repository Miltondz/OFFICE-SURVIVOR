// src/systems/ParticleBursts.ts
import Phaser from 'phaser';
import { PARTICLES } from '@/config/game.config';

interface BurstConfig {
  count: number;
  color: number;
  ms: number;
}

const TEXTURE_KEY = 'particle_dot';

export class ParticleBursts {
  private scene: Phaser.Scene;
  private textureCreated = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.ensureTexture();
  }

  private ensureTexture(): void {
    if (this.textureCreated || this.scene.textures.exists(TEXTURE_KEY)) {
      this.textureCreated = true;
      return;
    }
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    g.fillStyle(0xffffff, 1);
    g.fillCircle(4, 4, 4);
    g.generateTexture(TEXTURE_KEY, 8, 8);
    g.destroy();
    this.textureCreated = true;
  }

  burst(x: number, y: number, cfg: BurstConfig): void {
    const emitter = this.scene.add.particles(x, y, TEXTURE_KEY, {
      speed: { min: 40, max: 120 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: cfg.ms,
      quantity: cfg.count,
      tint: cfg.color,
      emitting: false,
    });
    emitter.setDepth(15);
    emitter.explode(cfg.count, 0, 0);

    // Clean up after particles die
    this.scene.time.delayedCall(cfg.ms + 100, () => {
      emitter.destroy();
    });
  }

  onEnemyKilled(x: number, y: number, isElite: boolean): void {
    const cfg = isElite ? PARTICLES.ELITE_DEATH : PARTICLES.ENEMY_DEATH;
    this.burst(x, y, cfg);
  }

  onPickupCollected(x: number, y: number, isCafe: boolean): void {
    const cfg = isCafe ? PARTICLES.CAFE_PICKUP : PARTICLES.PICKUP;
    this.burst(x, y, cfg);
  }
}
