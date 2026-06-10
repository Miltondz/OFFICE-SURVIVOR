# PLAN — Arquetipos de enemigos + nuevos enemigos (análisis Opus de la spec "Corporate-Heaven")

> La spec pedida describe una reescritura data-oriented (pool array de 5000 `IEnemy`, AABB a mano,
> cero Phaser). **Análisis: NO conviene reescribir; SÍ conviene integrar la intención valiosa** en la
> arquitectura actual (Phaser). Abajo: qué se rechaza y por qué, y el plan real para Sonnet.

## Veredicto de arquitectura (por qué NO el rewrite a 5000/AABB)
El juego YA tiene una arquitectura de enemigos madura y muy acoplada:
- `Enemy extends Phaser.GameObjects.Rectangle` (cuerpo físico) + **sprite animado** que lo sigue, barra de HP,
  ~15 comportamientos especiales (printer fan, toxic zone, hr aura, auditor invencible, cleaning_lady polish,
  ally AI, bonus, badge delay, slow/stun/freeze, excel HP label…).
- **47 sitios** llaman a `EnemySystem` (`enemyPool`, `getNearestEnemy`, `damageInRadius`, `damageInLine`,
  `spawn`, `spawnBonus`, `killAll`, `getActiveCount`, `applySingularidadPull`, `hrSlowActive`…): armas,
  proyectiles (overlap Phaser), jefes/minibosses (apuntado + adds), reacciones de ítems (explosion_al_matar,
  meeting_overflow, avalancha), pickups, eventos de oleada, minimap.
- Combate por **overlap de Arcade** (proyectil↔enemigo, jugador↔enemigo, proyectil-enemigo↔jugador).

Reemplazar esto por structs planos + AABB a mano + pool de 5000 **rompería**: animaciones de sprite, todos los
overlaps de proyectiles/contacto, los 15 comportamientos, el apuntado de jefes, las reacciones de ítems, el
minimap y los 47 call-sites. Es una reescritura de semanas que **regresa todo el juego**.

Además **no se necesitan 5000 enemigos**: el diseño objetivo es hordas de ~cientos (swarm ×4 sobre budget ~20-40 =
~80-160). Phaser Arcade sostiene eso de sobra. El pool actual es 300 (subible a 500-800 si hace falta).

⮕ **DECISIÓN TOMADA (usuario): integrar en Phaser + optimizar el rendimiento para soportar ~1000 enemigos
activos (no 5000).** No reescritura data-oriented. cleaning_lady = **knockback + mantener rastro de pulido**.
Clusters densos OK (no separación, como pide la spec).

## TICKET 0 — Rendimiento para ~1000 enemigos (Phaser, sin rewrite)
Objetivo: 60 FPS con ~1000 enemigos activos. Optimizaciones contenidas:
- `COMBAT.ENEMY_POOL_SIZE 300→1000`.
- **Barras de HP**: hoy 2 rects por enemigo siempre visibles. Mostrarlas **solo si el enemigo está dañado**
  (`hp < maxHp`) o es élite/jefe (la mayoría de fodder muere de 1-2 golpes → casi nunca se dibuja). Ahorra
  ~2000 objetos visibles. (Mantener la sincronización solo cuando visible.)
- **Hot loops sin allocations**: `getActiveCount` usa `filter().length` (crea array cada llamada) → mantener un
  **contador** `activeCount` que se incrementa/decrementa en spawn/deactivate. `getNearestEnemy`/`damageInRadius`
  iteran `getChildren()` con índice (evitar `map/filter/forEach` que crean closures/arrays en el frame).
- **Culling por distancia** (ver Ticket 3) reduce el nº de activos lejos del jugador.
- Medir antes/después (FPS con ~500 y ~1000 spawneados). Si la animación de sprites es el cuello, considerar
  bajar el `frameRate` de walk o no animar fodder fuera de cámara (los culleados ya no animan).

## Lo que SÍ se integra (intención valiosa de la spec) — coincide con la revisión v3

### TICKET 1 — Perfiles de movimiento (arquetipos) por tipo + `knockbackResistance`
Añadir a `EnemyDefinition` un campo `archetype` (y `knockbackResistance` 0..1). Resolver el movimiento en
`Enemy.preUpdate` según arquetipo (hoy todos hacen tracking recto):
- **A Linear** (spam_email, angry_email, slack_ping): tracking directo `θ=atan2(...)` (actual). slack_ping ya +rápido.
- **B Oscilante** (stress_ball): tracking + offset **senoidal perpendicular** `sin(stateTimer*freq)*amp`.
  - `neg_balloon`: lento/tanque; **al morir deja un `DamageZone`** (negatividad) en vez de drop normal.
  - `zoom_bomb` (NUEVO): aparece fuera de pantalla, fija un punto cerca del jugador y hace un **dash diagonal**
    a alta velocidad atravesándolo, ignorando ajustes (no re-targetea durante el dash).
- **C Estático/distorsión** (possessed_printer ya dispara): mantener.
  - `cleaning_lady`: la spec la quiere **knockback** al jugador (empuja a las hordas) en vez de daño.
    DECISIÓN: conservar el **rastro de pulido** actual Y añadir knockback de contacto (o sustituir). Recomendado:
    knockback de contacto + daño bajo, mantener rastro como amenaza de zona.
  - `micromanager` (NUEVO): **aura circular**; si el jugador está dentro, sus armas tienen **+30% cooldown**
    (cadencia ×0.7). Leer un flag/area en WeaponSystem.
- **D Anillo** (hr_rep): spawnear en **formación de anillo** (polar `φ 0..2π`) y avanzar lento hacia adentro.
  - `rolodex`: columnas densas (formación) — opcional, simplificable a spawn agrupado.
- **E Juggernaut** (toxic_manager, auditor, angry_client): `knockbackResistance: 1.0` (inmunes a empuje).
  - `angry_client`: **acelera al bajar su HP** (rage): `speed = base*(1 + (1-hp/maxHp)*k)`.
  - `unpaid_intern` (NUEVO): tracker rápido, poca HP, va **por delante** de los jefes (absorbe disparos).

> `knockbackResistance` se aplica donde ya hay knockback (efecto `knockback` de proyectil + meeting_overflow):
> escalar el empuje por `(1 - knockbackResistance)`. (Hoy el knockback es mínimo; queda listo para el futuro.)

### TICKET 2 — Enemigos nuevos (3): `zoom_bomb`, `micromanager`, `unpaid_intern`
- Añadir ids a `EnemyType`, defs en `enemies.config` (hp/speed/damage/archetype/knockbackResistance), color
  placeholder en `ENEMY_COLOR`, y al `WAVE_UNLOCK_TABLE` (tier medio, oleadas 6+).
- Comportamientos: zoom_bomb (dash, Arquetipo B), micromanager (aura cooldown, C), unpaid_intern (tracker rápido, E).
- micromanager aura: zona/aura propia que el WeaponSystem consulta (como hr_rep slow pero sobre cadencia).

### TICKET 3 — Culling por distancia + reposición (densidad, perf-lite) — OPCIONAL
- Cada ~60 frames, recorrer enemigos activos: si `dist²(enemy,player) > DESPAWN_DIST²` (config, p.ej. 2000²) →
  `deactivate()` (reciclar al pool). Evita enemigos perdidos lejos del jugador en el mapa grande.
- **Reposición de densidad**: los reciclados se re-spawnean **por delante** del vector de movimiento del jugador
  (mantiene la horda alrededor en movimientos rápidos). Config `REPOSITION_AHEAD_PX`.
- Subir `ENEMY_POOL_SIZE` 300→600 si el swarm lo pide. (NO 5000.)

## Conflictos con la revisión v3 (resolver)
- La spec dice **"el solapamiento de enemigos es correcto, pueden fundirse en clusters"** → CONTRADICE la
  propuesta de *separación/anti-apilamiento* de la revisión v3. DECISIÓN: si se sigue la spec, **NO** añadir
  separación (clusters densos intencionales). (Recomiendo dejar clusters; es la dirección de diseño del usuario.)

## Rechazado explícitamente (no se hace)
- Pool array de 5000 `IEnemy` planos / cero-Phaser / `new` prohibido: el pool de Phaser ya es zero-alloc en runtime
  (reusa instancias). No se reescribe.
- Combate AABB a mano reemplazando overlaps de Arcade: rompería proyectiles/contacto/ítems. Se conserva Arcade.
- Decoupling render/lógica a mano: Phaser ya separa `preUpdate` (lógica) del render.

## Aceptación
- Cada arquetipo se mueve distinto (senoidal, dash, anillo, juggernaut inmune a empuje); 3 enemigos nuevos
  funcionan con sus comportamientos; (opcional) culling+reposición mantiene densidad sin enemigos perdidos.
- Sin romper sprites/overlaps/jefes/ítems/minimap. `npm run build` limpio.

## Notas para Sonnet
- Un ticket por sesión; build + reporte. No tocar el combate por overlap ni los sistemas acoplados.
- Arquetipo como dato en `EnemyDefinition`; el `switch(archetype)` vive en `Enemy.preUpdate` (un solo punto).
- Enemigos nuevos = placeholder de color (como los de Fase F) hasta tener arte.
