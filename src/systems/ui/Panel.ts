// src/systems/ui/Panel.ts
// §7.1 — makePanel: builds a Container with shadow + base + bevel + highlight + border.
// Returns a Phaser.GameObjects.Container so callers can add children to it.

import Phaser from 'phaser';
import type { Rarity } from '@/types';

export interface PanelOptions {
  /** Fill color of the base rectangle. Default: 0x1e1e2e */
  baseColor?: number;
  /** Border/bevel accent color. Default: 0x4444aa */
  borderColor?: number;
  /** Alpha of the outer shadow. Default: 0.5 */
  shadowAlpha?: number;
  /** Shadow offset in pixels. Default: 3 */
  shadowOffset?: number;
  /** Depth assigned to the container. Default: 0 */
  depth?: number;
  /** Corner-bevel line width. Default: 2 */
  bevelWidth?: number;
}

// Rarity → base/border colors
const RARITY_BASE: Record<Rarity, number> = {
  common:    0x222233,
  rare:      0x112244,
  epic:      0x220033,
  legendary: 0x332200,
};
const RARITY_BORDER: Record<Rarity, number> = {
  common:    0xaaaaaa,
  rare:      0x4488ff,
  epic:      0xaa44ff,
  legendary: 0xffaa00,
};

export function panelColorByRarity(r: Rarity): { baseColor: number; borderColor: number } {
  return { baseColor: RARITY_BASE[r], borderColor: RARITY_BORDER[r] };
}

/**
 * Creates a panel Container centred at (x, y) with width w and height h.
 *
 * Layer stack (back → front):
 *  1. Shadow rect   – offset +shadowOffset, darker, semi-transparent
 *  2. Base rect     – solid fill
 *  3. Bevel light   – top + left inner edges (bright)
 *  4. Bevel dark    – bottom + right inner edges (dark)
 *  5. Top highlight – thin bright strip at very top
 *  6. Outer border  – fine 1px border
 *
 * The container origin is the top-left corner, matching Phaser rectangle default.
 */
export function makePanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: PanelOptions = {},
): Phaser.GameObjects.Container {
  const baseColor    = opts.baseColor    ?? 0x1e1e2e;
  const borderColor  = opts.borderColor  ?? 0x4444aa;
  const shadowAlpha  = opts.shadowAlpha  ?? 0.5;
  const shadowOffset = opts.shadowOffset ?? 3;
  const bevelW       = opts.bevelWidth   ?? 2;

  const container = scene.add.container(x, y);
  if (opts.depth !== undefined) container.setDepth(opts.depth);

  // 1. Shadow
  const shadow = scene.add.rectangle(
    shadowOffset, shadowOffset,
    w, h,
    0x000000, shadowAlpha,
  ).setOrigin(0, 0);
  container.add(shadow);

  // 2. Base
  const base = scene.add.rectangle(0, 0, w, h, baseColor).setOrigin(0, 0);
  container.add(base);

  // 3. Bevel light — top & left inner lines
  const bevelLight = 0xffffff;
  // top bevel line
  container.add(scene.add.rectangle(0, 0, w, bevelW, bevelLight, 0.18).setOrigin(0, 0));
  // left bevel line
  container.add(scene.add.rectangle(0, 0, bevelW, h, bevelLight, 0.18).setOrigin(0, 0));

  // 4. Bevel dark — bottom & right inner lines
  const bevelDark = 0x000000;
  // bottom bevel line
  container.add(scene.add.rectangle(0, h - bevelW, w, bevelW, bevelDark, 0.30).setOrigin(0, 0));
  // right bevel line
  container.add(scene.add.rectangle(w - bevelW, 0, bevelW, h, bevelDark, 0.30).setOrigin(0, 0));

  // 5. Top highlight — very thin bright stripe
  container.add(scene.add.rectangle(bevelW, 1, w - bevelW * 2, 1, 0xffffff, 0.10).setOrigin(0, 0));

  // 6. Outer border — 1px all around (drawn as 4 thin rects)
  const bc = borderColor;
  container.add(scene.add.rectangle(0, 0,     w, 1, bc).setOrigin(0, 0)); // top
  container.add(scene.add.rectangle(0, h - 1, w, 1, bc).setOrigin(0, 0)); // bottom
  container.add(scene.add.rectangle(0, 0,     1, h, bc).setOrigin(0, 0)); // left
  container.add(scene.add.rectangle(w - 1, 0, 1, h, bc).setOrigin(0, 0)); // right

  return container;
}
