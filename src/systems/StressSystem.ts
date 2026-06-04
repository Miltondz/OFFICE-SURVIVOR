import { STRESS } from '@/config/game.config';
import type { StressState } from '@/types';
import type { RunContext } from './RunContext';

export class StressSystem {
  private ctx: RunContext;
  private lastKillTime = 0;   // seconds elapsed at last kill
  private inBurnout = false;

  constructor(ctx: RunContext) {
    this.ctx = ctx;

    ctx.bus.on('enemy:killed', (payload: { isElite: boolean; sourceId: string }) => {
      void payload.sourceId; // sourceId used by RunTracker, not StressSystem
      this.onEnemyKilled(payload.isElite);
    });
    ctx.bus.on('player:hit', () => {
      this.onPlayerHit();
    });
  }

  private onEnemyKilled(isElite: boolean): void {
    const dec = isElite ? STRESS.KILL_ELITE_DECREASE : STRESS.KILL_NORMAL_DECREASE;
    this.ctx.player.stress = Math.max(0, this.ctx.player.stress - dec);
    this.lastKillTime = this.ctx.elapsedS;
    this.emitStressChanged();
  }

  private onPlayerHit(): void {
    // Per-character stress-per-hit (may be negative, e.g. Freelancer); ergonomia/auriculares_nc scale it.
    const add = this.ctx.character.stressPerHit * this.stressIncreaseMult();
    this.ctx.player.stress = Math.max(0, Math.min(STRESS.MAX, this.ctx.player.stress + add));
    this.emitStressChanged();
    if (this.ctx.player.stress >= STRESS.MAX) {
      this.ctx.bus.emit('player:died');
    }
  }

  /** Multiplicative slow factor for all stress increases (ergonomia + auriculares_nc + meta stress_resist). */
  private stressIncreaseMult(): number {
    let mult = 1;
    if (this.ctx.player.items.includes('ergonomia')) mult *= STRESS.ERGONOMIA_MULT;
    if (this.ctx.player.items.includes('auriculares_nc')) mult *= STRESS.AURIC_NC_MULT;
    mult *= this.ctx.metaStressMult; // meta upgrade: stress_resist (-20% per level)
    return mult;
  }

  update(delta: number): void {
    const dtS = delta / 1000;

    // Passive stress increase: every PASSIVE_INCREASE_INTERVAL_S without a kill
    const timeSinceKill = this.ctx.elapsedS - this.lastKillTime;
    if (timeSinceKill >= STRESS.PASSIVE_INCREASE_INTERVAL_S) {
      const passiveAdd = STRESS.PASSIVE_INCREASE_AMOUNT * this.stressIncreaseMult();
      this.ctx.player.stress = Math.min(STRESS.MAX, this.ctx.player.stress + passiveAdd);
      this.lastKillTime = this.ctx.elapsedS; // reset timer
      this.emitStressChanged();
    }

    const state = this.getState();

    // Burnout HP drain
    if (state === 'burnout') {
      // Cafeína Crónica: if owned, no drain
      if (!this.ctx.player.items.includes('cafeina_cronica') && !this.ctx.player.items.includes('carta_renuncia')) {
        this.ctx.player.hp = Math.max(0, this.ctx.player.hp - STRESS.BURNOUT_HP_DRAIN_PER_S * dtS);
        if (this.ctx.player.hp <= 0) {
          this.ctx.bus.emit('player:died');
        }
      }

      if (!this.inBurnout) {
        this.inBurnout = true;
        this.ctx.bus.emit('player:burnout');
      }
    } else {
      this.inBurnout = false;
    }

    // Collapse = instant game over
    if (state === 'collapse') {
      this.ctx.bus.emit('player:died');
    }

    // Curse no_vacation: stress never drops below the floor.
    if (this.ctx.curseStressFloor > 0 && this.ctx.player.stress < this.ctx.curseStressFloor) {
      this.ctx.player.stress = this.ctx.curseStressFloor;
    }

    // Update stats tracking
    this.ctx.stats.maxStress = Math.max(this.ctx.stats.maxStress, this.ctx.player.stress);
  }

  getState(): StressState {
    const s = this.ctx.player.stress;
    if (s <= STRESS.THRESHOLDS.RELAXED_MAX) return 'relaxed';
    if (s <= STRESS.THRESHOLDS.TENSE_MAX) return 'tense';
    if (s <= STRESS.THRESHOLDS.LIMIT_MAX) return 'limit';
    if (s <= STRESS.THRESHOLDS.BURNOUT_MAX) return 'burnout';
    return 'collapse';
  }

  /** Returns damage multiplier from stress state */
  get damageMult(): number {
    const mods = this.getModifiers();
    return mods.damage;
  }

  /** Returns speed multiplier from stress state */
  get speedMult(): number {
    const mods = this.getModifiers();
    return mods.speed;
  }

  private getModifiers(): { damage: number; speed: number; drain: number } {
    const state = this.getState();
    // YOLO item: permanent burnout (speed). +60% damage lives in modifiers.damageMult, not here.
    if (this.ctx.player.items.includes('yolo')) {
      return { damage: 1.4, speed: 1.25, drain: STRESS.BURNOUT_HP_DRAIN_PER_S };
    }
    const table: Record<StressState, { damage: number; speed: number; drain: number }> = {
      relaxed:  { damage: 0.9,  speed: 1.0,  drain: 0 },
      tense:    { damage: 1.0,  speed: 1.0,  drain: 0 },
      limit:    { damage: 1.2,  speed: 1.1,  drain: 0 },
      burnout:  { damage: 1.4,  speed: 1.25, drain: STRESS.BURNOUT_HP_DRAIN_PER_S },
      collapse: { damage: 1.0,  speed: 1.0,  drain: 0 },
    };
    return table[state];
  }

  private emitStressChanged(): void {
    this.ctx.bus.emit('stress:changed', { value: this.ctx.player.stress, state: this.getState() });
  }
}
