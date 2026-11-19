"""Cat theme carpet: the inside of carpet variant 0 (marching-squares case 15)
with a trail of paw prints. Carpets are two-colour (the sheet's dark grey is the
carpet's colour, its light grey the accent), so the paws are the accent colour.

    python make_cat_carpet.py <preview.png> [<theme art dir>]

Writes CARPET_0_15.png (16x16) and a preview: a few carpets of the layout's
colours, old and new, drawn junction by junction as the office does.
"""
import colorsys
import os
import sys

from PIL import Image

FORK = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
SHEET = os.path.join(FORK, "webview-ui", "public", "assets", "carpets", "carpet_0.png")
MAIN, ACCENT = (100, 100, 100, 255), (196, 196, 196, 255)

PAW = ["x.x.x", ".....", ".xxx.", "xxxxx", ".xxx."]
SMALL = [".x.x.", "x...x", ".xxx.", ".xxx."]


def inside():
    """Dark fill, one small paw print per tile (two looked busy on a room-sized carpet)."""
    img = Image.new("RGBA", (16, 16), MAIN)
    for (ox, oy) in ((5, 6),):
        for dy, row in enumerate(SMALL):
            for dx, ch in enumerate(row):
                if ch == "x":
                    img.putpixel((ox + dx, oy + dy), ACCENT)
    return img


def cases(sheet):
    return [sheet.crop(((k % 4) * 16, (k // 4) * 16, (k % 4) * 16 + 16, (k // 4) * 16 + 16)) for k in range(16)]


def flat(img, main, accent):
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    def col(c):
        light = min(1, max(0, 0.5 + c["b"] / 200))
        r, g, b = colorsys.hls_to_rgb(c["h"] / 360, light, c["s"] / 100)
        return (round(r * 255), round(g * 255), round(b * 255), 255)
    m, a = col(main), col(accent)
    for y in range(16):
        for x in range(16):
            p = img.getpixel((x, y))
            if p[3]:
                out.putpixel((x, y), a if p[:3] == ACCENT[:3] else m)
    return out


def carpet(sprites, w, h, main, accent):
    """A w x h carpet drawn from its junction sprites (each centred on a tile corner)."""
    out = Image.new("RGBA", ((w + 2) * 16, (h + 2) * 16), (150, 110, 70, 255))
    on = lambda c, r: 0 <= c < w and 0 <= r < h
    for jy in range(h + 1):
        for jx in range(w + 1):
            k = (on(jx - 1, jy - 1) * 1) | (on(jx, jy - 1) * 2) | (on(jx, jy) * 4) | (on(jx - 1, jy) * 8)
            if k:
                out.alpha_composite(flat(sprites[k], main, accent), (jx * 16 + 8, jy * 16 + 8))
    return out


def main():
    old = cases(Image.open(SHEET).convert("RGBA"))
    new = list(old)
    new[15] = inside()
    blue = ({"h": 236, "s": 46, "b": -30}, {"h": 44, "s": 62, "b": 8})
    teal = ({"h": 174, "s": 36, "b": -36}, {"h": 42, "s": 45, "b": 18})
    s = 4
    tiles = [carpet(set_, 5, 3, *c) for c in (blue, teal) for set_ in (old, new)]
    prev = Image.new("RGBA", (tiles[0].width * 2 * s + 16, tiles[0].height * 2 * s + 16), (40, 40, 50, 255))
    for i, t in enumerate(tiles):
        prev.alpha_composite(t.resize((t.width * s, t.height * s), Image.NEAREST),
                             ((i % 2) * (t.width * s + 16), (i // 2) * (t.height * s + 16)))
    prev.save(sys.argv[1])
    print("preview", sys.argv[1])
    if len(sys.argv) > 2:
        new[15].save(os.path.join(sys.argv[2], "CARPET_0_15.png"))
        print("wrote CARPET_0_15.png")


if __name__ == "__main__":
    main()
