# REFINAMIENTO DE GAMEPLAY — Análisis y Plan (Opus)

> Análisis del estado actual contra los pedidos, diseño concreto y plan por fases.
> Objetivo: ritmo de oleadas claro, progresión legible (nivel ↑ stats de personaje, monedas ↑ armas),
> intermisión entre oleadas, y estrés comprensible.

---

## 1. Estado actual (lo que hay)

| Sistema | Hoy |
|---|---|
| Conteo de oleada | `round(wave·2.5 + 2)` → wave1≈4, wave2=7, wave3≈9 (solo crece la cantidad, no velocidad/variedad) |
| Avance de oleada | Encadena al limpiar el campo (sin intermisión) |
| XP | `xp_kill = round(hp/10)` (email 2, client 4, printer 12, auditor 8) |
| Subir nivel | `xp_to_next = nivel·120` (lineal). Abre overlay de ítems/armas |
| Recompensa por oleada | `grantUpgrade()` automático en `wave:complete` (además del XP) |
| Armas | máx 4 (freelancer 2). Se ganan en el pool de nivel + máquina expendedora |
| Estrés | umbrales y efectos existen (relajado/tenso/límite/burnout/colapso) pero **no se explican** en pantalla |
| Inventario | iconos en 2 columnas con tooltip |

## 2. Problemas (mapeo a los pedidos)

1. **Conteo inicial muy bajo** y solo escala por cantidad → monótono.
2. **Falta intermisión** "viene la próxima oleada".
3. **XP descoordinado**: nivel cuesta 120 fijo·nivel, pero una oleada da ~10–40 XP → no subes ~1 nivel por oleada al principio. El `grantUpgrade` por-oleada tapa esto pero duplica canales de progresión.
4. **Subir nivel da ítems, no mejoras de personaje** (el usuario quiere stats: +HP, +daño…).
5. **No hay tienda** entre oleadas para comprar arma con el dinero ganado.
6. Armas hasta 4 ya existe, pero falta que la **tienda/feedback** lo dejen claro por personaje.
7. **Iconos** deben ir en **una línea vertical** (hoy 2 columnas).
8. **Estrés poco claro**: no se ve para qué sirve ni cómo afecta.

---

## 3. Diseño propuesto

### 3.1 Ritmo de oleadas — presupuesto + variedad + intermisión

**Presupuesto de oleada (spawn budget).** En vez de "N enemigos", cada oleada tiene un presupuesto de
puntos que se gasta en enemigos (normales = 1, élites = 3). Crece por oleada y permite mezclar tipos.

```
budget(w) = WAVE_BASE_BUDGET + round(w · WAVE_BUDGET_GROWTH)
// Sugerido: base 8, growth 5  → w1=13, w2=18, w3=23, w5=33, w9=53
normal=1 pt, élite=3 pts. (w1 sólo emails → ~13 enemigos)
```

**Variedad creciente (no solo cantidad):**
- **Velocidad:** `enemySpeedScale(w) = 1 + min(0.5, (w-1)·0.05)` (hasta +50% a w11).
- **Ratio de élite:** desde w3 sube la probabilidad de gastar el presupuesto en élites.
- **Tasa de spawn:** `spawnInterval` baja levemente por oleada (llegan más rápido).

**Intermisión entre oleadas (nuevo estado `intermission`):**
1. Al limpiar el campo → entra en intermisión (no spawnea).
2. Se resuelven los **niveles pendientes** (overlay de mejoras de personaje).
3. Se abre la **tienda** (comprar arma/ítem con monedas) — botón "SIGUIENTE OLEADA" para cerrar.
4. Banner/cuenta atrás **"OLEADA X — PREPÁRATE 3·2·1"**, luego spawnea la siguiente.

Config nuevo:
```ts
export const WAVES = {
  BASE_BUDGET: 8, BUDGET_GROWTH: 5,
  ELITE_COST: 3,
  ELITE_CHANCE_BASE: 0.0, ELITE_CHANCE_PER_WAVE: 0.06, ELITE_CHANCE_MAX: 0.5, ELITE_MIN_WAVE: 3,
  SPEED_SCALE_PER_WAVE: 0.05, SPEED_SCALE_MAX: 0.5,
  SPAWN_INTERVAL_BASE: 0.5, SPAWN_INTERVAL_MIN: 0.18,
  INTERMISSION_S: 4, BOSS_WAVE: 10,
};
```

### 3.2 Progresión — XP no-lineal (fácil→difícil) coordinado con la oleada

**Curva de nivel super-lineal** (cuesta más cada nivel):
```
xp_to_next(level) = round(XP_BASE · level^XP_EXP)
// Sugerido: base 26, exp 1.45  → L1=26, L2=71, L3=128, L5=270, L8=560
```
**XP por enemigo ↑** para que una oleada temprana dé ~1 nivel:
```
xp_kill = round(hp / XP_PER_HP_DIVISOR) · XP_KILL_MULT   // mult ≈ 2.0
// w1 (~13 emails, 4xp c/u) = ~52 XP ≈ 2 niveles tempranos; intencional al inicio.
```
Resultado: al principio subes 1–2 niveles por oleada (fácil), pero como cada nivel pide más y las
oleadas no escalan el XP tan rápido, hacia el medio subes <1 nivel/oleada (difícil). **Se quita el
`grantUpgrade()` automático por-oleada** — el único motor de mejoras de personaje es el nivel (XP).

### 3.3 Subir de nivel → MEJORAS DE PERSONAJE (no ítems)

Nuevo pool `PLAYER_UPGRADES` (stats roguelite). El overlay de nivel ofrece 3 (con pesos):
```
+20 HP máx (y cura 20) · +12% daño · +8% velocidad · +1 proyectil · +10% cadencia ·
+15% alcance · +8% prob. crítico · −12% daño recibido · +20% XP · regen 1 HP/3s ·
−15% subida de estrés · +rango de recogida
```
Cada upgrade modifica `PlayerState`/`RunModifiers` (apilable). Los **ítems pasivos del Game Bible**
(42) pasan a aparecer en la **tienda** (no en el nivel) o como drops; el nivel = stats puros.
*(Decisión a confirmar: ítems en tienda vs. seguir en nivel mezclados. Recomiendo tienda.)*

### 3.4 Tienda entre oleadas — comprar armas/ítems con monedas

`ShopOverlay` en la intermisión:
- Ofrece 3–4 cartas: **armas** (respeta máx del personaje) + algunos **ítems**.
- Precio por rareza: común 20, raro 40, épico 70, legendario 120 (config).
- Comprar arma nueva si hay ranura; o subir nivel de arma existente (copia).
- Botón **REROLL** (cuesta monedas) y **SIGUIENTE OLEADA**.
- Monedas vienen de la oleada anterior (ya existe `coins`).

Reemplaza/duplica la máquina expendedora del mapa (auto-compra) → la tienda es explícita y clara.

### 3.5 Armas hasta 4 por personaje — feedback

Ya existe `modifiers.maxWeapons` (4 base, 2 freelancer, 99 toxic_culture). La tienda muestra ranuras
`◻◻◻◻` ocupadas, y el inventario lista armas con su nivel. Sin cambios de lógica, solo UI/claridad.

### 3.6 Inventario en línea vertical

Cambiar `INV_COLS` de 2 → **1** (columna vertical en el borde izquierdo). Tooltip a la derecha (ya está).

### 3.7 Estrés claro

- **Etiqueta de estado + efecto** junto a la barra: p.ej. `ESTRÉS 74 — AL LÍMITE (+20% daño, +10% vel)`.
- **Tooltip** en la barra de estrés con la tabla completa (relajado −10% daño … burnout +40% daño/−2HP/s … colapso = muerte).
- Reforzar feedback ya existente (color de barra, viñeta roja en burnout) con un **texto flotante** al cruzar a Burnout: "¡BURNOUT! +40% daño, drena vida".
- Documentar en el HUD que **matar baja estrés** y **recibir daño lo sube**.

---

## 4. Balance objetivo (para playtest)

| Métrica | Objetivo |
|---|---|
| Duración run | 8–12 min |
| Niveles por oleada (w1–3) | ~1–2 |
| Niveles por oleada (w5+) | <1 |
| Enemigos w1 | ~12–14 (vs ~4 hoy) |
| Llegar a Burnout | ~40% de runs |
| Primera compra en tienda | tras oleada 1–2 |

---

## 5. Plan de implementación por fases

**R1 — Ritmo + claridad (sin economía nueva):**
- SpawnDirector: presupuesto + variedad (velocidad/élite) + intermisión con cuenta atrás.
- Inventario vertical (1 columna).
- Estrés: etiqueta de estado/efecto + tooltip + aviso de burnout.
- *Entrega rápida, alto impacto, bajo riesgo.*

**R2 — Progresión de personaje:**
- Curva XP super-lineal + `XP_KILL_MULT`; quitar `grantUpgrade` automático.
- `PLAYER_UPGRADES` (pool de stats) → el overlay de nivel ofrece mejoras de personaje.

**R3 — Tienda:**
- `ShopOverlay` en intermisión (armas/ítems con precio, reroll, ranuras).
- Mover ítems pasivos del pool de nivel a la tienda (o mixto).
- Retirar/ajustar la máquina expendedora del mapa.

**R4 — Tuning:**
- Ajustar números con playtests; documentar en `BALANCE_v2.md`.

---

## 6. Decisiones que necesito de ti

1. **Nivel = solo stats de personaje**, e **ítems pasivos → tienda**. ¿OK, o prefieres ítems también en el nivel?
2. **Tienda** explícita (cartas + precios + reroll) vs. mantener la máquina expendedora auto. ¿Tienda?
3. Intermisión: ¿con **pausa total** (esperas y eliges) o **cuenta atrás corta** (4s) y los overlays interrumpen?
4. ¿Empiezo por **R1** (ritmo + claridad) ahora?

---

## 7. DECISIONES FINALES (confirmadas) — implementar TODO (R1+R2+R3)

1. **Nivel = SOLO mejoras de personaje (stats).** Los 42 ítems pasivos + armas se obtienen en la **tienda**.
   **Además: drops en el mapa** — además de monedas, los enemigos/objetos pueden soltar **pickups de ítem
   o de mejora** que el jugador recoge en el campo (no solo monedas).
2. **Tienda explícita** entre oleadas (reemplaza la auto-compra de la máquina). **Mejorar TODAS las interfaces:**
   paneles con **textura y profundidad** (no solo borde plano): bisel/relieve, sombra, degradado falso, esquinas.
3. **Intermisión:** overlays (nivel/tienda pausan) + **cuenta atrás 4s** "PREPÁRATE" y arranca la oleada.

### 7.1 Helper de panel con profundidad (reusar en TODAS las cards/overlays/HUD)
`systems/ui/Panel.ts` → `makePanel(scene, x, y, w, h, opts)` que dibuja:
- sombra inferior-derecha (rect oscuro offset +3,+3, alpha 0.5),
- base (rect color),
- **bisel**: borde superior/izquierdo claro (1–2px), borde inferior/derecho oscuro (relieve),
- línea de brillo superior (alpha) para "profundidad",
- borde exterior fino.
Devuelve un `Container`. Variante `panelColorByRarity(rarity)`. Cards de mejora/personaje/tienda usan esto
en vez de `rectangle().setStrokeStyle()`.

### 7.2 PLAYER_UPGRADES (pool de nivel) — `config/playerUpgrades.config.ts`
```ts
export interface PlayerUpgrade { id; name; desc; icon?; weight;
  apply(player: PlayerState, mods: RunModifiers): void; }
```
Lista (peso): vida +20 (3) · daño +12% (3) · velocidad +8% (2) · +1 proyectil (1.5) · cadencia +10% (2) ·
alcance +15% (1.5) · crítico +8% (1.5) · −12% daño recibido (2) · +20% XP (1) · regen 1HP/3s (1) ·
−15% subida estrés (1.5) · vel. proyectil +20% (1.5).
El overlay de NIVEL ofrece 3 (sin repetición en la misma tirada; apilables entre niveles).

### 7.3 Tienda — `scenes/ShopOverlay.ts`
- Se abre en la intermisión (tras resolver niveles). Pausa el juego.
- Ofrece 4 cartas: armas (respeta `modifiers.maxWeapons`) + ítems pasivos (rareza con gates de nivel).
- **Precios** `config`: común 20, raro 45, épico 80, legendario 140. Subir nivel de arma existente = mismo precio que común.
- Botones: **COMPRAR** (resta monedas, aplica), **REROLL** (cuesta 15, nueva tirada), **SIGUIENTE OLEADA**.
- Muestra ranuras de arma `◻◻◻◻` (llenas/vacías) y monedas disponibles.
- Usa paneles con profundidad (7.1) y los iconos `item_<id>`.

### 7.4 Drops en el mapa (PickupSystem)
- Nuevo `PickupKind`: `item` (cofre/regalo) y `upgrade` (estrella).
- Al morir un enemigo: pequeña probabilidad (`ITEM_DROP_CHANCE≈0.04`, élite ×3) de soltar un pickup `item`
  → al recogerlo, otorga un ítem aleatorio elegible (como la tienda, gratis). `upgrade` (más raro, ~0.015) →
  abre una elección de mejora de personaje.
- Config en `PICKUPS`.

### 7.5 Oleadas (SpawnDirector) — máquina de estados
Estados: `spawning` → `clearing` (esperando matar) → `intermission` (overlays + countdown) → `spawning`.
- Presupuesto + variedad (3.1). Emitir `wave:cleared` al vaciar campo (dispara intermisión) y `wave:start` al spawnear.
- `wave:complete` deja de auto-otorgar upgrade (el nivel ya lo hace por XP).
- Cuenta atrás visible (HUD o banner): "OLEADA X — 3·2·1".

### 7.6 XP (config + LevelSystem + Enemy.die)
- `PROGRESSION`: `XP_BASE=26, XP_EXP=1.45, XP_KILL_MULT=2`. `xpToNext = round(XP_BASE·level^XP_EXP)`.
- `Enemy.die`: `xp = round(def.xpValue · XP_KILL_MULT · modifiers.xpMult)`.
- Quitar `grantUpgrade()` por-oleada en GameScene.

### 7.7 Estrés claro (HUD)
- Junto a barra: `ESTRÉS 74 — AL LÍMITE` + sublínea `+20% daño · +10% vel`. Texto por estado.
- Tooltip en hover de la barra con la tabla completa (relajado/tenso/límite/burnout/colapso).
- Toast al entrar en Burnout: "¡BURNOUT! +40% daño, +25% vel, −2 HP/s".

### 7.8 Inventario
- `INV_COLS = 1` (columna vertical, borde izquierdo), tooltip a la derecha (ya existe).

