# Revisión de balance v3 (análisis Opus) — ítems, jefes menores, IA/arquetipos

> Segunda pasada (tras v2/batch1). Enfocada en: dominancia de ítems E1/E2 y sinergias, jefes menores vs DPS
> del jugador, y arquetipos/IA de enemigos. Iterativa; requiere playtest. Nada aplicado todavía.

## Estimación de DPS del jugador por oleada (referencia)
1 arma nivel 1 ≈ 24 DPS (post-batch1). Con crítico base 20%×2 → efectivo ×1.2.
- **W5** ~2 armas + algunas mejoras ≈ **55-70 DPS** (efectivo).
- **W9** ~3-4 armas ≈ **100-140 DPS**.
- **W12-13** ~4-5 armas (algunas nivel III-V) ≈ **160-220+ DPS**.

---

## 1. JEFES MENORES vs DPS (TTK aproximado)
| Jefe | Oleada | HP | TTK @DPS estimado | Veredicto |
|---|---|---:|---|---|
| Supervisor | W5 | 600 | ~9-11s @60 DPS | OK, **roza tanque** si el jugador va corto de nivel |
| Impresora | W9 | 900 | ~7-9s @120 DPS | OK |
| Comité | W12 | 900 (3×300) | ~5-6s @170 DPS | OK (enrage compensa) |
| CEO | W13 | 2000 | ~10-12s @200 DPS | OK (2 fases) |

- Contacto: Supervisor 18, Impresora 22, Comité 14, CEO 20 — coherente.
- ⮕ **Supervisor W5 HP 600 → 500** (o dejar; depende de cómo quede el ritmo de nivel con batch1). Marcar para playtest.
- ⮕ Verificar que el **apuntado al jefe** (ya arreglado) + ausencia de adds no deje al jugador sin estrés/daño durante peleas largas (el estrés pasivo sigue subiendo: +5/30s; en una pelea de 60s+ sin kills, sube ~10-12 estrés sin forma de bajarlo). Considerar que los minibosses suelten algún pickup de estrés, o que sus adds (Reunión) basten.

---

## 2. ÍTEMS — dominancia y sinergias

### 2.1 Rompe-late concreto: `cadena_de_kills` (épico) SIN CAP
`+2% daño por kill sin recibir daño, se reinicia al recibir daño`. **Sin tope.**
- En swarm (88 kills) sin recibir un golpe → **+176% daño**. Con defensas evasivas (teletransporte, segundo_corazón, pelota_stress 30% block, modo_dios invencible) es fácil no recibir daño → snowball ilimitado.
⮕ **Añadir tope**: `CADENA_MAX_BONUS = 1.5` (+150% máx). Sigue siendo fuerte, deja de ser infinito.

### 2.2 Build de PROYECTILES dominante (cluster de sinergia)
`post_it_stack (+1 proj)` + `stat_projectile (+1)` + `doble_disparo (25% ×2)` + `avalancha (secundario 50% al impacto)` + `magnetismo_balas (homing ~100% acierto)` + `rebote_de_pared` + `fotocopiadora` (+rebotes/duplicar). Todos con peso de pool ×3 por `synergyWith` → **clusterizan en la oferta**.
- Resultado: pantalla llena de balas teledirigidas que auto-limpian; el resto de builds quedan por detrás.
⮕ No hay un fix único. Opciones (elegir en playtest):
  - **Cap de proyectiles por arma** (p.ej. base+bonus ≤ 6).
  - Bajar el peso de sinergia ×3 → ×2 para que no clustericen tanto.
  - `avalancha`/`magnetismo` ligeramente menos potentes (ya 50% / homing fuerte).

### 2.3 Otros ítems potentes (aceptables, vigilar)
- `modo_dios_temporal` (leg): ×5 daño + invencible 3s/60s = 5% uptime. OK.
- `ultimo_cartucho` (leg): cadencia ×3 a ≤20% HP — alto riesgo/recompensa. OK.
- `fotocopiadora_armas` (épico): = +1 arma efectiva (1×/run). OK.
- `singularidad` (leg): cada 30 kills, 25 DPS AoE 3s + pull. OK; en swarm dispara muy seguido pero daño moderado.
- `segundo_corazon` (épico): +50 HP buffer 1×/run. OK.
- `iman_de_monedas` (raro): QoL economía. OK.

### 2.4 Comunes/raros — sin dominancia clara tras batch1. OK.

---

## 3. ENEMIGOS — arquetipos / IA (mejora de jugabilidad)
**Hoy: casi todo es melee que persigue en línea recta y se APILA** (todos calculan el mismo ángulo al jugador → se funden en un blob). Solo `possessed_printer` dispara.

### 3.1 Anti-apilamiento (separación) — alto impacto, recomendado
- Añadir una fuerza de **separación** ligera entre enemigos (boids básico): cada enemigo se aparta un poco de los vecinos cercanos. Hace que las hordas se **distribuyan** (mejor lectura, no un punto), y abre huecos para esquivar.
- Implementación contenida en `Enemy.preUpdate`/`EnemySystem.update`: por enemigo, sumar un vector de repulsión de los N vecinos dentro de ~28px y mezclarlo con el de persecución. Config `SEPARATION_RADIUS`, `SEPARATION_FORCE`.

### 3.2 Variedad de arquetipos (futuro, requiere más trabajo)
- **Ranged**: mantiene distancia (~200px) y dispara cada Xs (reusar `enemyProjectilePool`). P.ej. convertir `rolodex` o un nuevo enemigo en ranged.
- **Embestida con telegrafía**: se detiene, parpadea, embiste (como la Patada del Supervisor pero en un normal).
- **Orbitador/flanqueo**: no va recto, intenta rodear.
- Telegrafía visual para `auditor` (invencible 3s) y `cleaning_lady` (rastro).

---

## 4. ESTRÉS en peleas largas de jefe
- Sin kills frecuentes, el estrés pasivo (+5/30s) sube y no baja (kills lo reducen; en un jefe 1v1 hay pocos kills). Una pelea de jefe de 60-90s puede empujar al jugador a límite/burnout sin que sea su culpa.
⮕ Opciones: los minibosses sueltan 1-2 pickups de estrés/café al entrar en fase 2, o sus adds (Reunión/Comité) bastan como fuente de kills. Marcar para playtest.

---

## Batch 2 propuesto (aplicar ahora)
1. ~~**`cadena_de_kills` cap** = +150% (`CADENA_MAX_BONUS 1.5`).~~ ✅ APLICADO (batch2). Concreto, claro.
2. **Separación de enemigos** (anti-apilamiento) — mejora de jugabilidad de alto impacto.
3. (Opcional, decisión) `Supervisor HP 600→500`.
4. (Opcional, decisión) Peso de sinergia ×3 → ×2 para des-clusterizar el build de proyectiles, **o** cap de proyectiles por arma (≤6).

## Pendiente de más pasadas
- Armas legendarias reales (no existe ninguna; el tope de poder son épicos).
- Arquetipos/IA completos (ranged/embestida/flanqueo) — ticket dedicado.
- Curva W1→post-CEO (IPO) con datos de playtest (TTK objetivo por oleada).
- Balance fino estrés/economía con métricas reales.
