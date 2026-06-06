# PLAN MAESTRO — Expansión (mapa, oleadas, jefes menores, tienda, ítems)

> Analizado con Opus. Ejecutar con Sonnet **por fases, una a la vez**, con `npm run build` limpio
> y playtest manual entre fases. NO hacer todo de una. Cada fase asume las anteriores completas.
> Config-over-code, TS strict, sin `any`. Enemigos/jefes nuevos = **placeholders** (ver Apéndice P).

## Estado actual (verificado) y choques con la spec
- **No hay cámara con follow**: el juego es 1 pantalla 960×540, `bg_floor` estirado. `Player.update` clampa el cuerpo a `GAME.WIDTH/HEIGHT`. Objetos de `GameScene` (viñeta, popups, level-up) están en coords de pantalla → **al activar cámara hay que fijarles `setScrollFactor(0)` o moverlos al HUD**. HUD ya es escena aparte (ok).
- **Spawn de enemigos** (`SpawnDirector.getEdgeSpawnPos`) usa bordes de `GAME.WIDTH/HEIGHT` → con mapa grande debe usar el **viewport de la cámara** (`cameras.main.worldView`).
- **WAVES actual**: `BASE_ENEMIES 2`, `ENEMIES_PER_WAVE_MULTIPLIER 2.5`, `BOSS_WAVE 10`, sistema de **budget** (`BASE_BUDGET/BUDGET_GROWTH/ELITE_*`). La spec pide `BASE_ENEMIES 5`, mult 3, boss 13, 840s. Esto **revierte tuning balance v1** → documentar `// era X — razón`.
- **SHOP actual**: `ShopOverlay` ya tiene reroll (costo plano 15), `CARD_COUNT 4`, sin vender, sin timer, sin slot legendario. Precios `20/45/80/140`. La spec pide reroll escalable, vender, timer 20s, slot legendario, precios `10/25/60/150`, 3 cards.
- **Ítems**: 37 actuales con patrón `onPickup(PlayerState)→PlayerState`, `applyModifiers(RunModifiers)`, `onKill/onHit/onLevelUp`, y reactivos por EventBus en `ItemReactions`. `Projectile` ya tiene `pierceLeft/bounceLeft` (rebote factible). Varios ítems nuevos necesitan **campos nuevos en RunModifiers + sistemas** (ver Fase E2).
- **Jefes menores**: no existe framework; `CEOBoss` es el patrón a copiar (cuerpo invisible + sprite + fases + ataques + barra). Conviene una clase `MiniBoss` reutilizable.
- **Enemigos nuevos** (tier 1 spam/slack/stress ball/globo, drones, etc.): no están en `EnemyType`, `enemies.config`, ni `WAVE_UNLOCK_TABLE`.

## Orden recomendado (por dependencia)
A) Mapa + cámara → B) Sistema de oleadas (tipos + anuncios + tabla) → C) Jefes menores →
D) Tienda overhaul → E) Rediseño de ítems (E1 simples, E2 con motor) → F) Enemigos nuevos →
G) Minimap (opcional).

Cada letra = un ticket de Sonnet independiente y testeable.

---

## FASE A — Expansión de mapa + cámara
**Objetivo:** mapa 2880×1620 con cámara que sigue al jugador; bordes = paredes; obstáculos distribuidos.

### Config (`game.config.ts`)
```ts
// MAP: añadir
WIDTH: 2880, HEIGHT: 1620,
PLAYER_SPAWN_X: 1440, PLAYER_SPAWN_Y: 810,
OBSTACLE_COUNT_MIN: 25,  // era 8
OBSTACLE_COUNT_MAX: 35,  // era 12
OBSTACLE_GRID_CELL: 96,  // 1 obstáculo máx por celda
SPAWN_FREE_RADIUS: 200,  // zona libre alrededor del spawn
```
`GAME.WIDTH/HEIGHT` (960×540) siguen siendo el **viewport** (no tocar).

### Cambios
1. **`GameScene.create`** tras crear player:
   ```ts
   this.physics.world.setBounds(0, 0, MAP.WIDTH, MAP.HEIGHT);
   this.cameras.main.setBounds(0, 0, MAP.WIDTH, MAP.HEIGHT);
   this.cameras.main.startFollow(this.player.body, true, 0.1, 0.1);
   ```
2. **Fondo**: `bg_floor` ya no se estira a la pantalla. Opción simple: `this.add.tileSprite(0,0,MAP.WIDTH,MAP.HEIGHT,'bg_floor').setOrigin(0).setDepth(-10)` (o `carpet`/`wall` tile que ya están en `assets/map` opacos). Tilear, no estirar.
3. **Player**: spawnear en `MAP.PLAYER_SPAWN_X/Y` (hoy usa `GAME.WIDTH/2`). Cambiar el clamp de `Player.update` a `MAP.WIDTH/HEIGHT`. Pasar spawn por constructor o leer de MAP.
4. **Objetos screen-space → `setScrollFactor(0)`**: viñeta (`GameScene` ~L170), popup de level-up, cualquier overlay dibujado en `GameScene`. Verificar todos los `add.*` de GameScene que deban quedar fijos.
5. **MapSystem**: distribuir obstáculos en grid de `OBSTACLE_GRID_CELL` sobre `MAP.WIDTH/HEIGHT`, máx 1 por celda, excluir radio `SPAWN_FREE_RADIUS` del spawn. Cafetera/vending/extintores reposicionar a coords de mapa (no de pantalla). Colliders ya usan world bounds.
6. **Spawn de enemigos** (`SpawnDirector.getEdgeSpawnPos`): reemplazar por posición fuera del **viewport actual** pero dentro del mapa:
   ```ts
   const view = scene.cameras.main.worldView; // pasar scene o un getter
   // elegir lado, colocar a EDGE_MARGIN fuera de `view`, clamp a [0,MAP.WIDTH]×[0,MAP.HEIGHT]
   ```
   SpawnDirector necesita acceso a la cámara → inyectar `() => worldView` desde GameScene.

### Aceptación
- Cámara sigue al jugador; nunca se ven bordes salvo al chocar pared invisible.
- Enemigos aparecen fuera de cámara y entran; no escapan del mapa.
- Obstáculos repartidos sin clusters; spawn del jugador despejado.
- HUD/viñeta/popups fijos en pantalla. Build limpio.

### Riesgos
- Objetos olvidados sin `scrollFactor(0)` (se "despegan"). Revisar GameScene entero.
- DamageZone/pickups usan coords de mundo (ya ok). Verificar `data.set('playerX/Y')` sigue en mundo (sí).

---

## FASE B — Sistema de oleadas mejorado (tipos + anuncios + tabla)
**Objetivo:** oleadas con personalidad (normal/swarm/elite_only/bonus/miniboss/boss), anuncios y secuencia fija de 13.

### Config (`game.config.ts`)
```ts
// WAVES: ajustar
BASE_ENEMIES: 5,     // era 2 (spec expansión)
ENEMIES_PER_WAVE_MULTIPLIER: 3,
BOSS_WAVE: 13,       // era 10
RUN_DURATION_S: 840, // 14 min (era 600) — ajustar el timer del HUD
```
Nueva tabla de tipos por oleada (1..13) en config o en SpawnDirector:
```ts
type WaveType = 'normal'|'swarm'|'elite_only'|'bonus'|'miniboss'|'boss';
WAVE_SEQUENCE: Record<number, WaveType> // 1 normal,2 swarm,3 normal,4 bonus,5 miniboss,
// 6 normal,7 elite_only,8 swarm,9 miniboss,10 normal,11 elite_only,12 miniboss,13 boss
WAVE_MINIBOSS: { 5:'supervisor', 9:'printer_industrial', 12:'committee' }
```

### Cambios `SpawnDirector`
- Leer `WAVE_SEQUENCE[wave]` en `beginWave`; ramificar `buildSpawnQueue` por tipo:
  - **normal**: actual.
  - **swarm**: cantidad ×4, solo enemigos con `hp ≤ 30`, spawnear todos desde 4 lados ~a la vez (spawnTimer mínimo).
  - **elite_only**: solo élites, budget reducido.
  - **bonus**: enemigos `isBonus` (ver abajo), 20s y desaparecen.
  - **miniboss**: no cola normal; emitir `miniboss:spawn` con el id (Fase C lo instancia) + algunos escorts.
  - **boss**: como hoy (CEO).
- `beginNextWave`: boss en `wave >= 13`. Mantener modo infinito (IPO).

### Anuncios de oleada
- Emitir `wave:announce { type, wave }` al iniciar cada oleada.
- HUD: banner 2.5s centrado, color/texto/emoji por tipo (normal blanco, swarm "⚡ AVALANCHA" amarillo, elite "💀 OLEADA ÉLITE" rojo, bonus "💰 LLUVIA DE DINERO" dorado, miniboss "⚠ JEFE MENOR" naranja pulsante).

### Enemigo bonus (`Enemy`)
- Flag `isBonus`: `setDamage(0)` (sin daño por contacto → no aplicar contact damage en GameScene), al morir suelta monedas ×2 (usar pickup `moneda` o sumar coins). Auto-despawn a los 20s.
- Indicador visual: monedas flotando (reusar efecto `coin` en loop suave o tint dorado).

### Eventos especiales (se mantienen)
- `WaveEventSystem` sigue: cada 3 oleadas, evento ADEMÁS del tipo (no en vez de). Verificar que no choque con miniboss/bonus.

### Aceptación
- Cada oleada anuncia su tipo; swarm/elite/bonus se comportan distinto; minibosses disparan su evento; boss en 13.
- Bonus no daña y da monedas; desaparece a 20s. Build limpio.

### Riesgos
- `RUN_DURATION_S` y timer del HUD: sincronizar (hoy 600). Buscar usos de la duración.
- Swarm con muchos enemigos: vigilar `ENEMY_POOL_SIZE` (300) — suficiente.

---

## FASE B2 — Balance de oleadas tempranas / pacing (pedido)
**Problema reportado:** las primeras oleadas duran demasiado; se sube de nivel **varias veces** antes de
terminar la oleada 1. La progresión debe ser **gradual**: pocas/cortas al inicio, creciendo con la oleada.

### Causa (verificada)
- `SpawnDirector` usa el **sistema de budget**, NO `WAVES.BASE_ENEMIES`. Oleada 1 = `BASE_BUDGET(8) + round(1×BUDGET_GROWTH 5) = 13` enemigos → demasiados para la W1, y la oleada no termina hasta matarlos todos.
- La curva de XP da varios niveles en la W1 (demasiada XP por kill / requisito bajo al inicio).
- **Reconciliar**: decidir qué gobierna la cantidad — `BASE_ENEMIES`/secuencia (Fase B) **o** el budget. Recomendado: **una sola fórmula de cantidad por oleada** y derivar el budget de ella (evitar dos sistemas en conflicto).

### Dials a ajustar (`WAVES` + `PROGRESSION`)
```ts
// Cantidad progresiva: pocas al inicio, creciente.
BASE_BUDGET: 4,          // era 8 — W1 corta
BUDGET_GROWTH: 3,        // era 5 — crecimiento más suave
// (o reemplazar por: enemigos(w) = round(BASE_ENEMIES + (w-1)*STEP) con STEP pequeño)
SPAWN_INTERVAL_BASE: 0.35, // era 0.5 — la W1 se llena/limpia antes
// XP: que la W1 dé ~0-1 nivel, no 3-4.
// Subir XP_BASE o el exponente para que los primeros niveles cuesten más,
// y/o bajar la XP por kill temprana. Re-tunear PROGRESSION.XP_BASE/XP_EXP/XP_KILL_MULT.
```
> Números exactos = **iterar con playtest** (este ticket es de tuning). Documentar `// era X — razón`.

### Objetivo medible (aceptación)
- **Oleada 1 ≈ 15–25s** y **≤ 1 subida de nivel**.
- Cantidad de enemigos por oleada **crece monótonamente** (W1 << W6 << W10).
- El jugador no "farmea" niveles en una sola oleada temprana.
- Curva sigue sintiéndose progresiva hasta el CEO (W13). Build limpio.

### Riesgos
- Tocar XP afecta el ritmo de toda la run (no solo la W1) → revisar que las oleadas medias no queden vacías de niveles.
- Coordinar con Fase B (tipos de oleada): swarm sigue siendo ×4 sobre la **nueva** cantidad base.

---

## FASE C — Jefes menores (3) — placeholders
**Objetivo:** Supervisor General (W5), Impresora Industrial (W7→ahora W9), Comité de Evaluación (W12).
> Spec sitúa Impresora en W7 en una tabla y W9 en otra; **usar la tabla definitiva: W9**. (Decisión.)

### Framework
- Clase `MiniBoss` (en `src/entities/`) inspirada en `CEOBoss`: cuerpo físico, sprite/placeholder, HP propio, fases, ataques con cooldown, barra de HP (reusar la del HUD `bossBarContainer` o una flotante), drop garantizado al morir, emite `miniboss:defeated`.
- GameScene escucha `miniboss:spawn { id }` → instancia la subclase/config correspondiente; al `miniboss:defeated` → continúa intermission/tienda.
- Config `MINIBOSS` en `game.config.ts` (hp, size, cooldowns, drops por id).

### C.1 Supervisor General (W5) — placeholder
HP 600, 80×80. Ataques: Grito Sónico (onda que empuja 120px, cd3s), Patada (dash + knockback, cd5s), ¡Reunión! (invoca 4 angry_email desde esquinas, cd8s), Fase2 <50% Megáfono Total (onda con gap central, cd6s). Drop: 1 ítem Raro + 40 monedas.

### C.2 Impresora Industrial (W9) — placeholder/escala
HP 900, 96×96. Reusar sprite `possessed_printer` escalado ×?? como placeholder. Ataques: Tornado de Papel (8 papeles girando, cd5s), Chorro de Tinta (arco + mancha DPS 5/5s, cd4s), Muro de Papel (línea con gap 80px, cd7s), Fase2 <40% Papel Infinito (8 dir cada 1.5s). Drop: 1 Épico + 60.

### C.3 Comité de Evaluación (W12) — sin sprite nuevo
3 Auditores (reusar sprite) con **tints** `0x111111/0x888888/0xDDDDDD`, HP compartido 900 (300 c/u). Al morir uno: los otros +30% daño/+20% velocidad + dash de rabia. Cada 10s carga coordinada. Barra = total. Drop: 1 Épico + 80.

### Aceptación
- Cada miniboss aparece en su oleada, ataca según patrón, suelta su drop, y el flujo continúa a la tienda. Build limpio.

### Riesgos
- Mucha lógica nueva de ataques (ondas, dash, mancha de tinta). Reusar `DamageZone` (manchas) y proyectiles existentes.
- Barra de HP del jefe: decidir flotante vs HUD. Reusar `bossBarContainer` (un jefe a la vez).

---

## FASE D — Tienda overhaul
**Objetivo:** reroll escalable, vender ítem, timer 20s, slot legendario, precios spec, 3 cards.

### Config (`SHOP`)
```ts
CARD_COUNT: 3,            // era 4
REROLL_BASE_COST: 5, REROLL_COST_INCREMENT: 5,   // reemplaza REROLL_COST plano
SELL_REFUND_RATIO: 0.5, MAX_SELLS_PER_SHOP: 1,
TIMER_SECONDS: 20,
LEGENDARY_CHANCE: 0.2, LEGENDARY_MIN_WAVE: 5, LEGENDARY_COST: 150,
PRICES: { common:10, rare:25, epic:60, legendary:150 },  // ajustar priceFor()
```

### Cambios `ShopOverlay`
- **Reroll escalable**: contador `rerollCount`; costo = `BASE + count*INCREMENT`; mostrar costo actual.
- **Vender**: botón "VENDER ÍTEM" → modo selección → click en ítem del inventario del jugador → reembolsa `floor(precioCompra*0.5)`; máx 1/tienda. Requiere registrar el precio de compra por ítem (o derivar de rareza). Quitar el ítem del inventario + `recomputeModifiers`.
- **Timer 20s**: barra que se vacía arriba; al llegar a 0 → `closeShop()`. Mantener ESC y "CONTINUAR".
- **Slot legendario**: en tiendas de oleada ≥5, 20% prob. de un 4º slot con ítem legendario a 150.
- Precios desde `SHOP.PRICES` (actualizar `priceFor`).

### D.2 — Rareza proporcional + precio dinámico (refinamiento pedido)
**Problema:** los ítems legendarios/épicos deben aparecer con una frecuencia acorde a lo especial que son,
y el precio debe variar acorde (no precio plano por rareza solamente).
- **Frecuencia ponderada por rareza**: la generación de stock ya usa `RARITY_WEIGHTS` (común 60 / raro 28 / épico 10 / leg 2).
  Reforzar: los épicos/legendarios solo entran al pool desde su `*_MIN_WAVE` (gates ya existen) y mantienen su peso bajo,
  de modo que un legendario en los 3 slots normales sea **raro** (el slot legendario fijo del 20% es la vía principal).
- **Precio dinámico** = precio base por rareza (`SHOP.PRICES`) × factor de escala suave por oleada:
  ```ts
  precio = round(PRICES[rarity] * (1 + (wave-1) * SHOP.PRICE_WAVE_SCALE))   // SHOP.PRICE_WAVE_SCALE ~ 0.06
  ```
  Así los ítems "más difíciles" (que solo salen en oleadas altas) cuestan más, y un mismo común sube un poco con el avance.
  El slot legendario mantiene su precio fijo `LEGENDARY_COST` (o también escalado — decisión: fijo).
- Mostrar el precio ya escalado en la card. Vender reembolsa `floor(precioMostrado * SELL_REFUND_RATIO)`.
- Config: `SHOP.PRICE_WAVE_SCALE: 0.06`.

### D.3 — Ritmo de adquisición de ítems (pedido)
**Problema reportado:** es demasiado fácil acumular ítems desde el inicio (≈10 ítems activos en las primeras
oleadas) → cada ítem pierde peso/efecto. Hay que **frenar** la adquisición temprana y hacerla una decisión.

Combinar varias palancas (recomendado, no una sola):
1. **Límite de ítems pasivos (slots)** — como las armas (máx 4):
   ```ts
   COMBAT.MAX_PASSIVE_ITEMS: 6   // tope de ítems pasivos equipados
   ```
   Al estar lleno, comprar exige **vender/descartar** uno (enlaza con "Vender ítem" de D). Los consumibles (café,
   galleta) NO cuentan. Hace que cada slot importe. (Decisión: empezar con tope 6, ajustable.)
2. **Economía temprana más dura** (ya parcialmente en D.2 precio dinámico + B2):
   - Menos monedas en oleadas tempranas (escalar `ECONOMY` por oleada o bajar drops base).
   - Precio base ya escalado por oleada (D.2) → en W1-2 alcanza para ~1 ítem, no 4-5.
3. **Menos oportunidades de compra al inicio** (opción): tienda cada oleada está bien, pero con **1 sola compra
   por tienda en oleadas tempranas** o stock más caro. (Decisión recomendada: NO limitar compras por tienda;
   dejar que el tope de slots + economía hagan el trabajo, más orgánico.)
4. **Drops del mapa / vending**: revisar que el vending automático y los `item`/`upgrade` pickups no regalen
   ítems gratis demasiado seguido en oleadas tempranas (subir intervalos/costos al inicio).

> Objetivo de diseño: en las primeras 3 oleadas el jugador debería tener **2-3 ítems**, no 8-10; cada compra
> es una elección con coste de oportunidad.

### Aceptación
- En W1-3 el jugador termina con ~2-3 ítems pasivos (no 8-10).
- Con el inventario lleno (tope de slots), comprar requiere vender/descartar.
- Legendarios casi nunca salen en los 3 slots normales; aparecen sobre todo vía el slot especial (20%, W5+).
- El precio sube de forma progresiva con la oleada; ítems de rareza alta cuestan claramente más.
- Reroll sube de precio; vender reembolsa 50% (1×); timer cierra a 0. Build limpio.

### Riesgos
- "Precio de compra" para vender: derivar del precio mostrado (con escala) al comprar; simple guardarlo por ítem o recomputar.
- Pausa/escala de tiempo con el timer (la tienda corre con GameScene pausada; usar timer propio de la escena overlay, real-time).

---

## FASE E — Rediseño de ítems
**Objetivo:** quitar 5 aburridos, añadir ~22 nuevos. Dividir en E1 (config-only) y E2 (requiere motor).
> Mantener IDs inglés snake_case + nombres/desc español. Actualizar `ICON_IDS`/iconos (placeholder genérico si falta arte).

### NO eliminar (decisión usuario)
**No se elimina ningún ítem ni habilidad existente — SOLO añadir.** Ignorar la lista original de "quitar 5".
Los ítems nuevos conviven con los actuales (37 + nuevos).

### E1 — Ítems que SOLO usan patrones existentes (onPickup/applyModifiers/onKill/onHit + reactivos)
Implementables sin tocar el motor (o con campos triviales en RunModifiers):
- **triple_espresso** (común): al recoger cualquier pickup → +25% vel 8s (hook `pickup:collected`).
- **taza_grande** (común): +20 HP máx; café ×1.5 (onPickup + hook café).
- **sello_de_goma** (común): cada 5 kills, siguiente proyectil ×3 daño (contador + flag en WeaponSystem).
- **grapadora_turbo** (común): Stapler Gun dispara ráfaga de 3 (mod específico del arma en WeaponSystem).
- **pelota_stress** (común): 30% de anular daño por hit (en `Player.takeDamage`, roll).
- **combustible_rage** (raro): cada hit recibido +5% daño 10s, stack ×3 (hook `player:hit`).
- **imán_de_monedas** (raro): radio de recogida ×4 + atracción (PickupSystem: mover monedas hacia player).
- **doble_disparo** (raro): 25% de disparar 2 proyectiles (WeaponSystem roll).
- **escudo_grapas** (raro): absorbe 1er hit de cada oleada (flag por oleada en Player/ctx).
- **cadena_de_kills** (épico): kills sin recibir daño → +2% daño acumulativo, reset al recibir daño (hooks kill/hit).
- **explosion_al_matar** (épico): al matar élite → AoE 150px por 50% del HP del élite (hook `enemy:killed` isElite → `enemySys.damageInRadius`).
- **modo_dios_temporal** (legendario): cada 60s, 3s invencible + daño ×5 (timer + flags; HUD countdown).
- **ultimo_cartucho** (legendario): ≤20% HP → cadencia ×3 (flag dinámico leído por WeaponSystem).

### E2 — Ítems que requieren NUEVO motor (planear hooks)
- **rebote_de_pared** (raro): proyectiles rebotan en bordes del mapa. `Projectile` ya tiene `bounceLeft`; falta colisión con world bounds que decremente y refleje velocidad. Con Fotocopiadora → 3 rebotes.
- **cable_trampa** (común): al entrar enemigo en radio 80px → stun 0.8s, cd3s (nuevo emisor de zona/aura desde el player).
- **cronometro_bala / bala_de_tiempo** (raro): 1×/run, ralentiza el tiempo al 30% 5s, el jugador normal (manipular `time.timeScale`/`physics.world.timeScale` + compensar velocidad del player).
- **teletransporte** (épico): a 25% HP → teleport a posición random del mapa, cd30s.
- **magnetismo_balas** (épico): proyectiles se curvan al enemigo más cercano (steering en `Projectile.preUpdate` o WeaponSystem; necesita acceso a enemigos).
- **segundo_corazon** (épico): 2ª barra de 50 HP oculta, se activa a 0 (campo en PlayerState + lógica en takeDamage + HUD).
- **fotocopiadora_armas** (épico): 1×/run duplica el arma con más kills (segunda instancia de arma en WeaponSystem; tracking de kills por arma).
- **singularidad** (legendario): cada 30 kills, agujero negro 3s que atrae+daña (nueva entidad/zona con pull).
- **avalancha** (legendario): cada proyectil genera uno secundario (50% daño) al impactar (hook de impacto en WeaponSystem que dispara sub-proyectil).

**Sub-fases sugeridas:** E1 (un ticket), luego E2 dividido por sistema:
E2a proyectiles (rebote, magnetismo, avalancha), E2b player/HP (segundo_corazon, teletransporte, escudo), E2c tiempo (bala_de_tiempo, modo_dios), E2d zonas (cable_trampa, singularidad), E2e armas (fotocopiadora_armas, grapadora_turbo, doble_disparo).

### Aceptación (por sub-ticket)
- Cada ítem hace lo que dice, aparece en pool/tienda con su rareza, no rompe `recomputeModifiers`. Build limpio.

### Riesgos
- `recomputeModifiers` se reconstruye desde cero: los efectos que mutan `modifiers` deben re-aplicarse (patrón `playerUpgradeIds`). Campos nuevos de RunModifiers → inicializarlos.
- Time-scale items pueden chocar con la muerte del boss (ya manipula timeScale).

---

## FASE F — Enemigos nuevos (placeholders)
**Objetivo:** poblar tiers nuevos de la tabla (spam, slack, stress_ball, neg_balloon, pasante, dron, carrito_cafe, rolodex, zombie, ojo_corporativo, fantasma, araña, nube, reloj, fax…).
- Añadir ids a `EnemyType` (types) + `enemies.config` (stats) + `WAVE_UNLOCK_TABLE`.
- **Placeholders** (Apéndice P): cada uno una figura simple distinta (forma/color) hasta tener arte.
- Respetar `hp ≤ 30` para los elegibles a swarm.
> Definir stats con el Game Bible / spec; los que no tengan stats, valores razonables y `// placeholder`.

### Aceptación
- Aparecen en sus oleadas, placeholder distinguible, no rompen budget/swarm. Build limpio.

---

## FASE G — Minimap (opcional)
- Rect 120×70 esquina inferior-derecha (HUD, scrollFactor 0). Punto blanco=jugador, rojos=enemigos en pantalla. Sin revelar todo el mapa. Escala MAP→minimap.

---

## FASE H — Opciones de pantalla + accesibilidad
**Objetivo:** ajustes de display/accesibilidad persistidos, replicando el patrón de volúmenes ya existente.
Independiente de A–G (se puede hacer en cualquier momento). NO cambiar la resolución base 960×540.

### Estado actual (verificado)
- Settings viven en `SaveManager` (`DEFAULTS.settings` con `musicVolume/sfxVolume/uiVolume`; migración v1→v2 ya contempla settings). Interfaz `SaveData.settings` en `types/index.ts`.
- UI de opciones = overlay en `MainMenuScene` (sliders de volumen). Hay `PauseScene` (ESC en juego) → exponer ahí también si es fácil.
- `main.ts`: `new Phaser.Game(config)` con `pixelArt: true` + bloque `scale`.
- `ScreenShake.play` usa `SHAKE[preset].intensity`. `DamageNumbers` clase propia. Viñeta = `GameScene.updateVignette`.

### Settings nuevos (`types/index.ts` + `SaveManager` DEFAULTS)
```ts
// SaveData.settings +=
fullscreen: boolean;    // default false
zoom: number;           // 0 = auto/FIT, 1..3 = setZoom ; default 0
smoothing: boolean;     // true = LINEAR (se aplica al boot) ; default false
screenShake: number;    // 0..1 multiplicador ; default 1
vignette: boolean;      // default true
damageNumbers: boolean; // default true
```
Subir `CURRENT_VERSION` (a 3) y extender la migración (mezclar defaults sobre settings viejos — el merge `{...DEFAULTS.settings, ...d.settings}` ya cubre claves faltantes; verificar).

### Aplicación de cada ajuste
1. **Smoothing (nitidez)**: se fija en `main.ts` ANTES de `new Phaser.Game` leyendo el setting guardado
   (`render: { pixelArt: !smoothing, antialias: smoothing }`). **No** cambiar en caliente → en la UI mostrar
   "se aplica al reiniciar". `main.ts` debe leer `SaveManager.load().settings.smoothing` antes de construir el config.
2. **Pantalla completa**: `this.scale.toggleFullscreen()` desde la UI; guardar estado. Re-aplicar en boot/MainMenu
   `if (settings.fullscreen && !this.scale.isFullscreen) this.scale.startFullscreen()` (requiere gesto del usuario;
   aplicar en el primer click del menú si hace falta).
3. **Zoom**: `this.cameras.main.setZoom(n)` para 1..3; `0` = dejar el `Scale.FIT`/auto actual. Aplicar en `GameScene.create`
   (y MainMenu si se quiere). Escala el render, no las coordenadas.
4. **Screen shake (0..1)**: `ScreenShake` lee el multiplicador del setting y lo aplica a `intensity` (y/o `ms`).
   Inyectar el valor (constructor o getter de SaveManager). `0` = sin sacudida.
5. **Viñeta/flash burnout (on/off)**: `GameScene.updateVignette` respeta `settings.vignette` (si false, no mostrar).
6. **Números de daño (on/off)**: `DamageNumbers.show` (o el caller en GameScene) respeta `settings.damageNumbers`.

### UI (overlay de opciones en `MainMenuScene`, y si cabe en `PauseScene`)
- Junto a los sliders de volumen, añadir:
  - Toggle **Pantalla completa**.
  - Selector **Zoom**: Auto · ×1 · ×2 · ×3.
  - Toggle **Nitidez**: Pixel art ↔ Suavizado (+ leyenda "se aplica al reiniciar").
  - Slider **Sacudida** 0–100%.
  - Toggle **Viñeta de estrés**.
  - Toggle **Números de daño**.
- Persistir con `SaveManager.save()` (mismo patrón que volúmenes). Aplicar el efecto inmediato donde aplique
  (fullscreen/zoom/shake/vignette/damageNumbers); smoothing solo persiste + aviso.

### Aceptación
- Cada ajuste persiste entre sesiones; fullscreen/zoom/shake/vignette/damage-numbers surten efecto en vivo;
  smoothing se aplica tras reiniciar. Defaults correctos. Build limpio. NO se tocó la resolución base.

### Riesgos
- Fullscreen necesita gesto de usuario (no se puede forzar en boot sin click).
- `setZoom` con `Scale.FIT`: confirmar que conviven (zoom 0 = no tocar). Probar ×2/×3 no recorten HUD.
- Leer SaveManager en `main.ts` antes de crear el juego (orden de imports).

---

## Apéndice P — Placeholders (mientras no haya arte)
Phaser no carga SVG como spritesheet directo. Recomendado para enemigos/minibosses nuevos:
- **Textura generada por código**: `Graphics` → `generateTexture(key,w,h)` con forma/color por tipo
  (círculo, rombo, triángulo, etc.) + inicial de texto encima. Se cablea como cualquier textura.
- Alternativa: rect/círculo de color directo (como el `Enemy` original) con tint por tipo.
- Mantener el patrón actual: si `textures.exists('enemysheet_<id>')` usa sprite; si no, placeholder.
- Los minibosses: placeholder grande con color propio + etiqueta, hasta generar las hojas (prompts ya en la spec).

## Backlog de balance (de la auditoría — diferido a un pase de balance)
- **cronometro_bala** ralentiza también al jugador (usa `time.timeScale` global sin compensar `player.speed`). Debería: el jugador se mueve normal durante los 5s. Compensar velocidad del player ×(1/CRONO_TIME_SCALE) mientras dura.
- **swarm** solo genera `angry_email` (único enemigo con hp ≤ `SWARM_HP_THRESHOLD 30`). Añadir enemigos chicos (Fase F) o subir el umbral para avalanchas variadas.
- **Bonus (W4)**: los enemigos dorados aún dan XP y pueden soltar ítem/upgrade. Diseño: "solo monedas ×2". Gatear XP y drops para enemigos `isBonus`.
- **CEO (W13)** no emite `wave:announce` (va por el gate de jefe en `beginNextWave`, no `beginWave`) → sin banner "OLEADA"/boss. La barra de jefe sí aparece. Emitir announce si se quiere banner.
- **rebote_de_pared**: presupuesto total = 2 (1 base + fotocopiadora). Spec pedía "hasta 3". Subir `ITEMS_E2.REBOTE_BASE_BUDGET` a 2 si se desea.
- **explosion_al_matar**: daño fijo (~75) porque `EnemyKilledPayload` no lleva el maxHp del élite. Para daño proporcional real, añadir `maxHp` al payload.
- Código muerto inofensivo: `ScreenShake.setIntensityMult`, `DamageNumbers.setEnabled` (setters live no usados).

## Backlog / notas (no en estas fases, pendiente futuro)
- **Mejorar la IA de los enemigos.** Hoy todos hacen lo mismo: persiguen al jugador en línea recta
  (`Enemy.preUpdate`: ángulo directo + `setVelocity`). Falta variedad/comportamiento por tipo, p.ej.:
  separación/anti-apilamiento entre enemigos (boids/steering), enemigos a distancia que mantienen rango y
  disparan, flanqueo/rodeo en vez de línea recta, telegrafía de embestidas, patrones por arquetipo
  (rusher / ranged / tank / orbitador). Definir en un ticket aparte cuando se aborde.

## Notas de ejecución para Sonnet
- Una fase por sesión; `npm run build` (0 errores) + reporte de archivos tocados + checklist de aceptación.
- No auto-avanzar a la siguiente fase. No inventar mecánicas fuera de esta spec.
- Documentar cambios de balance inline (`// era X — razón`).
- Tras Fase A, revisar TODO `GameScene` por objetos screen-space sin `scrollFactor(0)`.
```
