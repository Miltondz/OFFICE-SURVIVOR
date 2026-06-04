# OFFICE SURVIVOR — FASE 4: RELEASE CANDIDATE
> Usar junto con `00_game_bible.md`. Las Fases 1–3 deben estar completamente terminadas.

---

## Objetivo

Preparar un MVP sólido, balanceado y listo para reemplazo de arte final o publicación.
Esta fase no agrega mecánicas nuevas — estabiliza, balancea y extiende lo existente.

---

## Reglas de trabajo

- No reescribir sistemas que ya funcionen.
- Cambiar un solo aspecto del balance a la vez y documentar el cambio.
- El sistema de guardado debe ser el primer sistema implementado en esta fase.
- Rendimiento: medir antes de optimizar. No optimizar sin datos.

---

## Prioridad de implementación (en orden)

1. Sistema de guardado robusto
2. Meta-progresión (lógica de compra en UpgradeScene)
3. Estadísticas persistentes
4. Balance de armas
5. Balance de enemigos y oleadas
6. Balance de economía
7. Balance de estrés y progresión
8. Optimización de rendimiento
9. Documentación actualizada

---

## Sistema de Guardado

### Estructura completa de SaveData

```ts
// src/types/index.ts — ampliar SaveData

export interface SaveData {
  saveVersion: number;           // Incrementar con cada cambio de estructura
  totalRuns: number;
  totalKills: number;
  totalTimePlayed: number;       // segundos
  bossesDefeated: number;
  totalCoinsEarned: number;
  bestRunTime: number;           // segundos
  bestLevel: number;
  bestKillsInRun: number;
  metaUpgrades: Record<string, number>;  // id → nivel comprado
  settings: {
    musicVolume: number;         // 0–1
    sfxVolume: number;           // 0–1
    uiVolume: number;            // 0–1
  };
}
```

### SaveManager

```ts
// src/systems/SaveManager.ts

const SAVE_KEY = 'office_survivor_save';
const CURRENT_VERSION = 1;

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
  metaUpgrades: {},
  settings: { musicVolume: 0.5, sfxVolume: 0.8, uiVolume: 1.0 },
};

export class SaveManager {
  static load(): SaveData {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { ...DEFAULTS };
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const migrated = SaveManager.migrate(parsed);
      // Merge con defaults para manejar campos faltantes en saves viejos
      return { ...DEFAULTS, ...migrated };
    } catch {
      console.warn('Save corrupted — loading defaults');
      return { ...DEFAULTS };
    }
  }

  static save(data: SaveData): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ ...data, saveVersion: CURRENT_VERSION }));
    } catch (e) {
      console.error('Failed to save:', e);
    }
  }

  static migrate(data: Partial<SaveData>): Partial<SaveData> {
    // Aquí van las migraciones futuras
    // if (data.saveVersion === undefined) { ... data.saveVersion = 1 }
    return data;
  }

  static export(): string {
    return btoa(JSON.stringify(SaveManager.load()));
  }

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
```

### Cuándo guardar

- Al terminar una run (victoria o derrota)
- Al comprar una mejora de meta-progresión
- Al cambiar configuración de audio

No guardar durante la partida — innecesario y puede causar lag.

---

## Meta-progresión

Activar la lógica de compra en `UpgradeScene` (el layout ya existe desde Fase 3).

### Definición de mejoras

```ts
// src/config/meta.config.ts

export interface MetaUpgrade {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  costPerLevel: number[];        // costo de cada nivel: [nivel1, nivel2, ...]
  applyToPlayer: (player: PlayerState, level: number) => PlayerState;
}

export const META_UPGRADES: MetaUpgrade[] = [
  {
    id: 'base_hp',
    name: 'HP inicial +25',
    description: '+25 HP por nivel',
    maxLevel: 5,
    costPerLevel: [50, 75, 100, 150, 200],
    applyToPlayer: (p, level) => ({ ...p, maxHp: p.maxHp + 25 * level, hp: p.hp + 25 * level }),
  },
  {
    id: 'base_damage',
    name: 'Daño base +10%',
    description: '+10% daño por nivel',
    maxLevel: 5,
    costPerLevel: [75, 100, 150, 200, 300],
    applyToPlayer: (p, level) => ({ ...p, damageMultiplier: p.damageMultiplier * Math.pow(1.10, level) }),
  },
  {
    id: 'base_speed',
    name: 'Velocidad +5%',
    description: '+5% velocidad por nivel',
    maxLevel: 3,
    costPerLevel: [60, 90, 130],
    applyToPlayer: (p, level) => ({ ...p, speed: p.speed * Math.pow(1.05, level) }),
  },
  {
    id: 'stress_resist',
    name: 'Resistencia al estrés',
    description: '-20% subida de estrés por nivel',
    maxLevel: 3,
    costPerLevel: [100, 150, 250],
    applyToPlayer: (p, level) => p, // modifica constante de estrés — ver StressSystem
  },
  {
    id: 'alt_character',
    name: 'Personaje alternativo',
    description: 'Desbloquea aspecto alternativo (visual placeholder)',
    maxLevel: 1,
    costPerLevel: [200],
    applyToPlayer: (p, _) => p, // solo visual
  },
  {
    id: 'starting_weapon',
    name: 'Arma inicial',
    description: 'Elige con qué arma empiezas cada run',
    maxLevel: 1,
    costPerLevel: [150],
    applyToPlayer: (p, _) => p, // abre selector de arma en MainMenu
  },
];
```

### Flujo de compra en UpgradeScene

1. Leer `SaveData.metaUpgrades` y `SaveData.totalCoinsEarned - gastadas`
2. Para cada mejora: mostrar nivel actual, costo del siguiente nivel
3. Si monedas ≥ costo y nivel < máximo: botón "COMPRAR" habilitado
4. Al comprar: `metaUpgrades[id]++`, restar monedas, `SaveManager.save()`
5. Actualizar UI inmediatamente (sin recargar escena)

### Aplicar meta-progresión al iniciar run

```ts
// En GameScene.create(), antes de crear al jugador:
function applyMetaUpgrades(base: PlayerState, save: SaveData): PlayerState {
  let state = { ...base };
  META_UPGRADES.forEach(upgrade => {
    const level = save.metaUpgrades[upgrade.id] ?? 0;
    if (level > 0) state = upgrade.applyToPlayer(state, level);
  });
  return state;
}
```

---

## Estadísticas persistentes

Al finalizar cada run, llamar `SaveManager.updateRunStats(runStats)`:

```ts
static updateRunStats(run: RunStats, current: SaveData): SaveData {
  return {
    ...current,
    totalRuns: current.totalRuns + 1,
    totalKills: current.totalKills + run.kills,
    totalTimePlayed: current.totalTimePlayed + run.timeSurvived,
    bossesDefeated: current.bossesDefeated + (run.bossDefeated ? 1 : 0),
    totalCoinsEarned: current.totalCoinsEarned + run.coinsEarned,
    bestRunTime: run.bossDefeated
      ? Math.min(current.bestRunTime || Infinity, run.timeSurvived)
      : current.bestRunTime,
    bestLevel: Math.max(current.bestLevel, run.maxLevel),
    bestKillsInRun: Math.max(current.bestKillsInRun, run.kills),
  };
}
```

---

## Balance

Antes de tocar cualquier valor, jugar al menos 5 runs completas y documentar:
- Tiempo promedio de run
- Nivel promedio alcanzado
- Arma más usada / más útil
- Cuándo el jugador llega a Burnout (si llega)
- Si hay build dominante

### Objetivos de balance

| Métrica                          | Target          | Acción si falla                          |
|----------------------------------|-----------------|------------------------------------------|
| Duración promedio de run         | 8–12 minutos    | Ajustar HP de enemigos o daño del CEO    |
| Nivel máximo en una run          | 10–14           | Ajustar XP requerida por nivel           |
| Jugador llega a Burnout          | ~40% de las runs| Ajustar DAMAGE_PER_HIT o KILL_DECREASE   |
| Runs donde hay arma dominante    | < 20%           | Nivelar daño o cadencia de armas outliers|
| Runs para primera mejora de meta | 2–3 runs        | Ajustar ECONOMY.ENEMY_COINS              |

### Parámetros con permiso explícito de modificar en esta fase

Solo estos valores pueden cambiar sin justificación técnica:
- `PLAYER.BASE_HP`
- `STRESS.DAMAGE_PER_HIT`
- `STRESS.KILL_NORMAL_DECREASE`
- `STRESS.KILL_ELITE_DECREASE`
- `WAVES.ENEMIES_PER_WAVE_MULTIPLIER`
- Cualquier `damage`, `hp`, `speed` en `enemies.config.ts`
- Cualquier `baseDamage`, `fireRate` en `items.config.ts`
- `ECONOMY.ENEMY_COINS_MIN/MAX`
- `PROGRESSION.XP_PER_LEVEL_MULTIPLIER`

Documentar cada cambio en un comentario en `game.config.ts`:
```ts
BASE_HP: 120, // era 100 — aumentado porque las primeras oleadas eran demasiado letales (balance v1)
```

---

## Rendimiento

### Objetivo
60 FPS estables con 200 enemigos activos simultáneos.

### Medir primero

```ts
// Activar debug de Phaser para medir:
// En game.config.ts (solo dev):
physics: {
  arcade: {
    debug: import.meta.env.DEV,
  }
}
// Usar el panel FPS del browser DevTools, no el ojo
```

### Checklist de optimización (solo si FPS < 55 con 200 enemigos)

- [ ] Object pooling activo para proyectiles (verificar que no se instancian nuevos)
- [ ] Object pooling activo para enemigos
- [ ] Object pooling activo para números de daño flotantes
- [ ] Object pooling activo para partículas
- [ ] Los enemigos fuera de pantalla no calculan pathfinding (pause update si dist > 600px)
- [ ] El Debug Laser usa overlap, no colisión completa
- [ ] Las zonas de daño (Toxic Manager) usan grupos de física, no overlappers individuales
- [ ] HUD no redibuja elementos que no cambiaron (solo actualizar texto si valor cambió)

### No optimizar sin datos

Si el juego corre a 60 FPS, no tocar nada. La legibilidad del código
es más importante que micro-optimizaciones innecesarias.

---

## UI de configuración de audio

Agregar en el Menú Principal un botón "CONFIGURACIÓN".
Abre overlay con 3 sliders:
- Música (0–100)
- Efectos (0–100)
- UI (0–100)

Al cambiar cualquier slider: `AudioManager.setVolume()` + `SaveManager.save()`.
Al cargar el juego: `AudioManager.setVolume()` con valores de `SaveData.settings`.

---

## Export / Import de save

Agregar en StatisticsScene dos botones:
- "EXPORTAR SAVE" → copia al portapapeles el base64 del save
- "IMPORTAR SAVE" → abre prompt de texto, intenta parsear, muestra éxito/error

Esto facilita el testeo sin depender de DevTools.

---

## Documentación final

Actualizar `README.md` con:
- Estado actual del proyecto: "MVP Completo"
- Tabla de fases con estado ✓
- Descripción de sistemas implementados
- Instrucciones para reemplazar arte (qué keys de assets existe y qué dimensiones)
- Tabla de todos los eventos del EventBus
- Tabla de todas las constantes de `game.config.ts`

---

## Checklist de aceptación

**Guardado:**
- [ ] SaveManager implementado con manejo de corrupción
- [ ] Migración automática de versiones
- [ ] Export/Import de save funcional
- [ ] Se guarda al terminar run, al comprar mejora, al cambiar audio

**Meta-progresión:**
- [ ] Las 6 mejoras comprables en UpgradeScene
- [ ] Costo correcto por nivel
- [ ] Mejoras se aplican al iniciar cada run
- [ ] No se puede comprar si no hay monedas suficientes
- [ ] No se puede comprar si está al máximo nivel

**Estadísticas:**
- [ ] StatisticsScene muestra todos los valores correctamente
- [ ] Valores se acumulan correctamente entre runs
- [ ] Mejor run se actualiza solo si es mejor

**Balance:**
- [ ] Al menos 5 runs de testeo documentadas
- [ ] Cambios de balance documentados en comentarios
- [ ] No hay arma o build claramente dominante
- [ ] Run promedio dura 8–12 minutos

**Rendimiento:**
- [ ] 60 FPS estables con 200 enemigos (medido, no estimado)
- [ ] Sin memory leaks visibles tras 3+ runs seguidas

**Configuración de audio:**
- [ ] Sliders funcionan y persisten entre sesiones

**Documentación:**
- [ ] README actualizado con estado final
- [ ] Tabla de eventos del EventBus documentada
- [ ] Instrucciones para reemplazar arte

---

## Salida obligatoria al terminar

1. **Resumen** — qué fue implementado
2. **Archivos** — lista completa de archivos creados/modificados
3. **Estado de balance** — tabla con métricas medidas vs target
4. **Rendimiento medido** — FPS con N enemigos
5. **Riesgos** — problemas potenciales para releases futuras
6. **Recomendaciones** — qué priorizar si se continúa el desarrollo

El proyecto está terminado. No hay Fase 5 automática.
