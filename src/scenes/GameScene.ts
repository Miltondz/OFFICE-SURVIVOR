import Phaser from 'phaser';
import { SCENES, GAME, MAP, SPAWN, BOSS, FEEL, CURSES, MINIBOSS, ITEMS_E2, WAVES } from '@/config/game.config';
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
import type { MiniBoss } from '@/entities/MiniBoss';
import { SupervisorBoss, PrinterIndustrialBoss, CommitteeBoss } from '@/entities/MiniBoss';
import { DamageZone } from '@/entities/DamageZone';
import { Projectile } from '@/entities/Projectile';
import { installItemReactions, setItemReactionDeps, applyItemPickup } from '@/systems/ItemReactions';
import { ScreenShake } from '@/systems/ScreenShake';
import { DamageNumbers } from '@/systems/DamageNumbers';
import { ParticleBursts } from '@/systems/ParticleBursts';
import { EffectAnims } from '@/systems/EffectAnims';
import { AudioManager } from '@/systems/AudioManager';
import { SaveManager } from '@/systems/SaveManager';
import { META_UPGRADES, META_STRESS_RESIST_PER_LEVEL } from '@/config/meta.config';
import { ITEMS } from '@/config/items.config';
import { RARITY_RULES, RARITY_WEIGHTS } from '@/config/game.config';

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
  private miniboss: MiniBoss | null = null;

  private zonePool!: Phaser.GameObjects.Group;
  private enemyProjPool!: Phaser.GameObjects.Group;

  // Phase 3 systems
  private screenShake!: ScreenShake;
  private damageNumbers!: DamageNumbers;
  private particles!: ParticleBursts;
  private effects!: EffectAnims;
  private audio = AudioManager.getInstance();

  // Burnout vignette (fixed to camera)
  private vignetteRect!: Phaser.GameObjects.Rectangle;
  private vignetteTween: Phaser.Tweens.Tween | null = null;

  private gameOver = false;
  private victory = false;
  private ipoActive = false;

  // Intermission flow (wave cleared → level-ups → shop → countdown)

  // Throttle shoot beep
  private lastShootBeep = 0;
  private readonly SHOOT_BEEP_MIN_MS = 125;

  private escKey!: Phaser.Input.Keyboard.Key;

  private selectedCharacterId = 'base';

  // Regen accumulator
  private regenAccum = 0;

  // §E2 singularidad: position of active pull center — nuevo (fase E2)
  private _singularidadX = 0;
  private _singularidadY = 0;

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
    this.miniboss = null;
    this.vignetteTween = null;
    this.regenAccum = 0;

    this.ctx = createRunContext();
    this._singularidadX = 0;
    this._singularidadY = 0;

    this.ctx.character = getCharacterById(this.selectedCharacterId);
    applyCharacter(this.ctx);

    const saveForMeta = SaveManager.load();
    if (!this.ctx.character.ignoreMeta) {
      applyMetaUpgrades(this.ctx, saveForMeta);
    }

    // Background — tileSprite cubre todo el mapa (no estirado a pantalla como antes)
    this.add.tileSprite(0, 0, MAP.WIDTH, MAP.HEIGHT, 'bg_floor').setOrigin(0, 0).setDepth(-10);

    // Pools
    this.zonePool = this.add.group({
      classType: DamageZone,
      maxSize: 20,
      runChildUpdate: true,
    });
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
    void this.runTracker;

    this.pickupSys = new PickupSystem(this, this.ctx, this.player);
    this.pickupSys.setDropCallbacks(
      () => this.pickEligibleItemId(),
      (id) => this.grantSpecificItem(id),
      () => this.grantDropUpgrade(),
    );
    this.pickupSys.init();

    this.upgradePool = new UpgradePool();

    setItemReactionDeps(this.pickupSys, this.weaponSys, this.upgradePool, this.enemySys, this);

    this.waveEvents = new WaveEventSystem(this, this.ctx, this.enemySys, this.pickupSys, this.spawnDir, this.player);

    this.mapSys = new MapSystem(this, this.ctx, this.player, this.enemySys, this.weaponSys, this.pickupSys, this.upgradePool);
    this.mapSys.init();

    // Mapa expandido: world bounds + cámara con follow suave
    this.physics.world.setBounds(0, 0, MAP.WIDTH, MAP.HEIGHT);
    this.cameras.main.setBounds(0, 0, MAP.WIDTH, MAP.HEIGHT);
    this.cameras.main.startFollow(this.player.body, true, 0.1, 0.1);

    // FASE H — apply zoom setting (0 = auto/FIT, 1..3 = explicit zoom on main camera only)
    const _zoomSetting = saveForMeta.settings.zoom;
    if (_zoomSetting >= 1) {
      this.cameras.main.setZoom(_zoomSetting);
    }

    // Inyectar el viewport de cámara al SpawnDirector para spawns off-screen
    this.spawnDir.setViewportProvider(() => this.cameras.main.worldView);

    // Apuntado de armas al jefe/miniboss (no están en enemyPool).
    this.weaponSys.setBossTargetProvider(() => {
      if (this.miniboss?.alive) {
        // Comité: su body central está deshabilitado/fijo; apuntar al miembro vivo más cercano
        // (si no, las balas van a un punto muerto y no se le puede dañar).
        if (this.miniboss instanceof CommitteeBoss) {
          const bodies = this.miniboss.getAliveMemberBodies();
          if (bodies.length === 0) return null;
          let best = bodies[0].body;
          let bestD = Infinity;
          for (const { body } of bodies) {
            const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, body.x, body.y);
            if (d < bestD) { bestD = d; best = body; }
          }
          return { x: best.x, y: best.y };
        }
        return { x: this.miniboss.body.x, y: this.miniboss.body.y };
      }
      if (this.boss?.alive) return { x: this.boss.body.x, y: this.boss.body.y };
      return null;
    });

    // Starting weapon pick
    this.levelSys.grantUpgrade(true);
    if ((saveForMeta.metaUpgrades['starting_weapon'] ?? 0) >= 1) {
      this.levelSys.grantUpgrade(true);
    }

    // Phase 3 systems
    this.screenShake = new ScreenShake(this.cameras.main);
    this.damageNumbers = new DamageNumbers(this);
    this.particles = new ParticleBursts(this);
    this.effects = new EffectAnims(this);

    // Burnout vignette
    this.vignetteRect = this.add.rectangle(
      GAME.WIDTH / 2, GAME.HEIGHT / 2,
      GAME.WIDTH, GAME.HEIGHT,
      0xff0000, 0,
    ).setScrollFactor(0).setDepth(50).setAlpha(0);

    // Launch HUD overlay — pass levelSys reference for XP display
    this.scene.launch(SCENES.HUD, { ctx: this.ctx, levelSys: this.levelSys });

    // ---- EventBus subscriptions ----
    this.ctx.bus.on('player:died', () => this.handlePlayerDied());
    this.ctx.bus.on('boss:spawned', () => this.spawnBoss());
    this.ctx.bus.on('boss:defeated', () => this.handleBossDefeated());

    // §C — miniboss wiring
    this.ctx.bus.on('miniboss:spawn', (p: { id: string }) => this.spawnMiniboss(p.id));
    // §C — ink zone spawning from PrinterIndustrialBoss
    this.ctx.bus.on('miniboss:spawnZone', (p: { x: number; y: number; radius: number; dps: number; durationMs: number; color: number }) => {
      const z = this.zonePool.get(p.x, p.y) as import('@/entities/DamageZone').DamageZone | null;
      if (z) {
        z.spawn(p.x, p.y, p.radius, p.dps, p.durationMs);
        z.setFillStyle(p.color, 0.6);
      }
    });

    this.ctx.bus.on('wave:start', (p: { wave: number }) => {
      void p; // wave display handled by HUDScene
    });

    // §7.5 — wave:cleared triggers intermission flow (replaces wave:complete grantUpgrade)
    this.ctx.bus.on('wave:cleared', () => this.beginIntermission());

    // Curse picked mid-run
    this.ctx.bus.on('curse:applied', (p: { id: string }) => {
      this.weaponSys.recomputeWeaponMods();
      this.startCurseTimers(p.id);
    });

    this.ctx.bus.on('upgrade:weapon_selected', (p: { id: string }) => {
      this.weaponSys.addOrLevel(p.id);
      recomputeModifiers(this.ctx);
      this.weaponSys.recomputeWeaponMods();
    });

    // Venta de arma desde la tienda (libera slot; nunca deja al jugador sin armas).
    this.ctx.bus.on('weapon:sell', (p: { id: string }) => {
      this.weaponSys.removeWeapon(p.id);
      recomputeModifiers(this.ctx);
      this.weaponSys.recomputeWeaponMods();
    });
    this.ctx.bus.on('upgrade:item_selected', (p: { id: string }) => {
      if (p.id === 'benchmark' && !this.ctx.benchmarkWeaponId) {
        this.ctx.benchmarkWeaponId = this.weaponSys.topDamageWeaponId();
      }
      this.weaponSys.recomputeWeaponMods();
    });

    // §7.5 — SpawnDirector countdown callback → HUDScene
    this.spawnDir.setCountdownCallback((seconds: number) => {
      this.ctx.bus.emit('wave:countdown', { seconds });
    });

    // Phase 3 event hooks
    this.ctx.bus.on('player:hit', () => this.screenShake.play('PLAYER_HIT'));
    this.ctx.bus.on('enemy:killed', (p: { type: string; isElite: boolean; x: number; y: number }) => {
      if (p.isElite) this.screenShake.play('ELITE_KILLED');
      this.particles.onEnemyKilled(p.x, p.y, p.isElite);
      const fx = p.type === 'toxic_manager' ? 'toxic' : p.isElite ? 'elite' : 'death';
      this.effects.play(fx, p.x, p.y, p.isElite ? 1.3 : 1);
    });
    this.ctx.bus.on('boss:defeated', () => this.screenShake.play('BOSS_DEAD'));

    this.ctx.bus.on('enemy:hit', (p: { enemy: { x: number; y: number }; amount: number; isCritical: boolean }) => {
      this.damageNumbers.show({
        value: p.amount,
        x: p.enemy.x,
        y: p.enemy.y - 16,
        kind: p.isCritical ? 'crit' : 'normal',
      });
    });

    this.ctx.bus.on('player:hit', (p: { amount: number }) => {
      this.damageNumbers.show({
        value: p.amount,
        x: this.player.x,
        y: this.player.y - 20,
        kind: 'player',
      });
    });

    this.ctx.bus.on('player:burnout', () => this.updateVignette(true));
    this.ctx.bus.on('stress:changed', (p: { value: number }) => {
      this.updateVignette(p.value >= 90);
    });

    this.ctx.bus.on('player:level_up', (p: { level: number }) => {
      this.showLevelUpPopup(p.level);
      this.effects.play('levelup', this.player.x, this.player.y - 28);
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
      if (p.kind === 'moneda') this.effects.play('coin', this.player.x, this.player.y);
    });
    this.ctx.bus.on('player:burnout', () => this.audio.playBeep('burnout_start', 'sfx'));
    this.ctx.bus.on('boss:spawned', () => this.audio.playBeep('boss_appear', 'sfx'));
    this.ctx.bus.on('boss:defeated', () => this.audio.playBeep('boss_die', 'sfx'));

    this.ctx.bus.on('enemy:hit', (p: { enemy: unknown }) => {
      if (this.boss && p.enemy === this.boss.body) {
        this.screenShake.play('BOSS_HIT');
      }
    });

    // §7.5 — shop:closed → notify SpawnDirector to start countdown
    this.ctx.bus.on('shop:closed', () => {
      this.spawnDir.notifyIntermissionDone();
    });

    this.spawnDir.triggerFirstWave();
    installItemReactions(this.ctx);

    // §E2 cronometro_bala: slow time when triggered from Player.takeDamage — nuevo (fase E2)
    this.player.onCronometroActivate = () => {
      if (this.gameOver || this.victory) return;
      this.time.timeScale = ITEMS_E2.CRONO_TIME_SCALE;
      this.physics.world.timeScale = 1 / ITEMS_E2.CRONO_TIME_SCALE; // compensate player physics
      // Restore after real-time duration using a wall-clock callback (not scene time)
      const startWall = Date.now();
      const restore = (): void => {
        if (Date.now() - startWall >= ITEMS_E2.CRONO_DURATION_MS) {
          this.time.timeScale = 1;
          this.physics.world.timeScale = 1;
        } else {
          setTimeout(restore, 100);
        }
      };
      setTimeout(restore, ITEMS_E2.CRONO_DURATION_MS);
    };

    // Consultor Externo — "Por Hora"
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

    this.input.once('pointerdown', () => this.audio.resume());

    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
  }

  update(_time: number, delta: number): void {
    if (this.gameOver || this.victory) return;

    if (Phaser.Input.Keyboard.JustDown(this.escKey)) {
      this.scene.launch(SCENES.PAUSE);
      this.scene.pause();
      return;
    }

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

    // §7.2 — passive HP regen from stat upgrades
    if (this.ctx.modifiers.regenHpPerS > 0) {
      this.regenAccum += this.ctx.modifiers.regenHpPerS * delta / 1000;
      if (this.regenAccum >= 1) {
        const heal = Math.floor(this.regenAccum);
        this.regenAccum -= heal;
        this.ctx.player.hp = Math.min(this.ctx.player.maxHp, this.ctx.player.hp + heal);
      }
    }

    if (this.boss?.alive) {
      this.boss.update(_time, delta);
      const bossBody = this.boss.body;
      const dist = Phaser.Math.Distance.Between(bossBody.x, bossBody.y, this.player.x, this.player.y);
      if (dist < BOSS.CONTACT_RANGE) {
        this.player.takeDamage(BOSS.CONTACT_DAMAGE);
      }

      const maxHp = this.ctx.player.items.includes('ceo_memo') ? BOSS.HP * BOSS.CEO_MEMO_BOSS_HP_MULT : BOSS.HP;
      const ratio = Math.max(0, this.boss.hp / maxHp);
      this.ctx.bus.emit('boss:hp', { ratio });
    }

    // §C — miniboss update + contact damage
    if (this.miniboss?.alive) {
      this.miniboss.update(_time, delta);

      if (this.miniboss instanceof CommitteeBoss) {
        // Committee: check per-member contact
        for (const { body, damage } of this.miniboss.getAliveMemberBodies()) {
          const dist = Phaser.Math.Distance.Between(body.x, body.y, this.player.x, this.player.y);
          if (dist < MINIBOSS.COMMITTEE.SIZE / 2 + 16) {
            this.player.takeDamage(damage);
          }
        }
      } else {
        const dist = Phaser.Math.Distance.Between(
          this.miniboss.body.x, this.miniboss.body.y,
          this.player.x, this.player.y,
        );
        if (dist < MINIBOSS.CONTACT_RANGE) {
          this.player.takeDamage(this.minibossContactDamage());
        }
      }
    }

    if (this.ctx.player.items.includes('yolo') && this.ctx.player.stress < 90) {
      this.ctx.player.stress = 90;
    }

    // §E2 singularidad: trigger pull phase when kill threshold reached — nuevo (fase E2)
    if (this.ctx.player.items.includes('singularidad')) {
      if (!this.ctx.singularidadActive
        && this.ctx.singularidadKills >= ITEMS_E2.SINGULARIDAD_KILL_INTERVAL) {
        this.ctx.singularidadKills = 0;
        this.ctx.singularidadActive = true;
        // Visual indicator: brief flash ellipse at player position
        const sx = this.player.x;
        const sy = this.player.y;
        const indicator = this.add.ellipse(sx, sy, ITEMS_E2.SINGULARIDAD_RADIUS * 2, ITEMS_E2.SINGULARIDAD_RADIUS * 2, 0x220033, 0.35).setDepth(3);
        this.time.delayedCall(ITEMS_E2.SINGULARIDAD_DURATION_MS, () => {
          indicator.destroy();
          this.ctx.singularidadActive = false;
        });
        this._singularidadX = sx;
        this._singularidadY = sy;
      }
      if (this.ctx.singularidadActive) {
        this.enemySys.applySingularidadPull(this._singularidadX, this._singularidadY, delta);
      }
    }

    if (this.weaponSys.weapons.length > 0) {
      const now = _time;
      if (now - this.lastShootBeep > this.SHOOT_BEEP_MIN_MS) {
        this.lastShootBeep = now;
        this.audio.playBeep('shoot', 'sfx');
      }
    }
  }

  // ─── §7.5 Intermission flow ───────────────────────────────────────────────

  /**
   * Called when 'wave:cleared' fires.
   * Sequence: resolve pending level-ups (player-upgrade overlay) → open ShopOverlay → 4s countdown → next wave.
   */
  private beginIntermission(): void {
    this.resolveIntermissionLevels();
  }

  /**
   * Level-ups that happened during the wave are resolved first.
   * LevelSystem.update() drives them. We wait until none are pending, then open shop.
   * Since levelSys queues are consumed in update(), we just start checking.
   */
  private resolveIntermissionLevels(): void {
    // Check if any upgrade overlay is currently open; if so, wait for it to close
    // then open shop. We use a recurring check with delayedCall.
    this.checkLevelsResolved();
  }

  private checkLevelsResolved(): void {
    // If UpgradeOverlay is still active, wait
    const scenes = this.scene.manager.getScenes(true);
    const upgradeOpen = scenes.some(s => s.scene.key === SCENES.UPGRADE_OVERLAY);
    if (upgradeOpen) {
      this.time.delayedCall(100, () => this.checkLevelsResolved());
      return;
    }
    // All level-ups resolved — open shop
    this.openShop();
  }

  private openShop(): void {
    this.scene.launch(SCENES.SHOP, {
      ctx: this.ctx,
      onDone: () => {
        // shop:closed event will call spawnDir.notifyIntermissionDone()
      },
    });
    // Solo pausar si la escena sigue corriendo (evita "Cannot pause non-running Scene").
    if (this.scene.isActive()) this.scene.pause();
  }

  // ─── §7.4 Map drop callbacks ──────────────────────────────────────────────

  /** Grant a random eligible passive item (free, like shop). */
  /** Elige (sin aplicar) un id de ítem elegible y ponderado por rareza, o null. */
  private pickEligibleItemId(): string | null {
    const level = this.ctx.player.level;
    const pool = ITEMS.filter(item => {
      if (item.category === 'consumable') return false;
      if (this.ctx.player.items.includes(item.id)) return !item.maxStack || item.maxStack > 1;
      if (item.rarity === 'epic' && level < RARITY_RULES.EPIC_MIN_LEVEL) return false;
      if (item.rarity === 'legendary' && level < RARITY_RULES.LEGENDARY_MIN_LEVEL) return false;
      return true;
    });
    if (pool.length === 0) return null;

    const totalW = pool.reduce((s, i) => s + RARITY_WEIGHTS[i.rarity], 0);
    let rand = Math.random() * totalW;
    let picked = pool[pool.length - 1];
    for (const item of pool) {
      rand -= RARITY_WEIGHTS[item.rarity];
      if (rand <= 0) { picked = item; break; }
    }
    return picked.id;
  }

  /** Otorga el ítem pre-elegido (id). Si es null, elige uno al momento. */
  private grantSpecificItem(id: string | null): void {
    const itemId = id ?? this.pickEligibleItemId();
    if (!itemId) return;
    const def = ITEMS.find(i => i.id === itemId);
    if (!def) return;
    applyItemPickup(this.ctx, def);
    recomputeModifiers(this.ctx);
    this.weaponSys.recomputeWeaponMods();
  }

  /** Open a player-upgrade choice from a map drop. */
  private grantDropUpgrade(): void {
    this.levelSys.grantUpgrade(false, true);
  }

  // ─── Utilities ────────────────────────────────────────────────────────────

  private updateVignette(visible: boolean): void {
    // FASE H — respect vignette setting; if disabled, always hide
    const vignetteEnabled = SaveManager.load().settings.vignette;
    if (visible && vignetteEnabled) {
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

    this.tweens.add({
      targets: popup,
      scaleX: 1.2, scaleY: 1.2,
      duration: 200, ease: 'Bounce.Out',
      onComplete: () => {
        this.tweens.add({
          targets: popup,
          scaleX: 1.0, scaleY: 1.0,
          duration: 100,
          onComplete: () => {
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
    // Minibosses también emiten 'boss:spawned' (reusan la barra del HUD) DENTRO de su constructor,
    // antes de que `this.miniboss` quede asignado → guard por oleada: el CEO solo aparece en la
    // oleada del jefe final, nunca en las de miniboss (5/9/12).
    if (this.ctx.wave < WAVES.BOSS_WAVE) return;
    if (this.miniboss?.alive) return;
    if (this.boss) return;
    this.enemySys.killAll();
    this.boss = new CEOBoss(this, this.ctx, this.weaponSys, this.enemySys);
  }

  private spawnMiniboss(id: string): void {
    if (this.miniboss?.alive) return;
    this.enemySys.killAll();
    switch (id) {
      case 'supervisor':
        this.miniboss = new SupervisorBoss(this, this.ctx, this.weaponSys, this.enemySys);
        break;
      case 'printer_industrial':
        this.miniboss = new PrinterIndustrialBoss(this, this.ctx, this.weaponSys, this.enemySys);
        break;
      case 'committee':
        this.miniboss = new CommitteeBoss(this, this.ctx, this.weaponSys, this.enemySys);
        break;
      default:
        // Unknown id: skip
        break;
    }
  }

  private minibossContactDamage(): number {
    if (this.miniboss instanceof SupervisorBoss) return MINIBOSS.SUPERVISOR.CONTACT_DAMAGE;
    if (this.miniboss instanceof PrinterIndustrialBoss) return MINIBOSS.PRINTER_INDUSTRIAL.CONTACT_DAMAGE;
    return 14;
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
 */
function applyMetaUpgrades(ctx: RunContext, save: ReturnType<typeof SaveManager.load>): void {
  for (const upgrade of META_UPGRADES) {
    const level = save.metaUpgrades[upgrade.id] ?? 0;
    if (level <= 0) continue;

    if (upgrade.id === 'stress_resist') {
      ctx.metaStressMult = Math.pow(1 - META_STRESS_RESIST_PER_LEVEL, level);
    } else {
      ctx.player = upgrade.applyToPlayer(ctx.player, level);
    }
  }
}
