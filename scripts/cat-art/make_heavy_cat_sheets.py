"""The heavy cat for the Cat theme: a broad round face with wide cheeks on a
pear-shaped body, drawn from shapes (not cut from the pet cat), in the same eight
coats. An agent's cat turns heavy once its context fills past the threshold set in
Settings (office/engine/catHeavy.ts).

Same layout as the other cat sheets: 3 direction rows (down, up, right) x 10 frames
(walk1-3, type1-2, read1-2, seated, sleep1-2), 32x32 each, the sitting frames
lifted SIT_LIFT like make_pet_cat_sheets.py's.

    python make_heavy_cat_sheets.py [--preview out.png] [--only ginger,tabby]

Writes webview-ui/src/characters/cats/heavy/<coat>.png and <coat>.blink.png.

Letters: a outline, b fur, c dark fur, d light (inner ear), w cream (chest, muzzle,
toes), e nose, y eye, p paper, i ink.
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_pet_cat_sheets import COATS, FORK, rgba  # noqa: E402

OUT = os.path.join(FORK, "webview-ui", "src", "characters", "cats", "heavy")
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
W = H = 32
CELL, FRAMES = 32, 10
SIT_LIFT = 3
PAPER, INK = rgba("#fbfaf6"), rgba("#9aa3b5")
# The cream of the chest, muzzle and toes, per coat (the coats' own "light" is the inner
# ear's pink on most of them, which made pink bibs).
BIB = {
    "ginger": rgba("#ffe0c0"), "tuxedo": rgba("#ece6e2"), "grey": rgba("#e6e8ee"),
    "calico": rgba("#ffffff"), "blue": rgba("#dde3ec"), "siamese": rgba("#f6efe2"),
    "tabby": rgba("#eadcc2"), "snow": rgba("#ffffff"),
}


def ell(cx, cy, rx, ry):
    return {(x, y) for y in range(H) for x in range(W) if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0}


def tri(pts):
    (x1, y1), (x2, y2), (x3, y3) = pts
    out = set()
    for y in range(H):
        for x in range(W):
            d1 = (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2)
            d2 = (x - x3) * (y2 - y3) - (x2 - x3) * (y - y3)
            d3 = (x - x1) * (y3 - y1) - (x3 - x1) * (y - y1)
            if not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0)):
                out.add((x, y))
    return out


def shift(pts, dx=0, dy=0):
    return {(x + dx, y + dy) for x, y in pts}


def paw_bump(x0, w=4, top=26, bottom=28):
    """A rounded paw/leg stub: a block whose bottom corners are cut off."""
    pts = {(x, y) for x in range(x0, x0 + w) for y in range(top, bottom + 1)}
    return pts - {(x0, bottom), (x0 + w - 1, bottom)}


class Cat:
    """A 32x32 letter grid and its silhouette, built up from shapes."""

    def __init__(self):
        self.g = [["."] * W for _ in range(H)]
        self.sil = set()

    def fill(self, pts, ch="b"):
        for x, y in pts:
            if 0 <= x < W and 0 <= y < H:
                self.g[y][x] = ch
                self.sil.add((x, y))

    def paint(self, pts, ch):
        """Colour pixels already inside the silhouette."""
        for x, y in pts:
            if (x, y) in self.sil:
                self.g[y][x] = ch

    def dots(self, items):
        for x, y, ch in items:
            self.g[y][x] = ch
            self.sil.add((x, y))

    def seam(self, upper, lower, below_y):
        """An outline where the `upper` shape's lower edge lies over the `lower` one (a chin)."""
        for x, y in upper:
            if y > below_y and any((x + dx, y + dy) in lower and (x + dx, y + dy) not in upper for dx, dy in N4):
                if self.g[y][x] in "bc":
                    self.g[y][x] = "a"

    def outline(self):
        for x, y in self.sil:
            if any((x + dx, y + dy) not in self.sil for dx, dy in N4):
                self.g[y][x] = "a"
        return self

    def part(self, core, colour=lambda x, y: "b"):
        """A separate part (tail, paw) over what is there: its core, ringed by outline
        without the corner pixels, so its ends come out rounded, not boxy."""
        ring = {(x + dx, y + dy) for x, y in core for dx, dy in N4} - core
        for x, y in ring:
            if 0 <= x < W and 0 <= y < H:
                self.g[y][x] = "a"
                self.sil.add((x, y))
        for x, y in core:
            self.g[y][x] = colour(x, y)
            self.sil.add((x, y))

    def paper(self, x0, y0, w=6, h=5, page=0):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                edge = x in (x0, x0 + w - 1) or y in (y0, y0 + h - 1)
                self.g[y][x] = "a" if edge else "p"
        for k, y in enumerate(range(y0 + 1, y0 + h - 1)):
            for x in range(x0 + 1 + (page and k == 1), x0 + w - 2):
                if (x + k) % 3:
                    self.g[y][x] = "i"


# --------------------------------------------------------------- front (down)
FRONT_TAILS = [  # the tail by the right flank: curled up, flicked out, laid down
    {(26, 28), (27, 28), (27, 27), (28, 26), (28, 25), (27, 24)},
    {(26, 28), (27, 28), (28, 27), (29, 26), (29, 25), (29, 24)},
    {(26, 28), (27, 28), (28, 28), (29, 27), (29, 26), (28, 26)},
]


def front_face(c, dy=0):
    head = ell(16, 14.6 + dy, 7.4, 5.0) | ell(16, 16.8 + dy, 8.6, 3.0)       # round face, wide cheeks
    c.fill(tri([(8, 13 + dy), (9, 8 + dy), (13, 11 + dy)]) | tri([(24, 13 + dy), (23, 8 + dy), (19, 11 + dy)]))
    c.paint({(10, 10 + dy), (10, 11 + dy), (11, 11 + dy), (22, 10 + dy), (22, 11 + dy), (21, 11 + dy)}, "d")
    c.fill(head)
    c.paint(ell(16, 17.6 + dy, 3.4, 1.9), "w")
    c.paint(shift({(14, 11), (16, 11), (18, 11), (15, 12), (17, 12)}, 0, dy), "c")
    c.paint(shift({(9, 15), (10, 15), (22, 15), (23, 15)}, 0, dy), "c")
    return head


def front_face_marks(c, dy=0):
    c.dots([(13, 14 + dy, "y"), (13, 15 + dy, "a"), (19, 14 + dy, "y"), (19, 15 + dy, "a"),
            (16, 16 + dy, "e"), (15, 17 + dy, "a"), (17, 17 + dy, "a"), (16, 17 + dy, "a")])


def front_sit(tail=0, paper=None):
    """Sitting, from the front: a pear -- the head straight on a body that flares at the bottom."""
    c = Cat()
    body = ell(16, 24.4, 11, 6.0) | ell(16, 21, 8.4, 5)
    c.fill(body)
    c.paint(ell(16, 23.2, 4.2, 3.6), "w")
    c.paint({(8, 23), (8, 24), (24, 23), (24, 24), (9, 21), (9, 22), (23, 21), (23, 22),
             (7, 26), (8, 26), (24, 26), (25, 26)}, "c")
    c.fill(FRONT_TAILS[tail] | {(x + 1, y) for x, y in FRONT_TAILS[tail] if y >= 26}, "c")
    head = front_face(c)
    c.outline()
    c.seam(head, body, 16)
    front_face_marks(c)
    c.dots([(14, 26, "a"), (14, 27, "a"), (14, 28, "a"), (18, 26, "a"), (18, 27, "a"), (18, 28, "a")])
    for x0 in (11, 18):
        c.dots([(x0, 29, "a"), (x0 + 1, 29, "w"), (x0 + 2, 29, "w"), (x0 + 3, 29, "a"),
                (x0, 30, "a"), (x0 + 1, 30, "a"), (x0 + 2, 30, "a"), (x0 + 3, 30, "a")])
    if paper is not None:
        c.paper(13, 25, 7, 5, paper)
    return c.g


def front_walk(f):
    """Walking towards the viewer: the sitting pear lifted a little, bobbing up on the
    passing frame, two round front paws stepping under it in turn."""
    c = Cat()
    bob = -1 if f == 1 else 0
    up = {0: (1, 0), 1: (0, 0), 2: (0, 1)}[f]
    for x0, u in ((10, up[0]), (18, up[1])):
        c.fill(paw_bump(x0, 5, 25, 29 - u), "b")
    body = ell(16, 22.6 + bob, 10.4, 5.4) | ell(16, 19.8 + bob, 8.4, 5)
    c.fill(body)
    c.paint(ell(16, 21.6 + bob, 3.6, 3.0), "w")
    c.paint(shift({(8, 21), (8, 22), (24, 21), (24, 22), (7, 24), (25, 24)}, 0, bob), "c")
    head = front_face(c, bob - 2)
    c.outline()
    c.seam(head, body, 14 + bob)
    front_face_marks(c, bob - 2)
    return c.g


# ---------------------------------------------------------------- back (up)
BACK_TAILS = [  # sitting: the tail down the middle of the back, swishing
    {(16, 29), (16, 28), (16, 27), (17, 26), (17, 25), (16, 24)},
    {(16, 29), (16, 28), (16, 27), (16, 26), (16, 25), (16, 24)},
    {(16, 29), (16, 28), (16, 27), (15, 26), (15, 25), (16, 24)},
]


def back_head(c, dy=0):
    head = ell(16, 14.6 + dy, 7.4, 5.0) | ell(16, 16.8 + dy, 8.6, 3.0)
    c.fill(tri([(8, 13 + dy), (9, 8 + dy), (13, 11 + dy)]) | tri([(24, 13 + dy), (23, 8 + dy), (19, 11 + dy)]))
    c.fill(head)
    c.paint(shift({(14, 11), (16, 11), (18, 11), (14, 13), (16, 13), (18, 13), (15, 15), (17, 15)}, 0, dy), "c")
    return head


def back_sit(tail=0):
    c = Cat()
    body = ell(16, 24.4, 11, 6.0) | ell(16, 21, 8.4, 5)
    c.fill(body)
    c.paint({(10, 22), (11, 22), (21, 22), (22, 22), (9, 25), (10, 25), (22, 25), (23, 25),
             (12, 27), (13, 27), (19, 27), (20, 27)}, "c")
    head = back_head(c)
    c.outline()
    c.seam(head, body, 16)
    c.part(BACK_TAILS[tail], lambda x, y: "c" if y % 2 else "b")
    return c.g


def back_walk(f):
    c = Cat()
    bob = -1 if f == 1 else 0
    up = {0: (1, 0), 1: (0, 0), 2: (0, 1)}[f]
    for x0, u in ((10, up[0]), (18, up[1])):                       # hind paws stepping in turn
        c.fill(paw_bump(x0, 5, 25, 29 - u), "b")
    body = ell(16, 22.6 + bob, 10.4, 5.4) | ell(16, 19.8 + bob, 8.4, 5)
    c.fill(body)
    c.paint(shift({(10, 20), (11, 20), (21, 20), (22, 20), (8, 23), (9, 23), (23, 23), (24, 23)}, 0, bob), "c")
    head = back_head(c, bob - 2)
    c.outline()
    c.seam(head, body, 14 + bob)
    # the tail held up and out to one side, clear of the body's outline, swinging to the
    # other side as the cat walks (hanging down it read as a third leg, drawn up the middle
    # of the back as a split)
    pts = [(23, 25), (24, 24), (25, 23), (26, 22), (27, 21), (27, 20), (26, 19)]
    if f == 1:
        pts = [(x, y - 1) for x, y in pts]
    if f == 2:
        pts = [(31 - x, y) for x, y in pts]
    tail = {(x, y + bob) for x, y in pts}
    tip = {(pts[-1][0], pts[-1][1] + bob), (pts[-2][0], pts[-2][1] + bob)}
    c.part(tail, lambda x, y: "c" if (x, y) in tip else "b")
    return c.g


# --------------------------------------------------------------- side (right)
def side_head(c, dy=0):
    head = ell(21, 15.6 + dy, 5.6, 4.6) | ell(21.4, 17.8 + dy, 5.2, 2.6)    # sunk into the shoulders
    c.fill(tri([(16, 13 + dy), (17, 8 + dy), (20, 11 + dy)]) | tri([(20, 12 + dy), (22, 8 + dy), (24, 11 + dy)]))
    c.paint({(18, 11 + dy), (21, 11 + dy), (22, 10 + dy)}, "d")
    c.fill(head)
    c.paint(ell(24.6, 18.2 + dy, 2.2, 1.6), "w")
    c.paint(shift({(18, 12), (19, 12), (20, 13), (17, 16), (17, 17)}, 0, dy), "c")
    return head


def side_face_marks(c, dy=0):
    c.dots([(23, 15 + dy, "y"), (23, 16 + dy, "a"), (26, 17 + dy, "e"), (25, 19 + dy, "a")])


def tail_wrap(c, out=False):
    """The tail out from under the rump, along the floor in front of the body: thick at
    the root, a pixel at the tip, no bars across it (they read as a ladder)."""
    core = {(x, 28) for x in range(8, 13)} | {(x, 29) for x in range(8, 17)}
    tip = {(15, 29), (16, 29)}
    if out:  # the tip flicked up
        core |= {(17, 28), (17, 27)}
        tip = {(17, 28), (17, 27)}
    c.part(core, lambda x, y: "c" if (x, y) in tip else "b")


def side_sit(paw=False, out=False, paper=None):
    """Sitting side-on: a sack with a high round back, the head sunk into the shoulders."""
    c = Cat()
    body = ell(13.5, 23.9, 9.2, 6.4) | ell(18.5, 21.4, 5.4, 6.2)
    c.fill(body)
    c.paint(ell(21, 23.5, 2.4, 3.2), "w")
    for x in (8, 11, 14):
        c.paint({(x, 19 + (x == 14)), (x, 20 + (x == 14)), (x, 21 + (x == 14))}, "c")
    head = side_head(c)
    c.outline()
    c.seam(head, body, 17)
    side_face_marks(c)
    tail_wrap(c, out)
    if paw:
        c.part({(23, 22), (24, 22)}, lambda x, y: "w" if x == 24 else "b")      # a paw up (typing)
    else:
        c.part({(20, 29), (21, 29)}, lambda *_: "w")                             # a front paw peeking out
    if paper is not None:
        c.paper(23, 20, 5, 6, paper)
    return c.g


def side_walk(f):
    """Walking side-on: a low-slung sack, its legs hidden by the belly but for chunky round
    paws peeking out under it (far paws darker, a step out of phase), tail up."""
    c = Cat()
    dy = -1 if f == 1 else 0
    hind, front = {0: ((4, 8), (19, 15)), 1: ((6, 6), (17, 17)), 2: ((8, 4), (15, 19))}[f]
    c.fill(paw_bump(hind[1], 4, 24) | paw_bump(front[1], 4, 24), "c")
    c.fill(paw_bump(hind[0], 5, 24) | paw_bump(front[0], 5, 24), "b")
    body = ell(13.5, 21.1 + dy, 10.2, 4.5) | ell(18, 19.5 + dy, 5.5, 4.8)
    c.fill(body)
    c.paint(ell(20, 21.9 + dy, 2.6, 1.8), "w")                    # cream chest, kept above the front paw
    for x in (7, 10, 13):
        c.paint({(x, 18 + dy), (x, 19 + dy), (x, 20 + dy)}, "c")
    head = side_head(c, dy - 1)
    c.outline()
    c.seam(head, body, 16 + dy)
    side_face_marks(c, dy - 1)
    c.part({(4, 20 + dy), (3, 19 + dy), (3, 18 + dy), (3, 17 + dy), (4, 16 + dy)},
           lambda x, y: "c" if y % 2 else "b")                    # tail up
    return c.g


def sleep(b):
    """Curled up asleep (the same in every direction row): a big round loaf, head down on
    the paws, eyes shut, tail round the front; breathing lifts the back a pixel."""
    c = Cat()
    body = ell(13.5, 23.2 - b * 0.5, 10.5, 6.4 + b * 0.5)
    c.fill(body)
    for x in (7, 10, 13, 16):
        c.paint({(x, 18 - b), (x, 19 - b), (x, 20 - b)}, "c")
    head = ell(22, 22.6, 6, 4.8) | ell(22.4, 24.8, 5.6, 2.8)
    c.fill(tri([(17, 20), (18, 14), (21, 17)]) | tri([(21, 18), (23, 14), (25, 17)]))
    c.paint({(19, 17), (22, 17), (23, 16)}, "d")
    c.fill(head)
    c.paint(ell(25.6, 25, 2.2, 1.5), "w")
    c.outline()
    c.seam(head, body, 22)
    # a soft shut eye (a little smile-curve, no brow above it: a dark mark there read as a frown)
    c.dots([(22, 22, "a"), (23, 23, "a"), (24, 23, "a"), (25, 22, "a"), (27, 24, "e")])
    c.part({(x, 28) for x in range(8, 24)}, lambda x, y: "c" if x >= 22 else "b")
    return c.g


# ------------------------------------------------------------------- sheets
def frames():
    """Each direction row's 10 frames, in the sheet's order."""
    z = [sleep(0), sleep(1)]
    return {
        0: [front_walk(0), front_walk(1), front_walk(2), front_sit(0), front_sit(1),
            front_sit(2, paper=0), front_sit(2, paper=1), front_sit(0)] + z,
        1: [back_walk(0), back_walk(1), back_walk(2), back_sit(0), back_sit(1),
            back_sit(2), back_sit(1), back_sit(0)] + z,
        2: [side_walk(0), side_walk(1), side_walk(2), side_sit(paw=True), side_sit(out=True),
            side_sit(paper=0), side_sit(out=True, paper=1), side_sit()] + z,
    }


# Rows drawn with the cat's bottom one pixel lower than the other cat sheets put it
# (the side sitting cat): moved up that much along with the lift.
SIT_SHIFT = {0: 0, 1: 0, 2: 1}


def render(g, name, blink):
    line, fur, dark, light, nose, eye = (rgba(c) for c in COATS[name])
    col = {"a": line, "b": fur, "c": dark, "d": light, "e": nose, "y": fur if blink else eye,
           "w": BIB[name], "p": PAPER, "i": INK}
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for y, row in enumerate(g):
        for x, ch in enumerate(row):
            if ch != ".":
                img.putpixel((x, y), col[ch])
    return img


def build(name, blink, rows):
    sheet = Image.new("RGBA", (CELL * FRAMES, CELL * 3), (0, 0, 0, 0))
    for row, fs in rows.items():
        for f, g in enumerate(fs):
            up = SIT_LIFT + (SIT_SHIFT[row] if 3 <= f <= 7 else 0) if f >= 3 else 0
            cell = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
            cell.alpha_composite(render(g, name, blink), (0, 0), (0, up, CELL, CELL))
            sheet.alpha_composite(cell, (f * CELL, row * CELL))
    return sheet


def main():
    only = sys.argv[sys.argv.index("--only") + 1].split(",") if "--only" in sys.argv else list(COATS)
    os.makedirs(OUT, exist_ok=True)
    rows = frames()
    made = []
    for name in only:
        for blink in (False, True):
            s = build(name, blink, rows)
            s.save(os.path.join(OUT, f"{name}{'.blink' if blink else ''}.png"))
            if not blink:
                made.append(s)
    print("wrote", len(made) * 2, "sheets to", OUT)
    if "--preview" in sys.argv:
        dst = sys.argv[sys.argv.index("--preview") + 1]
        S = 5
        prev = Image.new("RGBA", (CELL * FRAMES * S, (CELL * 3 * S + 12) * len(made)), (150, 104, 66, 255))
        for i, s in enumerate(made):
            prev.alpha_composite(s.resize((CELL * FRAMES * S, CELL * 3 * S), Image.NEAREST), (0, i * (CELL * 3 * S + 12)))
        prev.save(dst)
        print("preview", dst)


if __name__ == "__main__":
    main()
