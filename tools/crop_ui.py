"""Autorecorta (bbox por alfa) assets de UI y los guarda limpios en public/assets/ui/."""
import os
from PIL import Image

SRC = r"C:\Milton\OFFICE-SURVIVOR\assets\ui"
DST = r"C:\Milton\OFFICE-SURVIVOR\public\assets\ui"
os.makedirs(DST, exist_ok=True)

JOBS = {
    "hp_bar.png":     "Pixel_art_UI_HP_bar",
    "stress_bar.png": "Pixel_art_UI_stress_bar",
    "xp_bar.png":     "Pixel_art_XP_bar",
    "button.png":     "Pixel_art_UI_button",
    "logo.png":       "game_logo",
}


def find(sub):
    for f in os.listdir(SRC):
        if sub.lower() in f.lower() and f.lower().endswith(".png"):
            return os.path.join(SRC, f)
    return None


for out, sub in JOBS.items():
    src = find(sub)
    if not src:
        print("NO ENCONTRADO:", sub)
        continue
    im = Image.open(src).convert("RGBA")
    bbox = im.getbbox()  # caja del contenido no transparente
    crop = im.crop(bbox)
    crop.save(os.path.join(DST, out))
    print(f"{out}: {crop.size}  (de {im.size})")
