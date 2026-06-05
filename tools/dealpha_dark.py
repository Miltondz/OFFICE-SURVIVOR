"""
Segunda pasada: para los sprites cuyo fondo NO es damero gris sino un color sólido
(negro, gris-pizarra…), quita el fondo por flood-fill del color del borde con tolerancia.
Solo procesa los PNG que quedaron totalmente opacos (la primera pasada no les hizo nada)
y que no son fondos de pantalla.
"""
import os
import numpy as np
from PIL import Image

ASSETS = r"C:\Milton\OFFICE-SURVIVOR\assets"
SKIP = ('background', 'floor', 'carpet', '_wall', 'building', 'abandoned', 'trashed', 'victory')
TOL = 42          # distancia de color (Euclídea aprox) para considerar "fondo"


def border_connected(mask):
    reach = np.zeros_like(mask)
    reach[0, :] |= mask[0, :]; reach[-1, :] |= mask[-1, :]
    reach[:, 0] |= mask[:, 0]; reach[:, -1] |= mask[:, -1]
    h, w = mask.shape
    for _ in range(h + w + 4):
        d = reach.copy()
        d[1:, :] |= reach[:-1, :]; d[:-1, :] |= reach[1:, :]
        d[:, 1:] |= reach[:, :-1]; d[:, :-1] |= reach[:, 1:]
        d &= mask
        if np.array_equal(d, reach):
            return d
        reach = d
    return reach


def is_opaque_png(path):
    try:
        im = Image.open(path)
        if im.mode != "RGBA":
            return True
        a = np.asarray(im)[:, :, 3]
        return (a == 255).mean() > 0.999
    except Exception:
        return False


def key_corner(jpg):
    rgb = np.asarray(Image.open(jpg).convert("RGB")).astype(np.int16)
    h, w, _ = rgb.shape
    # color de fondo = mediana del anillo de 2px del borde
    ring = np.concatenate([
        rgb[:2].reshape(-1, 3), rgb[-2:].reshape(-1, 3),
        rgb[:, :2].reshape(-1, 3), rgb[:, -2:].reshape(-1, 3),
    ])
    bg = np.median(ring, axis=0)
    dist = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    mask = dist <= TOL
    transparent = border_connected(mask)
    alpha = np.where(transparent, 0, 255).astype(np.uint8)
    out = np.dstack([rgb.astype(np.uint8), alpha])
    dst = os.path.splitext(jpg)[0] + ".png"
    Image.fromarray(out, "RGBA").save(dst)
    return transparent.mean() * 100


def main():
    files = [f for f in os.listdir(ASSETS) if f.lower().endswith((".jpeg", ".jpg"))]
    files.sort()
    done = 0
    for f in files:
        low = f.lower()
        if any(s in low for s in SKIP):
            continue
        png = os.path.splitext(os.path.join(ASSETS, f))[0] + ".png"
        if not is_opaque_png(png):
            continue  # ya se le quitó el fondo en la 1a pasada
        pct = key_corner(os.path.join(ASSETS, f))
        done += 1
        print(f"{os.path.splitext(f)[0]}.png  transp={pct:.0f}%  (corner key)", flush=True)
    print(f"LISTO ({done} procesados)", flush=True)


if __name__ == "__main__":
    main()
