"""
Recorta al bbox y copia sprites de proyectiles y pickups a public/.
- Proyectiles -> public/assets/projectiles/<weaponId>.png
- Pickups     -> public/assets/pickups/<kind>.png
Todas las fuentes ya son PNG transparentes; solo se hace autocrop para que el escalado sea ajustado.
"""
import os, glob
from PIL import Image
import numpy as np

ROOT = r"C:\Milton\OFFICE-SURVIVOR\assets"
OUT_PROJ = r"C:\Milton\OFFICE-SURVIVOR\public\assets\projectiles"
OUT_PICK = r"C:\Milton\OFFICE-SURVIVOR\public\assets\pickups"

# weaponId -> patron de archivo fuente (carpeta projectiles salvo nota)
PROJ = {
    "coffee_thrower":   "projectiles/Pixel_art_coffee_drop_sprite*.png",
    "stapler_gun":      "extra/Pixel_art_staple_sprite_202606041642.png",
    "debug_laser":      "projectiles/Green_cyan_debug_laser_line*.png",
    "postit_launcher":  "projectiles/Pixel_art_paper_sheet*.png",
    "powerpoint_cannon":"projectiles/Pixel_art_projectile_sprite_202606041642.png",
    "whiteboard_marker":"projectiles/Blue-black_marker_blob_sprite*.png",
    "teclado_mecanico": "projectiles/Pixel_art_keyboard_key*.png",
    "botella_termica":  "projectiles/Blue_asterisk_water_splash_sprite_202606041642_3.png",
    "extintor":         "projectiles/Pixel_art_CO2_extinguisher_cloud*.png",
    "impresora_aliada": "projectiles/Pixel_art_paper_airplane*.png",
}

PICK = {
    "moneda":  "pickups/Pixel_art_gold_coin_sprite*.png",
    "cafe":    "pickups/Pixel_art_coffee_cup_sprite*.png",
    "galleta": "pickups/Pixel_art_cookie_sprite*.png",
    "stress":  "pickups/Pixel_art_pickup_sprite*.png",
}


def autocrop(path, dst):
    im = Image.open(path).convert("RGBA")
    a = np.asarray(im)[:, :, 3]
    ys, xs = np.where(a > 16)
    if len(xs):
        im = im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))
    im.save(dst)
    return im.size


def run(mapping, outdir):
    os.makedirs(outdir, exist_ok=True)
    for key, pat in mapping.items():
        hits = glob.glob(os.path.join(ROOT, pat))
        if not hits:
            print(f"  MISSING {key}: {pat}", flush=True)
            continue
        w, h = autocrop(hits[0], os.path.join(outdir, f"{key}.png"))
        print(f"  {key}: {os.path.basename(hits[0])[:40]} -> {w}x{h}", flush=True)


if __name__ == "__main__":
    print("PROYECTILES:")
    run(PROJ, OUT_PROJ)
    print("PICKUPS:")
    run(PICK, OUT_PICK)
    print("LISTO", flush=True)
