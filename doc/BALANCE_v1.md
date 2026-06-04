# BALANCE v1 — Conservative First Cut (Phase 4)

> Conservative pass. No overhaul. Each change is small and justified.
> User iterates from real playtest data; this is the starting point.

## Context

- Runs now open with a **weapons-only starting choice**, and grant an **upgrade after every wave**.
  Players get stronger faster than in the original design, so a few compensating adjustments are made.
- Target metrics (from Game Bible): run 8–12 min, max level 10–14, burnout ~40% of runs,
  no dominant weapon, first meta upgrade in 2–3 runs.

---

## Changed Values

| Param | Old | New | Reason |
|---|---|---|---|
| `PLAYER.BASE_HP` | 100 | 120 | Early waves (wave 1–3) were too lethal with 8–10 stress/hit and only 100 HP. +20 HP provides a buffer without eliminating tension. |
| `STRESS.DAMAGE_PER_HIT` | 10 | 8 | With 120 HP and ~12 hits to burnout, the original 10/hit still made early waves feel punishing. -2 gives the player ~15 hits before burnout — more breathing room early. |
| `STRESS.KILL_NORMAL_DECREASE` | 2 | 3 | With per-wave upgrades players kill faster; stress reduction should keep pace. 3/kill nudges burnout rate to ~40% target (active killing reduces stress meaningfully). |
| `WAVES.ENEMIES_PER_WAVE_MULTIPLIER` | 3 | 2.5 | Wave scaling was cubic: wave 5 → 12 enemies, wave 8 → 18. With per-wave upgrades already boosting player power, the horde grew too fast relative to player scaling. 2.5 gives a more linear feel. |
| `PROGRESSION.XP_PER_LEVEL_MULTIPLIER` | 100 | 120 | Per-wave upgrades (1 per wave) are additive on top of XP-based levels. With 10 waves before boss, player was getting ~20+ upgrades — over-leveled before wave 5. Slower XP keeps total upgrade count sane (~12–16 per run). |
| `ECONOMY.ENEMY_COINS_MIN` | 1 | 2 | First meta upgrade costs 50 coins. With 1–3 coins/enemy and ~50 kills/run, players earned ~100 coins/run — on track but 2–3 runs was borderline 3–4. Raising floor to 2 reliably targets 2–3 runs for first meta upgrade. |
| `ECONOMY.ENEMY_COINS_MAX` | 3 | 4 | Raises variance ceiling; doesn't change average much but makes good runs feel more rewarding. |

## Unchanged (intentionally)

- `STRESS.KILL_ELITE_DECREASE` (8) — elite kills already give good stress relief.
- Enemy `hp/damage/speed` — no playtest data; leave enemy config untouched.
- Weapon `baseDamage/fireRate` — no dominant weapon identified; don't touch.
- `STRESS.PASSIVE_INCREASE_AMOUNT` / `PASSIVE_INCREASE_INTERVAL_S` — passive stress is background pressure; leave as is.
- `BOSS.*` — boss tuning requires playtest data on how long players reach wave 10.

## Notes

All changes are inline-commented in `src/config/game.config.ts` with `// era X — reason (balance v1)`.
