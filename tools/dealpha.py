"""
Convierte los JPG de assets/ (con fondo de damero falso) a PNG con fondo transparente.
Método: detecta píxeles "tipo fondo" (claros y poco saturados = blanco/gris del damero)
y los vuelve transparentes SOLO si están conectados al borde (flood-fill). Así los blancos
internos (logos, papel) y los cuerpos gris-claro encerrados por el contorno negro se preservan.
"""
import os
import sys
import numpy as np
from PIL import Image

ASSETS = r"C:\Milton\OFFICE-SURVIVOR\assets"

# Umbrales del fondo (damero falso): gris NEUTRO (saturación ~0) y por encima del negro del contorno.
# El damero varía por imagen (claro 200-255, medio 124-158, oscuro 80-109): todos neutros.
# Los cuerpos grises del sprite también son neutros, pero quedan protegidos por su contorno negro
# (value < VAL_MIN actúa de barrera) y por estar conectados sólo hacia adentro (flood desde el borde).
VAL_MIN = 70       # value (0-255): el negro del contorno (~0-40) queda por debajo y bloquea el flood
SAT_MAX = 0.12     # saturación 0-1: damero neutro pasa; fondos de pantalla azulados (sat>0.2) NO

# Archivos que son FONDOS de pantalla (opacos por diseño): no se les quita el fondo.
SKIP = ('background', 'floor', 'carpet', '_wall', 'building', 'abandoned', 'trashed', 'victory')


def bg_mask(rgb):
    r = rgb[:, :, 0].astype(np.int16)
    g = rgb[:, :, 1].astype(np.int16)
    b = rgb[:, :, 2].astype(np.int16)
    mx = np.maximum(np.maximum(r, g), b)
    mn = np.minimum(np.minimum(r, g), b)
    val = mx
    sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0.0)
    return (val >= VAL_MIN) & (sat <= SAT_MAX)


def border_connected(mask):
    """Subconjunto de `mask` conectado (4-vecindad) al borde de la imagen."""
    reach = np.zeros_like(mask)
    reach[0, :] |= mask[0, :]
    reach[-1, :] |= mask[-1, :]
    reach[:, 0] |= mask[:, 0]
    reach[:, -1] |= mask[:, -1]
    h, w = mask.shape
    max_iter = h + w + 4
    for _ in range(max_iter):
        d = reach.copy()
        d[1:, :] |= reach[:-1, :]
        d[:-1, :] |= reach[1:, :]
        d[:, 1:] |= reach[:, :-1]
        d[:, :-1] |= reach[:, 1:]
        d &= mask
        if np.array_equal(d, reach):
            return d
        reach = d
    return reach


def convert(path):
    img = Image.open(path).convert("RGB")
    rgb = np.asarray(img)
    transparent = border_connected(bg_mask(rgb))
    alpha = np.where(transparent, 0, 255).astype(np.uint8)
    out = np.dstack([rgb, alpha])
    res = Image.fromarray(out, "RGBA")
    dst = os.path.splitext(path)[0] + ".png"
    res.save(dst)
    return dst, int(transparent.sum()), transparent.size


def main():
    files = [f for f in os.listdir(ASSETS) if f.lower().endswith((".jpeg", ".jpg"))]
    files.sort()
    total = len(files)
    print(f"Convirtiendo {total} archivos...", flush=True)
    for i, f in enumerate(files, 1):
        low = f.lower()
        if any(s in low for s in SKIP):
            # Fondo de pantalla: convertir a PNG opaco sin keying.
            Image.open(os.path.join(ASSETS, f)).convert("RGB").save(
                os.path.splitext(os.path.join(ASSETS, f))[0] + ".png")
            print(f"[{i}/{total}] {os.path.splitext(f)[0]}.png  (FONDO opaco, sin keying)", flush=True)
            continue
        try:
            dst, t, n = convert(os.path.join(ASSETS, f))
            pct = 100 * t / n
            print(f"[{i}/{total}] {os.path.basename(dst)}  transp={pct:.0f}%", flush=True)
        except Exception as e:
            print(f"[{i}/{total}] ERROR {f}: {e}", flush=True)
    print("LISTO", flush=True)


if __name__ == "__main__":
    main()
