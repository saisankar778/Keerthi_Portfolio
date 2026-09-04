#!/usr/bin/env python3
"""Turn one source photo into the two portraits the page needs.

    pip install pillow rembg onnxruntime scipy
    python3 tools/build-photos.py img/IMG_20260523_165645380_PCT.jpg.jpeg

Writes:
    img/keerthi-hero.webp    background removed, transparent, for the hero
    img/keerthi-about.webp   4:5 crop with its background, for the About frame

The hero uses u2net_human_seg, which is trained on people and holds up better
around hair and glasses than the general model. Alpha matting cleans the edge.
Both outputs are WebP: the hero is roughly ten times smaller than the same
image as PNG, and every browser that supports the CSS this page already uses
supports WebP.

ABOUT_BOX is tuned to this particular photo. For a different source, adjust it
so the crop runs from just above the head to about mid thigh, at a 4:5 ratio.
"""
import os
import sys

import numpy as np
from PIL import Image, ImageOps
from scipy.ndimage import uniform_filter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ABOUT_BOX = (172, 900, 2729, 4096)   # left, top, right, bottom on the upright source
HERO_WORK = (1200, 1600)             # matting resolution; the hero renders at 640px tall


def defringe(im, gamma=1.7, passes=7, solid=0.94, k=5):
    """Remove the halo rembg leaves around the subject.

    Partially transparent edge pixels still carry colour from the original
    background, which reads as a pale rim once the cutout sits on a dark
    ground. This edge-extends the solid foreground colour outward into those
    pixels and puts a gamma on alpha to tighten the matte.
    """
    a = np.asarray(im.getchannel('A')).astype(np.float32) / 255.0
    rgb = np.asarray(im.convert('RGB')).astype(np.float32)

    mask = (a > solid).astype(np.float32)
    num = rgb * mask[..., None]
    den = mask.copy()

    for _ in range(passes):
        num = uniform_filter(num, size=(k, k, 1), mode='nearest')
        den = uniform_filter(den, size=(k, k), mode='nearest')
        num = np.where(mask[..., None] > 0, rgb * mask[..., None], num)
        den = np.where(mask > 0, mask, den)

    extended = np.clip(num / np.maximum(den[..., None], 1e-4), 0, 255)
    out_rgb = np.where(mask[..., None] > 0, rgb, extended)
    out_a = np.clip(np.power(a, gamma) * 255.0, 0, 255)
    return Image.fromarray(
        np.concatenate([out_rgb, out_a[..., None]], axis=-1).astype(np.uint8), 'RGBA')


def main(src_path):
    os.chdir(ROOT)
    src = ImageOps.exif_transpose(Image.open(src_path))
    print('source', src.size)

    about = src.crop(ABOUT_BOX).resize((900, 1125), Image.LANCZOS).convert('RGB')
    about.save('img/keerthi-about.webp', quality=84, method=6)

    from rembg import remove, new_session
    cut = remove(
        src.resize(HERO_WORK, Image.LANCZOS),
        session=new_session('u2net_human_seg'),
        alpha_matting=True,
        alpha_matting_foreground_threshold=250,
        alpha_matting_background_threshold=15,
        alpha_matting_erode_size=6,
    )

    cut = defringe(cut)

    b = cut.getchannel('A').getbbox()
    pad = 8
    cut = cut.crop((max(0, b[0] - pad), max(0, b[1] - pad),
                    min(cut.width, b[2] + pad), min(cut.height, b[3] + pad)))
    cut.save('img/keerthi-hero.webp', quality=88, method=6)

    for f in ('img/keerthi-about.webp', 'img/keerthi-hero.webp'):
        print(f, Image.open(f).size, os.path.getsize(f) // 1024, 'KB')

    print('\nUpdate the width and height attributes in index.html if the sizes changed.')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit('usage: build-photos.py <source photo>')
    main(sys.argv[1])
