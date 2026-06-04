import { WAVES, GAME, SPAWN } from '@/config/game.config';
import type { EnemyType } from '@/types';
import type { RunContext } from './RunContext';
import type { EnemySystem } from './EnemySystem';

// Wave unlock table from Game Bible
const WAVE_UNLOCK_TABLE: Record<number, EnemyType[]> = {
  1: ['angry_email'],
  2: ['angry_email'],
  3: ['angry_email', 'toxic_manager', 'angry_client'],
  4: ['angry_email', 'toxic_manager', 'angry_client'],
  5: ['angry_email', 'toxic_manager', 'angry_client', 'hr_rep', 'possessed_printer'],
  6: ['angry_email', 'toxic_manager', 'angry_client', 'hr_rep', 'possessed_printer'],
  7: ['angry_email', 'toxic_manager', 'angry_client', 'hr_rep', 'possessed_printer', 'auditor'],
  8: ['angry_email', 'toxic_manager', 'angry_client', 'hr_rep', 'possessed_printer', 'auditor'],
  9: ['angry_email', 'toxic_manager', 'angry_client', 'hr_rep', 'possessed_printer', 'auditor'],
};

export class SpawnDirector {
  private ctx: RunContext;
  private enemySys: EnemySystem;
  private waveTimer = 0;           // seconds elapsed since last wave
  private waveEnemiesLeft = 0;     // enemies still to spawn in current wave
  private spawnInterval = 0.5;     // seconds between individual spawns
  private spawnTimer = 0;
  private infinite = false;        // ipo: keep spawning waves past the boss

  constructor(ctx: RunContext, enemySys: EnemySystem) {
    this.ctx = ctx;
    this.enemySys = enemySys;
  }

  update(delta: number): void {
    const dtS = delta / 1000;
    this.waveTimer += dtS;

    // Spawn queued enemies
    if (this.waveEnemiesLeft > 0) {
      this.spawnTimer -= dtS;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval;
        this.waveEnemiesLeft--;
        this.spawnOneEnemy();
      }
    }

    // Start next wave
    if (this.waveTimer >= WAVES.INTERVAL_S && this.waveEnemiesLeft <= 0) {
      this.waveTimer = 0;
      this.startNextWave();
    }
  }

  private startNextWave(): void {
    // Previous wave is over once its spawn window elapsed.
    if (this.ctx.wave >= 1) {
      this.ctx.bus.emit('wave:complete', { wave: this.ctx.wave });
    }
    const nextWave = this.ctx.wave + 1;

    // Boss wave (skipped in infinite mode — boss already beaten)
    if (!this.infinite && nextWave >= WAVES.BOSS_WAVE) {
      this.ctx.wave = WAVES.BOSS_WAVE;
      this.ctx.bus.emit('wave:start', { wave: WAVES.BOSS_WAVE });
      this.ctx.bus.emit('boss:spawned');
      return;
    }

    this.ctx.wave = nextWave;
    // Round: multiplier may be fractional (e.g. 2.5); keep an integer spawn count.
    const count = Math.round(nextWave * WAVES.ENEMIES_PER_WAVE_MULTIPLIER + WAVES.BASE_ENEMIES);
    this.waveEnemiesLeft = count;
    this.spawnTimer = 0;
    this.ctx.bus.emit('wave:start', { wave: nextWave });
  }

  private spawnOneEnemy(): void {
    const wave = this.ctx.wave;
    let pool = WAVE_UNLOCK_TABLE[Math.min(wave, 9)] ?? WAVE_UNLOCK_TABLE[9];
    // RRHH "Política de Empresa": Auditores aparecen desde la oleada 1.
    if (this.ctx.character.auditorsFromWave1 && !pool.includes('auditor')) {
      pool = [...pool, 'auditor'];
    }
    // Curse open_office: HR Reps aparecen en todas las oleadas.
    if (this.ctx.curseHrEveryWave && !pool.includes('hr_rep')) {
      pool = [...pool, 'hr_rep'];
    }
    const type = pool[Math.floor(Math.random() * pool.length)];
    const pos = this.getEdgeSpawnPos();
    this.enemySys.spawn(type, pos.x, pos.y);
  }

  private getEdgeSpawnPos(): { x: number; y: number } {
    const m = SPAWN.EDGE_MARGIN;
    const W = GAME.WIDTH;
    const H = GAME.HEIGHT;
    // Pick a random perimeter point outside viewport
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0: return { x: Math.random() * W, y: -m };            // top
      case 1: return { x: Math.random() * W, y: H + m };         // bottom
      case 2: return { x: -m, y: Math.random() * H };            // left
      default: return { x: W + m, y: Math.random() * H };        // right
    }
  }

  /** Trigger wave 1 immediately at game start */
  triggerFirstWave(): void {
    this.waveTimer = WAVES.INTERVAL_S; // force wave timer to trigger
  }

  /** surprise_audit wave event: cancel the current wave's remaining normal spawns. */
  cancelCurrentWaveSpawns(): void {
    this.waveEnemiesLeft = 0;
  }

  /** ipo: resume normal waves past the boss (no boss gating). */
  enterInfiniteMode(): void {
    this.infinite = true;
    this.waveTimer = 0;
    this.waveEnemiesLeft = 0;
  }
}
