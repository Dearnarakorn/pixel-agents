"""Draw pixel-art bedroom furniture for the Pixel Agents office and install it
as an external asset pack: beds (3 blanket colours) with their covers, a
bedside table, a bedside table with a lit lamp, and a floor lamp.

Writes  ~/.pixel-agents/custom-assets/assets/furniture/<ID>/
        (manifest.json + a PNG drawn pixel by pixel below)
and adds that folder to "externalAssetDirectories" in ~/.pixel-agents/config.json
(stop the Pixel Agents server first; it loads asset folders at start).

How the pieces behave in the office:
- PA_BED_*       "chairs", 1x2 tiles, top tile (headboard + pillow) is a
                 background tile: one seat on the lower tile, pillow tile walkable.
- PA_BEDCOVER_*  "decor" on the bed's lower tile; its sprite is taller than a
                 tile, so it is drawn after (in front of) the sleeper = tucked in.
- PA_NIGHTSTAND  "decor", 1 tile.
- PA_NIGHTSTAND_LAMP, PA_FLOOR_LAMP  "decor", 1x2 tiles, the top tile (the
                 lamp) is a background tile: only the lower tile blocks.
- PA_WARDROBE    "storage", 2x2 tiles, top row is background (stands against a wall).
Rugs are not furniture: the office draws furniture over anyone standing on it,
so rugs are painted with the built-in carpet layer (see make_bedroom_beds.py).

Usage: python make_bed_asset.py
"""
import json
import os
import struct
import zlib

HOME = os.path.expanduser("~")
PACK = os.path.join(HOME, ".pixel-agents", "custom-assets")
CONFIG = os.path.join(HOME, ".pixel-agents", "config.json")

OUTLINE = (43, 29, 20)
WOOD, WOOD_HI, WOOD_LO = (138, 90, 52), (171, 116, 66), (104, 66, 38)
SHEET, SHEET_LO = (236, 231, 220), (205, 198, 184)
PILLOW, PILLOW_LO = (250, 248, 242), (214, 208, 196)
SHADE, SHADE_HI, SHADE_LO = (246, 208, 104), (255, 236, 160), (214, 164, 70)
GLOW = (255, 224, 130, 70)          # RGBA: soft light around the shade
BRASS, BRASS_LO = (190, 150, 70), (134, 100, 44)
KNOB = (228, 196, 110)
BLANKETS = {                    # name: (base, highlight, shadow)
    "BLUE": ((63, 95, 174), (92, 124, 200), (45, 69, 132)),
    "GREEN": ((62, 138, 96), (92, 168, 124), (44, 102, 70)),
    "ROSE": ((176, 78, 104), (206, 112, 134), (134, 54, 78)),
}
W = 16
COVER_H = 20


def canvas(h, w=W):
    return [[None] * w for _ in range(h)]


def rect(px, x0, y0, x1, y1, col):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            px[y][x] = col


def draw_bed(base, hi, lo):
    px = canvas(32)
    rect(px, 1, 0, 14, 0, OUTLINE)               # frame outline, rounded top corners
    rect(px, 0, 1, 15, 31, OUTLINE)
    rect(px, 1, 1, 14, 4, WOOD)                  # headboard
    rect(px, 1, 1, 14, 1, WOOD_HI)
    rect(px, 1, 4, 14, 4, WOOD_LO)
    rect(px, 4, 2, 4, 3, WOOD_LO)
    rect(px, 11, 2, 11, 3, WOOD_LO)
    rect(px, 1, 5, 14, 13, SHEET)                # mattress under the pillow
    rect(px, 1, 5, 14, 5, SHEET_LO)
    rect(px, 3, 6, 12, 11, OUTLINE)              # pillow
    rect(px, 4, 7, 11, 10, PILLOW)
    rect(px, 4, 10, 11, 10, PILLOW_LO)
    rect(px, 11, 7, 11, 10, PILLOW_LO)
    px[6][3] = px[6][12] = px[11][3] = px[11][12] = SHEET
    rect(px, 1, 13, 14, 15, SHEET)               # folded-back sheet
    rect(px, 1, 15, 14, 15, SHEET_LO)
    rect(px, 1, 12, 14, 12, OUTLINE)
    rect(px, 1, 16, 14, 28, base)                # blanket
    rect(px, 1, 16, 14, 16, hi)
    rect(px, 1, 17, 1, 28, hi)
    rect(px, 14, 17, 14, 28, lo)
    rect(px, 1, 28, 14, 28, lo)
    for y in (19, 22, 25):                       # quilt stitches
        for x in range(3, 13, 3):
            px[y][x] = lo
            px[y][x + 1] = hi
    rect(px, 1, 29, 14, 30, WOOD)                # footboard
    rect(px, 1, 29, 14, 29, WOOD_HI)
    rect(px, 0, 31, 15, 31, OUTLINE)
    return px


def draw_cover(base, hi, lo):
    """The part of the bed drawn IN FRONT of a sleeper: blanket + footboard,
    with the head end left open. Same pixels as the bed's lower tile, so an
    empty bed looks unchanged. It is 4 px taller than a tile (transparent
    rows at the bottom) only to raise its draw order above the character's."""
    bed = draw_bed(base, hi, lo)
    px = canvas(COVER_H)
    top = 5                                      # first covered row of the lower tile
    for y in range(top, 16):
        px[y] = list(bed[16 + y])
    for x in range(1, 15):                       # turned-down sheet edge under the chin
        px[top][x] = SHEET
        px[top + 1][x] = SHEET_LO
    px[top][0] = px[top][15] = px[top + 1][0] = px[top + 1][15] = OUTLINE
    return px


def draw_table(px, y0):
    """A small bedside table in the 16 rows starting at y0."""
    rect(px, 1, y0 + 2, 14, y0 + 4, OUTLINE)     # top slab
    rect(px, 2, y0 + 3, 13, y0 + 3, WOOD_HI)
    rect(px, 2, y0 + 5, 13, y0 + 13, OUTLINE)    # body
    rect(px, 3, y0 + 5, 12, y0 + 12, WOOD)
    rect(px, 3, y0 + 5, 12, y0 + 5, WOOD_LO)
    rect(px, 3, y0 + 9, 12, y0 + 9, WOOD_LO)     # drawer split
    px[y0 + 7][7] = px[y0 + 7][8] = KNOB
    px[y0 + 11][7] = px[y0 + 11][8] = KNOB
    rect(px, 2, y0 + 14, 3, y0 + 15, OUTLINE)    # legs
    rect(px, 12, y0 + 14, 13, y0 + 15, OUTLINE)


def draw_shade(px, y0):
    """A lit lamp shade, 8 rows tall, starting at y0, with a soft glow."""
    for y, (x0, x1) in enumerate(((5, 10), (5, 10), (4, 11), (4, 11), (3, 12), (3, 12))):
        rect(px, x0 - 1, y0 + 1 + y, x1 + 1, y0 + 1 + y, OUTLINE)
        rect(px, x0, y0 + 1 + y, x1, y0 + 1 + y, SHADE)
        px[y0 + 1 + y][x0] = SHADE_HI
        px[y0 + 1 + y][x1] = SHADE_LO
    rect(px, 5, y0, 10, y0, OUTLINE)             # top rim
    rect(px, 2, y0 + 7, 13, y0 + 7, OUTLINE)     # bottom rim
    rect(px, 6, y0 + 2, 7, y0 + 4, SHADE_HI)     # highlight
    for y in range(max(0, y0 - 2), y0 + 10):     # glow: only where nothing is drawn yet
        for x in range(W):
            if px[y][x] is None and abs(x - 7.5) + abs(y - (y0 + 4)) * 0.9 < 8.5:
                px[y][x] = GLOW


def draw_nightstand():
    px = canvas(16)
    draw_table(px, 0)
    return px


def draw_nightstand_lamp():
    px = canvas(32)
    draw_table(px, 16)
    rect(px, 7, 13, 8, 17, BRASS)                # stem down to the table top
    rect(px, 8, 13, 8, 17, BRASS_LO)
    rect(px, 5, 17, 10, 17, OUTLINE)             # foot on the table
    rect(px, 6, 16, 9, 16, BRASS)
    draw_shade(px, 5)
    return px


def draw_floor_lamp():
    px = canvas(32)
    rect(px, 7, 10, 8, 28, BRASS)                # pole
    rect(px, 8, 10, 8, 28, BRASS_LO)
    rect(px, 4, 29, 11, 30, OUTLINE)             # base
    rect(px, 5, 29, 10, 29, BRASS)
    rect(px, 3, 31, 12, 31, OUTLINE)
    draw_shade(px, 2)
    return px


def draw_wardrobe():
    """A two-door wooden wardrobe, 32x32: the top half stands against the wall."""
    px = canvas(32, 32)
    rect(px, 0, 1, 31, 3, OUTLINE)               # cornice
    rect(px, 1, 2, 30, 2, WOOD_HI)
    rect(px, 1, 4, 30, 29, OUTLINE)              # carcass
    rect(px, 2, 4, 29, 28, WOOD)
    rect(px, 2, 4, 29, 4, WOOD_LO)
    for x0 in (3, 17):                           # two doors with an inset panel each
        rect(px, x0, 6, x0 + 11, 27, OUTLINE)
        rect(px, x0 + 1, 7, x0 + 10, 26, WOOD_HI)
        rect(px, x0 + 2, 9, x0 + 9, 24, WOOD)
        rect(px, x0 + 2, 9, x0 + 9, 9, WOOD_LO)
        rect(px, x0 + 2, 9, x0 + 2, 24, WOOD_LO)
        rect(px, x0 + 10, 7, x0 + 10, 26, WOOD_LO)
    rect(px, 15, 5, 16, 28, OUTLINE)             # gap between the doors
    rect(px, 13, 16, 13, 18, KNOB)               # handles
    rect(px, 18, 16, 18, 18, KNOB)
    rect(px, 2, 30, 4, 31, OUTLINE)              # feet
    rect(px, 27, 30, 29, 31, OUTLINE)
    return px


def write_png(path, px):
    w, h = len(px[0]), len(px)
    raw = b""
    for row in px:
        raw += b"\x00"
        for c in row:
            raw += b"\x00\x00\x00\x00" if c is None else bytes(c if len(c) == 4 else (*c, 255))

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    open(path, "wb").write(png)


def install(item, name, category, px, footprint_h, background_tiles, footprint_w=1):
    folder = os.path.join(PACK, "assets", "furniture", item)
    os.makedirs(folder, exist_ok=True)
    write_png(os.path.join(folder, item + ".png"), px)
    manifest = {
        "id": item, "name": name, "category": category, "type": "asset",
        "file": item + ".png", "width": len(px[0]), "height": len(px),
        "footprintW": footprint_w, "footprintH": footprint_h,
        "canPlaceOnWalls": False, "canPlaceOnSurfaces": False, "backgroundTiles": background_tiles,
    }
    json.dump(manifest, open(os.path.join(folder, "manifest.json"), "w", encoding="utf-8"), indent=2)
    print("wrote", item)


def main():
    for name, colours in BLANKETS.items():
        install(f"PA_BED_{name}", f"Bed ({name.lower()})", "chairs", draw_bed(*colours), 2, 1)
        install(f"PA_BEDCOVER_{name}", f"Bed cover ({name.lower()})", "decor", draw_cover(*colours), 1, 1)
    install("PA_NIGHTSTAND", "Bedside table", "decor", draw_nightstand(), 1, 0)
    install("PA_NIGHTSTAND_LAMP", "Bedside table with lamp", "decor", draw_nightstand_lamp(), 2, 1)
    install("PA_FLOOR_LAMP", "Floor lamp", "decor", draw_floor_lamp(), 2, 1)
    install("PA_WARDROBE", "Wardrobe", "storage", draw_wardrobe(), 2, 1, footprint_w=2)

    cfg = json.load(open(CONFIG, encoding="utf-8"))
    dirs = cfg.get("externalAssetDirectories") or []
    if not any(os.path.normcase(os.path.normpath(d)) == os.path.normcase(PACK) for d in dirs):
        dirs.append(PACK)
        cfg["externalAssetDirectories"] = dirs
        tmp = CONFIG + ".tmp"
        json.dump(cfg, open(tmp, "w", encoding="utf-8"), indent=2)
        os.replace(tmp, CONFIG)
        print("registered asset folder in config.json")
    else:
        print("asset folder already registered")


if __name__ == "__main__":
    main()
