# IMPLEMENTATION — FASE 4 (Release Candidate: Save, Meta, Balance)

> Refined from `04_fase4_release.md` + `00_game_bible.md`. Builds on completed, audited Phases 1–3.
> **No new gameplay mechanics.** Stabilize, persist, balance. Zero magic numbers outside config.
> `npm run typecheck` + `npm run build` must pass at the end.

---

## 0. Pre-flight & current state

- SaveData type exists (`types/index.ts`) but is minimal. `META_UPGRADE_DISPLAY` exists (config, display-only). `UpgradeScene` shows a disabled meta grid. `StatisticsScene` + `MainMenuScene` each have their OWN local `loadSave()` + `SAVE_KEY='office_survivor_save'` — **centralize these into SaveManager**; replace the duplicates.
- AudioManager (Phase 3) holds volumes in memory; not persisted yet.
- Progression note (already shipped): runs open with a weapons-only starting choice, and `wave:complete` grants an upgrade each wave. Keep this — balance around it.
- Build order: §1 SaveManager → §2 meta.config → §3 apply meta at run start → §4 UpgradeScene purchase → §5 persist stats on run end → §6 audio settings persistence → §7 export/import → §8 balance pass → §9 perf. Typecheck after each.

---

## 1. types/index.ts — EXTEND SaveData

Keep existing fields. Add:
```ts
export interface SaveData {
  saveVersion: number;
  totalRuns: number;
  totalKills: number;
  totalTimePlayed: number;        // seconds
  bossesDefeated: number;
  totalCoinsEarned: number;       // lifetime stat (never decremented)
  bestRunTime: number;            // seconds (victory runs)
  bestLevel: number;
  bestKillsInRun: number;         // NEW
  coins: number;                  // NEW — spendable wallet (earned − spent on meta)
  metaUpgrades: Record<string, number>;  // id → purchased level
  settings: {                     // NEW
    musicVolume: number;          // 0–1
    sfxVolume: number;
    uiVolume: number;
  };
}
```

---

## 2. systems/SaveManager.ts (centralize — replace the 3 local copies)

```ts
const SAVE_KEY = 'office_survivor_save';
const CURRENT_VERSION = 2;   // was implicitly 1; bump for new fields

const DEFAULTS: SaveData = {
  saveVersion: CURRENT_VERSION,
  totalRuns: 0, totalKills: 0, totalTimePlayed: 0, bossesDefeated: 0,
  totalCoinsEarned: 0, bestRunTime: 0, bestLevel: 0, bestKillsInRun: 0,
  coins: 0, metaUpgrades: {},
  settings: { musicVolume: AUDIO.DEFAULTS.music, sfxVolume: AUDIO.DEFAULTS.sfx, uiVolume: AUDIO.DEFAULTS.ui },
};

export class SaveManager {
  static load(): SaveData { try { merge DEFAULTS with parsed+migrate } catch { return {...DEFAULTS} } }
  static save(data: SaveData): void { localStorage.setItem(..., JSON.stringify({...data, saveVersion: CURRENT_VERSION})) }
  static migrate(d: Partial<SaveData>): Partial<SaveData> { // v1→v2: ensure coins, bestKillsInRun, settings exist }
  static updateRunStats(run: RunStats, cur: SaveData): SaveData { /* see §5 */ }
  static export(): string { return btoa(JSON.stringify(SaveManager.load())) }
  static import(encoded: string): boolean { try { save(parse(atob)) ; true } catch { false } }
  static reset(): void { localStorage.removeItem(SAVE_KEY) }
}
```
- `load()` must deep-merge DEFAULTS so old/missing fields are filled (don't crash on a v1 save).
- Use `AUDIO.DEFAULTS` from config for default volumes.
- After writing SaveManager, **delete** the local `loadSave`/`SAVE_KEY` in `StatisticsScene.ts` and `MainMenuScene.ts`; import SaveManager instead.

---

## 3. meta.config.ts — purchasable upgrades + apply-at-run-start

`config/meta.config.ts`:
```ts
import type { PlayerState } from '@/types';

export interface MetaUpgrade {
  id: string; name: string; description: string;
  maxLevel: number;
  costPerLevel: number[];     // [lvl1, lvl2, …]
  applyToPlayer: (p: PlayerState, level: number) => PlayerState;
}

export const META_UPGRADES: MetaUpgrade[] = [
  { id: 'base_hp',       name: 'HP inicial +25',        maxLevel: 5, costPerLevel: [50,75,100,150,200],
    applyToPlayer: (p,l) => ({ ...p, maxHp: p.maxHp + 25*l, hp: p.hp + 25*l }) },
  { id: 'base_damage',   name: 'Daño base +10%',        maxLevel: 5, costPerLevel: [75,100,150,200,300],
    applyToPlayer: (p,l) => ({ ...p, damageMultiplier: p.damageMultiplier * Math.pow(1.10, l) }) },
  { id: 'base_speed',    name: 'Velocidad +5%',         maxLevel: 3, costPerLevel: [60,90,130],
    applyToPlayer: (p,l) => ({ ...p, speed: p.speed * Math.pow(1.05, l) }) },
  { id: 'stress_resist', name: 'Resistencia al estrés', maxLevel: 3, costPerLevel: [100,150,250],
    applyToPlayer: (p,_l) => p },  // affects StressSystem via ctx.metaStressMult — see below
  { id: 'alt_character', name: 'Personaje alternativo', maxLevel: 1, costPerLevel: [200],
    applyToPlayer: (p,_l) => p },  // cosmetic placeholder
  { id: 'starting_weapon', name: 'Arma inicial extra',  maxLevel: 1, costPerLevel: [150],
    applyToPlayer: (p,_l) => p },  // grants +1 starting choice — see §3 note
];

export const META_STRESS_RESIST_PER_LEVEL = 0.20; // -20% stress accrual per level
```
Keep `META_UPGRADE_DISPLAY` in game.config OR derive the UpgradeScene grid from `META_UPGRADES` (preferred — single source; you may remove `META_UPGRADE_DISPLAY` and read `META_UPGRADES`). If you remove it, update UpgradeScene import.

**`stress_resist`**: add `metaStressMult: number` to RunContext (default 1). In `applyMetaUpgrades` set `ctx.metaStressMult = Math.pow(1 - META_STRESS_RESIST_PER_LEVEL, level)`. StressSystem.`stressIncreaseMult()` multiplies by `ctx.metaStressMult` (alongside ergonomia/auriculares_nc).

**`starting_weapon` note**: every run already opens a starting weapon choice. If `starting_weapon` level ≥ 1, grant a SECOND starting pick (call `levelSys.grantUpgrade(true)` twice in GameScene). Document this reinterpretation in a comment.

### Apply at run start — GameScene.create
Before creating systems that read player stats, after `createRunContext()`:
```ts
const save = SaveManager.load();
applyMetaUpgrades(this.ctx, save);   // mutates ctx.player + ctx.metaStressMult
```
`applyMetaUpgrades(ctx, save)`: for each META_UPGRADES with `save.metaUpgrades[id] > 0`, run `applyToPlayer`. Handle stress_resist + starting_weapon specially as above.

---

## 4. UpgradeScene — purchase logic (replace disabled layout)

Read `SaveManager.load()`. For each `META_UPGRADES`:
- show name, description, current level `X/max`, next cost (`costPerLevel[level]`).
- **COMPRAR** enabled iff `level < maxLevel` AND `save.coins >= nextCost`.
- On buy: `save.metaUpgrades[id] = level+1`; `save.coins -= nextCost`; `SaveManager.save(save)`; refresh UI in place (no scene reload). Update a visible "Monedas: X" header.
- At max level: button shows "MÁX", disabled.
- "VOLVER" → MainMenu. Button clicks → AudioManager `click`.
LinkedIn Premium meta-discount (Bible) is an in-run item, not meta — ignore here.

---

## 5. Persist stats on run end

`SaveManager.updateRunStats(run, cur)`:
```ts
return {
  ...cur,
  totalRuns: cur.totalRuns + 1,
  totalKills: cur.totalKills + run.kills,
  totalTimePlayed: cur.totalTimePlayed + run.timeSurvived,
  bossesDefeated: cur.bossesDefeated + (run.bossDefeated ? 1 : 0),
  totalCoinsEarned: cur.totalCoinsEarned + run.coinsEarned,
  coins: cur.coins + run.coinsEarned,                 // add to spendable wallet
  bestRunTime: run.bossDefeated ? Math.min(cur.bestRunTime || Infinity, run.timeSurvived) : cur.bestRunTime,
  bestLevel: Math.max(cur.bestLevel, run.maxLevel),
  bestKillsInRun: Math.max(cur.bestKillsInRun, run.kills),
};
```
- `RunStats` already has kills/timeSurvived/coinsEarned/maxLevel/bossDefeated. Ensure `kills` + `maxLevel` are tracked during the run (Enemy.die increments kills; LevelSystem updates maxLevel — verify).
- Call once when the run ends: in **GameOverScene** AND **VictoryScene** `create()` (they receive `{ stats }`). Do `const s = SaveManager.load(); SaveManager.save(SaveManager.updateRunStats(stats, s));`. Guard against double-apply (only on first create; scenes are fresh per transition so fine).
- The Game Bible "no guardar durante la partida" — only save at run end / purchase / settings change.

---

## 6. Audio settings persistence

- On boot (BootScene or PreloadScene): `const s = SaveManager.load(); AudioManager.getInstance().setVolume('music', s.settings.musicVolume)` etc.
- MainMenu config sliders (Phase 3) → on change: `AudioManager.setVolume(...)` AND write `save.settings.*` + `SaveManager.save(save)`.

---

## 7. Export / Import (StatisticsScene)

Add two buttons:
- **EXPORTAR**: `navigator.clipboard.writeText(SaveManager.export())` (fallback: show the base64 string in a text object to copy).
- **IMPORTAR**: `window.prompt('Pega tu save:')` → `SaveManager.import(value)` → show "OK"/"Error" + refresh scene.

---

## 8. Balance pass (conservative first cut — user iterates from playtests)

Player reported difficulty needs tuning. With per-wave upgrades now active, the player gets stronger faster. Apply ONE conservative pass and document every change inline in `game.config.ts` (`VALUE, // era X — razón (balance v1)`). Only these params may change (per Bible Phase 4 allowlist):
`PLAYER.BASE_HP`, `STRESS.DAMAGE_PER_HIT`, `STRESS.KILL_NORMAL_DECREASE`, `STRESS.KILL_ELITE_DECREASE`, `WAVES.ENEMIES_PER_WAVE_MULTIPLIER`, enemy `hp/damage/speed`, weapon `baseDamage/fireRate`, `ECONOMY.*_COINS_*`, `PROGRESSION.XP_PER_LEVEL_MULTIPLIER`.

Targets (Bible): run 8–12 min, max level 10–14, burnout in ~40% of runs, no dominant weapon, first meta upgrade in 2–3 runs.

Guidance for v1 (keep changes small, justify each):
- Early waves should not be lethal at base 100 HP given the new fast upgrades — verify; nudge `BASE_HP` only if clearly needed.
- Since upgrades now come every wave, XP-based leveling may over-level → consider whether `XP_PER_LEVEL_MULTIPLIER` should rise (slower XP levels) so total upgrade rate stays sane. Document reasoning.
- Do NOT overhaul. Change a few values, comment rationale, leave the rest for the user's playtest data.

Add a short `doc/BALANCE_v1.md` listing each changed value, old→new, and why.

---

## 9. Performance

Measure-first (Bible). Existing: off-screen enemy AI skip, pooling for projectiles/enemies/pickups/damage-numbers/particles. Do NOT optimize blindly. Only if an obvious leak/uncapped allocation is visible on inspection, fix it and note. Confirm `arcade.debug` is gated to `import.meta.env.DEV` (already is). No required changes unless a concrete issue is found.

---

## 10. Documentation

Update `README.md`: status "MVP Completo", phase table all ✓, list implemented systems, EventBus event table, `game.config.ts` constants table, and "how to replace art" (asset keys + placeholder dimensions). Add `doc/BALANCE_v1.md` from §8.

---

## 11. Acceptance

- [ ] `npm run typecheck` + `build` clean. No `any`. No magic numbers outside config.
- [ ] SaveManager centralized; StatisticsScene + MainMenu use it (no duplicate loadSave).
- [ ] Corruption-safe load (bad JSON → defaults); v1→v2 migration fills new fields.
- [ ] Export/Import works.
- [ ] 6 meta upgrades purchasable in UpgradeScene; cost/level correct; can't buy without coins or at max.
- [ ] Meta upgrades apply at run start (verify base_hp/base_damage/base_speed/stress_resist take effect).
- [ ] Stats persist + accumulate across runs; best-run only improves; coins wallet grows by run earnings and shrinks on purchase.
- [ ] Save on run end (GameOver + Victory), on purchase, on audio change — not mid-run.
- [ ] Audio volumes persist across sessions.
- [ ] Balance v1 applied + documented in BALANCE_v1.md + inline comments.
- [ ] No Phase 1–3 regressions (run completable, items work, HUD/feel intact, starting weapon choice + per-wave upgrades intact).

## 12. Output
1. Summary. 2. Files created/modified. 3. Balance changes table (old→new + why). 4. Any gameplay touched beyond meta application. 5. Risks. 6. typecheck/build status. 7. Note: project MVP complete — no Phase 5.
