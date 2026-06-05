import Phaser from 'phaser';
import { SCENES, GAME, COLORS, BOSS } from '@/config/game.config';
import { SceneManager } from '@/systems/SceneManager';
import { SaveManager } from '@/systems/SaveManager';
import { AudioManager } from '@/systems/AudioManager';
import { ICON_IDS, iconKey } from '@/config/icons.config';
import { CHARACTER_SHEET_IDS, CHAR_SHEET, charFrame, CHAR_WALK_OVERRIDE } from '@/config/characters.config';
import { ENEMY_SHEET_IDS, ENEMY_SHEET, ENEMY_FRAME } from '@/config/enemies.config';
import { PROJECTILE_SPRITE_IDS, PICKUP_SPRITE_KINDS } from '@/config/projectiles.config';
import { EFFECTS, EFFECT_NAMES } from '@/config/effects.config';

const BAR_WIDTH = 400;
const BAR_HEIGHT = 20;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.PRELOAD });
  }

  preload(): void {
    const cx = GAME.WIDTH / 2;
    const cy = GAME.HEIGHT / 2;

    this.add.text(cx, cy - 40, 'Cargando…', { fontSize: '24px', color: COLORS.TEXT }).setOrigin(0.5);
    this.add.rectangle(cx, cy, BAR_WIDTH, BAR_HEIGHT, 0x444444);
    const fill = this.add.rectangle(cx - BAR_WIDTH / 2, cy, 0, BAR_HEIGHT, COLORS.PLAYER).setOrigin(0, 0.5);
    this.load.on('progress', (p: number) => { fill.width = BAR_WIDTH * p; });

    // --- Backgrounds (public/assets/bg, served at /assets/bg) ---
    this.load.image('bg_menu', '/assets/bg/menu.png');
    this.load.image('bg_floor', '/assets/bg/game_floor.png');
    this.load.image('bg_gameover', '/assets/bg/gameover.png');
    this.load.image('bg_victory', '/assets/bg/victory.png');

    // --- UI ---
    this.load.image('ui_logo', '/assets/ui/logo.png');
    this.load.image('ui_hp_bar', '/assets/ui/hp_bar.png');
    this.load.image('ui_stress_bar', '/assets/ui/stress_bar.png');
    this.load.image('ui_xp_bar', '/assets/ui/xp_bar.png');
    this.load.spritesheet('ui_button', '/assets/ui/button.png', { frameWidth: 602, frameHeight: 183 });

    // --- Iconos de ítems/armas/maldiciones ---
    for (const id of ICON_IDS) {
      this.load.image(iconKey(id), `/assets/icons/${id}.png`);
    }

    // --- Retratos de personajes (frame idle, para selección) ---
    for (const id of ['becario', 'freelancer', 'director', 'rrhh', 'consultor']) {
      this.load.image(`char_${id}`, `/assets/characters/${id}.png`);
    }

    // --- Hojas de sprites animadas del jugador ---
    for (const id of CHARACTER_SHEET_IDS) {
      const fr = charFrame(id);
      this.load.spritesheet(`charsheet_${id}`, `/assets/characters/sheets/${id}.png`, {
        frameWidth: fr.w, frameHeight: fr.h,
      });
    }

    // --- Hojas de sprites animadas de enemigos (grid 4×3, dimensiones por hoja) ---
    for (const id of ENEMY_SHEET_IDS) {
      const fr = ENEMY_FRAME[id];
      this.load.spritesheet(`enemysheet_${id}`, `/assets/enemies/sheets/${id}.png`, {
        frameWidth: fr.w, frameHeight: fr.h,
      });
    }

    // --- Sprites de proyectiles (por arma) y pickups ---
    for (const id of PROJECTILE_SPRITE_IDS) {
      this.load.image(`proj_${id}`, `/assets/projectiles/${id}.png`);
    }
    for (const kind of PICKUP_SPRITE_KINDS) {
      this.load.image(`pickup_${kind}`, `/assets/pickups/${kind}.png`);
    }

    // --- Props del mapa ---
    for (const k of ['desk', 'cabinet', 'plant', 'coffee', 'vending', 'extintor']) {
      this.load.image(`map_${k}`, `/assets/map/${k}.png`);
    }

    // --- Boss CEO (hoja 4×2) ---
    this.load.spritesheet('boss_ceo', '/assets/boss/ceo.png', {
      frameWidth: BOSS.SHEET_FRAME_W, frameHeight: BOSS.SHEET_FRAME_H,
    });

    // --- Efectos animados ---
    for (const name of EFFECT_NAMES) {
      const fx = EFFECTS[name];
      this.load.spritesheet(`fx_${name}`, `/assets/effects/${name}.png`, {
        frameWidth: fx.frameW, frameHeight: fx.frameH,
      });
    }
  }

  create(): void {
    // Restore audio volumes from persisted settings before the game starts
    const save = SaveManager.load();
    const audio = AudioManager.getInstance();
    audio.setVolume('music', save.settings.musicVolume);
    audio.setVolume('sfx', save.settings.sfxVolume);
    audio.setVolume('ui', save.settings.uiVolume);

    this.createCharacterAnims();
    this.createEnemyAnims();
    this.createBossAnims();
    this.createEffectAnims();

    SceneManager.go(this, SCENES.MAIN_MENU);
  }

  /** Animaciones one-shot de efectos (no loop). */
  private createEffectAnims(): void {
    for (const name of EFFECT_NAMES) {
      const key = `fx_${name}`;
      if (!this.textures.exists(key) || this.anims.exists(key)) continue;
      const fx = EFFECTS[name];
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: fx.cols * fx.rows - 1 }),
        frameRate: fx.fps,
        repeat: fx.loop ? -1 : 0,
      });
    }
  }

  /** Animaciones idle del CEO por fase (parpadeo lento). */
  private createBossAnims(): void {
    if (!this.textures.exists('boss_ceo')) return;
    const defs: Array<[string, number[]]> = [
      ['ceo_idle_p1', [...BOSS.IDLE_P1]], ['ceo_idle_p2', [...BOSS.IDLE_P2]],
    ];
    for (const [key, frames] of defs) {
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers('boss_ceo', { frames }),
        frameRate: BOSS.ANIM_FPS,
        repeat: -1,
      });
    }
  }

  /** Animaciones globales de caminado por personaje y dirección (idle/death son frames únicos). */
  private createCharacterAnims(): void {
    for (const id of CHARACTER_SHEET_IDS) {
      const sheet = `charsheet_${id}`;
      const ov = CHAR_WALK_OVERRIDE[id];
      const fps = ov?.fps ?? CHAR_SHEET.WALK_FPS;
      const dirs: Array<[string, readonly number[]]> = [
        ['down', ov?.down ?? CHAR_SHEET.WALK.down],
        ['side', ov?.side ?? CHAR_SHEET.WALK.side],
        ['up', ov?.up ?? CHAR_SHEET.WALK.up],
      ];
      for (const [dir, frames] of dirs) {
        const key = `${id}_walk_${dir}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(sheet, { frames: [...frames] }),
          frameRate: fps,
          repeat: -1,
        });
      }
    }
  }

  /** Animaciones globales de caminado por enemigo y dirección (grid 4×3). */
  private createEnemyAnims(): void {
    for (const id of ENEMY_SHEET_IDS) {
      const sheet = `enemysheet_${id}`;
      if (!this.textures.exists(sheet)) continue;
      const dirs: Array<[string, readonly number[]]> = [
        ['down', ENEMY_SHEET.WALK.down], ['side', ENEMY_SHEET.WALK.side], ['up', ENEMY_SHEET.WALK.up],
      ];
      for (const [dir, frames] of dirs) {
        const key = `enemy_${id}_walk_${dir}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(sheet, { frames: [...frames] }),
          frameRate: ENEMY_SHEET.WALK_FPS,
          repeat: -1,
        });
      }
    }
  }
}
