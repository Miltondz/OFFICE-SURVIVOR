# IMPLEMENTATION — FASE 1 (Arquitectura / Scaffolding)

> Refined build spec derived from `01_fase1_arquitectura.md` + `00_game_bible.md`.
> Scope: technical base only. NO gameplay, NO mechanics, NO enemies. Placeholders only.
> Implementer: build exactly this. Do not add future-phase content. Do not invent values.

---

## 0. Pre-flight

- Inspect repo first. Only `doc/` and `CLAUDE.md` exist. No `src/`, no `package.json`.
- Node 18+. Package manager: npm.
- All numeric values come from `src/config/game.config.ts`. Zero magic numbers elsewhere.
- No `any`. TS strict. No final art — rectangles/circles/text only.

---

## 1. Files to create (complete list)

```
package.json
tsconfig.json
vite.config.ts
index.html
.env.example
.gitignore
README.md
src/
  main.ts
  scenes/
    BootScene.ts
    PreloadScene.ts
    MainMenuScene.ts
    GameScene.ts
    GameOverScene.ts
    UpgradeScene.ts
  systems/
    SceneManager.ts
  config/
    game.config.ts
    items.config.ts
    enemies.config.ts
  types/
    index.ts
  utils/
    index.ts
```

---

## 2. package.json

```json
{
  "name": "office-survivor",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "phaser": "^3.80.1"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0"
  }
}
```

Pin to latest stable at install time if newer exists; otherwise use these.

---

## 3. tsconfig.json

Strict. Bundler resolution. Path alias `@/* → ./src/*`. Must satisfy the flags in the Phase 1 doc.

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "paths": { "@/*": ["./src/*"] },
    "baseUrl": "."
  },
  "include": ["src", "vite.config.ts"]
}
```

---

## 4. vite.config.ts

```ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: { port: 3000 },
});
```

---

## 5. index.html

Single root `<div id="game">`. Dark background, no margin, centered. Loads `src/main.ts` as module.

```html
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Office Survivor</title>
    <style>
      html, body { margin: 0; padding: 0; background: #1a1a1a; overflow: hidden; }
      #game { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

---

## 6. game.config.ts

Copy ALL constants from `01_fase1_arquitectura.md` §game.config.ts verbatim: `GAME`, `PLAYER`, `STRESS`, `WAVES`, `PROGRESSION`, `ECONOMY`, `RUN_DURATION_S`. Each `as const`. No additions, no omissions.

Add scene key constants to avoid magic strings:

```ts
export const SCENES = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MAIN_MENU: 'MainMenuScene',
  GAME: 'GameScene',
  GAME_OVER: 'GameOverScene',
  UPGRADE: 'UpgradeScene',
} as const;
```

Add a placeholder-color palette (used only for placeholder rects/text):

```ts
export const COLORS = {
  BG: 0x1a1a1a,
  PLAYER: 0x4caf50,
  TEXT: '#ffffff',
  TEXT_MUTED: '#888888',
  BUTTON: 0x333355,
  BUTTON_HOVER: 0x4444aa,
} as const;
```

---

## 7. types/index.ts

Copy ALL interfaces/types from `01_fase1_arquitectura.md` §types verbatim:
`Rarity`, `ItemCategory`, `EnemyType`, `ItemDefinition`, `WeaponDefinition`, `EnemyDefinition`, `PlayerState`, `RunStats`, `SaveData`.

Add `StressState` (referenced by Phase 2, harmless to define now):

```ts
export type StressState = 'relaxed' | 'tense' | 'limit' | 'burnout' | 'collapse';
```

`ItemDefinition` callbacks reference `PlayerState` and `EnemyType` — keep them. No implementations yet.

---

## 8. config/items.config.ts

Typed skeleton, empty arrays, lookup helpers. Verbatim from Phase 1 doc:

```ts
import type { ItemDefinition, WeaponDefinition } from '@/types';

export const ITEMS: ItemDefinition[] = [];
export const WEAPONS: WeaponDefinition[] = [];

export function getItemById(id: string): ItemDefinition | undefined {
  return ITEMS.find(i => i.id === id);
}
export function getWeaponById(id: string): WeaponDefinition | undefined {
  return WEAPONS.find(w => w.id === id);
}
```

---

## 9. config/enemies.config.ts

Typed skeleton ONLY (population is Phase 2). Empty array + helper + the `def` factory present but unused-safe:

```ts
import type { EnemyDefinition } from '@/types';
import { PROGRESSION } from './game.config';

export const def = (partial: Omit<EnemyDefinition, 'xpValue'>): EnemyDefinition => ({
  ...partial,
  xpValue: Math.round(partial.hp / PROGRESSION.XP_PER_HP_DIVISOR),
});

export const ENEMIES: EnemyDefinition[] = [];

export function getEnemyById(id: string): EnemyDefinition | undefined {
  return ENEMIES.find(e => e.id === id);
}
```

Note: `def` exported so `noUnusedLocals` does not flag it.

---

## 10. utils/index.ts

Empty helpers stub. To satisfy `noUnusedLocals`/empty-file lint, export one real generic helper used by scenes:

```ts
export function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}
```

---

## 11. systems/SceneManager.ts

Verbatim from Phase 1 doc. Static `go` / `overlay` / `closeOverlay`. No changes.

```ts
import Phaser from 'phaser';

export class SceneManager {
  static go(from: Phaser.Scene, to: string, data?: object): void {
    from.scene.start(to, data);
  }
  static overlay(from: Phaser.Scene, to: string, data?: object): void {
    from.scene.launch(to, data);
    from.scene.pause();
  }
  static closeOverlay(overlay: Phaser.Scene, resume: string): void {
    overlay.scene.stop();
    overlay.scene.resume(resume);
  }
}
```

---

## 12. main.ts — Phaser bootstrap

Phaser.Game config. Arcade physics (debug = `import.meta.env.DEV`). FIT scale, CENTER_BOTH, letterbox. Register all 6 scenes in order. BootScene first.

```ts
import Phaser from 'phaser';
import { GAME, COLORS } from '@/config/game.config';
import { BootScene } from '@/scenes/BootScene';
import { PreloadScene } from '@/scenes/PreloadScene';
import { MainMenuScene } from '@/scenes/MainMenuScene';
import { GameScene } from '@/scenes/GameScene';
import { GameOverScene } from '@/scenes/GameOverScene';
import { UpgradeScene } from '@/scenes/UpgradeScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME.WIDTH,
  height: GAME.HEIGHT,
  backgroundColor: COLORS.BG,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { debug: import.meta.env.DEV },
  },
  scene: [BootScene, PreloadScene, MainMenuScene, GameScene, GameOverScene, UpgradeScene],
};

new Phaser.Game(config);
```

---

## 13. Scenes — exact behavior

All scenes export a named class extending `Phaser.Scene`, constructed with its `SCENES.*` key. Placeholders only: text + rectangle buttons. Build a tiny local button helper inside each scene OR a shared one — implementer choice, but no external UI lib.

Helper button pattern (interactive rect + label, hover tint):
```ts
private makeButton(x: number, y: number, label: string, onClick: () => void, enabled = true): void
```

| Scene | Content | Transition |
|-------|---------|-----------|
| **BootScene** | Center text "Loading…". No input. | `this.scene.start(SCENES.PRELOAD)` in `create()` (immediate). |
| **PreloadScene** | Placeholder load bar (rectangle filling 0→100% via a short tween or tick). Loads nothing real yet. | On complete → `SceneManager.go(this, SCENES.MAIN_MENU)`. |
| **MainMenuScene** | Title "OFFICE SURVIVOR". Buttons: **Jugar** (→ GameScene), **Mejoras** (disabled, muted), **Estadísticas** (no-op/disabled OK), **Salir** (`window.close()` attempt — may noop in browser). | Jugar → `SceneManager.go(this, SCENES.GAME)`. |
| **GameScene** | Green 32×32 rect = player, centered. Corner text showing stub stats (HP, Estrés, Nivel, Tiempo) pulled from a local placeholder `PlayerState`. WASD/arrow movement optional but allowed (no enemies). Add a temp key (e.g. `G`) to trigger Game Over for testing. | On test-key → `SceneManager.go(this, SCENES.GAME_OVER, { stats })`. |
| **GameOverScene** | "Game Over" + run stats from passed data (use `RunStats` shape, zeros OK). Button **Reintentar**. | Reintentar → `SceneManager.go(this, SCENES.GAME)`. |
| **UpgradeScene** | Text "Próximamente" + button **Volver**. | Volver → `SceneManager.go(this, SCENES.MAIN_MENU)`. |

Rules for scenes:
- No sprites, no animations, no audio.
- Pull every dimension/position from config or compute from `GAME.WIDTH/HEIGHT`. No raw pixel literals for layout-critical values where a config exists; small layout offsets (padding) may be local `const` with a clear name — acceptable, not "magic gameplay numbers".
- Stub `PlayerState` in GameScene uses `PLAYER.BASE_HP`, etc. from config.

---

## 14. .gitignore

```
node_modules/
dist/
*.local
.env
.DS_Store
```

## 15. .env.example

```
# Reserved for future config. Currently unused.
VITE_APP_ENV=development
```

---

## 16. README.md

Sections required by Phase 1 doc:
- Title + 1-paragraph description (logline from Game Bible).
- Requirements: Node 18+.
- Install: `npm install`. Dev: `npm run dev`. Build: `npm run build`.
- Commented folder structure.
- Phase table (1–4) with status: Fase 1 ✓ (in progress/done), 2–4 pending.

---

## 17. Acceptance (must all pass)

- [ ] `npm install` succeeds.
- [ ] `npm run dev` starts, zero TS errors, game loads at :3000.
- [ ] `npm run typecheck` passes (no `any`, no unused).
- [ ] All 6 scenes reachable; navigation works (Menu→Game→GameOver→Game, Menu unreachable-from-disabled handled).
- [ ] `game.config.ts` exports every constant block.
- [ ] `items.config.ts` + `enemies.config.ts` compile (empty but typed).
- [ ] `types/index.ts` exports all interfaces.
- [ ] `SceneManager` used for transitions.
- [ ] No magic gameplay numbers outside config. No `any`.
- [ ] README generated.

---

## 18. Output required on finish

1. Summary of what was built.
2. File list (created/modified).
3. Risks detected.
4. Next steps (what Phase 2 does). DO NOT start Phase 2.
