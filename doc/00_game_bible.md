# OFFICE SURVIVOR — GAME BIBLE
> Incluir en TODOS los prompts como contexto permanente.

---

## Logline
Vampire Survivors meets oficina corporativa: sobrevive hordas de emails,
managers y impresoras poseídas mientras tu estrés escala entre poder y colapso.

## Stack técnico
- Engine: Phaser 3
- Lenguaje: TypeScript estricto (`strict: true`)
- Bundler: Vite
- Target: Web (desktop primary, mobile-compatible)
- Resolución base: 960×540 (escala a pantalla completa con letterbox)

## Tono
Humorístico, cartoon, exagerado, caricaturesco.
NO es simulador corporativo. NO es RPG complejo. NO es sandbox.

---

## Game loop core

1. El jugador aparece en la oficina
2. Oleadas de enemigos llegan cada 30 segundos
3. Matar enemigos → XP → subir nivel → elegir ítem o arma
4. El estrés sube al recibir daño y baja al matar enemigos
5. A los 10 minutos aparece el CEO como jefe final
6. Derrotar al CEO = victoria. Llegar a 100 estrés o morir = derrota.

---

## Sistema de Estrés (mechanic central)

Rango: 0–100

| Rango   | Estado    | Efecto                                               |
|---------|-----------|------------------------------------------------------|
| 0–30    | Relajado  | -10% daño causado. Sin efectos negativos.            |
| 31–69   | Tenso     | Daño normal. Sin bonus ni penalti.                   |
| 70–89   | Al límite | +20% daño, +10% velocidad.                           |
| 90–99   | Burnout   | +40% daño, +25% velocidad, -2 HP/segundo de drenaje. |
| 100     | Colapso   | Game Over inmediato.                                 |

**Subida de estrés:**
- Recibir daño: +10 por hit
- Cada 30s sin matar enemigos: +5

**Bajada de estrés:**
- Matar enemigo normal: -2
- Matar enemigo élite: -8
- Recoger pickup "Café": -15 instantáneo

La decisión estratégica central: ¿te quedas en Burnout (alto riesgo/alta recompensa) o bajas el estrés para seguridad?

---

## Armas (valores base, nivel 1 — 1 copia)

| Arma                | Daño  | Cadencia | Alcance | Proyectiles  | Efecto especial                    |
|---------------------|-------|----------|---------|--------------|------------------------------------|
| Coffee Thrower      | 12    | 1/s      | 300px   | 1 (arco)     | Slow al enemigo 1s                 |
| Stapler Gun         | 8     | 3/s      | 200px   | 1 (recto)    | —                                  |
| Debug Laser         | 5/tick| 10/s     | 400px   | 1 (haz)      | Continuo, daña mientras apunta     |
| Post-it Launcher    | 6     | 2/s      | 250px   | 3 (disperso) | Pequeña área de daño               |
| PowerPoint Cannon   | 35    | 0.3/s    | 350px   | 1 (lento)    | Aturde 1.5s al impactar            |
| Whiteboard Marker   | 4     | 6/s      | 180px   | 1 + mancha   | Mancha en suelo 3s (daño de área)  |
| Teclado Mecánico    | 20    | 0.8/s    | 150px   | 1 (corto)    | Knockback al enemigo               |
| Botella Térmica     | 15    | 1.5/s    | 260px   | 1 (explosión)| Área radio 60px al impactar        |
| Extintor            | 8/tick| cono     | 200px   | cono frontal | Congela 2s. Recarga 5s.            |
| Impresora Aliada    | 10    | 2/s      | 250px   | autónoma     | Torreta summonable                 |

**Reglas de armas:**
- Máximo 4 armas equipadas simultáneamente (5 con ítem Doble Monitor)
- Las armas aparecen en el pool de nivel como cualquier ítem
- Cada copia adicional del mismo arma = nivel +1: +15% daño, +10% cadencia
- Nivel máximo de arma: 3 copias (nivel 3)

---

## Enemigos

| Enemigo              | HP  | Velocidad | Daño/hit | Comportamiento                                |
|----------------------|-----|-----------|----------|-----------------------------------------------|
| Angry Email          | 20  | 80        | 5        | Persigue en línea recta.                      |
| Toxic Manager        | 60  | 50        | 12       | Persigue. Crea zona tóxica al morir (3s).     |
| Angry Client         | 40  | 90        | 8        | Rápido. Grita al acercarse (stun visual).     |
| HR Representative    | 35  | 60        | 10       | Aura de lentitud: -30% velocidad al jugador.  |
| Possessed Printer    | 120 | 30        | 15       | Dispara papel en abanico cada 3s.             |
| Auditor              | 80  | 40        | 20       | Invencible los primeros 3s. Alto daño.        |

---

## Jefe: CEO

HP: 2000. Fases: 2 (cambia al 50% HP).

**Fase 1 (100–50% HP):**
- "Memo urgente": proyectil recto, cada 2s
- "Reunión obligatoria": invoca 4 Angry Emails
- "Revisión de presupuesto": pausa 1s → carga hacia el jugador

**Fase 2 (50–0% HP):**
- Todos los ataques anteriores +20% frecuencia
- "Restructuring": 3 líneas de proyectiles que cubren la pantalla

---

## Sistema de Ítems

### Rarezas

| Rareza     | Peso | Color   | Máx. por run | Disponible desde |
|------------|------|---------|--------------|------------------|
| Común      | 60%  | Gris    | Sin límite   | Nivel 1          |
| Raro       | 28%  | Azul    | Sin límite   | Nivel 1          |
| Épico      | 10%  | Púrpura | 4            | Nivel 3          |
| Legendario | 2%   | Ámbar   | 1            | Nivel 6          |

### Pool de nivel — ponderación

Al subir de nivel, NO se eligen 3 ítems puramente al azar:

1. Ítem sinérgico con arma que ya tienes → peso ×3
2. Ítem que complementa build actual (mismas tags) → peso ×1.5
3. Ítems ya poseídos no vuelven a aparecer (armas sí, para subir nivel)
4. Mínimo 1 ítem de rareza ≥ a la rareza más alta del jugador

El jugador siempre ve 3 opciones (5 con el ítem Inbox Zero).

### Catálogo de ítems

#### Comunes
| ID                | Nombre               | Efecto                                                                 | Tags               | Sinergía                          |
|-------------------|----------------------|------------------------------------------------------------------------|--------------------|-----------------------------------|
| cafe_solo         | Café Solo            | Consumible. -15 estrés al recoger. Reaparece cada 45s.                | estrés, pickup     | Con Cafeína Crónica: efecto ×2   |
| lapicero_roto     | Lapicero Roto        | +8% daño. +1% daño extra por cada ítem adicional que tengas.          | daño, escalado     | —                                 |
| post_it_stack     | Stack de Post-its    | +1 proyectil adicional a todas las armas.                              | proyectiles        | Con Fotocopiadora: rebotan       |
| auriculares       | Auriculares          | +15% velocidad de movimiento. -5% daño recibido.                      | velocidad, defensa | —                                 |
| excel_sheet       | Hoja de Excel        | Muestra HP exacto de cada enemigo encima de su cabeza.                | utilidad, info     | —                                 |
| termo             | Termo                | Coffee Thrower hace slow +1s adicional.                               | arma, slow         | Solo con Coffee Thrower           |
| grapas_extra      | Grapas Extra         | +30% cadencia de disparo a la Stapler Gun.                            | arma, cadencia     | Solo con Stapler Gun              |
| galleta           | Galleta de Empresa   | Consumible. +20 HP al recoger.                                        | hp, pickup         | —                                 |
| badge             | Badge de Visitante   | Enemigos tardan 0.5s más en detectarte al aparecer.                   | utilidad           | —                                 |
| linea_directa     | Línea Directa IT     | Al llegar a 0 HP, sobrevives con 1 HP. Una vez por run.               | defensa, escape    | —                                 |

#### Raros
| ID                | Nombre               | Efecto                                                                 | Tags               | Sinergía                          |
|-------------------|----------------------|------------------------------------------------------------------------|--------------------|-----------------------------------|
| doble_monitor     | Doble Monitor        | +25% daño. Puedes equipar 1 arma adicional (máx 5).                  | daño, ranura       | —                                 |
| cafeina_cronica   | Cafeína Crónica      | En Burnout: +20% velocidad extra. Burnout no drena HP.                | estrés, burnout    | Con Café Solo: efecto ×2         |
| spreadsheet_god   | Spreadsheet God      | 10 kills sin recibir daño → +15% daño durante 10s.                   | daño, racha        | —                                 |
| fotocopiadora     | Fotocopiadora        | Proyectiles rebotan una vez en el primer enemigo que impactan.        | proyectiles        | Con Stack de Post-its            |
| modo_avion        | Modo Avión           | Inmune 2s tras recibir daño. Cooldown 8s.                             | defensa, inmunidad | —                                 |
| reunion_cancelada | Reunión Cancelada    | Cada kill: 15% de soltar pickup de estrés (-10).                      | estrés, kill       | —                                 |
| wifi_rapido       | WiFi Rápido          | +25% velocidad de proyectiles. +10% alcance.                          | arma, velocidad    | —                                 |
| overtime          | Horas Extra          | +40% XP ganada. -10% HP máximo.                                       | xp, tradeoff       | —                                 |
| powerpoint_feo    | PowerPoint Feo       | PowerPoint Cannon aturde +1.5s adicionales.                           | arma, stun         | Solo con PowerPoint Cannon        |
| ergonomia         | Silla Ergonómica     | +30 HP máximo. Estrés sube 20% más lento.                             | hp, estrés         | —                                 |
| backup_plan       | Backup Plan          | Al morir enemigo élite: 25% de clonar su drop de ítem.               | economía, suerte   | —                                 |

#### Épicos
| ID                | Nombre               | Efecto                                                                 | Tags               | Sinergía                          |
|-------------------|----------------------|------------------------------------------------------------------------|--------------------|-----------------------------------|
| debug_mode        | Modo Debug           | Debug Laser ignora defensa y siempre crítico.                         | arma, crítico      | Solo con Debug Laser              |
| agile_sprint      | Agile Sprint         | Al subir de nivel: +5% a todos los stats durante 30s.                | nivel, buff        | —                                 |
| carta_renuncia    | Carta de Renuncia    | En Burnout: kills restauran 2 HP. Sin drenaje.                       | burnout, hp        | —                                 |
| meeting_overflow  | Meeting Overflow     | Enemigos al morir explotan (radio 80px).                              | aoe, kill          | —                                 |
| linkedin_premium  | LinkedIn Premium     | Monedas ×2. Meta-progresión cuesta 20% menos.                        | economía, meta     | —                                 |
| inbox_zero        | Inbox Zero           | Matar 50 enemigos en una oleada → próximo nivel ofrece 5 opciones.   | nivel, bonus       | —                                 |
| vpn_corporativa   | VPN Corporativa      | Proyectiles atraviesan enemigos. Daño -15%.                           | proyectiles        | —                                 |
| ndas_firmadas     | NDAs Firmadas        | Auditores mueren de un golpe. HR Rep no puede ralentizarte.          | enemigo            | —                                 |
| cafeteria_vip     | Cafetería VIP        | Cafés aparecen el doble. Cada café cura +10 HP.                      | pickup, hp         | —                                 |
| benchmark         | Benchmark            | Tu arma top-daño gana +40% daño permanente.                          | arma, escalado     | —                                 |

#### Legendarios
| ID                | Nombre               | Efecto                                                                 | Tags               |
|-------------------|----------------------|------------------------------------------------------------------------|--------------------|
| yolo              | YOLO                 | Burnout permanente. No puedes bajar de 90 estrés. +60% daño total.   | burnout, riesgo    |
| ceo_memo          | Memo del CEO         | Enemigos -20% HP. CEO +50% HP.                                        | tradeoff           |
| all_hands         | All Hands Meeting    | Cada oleada superada: +3% daño acumulativo.                           | escalado           |
| pivot             | Pivot                | Al nivel 10: todas las armas se reemplazan por versiones +50% stats.  | transformación     |
| stock_options     | Stock Options        | Cada moneda recogida: +0.1% daño acumulativo. Sin cap.               | economía, escalado |
| ipo               | IPO                  | Al matar al CEO: la run continúa infinita. +25% dificultad cada 5min.| endgame            |

#### Adicionales (v0.2 — relleno hasta 42 ítems)
> Añadidos en implementación Fase 2 para alcanzar el catálogo de 42 ítems. Mismo tono.

| ID                | Nombre               | Efecto                                                                 | Tags               | Rareza  |
|-------------------|----------------------|------------------------------------------------------------------------|--------------------|---------|
| moneda_olvidada   | Moneda Olvidada      | Consumible. +5 monedas al recoger.                                    | economía, pickup   | Común   |
| cafe_con_leche    | Café con Leche       | +10% daño. +5% velocidad de movimiento.                              | daño, velocidad    | Común   |
| taza_rota         | Taza Rota            | +20% daño. -5 HP máximo.                                             | daño, tradeoff     | Común   |
| reloj_roto        | Reloj Roto           | +15% velocidad de proyectiles de todas las armas.                    | arma, cadencia     | Raro    |
| auriculares_nc    | Auriculares NC       | -10% daño recibido. Estrés sube 15% más lento.                      | defensa, estrés    | Raro    |

**Conteo total:** 10 común + 11 raro + 10 épico + 6 legendario + 5 adicionales = **42 ítems**.

### Builds documentadas (sinergias clave)

**Burnout Agresivo:** YOLO + Carta de Renuncia + Cafeína Crónica
→ Burnout permanente sin drenaje HP, kills restauran vida.

**Proyectiles:** Stack de Post-its + Fotocopiadora + VPN Corporativa
→ Múltiples proyectiles que atraviesan y rebotan.

**Escalado Económico:** Stock Options + LinkedIn Premium + Backup Plan
→ Monedas generan daño acumulativo ilimitado.

**Laser:** Debug Laser + Modo Debug + WiFi Rápido + VPN Corporativa
→ Haz que atraviesa todo, daño crítico garantizado.

**One-Shot:** PowerPoint Cannon + PowerPoint Feo + Benchmark + Agile Sprint
→ Arma lenta con daño extremo, amplificada como top dañadora.

---

## Consumibles (aparecen en mapa, no en pool de nivel)

| Ítem              | Efecto       | Tiempo de reaparición |
|-------------------|--------------|-----------------------|
| Café Solo         | -15 estrés   | 45s                   |
| Galleta           | +20 HP       | 60s                   |
| Moneda Olvidada   | +5 monedas   | 30s                   |

---

## Economía

- Enemigo normal: 1–3 monedas al morir
- Enemigo élite: 5–10 monedas
- CEO: 100 monedas

---

## Progresión de niveles

XP requerida por nivel: `nivel × 100`
XP por kill: `Math.round(HP_enemigo / 10)`
Al subir de nivel: elegir 1 de 3 ítems (o 5 con Inbox Zero)
