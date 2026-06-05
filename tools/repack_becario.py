"""
La hoja del becario es 4 columnas x 3 filas: [idle, walk1, walk2, death] x [abajo, lado, arriba],
con espaciado/margenes irregulares (no celdas uniformes) -> el spritesheet de Phaser corta los frames.
El resto de personajes son 5 columnas (idle, walk1, walk2, walk3, death).

Solucion: detectar el bbox de los 4 sprites de cada fila y re-empaquetar a una grid UNIFORME 5x3
con el orden estandar [idle, walk1, walk2, walk2(dup como walk3), death], sprite alineado abajo-centro.
Asi becario usa el mismo mapeo CHAR_SHEET que los demas, sin cambios de codigo, y sin cortes.
"""
import numpy as np
from PIL import Image

SRC = r"C:\Users\Usuario\Downloads\becario.png"   # fuente limpia
DST = r"C:\Milton\OFFICE-SURVIVOR\public\assets\characters\sheets\becario.png"

ROWS = [(104, 398), (420, 673), (698, 909)]  # bandas de fila (proyeccion de alfa)


def segs(p, thr):
    on = p > thr
    s, out = None, []
    for i, v in enumerate(on):
        if v and s is None:
            s = i
        if not v and s is not None:
            out.append((s, i - 1)); s = None
    if s is not None:
        out.append((s, len(on) - 1))
    return out


def autocrop(img):
    a = np.asarray(img)[:, :, 3]
    ys, xs = np.where(a > 16)
    if len(xs) == 0:
        return img
    return img.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def main():
    im = Image.open(SRC).convert("RGBA")
    A = (np.asarray(im)[:, :, 3] > 16).astype(np.uint8)

    rows_crops = []
    for (y0, y1) in ROWS:
        band = A[y0:y1 + 1, :]
        cs = [s for s in segs(band.sum(0), band.sum(0).max() * 0.05) if s[1] - s[0] > 15]
        if len(cs) != 4:
            raise SystemExit(f"fila {y0}: se esperaban 4 columnas, hay {len(cs)}: {cs}")
        # cs = [idle, walk1, walk2, death]
        crops = [autocrop(im.crop((cx0, y0, cx1 + 1, y1 + 1))) for (cx0, cx1) in cs]
        idle, w1, w2, death = crops
        rows_crops.append([idle, w1, w2, w2, death])  # 5-col: walk3 = dup walk2

    flat = [c for row in rows_crops for c in row]
    cw = max(c.width for c in flat) + 10
    ch = max(c.height for c in flat) + 10
    out = Image.new("RGBA", (cw * 5, ch * 3), (0, 0, 0, 0))
    for i, c in enumerate(flat):
        r, col = divmod(i, 5)
        x = col * cw + (cw - c.width) // 2          # centrado horizontal
        y = r * ch + (ch - c.height)                # alineado abajo
        out.paste(c, (x, y), c)
    out.save(DST)
    print(f"repack 5x3 cell={cw}x{ch} total={cw*5}x{ch*3}", flush=True)


if __name__ == "__main__":
    main()
