import type { ItemDefinition } from '@/types';
import type { RunContext } from '@/systems/RunContext';
import { CURSES } from './game.config';

/**
 * Curses (Mejora 4). Modeled as ItemDefinition (isCurse) so they flow through the upgrade
 * overlay, but kept out of the normal weighted pool — injected manually beside legendaries.
 * Modifier-based effects use applyModifiers (applied via recomputeModifiers); flag/timer effects
 * are set by applyCurse + handled in the relevant systems / GameScene.
 */
export const CURSE_LIST: ItemDefinition[] = [
  {
    id: 'exclusivity_contract', name: 'Contrato de Exclusividad', rarity: 'legendary', category: 'passive',
    tags: ['maldición'], isCurse: true,
    description: 'MALDICIÓN: tu arma inicial se bloquea (no puedes reemplazarla).',
    cursePower: `PODER: esa arma gana +${Math.round((CURSES.EXCLUSIVITY_DAMAGE_MULT - 1) * 100)}% daño permanente.`,
  },
  {
    id: 'no_vacation', name: 'Sin Vacaciones', rarity: 'legendary', category: 'passive',
    tags: ['maldición'], isCurse: true,
    description: `MALDICIÓN: el estrés nunca baja de ${CURSES.NO_VACATION_STRESS_FLOOR}.`,
    cursePower: 'PODER: +40% XP ganada.',
    applyModifiers: (m) => { m.xpMult *= 1.40; },
  },
  {
    id: 'micromanagement', name: 'Micromanagement', rarity: 'legendary', category: 'passive',
    tags: ['maldición'], isCurse: true,
    description: `MALDICIÓN: cada ${CURSES.MICROMANAGEMENT_INTERVAL_S}s pierdes ${CURSES.MICROMANAGEMENT_HP_LOSS} HP.`,
    cursePower: 'PODER: los ítems ofrecidos tienen rareza +1 (sin comunes).',
  },
  {
    id: 'toxic_culture', name: 'Cultura Tóxica', rarity: 'legendary', category: 'passive',
    tags: ['maldición'], isCurse: true,
    description: 'MALDICIÓN: las monedas no existen. Monedas: 0.',
    cursePower: 'PODER: +80% daño. Sin límite de armas equipadas.',
    applyModifiers: (m) => { m.coinMult = 0; m.damageMult *= 1.8; m.maxWeapons = 99; },
  },
  {
    id: 'mandatory_overtime', name: 'Horas Extra Obligatorias', rarity: 'legendary', category: 'passive',
    tags: ['maldición'], isCurse: true,
    description: 'MALDICIÓN: la run dura 15 minutos.',
    cursePower: 'PODER: a los 10 min, todos los stats ×1.5.',
  },
  {
    id: 'open_office', name: 'Open Office', rarity: 'legendary', category: 'passive',
    tags: ['maldición'], isCurse: true,
    description: 'MALDICIÓN: HR Reps aparecen en todas las oleadas desde la 1.',
    cursePower: `PODER: tu aura ralentiza enemigos (-${Math.round(CURSES.OPEN_OFFICE_AURA_SLOW * 100)}% en radio ${CURSES.OPEN_OFFICE_AURA_RADIUS}px).`,
  },
];

export function getCurseById(id: string): ItemDefinition | undefined {
  return CURSE_LIST.find(c => c.id === id);
}

/** Apply a curse's persistent flags to ctx. Modifier effects: recomputeModifiers. Timers: GameScene. */
export function applyCurse(ctx: RunContext, id: string): void {
  ctx.curseId = id;
  ctx.stats.activeCurse = id;
  switch (id) {
    case 'exclusivity_contract':
      ctx.curseLockedWeaponId = ctx.player.weapons[0] ?? null;
      break;
    case 'no_vacation':
      ctx.curseStressFloor = CURSES.NO_VACATION_STRESS_FLOOR;
      break;
    case 'micromanagement':
      ctx.curseForbidCommon = true;
      break;
    case 'open_office':
      ctx.curseOpenOfficeAura = true;
      ctx.curseHrEveryWave = true;
      break;
    // toxic_culture & mandatory_overtime: applyModifiers / GameScene timer
  }
}
