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

export const WAVES = {
  INTERVAL_S: 30,
  BASE_ENEMIES: 2,
  ENEMIES_PER_WAVE_MULTIPLIER: 2.5, // era 3 — escala demasiado rápido; con per-wave upgrades el jugador se fortalece pero las hordas crecían cuadráticamente (balance v1)
  BOSS_WAVE: 10,
} as const;

export const PROGRESSION = {
  XP_PER_LEVEL_MULTIPLIER: 120, // era 100 — con per-wave upgrades el jugador sobre-nivelaba; ralentizar XP mantiene total de upgrades razonable (balance v1)
  XP_PER_HP_DIVISOR: 10,        // HP_enemigo / 10
  UPGRADE_OPTIONS: 3,
} as const;

export const ECONOMY = {
  ENEMY_COINS_MIN: 2,          // era 1 — primera meta upgrade en 2–3 runs requiere ~50 monedas; con 1–3 por enemigo tardaba demasiado (balance v1)
  ENEMY_COINS_MAX: 4,          // era 3 — sube el techo para mantener varianza interesante (balance v1)
  ELITE_COINS_MIN: 5,
  ELITE_COINS_MAX: 10,
  BOSS_COINS: 100,
  BACKUP_PLAN_CHANCE: 0.25,         // backup_plan: chance to grant bonus item on elite kill
} as const;

export const RUN_DURATION_S = 600; // 10 minutos

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
  OBSTACLE_COUNT_MIN: 8,
  OBSTACLE_COUNT_MAX: 12,
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
  EXTINTOR_COLOR: 0xd32f2f,
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
  HP_BAR: { x: 12, y: 12, w: 200, h: 16 },
  STRESS_BAR: { x: 12, y: 34, w: 200, h: 16 },
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

// META_UPGRADE_DISPLAY removed in Phase 4 — use META_UPGRADES from meta.config.ts (single source of truth)

export const PICKUPS = {
  CAFE_INTERVAL_S: 45,
  CAFE_STRESS: 15,
  GALLETA_INTERVAL_S: 60,
  GALLETA_HP: 20,
  MONEDA_INTERVAL_S: 30,
  MONEDA_COINS: 5,
  POOL_SIZE: 30,
  CAFE_VIP_BONUS_HP: 10,           // cafeteria_vip: café cura +10 HP
  STRESS_PICKUP_DECREASE: 10,      // reunion_cancelada drop
  SPAWN_MARGIN: 60,                // min distance from edges for pickup spawn
} as const;
