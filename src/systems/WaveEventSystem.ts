import Phaser from 'phaser';
import { GAME, WAVE_EVENTS, WAVES } from '@/config/game.config';
import type { RunContext } from './RunContext';
import type { EnemySystem } from './EnemySystem';
import type { PickupSystem } from './PickupSystem';
import type { SpawnDirector } from './SpawnDirector';
import type { Player } from '@/entities/Player';

type EventId = 'blackout' | 'all_hands' | 'surprise_audit' | 'free_coffee' | 'printer_jam';

const EVENT_NAMES: Record<EventId, string> = {
  blackout: 'APAGÓN — SE VAN LAS LUCES',
  all_hands: 'ALL HANDS MEETING — ENEMIGOS ACELERADOS',
  surprise_audit: 'AUDITORÍA SORPRESA',
  free_coffee: 'CAFÉ GRATIS',
  printer_jam: 'ATASCO DE IMPRESORA — ARMAS FALLAN',
};

/**
 * Triggers a special event every N waves (weighted). Pure presentation/feedback layer over
 * gameplay — only flips ctx event flags (enemySpeedMult, weaponJamChance), spawns pickups/auditors,
 * and renders a blackout overlay. Subscribes to wave:start (bus reset per run).
 */
export class WaveEventSystem {
  private scene: Phaser.Scene;
  private ctx: RunContext;
  private enemySys: EnemySystem;
  private pickupSys: PickupSystem;
  private spawnDir: SpawnDirector;
  private player: Player;

  private allHandsTimer = 0;
  private printerJamTimer = 0;
  private blackoutTimer = 0;
  private blackoutRect: Phaser.GameObjects.Rectangle | null = null;
  private blackoutMaskShape: Phaser.GameObjects.Graphics | null = null;

  constructor(
    scene: Phaser.Scene, ctx: RunContext, enemySys: EnemySystem,
    pickupSys: PickupSystem, spawnDir: SpawnDirector, player: Player,
  ) {
    this.scene = scene;
    this.ctx = ctx;
    this.enemySys = enemySys;
    this.pickupSys = pickupSys;
    this.spawnDir = spawnDir;
    this.player = player;
    ctx.bus.on('wave:start', this.onWaveStart);
  }

  private onWaveStart = (p: { wave: number }): void => {
    const w = p.wave;
    if (w < WAVE_EVENTS.FIRST_EVENT_MIN_WAVE) return;
    if (w % WAVE_EVENTS.TRIGGER_EVERY_N_WAVES !== 0) return;
    if (w >= WAVES.BOSS_WAVE) return; // no events on the boss wave
    const ev = this.pickEvent();
    this.showBanner(ev);
    this.scene.time.delayedCall(WAVE_EVENTS.BANNER_MS, () => this.apply(ev));
  };

  private pickEvent(): EventId {
    const entries = Object.entries(WAVE_EVENTS.WEIGHTS) as [EventId, number][];
    const total = entries.reduce((s, [, v]) => s + v, 0);
    let r = Math.random() * total;
    for (const [id, w] of entries) { r -= w; if (r <= 0) return id; }
    return entries[0][0];
  }

  private showBanner(ev: EventId): void {
    const txt = this.scene.add.text(GAME.WIDTH / 2, 90, `⚠ ${EVENT_NAMES[ev]}`, {
      fontSize: '20px', color: '#ff5555', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(70);
    this.scene.tweens.add({
      targets: txt, alpha: 0.2, duration: 400, yoyo: true, repeat: Math.floor(WAVE_EVENTS.BANNER_MS / 800),
      onComplete: () => txt.destroy(),
    });
  }

  private apply(ev: EventId): void {
    switch (ev) {
      case 'blackout':
        this.startBlackout();
        break;
      case 'all_hands':
        this.ctx.enemySpeedMult = WAVE_EVENTS.ALL_HANDS_SPEED_MULT;
        this.allHandsTimer = WAVE_EVENTS.ALL_HANDS_MS;
        break;
      case 'surprise_audit':
        this.spawnDir.cancelCurrentWaveSpawns();
        for (let i = 0; i < WAVE_EVENTS.SURPRISE_AUDIT_COUNT; i++) {
          const pos = this.edgePos();
          this.enemySys.spawn('auditor', pos.x, pos.y);
        }
        break;
      case 'free_coffee':
        this.pickupSys.spawnCafes(WAVE_EVENTS.FREE_COFFEE_COUNT);
        break;
      case 'printer_jam':
        this.ctx.weaponJamChance = WAVE_EVENTS.PRINTER_JAM_CHANCE;
        this.printerJamTimer = WAVE_EVENTS.PRINTER_JAM_MS;
        break;
    }
  }

  update(delta: number): void {
    if (this.allHandsTimer > 0) {
      this.allHandsTimer -= delta;
      if (this.allHandsTimer <= 0) this.ctx.enemySpeedMult = 1;
    }
    if (this.printerJamTimer > 0) {
      this.printerJamTimer -= delta;
      if (this.printerJamTimer <= 0) this.ctx.weaponJamChance = 0;
    }
    if (this.blackoutTimer > 0) {
      this.blackoutTimer -= delta;
      this.drawBlackoutMask();
      if (this.blackoutTimer <= 0) this.endBlackout();
    }
  }

  private startBlackout(): void {
    if (!this.blackoutRect) {
      this.blackoutRect = this.scene.add.rectangle(
        GAME.WIDTH / 2, GAME.HEIGHT / 2, GAME.WIDTH, GAME.HEIGHT, 0x000000, WAVE_EVENTS.BLACKOUT_ALPHA,
      ).setScrollFactor(0).setDepth(45);
      this.blackoutMaskShape = this.scene.make.graphics({});
      const mask = this.blackoutMaskShape.createGeometryMask();
      mask.invertAlpha = true; // dark everywhere EXCEPT the circle around the player
      this.blackoutRect.setMask(mask);
    }
    this.blackoutRect.setVisible(true);
    this.blackoutTimer = WAVE_EVENTS.BLACKOUT_MS;
    this.drawBlackoutMask();
  }

  private drawBlackoutMask(): void {
    if (!this.blackoutMaskShape) return;
    this.blackoutMaskShape.clear();
    this.blackoutMaskShape.fillStyle(0xffffff);
    this.blackoutMaskShape.fillCircle(this.player.x, this.player.y, WAVE_EVENTS.BLACKOUT_RADIUS);
  }

  private endBlackout(): void {
    this.blackoutRect?.setVisible(false);
    this.blackoutMaskShape?.clear();
  }

  private edgePos(): { x: number; y: number } {
    const m = 40;
    switch (Math.floor(Math.random() * 4)) {
      case 0: return { x: Math.random() * GAME.WIDTH, y: -m };
      case 1: return { x: Math.random() * GAME.WIDTH, y: GAME.HEIGHT + m };
      case 2: return { x: -m, y: Math.random() * GAME.HEIGHT };
      default: return { x: GAME.WIDTH + m, y: Math.random() * GAME.HEIGHT };
    }
  }
}
