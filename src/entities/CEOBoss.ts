import Phaser from 'phaser';
import { BOSS, ECONOMY, COLORS_GAME, FEEL } from '@/config/game.config';
import type { RunContext } from '@/systems/RunContext';
import type { WeaponSystem } from '@/systems/WeaponSystem';
import type { EnemySystem } from '@/systems/EnemySystem';
import { Projectile } from './Projectile';

type CEOPhase = 'phase1' | 'phase2';
type CEOAttack = 'memo' | 'reunion' | 'revision' | 'restructuring' | 'idle';

export class CEOBoss {
  body!: Phaser.GameObjects.Rectangle;
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private hasSprite = false;
  private attackFrameTimer = 0;     // ms restantes mostrando frame de ataque
  private hpBarBg!: Phaser.GameObjects.Rectangle;
  private hpBar!: Phaser.GameObjects.Rectangle;
  private hpText!: Phaser.GameObjects.Text;

  private scene: Phaser.Scene;
  private ctx: RunContext;
  private enemySys: EnemySystem;

  hp: number;
  phase: CEOPhase = 'phase1';
  private currentAttack: CEOAttack = 'idle';
  private attackTimer = 0;
  private memoTimer = 0;
  private reunionTimer = 0;
  private revisionTimer = 0;
  private restructuringTimer = 0;

  private chargeWindup = 0;
  private charging = false;
  private chargeTarget = { x: 0, y: 0 };

  alive = false;

  constructor(scene: Phaser.Scene, ctx: RunContext, _weaponSys: WeaponSystem, enemySys: EnemySystem) {
    this.scene = scene;
    this.ctx = ctx;
    this.enemySys = enemySys;
    this.hp = BOSS.HP;

    // CEO Memo item: boss +50% HP
    if (ctx.player.items.includes('ceo_memo')) {
      this.hp = Math.floor(BOSS.HP * 1.5);
    }

    const cx = scene.scale.width / 2;
    const cy = 80;

    this.body = scene.add.rectangle(cx, cy, BOSS.SIZE, BOSS.SIZE, COLORS_GAME.BOSS);
    scene.physics.add.existing(this.body);
    const physBody = this.body.body as Phaser.Physics.Arcade.Body;
    physBody.setCollideWorldBounds(true);

    // Sprite visual del CEO (el rect queda como cuerpo invisible). Fallback al rect si no hay hoja.
    this.hasSprite = scene.textures.exists('boss_ceo');
    if (this.hasSprite) {
      this.sprite = scene.add.sprite(cx, cy, 'boss_ceo', BOSS.IDLE_P1[0])
        .setScale(BOSS.DISPLAY_H / BOSS.SHEET_FRAME_H).setDepth(3);
      this.sprite.play('ceo_idle_p1');
      this.body.setVisible(false);
    }

    // HP bar
    this.hpBarBg = scene.add.rectangle(cx, cy - BOSS.SIZE / 2 - 10, 200, 8, 0x440000);
    this.hpBar = scene.add.rectangle(cx, cy - BOSS.SIZE / 2 - 10, 200, 8, 0xff2222);
    this.hpText = scene.add.text(cx, cy - BOSS.SIZE / 2 - 22, 'CEO', {
      fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5);

    this.alive = true;

    // Collisions: player projectiles → boss
    scene.physics.add.overlap(
      _weaponSys.projectilePool,
      this.body,
      (projGO, _bossGO) => {
        const proj = projGO as Projectile;
        if (!proj.active || !this.alive) return;
        this.takeDamage(proj.damage);
        proj.deactivate();
      },
    );

    // Contact damage handled in GameScene update loop via distance check
  }

  update(time: number, delta: number): void {
    if (!this.alive) return;

    const mult = this.phase === 'phase2' ? BOSS.PHASE2_COOLDOWN_MULT : 1.0;

    this.memoTimer += delta;
    this.reunionTimer += delta;
    this.revisionTimer += delta;
    if (this.phase === 'phase2') this.restructuringTimer += delta;

    const px = this.scene.data.get('playerX') as number ?? 480;
    const py = this.scene.data.get('playerY') as number ?? 270;

    this.updateSprite(delta, px);

    // Charge windup
    if (this.charging) {
      this.chargeWindup -= delta;
      if (this.chargeWindup <= 0) {
        this.charging = false;
        const angle = Phaser.Math.Angle.Between(this.body.x, this.body.y, this.chargeTarget.x, this.chargeTarget.y);
        const b = this.body.body as Phaser.Physics.Arcade.Body;
        b.setVelocity(Math.cos(angle) * 400, Math.sin(angle) * 400);
        this.scene.time.delayedCall(600, () => {
          b.setVelocity(0, 0);
        });
      }
      return;
    }

    // Memo attack
    if (this.memoTimer >= BOSS.MEMO_INTERVAL_MS * mult) {
      this.memoTimer = 0;
      this.fireMemo(px, py);
    }

    // Reunion (summon enemies)
    const reunionInterval = 8000 * mult;
    if (this.reunionTimer >= reunionInterval) {
      this.reunionTimer = 0;
      for (let i = 0; i < BOSS.MEETING_SUMMON_COUNT; i++) {
        const angle = Phaser.Math.DegToRad(i * 90);
        const ex = this.body.x + Math.cos(angle) * 80;
        const ey = this.body.y + Math.sin(angle) * 80;
        this.enemySys.spawn('angry_email', ex, ey);
      }
    }

    // Revision (charge at player)
    const revisionInterval = 6000 * mult;
    if (this.revisionTimer >= revisionInterval) {
      this.revisionTimer = 0;
      this.charging = true;
      this.flashAttack();
      this.chargeWindup = BOSS.CHARGE_WINDUP_MS;
      this.chargeTarget = { x: px, y: py };
      (this.body.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }

    // Phase 2 restructuring
    if (this.phase === 'phase2') {
      const restructuringInterval = 5000 * mult;
      if (this.restructuringTimer >= restructuringInterval) {
        this.restructuringTimer = 0;
        this.fireRestructuring();
      }
    }

    // Slow drift toward player
    if (!this.charging) {
      const angle = Phaser.Math.Angle.Between(this.body.x, this.body.y, px, py);
      (this.body.body as Phaser.Physics.Arcade.Body).setVelocity(
        Math.cos(angle) * 60,
        Math.sin(angle) * 60,
      );
    }

    // Sync HP bar — sobre la cabeza del sprite si lo hay
    const ratio = Math.max(0, this.hp / (this.ctx.player.items.includes('ceo_memo') ? BOSS.HP * 1.5 : BOSS.HP));
    const topY = this.body.y - (this.hasSprite ? BOSS.DISPLAY_H / 2 : BOSS.SIZE / 2) - 10;
    this.hpBar.setPosition(this.body.x - (200 * (1 - ratio)) / 2, topY);
    this.hpBar.width = 200 * ratio;
    this.hpBarBg.setPosition(this.body.x, topY);
    this.hpText.setPosition(this.body.x, topY - 12);

    void time;
    void this.currentAttack;
    void this.attackTimer;
  }

  /** Sigue el cuerpo, mira al jugador y elige idle por fase o frame de ataque. */
  private updateSprite(delta: number, px: number): void {
    if (!this.hasSprite || !this.sprite) return;
    this.sprite.setPosition(this.body.x, this.body.y);
    this.sprite.setFlipX(px < this.body.x);

    if (this.attackFrameTimer > 0) {
      this.attackFrameTimer -= delta;
      this.sprite.anims.stop();
      this.sprite.setFrame(this.phase === 'phase2' ? BOSS.ATTACK_P2 : BOSS.ATTACK_P1);
      return;
    }
    const key = this.phase === 'phase2' ? 'ceo_idle_p2' : 'ceo_idle_p1';
    if (this.sprite.anims.getName() !== key || !this.sprite.anims.isPlaying) {
      this.sprite.play(key, true);
    }
  }

  /** Muestra brevemente el frame de ataque de la fase actual. */
  private flashAttack(): void {
    this.attackFrameTimer = 400;
  }

  takeDamage(amount: number): void {
    if (!this.alive) return;
    this.hp -= amount;

    // Hit flash (sprite si lo hay)
    if (this.hasSprite && this.sprite) {
      this.sprite.setTintFill(0xffffff);
      this.scene.time.delayedCall(60, () => { if (this.alive && this.sprite) this.sprite.clearTint(); });
    }

    // Phase transition
    if (this.phase === 'phase1' && this.hp <= BOSS.PHASE2_HP_THRESHOLD) {
      this.phase = 'phase2';
      this.ctx.bus.emit('boss:phase2');
      // Flash + cambio a animación de fase 2
      if (this.hasSprite && this.sprite) {
        this.sprite.play('ceo_idle_p2', true);
      } else {
        this.body.setFillStyle(0xffffff);
        this.scene.time.delayedCall(200, () => this.body.setFillStyle(COLORS_GAME.BOSS));
      }
    }

    if (this.hp <= 0) {
      this.hp = 0;
      this.die();
    }
  }

  private fireMemo(px: number, py: number): void {
    this.flashAttack();
    const angle = Phaser.Math.Angle.Between(this.body.x, this.body.y, px, py);
    const proj = this.enemySys.enemyProjectilePool.get(this.body.x, this.body.y) as Projectile | null;
    if (!proj) return;
    proj.fire(
      this.body.x, this.body.y,
      Math.cos(angle) * 220, Math.sin(angle) * 220,
      25, 'ceo_memo', 0, 0, 'none',
    );
    proj.setFillStyle(0xffff00);
  }

  private fireRestructuring(): void {
    this.flashAttack();
    // BOSS.RESTRUCTURING_LINES (3) lines of projectiles sweeping screen
    for (let line = 0; line < BOSS.RESTRUCTURING_LINES; line++) {
      const y = 100 + line * 170;
      for (let col = 0; col < 8; col++) {
        const x = col * 130 + 60;
        const proj = this.enemySys.enemyProjectilePool.get(x, y) as Projectile | null;
        if (!proj) continue;
        proj.fire(x, y, 150, 0, 20, 'ceo_restructuring', 0, 0, 'none', 3000);
        proj.setFillStyle(0xff4400);
      }
    }
  }

  private die(): void {
    this.alive = false;
    (this.body.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    (this.body.body as Phaser.Physics.Arcade.Body).enable = false;

    this.ctx.player.coins += ECONOMY.BOSS_COINS;
    this.ctx.stats.coinsEarned += ECONOMY.BOSS_COINS;
    this.ctx.stats.bossDefeated = true;

    this.hpBarBg.setVisible(false);
    this.hpBar.setVisible(false);
    this.hpText.setVisible(false);

    // Death sequence: 1) freeze timeScale, 2) emit boss:defeated for shake,
    // 3) grow-and-fade tween, 4) emit boss:defeated to trigger scene transition
    // Step 1: freeze world time for BOSS_DEATH_FREEZE_MS
    this.scene.physics.world.timeScale = 100; // very slow (not 0 — tweens need time)
    this.scene.time.timeScale = 0.001;         // near-freeze for game timers
    this.body.setFillStyle(0xffffff);
    if (this.hasSprite && this.sprite) {
      this.sprite.anims.stop();
      this.sprite.setTintFill(0xffffff);
    }

    // Use real-time via a direct setTimeout so timeScale doesn't affect it
    const resumeAndFinish = (): void => {
      this.scene.physics.world.timeScale = 1;
      this.scene.time.timeScale = 1;

      // Emit boss:defeated — GameScene subscribes for shake + victory transition
      this.ctx.bus.emit('boss:defeated');

      // Grow-fade tween (cuerpo + sprite). El sprite crece desde su escala base.
      this.scene.tweens.add({
        targets: this.body, scaleX: 2, scaleY: 2, alpha: 0,
        duration: FEEL.BOSS_DEATH_TWEEN_MS, ease: 'Cubic.Out',
        onComplete: () => this.body.setVisible(false),
      });
      if (this.hasSprite && this.sprite) {
        const base = this.sprite.scaleX;
        // Montón de oro en el suelo donde cae el CEO
        this.scene.add.image(this.body.x, this.body.y + BOSS.DISPLAY_H / 4, 'boss_ceo')
          .setFrame(BOSS.GOLD_FRAME).setScale(base).setDepth(2);
        this.scene.tweens.add({
          targets: this.sprite, scaleX: base * 1.8, scaleY: base * 1.8, alpha: 0,
          duration: FEEL.BOSS_DEATH_TWEEN_MS, ease: 'Cubic.Out',
          onComplete: () => { if (this.sprite) this.sprite.setVisible(false); },
        });
      }
    };

    setTimeout(resumeAndFinish, FEEL.BOSS_DEATH_FREEZE_MS);
  }
}
