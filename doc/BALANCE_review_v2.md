# Revisión de balance v2 (análisis Opus)

> Primer pase. Cubre: armas, enemigos (hp/daño/velocidad/ataques/grupales), progresión XP, drops por muerte,
> frecuencia de tienda, economía/precios, ítems y mejoras, estrés. **Iterativo** — requiere playtest para afinar.
> Los cambios propuestos están marcados ⮕ con valor sugerido. Nada aplicado todavía.

---

## 1. ARMAS — la rareza NO se corresponde con el poder

DPS base (nivel 1) = `baseDamage × fireRate × projectileCount`:

| Arma | Rareza | DPS | Rango | Nota |
|---|---|---:|---:|---|
| whiteboard_marker | común | 24 | 180 | corto |
| teclado_mecanico | común | 16 | 150 | muy corto, pega fuerte por golpe |
| coffee_thrower | común | 12 | 300 | |
| stapler_gun | común | 24 | 200 | |
| **postit_launcher** | **común** | **36** | 250 | **3 proyectiles → mejor que casi todos los raros** |
| **debug_laser** | **raro** | **50** | 400 | **el más fuerte del juego, y de largo alcance** |
| botella_termica | raro | 22.5 | 260 | |
| **powerpoint_cannon** | **raro** | **10.5** | 350 | **el más débil; peor que un común** (burst de 35/golpe) |
| extintor | raro | 8 (+zona) | 200 | difícil de comparar; depende de la zona |
| **impresora_aliada** | **épico** | **20** | 250 | **épico pero a media tabla** (torreta) |

**Problemas:**
- `debug_laser` (raro) domina todo, incluso el épico. `postit_launcher` (común) supera a la mayoría de raros.
- `powerpoint_cannon` y `extintor` (raros) y `impresora_aliada` (épico) están por debajo de su rareza.
- No existe **arma legendaria** (todas son común/raro/épico).

**Propuesta — bandas de DPS por rareza** (nivel 1): común ~15-26 · raro ~28-40 · épico ~42-55 · legendaria ~55+.
- `postit_launcher` ⮕ `projectileCount 3→2` (DPS 36→24) o `baseDamage 6→4`.
- `debug_laser` ⮕ `fireRate 10→7` (DPS 50→35) — sigue siendo el raro estrella de alcance.
- `powerpoint_cannon` ⮕ `fireRate 0.3→0.5` (DPS 10.5→17.5) — burst pero usable.
- `extintor` ⮕ subir DPS de zona o `baseDamage 8→12`.
- `impresora_aliada` (épico) ⮕ torreta `baseDamage 10→16` (DPS 20→32) o 2 torretas base.
- Considerar marcar 1-2 como **épico/legendario** reales (ej. una nueva torreta doble o un láser legendario) en una pasada futura.

`WEAPON_LEVEL_DAMAGE_STEP 0.15` / `FIRERATE_STEP 0.10` con max nivel 5 → arma a V ≈ ×1.6 daño / ×1.4 cadencia. Razonable.

---

## 2. ENEMIGOS — hp/daño/velocidad + variedad de ataques

| Enemigo | hp | vel | daño | élite | ataque |
|---|---:|---:|---:|---|---|
| slack_ping | 10 | 120 | 3 | no | melee |
| spam_email | 14 | 95 | 4 | no | melee |
| neg_balloon | 16 | 55 | 5 | no | melee |
| angry_email | 20 | 80 | 5 | no | melee |
| stress_ball | 22 | 70 | 6 | no | melee |
| rolodex | 28 | 60 | 8 | no | melee |
| hr_rep | 35 | 60 | 10 | élite | aura lentitud |
| angry_client | 40 | 90 | 8 | no | melee rápido |
| cleaning_lady | 55 | 42 | 10 | no | rastro de zona |
| toxic_manager | 60 | 50 | 12 | élite | zona al morir |
| auditor | 80 | 40 | 20 | élite | invencible 3s al spawn |
| possessed_printer | 120 | 30 | 15 | élite | abanico de proyectiles |

**Observaciones:**
- **Casi todo es melee** (perseguir y tocar). Solo printer dispara. Falta variedad: un enemigo **a distancia** que mantenga rango y dispare, uno que **rodee/flanquee**, uno que **embista** con telegrafía. (Va con el backlog "mejorar IA de enemigos".)
- `angry_client` no-élite con hp40/vel90/daño8 es más peligroso que el élite `hr_rep` (hp35). Revisar coherencia élite vs normal.
- `auditor` invencible 3s al spawn + daño 20 → muy castigador en grupo; con `auditorHpMult` de RRHH (×1.5=120) se vuelve esponja.
- TTK con 1 arma media (24 DPS): email 0.8s, élite toxic 2.5s, printer 5s. Con 4 armas (~100 DPS) mid-run casi todo muere al instante → el late depende de `difficultyMult` (IPO) que solo aplica post-CEO.
  ⮕ Considerar un **escalado suave de hp/daño enemigo por oleada** (no solo post-CEO), p.ej. `enemyHpMult = 1 + (wave-1)*0.06`, para que el mid-game no se trivialice al tener 3-4 armas.

**Grupales:**
- `swarm` (×4, hp≤30) ahora tiene variedad (F). Con ~22 base ×4 = 88 bichos → vigilar daño de contacto acumulado + estrés.
- Comité (3 auditores) ya implementado.
  ⮕ Faltan "mini-grupos" no-jefe: p.ej. packs que spawnean juntos y se mueven en formación (futuro).

---

## 3. PROGRESIÓN / XP — sobre-nerfeada en B2

`xpValue = hp/10`; XP por kill = `xpValue × XP_KILL_MULT(1)`. Curva nivel = `XP_BASE(40) × level^1.55`.
- Nivel 1 cuesta **40 XP**. Email da 2 XP → **20 kills para el primer nivel**. W1 tiene ~7 enemigos → **no subes ni un nivel en W1-2**.
- Mid (W6, ~22 enemigos, ~2.5 xp medio = 55 xp) → nivel 2 cuesta 117 → ~2 oleadas por nivel. Para W13 ≈ nivel 8-10.
- En B2 se nerfeó **triple** (kill_mult 2→1, base 26→40, exp 1.45→1.55). Probablemente **demasiado lento** ahora.

⮕ Aflojar uno: `XP_KILL_MULT 1→1.5` **o** `XP_BASE 40→32`. Objetivo: W1 ~1 nivel, ritmo ~1 nivel/oleada al mid.

---

## 4. DROPS POR MUERTE + FRECUENCIA DE TIENDA

- **Drops:** `ITEM_DROP_CHANCE 0.04` (4%) normal, **×3 élite = 12%**; `UPGRADE_DROP 1.5%`, ×3 élite = 4.5%.
  - W6 (22 kills) → ~0.9 cofres + estrellas. Swarm (88 kills) → ~3.5 cofres. **Mucho en swarm.**
  - Con el tope de 6 ítems pasivos (D.3), el exceso se descarta — pero igual conviene gatear el drop si el inventario está lleno (no soltar cofre de ítem si ya tienes 6).
  ⮕ `ITEM_DROP_CHANCE 0.04→0.03`; **no soltar cofre 'item' si `passiveItems >= MAX_PASSIVE_ITEMS`** (que caiga moneda/nada).
- **Tienda:** cada oleada (13) ofrece 3 cards + 20% slot legendario (W5+). Más vending automático + cofres del mapa. Vías de ítem: tienda (principal) + cofres + vending.
  ⮕ El vending automático puede regalar ítems muy seguido (cada `VENDING_COOLDOWN_S 60s` si hay monedas). Revisar que no rompa la economía de elección. Subir coste/cooldown del vending o que también respete el tope de slots.

---

## 5. ECONOMÍA / PRECIOS

- Monedas: 2-4 normal, 5-10 élite, 100 boss, +moneda pickup 5 c/30s.
- Precios dinámicos: común 10→~17 (W13), raro 25→~42, épico 60→~101, leg fijo 150.
- W1 (~7 kills ≈ 21 monedas) → 1-2 comunes. Llegas al tope de 6 ítems ~W4-6. Coherente.
- Reroll 5/10/15… ok. Venta 50% ok.
  ⮕ Sin cambios urgentes. Vigilar que con muchos élites (oleadas élite) las monedas no se disparen (5-10 c/u × budget).

---

## 6. ÍTEMS Y MEJORAS

- **Mejoras de personaje** (T1) ya son pequeñas incrementales (daño ×1.06, etc.). Bien. Pero ahora que son chicas + XP lento → el jugador se siente débil mid. Coordinar con §3 (XP) y §2 (escalado enemigo).
- **Ítems (60 totales):** muchos E1/E2 son potentes (modo_dios ×5, último_cartucho cadencia ×3, fotocopiadora duplica arma, segundo_corazón). Con tope de 6 slots la elección importa, pero algunos legendarios pueden romper el late. Revisar caso por caso en una pasada dedicada.
- `explosion_al_matar` usa daño fijo (~75) — ya anotado.
- `rebote_de_pared` solo 2 rebotes — ya anotado.
- **Sinergias:** varias declaradas (`synergyWith`) pero el peso de pool las favorece ×3 — verificar que no creen loops dominantes (p.ej. proyectiles: post_it + doble_disparo + avalancha + magnetismo).

---

## 7. ESTRÉS

- `DAMAGE_PER_HIT 8` por golpe recibido; pasivo +5/30s; kill normal −3, élite −8; café −15.
- En swarm (muchos contactos) el estrés sube rápido → burnout (drena 2 HP/s). Puede ser letal con 88 bichos.
  ⮕ Vigilar: quizás `DAMAGE_PER_HIT` menor en swarm, o que los enemigos chicos generen menos estrés por golpe. (Tras playtest.)

---

## Prioridad sugerida (primer batch a aplicar)
1. **Armas**: re-tier DPS (postit, laser, powerpoint, impresora) → §1.
2. **XP**: aflojar (kill_mult o base) → §3.
3. **Escalado enemigo por oleada** (hp/daño suave) → §2.
4. **Drops**: bajar item chance + gatear por tope de slots; revisar vending → §4.
5. (Después) variedad de ataques enemigos / IA, ítems legendarios, balance fino con playtest.

## Pendiente de más revisiones (lo que falta, como dijo el usuario)
- IA y patrones de ataque por enemigo (ranged/flanqueo/embestida/telegrafía).
- Balance fino ítem-por-ítem (legendarios que rompen el late).
- Armas legendarias reales + sinergias dominantes.
- Curva de dificultad completa W1→W13→post-CEO (IPO) con datos de playtest.
- Jefes menores: HP/daño/cooldowns de ataques vs DPS del jugador a esa altura.
