import numpy as np
from PIL import Image

P = r"C:\Milton\OFFICE-SURVIVOR\assets\Blue-black_marker_blob_sprite_202606041642_2.jpeg"
DST = r"C:\Milton\OFFICE-SURVIVOR\assets\Blue-black_marker_blob_sprite_202606041642_2.png"

rgb = np.asarray(Image.open(P).convert("RGB")).astype(np.int16)
r, g, b = rgb[:, :, 0], rgb[:, :, 1], rgb[:, :, 2]
mx = np.maximum(np.maximum(r, g), b)
mn = np.minimum(np.minimum(r, g), b)
sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0.0)
mask = sat <= 0.12  # neutro = fondo (damero gris + marco negro + contorno del blob)

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
        break
    reach = d

alpha = np.where(reach, 0, 255).astype(np.uint8)
Image.fromarray(np.dstack([rgb.astype(np.uint8), alpha]), "RGBA").save(DST)
print("transp=%.0f%%" % (reach.mean() * 100))
