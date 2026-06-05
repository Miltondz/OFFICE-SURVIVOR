"""Retrato por personaje: frame [0,0] -> recorte a la silueta (bbox) -> centrado en cuadro.
Así el personaje llena el icono (mejor resolución aparente) y todos quedan cuadrados/uniformes."""
import os
from PIL import Image

SRC = r"C:\Milton\OFFICE-SURVIVOR\assets\characters"
DST = r"C:\Milton\OFFICE-SURVIVOR\public\assets\characters"
os.makedirs(DST, exist_ok=True)

MAP = {
    "becario": "intern_sprite_sheet",
    "freelancer": "freelancer_sprite_sheet",
    "director": "corporate_director_sprite",
    "rrhh": "hr_representative_sprite",
    "consultor": "consultant_pixel_art",
}
COLS, ROWS = 5, 3
MARGIN = 6  # px de margen alrededor de la silueta dentro del cuadro


def find(sub):
    for f in os.listdir(SRC):
        if sub.lower() in f.lower() and f.lower().endswith(".png"):
            return os.path.join(SRC, f)
    return None


for id_, sub in MAP.items():
    src = find(sub)
    if not src:
        print("NO ENCONTRADO:", sub)
        continue
    im = Image.open(src).convert("RGBA")
    fw, fh = im.width // COLS, im.height // ROWS
    frame = im.crop((0, 0, fw, fh))
    bbox = frame.getbbox()
    char = frame.crop(bbox) if bbox else frame
    side = max(char.width, char.height) + MARGIN * 2
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(char, ((side - char.width) // 2, (side - char.height) // 2), char)
    canvas.save(os.path.join(DST, id_ + ".png"))
    print(f"{id_}.png: char {char.size} -> cuadro {side}x{side}")
