import type { EnemyDefinition } from '@/types';
import { PROGRESSION } from './game.config';

export const def = (partial: Omit<EnemyDefinition, 'xpValue'>): EnemyDefinition => ({
  ...partial,
  xpValue: Math.round(partial.hp / PROGRESSION.XP_PER_HP_DIVISOR),
});

export const ENEMIES: EnemyDefinition[] = [
  def({ id: 'angry_email',       name: 'Angry Email',       hp: 20,  speed: 80,  damage: 5,  isElite: false }),
  def({ id: 'toxic_manager',     name: 'Toxic Manager',     hp: 60,  speed: 50,  damage: 12, isElite: true,  archetype: 'juggernaut', knockbackResistance: 1.0 }),
  def({ id: 'angry_client',      name: 'Angry Client',      hp: 40,  speed: 90,  damage: 8,  isElite: false, archetype: 'juggernaut', knockbackResistance: 1.0 }),
  def({ id: 'hr_rep',            name: 'HR Representative', hp: 35,  speed: 60,  damage: 10, isElite: true  }),
  def({ id: 'possessed_printer', name: 'Possessed Printer', hp: 120, speed: 30,  damage: 15, isElite: true  }),
  def({ id: 'auditor',           name: 'Auditor',           hp: 80,  speed: 40,  damage: 20, isElite: true,  archetype: 'juggernaut', knockbackResistance: 1.0 }),
  // Señora de Limpieza: lenta y resistente, empuja un carrito eléctrico de pulido que deja
  // rastro de piso pulido (zona eléctrica que daña). No élite.
  def({ id: 'cleaning_lady',     name: 'Señora de Limpieza', hp: 55,  speed: 42,  damage: 10, isElite: false }),
  // §F — Bajo tier (hp ≤ 30 → elegibles para swarm). Placeholder de color hasta tener arte.
  def({ id: 'spam_email',        name: 'Spam',               hp: 14,  speed: 95,  damage: 4,  isElite: false }),
  def({ id: 'slack_ping',        name: 'Notificación Slack', hp: 10,  speed: 120, damage: 3,  isElite: false }),
  def({ id: 'stress_ball',       name: 'Pelota Antiestrés',  hp: 22,  speed: 70,  damage: 6,  isElite: false, archetype: 'sinusoidal' }),
  def({ id: 'neg_balloon',       name: 'Globo Negativo',     hp: 16,  speed: 55,  damage: 5,  isElite: false }),
  def({ id: 'rolodex',           name: 'Rolodex',            hp: 28,  speed: 60,  damage: 8,  isElite: false }),
  // §T2 — nuevos enemigos (Ticket 2)
  // zoom_bomb: fodder que fija un dash diagonal a alta velocidad al spawnear, no re-targetea.
  def({ id: 'zoom_bomb',         name: 'Zoom Bomba',          hp: 18,  speed: 90,  damage: 12, isElite: false, archetype: 'dash' }),
  // micromanager: élite que aura-lentifica la cadencia de fuego del jugador.
  def({ id: 'micromanager',      name: 'Micromanager',        hp: 45,  speed: 45,  damage: 6,  isElite: true  }),
  // unpaid_intern: tracker rápido de baja HP — absorbe disparos delante de elites.
  def({ id: 'unpaid_intern',     name: 'Becario Sin Pagar',   hp: 12,  speed: 140, damage: 5,  isElite: false }),
];

// §F — color del placeholder (rect) para enemigos sin hoja de sprites, para distinguirlos.
export const ENEMY_COLOR: Record<string, number> = {
  spam_email: 0xdddddd,
  slack_ping: 0x9b30a0,
  stress_ball: 0xff9800,
  neg_balloon: 0x3949ab,
  rolodex: 0x795548,
  // §T2 — placeholder de color (Ticket 2)
  zoom_bomb: 0xff4444,        // rojo vivo — peligro rápido
  micromanager: 0x7b1fa2,     // púrpura oscuro — élite opresora
  unpaid_intern: 0xbdbdbd,    // gris pálido — carne de cañón
};

export function getEnemyById(id: string): EnemyDefinition | undefined {
  return ENEMIES.find(e => e.id === id);
}

// --- Hojas de sprites animadas de enemigos ---
// Solo los ids cuya hoja generada respeta la grid 4 columnas × 3 filas.
// angry_client (grid distinta) y hr_rep (sin hoja) usan el placeholder de color.
// Hoja 1200×896 → frame 300×298 (se ignoran 2px sobrantes de alto).
// Filas: 0 abajo, 1 lado(derecha), 2 arriba. Columnas: 0 idle, 1-2 walk, 3 death. idx = fila*4 + col.
export const ENEMY_SHEET_IDS = [
  'angry_email', 'toxic_manager', 'possessed_printer', 'auditor', 'angry_client', 'hr_rep', 'cleaning_lady',
] as const;

export const ENEMY_SHEET = {
  IDLE: { down: 0, side: 4, up: 8 },
  WALK: { down: [1, 2], side: [5, 6], up: [9, 10] },
  DEATH: { down: 3, side: 7, up: 11 },
  WALK_FPS: 6,
} as const;

// Dimensiones de frame por hoja (no todas se generaron al mismo tamaño).
// 4 columnas × 3 filas en todas; angry_client se reempaquetó a celdas más chicas.
export const ENEMY_FRAME: Record<string, { w: number; h: number }> = {
  angry_email: { w: 300, h: 298 },
  toxic_manager: { w: 300, h: 298 },
  possessed_printer: { w: 300, h: 298 },
  auditor: { w: 300, h: 298 },
  hr_rep: { w: 300, h: 298 },
  angry_client: { w: 129, h: 212 },
  cleaning_lady: { w: 210, h: 244 },
};

// Alto en pantalla por enemigo (px). Normales más chicos, élites más grandes.
export const ENEMY_DISPLAY_H: Record<string, number> = {
  angry_email: 34,
  toxic_manager: 56,
  possessed_printer: 58,
  auditor: 46,                // era 58 — auditor más chico (balance v2)
  hr_rep: 50,
  angry_client: 52,           // era 40 — cliente furioso más grande (balance v2)
  cleaning_lady: 50,
};

export type EnemyDir = 'down' | 'side' | 'up';
