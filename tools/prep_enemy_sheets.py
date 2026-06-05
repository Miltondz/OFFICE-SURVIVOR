"""
Prepara las hojas de sprites de enemigos para public/assets/enemies/sheets/<id>.png.
- Las hojas ya transparentes (angry_email, toxic_manager, possessed_printer) se copian tal cual.
- La hoja del auditor trae damero falso -> se le aplica el keying de dealpha.convert().
Solo se procesan los enemigos cuya hoja generada respeta la grid 4x3 (idle/move1/move2/death x abajo/lado/arriba).
angry_client (grid distinta) y hr_rep (sin hoja) quedan con su placeholder actual.
"""
import os, glob, shutil, sys
import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from dealpha import bg_mask, border_connected  # reutiliza el keying probado

SRC = r"C:\Milton\OFFICE-SURVIVOR\assets\enemies"
DST = r"C:\Milton\OFFICE-SURVIVOR\public\assets\enemies\sheets"

# id -> (glob del archivo fuente, requiere_keying)
SHEETS = {
    "angry_email":       ("Angry_email_enemy_sprite_sheet*.png", False),
    "toxic_manager":     ("Toxic_Manager_enemy_sprite_sheet*.png", False),
    "possessed_printer": ("Possessed_office_printer*.png", False),
    "auditor":           ("Auditor_Elite_enemy_sprite*.png", True),
}


def find(pattern):
    hits = glob.glob(os.path.join(SRC, pattern))
    if not hits:
        raise FileNotFoundError(pattern)
    return hits[0]


def dealpha_to(src, dst):
    rgb = np.asarray(Image.open(src).convert("RGB"))
    transparent = border_connected(bg_mask(rgb))
    alpha = np.where(transparent, 0, 255).astype(np.uint8)
    Image.fromarray(np.dstack([rgb, alpha]), "RGBA").save(dst)
    return 100 * int(transparent.sum()) / transparent.size


def segments(profile, thr):
    on = profile > thr
    segs, s = [], None
    for i, v in enumerate(on):
        if v and s is None:
            s = i
        if not v and s is not None:
            segs.append((s, i - 1)); s = None
    if s is not None:
        segs.append((s, len(on) - 1))
    return segs


def autocrop_cell(rgba):
    """Recorta al bbox de píxeles opacos."""
    a = np.asarray(rgba)[:, :, 3]
    ys, xs = np.where(a > 16)
    if len(xs) == 0:
        return rgba
    return rgba.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def repack_angry_client(src, dst):
    """
    Hoja angry_client: grid irregular 7 col (6 walk + death separado) x 4 filas (dir).
    Reempaqueta a 4 col (idle, walk1, walk2, death) x 3 filas (abajo, lado, arriba)
    para reusar el mapeo estandar ENEMY_SHEET.
    """
    rgb = np.asarray(Image.open(src).convert("RGB"))
    transp = border_connected(bg_mask(rgb))
    alpha = np.where(transp, 0, 255).astype(np.uint8)
    full = Image.fromarray(np.dstack([rgb, alpha]), "RGBA")
    op = ~transp

    col_segs = segments(op.sum(0), op.sum(0).max() * 0.04)
    row_segs = segments(op.sum(1), op.sum(1).max() * 0.04)
    # fusiona micro-segmentos (ruido) con el anterior si quedan pegados
    col_segs = [s for s in col_segs if s[1] - s[0] > 20]
    row_segs = [s for s in row_segs if s[1] - s[0] > 20]
    assert len(col_segs) >= 7 and len(row_segs) >= 4, (len(col_segs), len(row_segs))

    src_rows = [row_segs[0], row_segs[1], row_segs[3]]      # abajo, lado, arriba
    src_cols = [col_segs[0], col_segs[2], col_segs[4], col_segs[6]]  # idle, walk1, walk2, death

    crops = []
    for (ry0, ry1) in src_rows:
        for (cx0, cx1) in src_cols:
            cell = full.crop((cx0, ry0, cx1 + 1, ry1 + 1))
            crops.append(autocrop_cell(cell))

    cw = max(c.width for c in crops) + 8
    ch = max(c.height for c in crops) + 8
    out = Image.new("RGBA", (cw * 4, ch * 3), (0, 0, 0, 0))
    for i, c in enumerate(crops):
        r, col = divmod(i, 4)
        x = col * cw + (cw - c.width) // 2          # centrado horizontal
        y = r * ch + (ch - c.height)                # alineado al borde inferior de la celda
        out.paste(c, (x, y), c)
    out.save(dst)
    return cw, ch


def main():
    os.makedirs(DST, exist_ok=True)
    for eid, (pat, key) in SHEETS.items():
        src = find(pat)
        dst = os.path.join(DST, f"{eid}.png")
        w, h = Image.open(src).size
        if key:
            pct = dealpha_to(src, dst)
            print(f"{eid}: keying {os.path.basename(src)} {w}x{h} transp={pct:.0f}%", flush=True)
        else:
            shutil.copyfile(src, dst)
            print(f"{eid}: copy   {os.path.basename(src)} {w}x{h}", flush=True)

    # hr_rep: sin hoja propia -> usar la hoja extra del manager elite (rojo), 4x3 limpia.
    hr_src = find("Toxic_manager_elite_enemy_sprite*.png")
    shutil.copyfile(hr_src, os.path.join(DST, "hr_rep.png"))
    print(f"hr_rep: copy   {os.path.basename(hr_src)} (stand-in manager elite)", flush=True)

    # angry_client: grid irregular -> reempaquetar a 4x3 uniforme.
    ac_src = find("Angry_client_enemy_sprite*.png")
    cw, ch = repack_angry_client(ac_src, os.path.join(DST, "angry_client.png"))
    print(f"angry_client: repack 4x3 cell={cw}x{ch} total={cw*4}x{ch*3}", flush=True)

    print("LISTO", flush=True)


if __name__ == "__main__":
    main()
