// src/config/playerUpgrades.config.ts
// §7.2 — PLAYER_UPGRADES: stat pool offered on level-up (stackable roguelite stats).
// These replace items in the level-up overlay; items/weapons go to the ShopOverlay.

import type { PlayerState } from '@/types';
import type { RunModifiers } from '@/types';

export interface PlayerUpgrade {
  id: string;
  name: string;
  desc: string;
  icon?: string;
  weight: number;
  apply(player: PlayerState, mods: RunModifiers): void;
}

// All multiplier constants live here — config over code.
const UP = {
  HP_AMOUNT: 12,                 // era 20 — reducido ~40%; mejoras son acumulables, deben sentirse incrementales (balance v2)
  DAMAGE_MULT: 1.06,             // era 1.12 — stackeable; pasos más pequeños (balance v2)
  SPEED_MULT: 1.04,              // era 1.08 — stackeable; pasos más pequeños (balance v2)
  PROJECTILE_BONUS: 1,
  FIRERATE_MULT: 1.05,           // era 1.10 — stackeable; pasos más pequeños (balance v2)
  RANGE_MULT: 1.08,              // era 1.15 — stackeable; pasos más pequeños (balance v2)
  CRIT_BONUS: 0.04,              // era 0.08 — stackeable; pasos más pequeños (balance v2)
  DAMAGE_TAKEN_MULT: 1 - 0.06,  // era 1-0.12 (0.88) — −6% daño recibido; pasos más pequeños (balance v2)
  XP_MULT: 1.10,                 // era 1.20 — stackeable; pasos más pequeños (balance v2)
  REGEN_HP_PER_S: 1,             // HP healed per second (tracked via RunModifiers.regenHpPerS)
  STRESS_RISE_MULT: 1 - 0.08,   // era 1-0.15 (0.85) — −8% subida de estrés; pasos más pequeños (balance v2)
  PICKUP_RANGE_BONUS: 18,        // era 30 — stackeable; pasos más pequeños (balance v2)
} as const;

export const PLAYER_UPGRADES: PlayerUpgrade[] = [
  {
    id: 'stat_hp',
    name: '+12 HP máx',
    desc: `Aumenta tu HP máximo en ${UP.HP_AMOUNT} y cura ${UP.HP_AMOUNT} HP al instante.`,
    weight: 3,
    apply(player) {
      player.maxHp += UP.HP_AMOUNT;
      player.hp = Math.min(player.maxHp, player.hp + UP.HP_AMOUNT);
    },
  },
  {
    id: 'stat_damage',
    name: '+6% daño',
    desc: 'Todos tus ataques hacen 6% más daño.',
    weight: 3,
    apply(_player, mods) {
      mods.damageMult *= UP.DAMAGE_MULT;
    },
  },
  {
    id: 'stat_speed',
    name: '+4% velocidad',
    desc: 'Te mueves un 4% más rápido.',
    weight: 2,
    apply(player) {
      player.speed *= UP.SPEED_MULT;
    },
  },
  {
    id: 'stat_projectile',
    name: '+1 proyectil',
    desc: 'Todas tus armas disparan un proyectil extra.',
    weight: 1.5,
    apply(_player, mods) {
      mods.projectileBonus += UP.PROJECTILE_BONUS;
    },
  },
  {
    id: 'stat_firerate',
    name: '+5% cadencia',
    desc: 'Todas tus armas disparan un 5% más rápido.',
    weight: 2,
    apply(_player, mods) {
      // Stored in modifiers as a firerate multiplier (systems read mods.fireRateMult).
      mods.fireRateMult = (mods.fireRateMult ?? 1) * UP.FIRERATE_MULT;
    },
  },
  {
    id: 'stat_range',
    name: '+8% alcance',
    desc: 'Tus armas tienen un 8% más de alcance.',
    weight: 1.5,
    apply(_player, mods) {
      mods.rangeMult *= UP.RANGE_MULT;
    },
  },
  {
    id: 'stat_crit',
    name: '+4% prob. crítico',
    desc: 'Aumenta tu probabilidad de golpe crítico en 4 puntos.',
    weight: 1.5,
    apply(_player, mods) {
      mods.critBonus = (mods.critBonus ?? 0) + UP.CRIT_BONUS;
    },
  },
  {
    id: 'stat_armor',
    name: '−6% daño recibido',
    desc: 'Reduces todo el daño que recibes en un 6%.',
    weight: 2,
    apply(_player, mods) {
      mods.damageTakenMult *= UP.DAMAGE_TAKEN_MULT;
    },
  },
  {
    id: 'stat_xp',
    name: '+10% XP',
    desc: 'Ganas un 10% más de XP por cada enemigo eliminado.',
    weight: 1,
    apply(_player, mods) {
      mods.xpMult *= UP.XP_MULT;
    },
  },
  {
    id: 'stat_regen',
    name: 'Regen 1 HP/3s',
    desc: 'Recuperas 1 HP cada 3 segundos de forma pasiva.',
    weight: 1,
    apply(_player, mods) {
      mods.regenHpPerS = (mods.regenHpPerS ?? 0) + UP.REGEN_HP_PER_S / 3;
    },
  },
  {
    id: 'stat_stress_resist',
    name: '−8% subida de estrés',
    desc: 'El estrés aumenta un 8% más despacio.',
    weight: 1.5,
    apply(_player, mods) {
      mods.stressRiseMult = (mods.stressRiseMult ?? 1) * UP.STRESS_RISE_MULT;
    },
  },
  {
    id: 'stat_pickup_range',
    name: '+rango de recogida',
    desc: `Recoges objetos del suelo desde ${UP.PICKUP_RANGE_BONUS} px más lejos.`,
    weight: 1.5,
    apply(_player, mods) {
      mods.pickupRange = (mods.pickupRange ?? 0) + UP.PICKUP_RANGE_BONUS;
    },
  },
];

/** Weighted random pick of `count` upgrades without replacement. */
export function pickPlayerUpgrades(count: number): PlayerUpgrade[] {
  const pool = PLAYER_UPGRADES.map(u => ({ u, w: u.weight }));
  const picks: PlayerUpgrade[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const total = pool.reduce((s, e) => s + e.w, 0);
    let rand = Math.random() * total;
    let idx = pool.length - 1;
    for (let j = 0; j < pool.length; j++) {
      rand -= pool[j].w;
      if (rand <= 0) { idx = j; break; }
    }
    picks.push(pool[idx].u);
    pool.splice(idx, 1);
  }
  return picks;
}
