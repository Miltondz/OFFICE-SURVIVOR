import type { PlayerState, RunModifiers, RunStats, CharacterDefinition } from '@/types';
import { defaultRunModifiers } from '@/types';
import { PLAYER } from '@/config/game.config';
import { EventBus } from './EventBus';
import { getItemById } from '@/config/items.config';
import { BASE_CHARACTER } from '@/config/characters.config';
import { getCurseById } from '@/config/curses.config';
import { PLAYER_UPGRADES } from '@/config/playerUpgrades.config';

export interface RunContext {
  player: PlayerState;
  modifiers: RunModifiers;
  stats: RunStats;
  elapsedS: number;
  wave: number;
  bus: EventBus;
  damageByWeapon: Record<string, number>;  // per-weapon damage attribution for benchmark
  benchmarkWeaponId: string | null;        // weapon locked in by benchmark on pickup
  infinite: boolean;                       // ipo: true after boss defeated
  difficultyMult: number;                  // ipo: cumulative difficulty multiplier
  weaponLevels: Record<string, number>;    // weapon id → level, for upgrade-pool maxed detection
  metaStressMult: number;                  // meta stress_resist: multiplier on all stress accrual (default 1)
  character: CharacterDefinition;          // selected playable character (default BASE_CHARACTER)
  enemySpeedMult: number;                  // wave event all_hands: temporary enemy speed multiplier (default 1)
  weaponJamChance: number;                 // wave event printer_jam: per-fire jam chance (default 0)
  // Curses (Mejora 4)
  curseId: string | null;                  // active curse id, null if none
  curseLockedWeaponId: string | null;      // exclusivity_contract: weapon that gets +100% dmg
  curseStressFloor: number;                // no_vacation: stress never below this (default 0)
  curseForbidCommon: boolean;              // micromanagement: offered items rarity +1 (no commons)
  curseOpenOfficeAura: boolean;            // open_office: player aura slows nearby enemies
  curseHrEveryWave: boolean;               // open_office: HR Reps from wave 1
  playerUpgradeIds: string[];              // mejoras de personaje adquiridas (se reaplican en recomputeModifiers)
  // §E1 — state fields for new items (not wiped by recomputeModifiers)
  sellaDeGomaKills: number;               // sello_de_goma: kills accumulated toward next powered shot
  sellaDeGomaReady: boolean;              // sello_de_goma: next projectile deals ×3 damage
  escudoGrapasActive: boolean;            // escudo_grapas: shield absorbs first hit of wave
  modoDiosActive: boolean;                // modo_dios_temporal: currently in god mode
  modoDiosDamageBoost: boolean;           // modo_dios_temporal: flag read by WeaponSystem for ×5 dmg
  tripleEspressoSpeedBonus: number;       // triple_espresso: current speed bonus applied to player.speed
}

export function createRunContext(): RunContext {
  return {
    player: {
      hp: PLAYER.BASE_HP,
      maxHp: PLAYER.BASE_HP,
      speed: PLAYER.BASE_SPEED,
      damageMultiplier: PLAYER.BASE_DAMAGE_MULTIPLIER,
      stress: 0,
      level: 1,
      xp: 0,
      coins: 0,
      items: [],
      weapons: [],
    },
    modifiers: defaultRunModifiers(),
    stats: {
      kills: 0,
      timeSurvived: 0,
      coinsEarned: 0,
      maxLevel: 1,
      maxStress: 0,
      bossDefeated: false,
      damageBySource: {},
      killsByWeapon: {},
      longestWave: { wave: 0, enemies: 0 },
      itemsCollected: [],
      weaponsOwned: [],
      activeCurse: null,
      characterId: 'base',
    },
    elapsedS: 0,
    wave: 0,
    bus: EventBus.getInstance(),
    damageByWeapon: {},
    benchmarkWeaponId: null,
    infinite: false,
    difficultyMult: 1,
    weaponLevels: {},
    metaStressMult: 1,
    character: BASE_CHARACTER,
    enemySpeedMult: 1,
    weaponJamChance: 0,
    curseId: null,
    curseLockedWeaponId: null,
    curseStressFloor: 0,
    curseForbidCommon: false,
    curseOpenOfficeAura: false,
    curseHrEveryWave: false,
    playerUpgradeIds: [],
    // §E1
    sellaDeGomaKills: 0,
    sellaDeGomaReady: false,
    escudoGrapasActive: false,
    modoDiosActive: false,
    modoDiosDamageBoost: false,
    tripleEspressoSpeedBonus: 0,
  };
}

/** Re-derive modifiers from scratch after each item pick. Character base mults are reapplied each time. */
export function recomputeModifiers(ctx: RunContext): void {
  const c = ctx.character;
  const m = defaultRunModifiers();
  m.maxWeapons = c.maxWeapons;
  m.xpMult *= c.xpMult;
  m.coinMult *= c.coinMult;
  for (const id of ctx.player.items) {
    // Freelancer: Doble Monitor has no effect.
    if (id === 'doble_monitor' && c.doubleMonitorDisabled) continue;
    const def = getItemById(id);
    if (def?.applyModifiers) def.applyModifiers(m, ctx.player);
  }
  // Active curse modifier effects (no_vacation, toxic_culture).
  if (ctx.curseId) {
    const curse = getCurseById(ctx.curseId);
    curse?.applyModifiers?.(m, ctx.player);
  }
  // Replay acquired player upgrades' MODIFIER effects (their PlayerState changes are already
  // persistent). Use a throwaway player copy so hp/speed mutations are not double-applied.
  if (ctx.playerUpgradeIds.length > 0) {
    const dummy = { ...ctx.player };
    for (const id of ctx.playerUpgradeIds) {
      PLAYER_UPGRADES.find(u => u.id === id)?.apply(dummy, m);
    }
  }
  ctx.modifiers = m;
}

/** Apply the selected character's base stats to the player. Call once at run start, before meta. */
export function applyCharacter(ctx: RunContext): void {
  const c = ctx.character;
  ctx.player.maxHp = c.baseHp;
  ctx.player.hp = c.baseHp;
  ctx.player.speed = PLAYER.BASE_SPEED * c.speedMult;
  ctx.player.damageMultiplier = PLAYER.BASE_DAMAGE_MULTIPLIER * c.damageMult;
  ctx.stats.characterId = c.id;
  recomputeModifiers(ctx);
}
