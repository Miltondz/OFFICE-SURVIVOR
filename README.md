# Office Survivor

**Vampire Survivors meets la oficina corporativa.** Sobrevive hordas de emails furiosos, managers tóxicos e impresoras poseídas mientras tu **estrés** escala entre poder y colapso. Un bullet-heaven de acción cuya mecánica central convierte el riesgo en ventaja táctica.

Hecho con **Phaser 3 + TypeScript estricto + Vite**. Solo placeholders (rectángulos, círculos, texto) — listo para reemplazo de arte.

---

## Requisitos

- Node 18+
- npm

## Instalación y uso

```bash
npm install        # instalar dependencias
npm run dev        # servidor de desarrollo (http://localhost:3000)
npm run build      # build de producción
npm run preview    # previsualizar build
npm run typecheck  # verificar tipos (tsc --noEmit, estricto)
```

## Controles

- **Mover:** WASD o flechas
- **Disparo:** automático al enemigo más cercano
- Las mejoras se eligen al subir de nivel y tras cada oleada

---

## Cómo se juega

1. Eliges un **personaje** y un **arma inicial**.
2. Llegan oleadas cada 30s. Matas → XP → subes de nivel → eliges ítem o arma.
3. El **estrés** sube al recibir daño y baja al matar. Alto estrés = más daño y velocidad, pero drena vida.
4. En la oleada 10 aparece el **CEO** (jefe de 2 fases). Derrotarlo = victoria. Llegar a 100 de estrés o 0 de vida = derrota.
5. La pantalla **Build Report** resume tu run; las monedas se gastan en **meta-progresión** permanente.

### Sistema de Estrés (mecánica central)

| Rango  | Estado    | Efecto                                          |
|--------|-----------|-------------------------------------------------|
| 0–30   | Relajado  | −10% daño                                        |
| 31–69  | Tenso     | Normal                                           |
| 70–89  | Al límite | +20% daño, +10% velocidad                        |
| 90–99  | Burnout   | +40% daño, +25% velocidad, −2 HP/s               |
| 100    | Colapso   | Game Over                                         |

---

## Contenido

- **10 armas** con comportamientos únicos (Coffee Thrower, Debug Laser, PowerPoint Cannon, Impresora Aliada…).
- **42 ítems** (común → legendario) con sinergias y un pool de nivel ponderado.
- **6 enemigos** + jefe **CEO** de 2 fases y 4 ataques.
- **5 personajes jugables** (Becario, Freelancer, Director, RRHH, Consultor) con pasivas y restricciones que cambian la build.
- **6 maldiciones** que aparecen junto a legendarios: brutales en un aspecto, devastadoras en otro.
- **5 eventos de oleada** (apagón, all-hands, auditoría sorpresa, café gratis, atasco de impresora).
- **Mapa interactivo**: obstáculos, cafetera, máquina expendedora y extintores destructibles.
- HUD completo, números de daño, screen shake, partículas, audio procedural (Web Audio).
- **Guardado** robusto (localStorage) con export/import, estadísticas y meta-progresión.

---

## Estructura del proyecto

```
src/
  scenes/      Boot → Preload → MainMenu → Game (+ HUD overlay, UpgradeOverlay,
               UpgradeScene, StatisticsScene, BuildReportScene)
  systems/     EventBus, RunContext, StressSystem, WeaponSystem, EnemySystem,
               SpawnDirector, LevelSystem, UpgradePool, PickupSystem, RunTracker,
               WaveEventSystem, MapSystem, SaveManager, AudioManager, ScreenShake,
               DamageNumbers, ParticleBursts, ItemReactions, SceneManager
  entities/    Player, Enemy, Projectile, CEOBoss, DamageZone, Pickup, PrinterTurret
  config/      game.config.ts (todas las constantes), items.config.ts,
               enemies.config.ts, characters.config.ts, curses.config.ts, meta.config.ts
  types/       index.ts — interfaces y types globales
  utils/       helpers
  main.ts      bootstrap Phaser
doc/           game bible + specs de implementación por fase
```

### Arquitectura

- **EventBus singleton** desacopla los sistemas; el HUD y los ítems reactivos se comunican por eventos.
- **RunContext** mantiene el estado de la run (player, modifiers, stats, personaje, curse).
- **Config sobre código:** todos los valores numéricos viven en `src/config/`. Cero números mágicos en sistemas/escenas.
- **Object pooling** obligatorio para proyectiles, enemigos, pickups, números de daño y partículas.
- TypeScript `strict`, sin `any`.

---

## Estado del proyecto: **MVP completo**

| Fase | Descripción                                   | Estado |
|------|-----------------------------------------------|--------|
| 1    | Arquitectura / Scaffolding                    | ✓ |
| 2    | Gameplay (armas, enemigos, XP, CEO)           | ✓ |
| 3    | UX / UI / Feel (HUD, efectos, audio)          | ✓ |
| 4    | Release (SaveManager, meta-progresión, balance) | ✓ |

| Expansión (doc/05)         | Estado |
|----------------------------|--------|
| Build Report post-run      | ✓ |
| Personajes jugables        | ✓ |
| Eventos de oleada          | ✓ |
| Maldiciones                | ✓ |
| Mapa interactivo           | ✓ |

---

## Reemplazo de arte

Toda la presentación usa placeholders (rectángulos/círculos/texto) y constantes en `game.config.ts`
(`COLORS`, `COLORS_GAME`, `ENTITY_SIZES`). Para integrar arte final, sustituye los placeholders en
`entities/` y escenas por sprites, manteniendo las dimensiones definidas en config.

## Licencia

Proyecto personal. Sin licencia definida.
