import Phaser from 'phaser';
import { GAME, COLORS } from '@/config/game.config';
import { BootScene } from '@/scenes/BootScene';
import { PreloadScene } from '@/scenes/PreloadScene';
import { MainMenuScene } from '@/scenes/MainMenuScene';
import { GameScene } from '@/scenes/GameScene';
import { UpgradeScene } from '@/scenes/UpgradeScene';
import { UpgradeOverlay } from '@/scenes/UpgradeOverlay';
import { BuildReportScene } from '@/scenes/BuildReportScene';
import { HUDScene } from '@/scenes/HUDScene';
import { StatisticsScene } from '@/scenes/StatisticsScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  backgroundColor: COLORS.BG,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: import.meta.env.DEV },
  },
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    GameScene,
    UpgradeScene,
    UpgradeOverlay,
    BuildReportScene,
    HUDScene,       // registered but NOT auto-started — launched on demand by GameScene
    StatisticsScene,
  ],
};

new Phaser.Game(config);
