// Efectos animados one-shot (hojas de sprites). key de textura = `fx_<name>`, anim = `fx_<name>`.
// frames van en orden de lectura (fila por fila). display = lado mayor en pantalla (px).

export interface EffectDef {
  cols: number;
  rows: number;
  frameW: number;
  frameH: number;
  display: number;   // lado mayor en pantalla (px) a escala base
  fps: number;
  loop?: boolean;    // true = ambiente en bucle (steam); por defecto one-shot
}

export const EFFECTS: Record<string, EffectDef> = {
  // Explosión roja al morir un enemigo (4 columnas × 1 fila).
  death: { cols: 4, rows: 1, frameW: 344, frameH: 768, display: 56, fps: 16 },
  // Moneda girando + destello al recoger (4 columnas × 2 filas).
  coin:  { cols: 4, rows: 2, frameW: 300, frameH: 448, display: 40, fps: 18 },
  // Destello blanco al morir un élite (4 columnas × 1 fila) — distinto del rojo normal.
  elite: { cols: 4, rows: 1, frameW: 300, frameH: 896, display: 72, fps: 16 },
  // Estrellas amarillas al subir de nivel (6 columnas × 1 fila, banda recortada).
  levelup: { cols: 6, rows: 1, frameW: 229, frameH: 120, display: 76, fps: 18 },
  // Vaho de café en bucle sobre la cafetera (5 columnas × 1 fila).
  steam: { cols: 5, rows: 1, frameW: 275, frameH: 768, display: 46, fps: 6, loop: true },
  // Nube tóxica verde al morir el toxic_manager (4 columnas × 1 fila).
  toxic: { cols: 4, rows: 1, frameW: 300, frameH: 896, display: 64, fps: 14 },
};

export const EFFECT_NAMES = Object.keys(EFFECTS);
