import Phaser from 'phaser';
import type { RunContext } from './RunContext';
import { recomputeModifiers } from './RunContext';
import { ECONOMY, ITEMS_E1 } from '@/config/game.config';
import type { ItemDefinition } from '@/types';

// References injected by GameScene after instantiation
let _pickupSystemRef: { spawnStressPickup: (x: number, y: number) => void } | null = null;
let _weaponSystemRef: { recomputeWeaponMods: () => void } | null = null;
let _upgradePoolRef: { pick: (player: import('@/types').PlayerState, mods: import('@/types').RunModifiers, count: number, weaponLevels?: Record<string, number>, weaponsOnly?: boolean, forbidHighRarityWeapons?: boolean, forbidCommonItems?: boolean) => (import('@/types').ItemDefinition | import('@/types').WeaponDefinition)[] } | null = null;
// §E1 — EnemySystem ref for explosion_al_matar AoE
let _enemySystemRef: { damageInRadius: (cx: number, cy: number, radius: number, damage: number, sourceId: string) => void } | null = null;
// §E1 — Phaser scene ref for delayedCall (triple_espresso, modo_dios)
let _sceneRef: Phaser.Scene | null = null;

export function setItemReactionDeps(
  pickupSys: { spawnStressPickup: (x: number, y: number) => void },
  weaponSys: { recomputeWeaponMods: () => void },
  upgradePool: { pick: (player: import('@/types').PlayerState, mods: import('@/types').RunModifiers, count: number, weaponLevels?: Record<string, number>, weaponsOnly?: boolean, forbidHighRarityWeapons?: boolean, forbidCommonItems?: boolean) => (import('@/types').ItemDefinition | import('@/types').WeaponDefinition)[] },
  enemySys?: { damageInRadius: (cx: number, cy: number, radius: number, damage: number, sourceId: string) => void },
  scene?: Phaser.Scene,
): void {
  _pickupSystemRef = pickupSys;
  _weaponSystemRef = weaponSys;
  _upgradePoolRef = upgradePool;
  if (enemySys) _enemySystemRef = enemySys;
  if (scene) _sceneRef = scene;
}

/**
 * Installs EventBus subscriptions for reactive items.
 * Called once per item acquisition (guarded by item id check in each handler).
 */
export function installItemReactions(ctx: RunContext): void {
  const bus = ctx.bus;

  // ---- Reunión Cancelada: on kill, 15% chance spawn stress pickup ----
  if (ctx.player.items.includes('reunion_cancelada')) {
    bus.removeListener('enemy:killed', _reunionCanceladaHandler);
    bus.on('enemy:killed', _reunionCanceladaHandler);
    _reunionCanceladaCtx = ctx;
  }

  // ---- Carta de Renuncia: in burnout, kills restore 2 HP ----
  if (ctx.player.items.includes('carta_renuncia')) {
    bus.removeListener('enemy:killed', _cartaRenunciaHandler);
    bus.on('enemy:killed', _cartaRenunciaHandler);
    _cartaRenunciaCtx = ctx;
  }

  // ---- Spreadsheet God: 10 kills without damage → +15% damage 10s ----
  if (ctx.player.items.includes('spreadsheet_god')) {
    bus.removeListener('enemy:killed', _spreadsheetKillHandler);
    bus.removeListener('player:hit', _spreadsheetHitHandler);
    bus.on('enemy:killed', _spreadsheetKillHandler);
    bus.on('player:hit', _spreadsheetHitHandler);
    _spreadsheetCtx = ctx;
    _spreadsheetKillCount = 0;
    _spreadsheetActive = false;
  }

  // ---- All Hands Meeting: per wave +3% damage accumulative ----
  if (ctx.player.items.includes('all_hands')) {
    bus.removeListener('wave:complete', _allHandsHandler);
    bus.on('wave:complete', _allHandsHandler);
    _allHandsCtx = ctx;
  }

  // ---- Stock Options: per coin +0.1% damage ----
  if (ctx.player.items.includes('stock_options')) {
    bus.removeListener('pickup:collected', _stockOptionsHandler);
    bus.on('pickup:collected', _stockOptionsHandler);
    _stockOptionsCtx = ctx;
  }

  // ---- Backup Plan: 25% chance to grant a real item on elite kill ----
  if (ctx.player.items.includes('backup_plan')) {
    bus.removeListener('enemy:killed', _backupPlanHandler);
    bus.on('enemy:killed', _backupPlanHandler);
    _backupPlanCtx = ctx;
  }

  // ---- Linea Directa IT: survive at 1 HP once ----
  // Handled in Player.takeDamage via items array check — no bus subscription needed.

  // ---- YOLO: ensure stress never drops below 90 ----
  if (ctx.player.items.includes('yolo')) {
    bus.removeListener('stress:changed', _yoloHandler);
    bus.on('stress:changed', _yoloHandler);
    _yoloCtx = ctx;
    ctx.player.stress = Math.max(ctx.player.stress, 90);
  }

  // ---- CEO Memo: enemies -20% HP handled in EnemySystem.spawn; CEO +50% HP in CEOBoss ----
  // ---- IPO: handled in GameScene boss:defeated ----
  // ---- Pivot: recomputeWeaponMods on level_up handles it ----

  // ── §E1 NUEVOS HANDLERS ──────────────────────────────────────────────────

  // ---- triple_espresso: pickup recogido → +25% velocidad 8s ----
  if (ctx.player.items.includes('triple_espresso')) {
    bus.removeListener('pickup:collected', _tripleEspressoHandler);
    bus.on('pickup:collected', _tripleEspressoHandler);
    _tripleEspressoCtx = ctx;
  }

  // ---- sello_de_goma: cada 5 kills → siguiente proyectil ×3 ----
  if (ctx.player.items.includes('sello_de_goma')) {
    bus.removeListener('enemy:killed', _sellaDeGomaKillHandler);
    bus.on('enemy:killed', _sellaDeGomaKillHandler);
    _sellaDeGomaCtx = ctx;
  }

  // ---- combustible_rage: hit recibido → +5% daño 10s, stack ×3 ----
  if (ctx.player.items.includes('combustible_rage')) {
    bus.removeListener('player:hit', _combustibleRageHandler);
    bus.on('player:hit', _combustibleRageHandler);
    _combustibleRageCtx = ctx;
    _combustibleRageStacks = 0;
  }

  // ---- escudo_grapas: reset shield at wave start ----
  if (ctx.player.items.includes('escudo_grapas')) {
    bus.removeListener('wave:start', _escudoGrapasResetHandler);
    bus.on('wave:start', _escudoGrapasResetHandler);
    _escudoGrapasCtx = ctx;
    // Arm the shield immediately on pickup
    ctx.escudoGrapasActive = true;
  }

  // ---- cadena_de_kills: kills → +2% daño; hit → reset ----
  if (ctx.player.items.includes('cadena_de_kills')) {
    bus.removeListener('enemy:killed', _cadenaKillHandler);
    bus.removeListener('player:hit', _cadenaHitHandler);
    bus.on('enemy:killed', _cadenaKillHandler);
    bus.on('player:hit', _cadenaHitHandler);
    _cadenaCtx = ctx;
    _cadenaStreak = 0;
  }

  // ---- explosion_al_matar: elite killed → AoE ----
  if (ctx.player.items.includes('explosion_al_matar')) {
    bus.removeListener('enemy:killed', _explosionAlMatarHandler);
    bus.on('enemy:killed', _explosionAlMatarHandler);
    _explosionAlMatarCtx = ctx;
  }

  // ---- modo_dios_temporal: 60s timer → 3s invencibilidad + ×5 daño ----
  if (ctx.player.items.includes('modo_dios_temporal')) {
    // Only arm once; re-entrance via pickup re-uses existing timer cycle
    if (_modoDiosCtx === null) {
      _modoDiosCtx = ctx;
      _startModoDiosTimer(ctx);
    } else {
      _modoDiosCtx = ctx;
    }
  }
}

// --- Module-level closure state for handlers ---

let _reunionCanceladaCtx: RunContext | null = null;
function _reunionCanceladaHandler(payload: { x: number; y: number }): void {
  if (!_reunionCanceladaCtx) return;
  if (!_reunionCanceladaCtx.player.items.includes('reunion_cancelada')) return;
  if (Math.random() < 0.15 && _pickupSystemRef) {
    _pickupSystemRef.spawnStressPickup(payload.x, payload.y);
  }
}

let _cartaRenunciaCtx: RunContext | null = null;
function _cartaRenunciaHandler(): void {
  if (!_cartaRenunciaCtx) return;
  const ctx = _cartaRenunciaCtx;
  if (!ctx.player.items.includes('carta_renuncia')) return;
  const s = ctx.player.stress;
  if (s >= 90 && s <= 99) { // burnout
    ctx.player.hp = Math.min(ctx.player.maxHp, ctx.player.hp + 2);
  }
}

let _spreadsheetCtx: RunContext | null = null;
let _spreadsheetKillCount = 0;
let _spreadsheetActive = false;
function _spreadsheetKillHandler(): void {
  if (!_spreadsheetCtx) return;
  if (!_spreadsheetCtx.player.items.includes('spreadsheet_god')) return;
  _spreadsheetKillCount++;
  if (_spreadsheetKillCount >= 10 && !_spreadsheetActive) {
    _spreadsheetActive = true;
    _spreadsheetCtx.player.damageMultiplier *= 1.15;
    const ctx = _spreadsheetCtx;
    const startTime = Date.now();
    const check = (): void => {
      if (Date.now() - startTime >= 10000) {
        ctx.player.damageMultiplier /= 1.15;
        _spreadsheetActive = false;
        _spreadsheetKillCount = 0;
      } else {
        setTimeout(check, 500);
      }
    };
    setTimeout(check, 10000);
  }
}
function _spreadsheetHitHandler(): void {
  _spreadsheetKillCount = 0;
}

let _allHandsCtx: RunContext | null = null;
function _allHandsHandler(): void {
  if (!_allHandsCtx) return;
  if (!_allHandsCtx.player.items.includes('all_hands')) return;
  _allHandsCtx.player.damageMultiplier *= 1.03;
}

let _stockOptionsCtx: RunContext | null = null;
function _stockOptionsHandler(payload: { coins?: number }): void {
  if (!_stockOptionsCtx) return;
  if (!_stockOptionsCtx.player.items.includes('stock_options')) return;
  const coins = payload?.coins ?? 1;
  _stockOptionsCtx.player.damageMultiplier *= (1 + 0.001 * coins);
}

let _backupPlanCtx: RunContext | null = null;
function _backupPlanHandler(payload: { isElite: boolean }): void {
  if (!_backupPlanCtx) return;
  if (!_backupPlanCtx.player.items.includes('backup_plan')) return;
  if (!payload.isElite) return;
  if (Math.random() >= ECONOMY.BACKUP_PLAN_CHANCE) return;
  if (!_upgradePoolRef || !_weaponSystemRef) return;

  const ctx = _backupPlanCtx;
  const picks = _upgradePoolRef.pick(ctx.player, ctx.modifiers, 1, ctx.weaponLevels, false, ctx.character.noEpicLegendaryWeapons ?? false, ctx.curseForbidCommon);
  if (picks.length === 0) return;

  const pick = picks[0];
  const isWeapon = !('category' in pick);
  if (isWeapon) {
    // Weapon: add/level via weaponSystem
    _weaponSystemRef.recomputeWeaponMods(); // will be called after addOrLevel below
    // Emit event so GameScene/WeaponSystem handles addOrLevel
    ctx.bus.emit('upgrade:weapon_selected', { id: pick.id });
  } else {
    const itemDef = pick as ItemDefinition;
    if (itemDef.onPickup) ctx.player = itemDef.onPickup(ctx.player);
    ctx.player.items.push(itemDef.id);
    installItemReactions(ctx);
  }
  recomputeModifiers(ctx);
  _weaponSystemRef.recomputeWeaponMods();
}

let _yoloCtx: RunContext | null = null;
function _yoloHandler(): void {
  if (!_yoloCtx) return;
  if (!_yoloCtx.player.items.includes('yolo')) return;
  if (_yoloCtx.player.stress < 90) {
    _yoloCtx.player.stress = 90;
  }
}

// ── §E1 handlers ────────────────────────────────────────────────────────────

// ---- triple_espresso ----
let _tripleEspressoCtx: RunContext | null = null;
function _tripleEspressoHandler(): void {
  if (!_tripleEspressoCtx) return;
  const ctx = _tripleEspressoCtx;
  if (!ctx.player.items.includes('triple_espresso')) return;
  if (!_sceneRef) return;
  // Remove previous bonus before adding new one (stacking calls reset the timer)
  ctx.player.speed -= ctx.tripleEspressoSpeedBonus;
  const bonus = ctx.player.speed * (ITEMS_E1.ESPRESSO_SPEED_MULT - 1);
  ctx.tripleEspressoSpeedBonus = bonus;
  ctx.player.speed += bonus;
  _sceneRef.time.delayedCall(ITEMS_E1.ESPRESSO_DURATION_MS, () => {
    if (!_tripleEspressoCtx) return;
    _tripleEspressoCtx.player.speed -= bonus;
    _tripleEspressoCtx.tripleEspressoSpeedBonus = 0;
  });
}

// ---- sello_de_goma ----
let _sellaDeGomaCtx: RunContext | null = null;
function _sellaDeGomaKillHandler(): void {
  if (!_sellaDeGomaCtx) return;
  const ctx = _sellaDeGomaCtx;
  if (!ctx.player.items.includes('sello_de_goma')) return;
  if (ctx.sellaDeGomaReady) return; // already armed, don't over-count
  ctx.sellaDeGomaKills++;
  if (ctx.sellaDeGomaKills >= ITEMS_E1.SELLO_KILL_THRESHOLD) {
    ctx.sellaDeGomaKills = 0;
    ctx.sellaDeGomaReady = true;
  }
}

// ---- combustible_rage ----
let _combustibleRageCtx: RunContext | null = null;
let _combustibleRageStacks = 0;
function _combustibleRageHandler(): void {
  if (!_combustibleRageCtx) return;
  const ctx = _combustibleRageCtx;
  if (!ctx.player.items.includes('combustible_rage')) return;
  if (!_sceneRef) return;
  if (_combustibleRageStacks >= ITEMS_E1.RAGE_MAX_STACKS) return;
  _combustibleRageStacks++;
  ctx.player.damageMultiplier *= (1 + ITEMS_E1.RAGE_STACK_DAMAGE);
  const stackAtApplication = _combustibleRageStacks;
  _sceneRef.time.delayedCall(ITEMS_E1.RAGE_DURATION_MS, () => {
    if (!_combustibleRageCtx) return;
    if (!_combustibleRageCtx.player.items.includes('combustible_rage')) return;
    void stackAtApplication;
    _combustibleRageStacks = Math.max(0, _combustibleRageStacks - 1);
    _combustibleRageCtx.player.damageMultiplier /= (1 + ITEMS_E1.RAGE_STACK_DAMAGE);
  });
}

// ---- escudo_grapas ----
let _escudoGrapasCtx: RunContext | null = null;
function _escudoGrapasResetHandler(): void {
  if (!_escudoGrapasCtx) return;
  const ctx = _escudoGrapasCtx;
  if (!ctx.player.items.includes('escudo_grapas')) return;
  ctx.escudoGrapasActive = true;
}

// ---- cadena_de_kills ----
let _cadenaCtx: RunContext | null = null;
let _cadenaStreak = 0;
function _cadenaKillHandler(): void {
  if (!_cadenaCtx) return;
  const ctx = _cadenaCtx;
  if (!ctx.player.items.includes('cadena_de_kills')) return;
  _cadenaStreak++;
  ctx.player.damageMultiplier *= (1 + ITEMS_E1.CADENA_DAMAGE_PER_KILL);
}
function _cadenaHitHandler(): void {
  if (!_cadenaCtx) return;
  const ctx = _cadenaCtx;
  if (!ctx.player.items.includes('cadena_de_kills')) return;
  if (_cadenaStreak <= 0) return;
  // Undo accumulated bonus
  const factor = Math.pow(1 + ITEMS_E1.CADENA_DAMAGE_PER_KILL, _cadenaStreak);
  ctx.player.damageMultiplier /= factor;
  _cadenaStreak = 0;
}

// ---- explosion_al_matar ----
let _explosionAlMatarCtx: RunContext | null = null;
function _explosionAlMatarHandler(payload: { isElite: boolean; x: number; y: number; sourceId: string }): void {
  if (!_explosionAlMatarCtx) return;
  if (!_explosionAlMatarCtx.player.items.includes('explosion_al_matar')) return;
  if (!payload.isElite) return;
  if (!_enemySystemRef) return;
  // damage = 50% of the elite's max HP — payload carries x/y; estimate damage from sourceId or use fixed
  // We don't have the enemy's maxHp in the payload; use a reasonable flat value based on wave scaling.
  // Faithful spec: "50% del HP del élite". The killed enemy's HP at time of kill = 0, but we need max.
  // Best effort: emit with a configurable base; actual élite HP varies but is typically 90–360.
  // Use ITEMS_E1.EXPLOSION_DAMAGE_FRAC × a reference elite HP of 150 (mid-game average).
  // This is a noted simplification — see report.
  const estimatedEliteHp = 150;
  const damage = estimatedEliteHp * ITEMS_E1.EXPLOSION_DAMAGE_FRAC;
  _enemySystemRef.damageInRadius(payload.x, payload.y, ITEMS_E1.EXPLOSION_RADIUS, damage, 'explosion_al_matar');
}

// ---- modo_dios_temporal ----
let _modoDiosCtx: RunContext | null = null;
function _startModoDiosTimer(_initialCtx: RunContext): void {
  if (!_sceneRef) {
    // Retry once scene ref is available (should always be set before first pickup)
    return;
  }
  _sceneRef.time.delayedCall(ITEMS_E1.MODO_DIOS_INTERVAL_MS, () => {
    if (!_modoDiosCtx) return;
    if (!_modoDiosCtx.player.items.includes('modo_dios_temporal')) return;
    // Activate god mode
    _modoDiosCtx.modoDiosActive = true;
    _modoDiosCtx.modoDiosDamageBoost = true;
    _sceneRef!.time.delayedCall(ITEMS_E1.MODO_DIOS_DURATION_MS, () => {
      if (!_modoDiosCtx) return;
      _modoDiosCtx.modoDiosActive = false;
      _modoDiosCtx.modoDiosDamageBoost = false;
      // Schedule next cycle
      _startModoDiosTimer(_modoDiosCtx);
    });
  });
}

/** Apply item onPickup and install reactions. */
export function applyItemPickup(
  ctx: RunContext,
  itemDef: import('@/types').ItemDefinition,
): void {
  // Apply onPickup
  if (itemDef.onPickup) {
    ctx.player = itemDef.onPickup(ctx.player);
  }

  // Track item ownership
  ctx.player.items.push(itemDef.id);

  // Install reactive handlers
  installItemReactions(ctx);

  // Notify RunTracker (and any subscriber) of item acquisition
  ctx.bus.emit('item:acquired', { id: itemDef.id });
}
