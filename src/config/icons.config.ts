// IDs de ítems/armas/maldiciones que tienen icono en public/assets/icons/<id>.png.
// Generado a partir de tools/map_icons.py. La textura se carga como `item_<id>`.
export const ICON_IDS: readonly string[] = [
  'all_hands', 'debug_laser', 'doble_monitor', 'powerpoint_feo', 'spreadsheet_god',
  'agile_sprint', 'auriculares', 'auriculares_nc', 'backup_plan', 'badge', 'benchmark',
  'botella_termica', 'cafe_con_leche', 'cafe_solo', 'cafeina_cronica', 'cafeteria_vip',
  'carta_renuncia', 'ceo_memo', 'coffee_thrower', 'debug_mode', 'ergonomia', 'excel_sheet',
  'exclusivity_contract', 'extintor', 'fotocopiadora', 'galleta', 'grapas_extra',
  'impresora_aliada', 'inbox_zero', 'ipo', 'lapicero_roto', 'linea_directa', 'linkedin_premium',
  'mandatory_overtime', 'meeting_overflow', 'micromanagement', 'modo_avion', 'moneda_olvidada',
  'ndas_firmadas', 'no_vacation', 'open_office', 'overtime', 'pivot', 'post_it_stack',
  'postit_launcher', 'powerpoint_cannon', 'reloj_roto', 'reunion_cancelada', 'stapler_gun',
  'stock_options', 'taza_rota', 'teclado_mecanico', 'termo', 'toxic_culture', 'vpn_corporativa',
  'whiteboard_marker', 'wifi_rapido', 'yolo',
];

/** Texture key para el icono de un id, o null si no tiene. */
export function iconKey(id: string): string {
  return `item_${id}`;
}
