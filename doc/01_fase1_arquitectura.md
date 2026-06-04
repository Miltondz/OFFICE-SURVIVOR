# OFFICE SURVIVOR — FASE 1: ARQUITECTURA
> Usar junto con `00_game_bible.md`. No incluir contenido de fases futuras.

---

## Objetivo

Construir la base técnica profesional sobre la que se desarrollará el juego completo.
Sin gameplay. Sin mecánicas. Sin enemigos. Solo estructura.

---

## Reglas de trabajo

- No reescribir sistemas que ya funcionen.
- Inspeccionar repositorio antes de crear cualquier archivo.
- Configuración sobre código: valores numéricos en archivos de config, no hardcodeados.
- Placeholders únicamente: círculos, rectángulos, texto. Sin arte final.
- No implementar contenido de fases futuras.

---

## Estructura de carpetas a crear

```
src/
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
    items.config.ts        ← vacío por ahora, esqueleto tipado
    enemies.config.ts      ← vacío por ahora, esqueleto tipado
  types/
    index.ts               ← interfaces y types globales
  utils/
    index.ts               ← helpers vacíos
  main.ts                  ← bootstrap Phaser
index.html
vite.config.ts
tsconfig.json
.env.example
README.md
```

---

## Configuración requerida

### tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### vite.config.ts
```ts
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: { port: 3000 }
});
```

---

## game.config.ts — configuración centralizada

Todas las constantes del juego deben vivir aquí. La IA no debe hardcodear
ningún valor numérico fuera de este archivo.

```ts
// src/config/game.config.ts

export const GAME = {
  WIDTH: 960,
  HEIGHT: 540,
  TARGET_FPS: 60,
} as const;

export const PLAYER = {
  BASE_HP: 100,
  BASE_SPEED: 160,
  BASE_DAMAGE_MULTIPLIER: 1.0,
  INVINCIBILITY_FRAMES_MS: 500,
} as const;

export const STRESS = {
  MAX: 100,
  DAMAGE_PER_HIT: 10,
  PASSIVE_INCREASE_INTERVAL_S: 30,
  PASSIVE_INCREASE_AMOUNT: 5,
  KILL_NORMAL_DECREASE: 2,
  KILL_ELITE_DECREASE: 8,
  COFFEE_DECREASE: 15,
  THRESHOLDS: {
    RELAXED_MAX: 30,
    TENSE_MAX: 69,
    LIMIT_MAX: 89,
    BURNOUT_MAX: 99,
  },
  BURNOUT_HP_DRAIN_PER_S: 2,
} as const;

export const WAVES = {
  INTERVAL_S: 30,
  BASE_ENEMIES: 2,
  ENEMIES_PER_WAVE_MULTIPLIER: 3,
  BOSS_WAVE: 10,
} as const;

export const PROGRESSION = {
  XP_PER_LEVEL_MULTIPLIER: 100, // nivel × 100
  XP_PER_HP_DIVISOR: 10,        // HP_enemigo / 10
  UPGRADE_OPTIONS: 3,
} as const;

export const ECONOMY = {
  ENEMY_COINS_MIN: 1,
  ENEMY_COINS_MAX: 3,
  ELITE_COINS_MIN: 5,
  ELITE_COINS_MAX: 10,
  BOSS_COINS: 100,
} as const;

export const RUN_DURATION_S = 600; // 10 minutos
```

---

## Esqueleto de types (src/types/index.ts)

```ts
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemCategory = 'passive' | 'consumable' | 'weapon';
export type EnemyType = 'angry_email' | 'toxic_manager' | 'angry_client'
  | 'hr_rep' | 'possessed_printer' | 'auditor' | 'ceo';

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  category: ItemCategory;
  tags: string[];
  synergyWith?: string[];    // IDs de ítems sinérgicos (para ponderación de pool)
  maxStack?: number;          // undefined = sin límite
  onPickup?: (player: PlayerState) => PlayerState;
  onKill?: (player: PlayerState, enemy: EnemyType) => PlayerState;
  onHit?: (player: PlayerState) => PlayerState;
  onLevelUp?: (player: PlayerState) => PlayerState;
}

export interface WeaponDefinition {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  baseDamage: number;
  fireRate: number;       // disparos por segundo
  range: number;          // píxeles
  projectileCount: number;
  tags: string[];
}

export interface EnemyDefinition {
  id: EnemyType;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  isElite: boolean;
  xpValue: number;        // calculado automáticamente: Math.round(hp / 10)
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  speed: number;
  damageMultiplier: number;
  stress: number;
  level: number;
  xp: number;
  coins: number;
  items: string[];        // IDs de ítems poseídos
  weapons: string[];      // IDs de armas equipadas
}

export interface RunStats {
  kills: number;
  timeSurvived: number;
  coinsEarned: number;
  maxLevel: number;
  maxStress: number;
  bossDefeated: boolean;
}

export interface SaveData {
  saveVersion: number;
  totalRuns: number;
  totalKills: number;
  totalTimePlayed: number;
  bossesDefeated: number;
  totalCoinsEarned: number;
  bestRunTime: number;
  bestLevel: number;
  metaUpgrades: Record<string, number>; // id → nivel comprado
}
```

---

## Esqueleto de items.config.ts

El archivo real se llenará en Fase 2, pero el esqueleto tipado debe existir
desde Fase 1 para que los imports no rompan.

```ts
// src/config/items.config.ts
import type { ItemDefinition, WeaponDefinition } from '@/types';

export const ITEMS: ItemDefinition[] = [
  // Se poblará en Fase 2
];

export const WEAPONS: WeaponDefinition[] = [
  // Se poblará en Fase 2
];

export function getItemById(id: string): ItemDefinition | undefined {
  return ITEMS.find(i => i.id === id);
}

export function getWeaponById(id: string): WeaponDefinition | undefined {
  return WEAPONS.find(w => w.id === id);
}
```

---

## Escenas — comportamiento esperado

Todas las escenas son placeholders. Solo deben renderizar texto y botones
funcionales. Sin sprites, sin animaciones.

| Escena          | Contenido mínimo                                      | Transición                   |
|-----------------|-------------------------------------------------------|------------------------------|
| BootScene       | Texto "Loading…". Sin input.                          | → PreloadScene automático    |
| PreloadScene    | Barra de carga (placeholder). Carga assets futuros.   | → MainMenuScene automático   |
| MainMenuScene   | Botones: Jugar, Mejoras (deshabilitado), Estadísticas, Salir | Jugar → GameScene      |
| GameScene       | Rectángulo verde (jugador), texto de stats en esquina | Morir → GameOverScene        |
| GameOverScene   | Texto "Game Over" + stats de la run + botón Reintentar| Reintentar → GameScene       |
| UpgradeScene    | Texto "Próximamente" + botón Volver                  | Volver → MainMenuScene       |

### SceneManager

```ts
// src/systems/SceneManager.ts
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

## README.md mínimo a generar

Debe incluir:
- Descripción del juego (1 párrafo)
- Requisitos (Node 18+)
- Instalación: `npm install`
- Desarrollo: `npm run dev`
- Build: `npm run build`
- Estructura de carpetas comentada
- Tabla de fases (1–4) con estado actual

---

## Checklist de aceptación

- [ ] `npm run dev` inicia sin errores TypeScript
- [ ] Las 6 escenas son accesibles y navegan correctamente
- [ ] `game.config.ts` exporta todas las constantes
- [ ] `items.config.ts` compila con tipos correctos (aunque vacío)
- [ ] `enemies.config.ts` compila con tipos correctos (aunque vacío)
- [ ] `types/index.ts` exporta todas las interfaces
- [ ] `SceneManager` funciona para transiciones entre escenas
- [ ] README generado y correcto
- [ ] Sin números mágicos fuera de `game.config.ts`
- [ ] Sin `any` en ningún archivo TypeScript

---

## Salida obligatoria al terminar

Proporcionar:

1. **Resumen** — qué fue implementado
2. **Archivos** — lista completa de archivos creados/modificados
3. **Riesgos** — problemas potenciales detectados
4. **Próximos pasos** — qué hace la Fase 2

No comenzar la Fase 2 automáticamente.
