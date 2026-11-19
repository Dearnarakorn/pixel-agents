"""Cat Mode sheets built from the office pet cat's own pixel art (gitcat).

The pet sheet (webview-ui/public/assets/pets/gitcat/pet.png, 96x96) has a
front and a back walk (3 frames, 16x32), a front and a back sitting idle with
a swishing tail (3 frames), and a side walk (3 frames, 32x32). Each coat here
is that cat recoloured (its five colours: outline, fur, dark fur, light
ear/cheek, nose) with its eyes given a colour, laid out as a Cat Mode sheet:
3 direction rows (down, up, right) x 10 frames (walk1-3, type1-2, read1-2,
seated, sleep1-2), every frame 32x32.

  walk      the pet's walk
  type      the pet's sitting idle, tail swishing (frames 0, 1)
  read      the sitting idle with a sheet of paper at its paws
  seated    the sitting idle, frame 0
  sleep     curled up side-on, eyes shut, breathing (drawn here, SLEEP_HEAD);
            the same in every direction row
  side, not walking: the pet has no side sitting pose, so a side walk frame
            stands in

    python make_pet_cat_sheets.py [--preview out.png] [--only a,b] [--scale N]

Writes webview-ui/src/characters/cats/<coat>.png and <coat>.blink.png in
this repo (the sheets the Cat theme uses). Needs Pillow.
"""
import os
import sys

from PIL import Image

FORK = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
PET = os.path.join(FORK, "webview-ui", "public", "assets", "pets", "gitcat", "pet.png")
OUT = os.path.join(FORK, "webview-ui", "src", "characters", "cats")
CELL, FRAMES = 32, 10   # walk1-3, type1-2, read1-2, seated, sleep1-2
SIT_LIFT = 3          # sitting frames ride this much higher, so the cat sits on the chair seat

# The pet's colours by role.
OUTLINE, FUR, DARK, LIGHT, NOSE = (18, 14, 20), (62, 54, 54), (34, 30, 30), (194, 177, 169), (202, 113, 159)


def rgba(s):
    s = s.lstrip("#")
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4)) + (255,)


# outline, fur, dark fur, light (inner ear), nose, eye
COATS = {
    "ginger":  ["#5a2c12", "#e8954a", "#c06a2a", "#ffd2b0", "#f08aa0", "#7fd04a"],
    "tuxedo":  ["#121216", "#3e3640", "#221e24", "#e6dcd6", "#ca719f", "#a2e35c"],
    "grey":    ["#34363f", "#a3a8b4", "#7d8290", "#f2c6cc", "#e88aa0", "#f2c434"],
    "calico":  ["#4a3a2c", "#f4ece0", "#e0925a", "#f6c2c8", "#e88aa0", "#e8a830"],
    "blue":    ["#2c3444", "#8a98b0", "#6a7890", "#e8c0c8", "#e08aa0", "#f0b030"],
    "siamese": ["#3e2e22", "#eadcc0", "#6a5040", "#f2c8c8", "#d07a8a", "#4aa8f0"],
    "tabby":   ["#36281a", "#a8895e", "#6e5434", "#f0c8b8", "#e08a98", "#9ad04a"],
    "snow":    ["#6a625c", "#fbf9f6", "#ddd7d0", "#f8c4cc", "#f08aa0", "#58b6f0"],
}
PAPER, INK = rgba("#fbfaf6"), rgba("#9aa3b5")


# The pet has no side sitting pose; this one is drawn in its own colours and
# style (a outline, b fur, c dark fur, d light, e nose), the head copied pixel
# for pixel from its side walk: chest up under the head, haunch round, front
# leg straight, tail lying along the floor.
SIDE_SIT = [
    "......................aa........",   # 12
    ".....................aba........",
    "...................aabda........",
    "..................accbda........",
    ".................accbbcca.......",
    ".................abbbbabca......",
    "................abbbbbabba......",
    "...............abbbbbbbbbe......",
    "..............abbbcbbbbbba......",   # 20
    "..............abbbbccbbba.......",
    ".............abbbbbbcaaa........",
    "............abbcbbbbbba.........",
    "...........abbbbcbbbbba.........",
    "......aa..abbbbbbcbbabba........",   # 25: back curving into the haunch; tail tip
    ".....acca.abcbbbbacbabba........",   # the thigh's line, front leg beside; tail curling up
    ".....acaaaabbbbbacbbabba........",
    ".....accccbbbbbaabbaabba........",   # a short tail by the rump (a long one stuck out past the seat)
    "......aaaaaaaaaaaaaaaaaa........",   # 29
]
SIDE_SIT_TOP = 12
SIDE_SIT_PAW = {   # the front paw lifted a little and tucked by the chest (typing)
    24: "...........abbbbcbbbbbba........",
    25: "......aa..abbbbbbcbbbbba........",
    26: ".....acca.abcbbbbacbbaa.........",
    27: ".....acaaaabbbbbacbba...........",
    28: ".....accccbbbbbaabba............",
    29: "......aaaaaaaaaaaaaa............",
}
PET_SYMBOLS = {"a": OUTLINE, "b": FUR, "c": DARK, "d": LIGHT, "e": NOSE}


def side_sit(paw_up=False):
    """The side sitting cat as a 32x32 image in the pet's own colours."""
    rows = list(SIDE_SIT)
    if paw_up:
        for y, text in SIDE_SIT_PAW.items():
            rows[y - SIDE_SIT_TOP] = text
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for dy, text in enumerate(rows):
        for x, ch in enumerate(text):
            if ch in PET_SYMBOLS:
                img.putpixel((x, SIDE_SIT_TOP + dy), PET_SYMBOLS[ch] + (255,))
    return img


# Asleep, curled up side-on (frames 8-9): the side sitting head with its eye shut
# (a lid line), laid low on the front paws, a round loaf of a body behind it and
# the tail wrapped along the front. Columns of the head, rows from its ear tip.
SLEEP_HEAD = {
    0: (22, "aa"),
    1: (21, "aba"),
    2: (19, "aabda"),
    3: (18, "accbda"),
    4: (17, "accbbcca"),
    5: (17, "abbbaabca"),     # the eye shut: a lid line
    6: (16, "abbbbbbbba"),
    7: (15, "abbbbbbbbbe"),   # the nose
    8: (16, "aabbbbbba"),     # chin on the paws
}
SLEEP_BOTTOM = 29             # the floor row, like the side sitting cat


def sleep_pose(breath=0):
    """The sleeping cat as a 32x32 image in the pet's own colours; `breath` 1 = breathing
    in (back and head one pixel up)."""
    img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    put = lambda x, y, sym: img.putpixel((x, y), PET_SYMBOLS[sym] + (255,))
    bottom = SLEEP_BOTTOM
    # curled tight: the back a short round hump behind the head, so the cat
    # (about 16 px) fits on a one-tile bed
    cx, cy, rx = 16, bottom - 4, 6
    ry_top, ry_bottom = 5 + breath, 4

    def inside(x, y):
        ry = ry_top if y < cy else ry_bottom
        return ((x - cx) / rx) ** 2 + ((y - cy) / (ry + 0.5)) ** 2 <= 1

    for y in range(cy - ry_top - 1, bottom + 1):
        for x in range(cx - rx - 1, cx + rx + 2):
            if not inside(x, y):
                continue
            edge = any(not inside(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
            if edge:
                put(x, y, "a")
            elif y >= bottom - 2 or (y < cy and x % 5 == 2):   # shade underneath, dark stripes
                put(x, y, "c")
            else:
                put(x, y, "b")
    for x in range(11, 15):                                   # tail along the front, tip by the paws
        put(x, bottom - 2, "a")
        put(x, bottom - 1, "c")
        put(x, bottom, "a")
    put(10, bottom - 1, "a")
    put(15, bottom - 1, "a")
    top = bottom - 2 - max(SLEEP_HEAD) - breath               # head rows, chin just above the paws
    for dy, (x0, text) in SLEEP_HEAD.items():
        for dx, sym in enumerate(text):
            put(x0 + dx, top + dy, sym)
    for x0 in (16, 20):                                       # two front paws under the chin
        put(x0, bottom - 1, "a")
        put(x0 + 1, bottom - 1, "d")
        put(x0 + 2, bottom - 1, "d")
        put(x0 + 3, bottom - 1, "a")
        for x in range(x0, x0 + 4):
            put(x, bottom, "a")
    # centre the cat in its cell (the office centres a sprite on its x)
    box = img.getbbox()
    shift = (32 - (box[0] + box[2])) // 2
    centred = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    centred.paste(img, (shift, 0), img)
    return centred


def recolour_plain(frame, coat):
    """Colours by role only (no eye detection: the sleeping cat's eyes are shut lines)."""
    line, fur, dark, light, nose, _ = (rgba(c) for c in coat)
    roles = {OUTLINE: line, FUR: fur, DARK: dark, LIGHT: light, NOSE: nose}
    out = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    for y in range(frame.height):
        for x in range(frame.width):
            p = frame.getpixel((x, y))
            if p[3]:
                out.putpixel((x, y), roles.get(p[:3], p))
    return out


def load_pet():
    im = Image.open(PET).convert("RGBA")
    cut = lambda x, y, w: im.crop((x, y, x + w, y + 32))
    return {
        "down_walk": [cut(i * 16, 0, 16) for i in range(3)],
        "down_idle": [cut(48 + i * 16, 0, 16) for i in range(3)],
        "up_walk": [cut(i * 16, 32, 16) for i in range(3)],
        "up_idle": [cut(48 + i * 16, 32, 16) for i in range(3)],
        "right_walk": [cut(i * 32, 64, 32) for i in range(3)],
    }


def eye_pixels(frame, side):
    """Where the pet's eyes are: front, outline-coloured pixels inside the face (fur on
    both sides) in the three rows above the nose, a 1x2 dot each; side, an
    outline-coloured pixel inside the head."""
    w, h = frame.size
    px = lambda x, y: frame.getpixel((x, y))[:3] if frame.getpixel((x, y))[3] else None
    if not side:
        nose = [y for y in range(h) for x in range(w) if px(x, y) == NOSE]
        if not nose:
            return []
        inside = (FUR, DARK)
        return [(x, y) for y in range(nose[0] - 3, nose[0]) for x in range(1, w - 1)
                if px(x, y) == OUTLINE and px(x - 1, y) in inside and px(x + 1, y) in inside]
    for y in range(h):
        for x in range(17, w - 1):
            if px(x, y) == OUTLINE and px(x - 1, y) == FUR and px(x + 1, y) in (FUR, DARK):
                return [(x, y)]
    return []


def recolour(frame, coat, side, blink):
    line, fur, dark, light, nose, eye = (rgba(c) for c in coat)
    roles = {OUTLINE: line, FUR: fur, DARK: dark, LIGHT: light, NOSE: nose}
    out = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    for y in range(frame.height):
        for x in range(frame.width):
            p = frame.getpixel((x, y))
            if p[3]:
                out.putpixel((x, y), roles.get(p[:3], p))
    spots = eye_pixels(frame, side)
    top = min((y for _, y in spots), default=0)
    for x, y in spots:
        # front eyes are 1x2: the iris on top, the pupil (outline) below; shut = fur with a lid line
        if blink:
            out.putpixel((x, y), fur if (not side and y == top) else line)
        elif side or y == top:
            out.putpixel((x, y), eye)
    return out


def place(sheet, img, row, f, lift=0):
    """Put a frame in its 32x32 cell, centred, raised `lift` pixels."""
    x = f * CELL + (CELL - img.width) // 2
    y = row * CELL - lift
    cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    cell.alpha_composite(img, ((CELL - img.width) // 2, -lift) if lift else ((CELL - img.width) // 2, 0))
    sheet.alpha_composite(cell, (f * CELL, row * CELL))


def with_paper(img, page):
    """The sitting cat with a sheet of paper at its front paws."""
    img = img.copy()
    w, h = img.size
    bottom = max(y for y in range(h) if any(img.getpixel((x, y))[3] for x in range(w)))
    top = bottom - 4
    for y in range(top, bottom + 1):
        for x in range(4, 12):
            edge = x in (4, 11) or y in (top, bottom)
            img.putpixel((x, y), (40, 36, 44, 255) if edge else PAPER)
    for k, y in enumerate(range(top + 1, bottom)):
        for x in range(5 + (page and k == 1), 10):
            if (x + k) % 3:
                img.putpixel((x, y), INK)
    return img


def with_side_paper(img, page):
    """The side sitting cat holding a sheet up in front of its chest."""
    img = img.copy()
    for y in range(21, 27):
        for x in range(23, 28):
            edge = x in (23, 27) or y in (21, 26)
            img.putpixel((x, y), (40, 36, 44, 255) if edge else PAPER)
    for y in ((22, 24) if not page else (23, 25)):
        img.putpixel((24, y), INK)
        img.putpixel((25, y), INK)
    return img


def build(coat, pet, blink):
    sheet = Image.new("RGBA", (CELL * FRAMES, CELL * 3), (0, 0, 0, 0))
    c = lambda img, side=False: recolour(img, coat, side, blink)
    rows = {
        0: [c(i) for i in pet["down_walk"]] + [c(pet["down_idle"][0]), c(pet["down_idle"][1]),
                                              with_paper(c(pet["down_idle"][2]), 0),
                                              with_paper(c(pet["down_idle"][2]), 1), c(pet["down_idle"][0])],
        1: [c(i) for i in pet["up_walk"]] + [c(pet["up_idle"][k]) for k in (0, 1, 2, 1, 0)],
        2: [c(i, True) for i in pet["right_walk"]] + [
            c(side_sit(paw_up=True), True), c(side_sit(), True),
            with_side_paper(c(side_sit(), True), 0), with_side_paper(c(side_sit(), True), 1),
            c(side_sit(), True)],
    }
    sleep = [recolour_plain(sleep_pose(b), coat) for b in (0, 1)]
    for row, frames in rows.items():
        frames = frames + sleep          # the same curled-up cat in every direction row
        for f, img in enumerate(frames):
            place(sheet, img, row, f, lift=SIT_LIFT if f >= 3 else 0)
    return sheet


def main():
    pet = load_pet()
    os.makedirs(OUT, exist_ok=True)
    made = []
    for name, coat in COATS.items():
        for blink in (False, True):
            sheet = build(coat, pet, blink)
            sheet.save(os.path.join(OUT, f"{name}{'.blink' if blink else ''}.png"))
            if not blink:
                made.append((name, sheet))
    print("wrote", len(made) * 2, "sheets to", OUT)
    if "--preview" in sys.argv:
        dst = sys.argv[sys.argv.index("--preview") + 1]
        scale = int(sys.argv[sys.argv.index("--scale") + 1]) if "--scale" in sys.argv else 4
        only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else None
        picks = [s for n, s in made if not only or n in only]
        sw, sh = CELL * FRAMES * scale, CELL * 3 * scale
        prev = Image.new("RGBA", (sw, (sh + 10) * len(picks)), (52, 56, 66, 255))
        for i, s in enumerate(picks):
            prev.alpha_composite(s.resize((sw, sh), Image.NEAREST), (0, i * (sh + 10)))
        prev.save(dst)
        print("preview", dst)


if __name__ == "__main__":
    main()
