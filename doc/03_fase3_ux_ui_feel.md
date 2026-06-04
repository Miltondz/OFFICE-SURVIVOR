# OFFICE SURVIVOR — FASE 3: UX, UI Y GAME FEEL
> Usar junto con `00_game_bible.md`. La Fase 2 debe estar completamente terminada.

---

## Objetivo

Convertir el prototipo funcional en algo divertido y satisfactorio de jugar.
Esta fase no agrega mecánicas nuevas — pule las existentes.

---

## Reglas de trabajo

- No modificar lógica de gameplay. Solo presentación y feedback.
- Si algo de Fase 2 parece roto al implementar esta fase: documentarlo como riesgo, no arreglarlo silenciosamente.
- Inspeccionar todos los sistemas antes de añadir efectos encima.
- Ningún sistema de esta fase debe crear dependencias circulares con el gameplay.

---

## Prioridad de implementación (en orden)

1. HUD completo
2. Feedback visual (números flotantes, flashes, muertes)
3. Screen shake
4. Menú principal
5. Pantalla de mejoras (UpgradeScene)
6. Pantalla de estadísticas
7. Pantalla de selección de ítem (polish)
8. Arquitectura de audio
9. Partículas básicas

---

## HUD

El HUD vive en una escena separada que se lanza como overlay encima de GameScene.

```
Escena: HUDScene
Método: scene.launch('HUDScene') desde GameScene
Comunicación: vía EventBus (no referencias directas)
```

### Elementos requeridos

| Elemento        | Posición          | Descripción                                                      |
|-----------------|-------------------|------------------------------------------------------------------|
| Barra de HP     | Top-left          | Barra roja. Texto "HP: X/Y" encima.                             |
| Barra de Estrés | Top-left, bajo HP | Color dinámico (ver tabla). Texto "ESTRÉS: X" encima.           |
| Barra de XP     | Bottom-center     | Barra azul delgada. Texto "Nivel X" a la izquierda.             |
| Contador monedas| Top-right         | Icono placeholder + número.                                      |
| Temporizador    | Top-center        | Formato MM:SS. Cuenta hacia atrás desde 10:00.                  |
| Oleada actual   | Top-center, bajo  | Texto "Oleada X / 10".                                          |
| Indicador armas | Bottom-left       | Iconos de las armas equipadas (rectángulos con nombre abreviado).|

### Color dinámico de la barra de Estrés

| Rango   | Color          | Hex       |
|---------|----------------|-----------|
| 0–30    | Verde          | `#4CAF50` |
| 31–69   | Amarillo       | `#FFC107` |
| 70–89   | Naranja        | `#FF9800` |
| 90–99   | Rojo pulsante  | `#F44336` |

"Rojo pulsante" = alpha oscila entre 1.0 y 0.6 con tween de 400ms loop.

---

## Feedback visual

### Números de daño flotantes

```ts
// src/systems/DamageNumbers.ts
interface DamageNumberConfig {
  value: number;
  isCritical: boolean;
  isPlayerDamage: boolean;
  x: number;
  y: number;
}

// Comportamiento:
// - Normal: texto blanco, tamaño 14px, sube 40px en 800ms, fade out
// - Crítico: texto amarillo, tamaño 20px, sube 60px en 800ms, fade out
// - Daño al jugador: texto rojo, tamaño 16px, sube 30px en 600ms, fade out
// Usar object pool de Text objects — no crear nuevos en cada hit
```

**Probabilidad de crítico:** 20% por defecto. Multiplicador: ×2 daño.

### Flash al recibir daño (enemigos)

Al recibir daño, el sprite del enemigo hace tint a blanco (`0xffffff`) durante 80ms,
luego vuelve a su color original. Implementar en la clase base `Enemy`.

### Efecto de muerte (enemigos normales)

Al morir: escala de 1.0 a 1.4 en 100ms + fade alpha de 1.0 a 0.0.
Usar `tween` de Phaser. Desactivar física antes del tween.

### Efecto de muerte (CEO)

Secuencia:
1. Pantalla congela 0.5s (timeScale = 0)
2. Screen shake intenso (ver sección screen shake)
3. CEO hace tween de escala 1.0 → 2.0 + alpha 1.0 → 0.0 en 1.5s
4. Transición a pantalla de victoria

### Indicador de Burnout

Cuando `stress >= 90`: mostrar vignette roja en bordes de pantalla.
Implementar como rectángulo transparente que cubre toda la pantalla con
`fillStyle` en rojo y alpha que pulsa entre 0.0 y 0.15 (tween loop 400ms).

### Popup de Level Up

Al subir de nivel:
1. Texto "LEVEL UP!" aparece en centro de pantalla
2. Scale 0.5 → 1.2 → 1.0 en 300ms (bounce)
3. Permanece 600ms
4. Fade out en 200ms
5. Luego mostrar pantalla de selección de ítem

---

## Screen Shake

```ts
// src/systems/ScreenShake.ts
enum ShakePreset {
  PLAYER_HIT    = 'player_hit',    // intensity: 3,  duration: 200ms
  ELITE_KILLED  = 'elite_killed',  // intensity: 5,  duration: 250ms
  BOSS_HIT      = 'boss_hit',      // intensity: 6,  duration: 300ms
  BOSS_DEAD     = 'boss_dead',     // intensity: 12, duration: 600ms
}

// Usar: this.cameras.main.shake(duration, intensity)
// Solo sacudir la cámara principal, no el HUD
// El HUD debe estar en cámara fija (camera.ignore para HUD objects)
```

---

## Pantalla de selección de ítem (polish)

Reemplazar la versión placeholder de Fase 2 con:

- Fondo semitransparente (bloquea GameScene visualmente)
- Título "SUBISTE DE NIVEL X"
- 3 tarjetas de ítem (5 si hay Inbox Zero)
- Cada tarjeta muestra: nombre, rareza (color del borde), descripción, tags
- Hover: escala 1.0 → 1.05
- Click: escala 1.05 → 0.95 → selección + cierre
- Mostrar si el ítem es sinérgico con build actual (pequeño indicador)

---

## Menú Principal

```
Escena: MainMenuScene (reemplazar placeholder de Fase 1)
```

Elementos:
- Título "OFFICE SURVIVOR" (texto grande, centrado)
- Subtítulo "Sobrevive la jornada laboral" (texto pequeño)
- Botón "JUGAR"
- Botón "MEJORAS" (activo solo si hay monedas o mejoras disponibles)
- Botón "ESTADÍSTICAS" (activo solo si hay al menos 1 run completada)
- Versión del juego (pequeño, esquina inferior derecha): "v0.1.0"

Si existe una run previa guardada: mostrar "Mejor run: X kills en MM:SS"

---

## UpgradeScene (meta-progresión — UI lista, lógica en Fase 4)

Mostrar la UI completa pero con botones deshabilitados. La lógica de compra
se implementa en Fase 4. El layout debe estar listo.

Tabla de mejoras a mostrar:

| Mejora                | Costo | Niveles | Efecto por nivel       |
|-----------------------|-------|---------|------------------------|
| HP inicial +25        | 50    | 5       | +25 HP base            |
| Daño base +10%        | 75    | 5       | +10% daño              |
| Velocidad +5%         | 60    | 3       | +5% movimiento         |
| Resistencia al estrés | 100   | 3       | -20% subida de estrés  |
| Personaje alternativo | 200   | 1       | (placeholder)          |
| Arma inicial          | 150   | 1       | Elegir arma de inicio  |

Layout: grid de tarjetas. Cada tarjeta muestra nombre, descripción, costo,
nivel actual (0/máx), botón "COMPRAR" (deshabilitado).
Botón "VOLVER" → MainMenuScene.

---

## Pantalla de Estadísticas (StatisticsScene)

Nueva escena. Leer desde `SaveData`.

Mostrar:
- Runs jugadas
- Total de kills
- Tiempo total jugado (formato HH:MM:SS)
- Jefes derrotados
- Monedas ganadas (histórico)
- Mejor run: tiempo + kills + nivel máximo

Botón "VOLVER" → MainMenuScene.

---

## Arquitectura de Audio

```ts
// src/systems/AudioManager.ts

type AudioCategory = 'music' | 'sfx' | 'ui';

class AudioManager {
  private volumes: Record<AudioCategory, number> = {
    music: 0.5,
    sfx:   0.8,
    ui:    1.0,
  };

  setVolume(category: AudioCategory, value: number): void;
  play(key: string, category: AudioCategory): void;
  playMusic(key: string, loop: boolean): void;
  stopMusic(): void;
}
```

### Hooks de audio a implementar (aunque los archivos sean silencio/beep)

| Evento                  | Categoría | Key             |
|-------------------------|-----------|-----------------|
| Disparo de arma         | sfx       | `shoot`         |
| Enemigo recibe daño     | sfx       | `enemy_hit`     |
| Enemigo muere           | sfx       | `enemy_die`     |
| Jugador recibe daño     | sfx       | `player_hit`    |
| Jugador muere           | sfx       | `player_die`    |
| Level up                | sfx       | `level_up`      |
| Recoger pickup          | sfx       | `pickup`        |
| Burnout activado        | sfx       | `burnout_start` |
| CEO aparece             | sfx       | `boss_appear`   |
| CEO muere               | sfx       | `boss_die`      |
| Click en menú           | ui        | `click`         |
| Música de partida       | music     | `music_game`    |
| Música de menú          | music     | `music_menu`    |

Usar archivos de audio generados programáticamente (Web Audio API) o
WAV de 1 segundo de silencio. No depender de assets externos.

### Generación de placeholder audio con Web Audio API

```ts
// En PreloadScene, generar beeps programáticos:
function generateBeep(scene: Phaser.Scene, key: string, freq: number, duration: number): void {
  const audioCtx = new AudioContext();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  oscillator.frequency.value = freq;
  gainNode.gain.setValueAtTime(0.3, 0);
  gainNode.gain.exponentialRampToValueAtTime(0.001, duration);
  oscillator.start(0);
  oscillator.stop(duration);
}
```

---

## Partículas básicas

Usar `Phaser.GameObjects.Particles.ParticleEmitter`.
Sin assets de partículas — usar círculos de 4px generados con `graphics`.

| Evento              | Partículas | Color    | Duración |
|---------------------|------------|----------|----------|
| Muerte enemigo      | 6          | Naranja  | 400ms    |
| Muerte enemigo élite| 12         | Rojo     | 600ms    |
| Recoger pickup      | 8          | Amarillo | 300ms    |
| Pickup de café      | 10         | Marrón   | 400ms    |

---

## Checklist de aceptación

- [ ] HUD visible y legible en todo momento
- [ ] Color de barra de estrés cambia correctamente por rango
- [ ] Indicador de Burnout (vignette) aparece al llegar a 90+ estrés
- [ ] Números de daño flotantes (blanco normal, amarillo crítico, rojo jugador)
- [ ] Flash blanco en enemigos al recibir daño
- [ ] Efectos de muerte para enemigos normales y élites
- [ ] Secuencia de muerte del CEO implementada
- [ ] Screen shake en: player hit, elite killed, boss hit, boss dead
- [ ] HUD en cámara fija (no se mueve con el shake)
- [ ] Popup "LEVEL UP!" funcional
- [ ] Pantalla de selección de ítem con hover y colores de rareza
- [ ] Menú principal con todos los botones y estados correctos
- [ ] UpgradeScene con layout completo (botones deshabilitados)
- [ ] StatisticsScene leyendo desde SaveData
- [ ] AudioManager implementado con todos los hooks
- [ ] Placeholders de audio (no silencio total — aunque sea beeps)
- [ ] Partículas en muertes y pickups
- [ ] Sin regresiones en gameplay de Fase 2

---

## Salida obligatoria al terminar

1. **Resumen** — qué fue implementado
2. **Archivos** — lista completa de archivos creados/modificados
3. **Riesgos** — problemas potenciales detectados
4. **Próximos pasos** — qué hace la Fase 4

No comenzar la Fase 4 automáticamente.
