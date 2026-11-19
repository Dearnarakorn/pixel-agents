"""Cat theme floor patterns: grayscale 16x16 tiles that stand in for a floor
pattern while the Cat theme is on (tile colours still colourize them).

  FLOOR_7  (bricks, the rooms and the cafe)  -> wood planks
  FLOOR_9  (big checkerboard)                -> woven sisal mat

    python make_cat_floors.py <preview.png> [<theme art dir>]

The preview shows each pattern, old and new, under the tile colours the
office's layout uses (Colorize as the office does it: lightness, contrast,
brightness, then the tile's hue and saturation).
"""
import colorsys
import json
import os
import sys

from PIL import Image

FORK = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
FLOORS = os.path.join(FORK, "webview-ui", "public", "assets", "floors")


def gray(v):
    return (v, v, v, 255)


def planks():
    """Planks 4 px high, seams staggered, a dark gap line under each, faint grain and a knot."""
    img = Image.new("RGBA", (16, 16))
    base = [172, 160, 178, 166]          # each plank a slightly different tone
    seams = [5, 13, 9, 1]                 # where each plank's end joint is
    for p in range(4):
        y0 = p * 4
        for y in range(y0, y0 + 4):
            for x in range(16):
                v = base[p]
                if y == y0 + 3:
                    v = 96                # the gap under the plank
                elif x == seams[p]:
                    v = 112               # end joint
                elif y == y0 and x != seams[p]:
                    v = base[p] + 14      # lit top edge
                elif y == y0 + 1 and (x + 4 * p) % 16 in (2, 3, 4, 11, 12):
                    v = base[p] - 10      # a long grain streak
                img.putpixel((x, y), gray(v))
    for (x, y) in ((10, 5), (11, 5), (3, 13)):  # knots
        img.putpixel((x, y), gray(124))
    return img


def sisal():
    """Basket weave: 4x4 blocks alternating horizontal and vertical strands."""
    img = Image.new("RGBA", (16, 16))
    for by in range(4):
        for bx in range(4):
            horiz = (bx + by) % 2 == 0
            for dy in range(4):
                for dx in range(4):
                    x, y = bx * 4 + dx, by * 4 + dy
                    line = dy if horiz else dx
                    v = (196, 168, 168, 132)[line]  # strand lit, mid, mid, shadow between strands
                    img.putpixel((x, y), gray(v))
    return img


NEW = {7: planks(), 9: sisal()}


def colorize(img, c):
    out = Image.new("RGBA", img.size)
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = img.getpixel((x, y))
            light = (0.299 * r + 0.587 * g + 0.114 * b) / 255
            if c.get("c"):
                light = 0.5 + (light - 0.5) * (100 + c["c"]) / 100
            if c.get("b"):
                light += c["b"] / 200
            light = min(1, max(0, light))
            rr, gg, bb = colorsys.hls_to_rgb(c.get("h", 0) / 360, light, c.get("s", 0) / 100)
            out.putpixel((x, y), (round(rr * 255), round(gg * 255), round(bb * 255), a))
    return out


def tiled(img, n=3):
    out = Image.new("RGBA", (16 * n, 16 * n))
    for j in range(n):
        for i in range(n):
            out.paste(img, (i * 16, j * 16))
    return out


def main():
    layout = json.load(open(os.path.expanduser("~/.pixel-agents/layout.json"), encoding="utf-8"))
    colours = {}
    for t, c in zip(layout["tiles"], layout.get("tileColors") or []):
        if t in NEW and c:
            colours.setdefault(t, [])
            if c not in colours[t]:
                colours[t].append(c)
    s = 4
    rows = []
    for t, new in NEW.items():
        old = Image.open(os.path.join(FLOORS, f"floor_{t - 1}.png")).convert("RGBA")
        for c in colours.get(t, [{"h": 0, "s": 0, "b": 0, "c": 0}]):
            rows.append((colorize(tiled(old), c), colorize(tiled(new), c)))
    cell = 48 * s
    prev = Image.new("RGBA", (cell * 2 + 24, len(rows) * (cell + 12)), (40, 40, 50, 255))
    for i, (a, b) in enumerate(rows):
        prev.paste(a.resize((cell, cell), Image.NEAREST), (0, i * (cell + 12)))
        prev.paste(b.resize((cell, cell), Image.NEAREST), (cell + 24, i * (cell + 12)))
    prev.save(sys.argv[1])
    print("preview", sys.argv[1], "rows", len(rows))
    if len(sys.argv) > 2:
        for t, img in NEW.items():
            img.save(os.path.join(sys.argv[2], f"FLOOR_{t}.png"))
        print("wrote", len(NEW), "floors to", sys.argv[2])


if __name__ == "__main__":
    main()
