# OFFICE SURVIVOR — MEJORAS ADICIONALES
> Documento de expansión. Revisar e integrar al Game Bible antes de implementar.
> Cada sección es independiente — se pueden adoptar en cualquier orden.

---

## MEJORA 1 — PERSONAJES JUGABLES

### Filosofía
Cada personaje fuerza una estrategia diferente desde el minuto 1.
No son variantes cosméticas — cambian fundamentalmente qué builds son viables.

### Personajes

---

#### El Becario
> "Aprende rápido. Muere rápido."

| Stat          | Modificador        |
|---------------|--------------------|
| HP inicial    | 60 (base: 100)     |
| XP ganada     | ×1.5               |
| Velocidad     | +10%               |
| Daño          | -10%               |

**Pasiva única — Curva de Aprendizaje:**
Cada vez que subes de nivel, el siguiente nivel requiere 10% menos XP (acumulativo, cap: -50%).

**Restricción:**
No puede equipar armas de rareza Épica o Legendaria.

**Estrategia forzada:** builds de muchos ítems comunes y raros. Llega al nivel 20 cuando otros van por el 13.

---

#### El Freelancer
> "Trabaja solo o no trabaja."

| Stat          | Modificador        |
|---------------|--------------------|
| HP inicial    | 90                 |
| Armas máx.    | 2 (base: 4)        |
| Daño por arma | ×1.8               |
| Estrés/hit    | -3 (base: +10)     |

**Pasiva única — Sin Jefe:**
Al equipar la segunda arma, ambas ganan +25% cadencia de disparo adicional.

**Restricción:**
El ítem Doble Monitor no tiene efecto (ya está al máximo permitido).

**Estrategia forzada:** elegir 2 armas y maximizarlas completamente. Builds de laser o cannon son naturales.

---

#### El Director
> "El poder tiene un precio."

| Stat          | Modificador        |
|---------------|--------------------|
| HP inicial    | 130                |
| Estrés/hit    | +20 (base: +10)    |
| Velocidad     | -10%               |

**Pasiva única — Visión Estratégica:**
En estado Burnout, todo el daño causado es crítico (×2). Sin excepción.

**Restricción:**
No puede recoger pickups de Café (los ignora físicamente).

**Estrategia forzada:** el jugador QUIERE estar en Burnout. Las builds de Burnout Agresivo son casi obligatorias.

---

#### El de RRHH
> "Todos le temen. Nadie le dispara."

| Stat          | Modificador        |
|---------------|--------------------|
| HP inicial    | 110                |
| Velocidad     | -5%               |
| Daño          | base               |

**Pasiva única — Política de Empresa:**
Los enemigos HR Representative se unen al jugador como aliados (no atacan, persiguen a otros enemigos haciendo 8 daño/hit).

**Restricción:**
Los Auditores aparecen desde la Oleada 1 y tienen +50% HP.

**Estrategia forzada:** gestionar un ejército creciente de HR Reps. Builds de área y aoe se vuelven críticas.

---

#### El Consultor Externo
> "Cobra el doble. Dura la mitad."

| Stat          | Modificador        |
|---------------|--------------------|
| HP inicial    | 70                 |
| Monedas/kill  | ×2.5               |
| Daño          | +20%               |

**Pasiva única — Por Hora:**
Cada 60 segundos de run ganados, +5% a todos los stats (acumulativo, sin cap).

**Restricción:**
La meta-progresión no aplica a este personaje. Empieza siempre desde cero en stats base.

**Estrategia forzada:** builds de economía y escalado tardío. Stock Options + All Hands son devastadores.

---

### Implementación en prompts

Agregar a `game.config.ts`:
```ts
export const CHARACTERS = {
  BECARIO:    { id: 'becario',    baseHp: 60,  ... },
  FREELANCER: { id: 'freelancer', baseHp: 90,  maxWeapons: 2, ... },
  DIRECTOR:   { id: 'director',   baseHp: 130, stressPerHit: 20, ... },
  RRHH:       { id: 'rrhh',       baseHp: 110, ... },
  CONSULTOR:  { id: 'consultor',  baseHp: 70,  coinMultiplier: 2.5, ... },
} as const;
```

Crear `src/config/characters.config.ts` con `CharacterDefinition[]`.
La selección de personaje va en `MainMenuScene` antes de iniciar la run.
El personaje elegido se pasa como dato a `GameScene` via `SceneManager.go()`.

---

## MEJORA 2 — MAPA CON ELEMENTOS INTERACTIVOS

### Filosofía
El mapa no debe ser un obstáculo — debe crear micro-decisiones de movimiento
y pequeños momentos de alivio o riesgo. Sin esto el juego es solo gestión de stats.

### Objetos estáticos (obstáculos)

Aparecen al inicio de la run, posiciones aleatorias dentro de un grid predefinido.

| Objeto           | Tamaño   | Comportamiento                                          |
|------------------|----------|---------------------------------------------------------|
| Escritorio       | 64×32px  | Obstáculo sólido. Bloquea jugador y enemigos.           |
| Archivador       | 32×48px  | Obstáculo sólido.                                       |
| Planta de Oficina| 32×32px  | Bloquea enemigos, el jugador puede pasar (hitbox menor).|

Cantidad: 8–12 objetos por mapa. Generados con seed aleatoria por run.
Los objetos no se destruyen (en el MVP). No usar arte final — rectángulos con color.

### Objetos funcionales (puntos de interés)

Posición fija en el mapa. Siempre en las mismas coordenadas relativas.

| Objeto           | Posición     | Función                                                      |
|------------------|--------------|--------------------------------------------------------------|
| Cafetera         | Centro-norte | Genera 1 pickup de Café cada 45s (ver STRESS.COFFEE_SPAWN_INTERVAL). |
| Máquina Expendedora | Centro-sur | Al acercarse: comprar 1 ítem aleatorio por 15 monedas. Cooldown 60s. |
| Extintor de Pared| Esquinas     | Al destruir: soltar pickup de -25 estrés. Respawn: nunca.   |

### Layout de referencia

```
┌─────────────────────────────────────┐
│  [E]          [☕]           [E]    │
│                                      │
│  [A]   ████        ████   [A]       │
│                                      │
│        ████   [J]  ████             │
│                                      │
│  [A]   ████        ████   [A]       │
│                                      │
│  [E]          [🥤]          [E]    │
└─────────────────────────────────────┘
E = Extintor de Pared  A = Archivador  ████ = Escritorios
☕ = Cafetera  🥤 = Máquina Expendedora  [J] = Spawn del jugador
```

### Config a agregar en `game.config.ts`

```ts
export const MAP = {
  OBSTACLE_COUNT_MIN: 8,
  OBSTACLE_COUNT_MAX: 12,
  COFFEE_MACHINE_SPAWN_INTERVAL_S: 45,
  VENDING_MACHINE_COST: 15,
  VENDING_MACHINE_COOLDOWN_S: 60,
} as const;
```

---

## MEJORA 3 — EVENTOS ESPECIALES DE OLEADA

### Filosofía
Romper el ritmo predecible de "llegan enemigos → matas enemigos" con eventos
que requieren adaptación inmediata. Máximo uno por oleada. No todos los eventos
son negativos — la incertidumbre es el punto.

### Tabla de eventos

| ID                  | Nombre              | Trigger     | Duración | Efecto                                                                |
|---------------------|---------------------|-------------|----------|-----------------------------------------------------------------------|
| `blackout`          | Apagón              | Cada 3 oleadas (25%) | 20s | Visibilidad reducida a radio 180px alrededor del jugador.      |
| `all_hands`         | All Hands Meeting   | Cada 3 oleadas (25%) | 10s | Todos los enemigos activos +50% velocidad.                     |
| `surprise_audit`    | Auditoría Sorpresa  | Cada 3 oleadas (20%) | —  | Reemplaza la oleada normal por 3 Auditores simultáneos.        |
| `free_coffee`       | Café Gratis         | Cada 3 oleadas (20%) | —  | 5 pickups de Café aparecen en posiciones aleatorias del mapa.  |
| `printer_jam`       | Atasco de Impresora | Cada 3 oleadas (10%) | —  | Todas las armas tienen 30% de probabilidad de "trabarse" 0.5s. |

Los porcentajes son pesos relativos. La primera oleada especial no puede aparecer antes de la oleada 3.

### Presentación al jugador

Al activarse un evento: texto en pantalla durante 2.5s antes de que surta efecto.
Ejemplo: `⚠ APAGÓN — LAS LUCES SE VAN EN 3...2...1...`

### Config

```ts
export const WAVE_EVENTS = {
  TRIGGER_EVERY_N_WAVES: 3,
  FIRST_EVENT_MIN_WAVE: 3,
  WEIGHTS: {
    blackout:         25,
    all_hands:        25,
    surprise_audit:   20,
    free_coffee:      20,
    printer_jam:      10,
  },
} as const;
```

---

## MEJORA 4 — SISTEMA DE MALDICIONES

### Filosofía
Los ítems Legendarios actuales son poderosos pero no tienen suficiente dientes.
Las Maldiciones son una categoría formal: aparecen siempre junto a un ítem
Legendario en el pool (como segunda opción), son claramente negativas en un aspecto
y claramente brutales en otro. El jugador siempre sabe exactamente qué está aceptando.

### Presentación en UI

En la pantalla de selección de ítem, las Maldiciones tienen:
- Borde de color negro
- Ícono de advertencia visible
- Descripción en dos líneas: `MALDICIÓN: [efecto negativo]` y `PODER: [efecto positivo]`

### Catálogo de Maldiciones

| ID                      | Nombre                    | Maldición                                      | Poder                                          |
|-------------------------|---------------------------|------------------------------------------------|------------------------------------------------|
| `exclusivity_contract`  | Contrato de Exclusividad  | Tu arma inicial se bloquea (no puedes perderla ni reemplazarla). | Esa arma gana +100% daño permanente.           |
| `no_vacation`           | Sin Vacaciones            | El estrés nunca baja de 50 (ni con café ni con kills). | +40% XP ganada.                              |
| `micromanagement`       | Micromanagement           | Cada 5s: -5 HP. No cancelable.                 | Los ítems ofrecidos tienen rareza +1 siempre. |
| `toxic_culture`         | Cultura Tóxica            | Los pickups de monedas no existen. Monedas: 0. | +80% daño. Sin límite de armas equipadas.     |
| `mandatory_overtime`    | Horas Extra Obligatorias  | La run dura 15 minutos (base: 10). El CEO aparece a los 15. | Al llegar a los 10 min: todos los stats ×1.5. |
| `open_office`           | Open Office               | HR Reps aparecen en todas las oleadas desde la 1. | Tu aura ralentiza también a los enemigos (-20% velocidad en radio 150px). |

### Reglas de aparición

- Máximo 1 Maldición activa por run.
- Si ya tienes una Maldición, desaparecen del pool.
- Aparecen solo desde el nivel 5 en adelante.
- Siempre aparecen acompañadas por al menos un ítem normal en la selección.

### Config

```ts
export const CURSES = {
  MIN_LEVEL_TO_APPEAR: 5,
  MAX_ACTIVE_CURSES: 1,
  APPEARS_ALONGSIDE_LEGENDARY: true,
} as const;
```

---

## MEJORA 5 — PANTALLA DE POST-RUN (BUILD REPORT)

### Filosofía
El jugador necesita saber POR QUÉ ganó o perdió. Sin este feedback,
el aprendizaje es lento y las sinergias no se descubren. El Build Report
reemplaza la pantalla de Game Over genérica con información accionable.

### Layout

```
┌──────────────────────────────────────────────────────┐
│  GAME OVER  /  VICTORIA          Tiempo: 08:34       │
│                                                       │
│  ── Build ──────────────────────────────────────────  │
│  Personaje: El Director                               │
│  Nivel alcanzado: 11        Estrés máximo: 94        │
│                                                       │
│  Top 3 fuentes de daño:                               │
│  1. Debug Laser        ████████████████  42%         │
│  2. Modo Debug (ítem)  ████████          21%         │
│  3. VPN Corporativa    ██████            15%         │
│                                                       │
│  Arma con más kills: Debug Laser — 187 kills          │
│  Oleada más larga: Oleada 7 — 34 enemigos             │
│  Maldición activa: Sin Vacaciones                     │
│                                                       │
│  ── Ítems de esta run ────────────────────────────── │
│  [Modo Debug] [VPN Corp.] [WiFi Rápido] [Agile Sprint]│
│  [Carta Renuncia] [Cafeína Crónica] [Horas Extra]    │
│                                                       │
│        [JUGAR DE NUEVO]    [MENÚ PRINCIPAL]           │
└──────────────────────────────────────────────────────┘
```

### Datos a trackear durante la run (agregar a RunStats)

```ts
export interface RunStats {
  // ...existentes...
  kills: number;
  timeSurvived: number;
  coinsEarned: number;
  maxLevel: number;
  bossDefeated: boolean;

  // NUEVOS — necesarios para Build Report
  maxStressReached: number;
  damageBySource: Record<string, number>;  // weaponId/itemId → daño total
  killsByWeapon: Record<string, number>;   // weaponId → kills
  longestWave: { wave: number; enemies: number };
  activeCurse: string | null;
  itemsCollected: string[];               // IDs en orden de adquisición
  characterId: string;
}
```

### Cálculo de "Top 3 fuentes de daño"

Cada vez que un proyectil o efecto impacta:
```ts
EventBus.emit('damage:dealt', { sourceId: 'debug_laser', amount: 12 });
```
El RunTracker acumula `damageBySource[sourceId] += amount`.
Al terminar la run, ordenar por valor descendente y tomar los 3 primeros.

### Ítem "Revela Sinergia"

Si el jugador tiene ítems sinérgicos en su build (según el campo `synergyWith`),
mostrar en el Build Report:
```
✦ Sinergia activa: Modo Debug + Debug Laser (+crítico garantizado)
```
Esto enseña pasivamente el sistema de sinergias sin tutorial.

---

## Hoja de ruta sugerida de adopción

| Mejora                        | Impacto en replayability | Complejidad técnica | Prioridad sugerida |
|-------------------------------|--------------------------|---------------------|--------------------|
| Build Report (Mejora 5)       | Alta                     | Baja                | 1 — hacer primero  |
| Personajes (Mejora 1)         | Muy alta                 | Media               | 2                  |
| Eventos de oleada (Mejora 3)  | Alta                     | Baja                | 3                  |
| Maldiciones (Mejora 4)        | Alta                     | Baja                | 4                  |
| Mapa interactivo (Mejora 2)   | Media                    | Media-alta          | 5 — última         |

El mapa interactivo es el último porque requiere cambios en física y colisiones
que pueden introducir regresiones. Las demás mejoras son aditivas y de menor riesgo.
