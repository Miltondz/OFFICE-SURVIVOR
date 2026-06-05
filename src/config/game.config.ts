// src/config/game.config.ts

export const GAME = {
  WIDTH: 960,
  HEIGHT: 540,
  TARGET_FPS: 60,
} as const;

export const PLAYER = {
  BASE_HP: 120,               // era 100 — primeras oleadas demasiado letales con 10 stress/golpe (balance v1)
  BASE_SPEED: 160,
  BASE_DAMAGE_MULTIPLIER: 1.0,
  INVINCIBILITY_FRAMES_MS: 500,
} as const;

export const STRESS = {
  MAX: 100,
  DAMAGE_PER_HIT: 8,          // era 10 — con 120 HP base, 10/golpe sigue siendo muy agresivo en oleadas tempranas (balance v1)
  PASSIVE_INCREASE_INTERVAL_S: 30,
  PASSIVE_INCREASE_AMOUNT: 5,
  KILL_NORMAL_DECREASE: 3,    // era 2 — matar enemigos debe compensar mejor el estrés pasivo, empuja ~40% burnout target (balance v1)
  KILL_ELITE_DECREASE: 8,
  COFFEE_DECREASE: 15,
  THRESHOLDS: {
    RELAXED_MAX: 30,
    TENSE_MAX: 69,
    LIMIT_MAX: 89,
    BURNOUT_MAX: 99,
  },
  BURNOUT_HP_DRAIN_PER_S: 2,
  ERGONOMIA_MULT: 0.8,              // ergonomia: stress rises 20% slower
  AURIC_NC_MULT: 0.85,              // auriculares_nc: stress rises 15% slower
} as const;

export type WaveType = 'normal' | 'swarm' | 'elite_only' | 'bonus' | 'miniboss' | 'boss';

export const WAVES = {
  INTERVAL_S: 30,
  BASE_ENEMIES: 5,          // era 2 — spec expansión; oleadas con más personalidad (fase B)
  ENEMIES_PER_WAVE_MULTIPLIER: 3, // era 2.5 — spec expansión (fase B)
  BOSS_WAVE: 13,            // era 10 — run de 13 oleadas con minibosses intermedios (fase B)
  // §7.5 budget-based spawn system
  BASE_BUDGET: 4,           // era 8 — W1 demasiado larga; pocas oleadas tempranas (balance B2)
  BUDGET_GROWTH: 3,         // era 5 — crecimiento más suave para pacing gradual (balance B2)
  ELITE_COST: 3,            // points cost for an elite spawn
  ELITE_CHANCE_BASE: 0.0,
  ELITE_CHANCE_PER_WAVE: 0.06,
  ELITE_CHANCE_MAX: 0.5,
  ELITE_MIN_WAVE: 3,        // elites appear from wave 3
  SPEED_SCALE_PER_WAVE: 0.05,
  SPEED_SCALE_MAX: 0.5,     // capped at +50% speed
  SPAWN_INTERVAL_BASE: 0.35, // era 0.5 — más rápido para acortar oleadas tempranas (balance B2)
  SPAWN_INTERVAL_MIN: 0.18,
  INTERMISSION_S: 4,        // countdown seconds before next wave
  // §B — secuencia de tipos de oleada (1..13)
  WAVE_SEQUENCE: {
    1: 'normal',
    2: 'swarm',
    3: 'normal',
    4: 'bonus',
    5: 'miniboss',
    6: 'normal',
    7: 'elite_only',
    8: 'swarm',
    9: 'miniboss',
    10: 'normal',
    11: 'elite_only',
    12: 'miniboss',
    13: 'boss',
  } as Record<number, WaveType>,
  // §B — miniboss ids por oleada (placeholder hasta Fase C)
  WAVE_MINIBOSS: {
    5: 'supervisor',
    9: 'printer_industrial',
    12: 'committee',
  } as Record<number, string>,
  // §B — swarm: cantidad × este factor, solo enemigos hp ≤ SWARM_HP_THRESHOLD
  SWARM_COUNT_MULT: 4,
  SWARM_HP_THRESHOLD: 30,   // only enemies with hp ≤ this qualify for swarm waves
  // §B — bonus: auto-despawn after this many seconds
  BONUS_DESPAWN_S: 20,
  // §B — elite_only: budget fraction (reduced count)
  ELITE_ONLY_BUDGET_MULT: 0.6,
} as const;

export const PROGRESSION = {
  XP_PER_LEVEL_MULTIPLIER: 120, // era 100 — con per-wave upgrades el jugador sobre-nivelaba; ralentizar XP mantiene total de upgrades razonable (balance v1)
  XP_PER_HP_DIVISOR: 10,        // HP_enemigo / 10
  UPGRADE_OPTIONS: 3,
  // §7.6 super-linear XP curve
  XP_BASE: 40,           // era 26 — W1 daba 3–4 niveles; con XP_BASE más alto el nivel 1 cuesta más (balance B2)
  XP_EXP: 1.55,          // era 1.45 — curva más pronunciada para frenar niveles tempranos (balance B2)
  XP_KILL_MULT: 1,       // era 2 — multiplicador reducido: cada kill da menos XP en oleadas tempranas (balance B2)
} as const;

export const ECONOMY = {
  ENEMY_COINS_MIN: 2,          // era 1 — primera meta upgrade en 2–3 runs requiere ~50 monedas; con 1–3 por enemigo tardaba demasiado (balance v1)
  ENEMY_COINS_MAX: 4,          // era 3 — sube el techo para mantener varianza interesante (balance v1)
  ELITE_COINS_MIN: 5,
  ELITE_COINS_MAX: 10,
  BOSS_COINS: 100,
  BACKUP_PLAN_CHANCE: 0.25,         // backup_plan: chance to grant bonus item on elite kill
} as const;

export const RUN_DURATION_S = 840; // era 600 — run de 14 min para cubrir 13 oleadas (fase B)

export const SCENES = {
  BOOT: 'BootScene',
  PRELOAD: 'PreloadScene',
  MAIN_MENU: 'MainMenuScene',
  GAME: 'GameScene',
  UPGRADE: 'UpgradeScene',
  UPGRADE_OVERLAY: 'UpgradeOverlay',
  HUD: 'HUDScene',
  STATISTICS: 'StatisticsScene',
  BUILD_REPORT: 'BuildReportScene',
  PAUSE: 'PauseScene',
  SHOP: 'ShopOverlay',
} as const;

export const SHOP = {
  CARD_COUNT: 3,                  // era 4 — menos cards → cada elección importa más (fase D)
  REROLL_BASE_COST: 5,            // era REROLL_COST 15 plano — reroll escalable (fase D)
  REROLL_COST_INCREMENT: 5,       // coste sube 5 por cada reroll en la misma tienda
  SELL_REFUND_RATIO: 0.5,         // reembolso al vender un ítem pasivo
  MAX_SELLS_PER_SHOP: 1,          // máx ventas por visita
  TIMER_SECONDS: 20,              // 20s antes de cerrar tienda automáticamente
  LEGENDARY_CHANCE: 0.2,          // probabilidad de slot legendario extra (wave ≥ LEGENDARY_MIN_WAVE)
  LEGENDARY_MIN_WAVE: 5,          // desde qué oleada puede aparecer el slot legendario
  LEGENDARY_COST: 150,            // precio fijo del slot legendario (no escala con oleada)
  PRICE_WAVE_SCALE: 0.06,         // precio sube 6% por oleada completada
  PRICES: { common: 10, rare: 25, epic: 60, legendary: 150 } as Record<string, number>,
  PRICE_WEAPON_LEVELUP: 10,       // era 20 — coste de subir nivel de arma existente (fase D)
} as const;

export const BUILD_REPORT = {
  TOP_DAMAGE_COUNT: 3,
  BAR_MAX_W: 220,
  BAR_H: 14,
  CHIP_W: 116,
  CHIP_H: 22,
} as const;

export const WAVE_EVENTS = {
  TRIGGER_EVERY_N_WAVES: 3,
  FIRST_EVENT_MIN_WAVE: 3,
  BANNER_MS: 2500,                  // warning shown before effect
  BLACKOUT_MS: 20000,
  BLACKOUT_RADIUS: 180,
  BLACKOUT_ALPHA: 0.82,
  ALL_HANDS_MS: 10000,
  ALL_HANDS_SPEED_MULT: 1.5,
  SURPRISE_AUDIT_COUNT: 3,
  FREE_COFFEE_COUNT: 5,
  PRINTER_JAM_MS: 15000,
  PRINTER_JAM_CHANCE: 0.30,
  PRINTER_JAM_DURATION_MS: 500,
  WEIGHTS: { blackout: 25, all_hands: 25, surprise_audit: 20, free_coffee: 20, printer_jam: 10 },
} as const;

export const MAP = {
  WIDTH: 2880,
  HEIGHT: 1620,
  PLAYER_SPAWN_X: 1440,
  PLAYER_SPAWN_Y: 810,
  OBSTACLE_COUNT_MIN: 25,           // era 8 — mapa 3× más grande requiere más obstáculos para cobertura (expansión mapa)
  OBSTACLE_COUNT_MAX: 35,           // era 12 — idem (expansión mapa)
  OBSTACLE_GRID_CELL: 96,           // máx 1 obstáculo por celda de 96px
  SPAWN_FREE_RADIUS: 200,           // zona libre alrededor del spawn del jugador
  CENTER_EXCLUSION: 130,            // keep obstacles away from player spawn (center)
  COFFEE_MACHINE_INTERVAL_S: 45,
  VENDING_COST: 15,
  VENDING_COOLDOWN_S: 60,
  VENDING_RANGE: 52,
  EXTINTOR_STRESS: 25,
  DESK: { w: 64, h: 32, color: 0x6b5030 },
  CABINET: { w: 32, h: 48, color: 0x4a4a5a },
  PLANT: { w: 32, h: 32, color: 0x2e7d32 },
  FUNC_SIZE: 40,
  COFFEE_COLOR: 0x8d6e63,
  VENDING_COLOR: 0x3949ab,
  EXTINTOR_COLOR: 0x00bcd4,     // cian — distinto del rojo de enemigos
  EXTINTOR_BORDER: 0xffffff,
  // Alto en pantalla de cada prop con sprite (px); el ancho conserva el aspecto del arte.
  // El collider sigue usando w/h de arriba (gameplay); el sprite es solo visual y puede ser mayor.
  SPRITE_H: { desk: 46, cabinet: 64, plant: 54, coffee: 56, vending: 86, extintor: 40 },
} as const;

export const CURSES = {
  MIN_LEVEL: 5,
  MAX_ACTIVE: 1,
  NO_VACATION_STRESS_FLOOR: 50,
  MICROMANAGEMENT_HP_LOSS: 5,
  MICROMANAGEMENT_INTERVAL_S: 5,
  MANDATORY_OVERTIME_BUFF_S: 600,   // at 10 min: all stats ×1.5
  MANDATORY_OVERTIME_MULT: 1.5,
  OPEN_OFFICE_AURA_RADIUS: 150,
  OPEN_OFFICE_AURA_SLOW: 0.20,
  EXCLUSIVITY_DAMAGE_MULT: 2.0,     // +100% damage on locked weapon
} as const;

export const COLORS = {
  BG: 0x1a1a1a,
  PLAYER: 0x4caf50,
  TEXT: '#ffffff',
  TEXT_MUTED: '#888888',
  BUTTON: 0x333355,
  BUTTON_HOVER: 0x4444aa,
} as const;

export const COMBAT = {
  PROJECTILE_POOL_SIZE: 200,
  ENEMY_POOL_SIZE: 300,
  MAX_PASSIVE_ITEMS: 6,           // tope de ítems pasivos equipados; consumables/weapons no cuentan (fase D.3)
  PROJECTILE_DEFAULT_SPEED: 360,    // px/s for standard bullets
  PROJECTILE_LIFESPAN_MS: 2000,
  CRIT_CHANCE: 0.20,                // base
  CRIT_MULTIPLIER: 2,
  CONTACT_DAMAGE_COOLDOWN_MS: 500,  // enemy can damage player at most this often
  MAX_WEAPONS_BASE: 4,
  MAX_WEAPONS_WITH_MONITOR: 5,
  WEAPON_MAX_LEVEL: 3,
  WEAPON_LEVEL_DAMAGE_STEP: 0.15,   // +15% per copy
  WEAPON_LEVEL_FIRERATE_STEP: 0.10, // +10% per copy
  LASER_WIDTH: 12,                  // debug_laser beam hit width (px)
  LASER_FLASH_MS: 60,               // beam visual duration per tick (ms)
} as const;

export const SPAWN = {
  EDGE_MARGIN: 40,                  // spawn this far outside viewport
  AUDITOR_INVINCIBLE_MS: 3000,
  TOXIC_ZONE_DURATION_MS: 3000,
  TOXIC_ZONE_DPS: 5,
  HR_AURA_RADIUS: 120,
  HR_AURA_SLOW: 0.30,
  PRINTER_FAN_INTERVAL_MS: 3000,
  PRINTER_FAN_COUNT: 5,
  PRINTER_FAN_SPREAD_DEG: 72,
  BADGE_DETECTION_DELAY_MS: 500,    // badge: enemies detect player 0.5s late
  // cleaning_lady: rastro de piso pulido (zona eléctrica que daña al jugador)
  POLISH_INTERVAL_MS: 1200,         // deja una zona cada 1.2s mientras se mueve
  POLISH_RADIUS: 26,
  POLISH_DPS: 6,
  POLISH_DURATION_MS: 4000,
} as const;

export const BOSS = {
  HP: 2000,
  PHASE2_HP_THRESHOLD: 1000,
  SIZE: 64,
  MEMO_INTERVAL_MS: 2000,
  MEETING_SUMMON_COUNT: 4,
  CHARGE_WINDUP_MS: 1000,
  PHASE2_COOLDOWN_MULT: 0.8,        // 20% more frequent
  RESTRUCTURING_LINES: 3,
  IPO_SCALE_INTERVAL_S: 300,        // ipo: difficulty scaling interval (5 min)
  IPO_SCALE_STEP: 0.25,             // ipo: +25% hp/damage per interval
  CEO_MEMO_ENEMY_HP_MULT: 0.8,      // ceo_memo: enemy spawn HP ×0.8
  CEO_MEMO_BOSS_HP_MULT: 1.5,       // ceo_memo: CEO boss HP ×1.5
  CONTACT_DAMAGE: 20,               // damage to player on CEO body contact
  CONTACT_RANGE: 48,                // px distance for CEO contact damage
  // Hoja de sprites del CEO: 4 columnas × 2 filas (frame 344×384, total 1376×768).
  // Fila0 = fase1 [idle, enojado, ataque-bastón, lanza-emails]; fila1 = fase2 [idle, oscuro, rugido, ORO].
  SHEET_FRAME_W: 344, SHEET_FRAME_H: 384,
  DISPLAY_H: 120,                   // alto en pantalla del sprite (px)
  IDLE_P1: [0, 1], IDLE_P2: [4, 6], // frames de idle por fase (parpadeo lento)
  ATTACK_P1: 3, ATTACK_P2: 6,       // frame mostrado al atacar por fase
  GOLD_FRAME: 7,                    // montón de oro (muerte)
  ANIM_FPS: 2,
} as const;

export const RARITY_WEIGHTS = {
  common: 60, rare: 28, epic: 10, legendary: 2,
} as const;

export const RARITY_RULES = {
  EPIC_MIN_LEVEL: 3,
  LEGENDARY_MIN_LEVEL: 6,
  EPIC_MAX_PER_RUN: 4,
  LEGENDARY_MAX_PER_RUN: 1,
} as const;

export const ENTITY_SIZES = {
  ENEMY: 24,
  ELITE: 32,
  PROJECTILE: 8,
  PICKUP: 14,
} as const;

export const COLORS_GAME = {
  ENEMY: 0xcc4444,
  ELITE: 0xaa33aa,
  AUDITOR: 0xeeee44,
  BOSS: 0xff2222,
  PROJECTILE: 0xffffff,
  TOXIC_ZONE: 0x66aa33,
  COFFEE: 0x6f4e37,
  COIN: 0xffd700,
  XP: 0x3399ff,
  PICKUP_CAFE: 0x6f4e37,
  PICKUP_GALLETA: 0xf5deb3,
  PICKUP_MONEDA: 0xffd700,
  PICKUP_STRESS: 0x44aaff,
  LASER_BEAM: 0x00ffff,
  TURRET: 0xaaaaaa,
} as const;

export const HUD = {
  // Each bar has its label drawn just above it (origin 0,1). Spacing leaves room for the
  // label between bars so HP bar / ESTRÉS label never overlap.
  HP_BAR: { x: 12, y: 24, w: 200, h: 14 },
  STRESS_BAR: { x: 12, y: 74, w: 200, h: 14 },   // bajada: la imagen de HP mide ~27px de alto
  XP_BAR: { w: 400, h: 8, yFromBottom: 18 },
  PULSE_MS: 400,
  PULSE_ALPHA_MIN: 0.6,
} as const;

export const STRESS_COLORS = {
  RELAXED: 0x4caf50,  // 0–30
  TENSE:   0xffc107,  // 31–69
  LIMIT:   0xff9800,  // 70–89
  BURNOUT: 0xf44336,  // 90–99 (pulsing)
} as const;

export const FEEL = {
  DMG_NUM_POOL: 60,
  DMG_NUM_RISE_PX: 40,
  DMG_NUM_RISE_MS: 800,
  DMG_NUM_CRIT_RISE_PX: 60,
  DMG_NUM_PLAYER_RISE_PX: 30,
  DMG_NUM_PLAYER_MS: 600,
  ENEMY_FLASH_MS: 80,
  ENEMY_DEATH_MS: 100,
  ENEMY_DEATH_SCALE: 1.4,
  BOSS_DEATH_FREEZE_MS: 500,
  BOSS_DEATH_TWEEN_MS: 1500,
  LEVELUP_POPUP_MS: 600,
  VIGNETTE_ALPHA_MAX: 0.15,
} as const;

export const SHAKE = {
  PLAYER_HIT:   { ms: 200, intensity: 0.003 },
  ELITE_KILLED: { ms: 250, intensity: 0.005 },
  BOSS_HIT:     { ms: 300, intensity: 0.006 },
  BOSS_DEAD:    { ms: 600, intensity: 0.012 },
} as const;

export const PARTICLES = {
  ENEMY_DEATH:  { count: 6,  color: 0xff9800, ms: 400 },
  ELITE_DEATH:  { count: 12, color: 0xff3333, ms: 600 },
  PICKUP:       { count: 8,  color: 0xffff00, ms: 300 },
  CAFE_PICKUP:  { count: 10, color: 0x6f4e37, ms: 400 },
} as const;

export const AUDIO = {
  DEFAULTS: { music: 0.5, sfx: 0.8, ui: 1.0 },
  BEEPS: {
    shoot:        { freq: 220, ms: 0.05 },
    enemy_hit:    { freq: 330, ms: 0.04 },
    enemy_die:    { freq: 160, ms: 0.12 },
    player_hit:   { freq: 110, ms: 0.15 },
    player_die:   { freq: 80,  ms: 0.4 },
    level_up:     { freq: 660, ms: 0.2 },
    pickup:       { freq: 880, ms: 0.1 },
    burnout_start:{ freq: 140, ms: 0.3 },
    boss_appear:  { freq: 100, ms: 0.5 },
    boss_die:     { freq: 90,  ms: 0.6 },
    click:        { freq: 500, ms: 0.05 },
  },
} as const;

// ─── §C — Jefes Menores ──────────────────────────────────────────────────────
export const MINIBOSS = {
  DRIFT_SPEED: 70,   // px/s slow drift toward player (like CEO)
  CONTACT_RANGE: 44, // px distance for contact damage check

  SUPERVISOR: {
    HP: 600,
    SIZE: 80,
    CONTACT_DAMAGE: 18,
    COLOR: 0xdd6600,          // orange – distinct from CEO red
    // Attack cooldowns (ms)
    SONIC_CD: 3000,           // Grito Sónico — push 120px
    KICK_CD: 5000,            // Patada — dash + knockback
    REUNION_CD: 8000,         // ¡Reunión! — summon 4 angry_email
    MEGA_CD: 6000,            // Megáfono Total (fase 2) — shockwave w/ center gap
    PHASE2_HP_FRAC: 0.50,     // enter phase 2 below 50% HP
    SONIC_PUSH: 120,          // px knockback from sonic scream
    KICK_SPEED: 450,          // px/s dash speed
    KICK_DURATION_MS: 350,    // how long the dash lasts
    MEGA_INNER_R: 80,         // gap radius in megaphone shockwave
    MEGA_OUTER_R: 220,
    MEGA_DAMAGE: 28,
    DROP_COINS: 40,
    DROP_RARITY: 'rare' as const,
  },

  PRINTER_INDUSTRIAL: {
    HP: 900,
    SIZE: 96,
    CONTACT_DAMAGE: 22,
    COLOR: 0x9933cc,          // purple placeholder tint on possessed_printer
    PHASE2_HP_FRAC: 0.40,
    // Attack cooldowns (ms)
    TORNADO_CD: 5000,         // 8 papeles girando
    INK_CD: 4000,             // arco de proyectiles + mancha de tinta DamageZone
    WALL_CD: 7000,            // línea de proyectiles con gap 80px
    PAPER_CD: 1500,           // Papel Infinito (fase 2) — 8 dirs
    INK_ZONE_R: 40,
    INK_ZONE_DPS: 5,
    INK_ZONE_DUR_MS: 5000,
    WALL_GAP_PX: 80,          // gap in the paper wall
    WALL_PROJ_COUNT: 10,
    TORNADO_COUNT: 8,
    DROP_COINS: 60,
    DROP_RARITY: 'epic' as const,
  },

  COMMITTEE: {
    HP_TOTAL: 900,            // shared HP across 3 members
    HP_EACH: 300,
    SIZE: 56,
    CONTACT_DAMAGE: 14,
    COLORS: [0x111111, 0x888888, 0xdddddd] as const,  // tints for each member
    ENRAGE_DMG_MULT: 1.30,    // +30% damage when a member dies
    ENRAGE_SPD_MULT: 1.20,    // +20% speed when a member dies
    CHARGE_CD: 10000,         // coordinated charge every 10s
    CHARGE_SPEED: 500,
    CHARGE_DURATION_MS: 400,
    DROP_COINS: 80,
    DROP_RARITY: 'epic' as const,
    SPREAD: 90,               // px spread between members on spawn
  },
} as const;

// META_UPGRADE_DISPLAY removed in Phase 4 — use META_UPGRADES from meta.config.ts (single source of truth)

export const PICKUPS = {
  CAFE_INTERVAL_S: 45,
  CAFE_STRESS: 15,
  GALLETA_INTERVAL_S: 60,
  GALLETA_HP: 20,
  MONEDA_INTERVAL_S: 30,
  MONEDA_COINS: 5,
  POOL_SIZE: 40,                   // enlarged for item/upgrade drops (era 30)
  CAFE_VIP_BONUS_HP: 10,           // cafeteria_vip: café cura +10 HP
  STRESS_PICKUP_DECREASE: 10,      // reunion_cancelada drop
  SPAWN_MARGIN: 60,                // min distance from edges for pickup spawn
  // §7.4 enemy death drops
  ITEM_DROP_CHANCE: 0.04,          // probability on normal enemy death
  ITEM_DROP_ELITE_MULT: 3,         // élite ×3 chance
  UPGRADE_DROP_CHANCE: 0.015,      // upgrade star drop chance
} as const;

// ─── §E1 — Nuevos ítems (fase E1) ────────────────────────────────────────────
export const ITEMS_E1 = {
  // triple_espresso: velocidad +25% por 8s al recoger cualquier pickup — nuevo (fase E1)
  ESPRESSO_SPEED_MULT: 1.25,        // nuevo (fase E1)
  ESPRESSO_DURATION_MS: 8000,       // nuevo (fase E1)
  // taza_grande: +20 HP máx; café ×1.5 efecto — nuevo (fase E1)
  TAZA_GRANDE_MAX_HP: 20,           // nuevo (fase E1)
  TAZA_GRANDE_CAFE_MULT: 1.5,       // multiplicador del efecto del café — nuevo (fase E1)
  // sello_de_goma: cada 5 kills, siguiente proyectil ×3 daño — nuevo (fase E1)
  SELLO_KILL_THRESHOLD: 5,          // nuevo (fase E1)
  SELLO_DAMAGE_MULT: 3,             // nuevo (fase E1)
  // pelota_stress: 30% de anular daño — nuevo (fase E1)
  PELOTA_BLOCK_CHANCE: 0.30,        // nuevo (fase E1)
  // combustible_rage: +5% daño 10s por hit, stack ×3 — nuevo (fase E1)
  RAGE_STACK_DAMAGE: 0.05,          // nuevo (fase E1)
  RAGE_DURATION_MS: 10000,          // nuevo (fase E1)
  RAGE_MAX_STACKS: 3,               // nuevo (fase E1)
  // iman_de_monedas: radio ×4 + atracción — nuevo (fase E1)
  IMAN_PICKUP_RANGE_MULT: 4,        // multiplier sobre pickupRange base — nuevo (fase E1)
  IMAN_ATTRACT_SPEED: 200,          // px/s que se acercan las monedas — nuevo (fase E1)
  IMAN_ATTRACT_RANGE: 300,          // radio de atracción px — nuevo (fase E1)
  // doble_disparo: 25% de disparar 2 — nuevo (fase E1)
  DOBLE_DISPARO_CHANCE: 0.25,       // nuevo (fase E1)
  // cadena_de_kills: +2% daño acumulativo por kill sin daño — nuevo (fase E1)
  CADENA_DAMAGE_PER_KILL: 0.02,     // nuevo (fase E1)
  // explosion_al_matar: AoE 150px por 50% HP élite — nuevo (fase E1)
  EXPLOSION_RADIUS: 150,            // nuevo (fase E1)
  EXPLOSION_DAMAGE_FRAC: 0.50,      // fracción del HP del élite como daño AoE — nuevo (fase E1)
  // modo_dios_temporal: cada 60s, 3s invencible + ×5 daño — nuevo (fase E1)
  MODO_DIOS_INTERVAL_MS: 60000,     // nuevo (fase E1)
  MODO_DIOS_DURATION_MS: 3000,      // nuevo (fase E1)
  MODO_DIOS_DAMAGE_MULT: 5,         // nuevo (fase E1)
  // ultimo_cartucho: ≤20% HP → cadencia ×3 — nuevo (fase E1)
  ULTIMO_HP_THRESHOLD: 0.20,        // nuevo (fase E1)
  ULTIMO_FIRERATE_MULT: 3,          // nuevo (fase E1)
} as const;
