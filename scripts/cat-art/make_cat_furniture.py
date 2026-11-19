"""Cat theme furniture for Pixel Agents (fork office-tweaks).

Each output PNG redraws one catalog furniture type and must be the catalog
sprite's exact size (the office ignores a theme sprite of another size).
Paintings keep their frame and get cat pictures; the rest are drawn here.

Usage:
    python make_cat_furniture.py <fork root> [preview.png]

Writes <fork>/webview-ui/src/office/themes/cat/<TYPE>.png.
"""
import os
import sys

from PIL import Image

FORK = sys.argv[1]
SRC = os.path.join(FORK, "webview-ui", "public", "assets", "furniture")
OUT = os.path.join(FORK, "webview-ui", "src", "office", "themes", "cat")

# ---------------------------------------------------------------- palette
P = {
    ".": None,
    "o": (35, 13, 15),        # outline (the pot's)
    "K": (44, 34, 40),        # painting dark background
    "k": (66, 52, 54),        # painting background, lighter
    "O": (226, 140, 66),      # ginger
    "D": (168, 88, 44),       # ginger shade
    "W": (242, 232, 214),     # white fur
    "w": (196, 184, 170),     # white fur shade
    "G": (128, 128, 138),     # grey fur
    "g": (88, 88, 100),       # grey shade
    "B": (44, 40, 52),        # black fur
    "E": (150, 210, 90),      # eye green
    "N": (232, 140, 160),     # nose pink
    "U": (64, 92, 168),       # blue (scarf, garment)
    "u": (40, 60, 120),       # blue shade
    "Y": (228, 190, 80),      # yellow / gold
    "y": (176, 138, 52),      # yellow shade
    "P": (250, 250, 240),     # pearl
    "S": (150, 196, 226),     # sky
    "s": (186, 218, 238),     # sky light
    "F": (104, 156, 84),      # field
    "f": (78, 124, 64),       # field shade
    "R": (204, 72, 72),       # red (bowl, yarn)
    "r": (150, 48, 52),       # red shade
    "Q": (238, 120, 120),     # red light
    "C": (120, 84, 50),       # kibble
    "c": (86, 58, 36),        # kibble dark
    "V": (124, 92, 170),      # purple carpet
    "v": (92, 66, 132),       # purple shade
    "L": (160, 128, 196),     # purple light
    "T": (214, 186, 140),     # sisal rope
    "t": (168, 138, 96),      # sisal shade
    "M": (244, 150, 190),     # pom-pom pink
    "A": (80, 140, 210),      # yarn blue
    "a": (52, 98, 160),       # yarn blue shade
}


def grid_image(rows, w, h, top=0):
    """Letter rows → RGBA image of w x h, rows starting at `top`."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    for y, row in enumerate(rows):
        assert len(row) == w, (len(row), w, row)
        for x, ch in enumerate(row):
            col = P[ch]
            if col:
                img.putpixel((x, top + y), col + (255,))
    return img


def paint_into(src_name, rows, x0, y0):
    """The catalog painting with its picture (rows) drawn inside the mat."""
    img = Image.open(os.path.join(SRC, src_name, src_name + ".png")).convert("RGBA")
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            col = P[ch]
            if col:
                img.putpixel((x0 + x, y0 + y), col + (255,))
    return img


# ------------------------------------------------------------ paintings
# Small paintings: picture area cols 5-10, rows 15-23 (6 x 9).
MONA_CAT = [  # ginger cat portrait, dark blue sitter's dress
    "KOKKOK",
    "KOOOOK",
    "KEOOEK",
    "KOWWOK",
    "KDWNDK",
    "KuDDuK",
    "uUUUUu",
    "UUOOUU",
    "uUUUUu",
]
PEARL_CAT = [  # grey cat in a blue headscarf with a pearl earring
    "KKUUUK",
    "KUUUuK",
    "KYUUuK",
    "KEGGgK",
    "KGWGPK",
    "KNWGgK",
    "KKGgKK",
    "KYYYyK",
    "YYyYYy",
]

# Large painting: picture area cols 5-26, rows 15-23 (22 x 9).
# Three cats (ginger, black, white) on a sunny hill.
LANDSCAPE = [
    "ssssssssssssssssYYssss",
    "sSSSSSsssSSSSSSsYYSSSs",
    "SSSSSSSSSSSSSSSSSSSSSS",
    "SSSOSOSSSSBSBSSSSWSWSS",
    "FFFOOOFFFFBBBFFFFWWWFF",
    "FFFOEOFFFFBEBFFFFWEWFF",
    "FfOOOOOFfFBBBBfFfWWWWf",
    "ffOOOODfffBBBBBffwWWWw",
    "fffffDfffffffBfffffwff",
]


# ------------------------------------------------------------ floor items
# BIN (16x16) → a red food bowl heaped with kibble, a fish on its side.
FOOD_BOWL = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    ".....oooooo.....",
    "...ooCcCCcCoo...",
    "..oCCcCCcCCcCo..",
    "..oRCcCCcCCcRo..",
    "..oQRRRRRRRRQo..",
    "..oRRWWWRWRRRo..",
    "...oWWWWWRRRo...",
    "...orWWWrWrro...",
    "....oooooooo....",
    "................",
]

# POT (16x16) → the pot as a basket of yarn: two balls above the rim.
YARN_BALLS = [  # rows 0-7 over the pot's top
    "................",
    "...oooo.........",
    "..oRQRRo.oooo...",
    ".oRRrQRooAAAAo..",
    ".oQRRrRoAaAAaAo.",
    ".oRrRRoAAAaAAAo.",
    "..ooroAaAAAaAAo.",
    "....oroooooooo..",
]

# PLANT_2 (16x32) → a cat tree: cushion top, sisal post, a toy, carpet base.
CAT_TREE = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "...oooooooooo...",
    "..oLLLLLLLLLLo..",
    ".oLVVVVVVVVVVLo.",
    ".oVVVVVVVVVVVVo.",
    ".ovVVVVVVVVVVvo.",
    "..ovvvvvvvvvvo..",
    "...ooooTToooo...",
    "......otto..o...",
    "......oTTo..o...",
    "......oTTo..o...",
    "......otto..o...",
    "......oTTo.oMo..",
    "......oTTo.MMMo.",
    "......otto.oMo..",
    "......oTTo..o...",
    "......oTTo......",
    "......otto......",
    "......oTTo......",
    "......oTTo......",
    "......otto......",
    "......oTTo......",
    "...oooottoooo...",
    "..oLLLLLLLLLLo..",
    ".oLVVVVVVVVVVLo.",
    ".ovVVVVVVVVVVvo.",
    "..oovvvvvvvvoo..",
    "....oooooooo....",
]


def yarn_basket():
    img = Image.open(os.path.join(SRC, "POT", "POT.png")).convert("RGBA")
    balls = grid_image(YARN_BALLS, 16, 16)
    img.alpha_composite(balls)
    return img


# ------------------------------------------------------------ round 2
# The beds are the custom bed assets (~/.pixel-agents/custom-assets).
CUSTOM = os.path.join(
    os.path.expanduser("~"), ".pixel-agents", "custom-assets", "assets", "furniture"
)


def src_path(name):
    # a rotation group keeps its members in one folder (SOFA/SOFA_FRONT.png)
    folders = (name, name.split("_")[0])
    for root in (SRC, CUSTOM):
        for folder in folders:
            p = os.path.join(root, folder, name + ".png")
            if os.path.exists(p):
                return p
    raise FileNotFoundError(name)


def load(name):
    return Image.open(src_path(name)).convert("RGBA")


PAW = [(0, 0), (2, 0), (0, 1), (1, 1), (2, 1), (1, 2)]  # toes on top, pad below
"""A 3x3 paw print: two toes, a wide pad, its point."""


def stamp_paw(img, x, y, colour):
    for dx, dy in PAW:
        img.putpixel((x + dx, y + dy), colour)


def cat_bed(colour):
    """PA_BED_<colour>: a cat-head headboard (ears, eyes, nose) and paw prints on the blanket."""
    img = load(f"PA_BED_{colour}")
    out_ = img.getpixel((0, 1))      # dark outline
    wood = img.getpixel((1, 1))      # headboard light
    wood2 = img.getpixel((1, 2))     # headboard mid
    clear = (0, 0, 0, 0)
    # ears: rows 0-1 become two pointed ears over a dipped top
    top = [
        "aa............aa",
        "abba........abba",
        "abbbaaaaaaaaabba",
    ]
    pal = {"a": out_, "b": wood, ".": clear}
    for y, row in enumerate(top):
        for x, ch in enumerate(row):
            img.putpixel((x, y), pal[ch])
    img.putpixel((15, 2), out_)
    for x in range(1, 15):  # row 3 back to the mid tone under the new top
        if img.getpixel((x, 3)) != out_:
            img.putpixel((x, 3), wood2)
    # face: eyes and a pink nose on the headboard
    for x in (5, 10):
        img.putpixel((x, 3), out_)
    img.putpixel((7, 4), P["N"] + (255,))
    img.putpixel((8, 4), P["N"] + (255,))
    # blanket: plain, with paw prints in the light blanket colour
    light = img.getpixel((1, 16))
    mid = img.getpixel((2, 17))
    for y in (19, 22, 25):
        for x in range(2, 14):
            img.putpixel((x, y), mid)
    stamp_paw(img, 3, 18, light)
    stamp_paw(img, 9, 21, light)
    stamp_paw(img, 4, 24, light)
    return img


def cat_bedcover(colour):
    """PA_BEDCOVER_<colour>: the blanket's paw prints, where the cover sits over a sleeper."""
    img = load(f"PA_BEDCOVER_{colour}")
    light = img.getpixel((1, 7))
    mid = img.getpixel((2, 7))
    for x in range(2, 14):
        img.putpixel((x, 9), mid)
    stamp_paw(img, 3, 8, light)
    stamp_paw(img, 10, 9, light)
    return img


def cat_mug():
    """COFFEE: the mug with cat ears on its rim and two eyes."""
    img = load("COFFEE")
    dark = img.getpixel((8, 3))
    img.putpixel((12, 0), (0, 0, 0, 0))
    img.putpixel((13, 0), (0, 0, 0, 0))
    for x in (12, 14):
        img.putpixel((x, 4), dark)
    return img


GRASS_HI = (150, 214, 96, 255)
GRASS = (104, 172, 78, 255)
GRASS_LO = (66, 124, 60, 255)


def cat_grass():
    """PLANT: the same pot, with a tuft of short cat grass instead of the bush."""
    img = load("PLANT")
    for y in range(0, 20):  # clear the bush above the pot rim
        for x in range(16):
            img.putpixel((x, y), (0, 0, 0, 0))
    heights = [5, 8, 6, 10, 7, 9, 11, 8, 10, 6, 9, 5]  # blade lengths, cols 2-13
    for i, h in enumerate(heights):
        x = 2 + i
        lean = 1 if i % 3 == 0 and x < 13 else 0
        for k in range(h):
            y = 20 - k
            colour = GRASS_HI if k >= h - 2 else (GRASS if (i + k) % 3 else GRASS_LO)
            xx = x + (lean if k > h // 2 else 0)
            img.putpixel((xx, y), colour)
    # keep the pot rim drawn over the grass roots
    rim = load("PLANT")
    for y in range(20, 32):
        for x in range(16):
            p = rim.getpixel((x, y))
            if p[3] > 0:
                img.putpixel((x, y), p)
    return img


def cat_tower():
    """LARGE_PLANT (32x48): a cat tower -- a box house on top, a mid shelf, sisal posts, carpet base."""
    img = Image.new("RGBA", (32, 48), (0, 0, 0, 0))
    o = P["o"] + (255,)

    def box(x0, y0, x1, y1, fill, top=None, shade=None):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                edge = x in (x0, x1) or y in (y0, y1)
                c = o if edge else fill
                if not edge and top and y == y0 + 1:
                    c = top
                if not edge and shade and y == y1 - 1:
                    c = shade
                img.putpixel((x, y), c)

    V, Vl, Vs = P["V"] + (255,), P["L"] + (255,), P["v"] + (255,)
    T, t = P["T"] + (255,), P["t"] + (255,)
    # posts (drawn first, the platforms overlap them)
    for (x0, y0, y1) in ((6, 20, 42), (22, 30, 42)):
        box(x0, y0, x0 + 3, y1, T)
        for y in range(y0 + 2, y1, 2):
            img.putpixel((x0 + 1, y), t)
            img.putpixel((x0 + 2, y), t)
    # base carpet
    box(1, 41, 30, 46, V, top=Vl, shade=Vs)
    # mid shelf (right)
    box(15, 27, 30, 31, V, top=Vl, shade=Vs)
    # box house (left top) with a round door
    box(1, 8, 16, 21, V, top=Vl, shade=Vs)
    for y in range(12, 19):
        for x in range(5, 12):
            dx, dy = x - 8, y - 16
            if dx * dx + dy * dy <= 10 and y <= 18:
                img.putpixel((x, y), (40, 30, 52, 255))
    # roof cushion
    box(0, 5, 17, 9, V, top=Vl, shade=Vs)
    # dangling pom-pom from the shelf
    for y in range(32, 36):
        img.putpixel((27, y), o)
    for (x, y) in ((27, 36), (26, 37), (27, 37), (28, 37), (27, 38)):
        img.putpixel((x, y), P["M"] + (255,))
    return img


# ------------------------------------------------------------ round 3
# HANGING_PLANT (16x32, on the wall) → a hanging basket bed, a ginger tail hanging out.
HANGING_BASKET = [
    "................",
    ".......oo.......",
    ".......oo.......",
    "......o..o......",
    "......o..o......",
    ".....o....o.....",
    ".....o....o.....",
    "....o......o....",
    "....o......o....",
    "...o........o...",
    "...o........o...",
    "..oooooooooooo..",
    ".oLLLLLLLLLLLLo.",
    ".oVVVVVVVVVVVVo.",
    ".otTtTtTtTtTtTo.",
    ".oTtTtTtTtTtTto.",
    ".otTtTtTtTtTtTo.",
    "..oTtTtTtTtTto..",
    "...ootTtTtTto...",
    ".....oooooOo....",
    "..........oOo...",
    "..........oDo...",
    "..........oOo...",
    "..........oOo...",
    "..........oDo...",
    "..........oOo...",
    "...........oo...",
    "................",
    "................",
    "................",
    "................",
    "................",
]


def cactus_post():
    """CACTUS: the same cactus as a sisal scratching post, a pink flower on top."""
    img = load("CACTUS")
    remap = {
        (79, 113, 71): (168, 138, 96),     # a: rope shade
        (137, 160, 87): (214, 186, 140),   # b: rope
        (183, 192, 103): (236, 214, 170),  # c: rope light
        (54, 76, 81): (120, 92, 60),       # d: rope dark edge
    }
    for y in range(img.height):
        for x in range(img.width):
            p = img.getpixel((x, y))
            if p[3] and p[:3] in remap:
                # wound rope: every third row a darker turn
                c = remap[p[:3]] if y % 3 else (150, 120, 80)
                img.putpixel((x, y), c + (255,))
    pink = P["M"] + (255,)
    for (x, y) in ((7, 1), (8, 1), (7, 2), (8, 2)):
        img.putpixel((x, y), pink)
    return img


def paw_sofa(name, rows, cols):
    """SOFA_*: the sofa with paw prints in its light fabric over the dark cushion."""
    img = load(name)
    light = (230, 140, 160, 255)
    for y in rows:
        for x in cols:
            stamp_paw(img, x, y, light)
    return img


def cat_cushion():
    """CUSHIONED_BENCH: a cat-head cushion -- ears on top, eyes and a nose (seat colours still apply)."""
    img = load("CUSHIONED_BENCH")
    edge = img.getpixel((4, 4))    # dark cushion outline
    fill = img.getpixel((5, 5))    # cushion colour
    dark = img.getpixel((4, 12))   # deepest shade
    # two pointed ears opening into the head
    for (x, y) in ((3, 2), (12, 2), (3, 3), (5, 3), (10, 3), (12, 3), (3, 4), (12, 4)):
        img.putpixel((x, y), edge)
    for (x, y) in ((4, 3), (11, 3), (4, 4), (5, 4), (10, 4), (11, 4)):
        img.putpixel((x, y), fill)
    for x in (5, 10):
        img.putpixel((x, 7), dark)
    img.putpixel((7, 8), P["N"] + (255,))
    img.putpixel((8, 8), P["N"] + (255,))
    return img


def check_size(name, img):
    ref = Image.open(src_path(name))
    assert ref.size == img.size, (name, ref.size, img.size)


def main():
    os.makedirs(OUT, exist_ok=True)
    art = {
        "SMALL_PAINTING": paint_into("SMALL_PAINTING", MONA_CAT, 5, 15),
        "SMALL_PAINTING_2": paint_into("SMALL_PAINTING_2", PEARL_CAT, 5, 15),
        "LARGE_PAINTING": paint_into("LARGE_PAINTING", LANDSCAPE, 5, 15),
        "BIN": grid_image(FOOD_BOWL, 16, 16),
        "POT": yarn_basket(),
        "PLANT_2": grid_image(CAT_TREE, 16, 32),
        # round 2 (the beds, mug, sofa and bench are now drawn by make_cat_room_samples.py)
        "PLANT": cat_grass(),
        "LARGE_PLANT": cat_tower(),
        # round 3
        "HANGING_PLANT": grid_image(HANGING_BASKET, 16, 32),
        "CACTUS": cactus_post(),
    }
    for name, img in art.items():
        check_size(name, img)
        img.save(os.path.join(OUT, name + ".png"))
        print("wrote", name, img.size)

    if len(sys.argv) > 2:  # before/after preview, x8
        scale, pad = 8, 12
        pairs = []
        for name, img in art.items():
            ref = load(name)
            pairs.append((ref, img))
        W = sum((a.width + b.width) * scale + 3 * pad for a, b in pairs)
        H = 48 * scale
        sheet = Image.new("RGBA", (W, H), (40, 40, 52, 255))
        x = 0
        for a, b in pairs:
            for im in (a, b):
                big = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
                sheet.alpha_composite(big, (x, H - big.height))
                x += big.width + pad
            x += pad
        sheet.save(sys.argv[2])


if __name__ == "__main__":
    main()
