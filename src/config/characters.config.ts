import type { CharacterDefinition } from '@/types';
import { PLAYER, STRESS, COMBAT } from './game.config';

// Tunables for character passives/restrictions (config over code).
export const CHAR = {
  BECARIO_XP_MULT: 1.5,
  BECARIO_SPEED: 1.10,
  BECARIO_DMG: 0.90,
  BECARIO_HP: 60,
  LEARNING_CURVE_STEP: 0.10,   // -10% xp per level
  LEARNING_CURVE_CAP: 0.50,    // max -50%

  FREELANCER_HP: 90,
  FREELANCER_WEAPON_DMG: 1.8,
  FREELANCER_STRESS_PER_HIT: -3,
  FREELANCER_MAX_WEAPONS: 2,
  SIN_JEFE_FIRERATE: 1.25,

  DIRECTOR_HP: 130,
  DIRECTOR_STRESS_PER_HIT: 20,
  DIRECTOR_SPEED: 0.90,

  RRHH_HP: 110,
  RRHH_SPEED: 0.95,
  RRHH_AUDITOR_HP_MULT: 1.5,
  RRHH_ALLY_DAMAGE: 8,

  CONSULTOR_HP: 70,
  CONSULTOR_COIN_MULT: 2.5,
  CONSULTOR_DMG: 1.20,
  CONSULTOR_TIME_INTERVAL_S: 60,
  CONSULTOR_TIME_STEP: 0.05,   // +5% all stats per interval
} as const;

/** Neutral default character — current base stats, no passives. */
export const BASE_CHARACTER: CharacterDefinition = {
  id: 'base', name: 'Empleado', tagline: 'Un día más en la oficina.',
  baseHp: PLAYER.BASE_HP, speedMult: 1, damageMult: 1, xpMult: 1, coinMult: 1,
  stressPerHit: STRESS.DAMAGE_PER_HIT, maxWeapons: COMBAT.MAX_WEAPONS_BASE, perWeaponDamageMult: 1,
};

export const CHARACTERS: CharacterDefinition[] = [
  BASE_CHARACTER,
  {
    id: 'becario', name: 'El Becario', tagline: 'Aprende rápido. Muere rápido.',
    baseHp: CHAR.BECARIO_HP, speedMult: CHAR.BECARIO_SPEED, damageMult: CHAR.BECARIO_DMG,
    xpMult: CHAR.BECARIO_XP_MULT, coinMult: 1, stressPerHit: STRESS.DAMAGE_PER_HIT,
    maxWeapons: COMBAT.MAX_WEAPONS_BASE, perWeaponDamageMult: 1,
    noEpicLegendaryWeapons: true, learningCurve: true,
  },
  {
    id: 'freelancer', name: 'El Freelancer', tagline: 'Trabaja solo o no trabaja.',
    baseHp: CHAR.FREELANCER_HP, speedMult: 1, damageMult: 1, xpMult: 1, coinMult: 1,
    stressPerHit: CHAR.FREELANCER_STRESS_PER_HIT, maxWeapons: CHAR.FREELANCER_MAX_WEAPONS,
    perWeaponDamageMult: CHAR.FREELANCER_WEAPON_DMG, doubleMonitorDisabled: true, sinJefe: true,
  },
  {
    id: 'director', name: 'El Director', tagline: 'El poder tiene un precio.',
    baseHp: CHAR.DIRECTOR_HP, speedMult: CHAR.DIRECTOR_SPEED, damageMult: 1, xpMult: 1, coinMult: 1,
    stressPerHit: CHAR.DIRECTOR_STRESS_PER_HIT, maxWeapons: COMBAT.MAX_WEAPONS_BASE, perWeaponDamageMult: 1,
    critInBurnout: true, ignoresCafe: true,
  },
  {
    id: 'rrhh', name: 'El de RRHH', tagline: 'Todos le temen. Nadie le dispara.',
    baseHp: CHAR.RRHH_HP, speedMult: CHAR.RRHH_SPEED, damageMult: 1, xpMult: 1, coinMult: 1,
    stressPerHit: STRESS.DAMAGE_PER_HIT, maxWeapons: COMBAT.MAX_WEAPONS_BASE, perWeaponDamageMult: 1,
    hrAllies: true, auditorsFromWave1: true, auditorHpMult: CHAR.RRHH_AUDITOR_HP_MULT,
  },
  {
    id: 'consultor', name: 'El Consultor Externo', tagline: 'Cobra el doble. Dura la mitad.',
    baseHp: CHAR.CONSULTOR_HP, speedMult: 1, damageMult: CHAR.CONSULTOR_DMG, xpMult: 1,
    coinMult: CHAR.CONSULTOR_COIN_MULT, stressPerHit: STRESS.DAMAGE_PER_HIT,
    maxWeapons: COMBAT.MAX_WEAPONS_BASE, perWeaponDamageMult: 1,
    timeScaling: true, ignoreMeta: true,
  },
];

export function getCharacterById(id: string): CharacterDefinition {
  return CHARACTERS.find(c => c.id === id) ?? BASE_CHARACTER;
}
