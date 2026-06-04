import type { RunContext } from './RunContext';
import type { DamageDealtPayload, EnemyKilledPayload } from '@/types';

/**
 * Accumulates run statistics into ctx.stats for the post-run Build Report.
 * Read-only on gameplay — only writes to ctx.stats. Subscribes to the EventBus
 * (reset per run in GameScene.create, so listeners never stack).
 */
export class RunTracker {
  private ctx: RunContext;
  private killsThisWave = 0;

  constructor(ctx: RunContext) {
    this.ctx = ctx;
    const bus = ctx.bus;
    bus.on('damage:dealt', this.onDamage);
    bus.on('enemy:killed', this.onKill);
    bus.on('item:acquired', this.onItem);
    bus.on('wave:start', this.onWaveStart);
    bus.on('wave:complete', this.onWaveComplete);
  }

  private onDamage = (p: DamageDealtPayload): void => {
    if (!p.sourceId) return;
    const m = this.ctx.stats.damageBySource;
    m[p.sourceId] = (m[p.sourceId] ?? 0) + p.amount;
  };

  private onKill = (p: EnemyKilledPayload): void => {
    this.killsThisWave++;
    if (p.sourceId) {
      const m = this.ctx.stats.killsByWeapon;
      m[p.sourceId] = (m[p.sourceId] ?? 0) + 1;
    }
  };

  private onItem = (p: { id: string }): void => {
    this.ctx.stats.itemsCollected.push(p.id);
  };

  private onWaveStart = (): void => {
    this.killsThisWave = 0;
  };

  private onWaveComplete = (p: { wave: number }): void => {
    if (this.killsThisWave > this.ctx.stats.longestWave.enemies) {
      this.ctx.stats.longestWave = { wave: p.wave, enemies: this.killsThisWave };
    }
  };
}
