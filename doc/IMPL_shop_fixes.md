# PLAN — Arreglos Tienda + fin de oleada (ejecutar con Sonnet)

Objetivo: la tienda entre oleadas es la ÚNICA forma de adquirir items/armas con monedas.
Subir de nivel da SOLO mejoras de stats (player upgrades). Arreglar layout y solapes de la tienda y del HUD.

NO inventar mecánicas nuevas. Config-over-code: números nuevos a `game.config.ts` (sección SHOP) cuando aplique.
Verificar con `npm run build` (0 errores TS) al final.

---

## Bug 1 — Doble selección por oleada (item overlay + tienda)

**Causa:** al subir de nivel por XP, `LevelSystem.openUpgradeOverlay()` abre el overlay de items/armas
(`playerUpgradeMode=false`) porque `nextIsStatUpgrade` queda en false. Eso duplica la tienda.

**Decisión de diseño:** subir de nivel = SOLO mejoras de stats. Items/armas SOLO en la tienda.

**Fix (archivo `src/systems/LevelSystem.ts`, método `openUpgradeOverlay`):**
Calcular `statUpgrade` así:
```ts
const statUpgrade = this.nextIsStatUpgrade || !weaponsOnly;
```
- XP level-up (weaponsOnly=false, nextIsStatUpgrade=false) → stat overlay ✓
- Pick de arma inicial (weaponsOnly=true) → overlay items/armas ✓ (se conserva)
- Map drop `grantUpgrade(false, true)` → stat overlay ✓

No tocar a los callers (GameScene:155/157 weaponsOnly, GameScene:428 stat).

---

## Bug 2 — HUD visible bajo la tienda (monedas dobles, "MÁQUINA EXPENDEDORA" sobre texto superior)

La tienda es una escena modal sobre GameScene pausada, pero `HUDScene` sigue renderizando
(monedas arriba-der, stress, nivel…). Eso causa monedas dobles y textos encimados.

**Fix A — emitir apertura:** en `ShopOverlay.create()`, al inicio, `this.ctx.bus.emit('shop:opened', {})`.
(El cierre ya emite `shop:closed` en `closeShop()`.)

**Fix B — HUD se oculta:** en `HUDScene` (donde se registran los `bus.on`, junto a boss events ~línea 223):
```ts
bus.on('shop:opened', () => this.scene.setVisible(false));
bus.on('shop:closed', () => this.scene.setVisible(true));
```
Así el HUD desaparece mientras la tienda está abierta y vuelve antes del countdown (que lo dibuja el HUD).

---

## Bug 3 — Rediseño de ShopOverlay (`src/scenes/ShopOverlay.ts`)

Mantener toda la lógica de stock/compra/reroll. Solo cambiar **layout** y **controles**.
Con el HUD oculto (Bug 2) ya no hay choque con barra de stress.

### 3.1 Constantes (arriba del archivo)
```ts
const CARD_W = 150;
const CARD_H = 196;
const CARD_GAP = 16;
const CARD_TOP = 92;        // y superior de las cards (debajo del header)
```

### 3.2 Header (en `create`)
- Panel título centrado arriba (ya existe) — dejar en y≈6, alto 40.
- "Oleada N completada" en y≈52 (ya existe, mantener).
- Monedas: mantener `coinLabel` arriba-der (W-16, 16). Ahora es la ÚNICA (HUD oculto).

### 3.3 Cards (`buildCards`)
- `cardY = CARD_TOP` (en vez de 80).
- Centradas horizontalmente (cálculo actual ok).

### 3.4 `buildCard` — layout vertical explícito con regiones (CARD_W=150, CARD_H=196)
Origen del container en esquina sup-izq de la card (igual que ahora, panel en 0,0). `cx = CARD_W/2`.

Orden de arriba hacia abajo:
1. **Rareza** (y=6): fontSize 9, color por rareza, origin(0.5,0).
2. **Icono ARRIBA**: cuadrado, `iconSize = 64`. Dibujar centrado en `x=cx`, `y = 20`, origin(0.5,0).
   `setDisplaySize(iconSize, iconSize)`. (Si no existe textura, rect placeholder + símbolo, mismo tamaño/posición.)
   Región icono ocupa y≈20..84.
3. **Nombre** (y=88): fontSize 12 bold, wordWrap width CARD_W-12, align center, origin(0.5,0). Máx 2 líneas.
4. **Tipo** (debajo del nombre, y dinámico = nombre.y + nombre.height + 2): fontSize 8, color #8a8aa0.
   Valores: 'SUBIR NIV.' si arma ya equipada, 'ARMA' si arma, o category.toUpperCase() si item.
5. (OMITIR la descripción larga — no cabe y causa solape. NO dibujar descripción en la card.)
6. **Fila inferior precio | comprar** (lado a lado), a `rowY = CARD_H - 24`:
   - Mitad izquierda = **precio**: panel pequeño en x∈[6 .. CARD_W/2-3], alto 20, centrado en `x=CARD_W*0.27`.
     Texto `🪙 N`, verde si alcanza / rojo si no.
   - Mitad derecha = **COMPRAR**: panel en x∈[CARD_W/2+3 .. CARD_W-6], alto 20, centrado en `x=CARD_W*0.73`.
     Texto 'COMPRAR'. Hit zone interactiva solo si `canAfford` (igual que ahora) cubriendo la mitad derecha.
   - Ambos paneles MISMA altura/baseline; NO superpuestos (separados por el centro).

Asegurar que ningún texto se dibuje sobre el icono: el icono termina en y≈84 y el nombre empieza en y=88.

### 3.5 Slots de armas equipadas (`buildWeaponSlots`) — agrandar
- `slotSize = 44` (era 24), `gap = 10`.
- `slotY = GAME.HEIGHT - 70`.
- Label 'ARMAS EQUIPADAS:' en `slotY - slotSize/2 - 12`, fontSize 11.
- Icono dentro del slot: `setDisplaySize(slotSize - 8, slotSize - 8)` (los iconos son cuadrados → sin distorsión).
- Borde más visible (stroke 2).

### 3.6 Botones inferiores (`buildButtons`) — mantener, pero asegurar visibles
- REROLL y SIGUIENTE OLEADA en `btnY = GAME.HEIGHT - 26`. Verificar que no chocan con los slots (slots en H-70, botones en H-26: ok).

### 3.7 Control salir con teclado
En `create()`, agregar:
```ts
this.input.keyboard?.once('keydown-ESC', () => this.closeShop());
```
(Una sola salida; `closeShop()` ya hace stop+resume+emit+onDone.)

---

## Verificación
1. `npm run build` → 0 errores TS.
2. Manual (lo hace el usuario): al terminar una oleada NO debe pedir elegir item antes de la tienda
   (solo pide stats si subió de nivel). La tienda muestra cards con icono arriba, nombre/tipo, y precio|comprar
   lado a lado. Monedas una sola vez. ESC o "SIGUIENTE OLEADA" cierra. Slots de armas grandes y nítidos.

## Archivos a tocar
- `src/systems/LevelSystem.ts` (Bug 1)
- `src/scenes/ShopOverlay.ts` (Bug 2 emit + Bug 3 layout + ESC)
- `src/scenes/HUDScene.ts` (Bug 2 hide/show)
- (posible) `src/config/game.config.ts` si se externaliza algún número, opcional.
