// src/config/meta.config.ts
import type { PlayerState } from '@/types';

export interface MetaUpgrade {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  costPerLevel: number[]; // [cost_for_level_1, cost_for_level_2, ...]
  applyToPlayer: (p: PlayerState, level: number) => PlayerState;
}

export const META_UPGRADES: MetaUpgrade[] = [
  {
    id: 'base_hp',
    name: 'HP inicial +25',
    description: '+25 HP por nivel',
    maxLevel: 5,
    costPerLevel: [50, 75, 100, 150, 200],
    applyToPlayer: (p, level) => ({ ...p, maxHp: p.maxHp + 25 * level, hp: p.hp + 25 * level }),
  },
  {
    id: 'base_damage',
    name: 'Daño base +10%',
    description: '+10% daño por nivel',
    maxLevel: 5,
    costPerLevel: [75, 100, 150, 200, 300],
    applyToPlayer: (p, level) => ({ ...p, damageMultiplier: p.damageMultiplier * Math.pow(1.10, level) }),
  },
  {
    id: 'base_speed',
    name: 'Velocidad +5%',
    description: '+5% velocidad por nivel',
    maxLevel: 3,
    costPerLevel: [60, 90, 130],
    applyToPlayer: (p, level) => ({ ...p, speed: p.speed * Math.pow(1.05, level) }),
  },
  {
    id: 'stress_resist',
    name: 'Resistencia al estrés',
    description: '-20% subida de estrés por nivel',
    maxLevel: 3,
    costPerLevel: [100, 150, 250],
    // Effect applied via ctx.metaStressMult in applyMetaUpgrades — not via PlayerState
    applyToPlayer: (p, _level) => p,
  },
  {
    id: 'alt_character',
    name: 'Personaje alternativo',
    description: 'Desbloquea aspecto alternativo (visual placeholder)',
    maxLevel: 1,
    costPerLevel: [200],
    // Cosmetic placeholder — no stat effect
    applyToPlayer: (p, _level) => p,
  },
  {
    id: 'starting_weapon',
    name: 'Arma inicial extra',
    description: 'Obtén una segunda elección de arma al inicio de cada run',
    maxLevel: 1,
    costPerLevel: [150],
    // Every run already opens a starting weapon choice (weaponsOnly pick).
    // If starting_weapon >= 1, GameScene calls grantUpgrade(true) twice,
    // giving the player a second weapons-only choice before the run begins.
    applyToPlayer: (p, _level) => p,
  },
];

/** -20% stress accrual per level of stress_resist meta upgrade. */
export const META_STRESS_RESIST_PER_LEVEL = 0.20;
