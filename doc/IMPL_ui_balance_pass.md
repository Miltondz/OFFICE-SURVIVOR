# PLAN — Pase de UI + balance + ajustes de mapa/tienda (Opus → Sonnet)

> Lote de ajustes pedidos por el usuario. Ejecutar con Sonnet en **3 tickets** (uno por sesión),
> `npm run build` limpio entre cada uno. Config-over-code, TS strict, sin `any`. No eliminar nada.

Estado verificado relevante:
- `playerUpgrades.config.ts`: `UP` con multiplicadores grandes (DAMAGE 1.12, SPEED 1.08, FIRERATE 1.10, RANGE 1.15, CRIT 0.08, DMG_TAKEN 0.88, XP 1.20, STRESS 0.85, PICKUP 30, HP_AMOUNT, REGEN 1, PROJECTILE_BONUS 1).
- `COMBAT.WEAPON_MAX_LEVEL = 3`.
- `MAP.SPRITE_H = { desk:46, cabinet:64, plant:54, coffee:56, vending:86, extintor:40 }`. Colliders usan `MAP.DESK/CABINET/PLANT` (w/h chicos); `solid` (bloquea jugador+enemigos) = desk/cabinet/vending; `plants` (solo enemigos) = plant; extintores aparte.
- `ENEMY_DISPLAY_H`: angry_client 40, auditor 58.
- HUD inventario: `INV_X 16, INV_Y 116, INV_SIZE 28, INV_GAP 5, INV_COLS 1`, `rebuildInventory()`.
- ShopOverlay (Fase D) NO dibuja descripción en las cards (se quitó). Soporta level-up de arma (`SUBIR NIV.`).
- Items nuevos E1/E2 (23) NO tienen icono cargado (no están en `ICON_IDS`) → el cofre del mapa cae al rect de color para ellos.
- `icons_items.png` (1536×818) = sheet de iconos pequeños, **orden frame→id desconocido** → NO usarlo directo (riesgo de mapeo). Usar las texturas `item_<id>` existentes a tamaño chico.
- Blackout: `WaveEventSystem` dibuja un rect oscuro + máscara circular (corte duro).
- Overlay de selección inicial = `UpgradeOverlay` (pick de arma al empezar), se dibuja sobre el HUD (timer y oleada arriba) → se solapa.

---

## TICKET 1 — Config rápida (upgrades, niveles de arma, tamaños mapa/enemigos, fallback de icono de drop)

### 1.1 Mejoras de personaje pequeñas e incrementales (`playerUpgrades.config.ts` `UP`)
Reducir magnitudes (documentar `// era X`):
```
DAMAGE_MULT 1.12→1.06, SPEED_MULT 1.08→1.04, FIRERATE_MULT 1.10→1.05,
RANGE_MULT 1.15→1.08, CRIT_BONUS 0.08→0.04, DAMAGE_TAKEN_MULT 0.88→0.94,
XP_MULT 1.20→1.10, STRESS_RISE_MULT 0.85→0.92, PICKUP_RANGE_BONUS 30→18,
HP_AMOUNT: bajar ~40% (leer su valor y reducir), REGEN_HP_PER_S 1→1 (ok), PROJECTILE_BONUS 1 (ok, entero).
```
Son acumulables y stackeables (se eligen varias veces) → deben sentirse incrementales, no enormes.

### 1.2 Niveles de arma hasta V comprando duplicados (`COMBAT.WEAPON_MAX_LEVEL 3→5`)
- El level-up de arma ya escala daño/cadencia por nivel (`WEAPON_LEVEL_DAMAGE_STEP`, `WEAPON_LEVEL_FIRERATE_STEP`). Con max 5, comprar la misma arma sube II→V.
- (La tienda ya muestra `SUBIR NIV.` para armas equipadas; ver Ticket 3 para no ofrecer armas ya maxeadas como nuevas.)

### 1.3 Tamaños de props del mapa (`MAP.SPRITE_H` + colliders)
- **Cafetera muy grande** → `coffee: 56→36`.
- **Escritorios un poco más grandes** → `desk: 46→56`; agrandar collider `MAP.DESK { w:64,h:32 }→{ w:78, h:40 }`.
- (Opcional) acercar colliders al tamaño visual para que choquen bien.

### 1.4 Más props detienen al jugador
- Hacer que la **cafetera** y la **planta** también bloqueen al jugador (hoy plant solo bloquea enemigos; coffee no tiene collider de jugador). Mover plant al grupo `solid` (o añadir collider jugador↔plants y jugador↔coffee). Mantener vending/desk/cabinet como están (ya solid).

### 1.5 Tamaños de enemigos (`ENEMY_DISPLAY_H`)
- **angry_client** (cliente furioso) más grande: `40→52`.
- **auditor** más chico: `58→46`.

### 1.6 Fallback de icono en drops del mapa (cofre 'item')
- Los items E1/E2 no tienen `item_<id>` → el cofre muestra rect naranja. **Fix:** si `item_<id>` no existe, usar un icono genérico de ítem (cargar uno: reusar `item_lapicero_roto` u otro existente como "genérico", o un nuevo `item_generic` copiando un png). El cofre NUNCA debe verse como cuadro de color liso.
- Mismo fallback aplica al panel de inventario (Ticket 2) y a la tienda (Ticket 3).

**Aceptación T1:** upgrades pequeñas; armas suben a V; cafetera chica, escritorios mayores y sólidos, planta/cafetera frenan al jugador; cliente más grande, auditor más chico; cofres siempre con icono. Build limpio.

---

## TICKET 2 — HUD: panel de stats (izquierda) + inventario en 2 columnas con iconos chicos

### 2.1 Panel de stats a la izquierda (`HUDScene`)
- Cuadro fijo (scrollFactor 0) en el borde izquierdo, bajo las barras de HP/stress, mostrando stats EN VIVO para apreciar las mejoras:
  - HP máx, Daño (×), Velocidad, Cadencia (×), Crítico (%), Proyectiles (+N), Rango (×), Daño recibido (×), Regen, Recogida.
  - Leer de `ctx.player` + `ctx.modifiers` (los mismos campos que tocan los upgrades). Actualizar cada frame o en `player:level_up`/`upgrade:*`.
- Estilo: panel semitransparente, fuente chica, una línea por stat (`Etiqueta: valor`).

### 2.2 Inventario vertical con 2ª columna (`HUDScene.rebuildInventory`)
- Mantener columna vertical de iconos (`INV_SIZE 28`). Calcular cuántos caben en la altura disponible; al llenarse, **continuar en una 2ª columna a la derecha** (no encimar). `INV_COLS` dinámico: filas por columna = floor(altoDisponible / (INV_SIZE+GAP)); col index = floor(i/filas).
- Iconos chicos = textura `item_<id>` existente a `INV_SIZE` (con fallback genérico del Ticket 1.6). NO usar `icons_items.png` (orden desconocido).
- Tooltips al hover ya existen — mantenerlos.

**Aceptación T2:** panel de stats refleja las mejoras al subir de nivel; el inventario crece a 2ª columna sin solaparse; iconos chicos con arte. Build limpio.

---

## TICKET 3 — Tienda (descripciones + armas) + overlay inicial + apagón radial

### 3.1 Descripciones en la tienda (`ShopOverlay.buildCard`)
- Re-agregar la **descripción** del ítem/arma en la card (se había quitado). Texto chico, wrap al ancho, debajo del tipo. Subir `CARD_H` lo necesario o reducir el icono levemente para que entre sin solapar el precio|comprar.
- Para armas: mostrar también qué hace el level-up ("Sube a nivel N: +daño/+cadencia").

### 3.2 Armas en la tienda: no duplicar, sí subir nivel hasta V
- NO ofrecer como **arma nueva** una que ya se tiene (hoy puede listarse). Si ya se tiene y `nivel < WEAPON_MAX_LEVEL(5)` → ofrecerla como `SUBIR NIV.` (ya existe el precio level-up). Si está al máximo (V) → NO ofrecerla.
- Revisar `generateStock`: gating de armas (`canAdd`/`canLevel`) acorde a max 5.

### 3.3 Overlay de selección inicial no se solapa con timer/oleada (`UpgradeOverlay`)
- El pick inicial de arma se dibuja sobre el HUD (timer en y≈14, oleada arriba). Bajar el contenido / añadir un **panel de fondo opaco** que cubra esa zona, o desplazar las cards hacia abajo para que el header del overlay no choque con el timer/oleada. Asegurar que el título del overlay quede por debajo de la franja del HUD superior.

### 3.4 Apagón con degradado radial (`WaveEventSystem` blackout)
- En vez de un círculo de corte duro: **degradado radial** centrado en el jugador — centro visible, anillos cada vez más oscuros hacia los bordes hasta negro total en el borde de pantalla.
- Implementar con un sprite/textura de gradiente radial (generar con `Graphics`/canvas: alfa 0 en el centro → alfa `BLACKOUT_ALPHA` en el radio), fijado a cámara (scrollFactor 0), siguiendo al jugador en pantalla. O varios anillos concéntricos con alfa creciente. Mantener `BLACKOUT_RADIUS`/`BLACKOUT_ALPHA` de config como referencia (centro despejado ≈ radius).

**Aceptación T3:** cards de tienda con descripción; armas no se duplican y suben a V; overlay inicial sin solापe con HUD; apagón con degradado suave. Build limpio.

---

## Notas
- `icons_items.png`: disponible pero requiere definir el mapa frame→id antes de usar. Por ahora usar `item_<id>` + fallback genérico.
- Tras cada ticket: build + reporte de archivos + checklist. No avanzar al siguiente sin OK.
