# PLAN — Sprites animados del jugador (Opus)

> Reemplazar el rectángulo verde del jugador por el **sprite animado** desde la hoja de cada personaje.
> Estrategia: implementar UNO completo (Becario) → validar lógica → cablear los demás.

## Hojas (assets/characters/*.png)
- Todas **1376×768 = 5 columnas × 3 filas** (15 frames). Frame **275×256** (se ignora 1px sobrante a la derecha).
- **Filas (dirección):** 0 = ABAJO (hacia el jugador), 1 = DERECHA (perfil), 2 = ARRIBA (de espaldas).
- **Columnas:** 0 idle · 1 walk1 · 2 walk-passing · 3 walk3 · 4 death.
- IZQUIERDA = fila DERECHA con `flipX`.
- Índice de frame = `fila*5 + col`.

## Mapeo id → archivo
becario→intern_sprite_sheet · freelancer→freelancer_sprite_sheet · director→corporate_director_sprite ·
rrhh→hr_representative_sprite · consultor→consultant_pixel_art. `base` → usa la hoja de becario (fallback) o tint.

## Pasos

### 1. Assets
Copiar las hojas completas a `public/assets/characters/sheets/<id>.png` (nombre limpio). Script `tools/copy_char_sheets.py`.

### 2. Carga + animaciones (PreloadScene)
- `this.load.spritesheet('charsheet_<id>', '/assets/characters/sheets/<id>.png', { frameWidth:275, frameHeight:256 })`.
- Tras `create`, crear animaciones globales por personaje y dirección (idle = frame único, no anim):
  - `anims.create({ key:'<id>_walk_down', frames: [1,2,3], frameRate:8, repeat:-1 })`
  - igual para `_walk_side` (fila1: 6,7,8) y `_walk_up` (fila2: 11,12,13).
  - frames idle: down=0, side=5, up=10. death: down=4, side=9, up=14.
- Animaciones son globales (crear una vez); guardar con `if (!this.anims.exists(...))`.

### 3. Player entity (rewrite visual)
- Cambiar `body` de Rectangle → **`Phaser.Physics.Arcade.Sprite`** con textura `charsheet_<id>`.
- Escala: el frame es 256px de alto → mostrar a ~48px ⇒ `setScale(48/256 ≈ 0.19)` (constante `PLAYER_SPRITE_DISPLAY`).
- **Cuerpo físico pequeño** (no 275×256): `body.setSize(W,H)` y `setOffset` centrado a los pies, p.ej. 90×120 px en coords de textura (con el scale da ~17×23 px en pantalla). Mantener colisiones/contacto como hoy.
- Recibe `characterId` para elegir la textura (`new Player(scene, ctx)` ya tiene `ctx.character.id`).

### 4. Dirección + animación (Player.update)
- Calcular `dx,dy` del input (ya existe).
- Dirección dominante: si `|dx| > |dy|` → lado (flipX = dx<0); si no → down (dy>0) / up (dy<0).
- Si hay movimiento: `play('<id>_walk_<dir>', true)`. Si no: detener anim y poner **frame idle** de la última dirección.
- Mantener el movimiento por posición (clamp) y la barra de HP encima (ajustar offset al nuevo alto).
- `flipX` para izquierda; resetear en otras direcciones.

### 5. Muerte (opcional)
- En `player:died`, antes de la transición, poner frame death de la dirección actual (`<id>` frame `dir*5+4`).

### 6. Cablear el resto
- Una vez Becario funciona: la lógica es genérica por `ctx.character.id`. Solo asegurar que las 5 hojas + `base` (fallback a becario) estén cargadas y con anims creadas. Probar cada personaje desde el menú.

## Riesgos
- Frame 275.2 no entero → usar 275 (1px ignorado, invisible por el margen del personaje).
- El sprite es grande; el **cuerpo de colisión** debe quedar chico y a los pies (ajustar `setSize/offset`).
- `base` no tiene hoja → fallback a becario (o un tint gris).
