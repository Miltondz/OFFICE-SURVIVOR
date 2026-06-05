// src/scenes/HUDScene.ts
import Phaser from 'phaser';
import { SCENES, GAME, HUD, STRESS_COLORS, RUN_DURATION_S } from '@/config/game.config';
import type { RunContext } from '@/systems/RunContext';
import { LevelSystem } from '@/systems/LevelSystem';
import { formatTime } from '@/utils';
import { getWeaponById, getItemById } from '@/config/items.config';
import { getCurseById } from '@/config/curses.config';
import { iconKey } from '@/config/icons.config';

const STRESS_AR = 203 / 1292;
const HP_BAR_H = 16;

// §7.8 — Inventario en columna vertical (1 columna)
const INV_X = 16;
const INV_Y = 116;
const INV_SIZE = 28;
const INV_GAP = 5;
const INV_COLS = 1;   // §7.8: era 2

// Barra de XP
const XP_W = 360;
const XP_H = 14;

// §7.7 — Stress state definitions
interface StressStateInfo {
  name: string;
  effect: string;
  tooltip: string;
  minStress: number;
  maxStress: number;
}

const STRESS_STATES: StressStateInfo[] = [
  {
    name: 'RELAJADO',
    effect: '−10% daño',
    tooltip: 'Sin presión. Daño −10%.',
    minStress: 0, maxStress: 30,
  },
  {
    name: 'TENSO',
    effect: '',
    tooltip: 'Normal. Sin bonificadores ni penalizaciones.',
    minStress: 31, maxStress: 69,
  },
  {
    name: 'AL LÍMITE',
    effect: '+20% daño · +10% vel',
    tooltip: 'Al límite. Daño +20%, Vel +10%.',
    minStress: 70, maxStress: 89,
  },
  {
    name: '¡BURNOUT!',
    effect: '+40% daño · −2 HP/s',
    tooltip: '¡Burnout! Daño +40%, drena 2 HP/s.',
    minStress: 90, maxStress: 99,
  },
  {
    name: '⚠ COLAPSO',
    effect: '¡MUERTE INMINENTE!',
    tooltip: 'Colapso: muerte instantánea.',
    minStress: 100, maxStress: 100,
  },
];

const STRESS_TOOLTIP_FULL =
  'ESTRÉS — Tabla de estados:\n' +
  '0–30  RELAJADO    Daño −10%\n' +
  '31–69 TENSO       Normal\n' +
  '70–89 AL LÍMITE   Daño +20%, Vel +10%\n' +
  '90–99 BURNOUT     Daño +40%, −2 HP/s\n' +
  '100   COLAPSO     Muerte\n\n' +
  'Matar reduce el estrés. Recibir daño lo sube.';

export class HUDScene extends Phaser.Scene {
  private ctx!: RunContext;
  private levelSysRef: LevelSystem | null = null;

  private hpFill!: Phaser.GameObjects.Rectangle;
  private hpLabel!: Phaser.GameObjects.Text;

  private stressFill!: Phaser.GameObjects.Rectangle;
  private stressLabel!: Phaser.GameObjects.Text;
  private stressStateName!: Phaser.GameObjects.Text;
  private stressEffectLine!: Phaser.GameObjects.Text;
  private stressPulseTween: Phaser.Tweens.Tween | null = null;

  private xpFill!: Phaser.GameObjects.Rectangle;
  private xpFillX = 0;
  private levelText!: Phaser.GameObjects.Text;
  private xpText!: Phaser.GameObjects.Text;

  private coinText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;

  // Countdown display (§7.5 intermission)
  private countdownText!: Phaser.GameObjects.Text;

  // Inventario
  private invObjects: Phaser.GameObjects.GameObject[] = [];
  private invCount = -1;

  // Tooltip
  private tipBg!: Phaser.GameObjects.Rectangle;
  private tipText!: Phaser.GameObjects.Text;

  // Stress tooltip
  private stressTipBg!: Phaser.GameObjects.Rectangle;
  private stressTipText!: Phaser.GameObjects.Text;

  // Boss bar
  private bossBarContainer!: Phaser.GameObjects.Container;
  private bossBarFill!: Phaser.GameObjects.Rectangle;

  // §7.7 burnout toast
  private burnoutToast: Phaser.GameObjects.Text | null = null;
  private prevStressState = '';

  constructor() {
    super({ key: SCENES.HUD });
  }

  init(data: { ctx: RunContext; levelSys?: LevelSystem }): void {
    this.ctx = data.ctx;
    this.levelSysRef = data.levelSys ?? null;
  }

  create(): void {
    const W = GAME.WIDTH;
    const H = GAME.HEIGHT;
    const { HP_BAR, STRESS_BAR } = HUD;

    // ---- Boss bar (franja superior, oculta) ----
    const bossH = 10;
    const bossBg = this.add.rectangle(W / 2, bossH / 2, W, bossH, 0x440000).setOrigin(0.5);
    this.bossBarFill = this.add.rectangle(0, bossH / 2, W, bossH, 0xff2222).setOrigin(0, 0.5);
    const bossLbl = this.add.text(W / 2, bossH / 2, 'CEO', { fontSize: '9px', color: '#ffffff' }).setOrigin(0.5);
    this.bossBarContainer = this.add.container(0, 0, [bossBg, this.bossBarFill, bossLbl]).setDepth(6).setVisible(false);

    // ---- Timer + Oleada (centro-arriba) ----
    this.timerText = this.add.text(W / 2, 14, '10:00', {
      fontSize: '20px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(3);
    this.waveText = this.add.text(W / 2, 40, 'Oleada 0', {
      fontSize: '13px', color: '#ffcc00', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5, 0).setDepth(3);

    // ---- Countdown display (§7.5) ----
    this.countdownText = this.add.text(W / 2, H / 2 - 40, '', {
      fontSize: '48px', color: '#ffff00', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(20).setScrollFactor(0).setVisible(false);

    // ---- HP bar (codificada: track + relleno rojo) ----
    this.add.rectangle(HP_BAR.x, HP_BAR.y, HP_BAR.w, HP_BAR_H, 0x3a0a0a).setOrigin(0, 0).setStrokeStyle(2, 0x7f0000).setDepth(1);
    this.hpFill = this.add.rectangle(HP_BAR.x + 2, HP_BAR.y + HP_BAR_H / 2, HP_BAR.w - 4, HP_BAR_H - 4, 0xe53935).setOrigin(0, 0.5).setDepth(2);
    this.hpLabel = this.add.text(HP_BAR.x, HP_BAR.y - 1, 'HP: 100/100', {
      fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 1).setDepth(3);

    // ---- §7.7 Stress bar + state/effect labels ----
    const stH = STRESS_BAR.w * STRESS_AR;
    this.add.image(STRESS_BAR.x, STRESS_BAR.y, 'ui_stress_bar').setOrigin(0, 0).setDisplaySize(STRESS_BAR.w, stH).setDepth(1);
    this.stressFill = this.add.rectangle(STRESS_BAR.x + 4, STRESS_BAR.y + stH / 2, 0, stH - 8, STRESS_COLORS.RELAXED).setOrigin(0, 0.5).setDepth(2);
    this.stressLabel = this.add.text(STRESS_BAR.x, STRESS_BAR.y - 1, 'ESTRÉS: 0', {
      fontSize: '11px', color: '#ffffff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0, 1).setDepth(3);

    // State name + effect (to the right of the bar label)
    const stateX = STRESS_BAR.x + STRESS_BAR.w + 8;
    const stateY = STRESS_BAR.y + stH / 2 - 8;
    this.stressStateName = this.add.text(stateX, stateY, '', {
      fontSize: '10px', color: '#ffcc88', fontStyle: 'bold', stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0, 0).setDepth(3);
    this.stressEffectLine = this.add.text(stateX, stateY + 13, '', {
      fontSize: '9px', color: '#aaaacc', stroke: '#000000', strokeThickness: 1,
    }).setOrigin(0, 0).setDepth(3);

    // Stress bar hover tooltip zone
    const stressTipZone = this.add.rectangle(
      STRESS_BAR.x + STRESS_BAR.w / 2, STRESS_BAR.y + stH / 2,
      STRESS_BAR.w, stH + 4,
      0x000000, 0,
    ).setOrigin(0.5).setInteractive({ useHandCursor: false }).setDepth(4);

    this.stressTipBg = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.92)
      .setOrigin(0, 0).setStrokeStyle(1, 0x5555aa).setDepth(50).setVisible(false);
    this.stressTipText = this.add.text(0, 0, '', {
      fontSize: '10px', color: '#ffffff', wordWrap: { width: 220 }, padding: { x: 6, y: 5 },
    }).setOrigin(0, 0).setDepth(51).setVisible(false);

    stressTipZone.on('pointerover', () => this.showStressTooltip(STRESS_BAR.x + STRESS_BAR.w + 4, STRESS_BAR.y));
    stressTipZone.on('pointerout', () => this.hideStressTooltip());

    // ---- Coins (arriba-der) ----
    this.coinText = this.add.text(W - 12, 16, '🪙 0', {
      fontSize: '15px', color: '#ffd700', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(1, 0.5).setDepth(3);

    // ---- Barra XP (abajo-centro) ----
    const xpX = (W - XP_W) / 2;
    const xpY = H - 24;
    this.add.rectangle(xpX, xpY, XP_W, XP_H, 0x0a1830).setOrigin(0, 0.5).setStrokeStyle(2, 0x0d47a1);
    this.xpFillX = xpX + 2;
    this.xpFill = this.add.rectangle(this.xpFillX, xpY, 0, XP_H - 4, 0x33aaff).setOrigin(0, 0.5);
    this.levelText = this.add.text(xpX - 12, xpY, 'NIVEL 1', {
      fontSize: '16px', color: '#ffe680', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(1, 0.5).setDepth(3);
    this.xpText = this.add.text(xpX + XP_W / 2, xpY, '', {
      fontSize: '10px', color: '#cfe8ff', stroke: '#000000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(3);

    // ---- Tooltip (oculto) ----
    this.tipBg = this.add.rectangle(0, 0, 10, 10, 0x000000, 0.9).setOrigin(0, 0).setStrokeStyle(1, 0x6666aa).setDepth(40).setVisible(false);
    this.tipText = this.add.text(0, 0, '', {
      fontSize: '11px', color: '#ffffff', wordWrap: { width: 200 }, padding: { x: 6, y: 5 },
    }).setOrigin(0, 0).setDepth(41).setVisible(false);

    // ---- Boss events ----
    const bus = this.ctx.bus;
    bus.on('boss:spawned', () => this.bossBarContainer.setVisible(true));
    bus.on('boss:defeated', () => this.bossBarContainer.setVisible(false));
    bus.on('boss:hp', (p: { ratio: number }) => { this.bossBarFill.width = Math.max(0, p.ratio) * W; });

    // ---- Shop visibility (hide HUD while shop is open) ----
    bus.on('shop:opened', () => this.scene.setVisible(false));
    bus.on('shop:closed', () => this.scene.setVisible(true));

    // ---- §7.5 Countdown from SpawnDirector ----
    bus.on('wave:countdown', (p: { seconds: number }) => this.showCountdown(p.seconds));
  }

  update(): void {
    const p = this.ctx.player;
    const { HP_BAR, STRESS_BAR } = HUD;

    // HP
    const hpRatio = Math.max(0, Math.min(1, p.hp / p.maxHp));
    this.hpFill.width = hpRatio * (HP_BAR.w - 4);
    this.hpLabel.setText(`HP: ${Math.ceil(p.hp)}/${p.maxHp}`);

    // Stress
    const stressRatio = Math.max(0, Math.min(1, p.stress / 100));
    const stH = STRESS_BAR.w * (203 / 1292);
    this.stressFill.width = stressRatio * (STRESS_BAR.w - 8);
    this.stressFill.setFillStyle(this.stressColor(p.stress));
    this.stressLabel.setText(`ESTRÉS: ${Math.floor(p.stress)}`);
    void stH;

    // §7.7 State name + effect sublabel
    const stateInfo = this.getStressStateInfo(p.stress);
    this.stressStateName.setText(stateInfo.name);
    this.stressEffectLine.setText(stateInfo.effect);

    // §7.7 Burnout toast on entering Burnout
    if (stateInfo.name === '¡BURNOUT!' && this.prevStressState !== '¡BURNOUT!') {
      this.showBurnoutToast();
    }
    this.prevStressState = stateInfo.name;

    // Burnout pulse
    if (p.stress >= 90) {
      if (!this.stressPulseTween || !this.stressPulseTween.isPlaying()) {
        this.stressPulseTween = this.tweens.add({
          targets: this.stressFill, alpha: { from: 1, to: HUD.PULSE_ALPHA_MIN }, duration: HUD.PULSE_MS, yoyo: true, repeat: -1,
        });
      }
    } else if (this.stressPulseTween && this.stressPulseTween.isPlaying()) {
      this.stressPulseTween.stop();
      this.stressPulseTween = null;
      this.stressFill.setAlpha(1);
    }

    // XP + nivel — §7.6 new formula
    const need = this.levelSysRef
      ? this.levelSysRef.xpToNext(p.level)
      : Math.round(26 * Math.pow(p.level, 1.45)); // fallback
    const ratio = Math.max(0, Math.min(1, p.xp / need));
    this.xpFill.width = ratio * (XP_W - 4);
    this.levelText.setText(`NIVEL ${p.level}`);
    this.xpText.setText(`${Math.floor(p.xp)} / ${need} XP`);

    // Coins
    this.coinText.setText(`🪙 ${p.coins}`);

    // Timer
    const remaining = Math.max(0, RUN_DURATION_S - this.ctx.elapsedS);
    this.timerText.setText(formatTime(remaining));
    this.timerText.setColor(remaining <= 60 ? '#ff4444' : '#ffffff');

    // Wave
    this.waveText.setText(this.ctx.infinite ? `Oleada ${this.ctx.wave}` : `Oleada ${this.ctx.wave} / 10`);

    // Inventario (reconstruir si cambió la cantidad)
    const total = p.weapons.length + p.items.length;
    if (total !== this.invCount) {
      this.invCount = total;
      this.rebuildInventory();
    }
  }

  // §7.5 — countdown display
  showCountdown(seconds: number): void {
    if (seconds <= 0) {
      this.countdownText.setVisible(false);
      return;
    }
    const wavePending = this.ctx.wave + 1;
    this.countdownText.setText(`OLEADA ${wavePending} — PREPÁRATE\n${seconds}`);
    this.countdownText.setVisible(true);

    this.tweens.add({
      targets: this.countdownText,
      scaleX: { from: 1.3, to: 1.0 },
      scaleY: { from: 1.3, to: 1.0 },
      duration: 250, ease: 'Cubic.Out',
    });
  }

  // §7.7 — Burnout toast
  private showBurnoutToast(): void {
    if (this.burnoutToast) {
      this.burnoutToast.destroy();
      this.burnoutToast = null;
    }
    const cx = GAME.WIDTH / 2;
    const cy = 120;
    this.burnoutToast = this.add.text(cx, cy, '¡BURNOUT! +40% daño, +25% vel, −2 HP/s', {
      fontSize: '16px', color: '#ff4444', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(25).setScrollFactor(0);

    this.tweens.add({
      targets: this.burnoutToast,
      y: cy - 30,
      alpha: 0,
      duration: 3000,
      ease: 'Cubic.Out',
      onComplete: () => {
        this.burnoutToast?.destroy();
        this.burnoutToast = null;
      },
    });
  }

  private getStressStateInfo(stress: number): StressStateInfo {
    for (const s of STRESS_STATES) {
      if (stress >= s.minStress && stress <= s.maxStress) return s;
    }
    return STRESS_STATES[STRESS_STATES.length - 1];
  }

  private showStressTooltip(x: number, y: number): void {
    this.stressTipText.setText(STRESS_TOOLTIP_FULL);
    const w = this.stressTipText.width + 4;
    const h = this.stressTipText.height + 4;
    const px = Math.min(x, GAME.WIDTH - w - 4);
    const py = Math.min(y, GAME.HEIGHT - h - 4);
    this.stressTipText.setPosition(px + 2, py + 2).setVisible(true);
    this.stressTipBg.setPosition(px, py).setSize(w, h).setVisible(true);
  }

  private hideStressTooltip(): void {
    this.stressTipBg.setVisible(false);
    this.stressTipText.setVisible(false);
  }

  private rebuildInventory(): void {
    this.invObjects.forEach(o => o.destroy());
    this.invObjects = [];
    this.hideTooltip();

    const ids = [...this.ctx.player.weapons, ...this.ctx.player.items];
    ids.forEach((id, i) => {
      // §7.8 — single column (INV_COLS=1)
      const col = i % INV_COLS;
      const row = Math.floor(i / INV_COLS);
      const x = INV_X + col * (INV_SIZE + INV_GAP);
      const y = INV_Y + row * (INV_SIZE + INV_GAP);

      const frame = this.add.rectangle(x, y, INV_SIZE, INV_SIZE, 0x111120, 0.8).setOrigin(0, 0).setStrokeStyle(1, 0x44445e).setDepth(4);
      this.invObjects.push(frame);

      const key = iconKey(id);
      if (this.textures.exists(key)) {
        this.invObjects.push(this.add.image(x + INV_SIZE / 2, y + INV_SIZE / 2, key).setDisplaySize(INV_SIZE - 4, INV_SIZE - 4).setDepth(5));
      } else {
        this.invObjects.push(this.add.text(x + INV_SIZE / 2, y + INV_SIZE / 2, id.slice(0, 3), { fontSize: '8px', color: '#99a' }).setOrigin(0.5).setDepth(5));
      }

      // Tooltip hitzone — §7.8 tooltip stays to the right (x + INV_SIZE + 4)
      const hit = this.add.rectangle(x, y, INV_SIZE, INV_SIZE, 0x000000, 0).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(6);
      hit.on('pointerover', () => this.showTooltip(id, x + INV_SIZE + 4, y));
      hit.on('pointerout', () => this.hideTooltip());
      this.invObjects.push(hit);
    });
  }

  private lookup(id: string): { name: string; desc: string } {
    const w = getWeaponById(id);
    if (w) return { name: w.name + ' (arma)', desc: w.description };
    const it = getItemById(id);
    if (it) return { name: it.name, desc: it.description };
    const c = getCurseById(id);
    if (c) return { name: c.name, desc: c.description + (c.cursePower ? '\n' + c.cursePower : '') };
    return { name: id, desc: '' };
  }

  private showTooltip(id: string, x: number, y: number): void {
    const { name, desc } = this.lookup(id);
    this.tipText.setText(`${name}\n${desc}`);
    const w = this.tipText.width + 4;
    const h = this.tipText.height + 4;
    const px = Math.min(x, GAME.WIDTH - w - 4);
    const py = Math.min(y, GAME.HEIGHT - h - 4);
    this.tipText.setPosition(px + 2, py + 2).setVisible(true);
    this.tipBg.setPosition(px, py).setSize(w, h).setVisible(true);
  }

  private hideTooltip(): void {
    this.tipBg.setVisible(false);
    this.tipText.setVisible(false);
  }

  private stressColor(stress: number): number {
    if (stress <= 30) return STRESS_COLORS.RELAXED;
    if (stress <= 69) return STRESS_COLORS.TENSE;
    if (stress <= 89) return STRESS_COLORS.LIMIT;
    return STRESS_COLORS.BURNOUT;
  }
}
