# IMPLEMENTATION — FASE 2 FIXES (Remove `// SIMPLIFIED:` — full fidelity)

> Follow-up to `IMPL_fase2.md`. Goal: implement the 12 `// SIMPLIFIED:` items at full fidelity,
> matching the Game Bible exactly. Remove every `// SIMPLIFIED:` comment once its item behaves correctly.
> Inspect current code first. Do NOT regress working behavior. Zero magic numbers outside config.
> `npm run typecheck` + `npm run build` must pass at the end.

The 5 v0.2 filler items (`moneda_olvidada`, `cafe_con_leche`, `taza_rota`, `reloj_roto`, `auriculares_nc`)
are now canonical (added to Game Bible). KEEP them. Do not touch unless a fix below names them.

---

## A. New architecture pieces required

These unblock several fixes. Build them first.

### A1. Per-weapon modifiers on `WeaponInstance`
Extend `WeaponInstance` (WeaponSystem.ts):
```ts
export interface WeaponInstance {
  definitionId: string;
  level: number;
  lastFiredAt: number;
  damageMult: number;     // per-weapon multiplicative bonus (default 1)
  fireRateMult: number;   // per-weapon firerate bonus (default 1)
}
```
Default both to 1 on push. Apply in `update()` cooldown calc (`fireRate × fireRateMult`) and in `getDamage` (`× inst.damageMult`).

Add `WeaponSystem.recomputeWeaponMods()` called after every item acquisition AND after `addOrLevel`:
- reset every instance `damageMult=1, fireRateMult=1`
- if owns `grapas_extra` and weapon is `stapler_gun` → `fireRateMult *= 1.30` (Game Bible: +30% cadencia Stapler Gun)
- if owns `pivot` and player.level ≥ 10 → every weapon `damageMult *= 1.5; fireRateMult *= 1.5` (see C-Pivot)
- if owns `benchmark` → top-damage weapon `damageMult *= 1.4` (see C-Benchmark)

### A2. Per-weapon damage attribution (for `benchmark`)
Add `damageByWeapon: Record<string, number>` to `RunContext` (init `{}`). In `getDamage`, after computing `dmg`, also `ctx.damageByWeapon[def.id] = (ctx.damageByWeapon[def.id] ?? 0) + dmg`. (The existing `damage:dealt` emit stays.)
`topDamageWeaponId()`: returns the equipped weapon id with the highest `damageByWeapon` value (fallback: first equipped weapon, so benchmark works even if picked early).

### A3. PickupSystem — map consumables (`systems/PickupSystem.ts`)
The Game Bible says consumables spawn ON THE MAP (Café -15 estrés / 45s, Galleta +20 HP / 60s, Moneda +5 / 30s). This was missing. Implement a minimal pooled pickup spawner — needed for `cafeteria_vip`, `reunion_cancelada`, and general fidelity.

- New entity `entities/Pickup.ts`: pooled arcade circle (`ENTITY_SIZES.PICKUP`). Fields: `kind: 'cafe'|'galleta'|'moneda'|'stress'`, color from `COLORS_GAME`. `spawn(x,y,kind)`.
- `PickupSystem`: pool (size ~30). Timed spawners using intervals from config:
  ```ts
  export const PICKUPS = {
    CAFE_INTERVAL_S: 45, CAFE_STRESS: 15,
    GALLETA_INTERVAL_S: 60, GALLETA_HP: 20,
    MONEDA_INTERVAL_S: 30, MONEDA_COINS: 5,
    POOL_SIZE: 30,
    CAFE_VIP_BONUS_HP: 10,           // cafeteria_vip: café cura +10 HP
    STRESS_PICKUP_DECREASE: 10,      // reunion_cancelada drop
  } as const;
  ```
- Spawn pickups at random in-bounds positions (inside viewport, away from edges).
- `physics.overlap(player.body, pickupPool)` → apply effect, deactivate:
  - cafe → stress −`CAFE_STRESS`; if owns `cafe_solo` synergy n/a; if owns `cafeteria_vip` → also hp +`CAFE_VIP_BONUS_HP`.
  - galleta → hp +`GALLETA_HP` (clamp maxHp).
  - moneda → coins +`MONEDA_COINS × modifiers.coinMult`.
  - stress (from reunion_cancelada) → stress −`STRESS_PICKUP_DECREASE`.
  - emit `pickup:collected`.
- `cafeteria_vip` owned → café spawn interval halved (double frequency).
- Register/instantiate PickupSystem in GameScene; call its `update(delta)`.

Wire `reunion_cancelada` (ItemReactions): on `enemy:killed`, 15% → `pickupSystem.spawnStressPickup(x,y)`.

---

## B. Item fixes — one by one (remove `// SIMPLIFIED:` when done)

### B1. `excel_sheet` — show exact enemy HP
Enemy entity: add a small `Phaser.GameObjects.Text` HP label above the body, **only created/updated when `ctx.player.items.includes('excel_sheet')`**. Show integer `hp`. Hide/destroy on deactivate. Keep cheap (update text only when hp changes). This is item-driven info, not Phase-3 HUD polish — in scope.

### B2. `grapas_extra` — +30% Stapler Gun cadence
Handled by A1 `recomputeWeaponMods`. Remove the per-fire ad-hoc note. Verify cooldown uses `fireRateMult`.

### B3. `badge` — enemies detect 0.5s late
Enemy: add `detectionDelayMs` (default 0). On spawn, if `ctx.player.items.includes('badge')` set `detectionDelayMs = 500`. In Enemy AI update: while `detectionDelayMs > 0`, decrement by delta and do NOT move toward player (idle/drift). Add config `SPAWN.BADGE_DETECTION_DELAY_MS = 500`.

### B4. `ergonomia` — stress rises 20% slower
StressSystem: when adding stress (passive AND on-hit), multiply the increment by `0.8` if `ctx.player.items.includes('ergonomia')`. Combine multiplicatively with `auriculares_nc` (15% slower → ×0.85) if both owned. Add config `STRESS.ERGONOMIA_MULT = 0.8` and reuse for auriculares_nc `0.85` (`STRESS.AURIC_NC_MULT`). Keep the +30 maxHp onPickup.

### B5. `backup_plan` — clone elite drop
Reinterpret faithfully: on elite `enemy:killed`, 25% chance to immediately grant the player a random ELIGIBLE pool item (as if selected from upgrade), then `recomputeModifiers` + `recomputeWeaponMods`. Use `UpgradePool` to pick 1 eligible item (respect rarity gates/caps/maxStack). Wire in ItemReactions. Remove the coin hack. Config `ECONOMY.BACKUP_PLAN_CHANCE = 0.25`.

### B6. `cafeteria_vip` — double café + heal
Now real via A3 PickupSystem: café spawn interval halved when owned; café heals +`CAFE_VIP_BONUS_HP`. Remove SIMPLIFIED note.

### B7. `benchmark` — top weapon +40% permanent
Via A1+A2: on pickup, mark intent; `recomputeWeaponMods` applies `damageMult *= 1.4` to `topDamageWeaponId()`. Because it's "permanente", snapshot the chosen weapon id once at pickup into `ctx.benchmarkWeaponId` and always boost THAT weapon (don't re-pick each frame). Remove the global `onPickup ×1.40`.

### B8. `debug_mode` — already wired, verify
Keep: `debug_laser` damage always crit when owned. Ensure it stacks with the real beam (B9). No SIMPLIFIED note remains.

### B9. `debug_laser` — true continuous beam
Replace the rapid-projectile hack. In WeaponSystem, special-case `debug_laser`:
- On its fire tick (10/s), instead of projectiles, draw a beam line from player to the aim direction up to `range`, and apply damage via overlap along the beam to all enemies it crosses (or nearest-in-line). Use a thin rectangle/line `Phaser.Geom.Line` + `enemySys.damageInLine(x1,y1,x2,y2,width,dmg,sourceId)` (add this helper to EnemySystem: iterate active enemies, hit those within `width/2` of the line segment).
- Beam visual: a thin cyan rectangle drawn for ~60ms each tick (placeholder, not Phase-3 polish — it's the weapon's actual hit shape).
- `debug_mode` owned → beam damage ×`CRIT_MULTIPLIER` (always crit). `vpn_corporativa` pierce is implicit (beam hits all in line).
Config `COMBAT.LASER_WIDTH = 12`, `COMBAT.LASER_FLASH_MS = 60`.

### B10. `pivot` — per-weapon +50% at level 10
Via A1: when `pivot` owned and `player.level` reaches 10, `recomputeWeaponMods` gives every weapon `damageMult *= 1.5, fireRateMult *= 1.5`. Trigger a `recomputeWeaponMods()` on `player:level_up` so it activates exactly at level 10. Remove the global-mult SIMPLIFIED note. (Per-weapon stat replacement is now realized as per-weapon multipliers — acceptable, matches "+50% stats".)

### B11. `ipo` — true infinite mode
On `boss:defeated`: if `ipo` owned, do NOT go to Victory. Instead enter infinite mode:
- keep run alive, set `ctx.infinite = true`.
- SpawnDirector continues waves past 10 (loop enemy unlock at max set; CEO does not respawn unless you choose to — keep spawning normal+elite enemies).
- every 5 min of infinite time, scale enemy hp/damage ×1.25 cumulatively (`ctx.difficultyMult`). Apply in `EnemySystem.spawn` (`def.hp × difficultyMult`, `def.damage × difficultyMult`).
- Provide a way to end the run (player death → GameOver with `bossDefeated=true`).
Config `BOSS.IPO_SCALE_INTERVAL_S = 300`, `BOSS.IPO_SCALE_STEP = 0.25`.
Remove the SIMPLIFIED note. (Non-IPO boss kill still → Victory.)

### B12. `impresora_aliada` — proper pooled turret entity
Replace the inline `scene.add.rectangle` turret with a real entity `entities/PrinterTurret.ts` (or a small pooled group). Requirements:
- proper lifecycle (spawn/deactivate), follows player at 80px, fires pooled projectiles at nearest enemy at the weapon's fireRate.
- one active turret per copy of the weapon (level 1–3 → up to 3 turrets, or scale fire rate — choose turrets = level, document choice in a normal comment).
- use the projectile pool (already does). Remove SIMPLIFIED note.

### B13. `ceo_memo` — verify enemy −20% HP / CEO +50% HP
Confirm: enemy spawn hp ×0.8 when owned (EnemySystem.spawn), CEO hp ×1.5 (CEOBoss). If only partially wired, finish it. Add config `BOSS.CEO_MEMO_ENEMY_HP_MULT = 0.8`, `BOSS.CEO_MEMO_BOSS_HP_MULT = 1.5`. Remove any SIMPLIFIED note.

---

## C. Cross-cutting wiring

- Call `weaponSystem.recomputeWeaponMods()` AND `recomputeModifiers(ctx)` after every item pickup (UpgradeOverlay selection + backup_plan grant).
- Call `recomputeWeaponMods()` on `player:level_up` (for pivot at L10).
- Instantiate PickupSystem in GameScene; update it each frame; pass player ref for overlap.
- Ensure `ctx` new fields (`damageByWeapon`, `benchmarkWeaponId?`, `infinite`, `difficultyMult`) are initialized in RunContext factory and reset per run.

---

## D. Acceptance

- [ ] Zero `// SIMPLIFIED:` comments remain in `src/`.
- [ ] grapas_extra measurably speeds up only Stapler Gun; benchmark boosts only the top weapon; pivot boosts all weapons at L10.
- [ ] debug_laser is a continuous beam hitting all enemies in line; debug_mode makes it always crit.
- [ ] badge delays enemy chase 0.5s after spawn.
- [ ] ergonomia + auriculares_nc slow stress accrual (verify increments).
- [ ] Map pickups (café/galleta/moneda) spawn and apply effects; cafeteria_vip doubles café + heals; reunion_cancelada drops stress pickups.
- [ ] backup_plan grants a real bonus item on elite kill (25%).
- [ ] excel_sheet shows exact enemy HP text.
- [ ] impresora_aliada is a proper turret entity using the projectile pool.
- [ ] ipo → infinite mode with +25%/5min scaling; non-IPO boss kill still → Victory.
- [ ] ceo_memo: enemies −20% HP, CEO +50% HP.
- [ ] `npm run typecheck` exit 0; `npm run build` succeeds. No `any`. No magic numbers outside config.

## E. Output
1. Summary. 2. Files changed. 3. Per-item confirmation (12 items + the 5 kept). 4. Any remaining compromise (must be ZERO SIMPLIFIED — if truly impossible, justify explicitly). 5. typecheck/build status. 6. Risks.
