import { RARITY_WEIGHTS, RARITY_RULES, COMBAT } from '@/config/game.config';
import type { ItemDefinition, PlayerState, Rarity, RunModifiers } from '@/types';
import { ITEMS, WEAPONS } from '@/config/items.config';
import type { WeaponDefinition } from '@/types';

type PoolEntry = { item: ItemDefinition | WeaponDefinition; weight: number; isWeapon: boolean };

const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}

function getPlayerBuildTags(player: PlayerState): string[] {
  const tags: string[] = [];
  for (const id of player.weapons) {
    const def = WEAPONS.find(w => w.id === id);
    if (def) tags.push(...def.tags);
  }
  for (const id of player.items) {
    const def = ITEMS.find(i => i.id === id);
    if (def) tags.push(...def.tags);
  }
  return [...new Set(tags)];
}

function getEpicCount(player: PlayerState): number {
  return player.items.filter(id => {
    const def = ITEMS.find(i => i.id === id);
    return def?.rarity === 'epic';
  }).length;
}

function getLegendaryCount(player: PlayerState): number {
  return player.items.filter(id => {
    const def = ITEMS.find(i => i.id === id);
    return def?.rarity === 'legendary';
  }).length;
}

export class UpgradePool {
  pick(
    player: PlayerState,
    modifiers: RunModifiers,
    count: number,
    weaponLevels: Record<string, number> = {},
    weaponsOnly = false,
    forbidHighRarityWeapons = false,
    forbidCommonItems = false,
  ): (ItemDefinition | WeaponDefinition)[] {
    const buildTags = getPlayerBuildTags(player);
    const epicCount = getEpicCount(player);
    const legendaryCount = getLegendaryCount(player);
    const highestRarity: Rarity = (() => {
      let best: Rarity = 'common';
      for (const id of player.items) {
        const def = ITEMS.find(i => i.id === id);
        if (def && rarityRank(def.rarity) > rarityRank(best)) best = def.rarity;
      }
      return best;
    })();

    const pool: PoolEntry[] = [];

    // Add items (skipped entirely for the weapons-only starting choice)
    for (const item of ITEMS) {
      if (weaponsOnly) break;
      // Consumables spawn on the map, not in the level-up pool (Game Bible).
      if (item.category === 'consumable') continue;
      // Curse micromanagement: offered items are rarity +1 (no commons).
      if (forbidCommonItems && item.rarity === 'common') continue;
      // Exclude owned non-weapon non-stackable items
      if (player.items.includes(item.id)) {
        if (!item.maxStack || item.maxStack <= 1) continue;
      }
      // Rarity gates
      if (item.rarity === 'epic' && player.level < RARITY_RULES.EPIC_MIN_LEVEL) continue;
      if (item.rarity === 'legendary' && player.level < RARITY_RULES.LEGENDARY_MIN_LEVEL) continue;
      // Per-run caps
      if (item.rarity === 'epic' && epicCount >= RARITY_RULES.EPIC_MAX_PER_RUN) continue;
      if (item.rarity === 'legendary' && legendaryCount >= RARITY_RULES.LEGENDARY_MAX_PER_RUN) continue;

      let w = RARITY_WEIGHTS[item.rarity];
      const hasSynergy = item.synergyWith?.some(id => player.weapons.includes(id) || player.items.includes(id));
      if (hasSynergy) w *= 3;
      const sharesTag = item.tags.some(t => buildTags.includes(t));
      if (sharesTag) w *= 1.5;
      pool.push({ item, weight: w, isWeapon: false });
    }

    // Add weapons (always available to level up)
    for (const weapon of WEAPONS) {
      // Becario: cannot equip epic/legendary weapons.
      if (forbidHighRarityWeapons && (weapon.rarity === 'epic' || weapon.rarity === 'legendary')) continue;
      const owned = player.weapons.includes(weapon.id);
      const level = weaponLevels[weapon.id] ?? 0;
      if (owned && level >= COMBAT.WEAPON_MAX_LEVEL) continue; // maxed out
      if (!owned && player.weapons.length >= modifiers.maxWeapons) continue; // no slot

      let w = RARITY_WEIGHTS[weapon.rarity];
      const sharesTag = weapon.tags.some(t => buildTags.includes(t));
      if (sharesTag) w *= 1.5;
      pool.push({ item: weapon, weight: w, isWeapon: true });
    }

    if (pool.length === 0) return [];

    // Weighted random without replacement
    const picks: (ItemDefinition | WeaponDefinition)[] = [];
    const available = [...pool];

    // Ensure at least 1 pick of rarity >= player's highest
    let guaranteedAdded = false;

    for (let i = 0; i < count && available.length > 0; i++) {
      let subset = available;
      // First pick: try to guarantee highest rarity
      if (i === 0 && !guaranteedAdded && highestRarity !== 'common') {
        const highPool = available.filter(e => rarityRank(e.item.rarity) >= rarityRank(highestRarity));
        if (highPool.length > 0) { subset = highPool; guaranteedAdded = true; }
      }

      const totalW = subset.reduce((s, e) => s + e.weight, 0);
      let rand = Math.random() * totalW;
      let chosen: PoolEntry | null = null;
      for (const entry of subset) {
        rand -= entry.weight;
        if (rand <= 0) { chosen = entry; break; }
      }
      if (!chosen) chosen = subset[subset.length - 1];
      picks.push(chosen.item);
      const idx = available.indexOf(chosen);
      if (idx !== -1) available.splice(idx, 1);
    }

    return picks;
  }
}
