# IMPLEMENTATION — MEJORA 5: BUILD REPORT (post-run screen)

> From `05_mejoras_adicionales.md` §Mejora 5. Roadmap priority #1 (low risk, high impact).
> Builds on completed Phases 1–4. Replaces the generic GameOver/Victory stat list with an
> actionable build report. Zero magic numbers outside config. typecheck + build must pass.

---

## 0. Scope & rules

- NO balance changes. This is feedback/UI + run-stat tracking.
- Some Build Report fields belong to later Mejoras (characterId → Personajes, activeCurse → Maldiciones). Add the FIELDS now (defaulted), populate the rest later. Build Report must render fine with `characterId='base'` and `activeCurse=null`.
- Inspect existing `RunStats` flow: `ctx.stats` is mutated during the run (Enemy.die → kills/coins; StressSystem → maxStress; LevelSystem → maxLevel; CEOBoss → bossDefeated) and passed to end scenes via `SceneManager.go(..., { stats })`.

---

## 1. types/index.ts — EXTEND RunStats

Keep existing fields. Add (all optional-safe with sane defaults set in `createRunContext`):
```ts
export interface RunStats {
  kills: number;
  timeSurvived: number;
  coinsEarned: number;
  maxLevel: number;
  maxStress: number;             // already present (maxStressReached alias — keep maxStress)
  bossDefeated: boolean;
  // NEW — Build Report
  damageBySource: Record<string, number>;   // weaponId/itemId → total damage
  killsByWeapon: Record<string, number>;     // weaponId → kills (killing blow)
  longestWave: { wave: number; enemies: number };
  itemsCollected: string[];                  // ids in acquisition order
  weaponsOwned: string[];                    // final equipped weapon ids
  activeCurse: string | null;                // Mejora 4 — null for now
  characterId: string;                       // Mejora 1 — 'base' for now
}
```

`createRunContext()` defaults:
```ts
damageBySource: {}, killsByWeapon: {}, longestWave: { wave: 0, enemies: 0 },
itemsCollected: [], weaponsOwned: [], activeCurse: null, characterId: 'base',
```

---

## 2. systems/RunTracker.ts (new)

Subscribes to the EventBus and accumulates into `ctx.stats`. Instantiate in GameScene.create (after ctx, before/around other systems). No gameplay effect — read-only on gameplay, write-only to stats.

Subscriptions:
- `damage:dealt {sourceId, amount}` → `stats.damageBySource[sourceId] += amount`.
- `enemy:hit {enemy, amount, sourceId}` → record `enemy.lastDamageSource = sourceId` (for killing-blow attribution). (Add a `lastDamageSource: string` field to Enemy, set in `takeDamage`.)
- `enemy:killed {type,isElite,x,y}` → `stats.killsByWeapon[killerSource] += 1` where killerSource = the enemy's `lastDamageSource` (pass it in the payload OR read from a tracked map). Simplest: add `sourceId` to the `enemy:killed` payload (Enemy.die emits its own `lastDamageSource`). Update the payload type + all emit sites.
- `enemy:spawned` / wave tracking: maintain a per-wave kill counter; on `wave:complete {wave}` compare to `longestWave` and keep the max (`{wave, enemies: killsThisWave}`). Reset counter on `wave:start`.
- `pickup:collected` — not needed here.
- Item acquisition: `itemsCollected` — append on `upgrade:item_selected {id}` (already emitted). Also backup_plan grants push to itemsCollected (it calls applyItemPickup/installItemReactions — ensure id appended; simplest: RunTracker listens to a new `item:acquired {id}` emitted by `applyItemPickup`). Add `item:acquired` emit in `ItemReactions.applyItemPickup` and in the backup_plan grant.

At run end (GameScene handlePlayerDied / handleBossDefeated, before transition): set `stats.weaponsOwned = [...ctx.player.weapons]`, `stats.characterId = ctx.player.characterId ?? 'base'` (characterId lands with Mejora 1; for now ctx has no characterId → use 'base'), `stats.activeCurse = ctx.activeCurse ?? null` (Mejora 4; null now).

Keep it defensive: every dictionary access guarded (`?? 0`).

---

## 3. Enemy + emit changes (minimal)

- `Enemy`: add `lastDamageSource = ''`; set in `takeDamage(amount, sourceId)` → `this.lastDamageSource = sourceId`.
- `Enemy.die()`: include source in the killed payload: `bus.emit('enemy:killed', { type, isElite, x, y, sourceId: this.lastDamageSource })`.
- Update `EnemyKilledPayload` type to add `sourceId: string`. Update all consumers that destructure it (EnemySystem, StressSystem, LevelSystem, GameScene) — they ignore the new field, no logic change.

---

## 4. BuildReportScene — replace GameOver + Victory display

New scene `scenes/BuildReportScene.ts` (`SCENES.BUILD_REPORT='BuildReportScene'`). Receives `{ stats, victory }`. Replaces routing: GameScene `handlePlayerDied` → BuildReport `{victory:false}`; `handleBossDefeated` → BuildReport `{victory:true}`. Keep `GameOverScene`/`VictoryScene` files but route through BuildReport (or delete them and update main.ts + all `SCENES.GAME_OVER`/`VICTORY` refs to BUILD_REPORT). **Recommended: delete GameOverScene + VictoryScene, add BuildReportScene**, update `main.ts` scene list + every reference. The run-end SAVE (SaveManager.updateRunStats) moves into BuildReportScene.create (was in GameOver/Victory).

Layout (from doc, placeholder text/rects):
```
GAME OVER / ¡VICTORIA!            Tiempo: MM:SS
── Build ──
Personaje: <characterId>      (just show id for now)
Nivel: X    Estrés máximo: Y
Top 3 fuentes de daño:   (bars from damageBySource, % of total)
  1. <name>  ████  42%
  2. ...
Arma con más kills: <name> — N kills   (max of killsByWeapon)
Oleada más larga: Oleada X — N enemigos
Maldición activa: <activeCurse or '—'>
── Ítems de esta run ──   (chips from itemsCollected, weapon names from WEAPONS/ITEMS)
✦ Sinergia activa: <pairs where an owned item's synergyWith ⊆ owned>   (if any)
[JUGAR DE NUEVO]  [MENÚ PRINCIPAL]
```
- Resolve ids→names via `getWeaponById`/`getItemById`.
- Top-3 damage: sort `damageBySource` desc, take 3, bar width ∝ share. Bar layout consts in config (`BUILD_REPORT` block).
- Synergy line: for each owned item with `synergyWith`, if any listed id is owned (weapon or item), show "name + name".
- Buttons: JUGAR DE NUEVO → GameScene; MENÚ → MainMenu. Clicks → AudioManager `click`.
- Save run stats here (moved from GameOver/Victory): `SaveManager.save(SaveManager.updateRunStats(stats, SaveManager.load()))`.

Add a `BUILD_REPORT` config block for layout/bar dims (no magic numbers in the scene).

---

## 5. config

```ts
export const SCENES = { /* … */ BUILD_REPORT: 'BuildReportScene' } as const;

export const BUILD_REPORT = {
  TOP_DAMAGE_COUNT: 3,
  BAR_MAX_W: 220,
  BAR_H: 14,
  CHIP_W: 120,
  CHIP_H: 22,
} as const;
```
Remove `SCENES.GAME_OVER`/`SCENES.VICTORY` only if you delete those scenes; otherwise keep. (Recommended: delete + remove their keys.)

---

## 6. Acceptance

- [ ] typecheck + build clean. No `any`. No magic numbers outside config.
- [ ] RunTracker accumulates damageBySource, killsByWeapon, longestWave, itemsCollected.
- [ ] BuildReportScene shows: result+time, level, max stress, top-3 damage bars, top-kill weapon, longest wave, items chips, synergy line.
- [ ] Win → "¡VICTORIA!"; death → "GAME OVER"; same scene.
- [ ] Run stats persist (SaveManager) exactly once at run end (moved into BuildReport).
- [ ] characterId shows 'base', activeCurse shows '—' (fields ready for Mejoras 1 & 4).
- [ ] No gameplay regression (run completable, items/weapons work).

## 7. Output
1. Summary. 2. Files created/modified/deleted. 3. Event/payload changes. 4. Risks. 5. typecheck/build status. 6. Confirm GameOver/Victory routing now goes through BuildReport.
