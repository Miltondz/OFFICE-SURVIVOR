# IMPLEMENTATION — FASE 2 (Gameplay Core)

> Refined build spec derived from `02_fase2_gameplay.md` + `00_game_bible.md`.
> Builds on completed Phase 1. Goal: a full playable run, start to finish, placeholders only.
> Implementer: follow the priority order in §3. Read the Game Bible for ALL raw numeric values
> (weapons, enemies, items). Do not invent values. Zero magic numbers outside config.

---

## 0. Pre-flight

- Phase 1 is done. Inspect existing `src/` before editing. Do NOT rewrite working files except where this doc says "REPLACE".
- Files you will REPLACE: `src/scenes/GameScene.ts`, `src/scenes/GameOverScene.ts`, `src/config/items.config.ts`, `src/config/enemies.config.ts`, `src/types/index.ts` (extend, don't delete existing exports).
- New constants go in `game.config.ts`. No gameplay number literals in systems/scenes.
- No `any`. Strict TS. `npm run typecheck` and `npm run build` must pass at the end.
- Placeholders only: rectangles/circles/text. No sprites, no audio (audio is Phase 3).

---

## 1. Architecture overview

Single live `GameScene` owns the run. It instantiates systems and a `RunContext` shared object. Communication between systems uses the **EventBus singleton** — never direct cross-system references for reactive logic.

```
GameScene (orchestrator, owns update loop)
 ├─ RunContext            // mutable run state: PlayerState + RunModifiers + RunStats + timers
 ├─ EventBus (singleton)  // 'enemy:killed', 'player:hit', etc.
 ├─ Player                // green rect + physics body, movement, HP, i-frames, stress
 ├─ StressSystem          // stress value → StressState → multipliers + burnout drain
 ├─ WeaponSystem          // owns equipped WeaponInstance[], auto-fires nearest enemy, projectile pool
 ├─ EnemySystem           // enemy pool, AI per type, contact damage, death → xp/coins/stress
 ├─ SpawnDirector         // wave timing, enemy-type unlock table, edge spawning, boss trigger
 ├─ LevelSystem           // xp accumulation, level-up → pause + UpgradeOverlay
 ├─ UpgradePool           // weighted 3-option picker
 └─ CEOBoss               // spawned at wave 10, 2-phase state machine
```

**Data flow per frame:** GameScene.update(delta) → Player.update → WeaponSystem.update (fire) → EnemySystem.update (AI + collisions) → StressSystem.update (passive + drain) → HUD text refresh.

**Modifier resolution:** items mutate either (a) `PlayerState` directly via `onPickup` (one-shot stat items), or (b) `RunModifiers` via `recomputeModifiers()` (continuous combat modifiers read by WeaponSystem), or (c) subscribe to EventBus (reactive items). Final per-shot damage = `weapon.baseDamage × weaponLevelMult × playerState.damageMultiplier × stressMult × modifiers.damageMult × (crit?2:1)`.

---

## 2. game.config.ts — constants to ADD

Append these blocks (keep existing). Pull any value the Game Bible specifies; below are the new ones Phase 2 needs:

```ts
export const COMBAT = {
  PROJECTILE_POOL_SIZE: 200,
  ENEMY_POOL_SIZE: 300,
  PROJECTILE_DEFAULT_SPEED: 360,   // px/s for standard bullets
  PROJECTILE_LIFESPAN_MS: 2000,
  CRIT_CHANCE: 0.20,               // base; Phase 3 shows numbers, logic lives here
  CRIT_MULTIPLIER: 2,
  CONTACT_DAMAGE_COOLDOWN_MS: 500, // enemy can damage player at most this often
  MAX_WEAPONS_BASE: 4,
  MAX_WEAPONS_WITH_MONITOR: 5,
  WEAPON_MAX_LEVEL: 3,
  WEAPON_LEVEL_DAMAGE_STEP: 0.15,  // +15% per copy
  WEAPON_LEVEL_FIRERATE_STEP: 0.10,// +10% per copy
} as const;

export const SPAWN = {
  EDGE_MARGIN: 40,                 // spawn this far outside viewport
  AUDITOR_INVINCIBLE_MS: 3000,
  TOXIC_ZONE_DURATION_MS: 3000,
  TOXIC_ZONE_DPS: 5,
  HR_AURA_RADIUS: 120,
  HR_AURA_SLOW: 0.30,
  PRINTER_FAN_INTERVAL_MS: 3000,
  PRINTER_FAN_COUNT: 5,
  PRINTER_FAN_SPREAD_DEG: 72,
} as const;

export const BOSS = {
  HP: 2000,
  PHASE2_HP_THRESHOLD: 1000,
  SIZE: 64,
  MEMO_INTERVAL_MS: 2000,
  MEETING_SUMMON_COUNT: 4,
  CHARGE_WINDUP_MS: 1000,
  PHASE2_COOLDOWN_MULT: 0.8,       // 20% more frequent
  RESTRUCTURING_LINES: 3,
} as const;

export const WAVE_UNLOCKS = {
  // enemy types available by wave number (inclusive ranges handled in code)
  // 1-2: angry_email; 3-4: +toxic_manager, angry_client;
  // 5-6: +hr_rep, possessed_printer; 7-9: +auditor; 10: ceo
} as const;

export const RARITY_WEIGHTS: Record<import('@/types').Rarity, number> = {
  common: 60, rare: 28, epic: 10, legendary: 2,
};

export const RARITY_RULES = {
  EPIC_MIN_LEVEL: 3,
  LEGENDARY_MIN_LEVEL: 6,
  EPIC_MAX_PER_RUN: 4,
  LEGENDARY_MAX_PER_RUN: 1,
} as const;

export const ENTITY_SIZES = {
  ENEMY: 24,
  ELITE: 32,
  PROJECTILE: 8,
  PICKUP: 14,
} as const;

export const COLORS_GAME = {
  ENEMY: 0xcc4444,
  ELITE: 0xaa33aa,
  AUDITOR: 0xeeee44,
  BOSS: 0xff2222,
  PROJECTILE: 0xffffff,
  TOXIC_ZONE: 0x66aa33,
  COFFEE: 0x6f4e37,
  COIN: 0xffd700,
  XP: 0x3399ff,
} as const;
```

If any value here duplicates an existing Bible number already in config (stress, waves, economy), reuse the existing one — do not redefine.

---

## 3. Implementation priority (build + verify in this order)

1. Type extensions + EventBus + RunContext/RunModifiers
2. Player (movement, HP, i-frames)
3. StressSystem (states, multipliers, burnout drain)
4. Projectile pool + WeaponSystem with ONE weapon (Coffee Thrower)
5. Enemy base + EnemySystem with ONE enemy (Angry Email), contact damage
6. SpawnDirector (waves)
7. Remaining 5 enemies + behaviors
8. Remaining 9 weapons + behaviors
9. LevelSystem + UpgradeOverlay (functional, unpolished)
10. Populate `items.config.ts` (42 items) + `enemies.config.ts` (6) + WEAPONS (10)
11. UpgradePool weighted picker
12. CEOBoss (2 phases)
13. GameOver (real stats) + VictoryScene
14. Full run verification

Verify typecheck after each major step.

---

## 4. types/index.ts — EXTEND

Keep all existing exports. Add:

```ts
export type GameEventName =
  | 'player:hit' | 'player:died' | 'player:level_up' | 'player:burnout'
  | 'enemy:spawned' | 'enemy:killed' | 'enemy:hit'
  | 'stress:changed' | 'wave:start' | 'wave:complete'
  | 'pickup:collected' | 'boss:spawned' | 'boss:phase2' | 'boss:defeated'
  | 'damage:dealt';

export interface EnemyKilledPayload { type: EnemyType; isElite: boolean; x: number; y: number; }
export interface DamageDealtPayload { sourceId: string; amount: number; }

// Continuous combat modifiers aggregated from owned items.
export interface RunModifiers {
  damageMult: number;        // multiplicative item damage bonus (NOT stress, NOT weapon level)
  damageTakenMult: number;   // <1 reduces incoming damage
  projectileBonus: number;   // +N projectiles to all weapons
  projectileSpeedMult: number;
  rangeMult: number;
  pierce: boolean;           // projectiles pass through enemies
  bounce: number;            // extra bounces (fotocopiadora = 1)
  maxWeapons: number;        // 4 base, 5 with Doble Monitor
  xpMult: number;
  coinMult: number;
}

export function defaultRunModifiers(): RunModifiers {
  return {
    damageMult: 1, damageTakenMult: 1, projectileBonus: 0,
    projectileSpeedMult: 1, rangeMult: 1, pierce: false, bounce: 0,
    maxWeapons: 4, xpMult: 1, coinMult: 1,
  };
}

// Extend ItemDefinition with optional declarative effect + modifier hook.
// (Add these OPTIONAL fields to the existing ItemDefinition interface — do not remove callbacks.)
//   applyModifiers?: (m: RunModifiers, player: PlayerState) => void;  // continuous combat mods
//   maxStack?: number;  // already present
```

Add the two optional fields to `ItemDefinition`:
```ts
  applyModifiers?: (m: RunModifiers, player: PlayerState) => void;
```

---

## 5. systems/EventBus.ts

```ts
import Phaser from 'phaser';

export class EventBus extends Phaser.Events.EventEmitter {
  private static instance: EventBus;
  static getInstance(): EventBus {
    if (!EventBus.instance) EventBus.instance = new EventBus();
    return EventBus.instance;
  }
  static reset(): void { EventBus.instance?.removeAllListeners(); }
}
```

Call `EventBus.reset()` in `GameScene.create()` start, so re-runs don't stack listeners.

---

## 6. RunContext

`systems/RunContext.ts` — plain object holder created per run, passed to systems:

```ts
export interface RunContext {
  player: PlayerState;
  modifiers: RunModifiers;
  stats: RunStats;
  elapsedS: number;
  wave: number;
  bus: EventBus;
}
```

`recomputeModifiers(ctx)`: reset to `defaultRunModifiers()`, then for each owned item id with `applyModifiers`, call it. Run after every item acquisition. Doble Monitor sets `maxWeapons = MAX_WEAPONS_WITH_MONITOR`.

---

## 7. Player — `entities/Player.ts`

- Extends `Phaser.Physics.Arcade.Image` or a container wrapping a `Rectangle` + arcade body. Simplest: use `this.physics.add.existing` on a Rectangle. Use a 32×32 green rect (reuse `COLORS.PLAYER`).
- Movement: WASD + arrows, normalized diagonal, `speed = playerState.speed × stressSpeedMult`.
- HP bar: thin red rect above player, width ∝ hp/maxHp.
- `takeDamage(amount)`: if within i-frames (`PLAYER.INVINCIBILITY_FRAMES_MS`) ignore. Else apply `amount × modifiers.damageTakenMult`, start i-frames (flash alpha), emit `player:hit`, stress +`STRESS.DAMAGE_PER_HIT`. If hp ≤ 0 emit `player:died`.
- Faces nearest enemy (rotation cosmetic only; movement is WASD).

---

## 8. StressSystem — `systems/StressSystem.ts`

Implement EXACTLY per Bible/Phase 2 pseudocode.

- `getState(stress): StressState` using `STRESS.THRESHOLDS`.
- `getModifiers(state)`: the table — relaxed{dmg .9,spd 1,drain 0}, tense{1,1,0}, limit{1.2,1.1,0}, burnout{1.4,1.25,drain}, collapse{1,1,0}.
- `update(delta)`: passive +`PASSIVE_INCREASE_AMOUNT` every `PASSIVE_INCREASE_INTERVAL_S` **only if no kill in that interval** (track lastKillTime). In burnout, drain `BURNOUT_HP_DRAIN_PER_S × dtS` from hp.
- On `enemy:killed`: stress -= elite?`KILL_ELITE_DECREASE`:`KILL_NORMAL_DECREASE`, clamp ≥0, reset passive timer.
- On `player:hit`: stress += `DAMAGE_PER_HIT` (clamp ≤ MAX). If reaches MAX → emit `player:died` (colapso = game over).
- Emit `stress:changed` on change; emit `player:burnout` when crossing into burnout.
- Expose `damageMult` and `speedMult` getters for WeaponSystem/Player.

---

## 9. Projectiles + WeaponSystem

### Projectile — `entities/Projectile.ts`
Arcade-physics rect (8px, white). Pooled. Fields: `damage`, `sourceId`, `pierceLeft`, `bounceLeft`, plus optional effect tag (`slow`/`stun`/`zoneOnHit`). `fire(x,y,vx,vy,cfg)` activates body+visibility. `deactivate()` hides + disables. Lifespan via `PROJECTILE_LIFESPAN_MS`.

### Pool
```ts
this.projectiles = this.physics.add.group({ classType: Projectile, maxSize: COMBAT.PROJECTILE_POOL_SIZE, runChildUpdate: true });
```
Never `new` per shot — always `group.get()`.

### WeaponSystem — `systems/WeaponSystem.ts`
- Holds `WeaponInstance[] { definitionId, level, lastFiredAt }`.
- `addOrLevel(id)`: if owned and level<`WEAPON_MAX_LEVEL` → level++. Else if `weapons.length < modifiers.maxWeapons` → push level 1.
- `update(time)`: for each weapon, if `time - lastFiredAt ≥ cooldown` and a target exists within range → fire. `cooldown = 1000 / (fireRate × (1 + (level-1)×WEAPON_LEVEL_FIRERATE_STEP))`.
- `getDamage(weapon)` = `baseDamage × (1+(level-1)×WEAPON_LEVEL_DAMAGE_STEP) × player.damageMultiplier × stress.damageMult × modifiers.damageMult`, then crit roll (`CRIT_CHANCE`→×`CRIT_MULTIPLIER`). Emit `damage:dealt` on hit (for Phase 5 build report; harmless now).
- Nearest-enemy targeting via EnemySystem query.
- Projectile count = `def.projectileCount + modifiers.projectileBonus`. Multi-projectile spread for arc/disperse weapons.

### 10 weapons — values from Bible weapon table. Special behaviors:
- **Coffee Thrower**: on hit apply slow (enemy speed ×0.5, 1s).
- **Stapler Gun**: straight, fast.
- **Debug Laser**: continuous beam — use a line + `physics.overlap` along range each tick, not a projectile. 5 dmg/tick at 10/s.
- **Post-it Launcher**: 3 projectiles at −15°/0°/+15°.
- **PowerPoint Cannon**: slow projectile (speed 120), stun 1.5s on hit.
- **Whiteboard Marker**: short projectile + spawn ground damage zone (3s) at impact.
- **Teclado Mecánico**: short range, knockback on hit.
- **Botella Térmica**: projectile, AoE radius 60 on impact.
- **Extintor**: frontal cone (sector overlap), freeze 2s, 5s recharge.
- **Impresora Aliada**: summon autonomous turret entity following player at 80px, fires nearest.

Faithful-but-simple is acceptable for exotic behaviors; values must match Bible.

---

## 10. Enemies

### Enemy — `entities/Enemy.ts`
Pooled arcade rect. `spawn(def, x, y)` sets hp/speed/damage/color/size (elite bigger, auditor yellow). `update`: move toward player (`scene.physics.moveToObject`-style, but manual using player pos). White-flash hook stub (Phase 3 polishes). `takeDamage(amount, sourceId)`: subtract hp, emit `enemy:hit`; if hp≤0 → die().
`die()`: emit `enemy:killed` {type,isElite,x,y}, drop xp+coins, run special on-death (toxic zone), deactivate. Disable physics before any tween.

### EnemySystem — `systems/EnemySystem.ts`
- Pool `maxSize: COMBAT.ENEMY_POOL_SIZE`, `runChildUpdate: true`.
- `spawn(typeId, x, y)` from `getEnemyById`.
- Collisions: `physics.overlap(projectiles, enemies, …)` → enemy.takeDamage, projectile handle pierce/bounce/deactivate. `physics.overlap(player, enemies, …)` → player.takeDamage with `CONTACT_DAMAGE_COOLDOWN_MS` per-enemy gate.
- `getNearestEnemy(x,y, maxRange)` for targeting.
- Off-screen (>600px from player) → skip AI update (perf).

### 6 enemies — values from Bible. Behaviors:
- **Angry Email**: straight chase.
- **Toxic Manager** (elite): on death spawn toxic zone (`TOXIC_ZONE_*`).
- **Angry Client**: fast chase (scream = visual stub, skip stun for now or brief slow).
- **HR Representative** (elite): aura radius `HR_AURA_RADIUS` slows player `HR_AURA_SLOW` while alive.
- **Possessed Printer** (elite): every `PRINTER_FAN_INTERVAL_MS` fire `PRINTER_FAN_COUNT` projectiles in fan `PRINTER_FAN_SPREAD_DEG` apart (enemy projectiles damage player).
- **Auditor** (elite): `invincible=true` first `AUDITOR_INVINCIBLE_MS`, ignores damage; high damage.

### enemies.config.ts — populate (verbatim from Phase 2 doc §enemies.config):
```ts
export const ENEMIES: EnemyDefinition[] = [
  def({ id: 'angry_email',       name: 'Angry Email',       hp: 20,  speed: 80, damage: 5,  isElite: false }),
  def({ id: 'toxic_manager',     name: 'Toxic Manager',     hp: 60,  speed: 50, damage: 12, isElite: true  }),
  def({ id: 'angry_client',      name: 'Angry Client',      hp: 40,  speed: 90, damage: 8,  isElite: false }),
  def({ id: 'hr_rep',            name: 'HR Representative', hp: 35,  speed: 60, damage: 10, isElite: true  }),
  def({ id: 'possessed_printer', name: 'Possessed Printer', hp: 120, speed: 30, damage: 15, isElite: true  }),
  def({ id: 'auditor',           name: 'Auditor',           hp: 80,  speed: 40, damage: 20, isElite: true  }),
];
```

---

## 11. SpawnDirector — `systems/SpawnDirector.ts`

- Wave N every `WAVES.INTERVAL_S`. Count = `N × WAVES.ENEMIES_PER_WAVE_MULTIPLIER + WAVES.BASE_ENEMIES`.
- Unlock table (Bible): 1–2 email; 3–4 +toxic_manager,angry_client; 5–6 +hr_rep,possessed_printer; 7–9 +auditor; wave 10 → spawn CEO only.
- Spawn at edges: pick random point `SPAWN.EDGE_MARGIN` outside viewport bounds, distribute around perimeter. Never spawn at center.
- Emit `wave:start` / `wave:complete`. On wave 10 emit `boss:spawned`.

---

## 12. LevelSystem + UpgradeOverlay

- `xpToNext(level) = level × PROGRESSION.XP_PER_LEVEL_MULTIPLIER`. `xpFromKill(hp) = round(hp / XP_PER_HP_DIVISOR)`.
- On `enemy:killed`: add xp (× `modifiers.xpMult`). While xp ≥ threshold: level++, emit `player:level_up`, carry remainder.
- On level up: pause GameScene physics + spawn **UpgradeOverlay** (a launched overlay scene OR an in-scene container; simplest = `SceneManager.overlay` to a small `UpgradeOverlay` scene). Show `PROGRESSION.UPGRADE_OPTIONS` (or 5 with Inbox Zero) item cards: name, rarity color, description. Click → apply item, `recomputeModifiers`, resume.

Register `UpgradeOverlay` scene in `main.ts` scene list.

---

## 13. items.config.ts — populate all 42 + 10 weapons

Source of truth = Game Bible catalog (commons/rares/epics/legendaries + weapon table). For EACH item set `id,name,description,rarity,category,tags,synergyWith?,maxStack?`. Implement effect via the correct mechanism:

- **One-shot stat** (damage %, hp, speed, maxHp) → `onPickup` returns new PlayerState. Ex: Auriculares `onPickup: p => ({...p, speed: p.speed*1.15})` and `applyModifiers: m => { m.damageTakenMult *= 0.95 }`.
- **Continuous combat mod** (extra projectile, pierce, bounce, range, proj speed, max weapons, xp/coin mult) → `applyModifiers`. Ex: Stack de Post-its `applyModifiers: m => { m.projectileBonus += 1 }`; VPN `applyModifiers: m => { m.pierce = true; m.damageMult *= 0.85 }`; Fotocopiadora `m.bounce += 1`; Doble Monitor `m.maxWeapons = COMBAT.MAX_WEAPONS_WITH_MONITOR; m.damageMult *= 1.25`.
- **Reactive** (on kill, on burnout, racha, etc.) → subscribe in an `installItemReactions(ctx)` registry keyed by item id, wired through EventBus when acquired. Ex: Reunión Cancelada → on `enemy:killed`, 15% spawn stress pickup; Carta de Renuncia → on `enemy:killed` while burnout, hp +=2.
- **Weapon-specific** (termo, grapas_extra, debug_mode, powerpoint_feo) → flag read by that weapon's fire logic; gate on owning the weapon.
- **maxStack**: epic ≤ `RARITY_RULES.EPIC_MAX_PER_RUN` handled by pool, but per-item `maxStack: 1` for legendaries and uniques.

Fidelity priority: stat/projectile/economy items EXACT. Highly exotic legendaries (Pivot, IPO) may be functional-but-simplified — document any simplification in a `// SIMPLIFIED:` comment.

WEAPONS array: all 10 with Bible values (baseDamage, fireRate, range, projectileCount, rarity, tags).

---

## 14. UpgradePool — `systems/UpgradePool.ts`

Implement Bible weighting:
```
weight = RARITY_WEIGHTS[rarity]
if item.synergyWith includes an equipped weapon → ×3
if item shares a tag with player's build tags → ×1.5
exclude owned non-weapon items (weapons stay until max level)
exclude items above rarity gate (epic<L3, legendary<L6) and over per-run rarity caps
```
`pick(count)`: weighted random without replacement; guarantee ≥1 option of rarity ≥ player's current highest owned rarity. Weapons appear in pool like items (to level up).

---

## 15. CEOBoss — `entities/CEOBoss.ts`

- 64×64 red rect, HP `BOSS.HP`, HP bar above. Spawn center-top on wave 10.
- State machine `phase1`/`phase2`, switch at `PHASE2_HP_THRESHOLD`.
- Attacks (phase1): Memo (straight projectile every `MEMO_INTERVAL_MS`), Reunión (summon `MEETING_SUMMON_COUNT` angry_emails), Revisión (windup `CHARGE_WINDUP_MS` then dash at player).
- Phase2: all cooldowns ×`PHASE2_COOLDOWN_MULT`; new Restructuring (`RESTRUCTURING_LINES` projectile lines sweeping screen). Emit `boss:phase2` on entry.
- On death: emit `boss:defeated`, set `stats.bossDefeated = true`, drop `ECONOMY.BOSS_COINS`, → VictoryScene.

---

## 16. Scenes

### GameScene — REPLACE
Orchestrate everything: create RunContext, reset EventBus, instantiate all systems, wire collisions, run update loop, maintain a minimal in-scene HUD text (HP/Estrés/Nivel/Tiempo/Oleada — full HUD is Phase 3). Subscribe `player:died` → GameOver with real `RunStats`; `boss:defeated` → Victory. Keep the temp `G` key removed (real death now drives it) OR keep as debug behind `import.meta.env.DEV`.

### GameOverScene — REPLACE
Show real `RunStats` passed in (kills, timeSurvived via formatTime, coinsEarned, maxLevel, maxStress, bossDefeated). Buttons Reintentar→Game, Menú→MainMenu.

### VictoryScene — NEW (`scenes/VictoryScene.ts`)
"¡VICTORIA!" + run stats + buttons (Jugar de nuevo, Menú). Add `SCENES.VICTORY: 'VictoryScene'` to config and register in `main.ts`.

### UpgradeOverlay — NEW (`scenes/UpgradeOverlay.ts`)
Launched as overlay on level-up. Semi-transparent bg, N item cards (text + rarity-colored border rect), click selects. Resume GameScene on pick.

---

## 17. Acceptance (all must pass)

- [ ] `npm run typecheck` + `npm run build` clean. No `any`.
- [ ] Full run playable start→finish (menu→game→win/lose).
- [ ] Player WASD+arrows movement.
- [ ] Weapons auto-fire nearest enemy; all 10 implemented with special behaviors.
- [ ] All 6 enemies with differentiated behaviors.
- [ ] CEO 2 phases, 4 attacks total.
- [ ] Stress system: all states, multipliers, burnout HP drain (delta-based).
- [ ] Waves scale per formula; enemies spawn at edges, not center.
- [ ] XP/level system; weighted upgrade pool (synergy ×3, tag ×1.5).
- [ ] `items.config.ts` 42 items; `enemies.config.ts` 6; WEAPONS 10.
- [ ] Object pooling for projectiles AND enemies (no per-shot/per-spawn `new`).
- [ ] EventBus singleton drives reactive items.
- [ ] GameOver with real stats; Victory on CEO kill.
- [ ] Zero magic gameplay numbers outside config.

---

## 18. Output required on finish

1. Summary. 2. Files created/modified. 3. Any `// SIMPLIFIED:` items listed. 4. Risks. 5. typecheck/build status (actual). 6. What Phase 3 does. DO NOT start Phase 3.
