// Sprites de proyectiles (por arma) y de pickups. Mapas id->textura/escala/rotación.
// Las texturas se cargan en PreloadScene como `proj_<weaponId>` y `pickup_<kind>`.

export type ProjRot = 'none' | 'up' | 'right';

// weaponId con sprite de proyectil. display = lado mayor en pantalla (px), conservando aspecto.
// rot: orientación del arte fuente → cómo alinear con la velocidad.
//   'none' = no rota (blobs/redondos), 'up' = arte apunta hacia arriba, 'right' = arte apunta a la derecha.
export const PROJECTILE_SPRITES: Record<string, { display: number; rot: ProjRot }> = {
  coffee_thrower:    { display: 16, rot: 'none' },
  stapler_gun:       { display: 16, rot: 'none' },
  debug_laser:       { display: 34, rot: 'up' },
  postit_launcher:   { display: 20, rot: 'none' },
  powerpoint_cannon: { display: 18, rot: 'none' },
  whiteboard_marker: { display: 16, rot: 'none' },
  teclado_mecanico:  { display: 18, rot: 'none' },
  botella_termica:   { display: 18, rot: 'none' },
  extintor:          { display: 44, rot: 'none' },
  impresora_aliada:  { display: 22, rot: 'right' },
};

export const PROJECTILE_SPRITE_IDS = Object.keys(PROJECTILE_SPRITES);

// Pickups con sprite (el resto usa color placeholder). display = lado mayor en pantalla (px).
export const PICKUP_SPRITES: Record<string, { display: number }> = {
  moneda:  { display: 22 },
  cafe:    { display: 24 },
  galleta: { display: 24 },
  stress:  { display: 22 },
};

export const PICKUP_SPRITE_KINDS = Object.keys(PICKUP_SPRITES);
