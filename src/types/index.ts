export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemCategory = 'passive' | 'consumable' | 'weapon';
export type EnemyType = 'angry_email' | 'toxic_manager' | 'angry_client'
  | 'hr_rep' | 'possessed_printer' | 'auditor' | 'cleaning_lady' | 'ceo';

export type GameEventName =
  | 'player:hit' | 'player:died' | 'player:level_up' | 'player:burnout'
  | 'enemy:spawned' | 'enemy:killed' | 'enemy:hit'
  | 'stress:changed' | 'wave:start' | 'wave:complete' | 'wave:cleared'
  | 'wave:announce' | 'miniboss:announce' | 'miniboss:spawn' | 'miniboss:defeated' | 'miniboss:spawnZone'
  | 'pickup:collected' | 'boss:spawned' | 'boss:phase2' | 'boss:defeated'
  | 'damage:dealt' | 'item:acquired' | 'upgrade:weapon_selected' | 'upgrade:item_selected'
  | 'playerUpgrade:selected' | 'shop:closed' | 'boss:hp' | 'curse:applied' | 'weapon:sell';

export interface CharacterDefinition {
  id: string;
  name: string;
  tagline: string;
  baseHp: number;
  speedMult: number;          // × PLAYER.BASE_SPEED
  damageMult: number;         // × base damageMultiplier
  xpMult: number;             // base modifiers.xpMult
  coinMult: number;           // base modifiers.coinMult
  stressPerHit: number;       // overrides STRESS.DAMAGE_PER_HIT (may be negative)
  maxWeapons: number;         // base modifiers.maxWeapons
  perWeaponDamageMult: number;// freelancer 1.8 (1 = no change)
  // passive/restriction flags
  noEpicLegendaryWeapons?: boolean;  // becario
  doubleMonitorDisabled?: boolean;   // freelancer
  sinJefe?: boolean;                 // freelancer: 2nd weapon → both +25% firerate
  critInBurnout?: boolean;           // director
  ignoresCafe?: boolean;             // director
  hrAllies?: boolean;                // rrhh
  auditorsFromWave1?: boolean;       // rrhh
  auditorHpMult?: number;            // rrhh 1.5
  learningCurve?: boolean;           // becario: -10% xp/level, cap -50%
  timeScaling?: boolean;             // consultor: +5% all stats / 60s
  ignoreMeta?: boolean;              // consultor
}

export interface EnemyKilledPayload { type: EnemyType; isElite: boolean; x: number; y: number; sourceId: string; }
export interface DamageDealtPayload { sourceId: string; amount: number; }
export interface EnemyHitPayload { enemy: unknown; amount: number; sourceId: string; isCritical: boolean; }

// Continuous combat modifiers aggregated from owned items + player upgrades.
export interface RunModifiers {
  damageMult: number;           // multiplicative item damage bonus (NOT stress, NOT weapon level)
  damageTakenMult: number;      // <1 reduces incoming damage
  projectileBonus: number;      // +N projectiles to all weapons
  projectileSpeedMult: number;
  rangeMult: number;
  pierce: boolean;              // projectiles pass through enemies
  bounce: number;               // extra bounces (fotocopiadora = 1)
  maxWeapons: number;           // 4 base, 5 with Doble Monitor
  xpMult: number;
  coinMult: number;
  // §7.2 player-upgrade fields (optional — 0/undefined = not upgraded)
  fireRateMult: number;         // multiplier on all weapon fire rates
  critBonus: number;            // added to base COMBAT.CRIT_CHANCE
  regenHpPerS: number;          // HP regenerated per second passively
  stressRiseMult: number;       // multiplier on all stress accrual (stacks with metaStressMult)
  pickupRange: number;          // extra pickup detection radius in px
  wallBounce: number;           // §E2 rebote_de_pared: extra wall-bounce budget (0 = no wall bounce)
}

export function defaultRunModifiers(): RunModifiers {
  return {
    damageMult: 1, damageTakenMult: 1, projectileBonus: 0,
    projectileSpeedMult: 1, rangeMult: 1, pierce: false, bounce: 0,
    maxWeapons: 4, xpMult: 1, coinMult: 1,
    fireRateMult: 1, critBonus: 0, regenHpPerS: 0,
    stressRiseMult: 1, pickupRange: 0,
    wallBounce: 0,
  };
}

export interface ItemDefinition {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  category: ItemCategory;
  tags: string[];
  synergyWith?: string[];    // IDs de ítems sinérgicos (para ponderación de pool)
  maxStack?: number;          // undefined = sin límite
  onPickup?: (player: PlayerState) => PlayerState;
  onKill?: (player: PlayerState, enemy: EnemyType) => PlayerState;
  onHit?: (player: PlayerState) => PlayerState;
  onLevelUp?: (player: PlayerState) => PlayerState;
  applyModifiers?: (m: RunModifiers, player: PlayerState) => void;
  // Curse fields (Mejora 4) — present only on curse "items".
  isCurse?: boolean;
  cursePower?: string;        // the positive half of the curse, for UI
}

export interface WeaponDefinition {
  id: string;
  name: string;
  description: string;
  rarity: Rarity;
  baseDamage: number;
  fireRate: number;       // disparos por segundo
  range: number;          // píxeles
  projectileCount: number;
  tags: string[];
}

export interface EnemyDefinition {
  id: EnemyType;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  isElite: boolean;
  xpValue: number;        // calculado automáticamente: Math.round(hp / 10)
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  speed: number;
  damageMultiplier: number;
  stress: number;
  level: number;
  xp: number;
  coins: number;
  items: string[];        // IDs de ítems poseídos
  weapons: string[];      // IDs de armas equipadas
}

export interface RunStats {
  kills: number;
  timeSurvived: number;
  coinsEarned: number;
  maxLevel: number;
  maxStress: number;
  bossDefeated: boolean;
  // Build Report fields
  damageBySource: Record<string, number>;
  killsByWeapon: Record<string, number>;
  longestWave: { wave: number; enemies: number };
  itemsCollected: string[];
  weaponsOwned: string[];
  activeCurse: string | null;
  characterId: string;
}

export interface SaveData {
  saveVersion: number;
  totalRuns: number;
  totalKills: number;
  totalTimePlayed: number;        // seconds
  bossesDefeated: number;
  totalCoinsEarned: number;       // lifetime stat (never decremented)
  bestRunTime: number;            // seconds (victory runs only)
  bestLevel: number;
  bestKillsInRun: number;         // best kills in a single run
  coins: number;                  // spendable wallet (earned − spent on meta)
  metaUpgrades: Record<string, number>; // id → nivel comprado
  settings: {
    musicVolume: number;          // 0–1
    sfxVolume: number;            // 0–1
    uiVolume: number;             // 0–1
    // FASE H — display / accessibility settings
    fullscreen: boolean;          // default false
    zoom: number;                 // 0 = auto/FIT, 1..3 = setZoom ; default 0
    smoothing: boolean;           // true = LINEAR antialias (applies on restart) ; default false
    screenShake: number;          // 0..1 multiplier on shake intensity ; default 1
    vignette: boolean;            // show burnout vignette flash ; default true
    damageNumbers: boolean;       // show floating damage numbers ; default true
  };
}

export type StressState = 'relaxed' | 'tense' | 'limit' | 'burnout' | 'collapse';
