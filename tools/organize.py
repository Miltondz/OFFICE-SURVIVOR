"""Organiza los PNG de assets/ en subcarpetas por tipo (reglas por palabra-clave, primer match gana)."""
import os
import shutil

A = r"C:\Milton\OFFICE-SURVIVOR\assets"

# Orden importa: específico -> general. (carpeta, [substrings en minúscula])
RULES = [
    ("backgrounds", ["office_floor_background", "corporate_building", "abandoned_office", "trashed_office"]),
    ("boss",        ["ceo_final_boss", "boss_hp_bar"]),
    ("characters",  ["intern_sprite", "freelancer_sprite", "consultant_pixel", "corporate_director_sprite", "hr_representative_sprite"]),
    ("enemies",     ["angry_email_enemy", "angry_client_enemy", "toxic_manager", "possessed_office_printer", "auditor_elite", "energy_shield"]),
    ("map",         ["filing_cabinet", "office_desk", "desk_turned-off", "office_plant", "plant_grey_pot",
                     "coffee_maker", "vending_machine", "fire_extinguisher_on_wall", "carpet_tile", "wall_tile"]),
    ("effects",     ["death_effect", "level_up_effect", "coin_pickup_effect", "coffee_steam_animation", "animation_sprite_sheet"]),
    ("projectiles", ["coffee_drop", "staple_sprite", "debug_laser", "paper_airplane_sprite", "marker_blob",
                     "keyboard_key", "water_splash", "co2_extinguisher_cloud", "paper_sheet", "projectile_sprite"]),
    ("pickups",     ["coffee_cup_sprite", "cookie_sprite", "gold_coin_sprite", "pickup_sprite"]),
    ("ui",          ["ui_hp_bar", "ui_stress_bar", "xp_bar", "ui_button", "ui_cards", "game_logo", "translucent_black_square"]),
    # icons = catch-all (todo lo demás)
]


def classify(name):
    low = name.lower()
    for folder, keys in RULES:
        if any(k in low for k in keys):
            return folder
    return "icons"


def main():
    files = [f for f in os.listdir(A) if f.lower().endswith(".png") and os.path.isfile(os.path.join(A, f))]
    counts = {}
    icons = []
    for f in files:
        folder = classify(f)
        dst = os.path.join(A, folder)
        os.makedirs(dst, exist_ok=True)
        shutil.move(os.path.join(A, f), os.path.join(dst, f))
        counts[folder] = counts.get(folder, 0) + 1
        if folder == "icons":
            icons.append(f)
    print("== Conteo por carpeta ==")
    for k in sorted(counts):
        print(f"  {k:12} {counts[k]}")
    print(f"  TOTAL        {sum(counts.values())}")
    print("\n== icons/ (catch-all, verificar) ==")
    for n in sorted(icons):
        print("  " + n)


if __name__ == "__main__":
    main()
