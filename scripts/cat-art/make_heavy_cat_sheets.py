"""The heavy cat for the Cat theme: a broad round face with wide cheeks on a
pear-shaped body, drawn from shapes (not cut from the pet cat), in the same eight
coats. An agent's cat turns heavy once its context fills past the threshold set in
Settings (office/engine/catHeavy.ts).

Same layout as the other cat sheets: 3 direction rows (down, up, right) x 10 frames
(walk1-3, type1-2, read1-2, seated, sleep1-2), 32x32 each, the sitting frames
lifted SIT_LIFT like make_pet_cat_sheets.py's.

    python make_heavy_cat_sheets.py [--preview out.png] [--only ginger,tabby]

Writes webview-ui/src/characters/cats/heavy/<coat>.png and <coat>.blink.png.

Letters: a outline, b fur, c dark fur, d light (inner ear, face sides), e nose, y eye,
p paper, i ink. The markings are the slim cat's own (make_pet_cat_sheets.py): each
heavy head and body takes its colour roles from the slim frame facing the same way
(`transfer`), so every coat keeps its pattern when its cat turns heavy.
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_pet_cat_sheets import (COATS, DARK, FORK, FUR, LIGHT, NOSE, OUTLINE,  # noqa: E402
                                 load_pet, rgba)
from make_pet_cat_sheets import side_sit as slim_side_sit  # noqa: E402

OUT = os.path.join(FORK, "webview-ui", "src", "characters", "cats", "heavy")
N4 = ((1, 0), (-1, 0), (0, 1), (0, -1))
W = H = 32
CELL, FRAMES = 32, 10
SIT_LIFT = 3
PAPER, INK = rgba("#fbfaf6"), rgba("#9aa3b5")

# ------------------------------------------------------- the slim cat's pattern
ROLE = {OUTLINE: "a", FUR: "b", DARK: "c", LIGHT: "d", NOSE: "e"}


def role_grid(img):
    """A slim frame (in the pet's own colours) as letters: its colour roles."""
    return [[ROLE.get(img.getpixel((x, y))[:3], "b") if img.getpixel((x, y))[3] else "."
             for x in range(img.width)] for y in range(img.height)]


_PET = load_pet()
# The slim frame each heavy view copies its markings from, with the boxes (x0, y0, x1, y1)
# of that frame's head and torso.
SLIM = {
    "front": (role_grid(_PET["down_idle"][0]), (1, 20, 13, 26), (2, 27, 12, 30)),
    "back": (role_grid(_PET["up_idle"][0]), (1, 16, 14, 21), (2, 22, 13, 29)),
    "walk": (role_grid(_PET["right_walk"][0]), (17, 12, 25, 22), (7, 18, 16, 24)),
    "sit": (role_grid(slim_side_sit()), (17, 12, 25, 21), (11, 21, 23, 28)),
}


def transfer(c, part, view, which):
    """Give a heavy head or body the slim cat's markings: each of its pixels takes the
    colour role (fur, dark, light) at the same relative spot of the slim frame's head or
    torso, so every coat's pattern carries over (stretched to the heavy shape)."""
    grid, head_box, body_box = SLIM[view]
    sx0, sy0, sx1, sy1 = head_box if which == "head" else body_box
    pts = [(x, y) for (x, y) in part if (x, y) in c.sil and c.g[y][x] in "bcd"]
    if not pts:
        return
    x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
    y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
    for x, y in pts:
        tx = sx0 + (x - x0) / max(1, x1 - x0) * (sx1 - sx0)
        ty = sy0 + (y - y0) / max(1, y1 - y0) * (sy1 - sy0)
        best = None
        for r in range(3):  # the nearest fur pixel there (not an outline or eye)
            for dy in range(-r, r + 1):
                for dx in range(-r, r + 1):
                    sx, sy = round(tx) + dx, round(ty) + dy
                    if sx0 <= sx <= sx1 and sy0 <= sy <= sy1 and grid[sy][sx] in "bcd":
                        d = (sx - tx) ** 2 + (sy - ty) ** 2
                        if best is None or d < best[0]:
                            best = (d, grid[sy][sx])
            if best:
                break
        if best:
            # the slim cat's light pixels are its inner ears' pink: stretched over a heavy
            # face they made pink blotches, so they come over as fur (the heavy ears keep theirs)
            c.g[y][x] = "b" if best[1] == "d" else best[1]


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
    return head


def front_face_marks(c, dy=0):
    c.dots([(13, 14 + dy, "y"), (13, 15 + dy, "a"), (19, 14 + dy, "y"), (19, 15 + dy, "a"),
            (16, 16 + dy, "e"), (15, 17 + dy, "a"), (17, 17 + dy, "a"), (16, 17 + dy, "a")])


def front_sit(tail=0, paper=None):
    """Sitting, from the front: a pear -- the head straight on a body that flares at the bottom."""
    c = Cat()
    body = ell(16, 24.4, 11, 6.0) | ell(16, 21, 8.4, 5)
    c.fill(body)
    c.fill(FRONT_TAILS[tail] | {(x + 1, y) for x, y in FRONT_TAILS[tail] if y >= 26}, "c")
    head = front_face(c)
    transfer(c, body - head, "front", "body")
    transfer(c, head, "front", "head")
    c.outline()
    c.seam(head, body, 16)
    front_face_marks(c)
    c.dots([(14, 26, "a"), (14, 27, "a"), (14, 28, "a"), (18, 26, "a"), (18, 27, "a"), (18, 28, "a")])
    for x0 in (11, 18):
        c.dots([(x0, 29, "a"), (x0 + 1, 29, "b"), (x0 + 2, 29, "b"), (x0 + 3, 29, "a"),
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
    head = front_face(c, bob - 2)
    transfer(c, body - head, "front", "body")
    transfer(c, head, "front", "head")
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
    return head


def back_sit(tail=0):
    c = Cat()
    body = ell(16, 24.4, 11, 6.0) | ell(16, 21, 8.4, 5)
    c.fill(body)
    head = back_head(c)
    transfer(c, body - head, "back", "body")
    transfer(c, head, "back", "head")
    c.outline()
    c.seam(head, body, 16)
    c.part(BACK_TAILS[tail], lambda x, y: "c")
    return c.g


def back_walk(f):
    c = Cat()
    bob = -1 if f == 1 else 0
    up = {0: (1, 0), 1: (0, 0), 2: (0, 1)}[f]
    for x0, u in ((10, up[0]), (18, up[1])):                       # hind paws stepping in turn
        c.fill(paw_bump(x0, 5, 25, 29 - u), "b")
    body = ell(16, 22.6 + bob, 10.4, 5.4) | ell(16, 19.8 + bob, 8.4, 5)
    c.fill(body)
    head = back_head(c, bob - 2)
    transfer(c, body - head, "back", "body")
    transfer(c, head, "back", "head")
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
    c.part({(x, y + bob) for x, y in pts}, lambda x, y: "c")      # dark, like the slim cat's
    return c.g


# --------------------------------------------------------------- side (right)
def side_head(c, dy=0):
    head = ell(21, 15.6 + dy, 5.6, 4.6) | ell(21.4, 17.8 + dy, 5.2, 2.6)    # sunk into the shoulders
    c.fill(tri([(16, 13 + dy), (17, 8 + dy), (20, 11 + dy)]) | tri([(20, 12 + dy), (22, 8 + dy), (24, 11 + dy)]))
    c.paint({(18, 11 + dy), (21, 11 + dy), (22, 10 + dy)}, "d")
    c.fill(head)
    return head


def side_face_marks(c, dy=0):
    c.dots([(23, 15 + dy, "y"), (23, 16 + dy, "a"), (26, 17 + dy, "e"), (25, 19 + dy, "a")])


def tail_wrap(c, out=False):
    """The tail out from under the rump, along the floor in front of the body: thick at
    the root, a pixel at the tip, no bars across it (they read as a ladder)."""
    core = {(x, 28) for x in range(8, 13)} | {(x, 29) for x in range(8, 17)}
    if out:  # the tip flicked up
        core |= {(17, 28), (17, 27)}
    c.part(core, lambda x, y: "c")                                 # dark, like the slim cat's


def side_sit(paw=False, out=False, paper=None):
    """Sitting side-on: a sack with a high round back, the head sunk into the shoulders."""
    c = Cat()
    body = ell(13.5, 23.9, 9.2, 6.4) | ell(18.5, 21.4, 5.4, 6.2)
    c.fill(body)
    head = side_head(c)
    transfer(c, body - head, "sit", "body")
    transfer(c, head, "sit", "head")
    c.outline()
    c.seam(head, body, 17)
    side_face_marks(c)
    tail_wrap(c, out)
    if paw:
        c.part({(23, 22), (24, 22)})                                             # a paw up (typing)
    else:
        c.part({(20, 29), (21, 29)})                                             # a front paw peeking out
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
    head = side_head(c, dy - 1)
    transfer(c, body - head, "walk", "body")
    transfer(c, head, "walk", "head")
    c.outline()
    c.seam(head, body, 16 + dy)
    side_face_marks(c, dy - 1)
    c.part({(4, 20 + dy), (3, 19 + dy), (3, 18 + dy), (3, 17 + dy), (4, 16 + dy)},
           lambda x, y: "c")                                      # tail up, dark like the slim cat's
    return c.g


def sleep(b):
    """Curled up asleep (the same in every direction row): a big round loaf, head down on
    the paws, eyes shut, tail round the front; breathing lifts the back a pixel."""
    c = Cat()
    body = ell(13.5, 23.2 - b * 0.5, 10.5, 6.4 + b * 0.5)
    c.fill(body)
    head = ell(22, 22.6, 6, 4.8) | ell(22.4, 24.8, 5.6, 2.8)
    c.fill(tri([(17, 20), (18, 14), (21, 17)]) | tri([(21, 18), (23, 14), (25, 17)]))
    c.paint({(19, 17), (22, 17), (23, 16)}, "d")
    c.fill(head)
    transfer(c, body - head, "sit", "body")
    transfer(c, head, "sit", "head")
    c.outline()
    c.seam(head, body, 22)
    # a soft shut eye (a little smile-curve, no brow above it: a dark mark there read as a frown)
    c.dots([(22, 22, "a"), (23, 23, "a"), (24, 23, "a"), (25, 22, "a"), (27, 24, "e")])
    c.part({(x, 28) for x in range(8, 24)}, lambda x, y: "c")
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
           "p": PAPER, "i": INK}
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
