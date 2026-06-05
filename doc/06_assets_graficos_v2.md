# OFFICE SURVIVOR — ASSETS GRÁFICOS v2 (PROMPTS DE ALTA PRECISIÓN)

> Reescritura de `06_assets_graficos.md` con prompts rigurosos para generación con IA.
> Cada prompt define matemática de canvas exacta, regla de anclaje, descripción **por frame**,
> paleta hex fija y reglas de estilo estrictas. Pensado para Midjourney v6 / DALL·E 3 / SDXL+LoRA.
>
> **FONDO: TRANSPARENTE (canal alfa, PNG-32) EN TODAS LAS HOJAS DE SPRITE Y ASSETS.**
> Sin relleno de fondo, sin color de fondo. Solo el personaje/objeto sobre transparencia total.

---

## 0. ESTÁNDAR GLOBAL (leer antes de generar cualquier asset)

### 0.1 Reglas de canvas y grid (obligatorias)
- **Fondo transparente** (alpha channel). Cero píxeles de fondo. Exportar PNG con transparencia.
- **Cero padding** y **cero separación** entre frames. **Cero borde** entre frames.
- Frames **perfectamente alineados a la grid**. Cada celda es exactamente del tamaño indicado.
- El tamaño total de la imagen = `columnas × ancho_frame` por `filas × alto_frame`. Sin sobrante.
- Pixel art limpio, **sin anti-aliasing, sin dithering, sin degradados, sin sombras de relleno**.

### 0.2 Regla de anclaje (aplicar a CADA frame de personajes/enemigos)
- Los **pies tocan siempre el borde inferior** de su celda.
- El personaje está **centrado horizontalmente** en su celda.
- Única sombra permitida: **elipse de suelo de 3px** bajo los pies (no sombra proyectada en el cuerpo).
- En frames de muerte (cuerpo horizontal): el cuerpo **llena el ancho** de la celda, centrado vertical.

### 0.3 Reglas de estilo (idénticas en todos los frames de un mismo asset)
- Estética: **Brotato × Octodad × PowerPoint corporativo malo**. Cartoon de oficina, caricaturesco.
- **Contorno negro:** 2px en personajes/enemigos/mapa/UI; **3px** solo el CEO; **1px** en assets pequeños (proyectiles, pickups e iconos ≤16px) para no comer el sprite.
- **Colores planos** únicamente. Misma paleta hex exacta en todos los frames del asset.
- **Tamaño de cabeza constante** entre frames (no encoge ni crece). Proporción chibi: cabeza ≈ 40% de la altura.
- Ciclo de caminado: **4 posiciones de pierna claramente distintas** (no 2 repetidas).
- El frame de "passing/center" del walk debe verse **distinto del idle** (brazos a media oscilación, leve inclinación).

### 0.4 Vista
- Personajes y enemigos: **top-down 3/4** (ligeramente cenital, no perfil puro salvo la fila "lado").
- Proyectiles/iconos: vista frontal/plana orientada a 0° (derecha), rotación programática en engine.

### 0.5 Negative prompt sugerido (añadir siempre)
```
no background, no white background, no checkerboard, no gradient, no anti-aliasing,
no dithering, no drop shadow, no blur, no jpeg artifacts, no text labels, no watermark,
no extra frames, no misaligned grid, no padding, no borders between frames,
inconsistent head size, only 2 distinct walk poses
```

### 0.6 Nota técnica de generación
Si el generador no produce alfa nativo de forma fiable, generar sobre un color clave plano
**magenta #FF00FF** y eliminarlo a transparencia en post (Aseprite/Photoshop "Color to Alpha").
El entregable final SIEMPRE es PNG-32 con fondo transparente.

---

## 1. PERSONAJES JUGABLES

> Formato común: **spritesheet 5 columnas × 3 filas = 15 frames. 48×48px por frame.
> Imagen total 240×144px. Fondo transparente.**
> Filas = direcciones: **Fila 1 ABAJO (hacia el espectador), Fila 2 DERECHA (perfil), Fila 3 ARRIBA (de espaldas).**
> La dirección IZQUIERDA se obtiene espejando la Fila 2 en el engine (no se dibuja).
> Columnas = **[0] idle · [1] walk paso 1 · [2] walk passing · [3] walk paso 3 · [4] death.**
> Anclaje: pies tocan el borde inferior; personaje centrado; ocupa ≈38×44px dentro de los 48×48.

### Plantilla de descripción por frame (común a los 5 personajes)
- **[r,0] IDLE:** quieto mirando según la fila; leve peso a un pie; brazos a los lados; boca cerrada.
- **[r,1] WALK 1:** pierna izquierda adelante, derecha atrás; brazo izq atrás, der adelante; cuerpo inclina 3px a la derecha; accesorio principal oscila a la izquierda; ambos pies visibles.
- **[r,2] WALK PASSING:** pies casi juntos a nivel de suelo; brazos a media oscilación pegados al cuerpo; cuerpo erguido con leve inclinación frontal; **distinto del idle**.
- **[r,3] WALK 3:** pierna derecha adelante, izquierda atrás; brazo der atrás, izq adelante; cuerpo inclina 3px a la izquierda; accesorio oscila a la derecha; espejo de peso del [r,1].
- **[r,4] DEATH:** cuerpo horizontal llenando el ancho; ojos en X; boca en "O"; accesorios desprendidos a un lado; brazos abiertos. (Fila ABAJO = boca arriba; Fila DERECHA = de costado; Fila ARRIBA = boca abajo con accesorio encima.)

---

### 1.1 El Becario  *(referencia maestra — define el formato)*

```
Pixel art sprite sheet, transparent background (PNG alpha, NO background color).
Grid of exactly 5 columns x 3 rows. Total image 240x144px. Each frame exactly 48x48px.
Zero padding, zero gap, zero border between frames. Frames perfectly grid-aligned.

CHARACTER (consistent across ALL 15 frames):
Young office intern boy, chibi proportions, head 40% of body height, large round head.
Warm tan skin, brown messy hair sticking up slightly, white shirt slightly too big,
short red tie crooked and off-center, dark navy pants, small brown rounded shoes,
large blue backpack with two shoulder straps and one side pocket.
Nervous expression: wide circular white eyes, small dot pupils, tiny sweat drop on left temple.

ANCHOR (every frame): feet touch the bottom edge; horizontally centered; occupies ~38x44 of 48x48.
ROW 1 FACING DOWN · ROW 2 FACING RIGHT (side profile) · ROW 3 FACING UP (back to viewer).
COLUMNS per row: [0] idle, [1] walk left-foot-forward, [2] walk passing (must differ from idle),
[3] walk right-foot-forward (mirror weight of [1]), [4] death (X eyes, mouth O, backpack detached).
Row1 death = lying face-up filling frame width. Row2 death = fallen on right side. Row3 death = face-down, backpack on top.

STYLE: clean pixel art, Brotato aesthetic, exactly 2px black outline on all edges, flat colors only,
no gradients, no anti-aliasing, no dithering, no drop shadow (only 3px ground ellipse under feet),
constant head size across all frames, walk cycle shows 4 clearly different leg positions.
PALETTE (exact, all frames): skin #E8A87C, hair #8B4513, shirt #F5F5F5, tie #CC2200,
pants #1A237E, shoes #4A3728, backpack #1565C0.
```

---

### 1.2 El Freelancer

```
Pixel art sprite sheet, transparent background (PNG alpha, NO background color).
Grid 5 columns x 3 rows. Total 240x144px. Each frame exactly 48x48px.
Zero padding/gap/border. Frames perfectly grid-aligned.

CHARACTER (consistent across ALL 15 frames):
Relaxed freelancer, chibi proportions, head 40% of body height, large round head.
Warm tan skin, dark messy hair partly hidden under an oversized grey hoodie with the hood down,
big over-ear headphones around the neck/ears, a thin silver laptop tucked under the LEFT arm,
baggy dark-grey joggers, white chunky sneakers. Cool, half-lidded uninterested eyes,
small smirk, no office clothing. NO backpack, NO tie.

ANCHOR (every frame): feet touch bottom edge; horizontally centered; ~38x44 of 48x48.
ROW 1 FACING DOWN · ROW 2 FACING RIGHT (side profile) · ROW 3 FACING UP (back, hoodie + headphone band visible).
COLUMNS: [0] idle (laptop under arm, headphones on), [1] walk left-foot-fwd (hoodie + laptop sway left,
free arm swings), [2] walk passing (feet near together, arm mid-swing, differs from idle),
[3] walk right-foot-fwd (mirror of [1], sway right), [4] death (X eyes, mouth O,
laptop fallen/detached to the side, headphones slipped off). Row2 death = on right side;
Row3 death = face-down with hoodie bunched up.

STYLE: clean pixel art, Brotato aesthetic, exactly 2px black outline, flat colors only,
no gradients/AA/dithering, no drop shadow (only 3px ground ellipse), constant head size,
4 distinct walk leg positions.
PALETTE (exact): skin #E8A87C, hair #3E2723, hoodie #607D8B, hoodie-shadow #455A64,
headphones #263238, laptop body #B0BEC5, laptop screen #4FC3F7, joggers #37474F, sneakers #ECEFF1.
```

---

### 1.3 El Director

```
Pixel art sprite sheet, transparent background (PNG alpha, NO background color).
Grid 5 columns x 3 rows. Total 240x144px. Each frame exactly 48x48px.
Zero padding/gap/border. Frames perfectly grid-aligned.

CHARACTER (consistent across ALL 15 frames):
Corporate director, chibi proportions, head 40% of body height, large round head.
Warm tan skin, slick black hair perfectly combed with ONE rebellious strand sticking up,
thin black mustache, immaculate navy-blue power suit jacket over a white shirt,
bold red tie straight and centered, sharp dark shoes. Smug superior expression:
narrowed confident eyes, raised eyebrow, small arrogant grin. Stands tall (slightly taller silhouette).

ANCHOR (every frame): feet touch bottom edge; horizontally centered; ~38x44 of 48x48.
ROW 1 FACING DOWN · ROW 2 FACING RIGHT (side profile, tie hanging down front) · ROW 3 FACING UP (back of jacket, slick hair, collar).
COLUMNS: [0] idle (one hand adjusting tie/lapel), [1] walk left-foot-fwd (jacket tails sway left,
confident stride), [2] walk passing (feet near together, arm mid-swing, differs from idle),
[3] walk right-foot-fwd (mirror of [1], sway right), [4] death (X eyes, mouth O,
suit jacket flopped open, red tie flung to one side). Row2 death = on right side;
Row3 death = face-down, jacket splayed.

STYLE: clean pixel art, Brotato aesthetic, exactly 2px black outline, flat colors only,
no gradients/AA/dithering, no drop shadow (only 3px ground ellipse), constant head size,
4 distinct walk leg positions. The rebellious hair strand keeps the same shape in every frame.
PALETTE (exact): skin #E8A87C, hair #212121, mustache #212121, suit #1A237E,
shirt #FFFFFF, tie #C62828, shoes #1B1B1B.
```

---

### 1.4 El de RRHH

```
Pixel art sprite sheet, transparent background (PNG alpha, NO background color).
Grid 5 columns x 3 rows. Total 240x144px. Each frame exactly 48x48px.
Zero padding/gap/border. Frames perfectly grid-aligned.

CHARACTER (consistent across ALL 15 frames):
HR representative, chibi proportions, head 40% of body height, large round head.
Warm tan skin, neat brown bob hair, rectangular glasses, salmon/pink blazer over a white blouse,
dark pencil skirt, simple flats. A large white ID badge on a red lanyard around the neck,
and a dark tablet held in both hands at chest height. Expression: friendly but unsettling —
wide fixed smile, eyes slightly too calm behind the glasses.

ANCHOR (every frame): feet touch bottom edge; horizontally centered; ~38x44 of 48x48.
ROW 1 FACING DOWN · ROW 2 FACING RIGHT (side profile, lanyard + badge hang at side) · ROW 3 FACING UP (back of blazer, bob hair, lanyard clip visible).
COLUMNS: [0] idle (holding tablet, smiling), [1] walk left-foot-fwd (blazer + lanyard sway left,
tablet stays at chest), [2] walk passing (feet near together, slight lean, differs from idle),
[3] walk right-foot-fwd (mirror of [1], sway right), [4] death (X eyes BUT the smile REMAINS,
tablet fallen to the side, glasses askew, badge flopped). Row2 death = on right side;
Row3 death = face-down, blazer splayed.

STYLE: clean pixel art, Brotato aesthetic, exactly 2px black outline, flat colors only,
no gradients/AA/dithering, no drop shadow (only 3px ground ellipse), constant head size,
4 distinct walk leg positions. The smile is identical in every frame (including death).
PALETTE (exact): skin #E8A87C, hair #4E342E, glasses #263238, blazer #F48FB1,
blouse #FFFFFF, skirt #4E342E, lanyard #C62828, badge #FFFFFF, tablet #37474F, tablet-screen #80DEEA.
```

---

### 1.5 El Consultor Externo

```
Pixel art sprite sheet, transparent background (PNG alpha, NO background color).
Grid 5 columns x 3 rows. Total 240x144px. Each frame exactly 48x48px.
Zero padding/gap/border. Frames perfectly grid-aligned.

CHARACTER (consistent across ALL 15 frames):
External consultant, chibi proportions, head 40% of body height, large round head.
Warm tan skin, well-groomed slicked-back brown hair, expensive light-grey tailored suit,
slate-grey tie, oversized shiny gold wristwatch on the left wrist, a green money bill
peeking out of the breast pocket, polished black shoes. Carries a GOLD briefcase in the right hand.
Expression: smug "I charge by the hour" — half-smile, one eyebrow up, relaxed confident eyes.

ANCHOR (every frame): feet touch bottom edge; horizontally centered; ~38x44 of 48x48.
ROW 1 FACING DOWN (briefcase in front of right leg) · ROW 2 FACING RIGHT (side profile, briefcase swings) · ROW 3 FACING UP (back of grey jacket, briefcase handle visible).
COLUMNS: [0] idle (briefcase held, watch glinting), [1] walk left-foot-fwd (briefcase swings forward,
jacket sways left), [2] walk passing (feet near together, arm mid-swing, differs from idle),
[3] walk right-foot-fwd (mirror of [1], briefcase swings back), [4] death (X eyes, mouth O,
gold briefcase popped open with money bills spilling out beside the body, watch still shiny).
Row2 death = on right side; Row3 death = face-down, jacket splayed, briefcase beside.

STYLE: clean pixel art, Brotato aesthetic, exactly 2px black outline, flat colors only,
no gradients/AA/dithering, no drop shadow (only 3px ground ellipse), constant head size,
4 distinct walk leg positions. The gold watch and gold briefcase keep the same bright gold in every frame.
PALETTE (exact): skin #E8A87C, hair #5D4037, suit #90A4AE, tie #455A64, shirt #FFFFFF,
shoes #212121, briefcase #FFC107, watch #FFD700, money-bill #66BB6A.
```

---

## 2. ENEMIGOS

> Formato común: **spritesheet 4 columnas × 3 filas = 12 frames. Fondo transparente.**
> Normales: **32×32px/frame → total 128×96px.** Élites: **48×48px/frame → total 192×144px.**
> Filas = direcciones, igual que los personajes: **Fila 1 ABAJO (hacia el espectador), Fila 2 DERECHA (perfil),
> Fila 3 ARRIBA (de espaldas).** La dirección IZQUIERDA se obtiene espejando la Fila 2 en el engine.
> Columnas: **[0] idle · [1] move/walk 1 · [2] move/walk 2 · [3] death.**
> Anclaje: base toca el borde inferior, centrado; sombra elipse 3px (omitir en el frame de muerte).
> [1] y [2] deben mostrar posiciones **claramente distintas**. La muerte se orienta según la fila
> (ABAJO = cae boca arriba; DERECHA = cae de costado; ARRIBA = cae boca abajo).

### Plantilla por frame (común a los 6 enemigos)
- **[r,0] IDLE:** quieto mirando según la fila, con su micro-animación propia (humo pulsa, escribe, vibra…).
- **[r,1] MOVE 1:** primera fase de avance (pie izq adelante / aleteo arriba / flotar arriba); accesorio o efecto oscila a la izquierda.
- **[r,2] MOVE 2:** segunda fase distinta (pie der adelante / aleteo abajo / flotar abajo); efecto oscila a la derecha.
- **[r,3] DEATH:** orientado por fila — cuerpo/objeto horizontal o reventado; efecto de muerte propio (explota, se desinfla, papeles).

---

### 2.1 Angry Email — normal, 32×32 (128×96)

```
Pixel art sprite sheet, transparent background (PNG alpha, NO background color).
Grid 4 columns x 3 rows = 12 frames. Each frame exactly 32x32px. Total image 128x96px.
Zero padding, zero gap, zero border. Frames perfectly grid-aligned.
SUBJECT (consistent across all 12 frames): angry email enemy, top-down 3/4 cartoon. A white letter
envelope with a furious face (angry slanted eyebrows, small white eyes with dot pupils, gritted mouth),
two small paper wings on the sides, red "URGENT" stamp lines on the front flap, faint grey steam puffs.
ROW 1 FACING DOWN (face/flap toward viewer) · ROW 2 FACING RIGHT (envelope side profile, one wing visible,
face turned right) · ROW 3 FACING UP (back of the envelope, seam + wings from behind, no face).
COLUMNS per row: [0] idle (trembling, wings half-open), [1] flap up (wings up, lifted higher, steam left),
[2] flap down (wings down, dipped lower, steam right) — [1]/[2] clearly different,
[3] death (envelope torn, bursting into paper scraps + small puff; oriented per row).
ANCHOR: hovers near the bottom edge, horizontally centered, 3px ground ellipse (omit on death).
STYLE: 2px black outline, flat colors only, no gradients/AA/dithering/shadow. Constant size across frames.
PALETTE (exact): envelope #F5F5F5, envelope-shadow #E0E0E0, urgent-lines #E53935, eyes #FFFFFF,
pupils/brows #212121, wings #FAFAFA, steam #BDBDBD.
```

### 2.2 Angry Client — normal, 32×32 (128×96)

```
Pixel art sprite sheet, transparent background (PNG alpha, NO background color).
Grid 4 columns x 3 rows = 12 frames. Each frame exactly 32x32px. Total 128x96px.
Zero padding/gap/border, frames perfectly grid-aligned.
SUBJECT (consistent across all 12 frames): angry client enemy, top-down 3/4 cartoon. Casual-shirt figure,
chibi head, bright red enraged face with bulging eyes, cartoon flames flickering above the head,
one arm jabbing a finger aggressively.
ROW 1 FACING DOWN (finger jabs toward viewer) · ROW 2 FACING RIGHT (side profile, finger points right) ·
ROW 3 FACING UP (back of figure, flames above head from behind, back of casual shirt).
COLUMNS: [0] idle (finger wagging, flames small), [1] lunge step (leaning forward, finger thrust, flames tall,
one foot forward), [2] recover step (upright, finger back, flames medium, other foot forward) — clearly different,
[3] death (deflates like a balloon, flames puff out; oriented per row).
ANCHOR: feet at bottom edge, centered, 3px ground ellipse (omit on death).
STYLE: 2px black outline, flat colors, no gradients/AA/dithering/shadow. Constant head size across frames.
PALETTE (exact): shirt #29B6F6, face #EF5350, eyes #FFFFFF, pupils/brows #212121, flames #FF7043,
flames-tip #FFCA28, hand-skin #E8A87C, hair #4E342E.
```

### 2.3 Toxic Manager — élite, 48×48 (192×144)

```
Pixel art sprite sheet, transparent background (PNG alpha, NO background color).
Grid 4 columns x 3 rows = 12 frames. Each frame exactly 48x48px. Total 192x144px.
Zero padding/gap/border, frames perfectly grid-aligned.
SUBJECT (consistent across all 12 frames): toxic manager elite, top-down 3/4 cartoon. Stocky human in a
dark suit, bright red angry face with a bulging forehead vein, gritted teeth, constantly emitting green
toxic smoke from the shoulders. Holds a black briefcase with a yellow biohazard symbol. Bigger than the player.
ROW 1 FACING DOWN · ROW 2 FACING RIGHT (side profile, briefcase swings at side) · ROW 3 FACING UP (back of suit, smoke from shoulders, briefcase handle visible).
COLUMNS: [0] idle (smoke pulsing, fists clenched), [1] stomp 1 (left foot forward, smoke billows left,
briefcase swings forward), [2] stomp 2 (right foot forward, smoke billows right, briefcase swings back) — clearly different,
[3] death (suit collapses, bursts into a green toxic cloud; oriented per row).
ANCHOR: feet at bottom edge, centered, 3px ground ellipse (omit on death).
STYLE: 2px black outline, flat colors, no gradients/AA/dithering/shadow. Constant head size across frames.
PALETTE (exact): suit #263238, face #E53935, vein #B71C1C, teeth #FFFFFF, smoke #76FF03,
smoke-dark #558B2F, briefcase #1B1B1B, biohazard #CDDC39, skin #E8A87C.
```

### 2.4 HR Representative — élite, 48×48 (192×144)

```
Pixel art sprite sheet, transparent background (PNG alpha, NO background color).
Grid 4 columns x 3 rows = 12 frames. Each frame exactly 48x48px. Total 192x144px.
Zero padding/gap/border, frames perfectly grid-aligned.
SUBJECT (consistent across all 12 frames): HR representative elite enemy, top-down 3/4 cartoon.
Enemy version of the HR player: dark navy blazer (colder), rectangular glasses, neat brown bob hair,
holding a brown clipboard with white paper. Serious, threatening flat smile. A translucent light-blue
SLOW-AURA ring on the ground around the base in every frame.
ROW 1 FACING DOWN · ROW 2 FACING RIGHT (side profile, clipboard held to the front) · ROW 3 FACING UP (back of blazer, bob hair, clipboard edge visible).
COLUMNS: [0] idle (writing on clipboard, aura steady), [1] step 1 (left foot forward, aura pulses wider),
[2] step 2 (right foot forward, aura pulses narrower) — clearly different,
[3] death (papers fly everywhere, glasses fall; oriented per row; aura fades).
ANCHOR: feet at bottom edge, centered; the aura ring is part of the sprite.
STYLE: 2px black outline, flat colors, no gradients/AA/dithering. The aura ring is the ONLY semi-transparent element.
PALETTE (exact): blazer #1A237E, blouse #FFFFFF, hair #4E342E, glasses #263238, skin #E8A87C,
clipboard #8D6E63, paper #FFFFFF, aura #4FC3F7 (≈40% alpha).
```

### 2.5 Possessed Printer — élite, 48×48 (192×144)

```
Pixel art sprite sheet, transparent background (PNG alpha, NO background color).
Grid 4 columns x 3 rows = 12 frames. Each frame exactly 48x48px. Total 192x144px.
Zero padding/gap/border, frames perfectly grid-aligned.
SUBJECT (consistent across all 12 frames): possessed office printer elite, top-down 3/4 cartoon.
A boxy office printer floating slightly off the ground, two glowing red eyes on the front face,
sheets of paper spiraling out forming clawed shapes, static-electricity sparks crackling around it.
ROW 1 FACING DOWN (eyes + paper slot toward viewer) · ROW 2 FACING RIGHT (printer side profile, paper claws to the right) · ROW 3 FACING UP (back of printer, cables + paper tray from behind, no eyes).
COLUMNS: [0] idle (humming, hovering low, claws curled), [1] hover up (lifts higher, claws spread, sparks left),
[2] hover down (dips lower, claws curl, sparks right) — clearly different,
[3] death (explodes into flying paper sheets + black toner puff; oriented per row).
ANCHOR: hovers near the bottom edge, centered, faint 3px ground ellipse (omit on death).
STYLE: 2px black outline, flat colors, no gradients/AA/dithering/shadow. Constant body size across frames.
PALETTE (exact): printer-body #B0BEC5, printer-dark #78909C, eyes #FF1744, paper #FFFFFF,
sparks #FFEB3B, sparks-cool #00E5FF, toner #212121.
```

### 2.6 Auditor — élite, 48×48 (192×144) (+ escudo separado)

```
Pixel art sprite sheet, transparent background (PNG alpha, NO background color).
Grid 4 columns x 3 rows = 12 frames. Each frame exactly 48x48px. Total 192x144px.
Zero padding/gap/border, frames perfectly grid-aligned.
SUBJECT (consistent across all 12 frames): auditor elite enemy, top-down 3/4 cartoon. Cartoon "Men in Black":
all-black suit, black tie, opaque dark sunglasses, blank implacable expressionless face, stiff robotic posture,
carrying a black briefcase. Bigger than the player.
ROW 1 FACING DOWN · ROW 2 FACING RIGHT (side profile, briefcase at side) · ROW 3 FACING UP (back of black suit, back of head, briefcase handle visible).
COLUMNS: [0] idle (staring straight, motionless), [1] step 1 (left foot forward, robotic stiff stride),
[2] step 2 (right foot forward, robotic stiff stride) — clearly different,
[3] death (empty suit collapses, nothing inside, sunglasses drop; oriented per row).
ANCHOR: feet at bottom edge, centered, 3px ground ellipse (omit on death).
STYLE: 2px black outline, flat colors, no gradients/AA/dithering/shadow. Constant head size across frames.
PALETTE (exact): suit #212121, tie #000000, shirt #FFFFFF, sunglasses #000000, lens-glint #455A64,
briefcase #000000, skin #E8A87C.
```

**Escudo de invencibilidad (asset separado):**
```
Pixel art overlay sprite, transparent background, single frame 48x48px (matches auditor frame).
A gold/yellow translucent hexagonal energy shield bubble, hex-grid pattern, soft glowing edge.
Centered, surrounds where the auditor stands. 2px gold outline. Flat colors, ≈45% alpha fill.
No character inside (overlay only). Used over the auditor during its first 3 seconds.
PALETTE: shield-fill #FFD700 (≈45% alpha), shield-edge #FFC107, hex-lines #FFECB3.
```

---

## 3. JEFE: CEO

> Formato: **spritesheet 8 columnas × 1 fila = 8 frames. 96×96px/frame → total 768×96px. Fondo transparente.**
> Columnas: **[0] idle A · [1] idle B · [2] ataque memo · [3] ataque reunión · [4] ataque carga ·
> [5] transición a Fase 2 · [6] death A · [7] death B.** Contorno negro 3px (excepción de grosor).
>
> **Nota de dirección:** a diferencia de personajes/enemigos, el CEO **no usa filas direccionales**.
> Es un jefe que siempre encara al jugador (vista ABAJO), por lo que la hoja prioriza **estados de
> ataque/fase** en una sola fila en vez de un ciclo de caminado en 4 direcciones. Si se quisiera
> movimiento direccional, se añadiría una hoja de walk aparte (4×3) — pero no es necesaria para el diseño actual.

```
Pixel art sprite sheet, transparent background (PNG alpha, NO background color).
8 columns x 1 row, each frame exactly 96x96px, total 768x96px. Zero padding/gap/border, grid-aligned.
SUBJECT: CEO final boss, top-down 3/4 cartoon, MUCH larger than regular characters. A giant figure in a
silver-and-gold power suit, a small gold corporate crown, holding a red laser-pointer as a scepter.
Megalomaniac face: huge confident grin, glowing ego. In PHASE 2 the suit cracks open revealing the
inside is made of green glowing data/code (glitch effect).
FRAMES: [0] idle A (breathing in, crown steady, scepter up), [1] idle B (breathing out, slight bob),
[2] attack "memo" (thrusts scepter forward, red laser flash from tip), [3] attack "reunión" (arms raised
summoning, small email icons swirling), [4] attack "carga/charge" (crouched wind-up, leaning forward, motion lines),
[5] phase-2 transition (suit cracking apart, green code/glitch bursting through seams, eyes turn green),
[6] death A (suit blown open, imploding inward, green code leaking), [7] death B (collapsed into a pile of
gold coins). Anchor: feet at bottom edge, centered, large 3px ground ellipse (omit on death B).
STYLE: clean pixel art, Brotato aesthetic, 3px black outline (boss exception), flat colors,
no gradients/AA/dithering, no body drop shadow. Crown gold stays identical every frame.
PALETTE: suit-silver #B0BEC5, suit-gold #FFD700, crown #FFC107, scepter #9E9E9E, laser #FF1744,
skin #E8A87C, hair #3E2723, glitch-code #00E676, coins #FFD700.
```

**Barra de vida del CEO (UI, asset separado):**
```
Pixel art UI element, transparent background, single frame 400x20px.
Horizontal boss HP bar: dark-red rounded border (3px), bright red fill, a small corporate-logo
placeholder square on the left, the word area kept clean (text added in engine). Flat cartoon, no gradients.
PALETTE: fill #E53935, border #7F0000, logo #FFD54F.
```

---

## 4. ARMAS (PROYECTILES)

> Formato: **PNG individual, fondo transparente, 1 frame.** Orientados a **0° (apuntando a la derecha)**;
> el engine los rota. Contorno negro **1–2px**. Sin sombra. Silueta legible a tamaño pequeño.

**Prompt base:**
```
Pixel art projectile sprite, transparent background (PNG alpha, NO background color),
single frame [W]x[H]px, exact size, no padding. [DESCRIPCIÓN]. Cartoon office style, facing right (0°).
1px black outline (small sprite), flat colors only, no gradients/AA/dithering/shadow. Centered, clear silhouette.
PALETTE: [HEX...].
```

| Asset | Tamaño | Descripción + paleta |
|-------|--------|----------------------|
| Proyectil café | 16×16 | Gota de café marrón estilizada con vapor blanco. `café #6F4E37, vapor #ECEFF1` |
| Proyectil grapa | 8×8 | Grapa metálica en forma de U, gris. `metal #9E9E9E, sombra #616161` |
| Haz debug laser (tile) | 16×64 | Línea vertical verde/cian repetible con glow suave. `core #00E676, glow #69F0AE` |
| Post-it volador | 16×16 | Post-it amarillo plegado como avión de papel. `post-it #FFEB3B, pliegue #FBC02D` |
| Diapositiva PowerPoint | 24×16 | Mini slide blanco con gráfica fea y borde azul. `slide #FFFFFF, borde #1565C0, gráfica #EF5350` |
| Trazo de marcador | 16×16 | Mancha circular irregular de marcador azul-negro. `marcador #1A237E` |
| Tecla de teclado | 16×16 | Tecla cuadrada gris vista desde arriba con letra. `tecla #ECEFF1, lateral #B0BEC5, letra #212121` |
| Splash de agua | 20×20 | Salpicadura azul en forma de asterisco. `agua #29B6F6, brillo #B3E5FC` |
| Chorro de extintor | 32×16 | Nube de CO2 blanca en cono horizontal. `nube #FFFFFF, borde #CFD8DC` |
| Papel de impresora | 12×16 | Hoja blanca con líneas, esquina doblada. `papel #FFFFFF, líneas #90A4AE` |

---

## 5. EFECTOS VISUALES

> Formato: **spritesheet horizontal de 1 fila, N frames, fondo transparente.** Ciclo único (sin loop)
> salvo donde se indique. Zero padding/gap/border, alineado a grid.

**Prompt base:**
```
Pixel art effect animation sprite sheet, transparent background (PNG alpha, NO background color).
[N] columns x 1 row, each frame [TAMAÑO]px exact, total [N*W]x[H]px. Zero padding/gap/border, grid-aligned.
[DESCRIPCIÓN DEL EFECTO, frame por frame de pequeño a grande]. Cartoon style, 2px outline, flat vivid colors,
no gradients/AA/dithering. Single play cycle (not looping) unless specified. PALETTE: [HEX...].
```

| Asset | Frames | Tamaño | Descripción (progresión) + paleta |
|-------|--------|--------|-----------------------------------|
| Muerte enemigo normal | 5 | 32×32 | Anillo que se expande + estrellitas + fade. `flash #FFFFFF, estrellas #FFEB3B` |
| Muerte enemigo élite | 7 | 48×48 | Explosión mayor + papeles volando + humo. `flash #FFFFFF, papel #FFFFFF, humo #BDBDBD` |
| Impacto de proyectil | 4 | 16×16 | Destello blanco pequeño que aparece y se apaga. `flash #FFFFFF, chispa #FFF59D` |
| Pickup de moneda | 4 | 16×16 | Brillo dorado giratorio (+ destellos). `oro #FFD700, brillo #FFF59D` |
| Pickup de café | 5 | 24×24 | Vapor marrón ascendente que se disipa. `vapor #D7CCC8, traza #8D6E63` |
| Level up | 6 | 48×48 | Destello amarillo + corona de estrellas hacia afuera. `flash #FFEB3B, estrellas #FFFFFF` |
| Burnout activado | 4 | 64×64 | Onda roja que se expande desde el centro y se desvanece. `onda #F44336, borde #FF8A80` |
| Zona tóxica (loop) | 4 | 48×48 | Burbujeo verde **en loop** (líquido tóxico). `líquido #76FF03, burbuja #B9F6CA` |

---

## 6. PICKUPS (OBJETOS RECOGIBLES)

> Formato: **spritesheet 2 columnas × 1 fila = 2 frames. 16×16px/frame → total 32×16px. Fondo transparente.**
> Frame 1 posición normal, Frame 2 levemente elevado (bounce). Contorno 1–2px.

**Prompt base:**
```
Pixel art pickup sprite, transparent background (PNG alpha, NO background color).
2 columns x 1 row, 16x16px each, total 32x16px. Zero padding/gap/border, grid-aligned.
[DESCRIPCIÓN]. Frame 1: resting. Frame 2: raised ~2px (bounce). Cartoon office style, 1px black outline,
flat vivid colors, no gradients/AA/dithering/shadow. PALETTE: [HEX...].
```

> **Los 4 pickups del engine** (`PickupKind`): café, galleta, moneda, estrés. Los demás son opcionales.

| Asset | Engine | Descripción + paleta |
|-------|--------|----------------------|
| Café | ✓ `cafe` | Vaso de café con tapa y vapor. `vaso #6F4E37, tapa #D7CCC8, vapor #ECEFF1` |
| Galleta | ✓ `galleta` | Galleta redonda con un mordisco y chispas. `galleta #C8A165, chispas #4E342E` |
| Moneda | ✓ `moneda` | Moneda dorada con símbolo "$". `oro #FFD700, borde #FFA000, símbolo #FFF8E1` |
| Pickup de Estrés | ✓ `stress` | Pelota antiestrés azul (calma), brillo suave; baja el estrés. `pelota #44AAFF, brillo #B3E5FC` |
| Orbe de XP | opcional | Esfera azul brillante (XP es instantánea en el engine actual; no se usa como pickup). `orbe #2196F3, brillo #BBDEFB` |

> Coherencia con engine: el **pickup de estrés** usa azul **#44AAFF** (= `COLORS_GAME.PICKUP_STRESS`).
> El extintor es un objeto de mapa destructible (sección 7), no un pickup de suelo.

---

## 7. ELEMENTOS DE MAPA

> Formato: **PNG individual, fondo transparente, 1 frame.** Vista top-down 3/4. Bordes tile-friendly donde aplique.
> Contorno negro 2px. Sin sombra (la genera el engine).

**Prompt base:**
```
Pixel art top-down tileset element, transparent background (PNG alpha, NO background color),
single frame [TAMAÑO]px exact, no padding. [DESCRIPCIÓN]. Corporate office environment,
slightly angled 3/4 top-down view. Flat colors, 2px black outline, no gradients/AA/dithering/shadow.
Tile-friendly edges where applicable. PALETTE: [HEX...].
```

| Asset | Tamaño | Descripción + paleta |
|-------|--------|----------------------|
| Escritorio | 64×32 | Escritorio gris con monitor apagado encima. `mesa #9E9E9E, top #BDBDBD, monitor #37474F` |
| Archivador | 32×48 | Archivador metálico gris con 3 cajones. `metal #78909C, cajón #90A4AE, tirador #455A64` |
| Planta de oficina | 32×32 | Planta verde algo marchita en maceta gris. `hojas #4CAF50, hoja-seca #8D6E63, maceta #9E9E9E` |
| Cafetera (mapa) | 32×32 | Cafetera de cristal con café y luz verde activa. `base #455A64, cristal #B3E5FC, café #6F4E37, luz #69F0AE` |
| Máquina expendedora | 32×48 | Máquina de snacks con pantalla brillante. `cuerpo #3949AB, vidrio #B3E5FC, snacks #FFEB3B` |
| Extintor de pared | 16×32 | Extintor en soporte de pared — **cian** (coherente con engine). `cuerpo #00BCD4, soporte #ECEFF1, manómetro #FFFFFF` |
| Suelo de oficina (tile) | 32×32 | Moqueta gris/azul corporativa, patrón sutil, **seamless**. `moqueta #4E5A6B, patrón #424E5E` |
| Pared (tile) | 32×32 | Pared beige desgastada, **seamless**. `pared #D7CCB8, sombra #BCAE96` |

---

## 8. INTERFAZ (UI)

> Formato: **PNG individual, fondo transparente** (salvo el fondo semitransparente). Estilo flat cartoon corporativo.
> Anchos de barra coherentes con el HUD del engine: **HP/Estrés 200px, XP 400px**.

| Asset | Tamaño | Prompt/descripción |
|-------|--------|--------------------|
| Frame barra HP | 200×16 | Marco rojo de barra, esquinas redondeadas, 2px outline. `borde #7F0000, relleno #E53935` |
| Frame barra Estrés | 200×16 | Igual al de HP pero sin color de relleno (color dinámico en engine). `borde #5D4037, relleno neutro #3E3E2E` |
| Frame barra XP | 400×10 | Marco azul fino, más delgado que HP. `borde #0D47A1, relleno #2196F3` |
| Icono moneda | 16×16 | Moneda dorada simple con "$". `oro #FFD700, símbolo #FFF8E1` |
| Icono reloj | 16×16 | Reloj de pared de oficina. `marco #455A64, esfera #FFFFFF, agujas #212121` |
| Icono oleada | 16×16 | Sobre de email con número. `sobre #F5F5F5, líneas #E53935` |
| Panel selección de ítem | 200×280 | Tarjeta con borde de rareza — generar **4 variantes**: común gris `#9E9E9E`, raro azul `#2196F3`, épico púrpura `#9C27B0`, legendario ámbar `#FFB300`. Fondo de tarjeta `#1A1A2E`. |
| Botón UI genérico | 320×40 (2 estados) | Estilo pestaña de carpeta de archivo. 2 frames horizontales: normal + hover (más claro). `normal #455A64, hover #5C7080, texto #FFFFFF` |
| Logo OFFICE SURVIVOR | 400×80 | Ver prompt abajo. |
| Fondo semitransparente | 1×1 | Negro al 60% alpha (se escala en engine). `#000000 @ 60% alpha` |

**Prompt logo:**
```
Pixel art game logo, transparent background (PNG alpha), 400x80px exact. Text "OFFICE SURVIVOR"
in bold chibi cartoon letters. Letters styled as chaotic office elements: some made of paper,
some with coffee stains, some shaped like spreadsheet cells. Corporate-parody style.
2px black outline, vivid flat colors, no gradients. PALETTE: ink #212121, paper #F5F5F5,
coffee #6F4E37, cell-blue #2196F3, accent-red #E53935.
```

**Prompt botón (hoja de 2 estados):**
```
Pixel art UI button sprite sheet, transparent background, 2 columns x 1 row, 160x40px each,
total 320x40px, zero padding/gap. Styled as an office file-folder tab. Frame 1: normal,
frame 2: hover (slightly brighter). Flat cartoon corporate, 2px black outline, no gradients.
PALETTE: normal #455A64, hover #5C7080, tab-edge #263238, text-area clean.
```

---

## 9. FONDOS

> Formato: **PNG SÓLIDO (sin transparencia), 960×540px** (resolución base, se escala).
> (Excepción a la regla de transparencia: los fondos son opacos por definición.)

**Fondo de juego:**
```
Pixel art top-down office floor background, opaque (no transparency), 960x540px exact.
Open-plan corporate office from above, slight 3/4 angle. Grey/blue carpet with subtle grid pattern.
Low empty cubicle dividers creating sections. Faint fluorescent-light brighter patches.
No characters, no furniture (separate sprites). Flat cartoon, muted corporate colors, seamless-friendly.
PALETTE: carpet #4E5A6B, grid #424E5E, divider #6D7B8D, light-patch #59667A.
```

**Fondo menú principal:**
```
Pixel art corporate building exterior, opaque, 960x540px exact. Generic grey office building at dusk.
Cartoon, slightly exaggerated. Some windows lit warm, some dark. A sign reads "CORP." Small trees out front.
Flat colors, minimal detail, dusk sky from orange to dark blue. Corporate-parody tone.
PALETTE: building #607D8B, windows-lit #FFD54F, windows-dark #263238, sky-top #1A237E, sky-bottom #FF7043, trees #2E7D32.
```

**Fondo Game Over:**
```
Pixel art abandoned office desk scene, opaque, 960x540px exact. A dim cubicle: scattered papers,
a spilled coffee cup, a dark monitor, dramatic low lighting from one side. Cartoon, muted, melancholic.
PALETTE: desk #6D4C41, papers #F5F5F5, coffee #6F4E37, shadow #1B1B1B, rim-light #455A64.
```

**Fondo Victoria:**
```
Pixel art trashed-but-triumphant office, opaque, 960x540px exact. The same office wrecked: papers
flying, corporate confetti, knocked-over chairs, bright celebratory light. Cartoon, vivid, festive.
PALETTE: floor #4E5A6B, confetti #FFD700/#E53935/#2196F3, papers #FFFFFF, light #FFF59D.
```

---

## 10. ICONOS DE ÍTEMS (58)

> **42 ítems + 10 armas + 6 maldiciones = 58 íconos.**
> Formato: **PNG individual, fondo transparente, 1 frame, 32×32px.** Generar **por lotes de rareza**
> para mantener consistencia. Objeto centrado con pequeño margen, silueta clara a tamaño chico, 1–2px outline.

**Prompt base:**
```
Pixel art item icon, transparent background (PNG alpha, NO background color), single frame 32x32px exact,
small even margin, object centered. [DESCRIPCIÓN DEL OBJETO]. Corporate office cartoon style.
2px black outline, vivid flat colors, no gradients/AA/dithering/shadow. Clear silhouette at 32px.
[Borde de rareza opcional: thin colored inner glow → común gris, raro azul, épico púrpura, legendario ámbar].
```

### Lote 1 — Comunes (borde sutil gris) — 13
Café Solo: vaso espresso humeante · Lapicero Roto: lápiz partido con tinta · Stack de Post-its: pila de post-its con flecha · Auriculares: cascos de diadema grises · Hoja de Excel: hoja con celdas y fórmula · Termo: termo gris con logo · Grapas Extra: caja de grapas abierta · Galleta de Empresa: galleta con mordisco y logo · Badge de Visitante: tarjeta con clip "VISITOR" · Línea Directa IT: teléfono antiguo con botón rojo · **Café con Leche: vaso con café au lait y espuma clara** · **Taza Rota: taza agrietada con café derramándose** · **Moneda Olvidada: moneda suelta brillando bajo el borde de un teclado**.

### Lote 2 — Raros (borde azul) — 13
Doble Monitor: dos monitores en paralelo · Cafeína Crónica: vasos de café apilados en equilibrio · Spreadsheet God: hoja Excel con fórmulas brillando como magia · Fotocopiadora: fotocopiadora con luz verde · Modo Avión: avión de papel con burbuja-escudo · Reunión Cancelada: invitación con gran X roja · WiFi Rápido: símbolo WiFi con relámpago · Horas Extra: reloj a medianoche con monedas · PowerPoint Feo: slide con gráfica horrible y WordArt · Silla Ergonómica: silla de oficina con brillo · Backup Plan: disquete con escudo · **Reloj Roto: reloj de pulsera con cristal agrietado y manecillas sueltas** · **Auriculares NC: cascos con ondas de cancelación de ruido tachadas**.

### Lote 3 — Épicos (borde púrpura)
Modo Debug: terminal con código y cursor · Agile Sprint: tablero Kanban con tarjetas en movimiento · Carta de Renuncia: sobre sellado "RENUNCIA" · Meeting Overflow: calendario lleno explotando · LinkedIn Premium: insignia profesional con corona dorada · Inbox Zero: bandeja vacía con estrella · VPN Corporativa: candado con escudo de red · NDAs Firmadas: contrato con sello oficial · Cafetería VIP: mesa con mantel rojo y café de lujo · Benchmark: gráfica de barras con una barra altísima.

### Lote 4 — Legendarios (borde ámbar) y Maldiciones (borde negro)
**Legendarios:** YOLO: dado en 6 con llamas · Memo del CEO: memo dorado con membrete · All Hands Meeting: auditorio con presentador · Pivot: flecha girando 180° con destello · Stock Options: gráfica de acciones disparada con monedas · IPO: campana de bolsa con confeti.
**Maldiciones (borde negro + ícono ⚠):** Contrato de Exclusividad: contrato encadenado con candado dorado · Sin Vacaciones: calendario con todos los días tachados menos 1 · Micromanagement: lupa sobre una celda de Excel minúscula · Cultura Tóxica: oficina con humo verde · Horas Extra Oblig.: reloj a las 2am con luz de oficina sola · Open Office: planta abierta sin paredes con ondas de sonido.

### Lote 5 — Armas (borde según rareza del arma)
Coffee Thrower: pistola de agua que dispara café · Stapler Gun: grapadora con cargador y mira · Debug Laser: emisor de rayo verde con display de código · Post-it Launcher: lanzagranadas de post-its · PowerPoint Cannon: cañón con slides de munición · Whiteboard Marker: marcador gigante (arma c.a.c.) · Teclado Mecánico: teclado con teclas brillando · Botella Térmica: botella térmica con tapón de lanzamiento · Extintor: extintor **cian** con manómetro y palanca · Impresora Aliada: impresora con ojos amigables y estrella.

> **Paleta por rareza (borde/realce del icono):** común `#9E9E9E`, raro `#2196F3`, épico `#9C27B0`, legendario `#FFB300`, maldición `#000000`.

---

## RESUMEN DE ASSETS (v2)

| Categoría | Cant. | Formato | Tamaño base |
|-----------|-------|---------|-------------|
| Personajes jugables | 5 | Spritesheet PNG **transparente** | **240×144px (5×3 frames de 48px)** |
| Enemigos normales | 2 | Spritesheet PNG transparente | **128×96px (4×3 = 12 frames)** |
| Enemigos élite | 4 | Spritesheet PNG transparente | **192×144px (4×3 = 12 frames)** |
| Escudo auditor | 1 | PNG transparente | 48×48px |
| CEO (jefe) | 1 | Spritesheet PNG transparente | 768×96px (8 frames de estado) |
| Proyectiles | 10 | PNG transparente | 8–64px |
| Efectos | 8 | Spritesheet PNG transparente | variable |
| Pickups | 5 | Spritesheet PNG transparente | 32×16px (2 frames) |
| Elementos de mapa | 8 | PNG transparente | variable |
| UI | 10 | PNG transparente | variable |
| Fondos | 4 | PNG **sólido** (excepción) | 960×540px |
| Iconos de ítems | 58 | PNG transparente | 32×32px (42 ítems + 10 armas + 6 maldiciones) |

**Cambios clave vs v1:** fondo **transparente en todo** (excepto fondos de pantalla); personajes a
**15 frames (3 direcciones)** con anchor rule y paleta hex fija; descripción **por frame**; reglas estrictas
de grid/estilo; extintor recoloreado a **cian** para coherencia con el engine; negative prompt estándar.

## FLUJO DE TRABAJO
1. Generar con el prompt (Midjourney v6 / DALL·E 3 / SDXL + LoRA pixel art) pidiendo PNG transparente.
2. Si el alfa sale sucio: generar sobre clave **#FF00FF** y aplicar "Color to Alpha" en Aseprite/Photoshop.
3. Verificar grid exacto y recortar a la matemática de canvas indicada.
4. Bloquear la paleta exportándola del primer sprite; reusarla en el resto del set.
