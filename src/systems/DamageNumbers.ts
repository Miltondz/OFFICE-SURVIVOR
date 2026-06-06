// src/systems/DamageNumbers.ts
import Phaser from 'phaser';
import { FEEL } from '@/config/game.config';
import { SaveManager } from '@/systems/SaveManager';

type DamageKind = 'normal' | 'crit' | 'player';

interface DmgConfig {
  value: number;
  x: number;
  y: number;
  kind: DamageKind;
}

export class DamageNumbers {
  private pool: Phaser.GameObjects.Text[] = [];
  private scene: Phaser.Scene;
  /** Whether to render damage numbers. Updated live via setEnabled(). */
  private enabled: boolean;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.enabled = SaveManager.load().settings.damageNumbers;
    // Pre-create pool
    for (let i = 0; i < FEEL.DMG_NUM_POOL; i++) {
      const t = scene.add.text(0, 0, '', {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2,
      }).setActive(false).setVisible(false).setDepth(20);
      this.pool.push(t);
    }
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
  }

  show({ value, x, y, kind }: DmgConfig): void {
    if (!this.enabled) return;
    const text = this.acquire();
    if (!text) return;

    const displayVal = Math.round(value).toString();
    let color = '#ffffff';
    let fontSize = '14px';
    let risePx: number = FEEL.DMG_NUM_RISE_PX;
    let riseMs: number = FEEL.DMG_NUM_RISE_MS;

    if (kind === 'crit') {
      color = '#ffff00';
      fontSize = '20px';
      risePx = FEEL.DMG_NUM_CRIT_RISE_PX;
      riseMs = FEEL.DMG_NUM_RISE_MS;
    } else if (kind === 'player') {
      color = '#ff4444';
      fontSize = '16px';
      risePx = FEEL.DMG_NUM_PLAYER_RISE_PX;
      riseMs = FEEL.DMG_NUM_PLAYER_MS;
    }

    text.setText(displayVal)
      .setStyle({ fontSize, color, fontStyle: 'bold', stroke: '#000000', strokeThickness: 2 })
      .setPosition(x + Phaser.Math.Between(-12, 12), y)
      .setAlpha(1)
      .setActive(true)
      .setVisible(true);

    this.scene.tweens.add({
      targets: text,
      y: y - risePx,
      alpha: 0,
      duration: riseMs,
      ease: 'Cubic.Out',
      onComplete: () => {
        text.setActive(false).setVisible(false);
      },
    });
  }

  private acquire(): Phaser.GameObjects.Text | null {
    // Find inactive
    for (const t of this.pool) {
      if (!t.active) return t;
    }
    return null; // pool exhausted
  }
}
