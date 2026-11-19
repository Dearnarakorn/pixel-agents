"""Cat-habitat samples for the Cat theme (round 4 direction check).

Three pieces that turn a people room into a cat place, each the size of the
sprite it would replace:
  * donut bed      -> PA_BED_<colour> (16x32) + PA_BEDCOVER_<colour> (16x20, its front rim)
  * cardboard box  -> DESK_FRONT (48x32), laptop -> PC_FRONT_OFF / PC_FRONT_ON_1..3 (16x32)
  * window perch   -> WHITEBOARD (32x32)
Writes the sprites to <out>/ and a mock scene (<out>/mock.png, x6) with cats
from the theme's own sheets, so the look can be judged before installing.

Usage: python make_cat_room_samples.py <fork root> <out dir>
"""
import math
import os
import sys

from PIL import Image

FORK, OUT = sys.argv[1], sys.argv[2]
FURN = os.path.join(FORK, "webview-ui", "public", "assets", "furniture")
CATS = os.path.join(FORK, "webview-ui", "src", "characters", "cats")
CUSTOM = os.path.join(os.path.expanduser("~"), ".pixel-agents", "custom-assets", "assets", "furniture")

CLEAR = (0, 0, 0, 0)


def rgba(c):
    return c + (255,) if len(c) == 3 else c


def blank(w, h):
    return Image.new("RGBA", (w, h), CLEAR)


# ------------------------------------------------------------------ donut bed
BED_COLOURS = {  # fleece: light, mid, dark (from the bed blankets)
    "BLUE": ((120, 150, 214), (84, 114, 190), (52, 76, 140)),
    "GREEN": ((126, 196, 140), (88, 160, 108), (52, 112, 72)),
    "ROSE": ((236, 150, 170), (204, 104, 132), (150, 62, 92)),
}
CREAM, CREAM_D = (246, 236, 214), (218, 200, 172)
OUTLINE = (43, 29, 20)

# The ring, seen from the front and a little above: an outer ellipse, a hole
# (the cushion) nearer its top. A sleeper in it is drawn with its sprite
# bottom at bed row 30 (seat tile top + the 6 px sitting offset + 8), so its
# head is around rows 12-18: the back rim sits behind that, the front rim
# (the cover) covers its body from row 24 down.
CX, CY, RX, RY = 7.5, 22.5, 8.0, 9.0       # outer
HX, HY, HRX, HRY = 7.5, 20.5, 5.6, 4.2      # cushion inside
FRONT_FROM = 24                              # rows from here down are the front rim (the cover)


def inside(x, y, cx, cy, rx, ry):
    return ((x + 0.5 - cx - 0.5) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1.0


def donut(colour):
    light, mid, dark = BED_COLOURS[colour]
    img = blank(16, 32)
    for y in range(32):
        for x in range(16):
            if not inside(x, y, CX, CY, RX, RY):
                continue
            edge = not (inside(x - 1, y, CX, CY, RX, RY) and inside(x + 1, y, CX, CY, RX, RY)
                        and inside(x, y - 1, CX, CY, RX, RY) and inside(x, y + 1, CX, CY, RX, RY))
            if edge:
                c = OUTLINE
            elif inside(x, y, HX, HY, HRX, HRY):
                # cushion: cream, shaded at the back where the rim overhangs it
                c = CREAM_D if y <= HY - HRY + 1.5 else CREAM
            else:
                # fleece rim: lit at the top, darker towards the floor, a fold line round the hole
                near_hole = inside(x, y, HX, HY, HRX + 1.2, HRY + 1.2)
                if near_hole and y > HY:
                    c = dark  # the rim's inner lip in front of the cushion
                elif y < CY - 4:
                    c = light
                elif y < CY + 4:
                    c = mid
                else:
                    c = dark
            img.putpixel((x, y), rgba(c))
    # fluffy specks on the rim
    for (x, y) in ((3, 17), (11, 16), (2, 25), (13, 26), (6, 29), (10, 29)):
        if img.getpixel((x, y))[3]:
            img.putpixel((x, y), rgba(light))
    return img


def donut_cover(bed):
    """The front rim alone, 16x20, placed one tile down (bed rows 16-35)."""
    cover = blank(16, 20)
    for y in range(FRONT_FROM, 32):
        for x in range(16):
            p = bed.getpixel((x, y))
            # rim pixels only (not the cushion), so the sleeper shows inside the hole
            if p[3] and p[:3] not in (CREAM, CREAM_D):
                cover.putpixel((x, y - 16), p)
    return cover


# ------------------------------------------------------------- cardboard box
BOX_TOP, BOX_TOP_D = (222, 178, 118), (196, 152, 96)
BOX_FRONT, BOX_FRONT_D = (186, 138, 86), (156, 112, 66)
TAPE = (236, 214, 168)
INK = (96, 64, 40)
BOX_OUT = (70, 44, 28)


def cardboard_box():
    img = blank(48, 32)
    top0, top1, bottom = 10, 17, 31   # top face rows, front face to the floor
    for y in range(top0, bottom + 1):
        for x in range(1, 47):
            edge = x in (1, 46) or y in (top0, bottom)
            if edge:
                c = BOX_OUT
            elif y <= top1:
                c = BOX_TOP if y < top1 - 1 else BOX_TOP_D
            elif y == top1 + 1:
                c = BOX_OUT  # the box's front edge
            else:
                c = BOX_FRONT if y < bottom - 2 else BOX_FRONT_D
            img.putpixel((x, y), rgba(c))
    # the flaps' seam and its tape along the top
    for x in range(2, 46):
        img.putpixel((x, 13), rgba(TAPE))
        img.putpixel((x, 14), rgba(BOX_TOP_D))
    # tape running down the front from the seam
    for y in range(top1 + 2, bottom):
        for x in (23, 24):
            img.putpixel((x, y), rgba(TAPE))
    # printed marks: a paw-print stamp (left) and a fish (right)
    paw = ["x.x.x", ".....", ".xxx.", "xxxxx", ".xxx."]
    for dy, row in enumerate(paw):
        for dx, ch in enumerate(row):
            if ch == "x":
                img.putpixel((8 + dx, 21 + dy), rgba(INK))
    fish = ["..xxx.x", ".xxxxxx", "xxxxx.x", ".xxx..."]
    for dy, row in enumerate(fish):
        for dx, ch in enumerate(row):
            if ch == "x":
                img.putpixel((34 + dx, 22 + dy), rgba(INK))
    img.putpixel((35, 23), rgba(BOX_FRONT))  # the fish's eye
    # a scratched corner: cats were here
    for (x, y) in ((44, 20), (43, 21), (44, 22), (43, 23), (44, 24)):
        img.putpixel((x, y), rgba(BOX_FRONT_D))
    return img


# ------------------------------------------------------------------ laptop
LAP, LAP_D, LAP_L = (176, 182, 196), (120, 126, 142), (214, 220, 230)
SCREEN_OFF = (40, 36, 52)
SCREEN_ON = (28, 44, 40)
CODE = [(110, 220, 140), (240, 200, 110), (140, 190, 240)]


def laptop(frame=None):
    """Open laptop, screen towards the viewer (the cat sits behind it). frame None = off."""
    img = blank(16, 32)
    s0, s1 = 8, 17          # screen rows
    for y in range(s0, s1 + 1):
        for x in range(3, 13):
            edge = x in (3, 12) or y in (s0, s1)
            img.putpixel((x, y), rgba(LAP_D if edge else (SCREEN_OFF if frame is None else SCREEN_ON)))
    # lid frame highlight
    for x in range(4, 12):
        img.putpixel((x, s0), rgba(LAP_L))
    if frame is None:
        # a faint reflection and the paw logo dimly lit
        img.putpixel((5, 10), rgba((70, 66, 86)))
        img.putpixel((6, 10), rgba((70, 66, 86)))
        img.putpixel((5, 11), rgba((70, 66, 86)))
    else:
        rows = [(10, 4, 0), (12, 6, 1), (14, 3, 2)]
        for i, (y, length, colour) in enumerate(rows):
            start = 5 + ((frame + i) % 2)
            for x in range(start, min(11, start + length)):
                img.putpixel((x, y), rgba(CODE[(colour + frame) % 3]))
        img.putpixel((5 + frame % 3, 15), rgba(CODE[0]))  # cursor
    # base: keyboard deck in perspective
    for y, (x0, x1) in zip(range(18, 22), ((2, 13), (2, 13), (1, 14), (1, 14))):
        for x in range(x0, x1 + 1):
            edge = x in (x0, x1) or y == 21
            img.putpixel((x, y), rgba(LAP_D if edge else (LAP if y < 20 else LAP_L)))
    for x in range(4, 12, 2):  # keys
        img.putpixel((x, 19), rgba(LAP_D))
    return img


# ------------------------------------------------------------- window perch
FRAME, FRAME_D = (236, 230, 216), (184, 174, 156)
SKY, SKY_L = (150, 200, 236), (196, 226, 246)
LEAF, LEAF_D = (110, 170, 90), (76, 128, 66)
BRANCH = (110, 80, 52)
BIRD, BIRD_D = (230, 120, 70), (160, 80, 48)
CUSH, CUSH_L, CUSH_D = (124, 92, 170), (160, 128, 196), (92, 66, 132)


def window_perch():
    img = blank(32, 32)
    x0, x1, y0, y1 = 5, 26, 4, 21
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            edge = x in (x0, x1) or y in (y0, y1)
            mull = x in (15, 16) or y == 12
            if edge or mull:
                c = FRAME_D if (x == x1 or y == y1) else FRAME
            else:
                c = SKY_L if y < 8 else SKY
            img.putpixel((x, y), rgba(c))
    # a cloud, a branch with leaves and a little bird outside
    for (x, y) in ((8, 6), (9, 6), (10, 6), (9, 5), (10, 5), (11, 6)):
        img.putpixel((x, y), rgba((250, 250, 252)))
    for x in range(17, 26):
        img.putpixel((x, 17), rgba(BRANCH))
    for (x, y) in ((24, 15), (25, 16), (23, 16), (19, 18), (21, 16), (25, 18)):
        img.putpixel((x, y), rgba(LEAF if (x + y) % 2 else LEAF_D))
    for (x, y, c) in ((20, 15, BIRD), (21, 15, BIRD), (19, 16, BIRD), (20, 16, BIRD), (21, 16, BIRD_D),
                      (22, 15, (60, 40, 30)), (18, 16, BIRD_D), (21, 14, BIRD)):
        img.putpixel((x, y), rgba(c))
    img.putpixel((21, 14), rgba((40, 30, 30)))  # eye
    # sill and the hammock perch hanging from it
    for x in range(3, 29):
        img.putpixel((x, 22), rgba(FRAME))
        img.putpixel((x, 23), rgba(FRAME_D))
    for y, (a, b) in zip(range(24, 29), ((7, 24), (6, 25), (6, 25), (7, 24), (9, 22))):
        for x in range(a, b + 1):
            edge = x in (a, b) or y == 28
            c = OUTLINE if edge else (CUSH_L if y == 24 else (CUSH if y < 27 else CUSH_D))
            img.putpixel((x, y), rgba(c))
    return img


# ================================================================ full set
def original(name):
    """The catalog (or custom-asset) sprite this piece replaces."""
    stem = name.split("_")
    folders = [name, stem[0], "_".join(stem[:2]), "_".join(stem[:-1])]
    for root in (FURN, CUSTOM):
        for folder in folders:
            p = os.path.join(root, folder, name + ".png")
            if os.path.exists(p):
                return Image.open(p).convert("RGBA")
    raise FileNotFoundError(name)


def bbox(name):
    return original(name).getbbox()  # (x0, y0, x1, y1) exclusive


def put_rows(img, rows, x0, y0, pal):
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch != "." and ch in pal:
                img.putpixel((x0 + dx, y0 + dy), rgba(pal[ch]))


def stamp(img, rows, x0, y0, colour):
    for dy, row in enumerate(rows):
        for dx, ch in enumerate(row):
            if ch == "x":
                img.putpixel((x0 + dx, y0 + dy), rgba(colour))


PAW5 = ["x.x.x", ".....", ".xxx.", "xxxxx", ".xxx."]
FISH7 = ["..xxx.x", ".xxxxxx", "xxxxx.x", ".xxx..."]


def box_in(name, front=6, seam="h"):
    """A cardboard box filling the original's footprint: top face, then `front` rows of side.

    seam 'h' = flaps taped along the length, 'v' = across (tall, narrow boxes).
    """
    w, h = original(name).size
    x0, y0, x1, y1 = bbox(name)
    img = blank(w, h)
    fy = y1 - front  # first front-face row
    for y in range(y0, y1):
        for x in range(x0, x1):
            edge = x in (x0, x1 - 1) or y in (y0, y1 - 1)
            if edge:
                c = BOX_OUT
            elif y < fy - 1:
                c = BOX_TOP if y < fy - 2 else BOX_TOP_D
            elif y == fy - 1:
                c = BOX_OUT
            else:
                c = BOX_FRONT if y < y1 - 2 else BOX_FRONT_D
            img.putpixel((x, y), rgba(c))
    if seam == "h":
        my = (y0 + fy) // 2
        for x in range(x0 + 1, x1 - 1):
            img.putpixel((x, my), rgba(TAPE))
            img.putpixel((x, my + 1), rgba(BOX_TOP_D))
        if fy - y0 >= 20:
            # a big top: the flaps' cross seam, taped too, and a coffee-ring-free dent
            mx = (x0 + x1) // 2
            for y in range(y0 + 1, fy - 1):
                img.putpixel((mx, y), rgba(TAPE))
                img.putpixel((mx + 1, y), rgba(BOX_TOP_D))
            for (dx, dy) in ((6, 6), (7, 6), (6, 7)):
                img.putpixel((x0 + dx, y0 + dy), rgba(BOX_TOP_D))
    else:
        mx = (x0 + x1) // 2
        for y in range(y0 + 1, fy - 1):
            img.putpixel((mx - 1, y), rgba(TAPE))
            img.putpixel((mx, y), rgba(BOX_TOP_D))
    # print on the front when there is room
    if front >= 6 and x1 - x0 >= 24:
        stamp(img, PAW5[:4] + [".xxx."] if front < 7 else PAW5, x0 + 4, fy + 1, INK)
    if front >= 6 and x1 - x0 >= 40:
        stamp(img, FISH7, x1 - 12, fy + 1, INK)
    return img


# cushions -----------------------------------------------------------------
def ellipse_cushion(w, h, cx, cy, rx, ry, light, mid, dark, button=None):
    img = blank(w, h)
    for y in range(h):
        for x in range(w):
            if not inside(x, y, cx, cy, rx, ry):
                continue
            edge = not (inside(x - 1, y, cx, cy, rx, ry) and inside(x + 1, y, cx, cy, rx, ry)
                        and inside(x, y - 1, cx, cy, rx, ry) and inside(x, y + 1, cx, cy, rx, ry))
            if edge:
                c = OUTLINE
            elif y < cy - ry * 0.35:
                c = light
            elif y < cy + ry * 0.35:
                c = mid
            else:
                c = dark
            img.putpixel((x, y), rgba(c))
    if button:
        img.putpixel(button, rgba(dark))
    return img


MUSTARD = ((240, 196, 104), (216, 160, 72), (168, 116, 52))
GREEN_C = ((150, 204, 154), (111, 163, 116), (72, 120, 65))  # the bench's own greens (seat colours shift them)
VELVET = ((206, 72, 84), (164, 44, 60), (112, 26, 40))
GOLD = (236, 196, 80)


def floor_cushion():
    """WOODEN_CHAIR_SIDE: a round floor cushion where the chair's seat was."""
    return ellipse_cushion(16, 32, 7.5, 26.5, 7.2, 4.6, *MUSTARD, button=(8, 26))


def bench_cushion():
    """CUSHIONED_BENCH: a round green cushion (its seat colour still applies)."""
    return ellipse_cushion(16, 16, 7.5, 9.5, 7.2, 5.2, *GREEN_C, button=(8, 9))


def boss_cushion():
    """CUSHIONED_CHAIR_FRONT: the boss's plump velvet cushion with gold tassels."""
    img = blank(16, 16)
    rows = [
        "................",
        "................",
        "................",
        "..oooooooooooo..",
        ".oLLLLLLLLLLLLo.",
        "goLLMMMMMMMMLLog",
        ".oMMMMMMMMMMMMo.",
        ".oMMMMMDMMMMMMo.",
        ".oMMMMMMMMMMMMo.",
        ".oMMMMMMMMMMMMo.",
        "goDDDDDDDDDDDDog",
        ".oDDDDDDDDDDDDo.",
        "..oooooooooooo..",
        "................",
        "................",
        "................",
    ]
    put_rows(img, rows, 0, 0, {"o": OUTLINE, "L": VELVET[0], "M": VELVET[1], "D": VELVET[2], "g": GOLD})
    return img


# sofa → a long bolster bed ---------------------------------------------------
def bolster_bed(w, h, horizontal=True):
    light, mid, dark = (236, 150, 170), (204, 104, 132), (150, 62, 92)  # the sofa's own rose
    img = blank(w, h)
    # Drawn as a short cushioned tub, not a flat oval: the top (rim + cushion)
    # is an ellipse, and below its front edge a wall of `depth` rows gives it
    # height, so an empty bed reads as a soft bed rather than a plate.
    if horizontal:
        cx, cy, rx, ry, depth = (w - 1) / 2, 5.5, w / 2 - 0.2, 5.2, 5
        hrx, hry = rx - 4.2, ry - 2.6
    else:
        cx, cy, rx, ry, depth = (w - 1) / 2, 13.5, w / 2 - 0.2, 12.6, 4
        hrx, hry = rx - 3.4, ry - 3.4
    hx, hy = cx, cy - 0.6

    def top(x, y):
        return inside(x, y, cx, cy, rx, ry)

    def body(x, y):  # the top ellipse swept down by `depth`
        return any(top(x, y - d) for d in range(depth + 1))

    for y in range(h):
        for x in range(w):
            if not body(x, y):
                continue
            edge = not all(body(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                c = OUTLINE
            elif top(x, y):
                if inside(x, y, hx, hy, hrx, hry):
                    c = CREAM_D if y < hy - hry + 2 else CREAM
                elif y < cy:
                    c = light
                else:
                    c = mid  # the rim's front, seen from above
            else:
                # the side wall below the front edge: lit at its top, dark at the floor
                d = min(dd for dd in range(depth + 1) if top(x, y - dd))
                c = mid if d <= 1 else dark
            img.putpixel((x, y), rgba(c))
    # the crease where the rim's top meets its side wall
    for x in range(w):
        for y in range(h - 1):
            if top(x, y) and not top(x, y + 1) and body(x, y + 1) and img.getpixel((x, y))[:3] == mid:
                img.putpixel((x, y + 1), rgba(dark))
    # fleece highlights along the back of the rim
    for x in range(3, w - 3, 5):
        y = next((yy for yy in range(h) if img.getpixel((x, yy))[:3] == light), None)
        if y is not None:
            img.putpixel((x, y), rgba((250, 196, 210)))
    return img


# laptops from the side and the back -------------------------------------------
def closed_laptop():
    """PC_SIDE: a closed laptop lying flat on the box, seen from above (a cat sticker on its lid).

    An open laptop seen side-on was only an L-shaped edge, and the plush fish
    that replaced it hid that there is a computer at the seat.
    """
    img = blank(16, 32)
    rows = [
        ".oooooooooooo...",
        "oLLLLLLLLLLLLo..",
        "oLmmmmmmmmmmLo..",
        "oLmmmkmmkmmmLo..",
        "oLmmmkkkkmmmLo..",
        "oLmmmkmkmkmmLo..",
        "oLmmmkkkkmmmLo..",
        "oLmmmmmmmmmmLo..",
        "oddddddddddddo..",
        "oDDDDDDDDDDgDo..",
        ".oooooooooooo...",
    ]
    put_rows(img, rows, 1, 13, {
        "o": OUTLINE, "L": LAP_L, "m": LAP, "k": (70, 70, 84), "d": LAP_D,
        "D": (96, 100, 116), "g": (120, 220, 140),
    })
    for x in range(2, 14):  # its shadow on the cardboard
        img.putpixel((x, 24), (0, 0, 0, 50))
    return img


def fish_plush():
    """PC_SIDE: a plush fish toy lying on the box where a side laptop stood.

    A side laptop could only ever be an L-shaped edge (and never lit up), so the
    meeting tables get toys instead; the ':left' copies face the other way.
    """
    img = blank(16, 32)
    rows = [
        "......ooooo.....",
        ".oo..oBBBBBo....",
        "oTTooBbBBsBBo...",
        "oTTTBBbBBBBEBo..",
        "oTToBBbBBsBBo...",
        ".oo..oBBBBBo....",
        "......ooooo.....",
    ]
    put_rows(img, rows, 0, 15, {
        "o": OUTLINE, "B": (240, 140, 90), "b": (196, 96, 64), "T": (250, 204, 110),
        "E": (30, 24, 28), "s": (252, 210, 180),
    })
    for x in range(2, 12):  # its soft shadow on the cardboard
        if img.getpixel((x, 22))[3] == 0:
            img.putpixel((x, 22), (0, 0, 0, 50))
    return img


def laptop_back():
    """PC_BACK: the laptop's lid from behind, a cat sticker on it."""
    img = blank(16, 32)
    for y in range(8, 18):
        for x in range(3, 13):
            edge = x in (3, 12) or y in (8, 17)
            img.putpixel((x, y), rgba(LAP_D if edge else LAP))
    sticker = ["x..x", "xxxx", "x.x.", "xxxx"]  # a cat head
    stamp(img, sticker, 6, 10, (60, 60, 70))
    img.putpixel((7, 12), rgba(LAP))
    for x in range(2, 14):
        img.putpixel((x, 18), rgba(LAP_D))
        img.putpixel((x, 19), rgba(LAP_L))
    return img


def treat_dish():
    """COFFEE: a little dish of fish treats on the box."""
    img = blank(16, 16)
    rows = [
        "........oooooo..",
        ".......oYyYyYyo.",
        ".......oRRRRRRo.",
        "........oRRRRo..",
        ".........oooo...",
    ]
    put_rows(img, rows, 0, 1, {"o": OUTLINE, "Y": (236, 170, 90), "y": (196, 120, 60), "R": (214, 96, 96)})
    return img


# wall pieces ----------------------------------------------------------------
WOOD, WOOD_D, WOOD_L = (176, 122, 72), (128, 84, 48), (206, 156, 100)


def plank(img, x0, x1, y):
    for x in range(x0, x1 + 1):
        img.putpixel((x, y), rgba(WOOD_L))
        img.putpixel((x, y + 1), rgba(WOOD))
        img.putpixel((x, y + 2), rgba(WOOD_D))
    for (bx, by) in ((x0 + 1, y + 3), (x1 - 1, y + 3)):  # brackets
        img.putpixel((bx, by), rgba(WOOD_D))


def cat_shelves():
    """DOUBLE_BOOKSHELF: a cat climbing wall -- three staggered planks like stairs,
    a box with ears peeking out on the top one, a cushion in the middle, a rope
    toy hanging under the lowest."""
    img = blank(32, 32)
    plank(img, 1, 14, 9)      # top, left
    plank(img, 16, 30, 17)    # middle, right
    plank(img, 2, 15, 25)     # bottom, left
    # top plank: a little box, a cat's ears and eyes peeking over its rim
    fur, fur_d = (232, 150, 74), (192, 106, 42)       # a ginger head over the rim
    head = ["a....a", "aa..aa", "abbbba", "bebbeb", "bbbbbb"]
    put_rows(img, head, 4, 0, {"a": fur_d, "b": fur, "e": (40, 36, 44)})
    for y in range(5, 9):
        for x in range(3, 11):
            edge = x in (3, 10) or y in (5, 8)
            img.putpixel((x, y), rgba(BOX_OUT if edge else BOX_FRONT))
    # middle plank: a cushion with a yarn ball on it
    for x in range(18, 29):
        img.putpixel((x, 16), rgba(CUSH_D))
        img.putpixel((x, 15), rgba(CUSH))
        if 19 <= x <= 27:
            img.putpixel((x, 14), rgba(CUSH_L))
    rows = [".oo.", "oAao", ".oo."]
    put_rows(img, rows, 24, 11, {"o": OUTLINE, "A": (220, 70, 80), "a": (250, 140, 140)})
    # bottom plank: a rope toy dangling below it, a feather at its end
    for y in range(29, 32):
        img.putpixel((12, y), rgba((200, 170, 110)))
    img.putpixel((11, 31), rgba((110, 200, 190)))
    img.putpixel((13, 31), rgba((110, 200, 190)))
    # a paw print on the wall between the planks
    for (x, y) in ((22, 22), (24, 21), (26, 22), (23, 24), (24, 24), (25, 24), (24, 25)):
        img.putpixel((x, y), rgba(BOX_OUT))
    return img


def cubby_shelf():
    """BOOKSHELF (32x16): a wooden cat house on the wall -- two round doorways,
    a cat's eyes shining in the left one, a ginger tail hanging out of the right."""
    img = blank(32, 16)
    x0, x1, y0, y1 = 1, 30, 3, 15
    hole = (34, 24, 28)
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            edge = x in (x0, x1) or y in (y0, y1)
            img.putpixel((x, y), rgba(WOOD_D if edge else (WOOD_L if y == y0 + 1 else WOOD)))
    # a pitched roof edge along the top
    for x in range(x0 + 1, x1):
        img.putpixel((x, y0 - 1), rgba(WOOD_D))
    # the two doorways: round-topped holes
    for cx in (8, 23):
        for y in range(5, y1):
            for x in range(cx - 5, cx + 5):
                dx, dy = x + 0.5 - cx, y + 0.5 - 10
                if dy < 0 and dx * dx + dy * dy > 25:
                    continue
                if dy >= 0 and abs(dx) > 5:
                    continue
                inner = abs(dx) < 4 and (dy >= 0 or dx * dx + dy * dy <= 16)
                img.putpixel((x, y), rgba(hole if inner else WOOD_D))
    # eyes in the left doorway
    for x in (6, 9):
        img.putpixel((x, 11), rgba((250, 210, 70)))
    img.putpixel((6, 12), rgba((90, 160, 60)))
    img.putpixel((9, 12), rgba((90, 160, 60)))
    # a ginger tail hanging out of the right doorway, over the sill
    tail, tail_d = (232, 150, 74), (192, 106, 42)
    for (x, y) in ((24, 13), (25, 13), (25, 14), (26, 14), (26, 15)):
        img.putpixel((x, y), rgba(tail))
    for (x, y) in ((24, 14), (25, 15)):
        img.putpixel((x, y), rgba(tail_d))
    # a paw-print plaque between the doors
    for (x, y) in ((13, 7), (15, 6), (17, 7), (14, 9), (15, 9), (16, 9), (14, 10), (15, 10), (16, 10)):
        img.putpixel((x, y), rgba(BOX_OUT))
    return img


def cat_clock():
    """CLOCK: a round clock with cat ears and whisker marks."""
    img = blank(16, 32)
    x0, y0 = bbox("CLOCK")[:2]
    face = ellipse_cushion(16, 32, 7.5, y0 + 6.5, 5.4, 5.4, (250, 248, 240), (250, 248, 240), (226, 222, 210))
    img.alpha_composite(face)
    cy = y0 + 6
    for (x, y) in ((3, cy - 5), (4, cy - 6), (4, cy - 5), (11, cy - 5), (11, cy - 6), (12, cy - 5)):
        img.putpixel((x, y), rgba((60, 60, 70)))
    for (x, y) in ((8, cy - 2), (8, cy - 1), (8, cy), (9, cy), (10, cy)):  # hands
        img.putpixel((x, y), rgba((50, 44, 52)))
    for (x, y) in ((4, cy + 2), (12, cy + 2)):
        img.putpixel((x, y), rgba((232, 140, 160)))  # pink cheeks
    return img


# custom bedroom pieces --------------------------------------------------------
def box_cube():
    """PA_NIGHTSTAND_LAMP: a small box beside each bed, a toy mouse on it."""
    img = box_in("PA_NIGHTSTAND_LAMP", front=6, seam="v")
    x0, y0, x1, _ = bbox("PA_NIGHTSTAND_LAMP")
    # the lamp's shade made the bbox tall: crop the box to the lower part instead
    img = blank(16, 32)
    top = 18
    for y in range(top, 32):
        for x in range(2, 14):
            edge = x in (2, 13) or y in (top, 31)
            fy = 25
            c = BOX_OUT if edge or y == fy else (BOX_TOP if y < fy else BOX_FRONT)
            img.putpixel((x, y), rgba(c))
    for y in range(top + 1, 25):
        img.putpixel((7, y), rgba(TAPE))
    mouse = ["..oo..", ".oGGo.", "oGGGGo", ".oooo."]
    put_rows(img, mouse, 6, top - 3, {"o": OUTLINE, "G": (170, 170, 180)})
    img.putpixel((12, top - 1), rgba((232, 140, 160)))  # tail end
    img.putpixel((11, top - 1), rgba((232, 140, 160)))
    return img


def sisal_pole():
    """PA_FLOOR_LAMP: a tall sisal pole with a feather toy dangling from its top."""
    img = blank(16, 32)
    for y in range(2, 30):
        for x in range(6, 10):
            edge = x in (6, 9)
            c = (120, 92, 60) if edge else ((214, 186, 140) if y % 3 else (168, 138, 96))
            img.putpixel((x, y), rgba(c))
    for y in range(29, 32):
        for x in range(3, 13):
            edge = x in (3, 12) or y == 31
            img.putpixel((x, y), rgba(OUTLINE if edge else CUSH))
    for x in range(5, 11):
        img.putpixel((x, 2), rgba(CUSH_L))
    for y in range(3, 10):
        img.putpixel((11, y), rgba(OUTLINE))
    feather = [(11, 10), (12, 11), (11, 11), (12, 12), (13, 13), (12, 13)]
    for (x, y) in feather:
        img.putpixel((x, y), rgba((80, 170, 200)))
    return img


def cat_condo_cabinet():
    """PA_WARDROBE: a wooden cat condo, two round doorways, a paw poking out of one."""
    img = blank(32, 32)
    x0, x1, y0, y1 = 1, 30, 2, 31
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            edge = x in (x0, x1) or y in (y0, y1)
            c = OUTLINE if edge else (WOOD_L if y < y0 + 3 else (WOOD if (x // 4) % 2 else WOOD_D if y > y1 - 2 else WOOD))
            img.putpixel((x, y), rgba(c))
    for y in range(y0 + 1, y1):
        img.putpixel((15, y), rgba(WOOD_D))
        img.putpixel((16, y), rgba(WOOD_D))
    for (hx, hy) in ((8, 14), (23, 22)):
        for y in range(hy - 4, hy + 5):
            for x in range(hx - 4, hx + 5):
                if (x - hx) ** 2 + (y - hy) ** 2 <= 14:
                    img.putpixel((x, y), rgba((40, 30, 34)))
    # a ginger paw reaching out of the lower doorway
    for (x, y) in ((22, 25), (23, 25), (24, 25), (22, 26), (23, 26), (24, 26)):
        img.putpixel((x, y), rgba((226, 140, 66)))
    for (x, y) in ((22, 27), (24, 27)):
        img.putpixel((x, y), rgba((246, 236, 214)))
    return img


def full_set():
    pieces = {
        "DESK_FRONT": cardboard_box(),
        "DESK_SIDE": box_in("DESK_SIDE", front=5, seam="v"),
        "SMALL_TABLE_FRONT": box_in("SMALL_TABLE_FRONT", front=6),
        "SMALL_TABLE_SIDE": box_in("SMALL_TABLE_SIDE", front=5, seam="v"),
        "TABLE_FRONT": box_in("TABLE_FRONT", front=7),
        "COFFEE_TABLE": box_in("COFFEE_TABLE", front=6),
        "PC_FRONT_OFF": laptop(None),
        "PC_FRONT_ON_1": laptop(0),
        "PC_FRONT_ON_2": laptop(1),
        "PC_FRONT_ON_3": laptop(2),
        "PC_SIDE": closed_laptop(),
        "PC_BACK": laptop_back(),
        "COFFEE": treat_dish(),
        "WHITEBOARD": window_perch(),
        "WOODEN_CHAIR_SIDE": floor_cushion(),
        "CUSHIONED_BENCH": bench_cushion(),
        "CUSHIONED_CHAIR_FRONT": boss_cushion(),
        "SOFA_FRONT": bolster_bed(32, 16),
        "SOFA_BACK": bolster_bed(32, 16),
        "SOFA_SIDE": bolster_bed(16, 32, horizontal=False),
        "DOUBLE_BOOKSHELF": cat_shelves(),
        "BOOKSHELF": cubby_shelf(),
        "CLOCK": cat_clock(),
        "PA_NIGHTSTAND_LAMP": box_cube(),
        "PA_FLOOR_LAMP": sisal_pole(),
        "PA_WARDROBE": cat_condo_cabinet(),
    }
    for colour in BED_COLOURS:
        bed = donut(colour)
        pieces[f"PA_BED_{colour}"] = bed
        pieces[f"PA_BEDCOVER_{colour}"] = donut_cover(bed)
    for name, img in pieces.items():
        assert img.size == original(name).size, (name, img.size, original(name).size)
    return pieces


def sheet(pieces, scale=5):
    """Before/after strip of every piece."""
    pairs = [(original(n), p) for n, p in pieces.items()]
    W = sum((a.width + b.width) * scale + 30 for a, b in pairs)
    H = 64 * scale
    out = Image.new("RGBA", (W, H), (40, 40, 52, 255))
    x = 0
    for a, b in pairs:
        for im in (a, b):
            big = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
            out.alpha_composite(big, (x, H - big.height))
            x += big.width + 6
        x += 18
    return out


# ------------------------------------------------------------------ mock scene
def cat_frame(coat, row, col, shut=False):
    sheet = Image.open(os.path.join(CATS, f"{coat}{'.blink' if shut else ''}.png")).convert("RGBA")
    return sheet.crop((col * 32, row * 32, col * 32 + 32, row * 32 + 32))


def mock(pieces):
    T = 16
    cols, rows = 12, 7
    scene = Image.new("RGBA", (cols * T, rows * T), (0, 0, 0, 255))
    floor = (150, 104, 66)
    floor_d = (132, 90, 56)
    wall, wall_d = (58, 66, 92), (40, 46, 66)
    for y in range(rows * T):
        for x in range(cols * T):
            if y < 2 * T:
                c = wall if y < 2 * T - 3 else wall_d
            else:
                c = floor if ((x // 16 + y // 16) % 2 == 0) or (y % 16) else floor_d
                if (y % 16) == 0:
                    c = floor_d
            scene.putpixel((x, y), rgba(c))

    def put(img, col, row, dx=0, dy=0):
        scene.alpha_composite(img, (col * T + dx, row * T + dy))

    def seated(img, col, row):
        """A seated character as the office draws it: bottom at the seat tile's top + 8 + 6."""
        put(img, col, row, dx=-8, dy=14 - 32)

    def standing(img, col, row):
        put(img, col, row, dx=-8, dy=8 - 32)

    # window on the wall (wall items sit with their bottom row on the wall tile)
    put(pieces["WHITEBOARD"], 4, 0)
    # box desk at row 2 with a lit laptop, a cat working behind it (seat below, facing up)
    put(pieces["DESK_FRONT"], 1, 2)
    put(pieces["PC_FRONT_ON_1"], 2, 2)
    seated(cat_frame("ginger", 1, 7), 2, 4)  # up row, seated frame
    # beds: a sleeper in the blue donut, an empty rose one
    put(pieces["PA_BED_BLUE"], 7, 3)
    seated(cat_frame("grey", 0, 7, shut=True), 7, 4)
    put(pieces["PA_BEDCOVER_BLUE"], 7, 4)
    put(pieces["PA_BED_ROSE"], 9, 3)
    put(pieces["PA_BEDCOVER_ROSE"], 9, 4)
    # a cat looking out of the window from the floor
    standing(cat_frame("tuxedo", 1, 0), 5, 3)
    return scene.resize((scene.width * 6, scene.height * 6), Image.NEAREST)


def main():
    os.makedirs(OUT, exist_ok=True)
    pieces = full_set()
    for name, img in pieces.items():
        img.save(os.path.join(OUT, name + ".png"))
    if len(sys.argv) > 3:  # previews go elsewhere (never into the fork's art folder)
        prev = sys.argv[3]
        os.makedirs(prev, exist_ok=True)
        mock(pieces).save(os.path.join(prev, "mock.png"))
        sheet(pieces).save(os.path.join(prev, "sheet.png"))
    print("wrote", len(pieces), "sprites")


if __name__ == "__main__":
    main()
