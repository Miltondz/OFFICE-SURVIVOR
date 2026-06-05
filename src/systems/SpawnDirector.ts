import { WAVES, MAP, SPAWN } from '@/config/game.config';
import type { WaveType } from '@/config/game.config';
import { ENEMIES } from '@/config/enemies.config';
import type { EnemyType } from '@/types';
import type { RunContext } from './RunContext';
import type { EnemySystem } from './EnemySystem';

// Wave unlock table from Game Bible
const WAVE_UNLOCK_TABLE: Record<number, EnemyType[]> = {
  1: ['angry_email'],
  2: ['angry_email'],
  3: ['angry_email', 'toxic_manager', 'angry_client'],
  4: ['angry_email', 'toxic_manager', 'angry_client', 'cleaning_lady'],
  5: ['angry_email', 'toxic_manager', 'angry_client', 'cleaning_lady', 'hr_rep', 'possessed_printer'],
  6: ['angry_email', 'toxic_manager', 'angry_client', 'cleaning_lady', 'hr_rep', 'possessed_printer'],
  7: ['angry_email', 'toxic_manager', 'angry_client', 'cleaning_lady', 'hr_rep', 'possessed_printer', 'auditor'],
  8: ['angry_email', 'toxic_manager', 'angry_client', 'cleaning_lady', 'hr_rep', 'possessed_printer', 'auditor'],
  9: ['angry_email', 'toxic_manager', 'angry_client', 'cleaning_lady', 'hr_rep', 'possessed_printer', 'auditor'],
};

type WaveState =
  | 'spawning'       // actively spawning enemies from budget
  | 'clearing'       // all spawned, waiting for last enemy to die
  | 'intermission'   // wave cleared; overlays (level-up / shop) + countdown
  | 'countdown'      // 4s "PREPÁRATE" banner before next wave spawns
  | 'boss'           // boss active — no wave progression
  | 'miniboss';      // §C miniboss active — waiting for miniboss:defeated

/**
 * §7.5 — SpawnDirector state machine.
 * States: spawning → clearing → intermission (overlays + 4s countdown) → spawning.
 *
 * Budget system: each wave has a spawn budget (pts). Normal = 1pt, elite = ELITE_COST pts.
 * Budget = BASE_BUDGET + round(wave × BUDGET_GROWTH).
 *
 * SpawnDirector does NOT auto-grant upgrades. GameScene listens to 'wave:cleared' to run
 * the intermission flow (pending level-ups → ShopOverlay → countdown → next wave).
 */
export class SpawnDirector {
  private ctx: RunContext;
  private enemySys: EnemySystem;
  private state: WaveState = 'spawning';

  // Spawn queue
  private spawnQueue: EnemyType[] = [];
  private spawnTimer = 0;          // seconds until next spawn

  // Intermission / countdown
  private countdownTimer = 0;      // seconds remaining in countdown

  private infinite = false;        // ipo: keep spawning waves past the boss

  // §B — current wave type
  private currentWaveType: WaveType = 'normal';

  // Viewport provider for camera-relative spawn (injected from GameScene)
  private viewportProvider: (() => Phaser.Geom.Rectangle) | null = null;

  // Callbacks
  private onCountdownTick: ((seconds: number) => void) | null = null;

  constructor(ctx: RunContext, enemySys: EnemySystem) {
    this.ctx = ctx;
    this.enemySys = enemySys;

    // §C — when miniboss dies, transition to intermission (wave cleared)
    ctx.bus.on('miniboss:defeated', (_p: { id: string }) => {
      if (this.state === 'miniboss') {
        this.state = 'intermission';
        this.ctx.bus.emit('wave:cleared', { wave: this.ctx.wave });
      }
    });
  }

  /** Called by GameScene to wire countdown UI updates. */
  setCountdownCallback(cb: (seconds: number) => void): void {
    this.onCountdownTick = cb;
  }

  /** Inject a getter for the camera's current world viewport so spawns happen off-screen. */
  setViewportProvider(fn: () => Phaser.Geom.Rectangle): void {
    this.viewportProvider = fn;
  }

  /** Trigger wave 1 immediately at game start (called by GameScene.create). */
  triggerFirstWave(): void {
    this.beginWave(1);
  }

  /**
   * Called by GameScene when the intermission overlays (level-ups + shop) are all done.
   * SpawnDirector can then start the 4s countdown.
   */
  notifyIntermissionDone(): void {
    if (this.state === 'intermission') {
      this.startCountdown();
    }
  }

  update(delta: number): void {
    const dtS = delta / 1000;

    switch (this.state) {
      case 'spawning':
        this.updateSpawning(dtS);
        break;
      case 'clearing':
        this.updateClearing();
        break;
      case 'countdown':
        this.updateCountdown(dtS);
        break;
      case 'intermission':
      case 'boss':
      case 'miniboss':
        // Driven by external events; nothing to tick here.
        break;
    }
  }

  private updateSpawning(dtS: number): void {
    if (this.spawnQueue.length === 0) {
      // All queued — transition to clearing
      this.state = 'clearing';
      return;
    }
    this.spawnTimer -= dtS;
    if (this.spawnTimer <= 0) {
      const type = this.spawnQueue.shift()!;
      // §B swarm: spawn from random of 4 sides quasi-simultaneously (use min interval)
      // §B bonus: use spawnBonus instead of spawn
      if (this.currentWaveType === 'bonus') {
        const pos = this.getEdgeSpawnPos();
        this.enemySys.spawnBonus(type, pos.x, pos.y);
      } else {
        const pos = this.getEdgeSpawnPos();
        this.enemySys.spawn(type, pos.x, pos.y);
      }
      // Swarm uses minimum spawn interval for rapid flooding
      const interval = this.currentWaveType === 'swarm'
        ? WAVES.SPAWN_INTERVAL_MIN
        : this.spawnIntervalForWave(this.ctx.wave);
      this.spawnTimer = interval;
    }
  }

  private updateClearing(): void {
    if (this.enemySys.getActiveCount() === 0) {
      // Field cleared — emit event and enter intermission
      this.state = 'intermission';
      this.ctx.bus.emit('wave:cleared', { wave: this.ctx.wave });
    }
  }

  private updateCountdown(dtS: number): void {
    const prev = Math.ceil(this.countdownTimer);
    this.countdownTimer -= dtS;
    const cur = Math.ceil(Math.max(0, this.countdownTimer));
    if (cur !== prev && this.onCountdownTick) {
      this.onCountdownTick(cur);
    }
    if (this.countdownTimer <= 0) {
      this.beginNextWave();
    }
  }

  private startCountdown(): void {
    this.state = 'countdown';
    this.countdownTimer = WAVES.INTERMISSION_S;
    if (this.onCountdownTick) this.onCountdownTick(WAVES.INTERMISSION_S);
  }

  private beginWave(wave: number): void {
    this.ctx.wave = wave;
    this.ctx.bus.emit('wave:complete', { wave: this.ctx.wave - 1 }); // legacy compat
    this.ctx.bus.emit('wave:start', { wave });

    // §B — announce wave type before spawning
    const waveType: WaveType = WAVES.WAVE_SEQUENCE[wave] ?? 'normal';
    this.currentWaveType = waveType;
    this.ctx.bus.emit('wave:announce', { type: waveType, wave });

    // §C — miniboss: real miniboss entity; enter 'miniboss' state (no auto-clear)
    if (waveType === 'miniboss') {
      const minibossId = WAVES.WAVE_MINIBOSS[wave] ?? 'supervisor';
      this.ctx.bus.emit('miniboss:announce', { id: minibossId, wave });
      // Emit spawn event — GameScene instantiates the real miniboss
      this.ctx.bus.emit('miniboss:spawn', { id: minibossId });
      this.state = 'miniboss';
      this.spawnQueue = [];
      return; // bypass the normal spawning state
    } else {
      // Build spawn queue from budget according to type
      this.spawnQueue = this.buildSpawnQueue(wave, waveType);
    }

    this.spawnTimer = 0;
    this.state = 'spawning';
  }

  private beginNextWave(): void {
    const nextWave = this.ctx.wave + 1;

    // Boss wave (wave 13 — see WAVES.BOSS_WAVE)
    if (!this.infinite && nextWave >= WAVES.BOSS_WAVE) {
      this.ctx.wave = WAVES.BOSS_WAVE;
      this.state = 'boss';
      this.ctx.bus.emit('wave:announce', { type: 'boss' as WaveType, wave: WAVES.BOSS_WAVE });
      this.ctx.bus.emit('wave:start', { wave: WAVES.BOSS_WAVE });
      this.ctx.bus.emit('boss:spawned');
      return;
    }

    this.beginWave(nextWave);
  }

  /**
   * Build a list of enemy types from the wave's spawn budget.
   * Budget = BASE_BUDGET + round(wave × BUDGET_GROWTH).
   * Elites cost ELITE_COST pts; normals cost 1 pt.
   * Elite chance starts at ELITE_MIN_WAVE and rises by ELITE_CHANCE_PER_WAVE.
   *
   * §B — waveType drives quantity/pool:
   *   normal     → current budget behavior
   *   swarm      → ×SWARM_COUNT_MULT count, only hp ≤ SWARM_HP_THRESHOLD enemies, fast spawn
   *   elite_only → budget × ELITE_ONLY_BUDGET_MULT, only elites
   *   bonus      → same count as normal, all flagged isBonus (handled via spawnQueue sentinel)
   */
  private buildSpawnQueue(wave: number, waveType: WaveType = 'normal'): EnemyType[] {
    let budget = WAVES.BASE_BUDGET + Math.round(wave * WAVES.BUDGET_GROWTH);
    const eliteChance = wave < WAVES.ELITE_MIN_WAVE
      ? 0
      : Math.min(WAVES.ELITE_CHANCE_MAX, WAVES.ELITE_CHANCE_BASE + (wave - WAVES.ELITE_MIN_WAVE) * WAVES.ELITE_CHANCE_PER_WAVE);

    const pool = this.availablePool(wave);
    const queue: EnemyType[] = [];

    if (waveType === 'swarm') {
      // §B swarm: ×4 count, only low-hp enemies, spawn from all sides rapidly
      const swarmPool = ENEMIES.filter(e => e.hp <= WAVES.SWARM_HP_THRESHOLD && pool.includes(e.id as EnemyType));
      const basePool: EnemyType[] = swarmPool.length > 0 ? swarmPool.map(e => e.id as EnemyType) : pool;
      const count = budget * WAVES.SWARM_COUNT_MULT;
      for (let i = 0; i < count; i++) {
        queue.push(basePool[Math.floor(Math.random() * basePool.length)]);
      }
      return queue; // no shuffle needed — all same pool; spawn timer uses SPAWN_INTERVAL_MIN
    }

    if (waveType === 'elite_only') {
      // §B elite_only: reduced budget, only elites
      budget = Math.max(1, Math.round(budget * WAVES.ELITE_ONLY_BUDGET_MULT));
      const ep = this.elitePool(wave);
      while (budget >= WAVES.ELITE_COST) {
        queue.push(ep[Math.floor(Math.random() * ep.length)]);
        budget -= WAVES.ELITE_COST;
      }
      return queue;
    }

    if (waveType === 'bonus') {
      // §B bonus: same count as normal budget (1pt each), use BONUS_SENTINEL to flag
      // Spawn via normal pool — EnemySystem.spawnBonus marks them on spawn
      while (budget > 0) {
        queue.push(pool[Math.floor(Math.random() * pool.length)]);
        budget -= 1;
      }
      return queue;
    }

    // normal (default)
    while (budget > 0) {
      const tryElite = budget >= WAVES.ELITE_COST && Math.random() < eliteChance;
      if (tryElite) {
        const elitePool = this.elitePool(wave);
        queue.push(elitePool[Math.floor(Math.random() * elitePool.length)]);
        budget -= WAVES.ELITE_COST;
      } else {
        queue.push(pool[Math.floor(Math.random() * pool.length)]);
        budget -= 1;
      }
    }

    // Shuffle for variety
    for (let i = queue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    return queue;
  }

  /** Normal enemy pool for the wave (based on unlock table). */
  private availablePool(wave: number): EnemyType[] {
    let pool = WAVE_UNLOCK_TABLE[Math.min(wave, 9)] ?? WAVE_UNLOCK_TABLE[9];
    if (this.ctx.character.auditorsFromWave1 && !pool.includes('auditor')) {
      pool = [...pool, 'auditor'];
    }
    if (this.ctx.curseHrEveryWave && !pool.includes('hr_rep')) {
      pool = [...pool, 'hr_rep'];
    }
    return pool;
  }

  /** Elite pool: tougher enemy types unlocked progressively. */
  private elitePool(wave: number): EnemyType[] {
    if (wave >= 7) return ['toxic_manager', 'angry_client', 'hr_rep', 'possessed_printer', 'auditor'];
    if (wave >= 5) return ['toxic_manager', 'angry_client', 'hr_rep'];
    return ['toxic_manager', 'angry_client'];
  }

  /** Spawn interval in seconds for a given wave — decreases with wave number. */
  private spawnIntervalForWave(wave: number): number {
    const base = WAVES.SPAWN_INTERVAL_BASE;
    const min = WAVES.SPAWN_INTERVAL_MIN;
    // Decrease by 5% per wave, floor at min
    return Math.max(min, base * Math.pow(0.95, wave - 1));
  }

  /** §7.5 enemy speed scale — applied via ctx.enemySpeedMult in EnemySystem/Enemy. */
  enemySpeedScaleForWave(wave: number): number {
    return 1 + Math.min(WAVES.SPEED_SCALE_MAX, (wave - 1) * WAVES.SPEED_SCALE_PER_WAVE);
  }

  private getEdgeSpawnPos(): { x: number; y: number } {
    const m = SPAWN.EDGE_MARGIN;

    if (this.viewportProvider) {
      // Spawn just outside the camera's current viewport, clamped inside the map.
      const view = this.viewportProvider();
      const side = Math.floor(Math.random() * 4);
      let x: number, y: number;
      switch (side) {
        case 0: // top
          x = view.left + Math.random() * view.width;
          y = view.top - m;
          break;
        case 1: // bottom
          x = view.left + Math.random() * view.width;
          y = view.bottom + m;
          break;
        case 2: // left
          x = view.left - m;
          y = view.top + Math.random() * view.height;
          break;
        default: // right
          x = view.right + m;
          y = view.top + Math.random() * view.height;
          break;
      }
      return {
        x: Phaser.Math.Clamp(x, 0, MAP.WIDTH),
        y: Phaser.Math.Clamp(y, 0, MAP.HEIGHT),
      };
    }

    // Fallback: legacy screen-edge spawn (no camera provider set)
    const W = MAP.WIDTH;
    const H = MAP.HEIGHT;
    const side = Math.floor(Math.random() * 4);
    switch (side) {
      case 0: return { x: Math.random() * W, y: -m };
      case 1: return { x: Math.random() * W, y: H + m };
      case 2: return { x: -m, y: Math.random() * H };
      default: return { x: W + m, y: Math.random() * H };
    }
  }

  /** surprise_audit wave event: cancel the current wave's remaining normal spawns. */
  cancelCurrentWaveSpawns(): void {
    this.spawnQueue = [];
  }

  /** ipo: resume normal waves past the boss (no boss gating). */
  enterInfiniteMode(): void {
    this.infinite = true;
    this.state = 'clearing'; // will check clearing condition immediately
  }
}
