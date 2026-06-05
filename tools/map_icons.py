"""Copia los iconos de assets/icons a public/assets/icons con nombre = id del item/arma/maldición."""
import os
import shutil

SRC = r"C:\Milton\OFFICE-SURVIVOR\assets\icons"
DST = r"C:\Milton\OFFICE-SURVIVOR\public\assets\icons"
os.makedirs(DST, exist_ok=True)

# id -> substring único del nombre de archivo origen
MAP = {
    # armas
    "coffee_thrower": "coffee_thrower_weapon",
    "stapler_gun": "stapler_gun_icon",
    "postit_launcher": "post-it_launcher",
    "powerpoint_cannon": "cannon_icon",
    "whiteboard_marker": "marker_icon",
    "teclado_mecanico": "keyboard_icon",
    "botella_termica": "thermal_bottle_icon",
    "extintor": "fire_extinguisher_icon",
    "impresora_aliada": "printer_icon",
    # comunes
    "cafe_solo": "steaming_espresso_cup",
    "lapicero_roto": "yellow_pencil_snapped",
    "post_it_stack": "stack_of_post-its_arrow",
    "auriculares": "headphones_icon_202",   # base (sin _2)
    "excel_sheet": "pixel_art_excel_sheet_icon_202",
    "termo": "grey_thermos_with_logo",
    "grapas_extra": "open_box_staples",
    "galleta": "cookie_with_bite",
    "badge": "visitor_badge_with_clip",
    "linea_directa": "old_telephone",
    "cafe_con_leche": "coffee_cup_icon_202",
    "taza_rota": "cracked_mug_spilling",
    "moneda_olvidada": "gold_coin_under_keyboard",
    # raros
    "cafeina_cronica": "coffee_cups_icon",
    "fotocopiadora": "office_photocopier",
    "modo_avion": "paper_airplane_with_shield",
    "reunion_cancelada": "meeting_invitation",
    "wifi_rapido": "wifi_symbol",
    "overtime": "midnight_clock_with_coins",
    "ergonomia": "office_chair_icon",
    "backup_plan": "floppy_disk_with_shield",
    "reloj_roto": "broken_wristwatch",
    "auriculares_nc": "headphones_icon_202606041642_2",
    # épicos
    "debug_mode": "terminal_icon",
    "agile_sprint": "kanban_board",
    "carta_renuncia": "white_envelope_with_wax_seal_202606041642.",  # base
    "meeting_overflow": "exploding_calendar",
    "linkedin_premium": "badge_gold_crown",
    "inbox_zero": "inbox_tray_icon_202606041642.",  # base
    "vpn_corporativa": "lock_icon",
    "ndas_firmadas": "contract_icon",
    "cafeteria_vip": "luxury_coffee_table",
    "benchmark": "bar_chart_pixel_art",
    # legendarios
    "yolo": "flaming_die",
    "ceo_memo": "ceo_memo_pixel_art_icon",
    "pivot": "arrow_icon",
    "stock_options": "stock_chart_line_with_coins_202606041642.",  # base
    "ipo": "ipo_bell_icon",
    # sin arte específico → genéricos/variantes (ajustar al gusto)
    "spreadsheet_god": "excel_sheet_icon_202606041642(1)",
    "doble_monitor": "item_icon_202606041642.",
    "powerpoint_feo": "item_icon_202606041642_2",
    "all_hands": "item_icon_202606041642_3",
    "debug_laser": "weapon_icon_202606041642",
    # maldiciones (genéricas; ajustar al gusto)
    "micromanagement": "magnifying_glass_over_spreadshee",
    "exclusivity_contract": "curse_icon_202606041642.",     # base
    "no_vacation": "curse_icon_202606041642_2",
    "toxic_culture": "curse_icon_202606041642_3",
    "mandatory_overtime": "curse_icon_202606041642_4",
    "open_office": "curse_item_icon",
}


def find(sub):
    sub = sub.lower()
    for f in os.listdir(SRC):
        if sub in f.lower() and f.lower().endswith(".png"):
            return f
    return None


mapped, missing = [], []
for id_, sub in MAP.items():
    f = find(sub)
    if f:
        shutil.copy(os.path.join(SRC, f), os.path.join(DST, id_ + ".png"))
        mapped.append(id_)
    else:
        missing.append((id_, sub))

print("MAPPED (%d):" % len(mapped))
print(",".join(sorted(mapped)))
print("\nMISSING (%d):" % len(missing))
for id_, sub in missing:
    print(f"  {id_}  <-  '{sub}'")
