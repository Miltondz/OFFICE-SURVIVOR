import type { RunContext } from './RunContext';
import { recomputeModifiers } from './RunContext';
import { ECONOMY } from '@/config/game.config';
import type { ItemDefinition } from '@/types';

// References injected by GameScene after instantiation
let _pickupSystemRef: { spawnStressPickup: (x: number, y: number) => void } | null = null;
let _weaponSystemRef: { recomputeWeaponMods: () => void } | null = null;
let _upgradePoolRef: { pick: (player: import('@/types').PlayerState, mods: import('@/types').RunModifiers, count: number, weaponLevels?: Record<string, number>, weaponsOnly?: boolean, forbidHighRarityWeapons?: boolean, forbidCommonItems?: boolean) => (import('@/types').ItemDefinition | import('@/types').WeaponDefinition)[] } | null = null;

export function setItemReactionDeps(
  pickupSys: { spawnStressPickup: (x: number, y: number) => void },
  weaponSys: { recomputeWeaponMods: () => void },
  upgradePool: { pick: (player: import('@/types').PlayerState, mods: import('@/types').RunModifiers, count: number, weaponLevels?: Record<string, number>, weaponsOnly?: boolean, forbidHighRarityWeapons?: boolean, forbidCommonItems?: boolean) => (import('@/types').ItemDefinition | import('@/types').WeaponDefinition)[] },
): void {
  _pickupSystemRef = pickupSys;
  _weaponSystemRef = weaponSys;
  _upgradePoolRef = upgradePool;
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
