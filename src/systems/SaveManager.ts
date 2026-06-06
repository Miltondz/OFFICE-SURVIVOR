// src/systems/SaveManager.ts
import { AUDIO } from '@/config/game.config';
import type { SaveData, RunStats } from '@/types';

const SAVE_KEY = 'office_survivor_save';
const CURRENT_VERSION = 3; // v2→v3: added display/accessibility settings (FASE H)

const DEFAULTS: SaveData = {
  saveVersion: CURRENT_VERSION,
  totalRuns: 0,
  totalKills: 0,
  totalTimePlayed: 0,
  bossesDefeated: 0,
  totalCoinsEarned: 0,
  bestRunTime: 0,
  bestLevel: 0,
  bestKillsInRun: 0,
  coins: 0,
  metaUpgrades: {},
  settings: {
    musicVolume: AUDIO.DEFAULTS.music,
    sfxVolume: AUDIO.DEFAULTS.sfx,
    uiVolume: AUDIO.DEFAULTS.ui,
    // FASE H defaults
    fullscreen: false,
    zoom: 0,          // 0 = auto/FIT
    smoothing: false, // pixel art by default
    screenShake: 1,   // full intensity
    vignette: true,
    damageNumbers: true,
  },
};

export class SaveManager {
  /** Load save from localStorage. Falls back to defaults on corruption or missing save. */
  static load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { ...DEFAULTS, metaUpgrades: {}, settings: { ...DEFAULTS.settings } };
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const migrated = SaveManager.migrate(parsed);
      // Deep-merge defaults so old/missing fields are filled
      return {
        ...DEFAULTS,
        ...migrated,
        metaUpgrades: { ...((migrated.metaUpgrades) ?? {}) },
        settings: {
          ...DEFAULTS.settings,
          ...((migrated.settings) ?? {}),
        },
      };
    } catch {
      console.warn('[SaveManager] Save corrupted — loading defaults');
      return { ...DEFAULTS, metaUpgrades: {}, settings: { ...DEFAULTS.settings } };
    }
  }

  static save(data: SaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, saveVersion: CURRENT_VERSION }));
    } catch (e) {
      console.error('[SaveManager] Failed to save:', e);
    }
  }

  /** Migrate saves from older versions. */
  static migrate(data: Partial<SaveData>): Partial<SaveData> {
    const d = { ...data };
    // v1 → v2: ensure coins, bestKillsInRun, and settings exist
    if ((d.saveVersion ?? 0) < 2) {
      if (d.coins === undefined) d.coins = 0;
      if (d.bestKillsInRun === undefined) d.bestKillsInRun = 0;
      if (d.settings === undefined) {
        d.settings = { ...DEFAULTS.settings };
      } else {
        d.settings = { ...DEFAULTS.settings, ...d.settings };
      }
      // fall through to v2→v3 below
    }
    // v2 → v3: merge new display/accessibility settings (FASE H)
    if ((d.saveVersion ?? 0) < 3) {
      // The deep-merge in load() with {...DEFAULTS.settings, ...d.settings} already backfills
      // missing keys, so we just ensure the settings object exists here.
      if (d.settings === undefined) {
        d.settings = { ...DEFAULTS.settings };
      } else {
        d.settings = { ...DEFAULTS.settings, ...d.settings };
      }
      d.saveVersion = CURRENT_VERSION;
    }
    return d;
  }

  /** Update cumulative stats after a run ends. Returns the updated SaveData (caller must save). */
  static updateRunStats(run: RunStats, cur: SaveData): SaveData {
    return {
      ...cur,
      totalRuns: cur.totalRuns + 1,
      totalKills: cur.totalKills + run.kills,
      totalTimePlayed: cur.totalTimePlayed + run.timeSurvived,
      bossesDefeated: cur.bossesDefeated + (run.bossDefeated ? 1 : 0),
      totalCoinsEarned: cur.totalCoinsEarned + run.coinsEarned,
      coins: cur.coins + run.coinsEarned,               // add to spendable wallet
      bestRunTime: run.bossDefeated
        ? Math.min(cur.bestRunTime === 0 ? Infinity : cur.bestRunTime, run.timeSurvived)
        : cur.bestRunTime,
      bestLevel: Math.max(cur.bestLevel, run.maxLevel),
      bestKillsInRun: Math.max(cur.bestKillsInRun, run.kills),
    };
  }

  /** Export save as base64-encoded JSON string. */
  static export(): string {
    return btoa(JSON.stringify(SaveManager.load()));
  }

  /** Import a base64-encoded save. Returns true on success, false on failure. */
  static import(encoded: string): boolean {
    try {
      const data = JSON.parse(atob(encoded)) as SaveData;
      SaveManager.save(data);
      return true;
    } catch {
      return false;
    }
  }

  static reset(): void {
    localStorage.removeItem(SAVE_KEY);
  }
}
