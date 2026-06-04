# IMPLEMENTATION — FASE 3 (UX, UI, Game Feel)

> Refined build spec from `03_fase3_ux_ui_feel.md` + `00_game_bible.md`.
> Builds on completed + audited Phase 2. **No new gameplay mechanics** — only presentation/feedback.
> Inspect existing code first. Do NOT modify gameplay logic. Zero magic numbers outside config.
> `npm run typecheck` + `npm run build` must pass at the end.

---

## 0. Pre-flight & rules

- Phase 2 is done. Existing events on the EventBus singleton (use these — do not invent new gameplay events):
  `player:hit {amount}`, `player:died`, `player:level_up {level}`, `player:burnout`,
  `enemy:hit {enemy, amount, sourceId}`, `enemy:killed {type, isElite, x, y}`, `enemy:spawned {type}`,
  `stress:changed {value, state?}`, `wave:start {wave}`, `wave:complete {wave}`,
  `boss:spawned`, `boss:phase2`, `boss:defeated`, `pickup:collected {...}`, `damage:dealt {sourceId, amount}`.
- HUD lives in a **separate overlay scene** (`HUDScene`) launched over `GameScene`. HUD reads `RunContext` (passed at launch) for continuous values and subscribes to the bus for discrete events. HUD **never writes** gameplay state.
- **Screen shake shakes only `GameScene.cameras.main`.** HUDScene is a separate scene → unaffected automatically. Damage numbers / particles live in GameScene world space (they should shake with the world).
- If something in Phase 2 looks broken while adding feel: **document as risk, do not silently fix gameplay**.
- Audio: generate placeholder beeps via Web Audio API. No external asset files.

---

## 1. game.config.ts — ADD

```ts
export const SCENES = { /* …existing… */ HUD: 'HUDScene', STATISTICS: 'StatisticsScene' } as const;

export const HUD = {
  HP_BAR: { x: 12, y: 12, w: 200, h: 16 },
  STRESS_BAR: { x: 12, y: 34, w: 200, h: 16 },
  XP_BAR: { w: 400, h: 8, yFromBottom: 18 },
  PULSE_MS: 400,            // burnout red pulse / stress 90+ pulse
  PULSE_ALPHA_MIN: 0.6,
} as const;

export const STRESS_COLORS = {
  RELAXED: 0x4caf50,  // 0–30
  TENSE:   0xffc107,  // 31–69
  LIMIT:   0xff9800,  // 70–89
  BURNOUT: 0xf44336,  // 90–99 (pulsing)
} as const;

export const FEEL = {
  DMG_NUM_POOL: 60,
  DMG_NUM_RISE_PX: 40,
  DMG_NUM_RISE_MS: 800,
  DMG_NUM_CRIT_RISE_PX: 60,
  DMG_NUM_PLAYER_RISE_PX: 30,
  DMG_NUM_PLAYER_MS: 600,
  ENEMY_FLASH_MS: 80,
  ENEMY_DEATH_MS: 100,
  ENEMY_DEATH_SCALE: 1.4,
  BOSS_DEATH_FREEZE_MS: 500,
  BOSS_DEATH_TWEEN_MS: 1500,
  LEVELUP_POPUP_MS: 600,
  VIGNETTE_ALPHA_MAX: 0.15,
} as const;

export const SHAKE = {
  PLAYER_HIT:   { ms: 200, intensity: 0.003 },
  ELITE_KILLED: { ms: 250, intensity: 0.005 },
  BOSS_HIT:     { ms: 300, intensity: 0.006 },
  BOSS_DEAD:    { ms: 600, intensity: 0.012 },
} as const;
// Note: Phaser camera.shake intensity is a 0–1 fraction of viewport, not pixels.

export const PARTICLES = {
  ENEMY_DEATH:  { count: 6,  color: 0xff9800, ms: 400 },
  ELITE_DEATH:  { count: 12, color: 0xff3333, ms: 600 },
  PICKUP:       { count: 8,  color: 0xffff00, ms: 300 },
  CAFE_PICKUP:  { count: 10, color: 0x6f4e37, ms: 400 },
} as const;

export const AUDIO = {
  DEFAULTS: { music: 0.5, sfx: 0.8, ui: 1.0 },
  BEEPS: {
    // key → { freq, ms }
    shoot:        { freq: 220, ms: 0.05 },
    enemy_hit:    { freq: 330, ms: 0.04 },
    enemy_die:    { freq: 160, ms: 0.12 },
    player_hit:   { freq: 110, ms: 0.15 },
    player_die:   { freq: 80,  ms: 0.4 },
    level_up:     { freq: 660, ms: 0.2 },
    pickup:       { freq: 880, ms: 0.1 },
    burnout_start:{ freq: 140, ms: 0.3 },
    boss_appear:  { freq: 100, ms: 0.5 },
    boss_die:     { freq: 90,  ms: 0.6 },
    click:        { freq: 500, ms: 0.05 },
  },
} as const;
```

Meta-upgrade table for the UpgradeScene layout (UI only — purchase logic is Phase 4):
```ts
export const META_UPGRADE_DISPLAY = [
  { id: 'base_hp',       name: 'HP inicial +25',        cost: 50,  maxLevel: 5, perLevel: '+25 HP base' },
  { id: 'base_damage',   name: 'Daño base +10%',        cost: 75,  maxLevel: 5, perLevel: '+10% daño' },
  { id: 'base_speed',    name: 'Velocidad +5%',         cost: 60,  maxLevel: 3, perLevel: '+5% movimiento' },
  { id: 'stress_resist', name: 'Resistencia al estrés', cost: 100, maxLevel: 3, perLevel: '-20% subida estrés' },
  { id: 'alt_character', name: 'Personaje alternativo', cost: 200, maxLevel: 1, perLevel: '(placeholder)' },
  { id: 'starting_weapon', name: 'Arma inicial',        cost: 150, maxLevel: 1, perLevel: 'Elegir arma inicio' },
] as const;
```

---

## 2. Priority order (build + verify each)

1. AudioManager (+ beep generation) — wire to existing events
2. HUDScene (overlay) — bars, timer, wave, coins, weapons, boss bar
3. Burnout vignette + stress pulse
4. DamageNumbers (GameScene)
5. Enemy hit-flash + death tween; CEO death sequence
6. ScreenShake
7. Level-up popup
8. Particles
9. UpgradeOverlay polish (rarity borders, hover, synergy mark)
10. MainMenuScene polish
11. UpgradeScene (meta layout, disabled)
12. StatisticsScene

---

## 3. AudioManager — `systems/AudioManager.ts`

```ts
type AudioCategory = 'music' | 'sfx' | 'ui';
class AudioManager {
  private static instance: AudioManager;
  static getInstance(): AudioManager { ... }
  private ctx: AudioContext | null = null;     // lazy-create on first user gesture
  private volumes = { ...AUDIO.DEFAULTS };
  setVolume(cat: AudioCategory, v: number): void;
  playBeep(key: keyof typeof AUDIO.BEEPS, cat: AudioCategory): void;  // oscillator + gain envelope
  // music: loop a low oscillator or skip (placeholder) — keep simple
}
```
- Beep via `OscillatorNode` + `GainNode` exponential ramp (Phase 3 doc snippet). Respect category volume.
- AudioContext must be created/resumed after a user gesture (browser policy) — resume on first menu click.
- Wire hooks (subscribe in GameScene or a small AudioBridge): `enemy:hit→enemy_hit`, `enemy:killed→enemy_die`, `player:hit→player_hit`, `player:died→player_die`, `player:level_up→level_up`, `pickup:collected→pickup`, `player:burnout→burnout_start`, `boss:spawned→boss_appear`, `boss:defeated→boss_die`. Weapon `shoot` on fire (throttle — don't play 10×/s for laser; cap ~8/s).
- Menu button clicks → `click` (ui).

---

## 4. HUDScene — `scenes/HUDScene.ts`

Launched from GameScene: `this.scene.launch(SCENES.HUD, { ctx: this.ctx })`. Runs parallel, on top. Replace GameScene's inline `hudText`/`waveText` (remove those; keep a tiny debug line behind `import.meta.env.DEV` only if useful).

Elements (positions from `HUD` config + computed):
- **HP bar** top-left: red fill ∝ hp/maxHp, label `HP: X/Y`.
- **Stress bar** below HP: fill ∝ stress/100, **color by range** (`STRESS_COLORS`), label `ESTRÉS: X`. At 90–99 pulse alpha 1.0↔0.6 (tween loop `PULSE_MS`).
- **XP bar** bottom-center: blue, ∝ xp/(level×100). Label `Nivel X` left of it.
- **Coins** top-right: `🪙 X` (text placeholder).
- **Timer** top-center: `MM:SS` counting **down** from 10:00 (`RUN_DURATION_S - elapsedS`, clamp ≥0). Use `formatTime`.
- **Wave** under timer: `Oleada X / 10` (infinite mode: `Oleada X`).
- **Weapons** bottom-left: one small labeled rect per equipped weapon (abbreviated id + level).
- **Boss HP bar**: hidden until `boss:spawned`; full-width top bar, red, label "CEO". Updates from ctx.boss hp — expose boss hp on ctx OR via `boss:hp {ratio}` events. Simplest: GameScene emits `boss:hp {ratio}` each frame while boss alive; HUD listens. Hide on `boss:defeated`.

HUD reads `ctx` each `update()` for bars (read-only). Stop HUDScene when GameScene transitions out (GameScene `shutdown` → `this.scene.stop(SCENES.HUD)`).

---

## 5. Burnout vignette — in GameScene (world overlay, fixed to camera)

Red full-screen rectangle, `setScrollFactor(0)`, depth high, alpha pulsing 0↔`VIGNETTE_ALPHA_MAX` (tween loop `PULSE_MS`). Visible only while `stress >= 90`. Toggle on `player:burnout` / `stress:changed`.

---

## 6. DamageNumbers — `systems/DamageNumbers.ts` (in GameScene)

Pooled `Phaser.GameObjects.Text` (`FEEL.DMG_NUM_POOL`). `show({value, x, y, kind})` where kind ∈ `normal|crit|player`:
- normal: white 14px, rise `DMG_NUM_RISE_PX` over `DMG_NUM_RISE_MS`, fade out.
- crit: yellow 20px, rise `DMG_NUM_CRIT_RISE_PX`.
- player: red 16px, rise `DMG_NUM_PLAYER_RISE_PX` over `DMG_NUM_PLAYER_MS`.
Recycle Text on tween complete.

Crit info: WeaponSystem already rolls crit in `getDamage` but doesn't expose it. **Minimal allowed change**: set `Projectile.isCrit` when fired, carry into `enemy:hit` payload as `isCritical`. For the beam (debug_laser) pass crit via the damage call. DamageNumbers subscribes `enemy:hit {enemy, amount, isCritical}` → show at enemy pos; `player:hit {amount}` → show at player pos (read scene data `playerX/Y`) kind=player. Round displayed values (`Math.round`).

---

## 7. Enemy feedback — `entities/Enemy.ts` (presentation only)

- **Hit flash**: on `takeDamage`, tint to white `0xffffff` for `ENEMY_FLASH_MS`, then restore type color. (Rectangle → `setFillStyle(0xffffff)` then restore via `delayedCall`.)
- **Death tween**: in `die()`, before deactivate — disable physics, tween scale `1→ENEMY_DEATH_SCALE` + alpha `1→0` over `ENEMY_DEATH_MS`, then deactivate (reset scale/alpha on next spawn). Emit particles (see §9).
- Keep all existing gameplay in `die()` intact (xp/coins/events) — only add visuals.

**CEO death sequence** (`entities/CEOBoss.die` + GameScene):
1. freeze `timeScale=0` for `BOSS_DEATH_FREEZE_MS` (use real-time delayedCall since timeScale=0 pauses tweens — use `scene.time.delayedCall` with `timeScale`-independent or set timeScale back).
2. `SHAKE.BOSS_DEAD` screen shake.
3. CEO tween scale `1→2` + alpha `1→0` over `BOSS_DEATH_TWEEN_MS`.
4. then → VictoryScene (existing `boss:defeated` flow; delay the scene transition until tween done).

---

## 8. ScreenShake — `systems/ScreenShake.ts`

```ts
class ScreenShake {
  constructor(private cam: Phaser.Cameras.Scene2D.Camera) {}
  play(preset: keyof typeof SHAKE): void { this.cam.shake(SHAKE[preset].ms, SHAKE[preset].intensity); }
}
```
GameScene owns one bound to `cameras.main`. Subscribe: `player:hit→PLAYER_HIT`, `enemy:killed`(isElite)→`ELITE_KILLED`, boss hit (`enemy:hit` when target is boss, or a `boss:hit` emit)→`BOSS_HIT`, `boss:defeated→BOSS_DEAD`.

---

## 9. Particles — `systems/ParticleBursts.ts`

Use `this.add.particles` with a tiny generated 4px circle texture (generate once via `Graphics.generateTexture`). Helper `burst(x,y, cfg)` reading `PARTICLES.*`. Fire on `enemy:killed` (elite vs normal count/color), `pickup:collected` (café vs normal color).

---

## 10. Level-up popup — GameScene (or HUD)

On `player:level_up`: center text "LEVEL UP!", scale 0.5→1.2→1.0 bounce (300ms), hold `LEVELUP_POPUP_MS`, fade 200ms. Then the existing UpgradeOverlay opens (LevelSystem already pauses + launches overlay — ensure popup doesn't block input; popup is cosmetic, overlay still appears). Order: popup is non-blocking visual; overlay pause still triggers. If they conflict, popup can render inside UpgradeOverlay instead.

---

## 11. UpgradeOverlay polish — `scenes/UpgradeOverlay.ts`

Enhance existing (keep selection logic — DO NOT change item-apply behavior fixed in Phase 2):
- Semi-transparent bg already present.
- Title "SUBISTE A NIVEL X".
- Cards: rarity-colored border (already partial), name, `[CATEGORY]`, description, tags line.
- Hover scale 1.0→1.05; click scale 1.05→0.95 then select.
- **Synergy mark**: if card item's `synergyWith` intersects owned weapons/items, show a small "✦ sinergia" indicator.

---

## 12. MainMenuScene polish — `scenes/MainMenuScene.ts` (replace placeholder)

- Title "OFFICE SURVIVOR" big centered; subtitle "Sobrevive la jornada laboral".
- Buttons: **JUGAR**→GameScene; **MEJORAS**→UpgradeScene (enabled); **ESTADÍSTICAS**→StatisticsScene (enabled if ≥1 run, else disabled); **CONFIGURACIÓN** opens audio overlay (3 sliders music/sfx/ui → AudioManager.setVolume) — slider persistence is Phase 4, just wire to AudioManager now.
- Version "v0.1.0" bottom-right.
- If a previous run save exists: "Mejor run: X kills en MM:SS" (read via lightweight load helper; defaults if none).
- Button clicks → AudioManager `click`.

---

## 13. UpgradeScene — `scenes/UpgradeScene.ts` (replace "Próximamente")

Meta-progression **layout only, buttons disabled** (logic = Phase 4). Grid of cards from `META_UPGRADE_DISPLAY`: name, perLevel effect, cost, level `0/max`, disabled "COMPRAR" button. "VOLVER"→MainMenu.

---

## 14. StatisticsScene — `scenes/StatisticsScene.ts` (new, register in main.ts)

Reads a lightweight `SaveData` (localStorage key `office_survivor_save`; return zeroed defaults if absent — full SaveManager is Phase 4). Show: runs, total kills, total time (HH:MM:SS), bosses defeated, coins earned, best run (time+kills+level). "VOLVER"→MainMenu. Add `formatTimeHMS` helper to utils (don't touch `formatTime`).

---

## 15. main.ts

Register new scenes: `HUDScene`, `StatisticsScene`. Order: after VictoryScene. HUDScene must NOT auto-start (launched on demand).

---

## 16. Acceptance

- [ ] `npm run typecheck` + `build` clean. No `any`. No magic numbers outside config.
- [ ] HUD overlay: HP/stress/xp bars, coins, countdown timer, wave, weapon list, boss bar.
- [ ] Stress bar color changes by range; 90+ pulses. Burnout vignette at ≥90.
- [ ] Floating damage numbers: white normal, yellow crit, red player.
- [ ] Enemy white-flash on hit; death scale+fade; CEO death sequence (freeze→shake→grow-fade→victory).
- [ ] Screen shake on player hit / elite kill / boss hit / boss dead. **HUD does not shake.**
- [ ] "LEVEL UP!" popup before/with upgrade screen.
- [ ] Particles on deaths + pickups.
- [ ] UpgradeOverlay: rarity borders, hover/click anim, synergy mark.
- [ ] MainMenu polished + config audio sliders → AudioManager.
- [ ] UpgradeScene meta layout (disabled). StatisticsScene reads save.
- [ ] AudioManager beeps on all hooked events. No external assets.
- [ ] **No gameplay regressions** vs Phase 2 (run still completable, items still work).

## 17. Output
1. Summary. 2. Files created/modified. 3. Any gameplay behavior you had to touch (should be near-zero; the only allowed gameplay-adjacent change is exposing crit/boss-hp for HUD/numbers — list it). 4. Risks. 5. typecheck/build status. 6. What Phase 4 does. DO NOT start Phase 4.
