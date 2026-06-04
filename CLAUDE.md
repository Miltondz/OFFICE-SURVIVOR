# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Current state

**No code exists yet.** The repo contains only design docs under `doc/`. The game is built in four sequential phases, each fully specified before any code is written. Phase 1 (architecture/scaffolding) has not been started. Inspect `doc/` before creating anything.

## The docs are the source of truth

Read these before writing code. They are in Spanish; the game uses Spanish item/UI names but English code identifiers.

- `doc/00_game_bible.md` — **permanent context.** Stress system, all 10 weapons, 6 enemies, CEO boss, 42 items (common→legendary), economy, progression formulas. Include in every implementation task.
- `doc/01_fase1_arquitectura.md` — scaffolding: folder layout, `tsconfig`, `vite.config`, `game.config.ts` constants, `types/index.ts` interfaces, 6 placeholder scenes, `SceneManager`.
- `doc/02_fase2_gameplay.md` — full playable run with placeholder visuals. WeaponSystem, EnemySystem, EventBus, UpgradePool, waves, CEO.
- `doc/03_fase3_ux_ui_feel.md` — HUD, damage numbers, screen shake, audio, particles. No new mechanics.
- `doc/04_fase4_release.md` — SaveManager, meta-progression, balance, performance. No new mechanics.
- `doc/05_mejoras_adicionales.md` — optional expansions (characters, interactive map, wave events, curses, build report). Integrate into Game Bible before implementing.

**Phase discipline:** never implement content from a future phase. Each phase assumes all prior phases are complete. Do not auto-advance to the next phase — stop and report when a phase's checklist is done.

## Stack

Phaser 3 · TypeScript (`strict: true`) · Vite · Web target (desktop primary). Base resolution 960×540, letterboxed fullscreen. Node 18+.

## Commands

The toolchain does not exist until Phase 1 scaffolds it. Once `package.json` exists:

```
npm install      # deps
npm run dev      # Vite dev server on port 3000
npm run build    # production build
```

No test runner is specified in the design. Acceptance is checklist-driven (see each phase doc) plus manual playtesting. Verify a change by running `npm run dev` and confirming zero TypeScript errors.

## Non-negotiable conventions

These are stated repeatedly across phase docs and gate acceptance:

- **Config over code.** Every numeric value lives in `src/config/game.config.ts` (and the other config files). Zero magic numbers anywhere else. Document balance changes inline: `BASE_HP: 120, // era 100 — razón (balance v1)`.
- **No `any`.** TypeScript strict, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`. Path alias `@/*` → `./src/*`.
- **Inspect before creating.** Never rewrite a working system. Read existing files first.
- **Placeholders only** until art-replacement phase: rectangles, circles, text. No final art.
- **Object pooling is mandatory** for projectiles, enemies, floating damage numbers, particles. Use `Phaser.GameObjects.Group` with `createMultiple`/`get()` — never `new` per spawn (GC thrashing).

## Architecture (target, per Phase 1–2)

```
src/
  scenes/      Boot → Preload → MainMenu → Game (+ HUD overlay, Upgrade, GameOver)
  systems/     SceneManager, EventBus, WeaponSystem, EnemySystem, UpgradePool, SaveManager, AudioManager, ScreenShake
  config/      game.config.ts (constants), items.config.ts (ITEMS+WEAPONS), enemies.config.ts, meta.config.ts
  types/       index.ts — all global interfaces/types
  utils/
  main.ts      Phaser bootstrap
```

Key cross-cutting decisions:

- **EventBus is a singleton** (`EventBus.getInstance()`, extends `Phaser.Events.EventEmitter`). Reactive items (Burnout effects, kill triggers) subscribe to events rather than poll. HUD communicates with GameScene only via EventBus — no direct references.
- **Stress is the central mechanic** (0–100, 5 states: relaxed/tense/limit/burnout/collapse). State drives damage/speed multipliers and HP drain; modifiers applied in `update()` using `delta`. See Game Bible table.
- **`PlayerState` is passed immutably** — item callbacks (`onPickup`, `onKill`, `onHit`, `onLevelUp`) take a `PlayerState` and return a new one.
- **Scenes transition through `SceneManager`** (`go`/`overlay`/`closeOverlay`), not raw `scene.start`.
- **Weapons auto-fire** at the nearest enemy; player always faces nearest enemy. Max 4 weapons (5 with Doble Monitor). Duplicate weapon copy = level up (max level 3).
- **Upgrade pool is weighted**, not pure random: synergy-with-equipped-weapon ×3, shared-tag ×1.5, owned non-weapon items excluded, ≥1 option at player's highest rarity.

## Naming note

Item/enemy/weapon IDs are English snake_case (`lapicero_roto`, `angry_email`, `coffee_thrower`); display names and descriptions are Spanish. Keep this split — it is baked into the config schemas.
