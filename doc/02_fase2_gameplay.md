# OFFICE SURVIVOR — FASE 2: GAMEPLAY CORE
> Usar junto con `00_game_bible.md`. La Fase 1 debe estar completamente terminada.

---

## Objetivo

Crear una partida completa y jugable usando únicamente placeholders visuales.
Al final de esta fase, alguien debe poder jugar una run completa de inicio a fin.

---

## Reglas de trabajo

- Inspeccionar todos los archivos existentes antes de modificar cualquier cosa.
- No reescribir sistemas que ya funcionen.
- Todos los valores numéricos deben venir de `game.config.ts`. Cero números mágicos.
- Placeholders únicamente: círculos, rectángulos, texto. Sin arte final.
- No implementar UI pulida ni efectos visuales — eso es Fase 3.

---

## Prioridad de implementación (en orden)

1. Jugador con movimiento y vida
2. Sistema de Estrés
3. Un enemigo básico (Angry Email)
4. Un arma básica (Coffee Thrower)
5. Sistema de oleadas
6. Todos los enemigos restantes
7. Todas las armas restantes
8. Sistema de niveles e ítems
9. `items.config.ts` y `enemies.config.ts` completos
10. Pool de nivel ponderado
11. CEO (jefe final)
12. Game Over y Victoria

---

## Sistema del Jugador

### Movimiento
- WASD o teclas de flecha
- Velocidad: `PLAYER.BASE_SPEED` (de `game.config.ts`)
- El jugador siempre mira hacia el enemigo más cercano
- Las armas disparan automáticamente hacia el enemigo más cercano

### Vida y daño
- HP inicial: `PLAYER.BASE_HP`
- Al recibir daño: invencibilidad durante `PLAYER.INVINCIBILITY_FRAMES_MS`
- Al llegar a 0 HP: transición a GameOverScene con stats de la run

### Placeholder visual
- Rectángulo verde 32×32px
- Barra de HP encima (roja, proporcional)

---

## Sistema de Estrés

Implementar exactamente según Game Bible. Resumen:

```ts
// Lógica de estrés — pseudocódigo de referencia
onPlayerHit(): void {
  this.stress = Math.min(STRESS.MAX, this.stress + STRESS.DAMAGE_PER_HIT);
  if (this.stress >= STRESS.MAX) this.triggerCollapse();
}

onEnemyKilled(isElite: boolean): void {
  const decrease = isElite ? STRESS.KILL_ELITE_DECREASE : STRESS.KILL_NORMAL_DECREASE;
  this.stress = Math.max(0, this.stress - decrease);
}

getStressState(): StressState {
  if (this.stress <= STRESS.THRESHOLDS.RELAXED_MAX)  return 'relaxed';
  if (this.stress <= STRESS.THRESHOLDS.TENSE_MAX)    return 'tense';
  if (this.stress <= STRESS.THRESHOLDS.LIMIT_MAX)    return 'limit';
  if (this.stress <= STRESS.THRESHOLDS.BURNOUT_MAX)  return 'burnout';
  return 'collapse';
}

applyStressModifiers(base: PlayerState): PlayerState {
  const state = this.getStressState();
  const mods = {
    relaxed:  { damage: 0.9,  speed: 1.0,  drain: 0   },
    tense:    { damage: 1.0,  speed: 1.0,  drain: 0   },
    limit:    { damage: 1.2,  speed: 1.1,  drain: 0   },
    burnout:  { damage: 1.4,  speed: 1.25, drain: STRESS.BURNOUT_HP_DRAIN_PER_S },
    collapse: { damage: 1.0,  speed: 1.0,  drain: 0   },
  };
  return { ...base, damageMultiplier: mods[state].damage, speed: base.speed * mods[state].speed };
}
```

El drenaje de HP en Burnout se aplica en el `update()` del jugador usando `delta`.

---

## Sistema de Armas

### Arquitectura requerida

```ts
// src/systems/WeaponSystem.ts
interface WeaponInstance {
  definitionId: string;
  level: number;           // 1–3 (número de copias)
  cooldownMs: number;      // calculado: 1000 / (fireRate * levelMultiplier)
  lastFiredAt: number;
}

class WeaponSystem {
  fire(weapon: WeaponInstance, from: Phaser.Math.Vector2, target: Phaser.Math.Vector2): void;
  getDamage(weapon: WeaponInstance, playerState: PlayerState): number;
}
```

### Object pooling obligatorio para proyectiles

Los proyectiles deben usar `Phaser.GameObjects.Group` con `createMultiple`.
No hacer `new Phaser.GameObjects.X()` por cada disparo — causa garbage collection.

```ts
// Patrón correcto
const pool = this.physics.add.group({ classType: Bullet, maxSize: 200, runChildUpdate: true });

function fireBullet(x, y, vx, vy, damage) {
  const bullet = pool.get(x, y);
  if (bullet) bullet.fire(vx, vy, damage);
}
```

### Implementación de las 10 armas

Todos los valores base vienen del Game Bible (tabla de armas).
Poblar `WEAPONS` en `items.config.ts` con los `WeaponDefinition` completos.

Comportamientos especiales a implementar:
- **Coffee Thrower**: al impactar, aplica `slow` al enemigo (velocidad ×0.5 durante 1s + ítems)
- **Debug Laser**: haz continuo — usar overlap, no proyectil
- **Post-it Launcher**: instanciar 3 proyectiles con ángulos -15°, 0°, +15° del objetivo
- **PowerPoint Cannon**: proyectil lento (speed: 120px/s); al impactar, aplica stun
- **Whiteboard Marker**: proyectil corto + instanciar zona de daño en punto de impacto (3s)
- **Extintor**: cono frontal usando forma de sector; carga limitada con barra visible
- **Impresora Aliada**: crear entidad autónoma que sigue al jugador a distancia 80px y dispara al enemigo más cercano

---

## Sistema de Enemigos

### Arquitectura requerida

```ts
// src/systems/EnemySystem.ts
// Object pooling obligatorio — igual que proyectiles
const enemyPool = this.physics.add.group({ classType: Enemy, maxSize: 300, runChildUpdate: true });
```

### Poblar enemies.config.ts

```ts
// src/config/enemies.config.ts
import type { EnemyDefinition } from '@/types';
import { PROGRESSION } from './game.config';

const def = (partial: Omit<EnemyDefinition, 'xpValue'>): EnemyDefinition => ({
  ...partial,
  xpValue: Math.round(partial.hp / PROGRESSION.XP_PER_HP_DIVISOR),
});

export const ENEMIES: EnemyDefinition[] = [
  def({ id: 'angry_email',       name: 'Angry Email',        hp: 20,  speed: 80,  damage: 5,  isElite: false }),
  def({ id: 'toxic_manager',     name: 'Toxic Manager',      hp: 60,  speed: 50,  damage: 12, isElite: true  }),
  def({ id: 'angry_client',      name: 'Angry Client',       hp: 40,  speed: 90,  damage: 8,  isElite: false }),
  def({ id: 'hr_rep',            name: 'HR Representative',  hp: 35,  speed: 60,  damage: 10, isElite: true  }),
  def({ id: 'possessed_printer', name: 'Possessed Printer',  hp: 120, speed: 30,  damage: 15, isElite: true  }),
  def({ id: 'auditor',           name: 'Auditor',            hp: 80,  speed: 40,  damage: 20, isElite: true  }),
];
```

### Comportamientos especiales
- **Toxic Manager**: al morir, instanciar zona de daño en su posición (3s, daño 5/s)
- **HR Representative**: aura activa siempre que esté vivo (radio 120px, -30% velocidad jugador)
- **Possessed Printer**: cada 3s, disparar 5 proyectiles en abanico (72° entre cada uno)
- **Auditor**: primeros 3s de vida → flag `invincible: true`, ignorar todo daño

---

## Sistema de Oleadas

```
Oleada N → enemigos = N × WAVES.ENEMIES_PER_WAVE_MULTIPLIER + WAVES.BASE_ENEMIES
```

| Oleada   | Tipos disponibles                                                 |
|----------|-------------------------------------------------------------------|
| 1–2      | Angry Email                                                       |
| 3–4      | + Toxic Manager, Angry Client                                     |
| 5–6      | + HR Representative, Possessed Printer                            |
| 7–9      | + Auditor                                                         |
| 10       | CEO (jefe final, ver Game Bible)                                  |

Los enemigos aparecen en los bordes del mapa, distribuidos aleatoriamente.
No teletransportarse al centro — spawn fuera del viewport.

---

## Sistema de Niveles

```ts
function xpToNextLevel(level: number): number {
  return level * PROGRESSION.XP_PER_LEVEL_MULTIPLIER;
}

function xpFromKill(enemyHp: number): number {
  return Math.round(enemyHp / PROGRESSION.XP_PER_HP_DIVISOR);
}
```

Al subir de nivel: pausar juego y mostrar pantalla de selección de ítem.
La pantalla de selección es funcional pero sin polish (texto + botones simples).

---

## Pool de nivel — ponderación

```ts
// src/systems/UpgradePool.ts

function buildPool(playerState: PlayerState, allItems: ItemDefinition[]): ItemDefinition[] {
  return allItems
    .filter(item => !isMaxed(item, playerState))
    .map(item => {
      let weight = RARITY_WEIGHTS[item.rarity]; // comun:60, raro:28, epico:10, legendario:2
      const hasSynergyWeapon = item.synergyWith?.some(id => playerState.weapons.includes(id));
      if (hasSynergyWeapon) weight *= 3;
      const sharesTag = item.tags.some(tag => getPlayerBuildTags(playerState).includes(tag));
      if (sharesTag) weight *= 1.5;
      return { item, weight };
    });
}

function pickUpgradeOptions(pool: WeightedItem[], count: number): ItemDefinition[] {
  // Weighted random sin reposición
  // Garantizar que al menos 1 ítem sea de rareza ≥ rareza más alta del jugador
}
```

---

## items.config.ts — completo

Poblar el array `ITEMS` y `WEAPONS` con todos los ítems del Game Bible.
Cada ítem debe implementar los callbacks tipados (`onPickup`, `onKill`, etc.) que modifican `PlayerState`.

Ejemplo de implementación:

```ts
{
  id: 'lapicero_roto',
  name: 'Lapicero Roto',
  description: '+8% daño. +1% daño extra por cada ítem adicional.',
  rarity: 'common',
  category: 'passive',
  tags: ['daño', 'escalado'],
  onPickup: (player) => ({
    ...player,
    damageMultiplier: player.damageMultiplier * (1.08 + player.items.length * 0.01),
  }),
},
```

Los ítems con efectos condicionales en tiempo real (Burnout, kills, etc.) se implementan
como suscriptores de eventos del EventBus.

### EventBus mínimo requerido

```ts
// src/systems/EventBus.ts
type GameEvent = 'player:hit' | 'enemy:killed' | 'player:level_up'
  | 'stress:changed' | 'player:burnout' | 'wave:complete' | 'boss:defeated';

export class EventBus extends Phaser.Events.EventEmitter {
  private static instance: EventBus;
  static getInstance(): EventBus {
    if (!EventBus.instance) EventBus.instance = new EventBus();
    return EventBus.instance;
  }
}
```

---

## CEO (jefe final)

HP: 2000. Aparece en oleada 10.
Usar máquina de estados para las fases:

```ts
type CEOPhase = 'phase1' | 'phase2';

// Cambia a phase2 cuando HP <= 1000
// phase2: todos los cooldowns × 0.8 (20% más frecuentes)
// Ataque nuevo en phase2: 'restructuring'
```

Placeholder visual: rectángulo rojo 64×64px con barra de HP encima.

---

## Checklist de aceptación

- [ ] Partida completa jugable de inicio a fin
- [ ] Movimiento del jugador funcional (WASD + flechas)
- [ ] Armas disparan automáticamente al enemigo más cercano
- [ ] Las 10 armas implementadas con comportamientos especiales
- [ ] Los 6 enemigos con comportamientos diferenciados
- [ ] CEO con 2 fases y 4 ataques
- [ ] Sistema de estrés funcional con todos sus estados y modificadores
- [ ] Drenaje de HP en Burnout funciona (delta-based)
- [ ] Sistema de oleadas escala correctamente
- [ ] Spawn de enemigos en bordes del mapa (no en centro)
- [ ] Sistema de XP y niveles funcional
- [ ] Pool de nivel ponderado (sinergias con ×3, tags con ×1.5)
- [ ] `items.config.ts` con los 42 ítems completos
- [ ] `enemies.config.ts` con los 6 enemigos completos
- [ ] Object pooling para proyectiles y enemigos
- [ ] EventBus implementado y usado por ítems reactivos
- [ ] Game Over con stats de la run
- [ ] Pantalla de Victoria al derrotar al CEO
- [ ] Cero números mágicos fuera de `game.config.ts`
- [ ] Sin `any` en TypeScript

---

## Salida obligatoria al terminar

1. **Resumen** — qué fue implementado
2. **Archivos** — lista completa de archivos creados/modificados
3. **Riesgos** — problemas potenciales detectados
4. **Próximos pasos** — qué hace la Fase 3

No comenzar la Fase 3 automáticamente.
