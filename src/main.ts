import Phaser from 'phaser';
import { GAME, COLORS } from '@/config/game.config';
import { SaveManager } from '@/systems/SaveManager';
import { BootScene } from '@/scenes/BootScene';
import { PreloadScene } from '@/scenes/PreloadScene';
import { MainMenuScene } from '@/scenes/MainMenuScene';
import { GameScene } from '@/scenes/GameScene';
import { UpgradeScene } from '@/scenes/UpgradeScene';
import { UpgradeOverlay } from '@/scenes/UpgradeOverlay';
import { ShopOverlay } from '@/scenes/ShopOverlay';
import { BuildReportScene } from '@/scenes/BuildReportScene';
import { PauseScene } from '@/scenes/PauseScene';
import { HUDScene } from '@/scenes/HUDScene';
import { StatisticsScene } from '@/scenes/StatisticsScene';

// FASE H — read smoothing setting before constructing Phaser.Game (applies at boot, not runtime)
const { smoothing: _smoothing } = SaveManager.load().settings;
const pixelArt = !_smoothing; // pixel art = NEAREST filter; smoothing = antialias LINEAR

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  backgroundColor: COLORS.BG,
  pixelArt,              // false when smoothing enabled (se aplica al reiniciar)
  roundPixels: !_smoothing,
  render: {
    pixelArt,
    antialias: _smoothing,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: false },
  },
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    GameScene,
    UpgradeScene,
    UpgradeOverlay,
    ShopOverlay,    // §7.3 — registered but NOT auto-started — launched in intermission by GameScene
    BuildReportScene,
    PauseScene,
    HUDScene,       // registered but NOT auto-started — launched on demand by GameScene
    StatisticsScene,
  ],
};

new Phaser.Game(config);
