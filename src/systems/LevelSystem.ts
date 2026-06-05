import { PROGRESSION, SCENES } from '@/config/game.config';
import { CHAR } from '@/config/characters.config';
import type { RunContext } from './RunContext';
import type { EnemyType } from '@/types';

/**
 * §7.6: Super-linear XP curve.
 * xpToNext = round(XP_BASE * level ^ XP_EXP)
 *
 * Level-up now opens the PlayerUpgrade overlay (player stat choices),
 * NOT the item/weapon UpgradePool overlay.
 */
export class LevelSystem {
  private ctx: RunContext;
  private scene: Phaser.Scene;
  private pendingLevels = 0;
  private upgradeInProgress = false;
  private inboxZeroKills = 0;  // track for Inbox Zero item
  private nextWeaponsOnly = false;  // starting choice: restrict pool to weapons (still items)
  private nextIsStatUpgrade = false; // whether pending level-ups open stat overlay

  constructor(scene: Phaser.Scene, ctx: RunContext) {
    this.scene = scene;
    this.ctx = ctx;

    ctx.bus.on('enemy:killed', (p: { type: EnemyType; isElite: boolean; sourceId: string }) => {
      this.inboxZeroKills++;
      void p;
    });

    ctx.bus.on('wave:start', () => {
      this.inboxZeroKills = 0;
    });
  }

  update(): void {
    const threshold = this.xpToNext(this.ctx.player.level);
    if (this.ctx.player.xp >= threshold) {
      this.ctx.player.xp -= threshold;
      this.ctx.player.level++;
      this.ctx.stats.maxLevel = Math.max(this.ctx.stats.maxLevel, this.ctx.player.level);
      this.pendingLevels++;
      this.ctx.bus.emit('player:level_up', { level: this.ctx.player.level });

      // Agile Sprint: +5% to all stats for 30s (Bible: "todos los stats")
      if (this.ctx.player.items.includes('agile_sprint')) {
        this.ctx.player.damageMultiplier *= 1.05;
        this.ctx.player.speed *= 1.05;
        this.scene.time.delayedCall(30000, () => {
          this.ctx.player.damageMultiplier /= 1.05;
          this.ctx.player.speed /= 1.05;
        });
      }
    }

    if (this.pendingLevels > 0 && !this.upgradeInProgress) {
      this.pendingLevels--;
      this.upgradeInProgress = true;
      this.openUpgradeOverlay();
    }
  }

  onUpgradeDone(): void {
    this.upgradeInProgress = false;
  }

  /**
   * Grant an upgrade choice without an XP level-up (starting pick, map drop).
   * @param weaponsOnly – restrict to weapons (starting weapon pick)
   * @param statUpgrade – open player-stat overlay instead of item/weapon overlay
   */
  grantUpgrade(weaponsOnly = false, statUpgrade = false): void {
    if (weaponsOnly) this.nextWeaponsOnly = true;
    if (statUpgrade) this.nextIsStatUpgrade = true;
    this.pendingLevels++;
  }

  /** §7.6 — super-linear XP curve. */
  xpToNext(level: number): number {
    let req = Math.round(PROGRESSION.XP_BASE * Math.pow(level, PROGRESSION.XP_EXP));
    // Becario "Curva de Aprendizaje": each level needs 10% less XP, cap -50%.
    if (this.ctx.character.learningCurve) {
      const reduction = Math.min(CHAR.LEARNING_CURVE_CAP, CHAR.LEARNING_CURVE_STEP * (level - 1));
      req = Math.round(req * (1 - reduction));
    }
    return req;
  }

  get optionCount(): number {
    // Inbox Zero: if 50 kills in a wave → 5 options next level up
    if (this.ctx.player.items.includes('inbox_zero') && this.inboxZeroKills >= 50) {
      return 5;
    }
    return PROGRESSION.UPGRADE_OPTIONS;
  }

  private openUpgradeOverlay(): void {
    const count = this.optionCount;
    const weaponsOnly = this.nextWeaponsOnly;
    const statUpgrade = this.nextIsStatUpgrade || !weaponsOnly;
    this.nextWeaponsOnly = false;
    this.nextIsStatUpgrade = false;

    if (statUpgrade) {
      // §7.2 — open player-upgrade overlay (stat picks only)
      this.scene.scene.launch(SCENES.UPGRADE_OVERLAY, {
        ctx: this.ctx,
        optionCount: count,
        weaponsOnly: false,
        playerUpgradeMode: true,
        onDone: () => { this.onUpgradeDone(); },
      });
    } else {
      // Starting weapon pick or (legacy) item pick
      this.scene.scene.launch(SCENES.UPGRADE_OVERLAY, {
        ctx: this.ctx,
        optionCount: count,
        weaponsOnly,
        playerUpgradeMode: false,
        onDone: () => { this.onUpgradeDone(); },
      });
    }
    this.scene.scene.pause();
  }
}
