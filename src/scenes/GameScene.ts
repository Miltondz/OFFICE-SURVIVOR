import Phaser from 'phaser';
import { SCENES, GAME, COLORS, SPAWN, BOSS, FEEL, CURSES } from '@/config/game.config';
import { SceneManager } from '@/systems/SceneManager';
import { EventBus } from '@/systems/EventBus';
import { createRunContext, recomputeModifiers, applyCharacter } from '@/systems/RunContext';
import type { RunContext } from '@/systems/RunContext';
import { getCharacterById, CHAR } from '@/config/characters.config';
import { Player } from '@/entities/Player';
import { StressSystem } from '@/systems/StressSystem';
import { WeaponSystem } from '@/systems/WeaponSystem';
import { EnemySystem } from '@/systems/EnemySystem';
import { SpawnDirector } from '@/systems/SpawnDirector';
import { LevelSystem } from '@/systems/LevelSystem';
import { RunTracker } from '@/systems/RunTracker';
import { WaveEventSystem } from '@/systems/WaveEventSystem';
import { MapSystem } from '@/systems/MapSystem';
import { PickupSystem } from '@/systems/PickupSystem';
import { UpgradePool } from '@/systems/UpgradePool';
import { CEOBoss } from '@/entities/CEOBoss';
import { DamageZone } from '@/entities/DamageZone';
import { Projectile } from '@/entities/Projectile';
import { installItemReactions, setItemReactionDeps } from '@/systems/ItemReactions';
import { ScreenShake } from '@/systems/ScreenShake';
import { DamageNumbers } from '@/systems/DamageNumbers';
import { ParticleBursts } from '@/systems/ParticleBursts';
import { AudioManager } from '@/systems/AudioManager';
import { SaveManager } from '@/systems/SaveManager';
import { META_UPGRADES, META_STRESS_RESIST_PER_LEVEL } from '@/config/meta.config';

export class GameScene extends Phaser.Scene {
  private ctx!: RunContext;
  private player!: Player;
  private stressSys!: StressSystem;
  private weaponSys!: WeaponSystem;
  private enemySys!: EnemySystem;
  private spawnDir!: SpawnDirector;
  private levelSys!: LevelSystem;
  private runTracker!: RunTracker;
  private waveEvents!: WaveEventSystem;
  private mapSys!: MapSystem;
  private pickupSys!: PickupSystem;
  private upgradePool!: UpgradePool;
  private boss: CEOBoss | null = null;

  private zonePool!: Phaser.GameObjects.Group;
  private enemyProjPool!: Phaser.GameObjects.Group;

  // Phase 3 systems
  private screenShake!: ScreenShake;
  private damageNumbers!: DamageNumbers;
  private particles!: ParticleBursts;
  private audio = AudioManager.getInstance();

  // Burnout vignette (fixed to camera)
  private vignetteRect!: Phaser.GameObjects.Rectangle;
  private vignetteTween: Phaser.Tweens.Tween | null = null;

  private gameOver = false;
  private victory = false;
  private ipoActive = false;

  // Throttle shoot beep
  private lastShootBeep = 0;
  private readonly SHOOT_BEEP_MIN_MS = 125; // ~8/s max

  private selectedCharacterId = 'base';

  constructor() {
    super({ key: SCENES.GAME });
  }

  init(data: { characterId?: string }): void {
    this.selectedCharacterId = data.characterId ?? 'base';
  }

  create(): void {
    EventBus.reset();

    this.gameOver = false;
    this.victory = false;
    this.ipoActive = false;
    this.boss = null;
    this.vignetteTween = null;

    this.ctx = createRunContext();

    // Apply selected character base stats first (overrides createRunContext defaults).
    this.ctx.character = getCharacterById(this.selectedCharacterId);
    applyCharacter(this.ctx);

    // Apply meta upgrades on top (consultor ignores meta-progression).
    const saveForMeta = SaveManager.load();
    if (!this.ctx.character.ignoreMeta) {
      applyMetaUpgrades(this.ctx, saveForMeta);
    }

    // Background
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;
    this.add.rectangle(cx, cy, GAME.WIDTH, GAME.HEIGHT, COLORS.BG);

    // Grid lines
    const gridColor = 0x222222;
    for (let x = 0; x <= GAME.WIDTH; x += 80) {
      this.add.line(0, 0, x, 0, x, GAME.HEIGHT, gridColor, 0.3).setOrigin(0, 0);
    }
    for (let y = 0; y <= GAME.HEIGHT; y += 80) {
      this.add.line(0, 0, 0, y, GAME.WIDTH, y, gridColor, 0.3).setOrigin(0, 0);
    }

    // Damage zone pool
    this.zonePool = this.add.group({
      classType: DamageZone,
      maxSize: 20,
      runChildUpdate: true,
    });

    // Enemy projectile pool
    this.enemyProjPool = this.physics.add.group({
      classType: Projectile,
      maxSize: 100,
      runChildUpdate: true,
    });

    // Systems
    this.player = new Player(this, this.ctx);
    this.data.set('playerBodyRef', this.player.body);

    this.stressSys = new StressSystem(this.ctx);
    this.weaponSys = new WeaponSystem(this, this.ctx);
    this.enemySys = new EnemySystem(this, this.ctx);

    this.weaponSys.init(this.enemySys, this.zonePool);
    this.enemySys.init(this.player, this.weaponSys, this.zonePool, this.enemyProjPool);

    this.spawnDir = new SpawnDirector(this.ctx, this.enemySys);
    this.levelSys = new LevelSystem(this, this.ctx);
    this.runTracker = new RunTracker(this.ctx);
    void this.runTracker; // subscribes to bus in constructor; no per-frame update needed

    this.pickupSys = new PickupSystem(this, this.ctx, this.player);
    this.pickupSys.init();

    this.upgradePool = new UpgradePool();

    setItemReactionDeps(this.pickupSys, this.weaponSys, this.upgradePool);

    this.waveEvents = new WaveEventSystem(this, this.ctx, this.enemySys, this.pickupSys, this.spawnDir, this.player);

    this.mapSys = new MapSystem(this, this.ctx, this.player, this.enemySys, this.weaponSys, this.pickupSys, this.upgradePool);
    this.mapSys.init();

    // Run starts by choosing a starting weapon (no forced default).
    this.levelSys.grantUpgrade(true);
    // Meta upgrade: starting_weapon — grants a second weapons-only starting choice.
    // (Every run already opens one weapon choice above; this adds a second pick.)
    if ((saveForMeta.metaUpgrades['starting_weapon'] ?? 0) >= 1) {
      this.levelSys.grantUpgrade(true);
    }

    // Phase 3 systems
    this.screenShake = new ScreenShake(this.cameras.main);
    this.damageNumbers = new DamageNumbers(this);
    this.particles = new ParticleBursts(this);

    // Burnout vignette (fixed to camera, high depth)
    this.vignetteRect = this.add.rectangle(
      GAME.WIDTH / 2, GAME.HEIGHT / 2,
      GAME.WIDTH, GAME.HEIGHT,
      0xff0000, 0,
    ).setScrollFactor(0).setDepth(50).setAlpha(0);

    // Launch HUD overlay
    this.scene.launch(SCENES.HUD, { ctx: this.ctx });

    // EventBus subscriptions
    this.ctx.bus.on('player:died', () => this.handlePlayerDied());
    this.ctx.bus.on('boss:spawned', () => this.spawnBoss());
    this.ctx.bus.on('boss:defeated', () => this.handleBossDefeated());

    this.ctx.bus.on('wave:start', (p: { wave: number }) => {
      void p; // wave display handled by HUDScene
    });

    // Reward: an upgrade choice after every wave cleared.
    this.ctx.bus.on('wave:complete', () => {
      this.levelSys.grantUpgrade();
    });

    // Curse picked mid-run → refresh weapon mods (exclusivity) + start timer-based effects.
    this.ctx.bus.on('curse:applied', (p: { id: string }) => {
      this.weaponSys.recomputeWeaponMods();
      this.startCurseTimers(p.id);
    });

    this.ctx.bus.on('upgrade:weapon_selected', (p: { id: string }) => {
      this.weaponSys.addOrLevel(p.id);
      recomputeModifiers(this.ctx);
      this.weaponSys.recomputeWeaponMods();
    });
    this.ctx.bus.on('upgrade:item_selected', (p: { id: string }) => {
      if (p.id === 'benchmark' && !this.ctx.benchmarkWeaponId) {
        this.ctx.benchmarkWeaponId = this.weaponSys.topDamageWeaponId();
      }
      this.weaponSys.recomputeWeaponMods();
    });

    // --- Phase 3 event hooks ---

    // Screen shake
    this.ctx.bus.on('player:hit', () => {
      this.screenShake.play('PLAYER_HIT');
    });
    this.ctx.bus.on('enemy:killed', (p: { type: string; isElite: boolean; x: number; y: number }) => {
      if (p.isElite) this.screenShake.play('ELITE_KILLED');
      this.particles.onEnemyKilled(p.x, p.y, p.isElite);
    });
    this.ctx.bus.on('boss:defeated', () => {
      this.screenShake.play('BOSS_DEAD');
    });

    // Damage numbers — enemy hits
    this.ctx.bus.on('enemy:hit', (p: { enemy: { x: number; y: number }; amount: number; isCritical: boolean }) => {
      this.damageNumbers.show({
        value: p.amount,
        x: p.enemy.x,
        y: p.enemy.y - 16,
        kind: p.isCritical ? 'crit' : 'normal',
      });
    });

    // Damage numbers — player hit
    this.ctx.bus.on('player:hit', (p: { amount: number }) => {
      this.damageNumbers.show({
        value: p.amount,
        x: this.player.x,
        y: this.player.y - 20,
        kind: 'player',
      });
    });

    // Burnout vignette toggle
    this.ctx.bus.on('player:burnout', () => this.updateVignette(true));
    this.ctx.bus.on('stress:changed', (p: { value: number }) => {
      this.updateVignette(p.value >= 90);
    });

    // Level-up popup
    this.ctx.bus.on('player:level_up', (p: { level: number }) => {
      this.showLevelUpPopup(p.level);
    });

    // Audio hooks
    this.ctx.bus.on('enemy:hit', () => this.audio.playBeep('enemy_hit', 'sfx'));
    this.ctx.bus.on('enemy:killed', () => this.audio.playBeep('enemy_die', 'sfx'));
    this.ctx.bus.on('player:hit', () => this.audio.playBeep('player_hit', 'sfx'));
    this.ctx.bus.on('player:died', () => this.audio.playBeep('player_die', 'sfx'));
    this.ctx.bus.on('player:level_up', () => this.audio.playBeep('level_up', 'sfx'));
    this.ctx.bus.on('pickup:collected', (p: { kind?: string }) => {
      this.audio.playBeep('pickup', 'sfx');
      const isCafe = p.kind === 'cafe';
      this.particles.onPickupCollected(this.player.x, this.player.y, isCafe);
    });
    this.ctx.bus.on('player:burnout', () => this.audio.playBeep('burnout_start', 'sfx'));
    this.ctx.bus.on('boss:spawned', () => this.audio.playBeep('boss_appear', 'sfx'));
    this.ctx.bus.on('boss:defeated', () => this.audio.playBeep('boss_die', 'sfx'));

    // Boss screen shake on hit
    this.ctx.bus.on('enemy:hit', (p: { enemy: unknown }) => {
      // boss body is a Rectangle, not an Enemy — check via ctx boss
      if (this.boss && p.enemy === this.boss.body) {
        this.screenShake.play('BOSS_HIT');
      }
    });

    // Start first wave
    this.spawnDir.triggerFirstWave();
    installItemReactions(this.ctx);

    // Consultor Externo — "Por Hora": +5% all stats every 60s (no cap).
    if (this.ctx.character.timeScaling) {
      this.time.addEvent({
        delay: CHAR.CONSULTOR_TIME_INTERVAL_S * 1000,
        loop: true,
        callback: () => {
          const k = 1 + CHAR.CONSULTOR_TIME_STEP;
          this.ctx.player.damageMultiplier *= k;
          this.ctx.player.speed *= k;
        },
      });
    }

    // Resume audio context on first interaction
    this.input.once('pointerdown', () => this.audio.resume());
  }

  update(_time: number, delta: number): void {
    if (this.gameOver || this.victory) return;

    this.ctx.elapsedS += delta / 1000;
    this.ctx.stats.timeSurvived = Math.floor(this.ctx.elapsedS);

    this.data.set('playerX', this.player.x);
    this.data.set('playerY', this.player.y);

    const stressSpeedMult = this.stressSys.speedMult
      * (this.enemySys.hrSlowActive ? (1 - SPAWN.HR_AURA_SLOW) : 1.0);

    this.player.update(delta, stressSpeedMult);
    this.stressSys.update(delta);
    this.weaponSys.update(_time, delta, this.player.x, this.player.y);
    this.enemySys.update(_time, delta);
    this.pickupSys.update(delta);
    this.spawnDir.update(delta);
    this.levelSys.update();
    this.waveEvents.update(delta);
    this.mapSys.update(delta);

    if (this.boss?.alive) {
      this.boss.update(_time, delta);
      const bossBody = this.boss.body;
      const dist = Phaser.Math.Distance.Between(bossBody.x, bossBody.y, this.player.x, this.player.y);
      if (dist < BOSS.CONTACT_RANGE) {
        this.player.takeDamage(BOSS.CONTACT_DAMAGE);
      }

      // Emit boss HP ratio for HUDScene boss bar
      const maxHp = this.ctx.player.items.includes('ceo_memo') ? BOSS.HP * BOSS.CEO_MEMO_BOSS_HP_MULT : BOSS.HP;
      const ratio = Math.max(0, this.boss.hp / maxHp);
      this.ctx.bus.emit('boss:hp', { ratio });
    }

    // YOLO: floor stress at 90
    if (this.ctx.player.items.includes('yolo') && this.ctx.player.stress < 90) {
      this.ctx.player.stress = 90;
    }

    // Throttled shoot beep (WeaponSystem fires every frame for laser)
    if (this.weaponSys.weapons.length > 0) {
      const now = _time;
      if (now - this.lastShootBeep > this.SHOOT_BEEP_MIN_MS) {
        this.lastShootBeep = now;
        this.audio.playBeep('shoot', 'sfx');
      }
    }
  }

  private updateVignette(visible: boolean): void {
    if (visible) {
      this.vignetteRect.setVisible(true);
      if (!this.vignetteTween || !this.vignetteTween.isPlaying()) {
        this.vignetteTween = this.tweens.add({
          targets: this.vignetteRect,
          alpha: { from: 0, to: FEEL.VIGNETTE_ALPHA_MAX },
          duration: 400,
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      if (this.vignetteTween) {
        this.vignetteTween.stop();
        this.vignetteTween = null;
      }
      this.vignetteRect.setAlpha(0).setVisible(false);
    }
  }

  private showLevelUpPopup(level: number): void {
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;
    const popup = this.add.text(cx, cy, `LEVEL UP! Nv.${level}`, {
      fontSize: '32px',
      color: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(60).setScrollFactor(0).setAlpha(1).setScale(0.5);

    // Bounce: 0.5 → 1.2 → 1.0 in 300ms
    this.tweens.add({
      targets: popup,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      ease: 'Bounce.Out',
      onComplete: () => {
        this.tweens.add({
          targets: popup,
          scaleX: 1.0,
          scaleY: 1.0,
          duration: 100,
          onComplete: () => {
            // Hold LEVELUP_POPUP_MS then fade out
            this.time.delayedCall(FEEL.LEVELUP_POPUP_MS, () => {
              this.tweens.add({
                targets: popup,
                alpha: 0,
                duration: 200,
                onComplete: () => popup.destroy(),
              });
            });
          },
        });
      },
    });
  }

  private spawnBoss(): void {
    if (this.boss) return;
    this.enemySys.killAll();
    this.boss = new CEOBoss(this, this.ctx, this.weaponSys, this.enemySys);
  }

  private handlePlayerDied(): void {
    if (this.gameOver) return;

    if (this.ctx.player.hp <= 0 && this.ctx.player.items.includes('linea_directa')) {
      this.player.activateLineaDirecta();
      return;
    }

    this.gameOver = true;
    this.ctx.stats.timeSurvived = Math.floor(this.ctx.elapsedS);
    this.ctx.stats.weaponsOwned = [...this.ctx.player.weapons];
    this.time.delayedCall(500, () => {
      this.scene.stop(SCENES.HUD);
      SceneManager.go(this, SCENES.BUILD_REPORT, { stats: this.ctx.stats, victory: false });
    });
  }

  private handleBossDefeated(): void {
    if (this.victory) return;

    if (this.ctx.player.items.includes('ipo') && !this.ipoActive) {
      this.ipoActive = true;
      this.ipoScaling();
      return;
    }

    this.victory = true;
    this.ctx.stats.timeSurvived = Math.floor(this.ctx.elapsedS);
    this.ctx.stats.weaponsOwned = [...this.ctx.player.weapons];
    this.time.delayedCall(1500, () => {
      this.scene.stop(SCENES.HUD);
      SceneManager.go(this, SCENES.BUILD_REPORT, { stats: this.ctx.stats, victory: true });
    });
  }

  private startCurseTimers(id: string): void {
    if (id === 'micromanagement') {
      this.time.addEvent({
        delay: CURSES.MICROMANAGEMENT_INTERVAL_S * 1000,
        loop: true,
        callback: () => {
          this.ctx.player.hp = Math.max(0, this.ctx.player.hp - CURSES.MICROMANAGEMENT_HP_LOSS);
          if (this.ctx.player.hp <= 0) this.ctx.bus.emit('player:died');
        },
      });
    } else if (id === 'mandatory_overtime') {
      // SIMPLIFIED: the "+50% stats at 10 min" power is applied; the 15-min run / delayed CEO is not
      // (the boss is wave-driven). Documented in the Mejora 4 notes.
      this.time.delayedCall(CURSES.MANDATORY_OVERTIME_BUFF_S * 1000, () => {
        const k = CURSES.MANDATORY_OVERTIME_MULT;
        this.ctx.player.damageMultiplier *= k;
        this.ctx.player.speed *= k;
        this.ctx.player.maxHp = Math.floor(this.ctx.player.maxHp * k);
        this.ctx.player.hp = Math.floor(this.ctx.player.hp * k);
      });
    }
  }

  private ipoScaling(): void {
    this.ctx.infinite = true;
    this.spawnDir.enterInfiniteMode();
    this.time.addEvent({
      delay: BOSS.IPO_SCALE_INTERVAL_S * 1000,
      loop: true,
      callback: () => {
        this.ctx.difficultyMult *= 1 + BOSS.IPO_SCALE_STEP;
      },
    });
  }
}

/**
 * Apply all purchased meta upgrades to ctx.player and ctx.metaStressMult.
 * Called once in GameScene.create(), after createRunContext(), before systems init.
 */
function applyMetaUpgrades(ctx: RunContext, save: ReturnType<typeof SaveManager.load>): void {
  for (const upgrade of META_UPGRADES) {
    const level = save.metaUpgrades[upgrade.id] ?? 0;
    if (level <= 0) continue;

    if (upgrade.id === 'stress_resist') {
      // -20% stress accrual per level; applied as a multiplier read by StressSystem
      ctx.metaStressMult = Math.pow(1 - META_STRESS_RESIST_PER_LEVEL, level);
    } else {
      // All other upgrades mutate player state via applyToPlayer
      ctx.player = upgrade.applyToPlayer(ctx.player, level);
    }
  }
}
