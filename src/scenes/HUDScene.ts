// src/scenes/HUDScene.ts
import Phaser from 'phaser';
import { SCENES, GAME, HUD, STRESS_COLORS, RUN_DURATION_S, PROGRESSION } from '@/config/game.config';
import type { RunContext } from '@/systems/RunContext';
import { formatTime } from '@/utils';

export class HUDScene extends Phaser.Scene {
  private ctx!: RunContext;

  // HP bar
  private hpBarFill!: Phaser.GameObjects.Rectangle;
  private hpLabel!: Phaser.GameObjects.Text;

  // Stress bar
  private stressBarFill!: Phaser.GameObjects.Rectangle;
  private stressLabel!: Phaser.GameObjects.Text;
  private stressPulseTween: Phaser.Tweens.Tween | null = null;

  // XP bar
  private xpBarFill!: Phaser.GameObjects.Rectangle;
  private xpLabel!: Phaser.GameObjects.Text;

  // Top info
  private coinText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private waveText!: Phaser.GameObjects.Text;

  // Weapon display (bottom-left)
  private weaponSlots: Phaser.GameObjects.Rectangle[] = [];
  private weaponLabels: Phaser.GameObjects.Text[] = [];
  private readonly MAX_WEAPON_SLOTS = 5;

  // Boss HP bar (full-width, top)
  private bossBarContainer!: Phaser.GameObjects.Container;
  private bossBarFill!: Phaser.GameObjects.Rectangle;
  private bossBarLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENES.HUD });
  }

  init(data: { ctx: RunContext }): void {
    this.ctx = data.ctx;
  }

  create(): void {
    const W = GAME.WIDTH;
    const H = GAME.HEIGHT;

    // ---- HP bar (top-left) ----
    const { HP_BAR, STRESS_BAR, XP_BAR } = HUD;
    this.add.rectangle(HP_BAR.x + HP_BAR.w / 2, HP_BAR.y + HP_BAR.h / 2, HP_BAR.w, HP_BAR.h, 0x440000);
    this.hpBarFill = this.add.rectangle(HP_BAR.x, HP_BAR.y + HP_BAR.h / 2, HP_BAR.w, HP_BAR.h, 0xcc2222).setOrigin(0, 0.5);
    this.hpLabel = this.add.text(HP_BAR.x, HP_BAR.y - 1, 'HP: 100/100', { fontSize: '11px', color: '#ffffff' }).setOrigin(0, 1);

    // ---- Stress bar (below HP) ----
    this.add.rectangle(STRESS_BAR.x + STRESS_BAR.w / 2, STRESS_BAR.y + STRESS_BAR.h / 2, STRESS_BAR.w, STRESS_BAR.h, 0x222200);
    this.stressBarFill = this.add.rectangle(STRESS_BAR.x, STRESS_BAR.y + STRESS_BAR.h / 2, STRESS_BAR.w, STRESS_BAR.h, STRESS_COLORS.RELAXED).setOrigin(0, 0.5);
    this.stressLabel = this.add.text(STRESS_BAR.x, STRESS_BAR.y - 1, 'ESTRÉS: 0', { fontSize: '11px', color: '#ffffff' }).setOrigin(0, 1);

    // ---- XP bar (bottom-center) ----
    const xpX = (W - XP_BAR.w) / 2;
    const xpY = H - XP_BAR.yFromBottom - XP_BAR.h;
    this.add.rectangle(xpX + XP_BAR.w / 2, xpY + XP_BAR.h / 2, XP_BAR.w, XP_BAR.h, 0x001133);
    this.xpBarFill = this.add.rectangle(xpX, xpY + XP_BAR.h / 2, XP_BAR.w, XP_BAR.h, 0x3399ff).setOrigin(0, 0.5);
    this.xpLabel = this.add.text(xpX - 4, xpY + XP_BAR.h / 2, 'Nivel 1', { fontSize: '11px', color: '#aaddff' }).setOrigin(1, 0.5);

    // ---- Coins (top-right) ----
    this.coinText = this.add.text(W - 12, HP_BAR.y + HP_BAR.h / 2, '🪙 0', {
      fontSize: '14px', color: '#ffd700',
    }).setOrigin(1, 0.5);

    // ---- Timer (top-center) ----
    this.timerText = this.add.text(W / 2, 10, '10:00', {
      fontSize: '18px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    // ---- Wave (below timer) ----
    this.waveText = this.add.text(W / 2, 32, 'Oleada 0', {
      fontSize: '13px', color: '#ffcc00',
    }).setOrigin(0.5, 0);

    // ---- Weapon slots (bottom-left) ----
    const slotW = 64;
    const slotH = 28;
    const slotGap = 4;
    for (let i = 0; i < this.MAX_WEAPON_SLOTS; i++) {
      const sx = 12 + i * (slotW + slotGap);
      const sy = H - 12 - slotH / 2;
      const rect = this.add.rectangle(sx + slotW / 2, sy, slotW, slotH, 0x222244).setOrigin(0.5).setVisible(false);
      const lbl = this.add.text(sx + slotW / 2, sy, '', { fontSize: '9px', color: '#aaaaff', align: 'center' }).setOrigin(0.5).setVisible(false);
      this.weaponSlots.push(rect);
      this.weaponLabels.push(lbl);
    }

    // ---- Boss bar (full-width top, hidden) ----
    const bossBarH = 12;
    const bossBarY = 0;
    const bossBarBg = this.add.rectangle(W / 2, bossBarY + bossBarH / 2, W, bossBarH, 0x440000).setOrigin(0.5);
    this.bossBarFill = this.add.rectangle(0, bossBarY + bossBarH / 2, W, bossBarH, 0xff2222).setOrigin(0, 0.5);
    this.bossBarLabel = this.add.text(W / 2, bossBarY + bossBarH / 2, 'CEO', {
      fontSize: '10px', color: '#ffffff',
    }).setOrigin(0.5);
    this.bossBarContainer = this.add.container(0, 0, [bossBarBg, this.bossBarFill, this.bossBarLabel]);
    this.bossBarContainer.setVisible(false);

    // ---- EventBus subscriptions ----
    const bus = this.ctx.bus;
    bus.on('boss:spawned', () => this.bossBarContainer.setVisible(true));
    bus.on('boss:defeated', () => this.bossBarContainer.setVisible(false));
    bus.on('boss:hp', (p: { ratio: number }) => {
      this.bossBarFill.width = Math.max(0, p.ratio) * W;
    });
  }

  update(): void {
    const p = this.ctx.player;
    const { HP_BAR, STRESS_BAR, XP_BAR } = HUD;

    // HP bar
    const hpRatio = Math.max(0, p.hp / p.maxHp);
    this.hpBarFill.width = hpRatio * HP_BAR.w;
    this.hpLabel.setText(`HP: ${Math.ceil(p.hp)}/${p.maxHp}`);

    // Stress bar
    const stressRatio = Math.max(0, Math.min(1, p.stress / 100));
    this.stressBarFill.width = stressRatio * STRESS_BAR.w;
    this.stressLabel.setText(`ESTRÉS: ${Math.floor(p.stress)}`);

    // Stress color
    const stressColor = this.stressColor(p.stress);
    this.stressBarFill.setFillStyle(stressColor);

    // Stress 90+ pulse
    if (p.stress >= 90) {
      if (!this.stressPulseTween || !this.stressPulseTween.isPlaying()) {
        this.stressPulseTween = this.tweens.add({
          targets: this.stressBarFill,
          alpha: { from: 1.0, to: HUD.PULSE_ALPHA_MIN },
          duration: HUD.PULSE_MS,
          yoyo: true,
          repeat: -1,
        });
      }
    } else {
      if (this.stressPulseTween && this.stressPulseTween.isPlaying()) {
        this.stressPulseTween.stop();
        this.stressPulseTween = null;
        this.stressBarFill.setAlpha(1);
      }
    }

    // XP bar (matches LevelSystem.xpToNext base; becario learning curve not reflected — cosmetic)
    const xpNeeded = p.level * PROGRESSION.XP_PER_LEVEL_MULTIPLIER;
    const xpRatio = Math.min(1, p.xp / xpNeeded);
    this.xpBarFill.width = xpRatio * XP_BAR.w;
    this.xpLabel.setText(`Nivel ${p.level}`);

    // Coins
    this.coinText.setText(`🪙 ${p.coins}`);

    // Timer (countdown from RUN_DURATION_S)
    const remaining = Math.max(0, RUN_DURATION_S - this.ctx.elapsedS);
    this.timerText.setText(formatTime(remaining));
    // Red when <= 60s remaining
    this.timerText.setColor(remaining <= 60 ? '#ff4444' : '#ffffff');

    // Wave
    const waveStr = this.ctx.infinite
      ? `Oleada ${this.ctx.wave}`
      : `Oleada ${this.ctx.wave} / 10`;
    this.waveText.setText(waveStr);

    // Weapon slots
    const weapons = p.weapons;
    const wLevels = this.ctx.weaponLevels;
    for (let i = 0; i < this.MAX_WEAPON_SLOTS; i++) {
      if (i < weapons.length) {
        const wid = weapons[i];
        const lvl = wLevels[wid] ?? 1;
        const abbr = wid.slice(0, 6);
        this.weaponSlots[i].setVisible(true);
        this.weaponLabels[i].setText(`${abbr}\nLv${lvl}`).setVisible(true);
      } else {
        this.weaponSlots[i].setVisible(false);
        this.weaponLabels[i].setVisible(false);
      }
    }
  }

  private stressColor(stress: number): number {
    if (stress <= 30) return STRESS_COLORS.RELAXED;
    if (stress <= 69) return STRESS_COLORS.TENSE;
    if (stress <= 89) return STRESS_COLORS.LIMIT;
    return STRESS_COLORS.BURNOUT;
  }
}
