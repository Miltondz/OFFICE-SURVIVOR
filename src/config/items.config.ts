import type { ItemDefinition, WeaponDefinition, RunModifiers, PlayerState } from '@/types';
import { COMBAT, ITEMS_E1, ITEMS_E2 } from './game.config';

// ─── WEAPONS (10) ──────────────────────────────────────────────────────────

export const WEAPONS: WeaponDefinition[] = [
  {
    id: 'coffee_thrower',
    name: 'Coffee Thrower',
    description: 'Lanza café al enemigo. Slow 1s al impactar.',
    rarity: 'common',
    baseDamage: 12,
    fireRate: 1,
    range: 300,
    projectileCount: 1,
    tags: ['slow', 'arma'],
  },
  {
    id: 'stapler_gun',
    name: 'Stapler Gun',
    description: 'Dispara grapas en línea recta. Rápido.',
    rarity: 'common',
    baseDamage: 8,
    fireRate: 3,
    range: 200,
    projectileCount: 1,
    tags: ['rápido', 'arma'],
  },
  {
    id: 'debug_laser',
    name: 'Debug Laser',
    description: 'Haz continuo. 5 daño/tick a 7/s.',
    rarity: 'rare',
    baseDamage: 5,
    fireRate: 7,  // era 10 — DPS 50→35; sigue siendo el raro de alcance (balance v2)
    range: 400,
    projectileCount: 1,
    tags: ['continuo', 'arma', 'laser'],
  },
  {
    id: 'postit_launcher',
    name: 'Post-it Launcher',
    description: 'Dispara 2 proyectiles en abanico.',
    rarity: 'common',
    baseDamage: 6,
    fireRate: 2,
    range: 250,
    projectileCount: 2,  // era 3 — DPS 36→24; común no debe superar a raros (balance v2)
    tags: ['proyectiles', 'arma'],
  },
  {
    id: 'powerpoint_cannon',
    name: 'PowerPoint Cannon',
    description: 'Proyectil lento con alto daño. Aturde 1.5s.',
    rarity: 'rare',
    baseDamage: 35,
    fireRate: 0.5,  // era 0.3 — DPS 10.5→17.5; raro usable (balance v2)
    range: 350,
    projectileCount: 1,
    tags: ['stun', 'arma', 'lento'],
  },
  {
    id: 'whiteboard_marker',
    name: 'Whiteboard Marker',
    description: 'Proyectil corto + mancha de daño en suelo 3s.',
    rarity: 'common',
    baseDamage: 4,
    fireRate: 6,
    range: 180,
    projectileCount: 1,
    tags: ['zona', 'arma'],
  },
  {
    id: 'teclado_mecanico',
    name: 'Teclado Mecánico',
    description: 'Corto alcance. Knockback al enemigo.',
    rarity: 'common',
    baseDamage: 20,
    fireRate: 0.8,
    range: 150,
    projectileCount: 1,
    tags: ['knockback', 'arma'],
  },
  {
    id: 'botella_termica',
    name: 'Botella Térmica',
    description: 'Proyectil explosivo. AoE radio 60px.',
    rarity: 'rare',
    baseDamage: 15,
    fireRate: 1.5,
    range: 260,
    projectileCount: 1,
    tags: ['aoe', 'arma'],
  },
  {
    id: 'extintor',
    name: 'Extintor',
    description: 'Cono frontal. Congela 2s. Recarga 5s.',
    rarity: 'rare',
    baseDamage: 12,  // era 8 — raro con más pegada base; conserva su zona (balance v2)
    fireRate: 1,
    range: 200,
    projectileCount: 1,
    tags: ['freeze', 'arma', 'cono'],
  },
  {
    id: 'impresora_aliada',
    name: 'Impresora Aliada',
    description: 'Invoca torreta autónoma que sigue al jugador.',
    rarity: 'epic',
    baseDamage: 16,  // era 10 — épico debe pegar más; DPS torreta 20→32 (balance v2)
    fireRate: 2,
    range: 250,
    projectileCount: 1,
    tags: ['turreta', 'arma'],
  },
];

// ─── ITEMS (42) ─────────────────────────────────────────────────────────────

export const ITEMS: ItemDefinition[] = [

  // ── COMUNES (10) ──

  {
    id: 'cafe_solo',
    name: 'Café Solo',
    description: 'Consumible. -15 estrés al recoger.',
    rarity: 'common',
    category: 'consumable',
    tags: ['estrés', 'pickup'],
    synergyWith: ['cafeina_cronica'],
    onPickup: (p: PlayerState) => ({
      ...p,
      stress: Math.max(0, p.stress - 15),
    }),
  },
  {
    id: 'lapicero_roto',
    name: 'Lapicero Roto',
    description: '+8% daño. +1% daño extra por cada ítem adicional.',
    rarity: 'common',
    category: 'passive',
    tags: ['daño', 'escalado'],
    onPickup: (p: PlayerState) => ({
      ...p,
      damageMultiplier: p.damageMultiplier * (1.08 + p.items.length * 0.01),
    }),
  },
  {
    id: 'post_it_stack',
    name: 'Stack de Post-its',
    description: '+1 proyectil adicional a todas las armas.',
    rarity: 'common',
    category: 'passive',
    tags: ['proyectiles'],
    synergyWith: ['fotocopiadora'],
    applyModifiers: (m: RunModifiers) => { m.projectileBonus += 1; },
  },
  {
    id: 'auriculares',
    name: 'Auriculares',
    description: '+15% velocidad de movimiento. -5% daño recibido.',
    rarity: 'common',
    category: 'passive',
    tags: ['velocidad', 'defensa'],
    onPickup: (p: PlayerState) => ({ ...p, speed: p.speed * 1.15 }),
    applyModifiers: (m: RunModifiers) => { m.damageTakenMult *= 0.95; },
  },
  {
    id: 'excel_sheet',
    name: 'Hoja de Excel',
    description: 'Muestra HP exacto de cada enemigo.',
    rarity: 'common',
    category: 'passive',
    tags: ['utilidad', 'info'],
    // Shows integer HP text above each enemy in Enemy.preUpdate when item owned
  },
  {
    id: 'termo',
    name: 'Termo',
    description: 'Coffee Thrower hace slow +1s adicional.',
    rarity: 'common',
    category: 'passive',
    tags: ['arma', 'slow'],
    synergyWith: ['coffee_thrower'],
    // Effect applied in WeaponSystem.onProjectileHit via items check
  },
  {
    id: 'grapas_extra',
    name: 'Grapas Extra',
    description: '+30% cadencia de disparo a la Stapler Gun.',
    rarity: 'common',
    category: 'passive',
    tags: ['arma', 'cadencia'],
    synergyWith: ['stapler_gun'],
    // Applied via WeaponSystem.recomputeWeaponMods: stapler_gun inst.fireRateMult *= 1.30
  },
  {
    id: 'galleta',
    name: 'Galleta de Empresa',
    description: 'Consumible. +20 HP al recoger.',
    rarity: 'common',
    category: 'consumable',
    tags: ['hp', 'pickup'],
    onPickup: (p: PlayerState) => ({ ...p, hp: Math.min(p.maxHp, p.hp + 20) }),
  },
  {
    id: 'badge',
    name: 'Badge de Visitante',
    description: 'Enemigos tardan 0.5s más en detectarte al aparecer.',
    rarity: 'common',
    category: 'passive',
    tags: ['utilidad'],
    // Enemies spawned with detectionDelayMs = SPAWN.BADGE_DETECTION_DELAY_MS; idle until elapsed
  },
  {
    id: 'linea_directa',
    name: 'Línea Directa IT',
    description: 'Al llegar a 0 HP, sobrevives con 1 HP. Una vez por run.',
    rarity: 'common',
    category: 'passive',
    tags: ['defensa', 'escape'],
    maxStack: 1,
    // Effect handled in Player.takeDamage via items array check
  },

  // ── RAROS (11) ──

  {
    id: 'doble_monitor',
    name: 'Doble Monitor',
    description: '+25% daño. Puedes equipar 1 arma adicional (máx 5).',
    rarity: 'rare',
    category: 'passive',
    tags: ['daño', 'ranura'],
    maxStack: 1,
    applyModifiers: (m: RunModifiers) => {
      m.damageMult *= 1.25;
      m.maxWeapons = COMBAT.MAX_WEAPONS_WITH_MONITOR;
    },
  },
  {
    id: 'cafeina_cronica',
    name: 'Cafeína Crónica',
    description: 'En Burnout: +20% velocidad extra. Burnout no drena HP.',
    rarity: 'rare',
    category: 'passive',
    tags: ['estrés', 'burnout'],
    synergyWith: ['cafe_solo'],
    maxStack: 1,
    // HP drain prevention handled in StressSystem via items check
    onPickup: (p: PlayerState) => ({ ...p, speed: p.speed * 1.20 }),
  },
  {
    id: 'spreadsheet_god',
    name: 'Spreadsheet God',
    description: '10 kills sin recibir daño → +15% daño durante 10s.',
    rarity: 'rare',
    category: 'passive',
    tags: ['daño', 'racha'],
    maxStack: 1,
    // Reactive: handled in ItemReactions
  },
  {
    id: 'fotocopiadora',
    name: 'Fotocopiadora',
    description: 'Proyectiles rebotan una vez en el primer enemigo.',
    rarity: 'rare',
    category: 'passive',
    tags: ['proyectiles'],
    synergyWith: ['post_it_stack'],
    applyModifiers: (m: RunModifiers) => { m.bounce += 1; },
  },
  {
    id: 'modo_avion',
    name: 'Modo Avión',
    description: 'Inmune 2s tras recibir daño. Cooldown 8s.',
    rarity: 'rare',
    category: 'passive',
    tags: ['defensa', 'inmunidad'],
    maxStack: 1,
    // Handled in Player.takeDamage via modoAvion timers
  },
  {
    id: 'reunion_cancelada',
    name: 'Reunión Cancelada',
    description: 'Cada kill: 15% de soltar pickup de estrés (-10).',
    rarity: 'rare',
    category: 'passive',
    tags: ['estrés', 'kill'],
    maxStack: 1,
    // Reactive: handled in ItemReactions
  },
  {
    id: 'wifi_rapido',
    name: 'WiFi Rápido',
    description: '+25% velocidad de proyectiles. +10% alcance.',
    rarity: 'rare',
    category: 'passive',
    tags: ['arma', 'velocidad'],
    applyModifiers: (m: RunModifiers) => {
      m.projectileSpeedMult *= 1.25;
      m.rangeMult *= 1.10;
    },
  },
  {
    id: 'overtime',
    name: 'Horas Extra',
    description: '+40% XP ganada. -10% HP máximo.',
    rarity: 'rare',
    category: 'passive',
    tags: ['xp', 'tradeoff'],
    onPickup: (p: PlayerState) => ({
      ...p,
      maxHp: Math.floor(p.maxHp * 0.9),
      hp: Math.min(p.hp, Math.floor(p.maxHp * 0.9)),
    }),
    applyModifiers: (m: RunModifiers) => { m.xpMult *= 1.40; },
  },
  {
    id: 'powerpoint_feo',
    name: 'PowerPoint Feo',
    description: 'PowerPoint Cannon aturde +1.5s adicionales.',
    rarity: 'rare',
    category: 'passive',
    tags: ['arma', 'stun'],
    synergyWith: ['powerpoint_cannon'],
    maxStack: 1,
    // Handled in WeaponSystem via items check (stunDur + 1500)
  },
  {
    id: 'ergonomia',
    name: 'Silla Ergonómica',
    description: '+30 HP máximo. Estrés sube 20% más lento.',
    rarity: 'rare',
    category: 'passive',
    tags: ['hp', 'estrés'],
    onPickup: (p: PlayerState) => ({
      ...p,
      maxHp: p.maxHp + 30,
      hp: p.hp + 30,
    }),
    // Stress increase slowed via STRESS.ERGONOMIA_MULT in StressSystem.stressIncreaseMult
  },
  {
    id: 'backup_plan',
    name: 'Backup Plan',
    description: 'Al morir enemigo élite: 25% de clonar su drop de ítem.',
    rarity: 'rare',
    category: 'passive',
    tags: ['economía', 'suerte'],
    maxStack: 1,
    // On elite enemy:killed: 25% chance to pick 1 eligible item from UpgradePool (ItemReactions)
  },

  // ── ÉPICOS (10) ──

  {
    id: 'debug_mode',
    name: 'Modo Debug',
    description: 'Debug Laser ignora defensa y siempre crítico.',
    rarity: 'epic',
    category: 'passive',
    tags: ['arma', 'crítico'],
    synergyWith: ['debug_laser'],
    maxStack: 1,
    // Handled in WeaponSystem: debug_laser damage always × CRIT_MULTIPLIER when item owned
  },
  {
    id: 'agile_sprint',
    name: 'Agile Sprint',
    description: 'Al subir de nivel: +5% a todos los stats durante 30s.',
    rarity: 'epic',
    category: 'passive',
    tags: ['nivel', 'buff'],
    maxStack: 1,
    // Reactive: handled in LevelSystem
  },
  {
    id: 'carta_renuncia',
    name: 'Carta de Renuncia',
    description: 'En Burnout: kills restauran 2 HP. Sin drenaje.',
    rarity: 'epic',
    category: 'passive',
    tags: ['burnout', 'hp'],
    maxStack: 1,
    // HP drain prevention and kill-heal handled in StressSystem + ItemReactions
  },
  {
    id: 'meeting_overflow',
    name: 'Meeting Overflow',
    description: 'Enemigos al morir explotan (radio 80px).',
    rarity: 'epic',
    category: 'passive',
    tags: ['aoe', 'kill'],
    maxStack: 1,
    // Handled in EnemySystem overlap callback
  },
  {
    id: 'linkedin_premium',
    name: 'LinkedIn Premium',
    description: 'Monedas ×2. Meta-progresión cuesta 20% menos.',
    rarity: 'epic',
    category: 'passive',
    tags: ['economía', 'meta'],
    maxStack: 1,
    applyModifiers: (m: RunModifiers) => { m.coinMult *= 2; },
    // Meta-progression discount is Phase 4 content
  },
  {
    id: 'inbox_zero',
    name: 'Inbox Zero',
    description: 'Matar 50 enemigos en una oleada → próximo nivel ofrece 5 opciones.',
    rarity: 'epic',
    category: 'passive',
    tags: ['nivel', 'bonus'],
    maxStack: 1,
    // Handled in LevelSystem.optionCount
  },
  {
    id: 'vpn_corporativa',
    name: 'VPN Corporativa',
    description: 'Proyectiles atraviesan enemigos. Daño -15%.',
    rarity: 'epic',
    category: 'passive',
    tags: ['proyectiles'],
    maxStack: 1,
    applyModifiers: (m: RunModifiers) => {
      m.pierce = true;
      m.damageMult *= 0.85;
    },
  },
  {
    id: 'ndas_firmadas',
    name: 'NDAs Firmadas',
    description: 'Auditores mueren de un golpe. HR Rep no puede ralentizarte.',
    rarity: 'epic',
    category: 'passive',
    tags: ['enemigo'],
    maxStack: 1,
    // Handled in Enemy.takeDamage + EnemySystem HR aura check
  },
  {
    id: 'cafeteria_vip',
    name: 'Cafetería VIP',
    description: 'Cafés aparecen el doble. Cada café cura +10 HP.',
    rarity: 'epic',
    category: 'passive',
    tags: ['pickup', 'hp'],
    maxStack: 1,
    // PickupSystem: café spawn interval halved when owned; café collection heals +PICKUPS.CAFE_VIP_BONUS_HP
  },
  {
    id: 'benchmark',
    name: 'Benchmark',
    description: 'Tu arma top-daño gana +40% daño permanente.',
    rarity: 'epic',
    category: 'passive',
    tags: ['arma', 'escalado'],
    maxStack: 1,
    // Snapshot ctx.benchmarkWeaponId at pickup (GameScene); recomputeWeaponMods applies inst.damageMult *= 1.4
  },

  // ── LEGENDARIOS (6) ──

  {
    id: 'yolo',
    name: 'YOLO',
    description: 'Burnout permanente. No puedes bajar de 90 estrés. +60% daño total.',
    rarity: 'legendary',
    category: 'passive',
    tags: ['burnout', 'riesgo'],
    maxStack: 1,
    onPickup: (p: PlayerState) => ({ ...p, stress: Math.max(p.stress, 90) }),
    applyModifiers: (m: RunModifiers) => { m.damageMult *= 1.60; },
    // Stress floor enforced in ItemReactions _yoloHandler
  },
  {
    id: 'ceo_memo',
    name: 'Memo del CEO',
    description: 'Enemigos -20% HP. CEO +50% HP.',
    rarity: 'legendary',
    category: 'passive',
    tags: ['tradeoff'],
    maxStack: 1,
    // Enemy spawn HP ×CEO_MEMO_ENEMY_HP_MULT in EnemySystem.spawn; CEO HP ×CEO_MEMO_BOSS_HP_MULT in CEOBoss.
  },
  {
    id: 'all_hands',
    name: 'All Hands Meeting',
    description: 'Cada oleada superada: +3% daño acumulativo.',
    rarity: 'legendary',
    category: 'passive',
    tags: ['escalado'],
    maxStack: 1,
    // Reactive: handled in ItemReactions _allHandsHandler
  },
  {
    id: 'pivot',
    name: 'Pivot',
    description: 'Al nivel 10: todas las armas se reemplazan por versiones +50% stats.',
    rarity: 'legendary',
    category: 'passive',
    tags: ['transformación'],
    maxStack: 1,
    // At level 10, WeaponSystem.recomputeWeaponMods gives every weapon inst damageMult ×1.5, fireRateMult ×1.5.
  },
  {
    id: 'stock_options',
    name: 'Stock Options',
    description: 'Cada moneda recogida: +0.1% daño acumulativo. Sin cap.',
    rarity: 'legendary',
    category: 'passive',
    tags: ['economía', 'escalado'],
    maxStack: 1,
    // Reactive: handled in ItemReactions _stockOptionsHandler
  },
  {
    id: 'ipo',
    name: 'IPO',
    description: 'Al matar al CEO: la run continúa infinita. +25% dificultad cada 5min.',
    rarity: 'legendary',
    category: 'passive',
    tags: ['endgame'],
    maxStack: 1,
    // On boss:defeated, GameScene.ipoScaling enters infinite mode; EnemySystem.spawn scales hp/damage by difficultyMult.
  },

  // ── ADICIONALES v0.2 (canónicos — ver Game Bible §Adicionales) ──
  // 10 común + 11 raro + 10 épico + 6 legendario + 5 adicionales = 42 ítems.

  {
    id: 'moneda_olvidada',
    name: 'Moneda Olvidada',
    description: 'Consumible. +5 monedas al recoger.',
    rarity: 'common',
    category: 'consumable',
    tags: ['economía', 'pickup'],
    onPickup: (p: PlayerState) => ({ ...p, coins: p.coins + 5 }),
  },
  {
    id: 'cafe_con_leche',
    name: 'Café con Leche',
    description: '+10% daño. +5% velocidad de movimiento.',
    rarity: 'common',
    category: 'passive',
    tags: ['daño', 'velocidad'],
    onPickup: (p: PlayerState) => ({
      ...p,
      damageMultiplier: p.damageMultiplier * 1.10,
      speed: p.speed * 1.05,
    }),
  },
  {
    id: 'taza_rota',
    name: 'Taza Rota',
    description: '+20% daño. -5 HP máximo.',
    rarity: 'common',
    category: 'passive',
    tags: ['daño', 'tradeoff'],
    onPickup: (p: PlayerState) => ({
      ...p,
      damageMultiplier: p.damageMultiplier * 1.20,
      maxHp: Math.max(10, p.maxHp - 5),
    }),
  },
  {
    id: 'reloj_roto',
    name: 'Reloj Roto',
    description: '+15% cadencia de todas las armas.',
    rarity: 'rare',
    category: 'passive',
    tags: ['arma', 'cadencia'],
    applyModifiers: (m: RunModifiers) => { m.projectileSpeedMult *= 1.15; },
  },
  {
    id: 'auriculares_nc',
    name: 'Auriculares NC',
    description: '-10% daño recibido. Estrés sube 15% más lento.',
    rarity: 'rare',
    category: 'passive',
    tags: ['defensa', 'estrés'],
    applyModifiers: (m: RunModifiers) => { m.damageTakenMult *= 0.90; },
  },

  // ── §E1 NUEVOS COMUNES (5) ──────────────────────────────────────────────

  {
    id: 'triple_espresso',
    name: 'Triple Espresso',
    description: 'Al recoger cualquier pickup → +25% velocidad de movimiento durante 8s.',
    rarity: 'common',
    category: 'passive',
    tags: ['velocidad', 'pickup'],
    // Reactive: hook pickup:collected en ItemReactions — nuevo (fase E1)
  },
  {
    id: 'taza_grande',
    name: 'Taza Grande',
    description: '+20 HP máximo. Al recoger café, el efecto es ×1.5.',
    rarity: 'common',
    category: 'passive',
    tags: ['hp', 'cafe'],
    synergyWith: ['cafeteria_vip', 'cafe_solo'],
    maxStack: 1,
    onPickup: (p: PlayerState) => ({
      ...p,
      maxHp: p.maxHp + ITEMS_E1.TAZA_GRANDE_MAX_HP,
      hp: p.hp + ITEMS_E1.TAZA_GRANDE_MAX_HP,
    }),
    // Café bonus handled in PickupSystem.collect via items check — nuevo (fase E1)
  },
  {
    id: 'sello_de_goma',
    name: 'Sello de Goma',
    description: 'Cada 5 kills, el siguiente proyectil hace ×3 daño.',
    rarity: 'common',
    category: 'passive',
    tags: ['daño', 'kill'],
    // State: ctx.sellaDeGomaKills / ctx.sellaDeGomaReady; WeaponSystem reads ctx.sellaDeGomaReady — nuevo (fase E1)
    // Reactive: hook enemy:killed en ItemReactions
  },
  {
    id: 'grapadora_turbo',
    name: 'Grapadora Turbo',
    description: 'La Stapler Gun dispara una ráfaga de 3 balas.',
    rarity: 'common',
    category: 'passive',
    tags: ['arma', 'stapler_gun'],
    synergyWith: ['stapler_gun', 'grapas_extra'],
    maxStack: 1,
    // WeaponSystem case stapler_gun: burst 3 when item owned — nuevo (fase E1)
  },
  {
    id: 'pelota_stress',
    name: 'Pelota Anti-Estrés',
    description: 'Al recibir daño, 30% de probabilidad de anularlo completamente.',
    rarity: 'common',
    category: 'passive',
    tags: ['defensa', 'suerte'],
    // Player.takeDamage: roll antes de aplicar; si tiene item y roll ok → return — nuevo (fase E1)
  },

  // ── §E1 NUEVOS RAROS (4) ────────────────────────────────────────────────

  {
    id: 'combustible_rage',
    name: 'Combustible Rage',
    description: 'Cada golpe recibido: +5% daño durante 10s, acumulable hasta ×3.',
    rarity: 'rare',
    category: 'passive',
    tags: ['daño', 'racha'],
    synergyWith: ['yolo'],
    maxStack: 1,
    // Reactive: hook player:hit en ItemReactions — nuevo (fase E1)
  },
  {
    id: 'iman_de_monedas',
    name: 'Imán de Monedas',
    description: 'Radio de recogida ×4 y las monedas se mueven hacia ti.',
    rarity: 'rare',
    category: 'passive',
    tags: ['economía', 'pickup'],
    synergyWith: ['stock_options', 'linkedin_premium'],
    maxStack: 1,
    applyModifiers: (m: RunModifiers) => {
      // pickupRange stored for future pickup-radius expansion; attraction handled in PickupSystem — nuevo (fase E1)
      m.pickupRange += ITEMS_E1.IMAN_ATTRACT_RANGE;
    },
    // Coin attraction in PickupSystem.update when item owned — nuevo (fase E1)
  },
  {
    id: 'doble_disparo',
    name: 'Doble Disparo',
    description: '25% de probabilidad de disparar 2 proyectiles en vez de 1.',
    rarity: 'rare',
    category: 'passive',
    tags: ['proyectiles', 'suerte'],
    // WeaponSystem: roll per shot; si activo, spawn 1 proyectil extra idéntico — nuevo (fase E1)
  },
  {
    id: 'escudo_grapas',
    name: 'Escudo de Grapas',
    description: 'Absorbe el primer golpe de cada oleada sin daño. Se recarga entre oleadas.',
    rarity: 'rare',
    category: 'passive',
    tags: ['defensa', 'oleada'],
    maxStack: 1,
    // ctx.escudoGrapasActive reset en wave:start; consume en Player.takeDamage — nuevo (fase E1)
  },

  // ── §E1 NUEVOS ÉPICOS (2) ───────────────────────────────────────────────

  {
    id: 'cadena_de_kills',
    name: 'Cadena de Kills',
    description: 'Kills consecutivos sin recibir daño: +2% daño acumulativo. Se reinicia al recibir daño.',
    rarity: 'epic',
    category: 'passive',
    tags: ['daño', 'racha'],
    synergyWith: ['spreadsheet_god'],
    maxStack: 1,
    // Reactive: hooks enemy:killed / player:hit en ItemReactions — nuevo (fase E1)
  },
  {
    id: 'explosion_al_matar',
    name: 'Explosión al Matar',
    description: 'Al matar un enemigo élite → explosión AoE radio 150px por 50% del HP del élite.',
    rarity: 'epic',
    category: 'passive',
    tags: ['aoe', 'kill', 'élite'],
    maxStack: 1,
    // Reactive: hook enemy:killed isElite → enemySys.damageInRadius — nuevo (fase E1)
  },

  // ── §E2 NUEVOS COMUNES (1) ──────────────────────────────────────────────────

  {
    id: 'cable_trampa',
    name: 'Cable Trampa',
    description: 'Cuando un enemigo entra en 80px, lo aturde 0.8s. Cooldown 3s.',
    rarity: 'common',
    category: 'passive',
    tags: ['trampa', 'control'],
    // Update loop en GameScene/EnemySystem: si owned + cooldown listo → applyEffect stun — nuevo (fase E2)
  },

  // ── §E2 NUEVOS RAROS (2) ────────────────────────────────────────────────────

  {
    id: 'rebote_de_pared',
    name: 'Rebote de Pared',
    description: 'Los proyectiles rebotan en los bordes del mapa una vez. Con Fotocopiadora: hasta 3 veces.',
    rarity: 'rare',
    category: 'passive',
    tags: ['proyectiles', 'mapa'],
    synergyWith: ['fotocopiadora'],
    maxStack: 1,
    applyModifiers: (m: RunModifiers) => {
      m.wallBounce += ITEMS_E2.REBOTE_BASE_BUDGET;  // nuevo (fase E2)
    },
  },
  {
    id: 'cronometro_bala',
    name: 'Cronómetro Bala',
    description: 'Una vez por run: al bajar al 30% HP, el tiempo se ralentiza al 30% durante 5s mientras tú te mueves normal.',
    rarity: 'rare',
    category: 'passive',
    tags: ['utilidad', 'tiempo'],
    maxStack: 1,
    // Triggered in Player.takeDamage: first time hp ≤ 30% — nuevo (fase E2)
  },

  // ── §E2 NUEVOS ÉPICOS (4) ───────────────────────────────────────────────────

  {
    id: 'magnetismo_balas',
    name: 'Magnetismo de Balas',
    description: 'Tus proyectiles se curvan suavemente hacia el enemigo más cercano.',
    rarity: 'epic',
    category: 'passive',
    tags: ['proyectiles', 'precisión'],
    synergyWith: ['wifi_rapido'],
    maxStack: 1,
    // Steering en Projectile.preUpdate cuando item owned — nuevo (fase E2)
  },
  {
    id: 'segundo_corazon',
    name: 'Segundo Corazón',
    description: 'Un 2º depósito de 50 HP oculto. La primera vez que llegas a 0 HP, en vez de morir, se activa con 50 HP.',
    rarity: 'epic',
    category: 'passive',
    tags: ['defensa', 'hp'],
    synergyWith: ['linea_directa'],
    maxStack: 1,
    // ctx.secondHeartUsed / ctx.secondHeartHp; manejado en Player.takeDamage — nuevo (fase E2)
  },
  {
    id: 'teletransporte',
    name: 'Teletransporte',
    description: 'Cuando HP ≤ 25%: te teletransportas a una posición aleatoria del mapa. Cooldown 30s.',
    rarity: 'epic',
    category: 'passive',
    tags: ['defensa', 'movilidad'],
    synergyWith: ['modo_avion'],
    maxStack: 1,
    // Manejado en Player.takeDamage después de aplicar daño — nuevo (fase E2)
  },
  {
    id: 'fotocopiadora_armas',
    name: 'Fotocopiadora de Armas',
    description: 'Una vez por run: al adquirir, duplica el arma con más kills (añade una segunda instancia).',
    rarity: 'epic',
    category: 'passive',
    tags: ['arma', 'duplicar'],
    synergyWith: ['benchmark'],
    maxStack: 1,
    // On pickup en ItemReactions: si !ctx.fotocopiadoraArmasUsed → duplicar arma top-kills — nuevo (fase E2)
  },

  // ── §E2 NUEVOS LEGENDARIOS (2) ──────────────────────────────────────────────

  {
    id: 'avalancha',
    name: 'Avalancha',
    description: 'Al impactar un enemigo, genera un proyectil secundario con 50% de daño hacia el enemigo más cercano.',
    rarity: 'legendary',
    category: 'passive',
    tags: ['proyectiles', 'cadena'],
    maxStack: 1,
    // Hook en EnemySystem projectile overlap; isSecondary guard — nuevo (fase E2)
  },
  {
    id: 'singularidad',
    name: 'Singularidad',
    description: 'Cada 30 kills: crea un agujero negro en tu posición 3s que atrae y daña a los enemigos cercanos.',
    rarity: 'legendary',
    category: 'passive',
    tags: ['aoe', 'control'],
    maxStack: 1,
    // enemy:killed counter → singularidadKills; pull loop en GameScene/EnemySystem — nuevo (fase E2)
  },

  // ── §E1 NUEVOS LEGENDARIOS (2) ──────────────────────────────────────────────

  {
    id: 'modo_dios_temporal',
    name: 'Modo Dios Temporal',
    description: 'Cada 60s: 3s de invencibilidad y daño ×5.',
    rarity: 'legendary',
    category: 'passive',
    tags: ['invencibilidad', 'daño'],
    maxStack: 1,
    // Timer en ItemReactions; ctx.modoDiosActive / ctx.modoDiosDamageBoost leídos por Player / WeaponSystem — nuevo (fase E1)
  },
  {
    id: 'ultimo_cartucho',
    name: 'Último Cartucho',
    description: 'Cuando HP ≤ 20%, todas las armas disparan al triple de cadencia.',
    rarity: 'legendary',
    category: 'passive',
    tags: ['cadencia', 'supervivencia'],
    maxStack: 1,
    // WeaponSystem: if item owned y hp/maxHp ≤ ULTIMO_HP_THRESHOLD → fireRate ×ULTIMO_FIRERATE_MULT — nuevo (fase E1)
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

export function getItemById(id: string): ItemDefinition | undefined {
  return ITEMS.find(i => i.id === id);
}
export function getWeaponById(id: string): WeaponDefinition | undefined {
  return WEAPONS.find(w => w.id === id);
}
