"""Cat idle poses for the Cat theme, cut from the pet cat's own side walk.

Earlier drafts drew bodies from ellipses and boxes: twice the walking cat's
size, flat fur, a head too small for them. Here every pose is built from the
pet's side walk frame (webview-ui/public/assets/pets/gitcat/pet.png, row 2):
its head, back stripes, tail and legs are moved as pixel blocks, the gaps
between them filled with fur, and the outline re-traced -- so size, shading
and line match the walking cat exactly.

  sit      side sitting (replaces the old ramp-shaped one)
  groom    2 frames: sitting, a front paw up at the mouth / licking it
  stretch  2 frames: rump up, front half low, forelegs flat out; then a yawn
  bat      2 frames: crouched, a paw raised at a toy / swiped down

    python make_cat_poses.py <preview.png>

Writes the frames in the pet's colours to poses/ beside the preview, and the preview
(walk frame, then the poses, in every coat, x6). Nothing is installed.
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from make_pet_cat_sheets import COATS, DARK, FUR, LIGHT, NOSE, OUTLINE, PET, recolour  # noqa: E402

# letters as the pet's colours are used below: a outline, b dark fur, c fur, d light, e nose
COL = {"a": OUTLINE, "b": DARK, "c": FUR, "d": LIGHT, "e": NOSE}
BY_COLOUR = {v: k for k, v in COL.items()}


def walk_frame(i=0):
    im = Image.open(PET).convert("RGBA").crop((i * 32, 64, i * 32 + 32, 96))
    g = [["."] * 32 for _ in range(32)]
    for y in range(32):
        for x in range(32):
            p = im.getpixel((x, y))
            if p[3]:
                g[y][x] = BY_COLOUR.get(p[:3], "c")
    return g


class Pose:
    def __init__(self):
        self.g = [["."] * 32 for _ in range(32)]
        self.soft = set()  # pixels whose inner outline may be smoothed into fur

    def copy(self, src, x0, y0, x1, y1, dx=0, dy=0, skip=()):
        """Copy src's block [x0..x1] x [y0..y1] shifted by (dx, dy); `skip` letters stay behind."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                ch = src[y][x]
                if ch != "." and ch not in skip:
                    tx, ty = x + dx, y + dy
                    if 0 <= tx < 32 and 0 <= ty < 32:
                        self.g[ty][tx] = ch

    def fill(self, pts, ch="c"):
        for x, y in pts:
            if 0 <= x < 32 and 0 <= y < 32:
                self.g[y][x] = ch
                self.soft.add((x, y))

    def poly(self, poly, ch="c"):
        """Fill a polygon (scanline, pixel centres)."""
        ys = [p[1] for p in poly]
        pts = []
        for y in range(min(ys), max(ys) + 1):
            xs = []
            n = len(poly)
            for i in range(n):
                (x1, y1), (x2, y2) = poly[i], poly[(i + 1) % n]
                if (y1 <= y < y2) or (y2 <= y < y1):
                    xs.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                pts += [(x, y) for x in range(round(a), round(b) + 1)]
        self.fill(pts, ch)

    def limb(self, pts, toe=True):
        """A 2-px leg along a list of points: fur with an outline, the last point a light toe bean."""
        for x, y in pts:
            self.fill([(x, y), (x, y + 1)], "c")
        if toe:
            x, y = pts[-1]
            self.g[y][x] = "d"

    def heal(self):
        filled = lambda x, y: 0 <= x < 32 and 0 <= y < 32 and self.g[y][x] != "."
        out = [row[:] for row in self.g]
        for y in range(32):
            for x in range(32):
                if not filled(x, y):
                    continue
                edge = not all(filled(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                if edge and self.g[y][x] in "bc":  # the nose, ear and toe beans keep their colour
                    out[y][x] = "a"
                elif (x, y) in self.soft and self.g[y][x] == "a":
                    out[y][x] = "c"
        # an outline pixel left inside a soft (filled) area is a seam between parts: fur it
        for y in range(1, 31):
            for x in range(1, 31):
                if out[y][x] == "a" and all(filled(x + dx, y + dy) for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    near_soft = any((x + dx, y + dy) in self.soft for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)))
                    if near_soft and (x, y) not in self.keep:
                        out[y][x] = "c"
        self.g = out
        return self

    keep = frozenset()

    def image(self):
        img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
        for y in range(32):
            for x in range(32):
                ch = self.g[y][x]
                if ch in COL:
                    img.putpixel((x, y), COL[ch] + (255,))
        return img


W = walk_frame(0)
# The walk frame's parts (inclusive boxes): head + neck, tail, torso, legs.
HEAD = (16, 12, 25, 22)
TAIL = (3, 12, 8, 18)
TORSO = (6, 17, 21, 24)
HIND = (5, 25, 11, 28)
FRONT = (16, 25, 21, 28)
EYE_AND_JAW = {(22, 17), (22, 18), (17, 20), (18, 20)}  # interior lines in the head to keep


def sit():
    """Sitting side-on: rump on the floor, chest up under a raised head, front legs straight down."""
    p = Pose()
    # haunch and chest, a slope from the rump up to the neck (filled first, the parts go on top)
    p.poly([(7, 28), (7, 23), (9, 20), (13, 19), (16, 17), (20, 17), (21, 22), (20, 28)])
    # the back's dark band and a stripe or two, like the walk's
    p.fill([(9, 21), (10, 20), (11, 20), (12, 20), (13, 20), (14, 19), (15, 18)], "b")
    p.fill([(10, 24), (11, 23), (13, 24), (12, 25)], "b")
    p.copy(W, *HEAD, dx=-1, dy=-4)                   # head raised
    p.copy(W, *FRONT, dx=0, dy=0)                    # front legs straight down under the chest
    p.copy(W, 6, 26, 10, 28, dx=0, dy=0)             # hind paw tucked at the rump
    # tail lying along the floor behind
    p.fill([(x, 27) for x in range(2, 8)], "c")
    p.fill([(x, 26) for x in range(2, 4)], "b")
    p.keep = frozenset((x - 1, y - 4) for x, y in EYE_AND_JAW)
    return p.heal()


def groom(frame):
    """Sitting, the near front paw lifted to the mouth (0), then licked: paw lower, tongue out (1)."""
    p = sit()
    g = p.g
    # take the near front leg off the floor: the far one stays
    for y in range(25, 29):
        for x in range(19, 22):
            g[y][x] = "."
    lift = 0 if frame == 0 else 1
    p.limb([(19, 23), (20, 22), (21, 21), (22, 20 + lift), (23, 19 + lift)])
    if frame == 1:
        g[18][24] = "e"  # tongue on the paw
    return p.heal()


def stretch(frame):
    """Play bow: rear half as in the walk, front half lowered, forelegs flat out along the floor."""
    p = Pose()
    p.copy(W, 3, 12, 13, 28, dx=0, dy=-1)                       # tail, rump, hind legs
    p.copy(W, 14, 12, 25, 24, dx=3, dy=5)                       # shoulders + head, low and forward
    p.poly([(12, 16), (17, 21), (20, 27), (12, 24)])            # the back sloping down between them
    p.limb([(x, 26) for x in range(18, 30)], toe=True)          # forelegs out on the floor
    for x in range(19, 29):
        p.g[27][x] = "b"                                        # the far foreleg, darker
    p.keep = frozenset((x + 3, y + 5) for x, y in EYE_AND_JAW)
    p.heal()
    if frame == 1:  # yawn: the mouth drops open, pink inside
        nx, ny = 25 + 3, 19 + 5
        for (x, y, ch) in ((nx - 1, ny + 1, "e"), (nx - 2, ny + 1, "e"), (nx, ny + 1, "a"), (nx - 1, ny + 2, "a")):
            p.g[y][x] = ch
    return p


def bat(frame):
    """Crouched: the walk lowered onto its belly, tail up; a paw raised (0) or swiped down (1)."""
    p = Pose()
    p.copy(W, 3, 12, 25, 24, dx=0, dy=3)                        # whole cat, legs folded under
    p.fill([(x, 28) for x in range(7, 21)], "c")                # belly on the floor
    if frame == 0:  # reaching up past the chin
        p.limb([(21, 25), (22, 24), (23, 23), (24, 22), (25, 21), (26, 20), (27, 19)])
    else:           # swiped down onto the floor in front
        p.limb([(21, 26), (22, 26), (23, 27), (24, 27), (25, 27), (26, 27), (27, 27), (28, 27)])
    p.keep = frozenset((x, y + 3) for x, y in EYE_AND_JAW)
    return p.heal()


def main():
    out = sys.argv[1]
    raw = os.path.join(os.path.dirname(os.path.abspath(out)), "poses")
    os.makedirs(raw, exist_ok=True)
    poses = [("sit", sit())] + [(f"groom_{i}", groom(i)) for i in (0, 1)] \
        + [(f"stretch_{i}", stretch(i)) for i in (0, 1)] + [(f"bat_{i}", bat(i)) for i in (0, 1)]
    walk = Pose()
    walk.g = [row[:] for row in W]
    cols = [("walk", walk)] + poses
    for name, p in poses:
        p.image().save(os.path.join(raw, name + ".png"))
    S, pad = 6, 8
    Wd = len(cols) * (32 * S + pad)
    H = len(COATS) * (24 * S + pad)
    sheet = Image.new("RGBA", (Wd, H), (150, 104, 66, 255))
    for r, coat in enumerate(COATS.values()):
        for c, (_, p) in enumerate(cols):
            img = recolour(p.image(), coat, True, False).crop((0, 8, 32, 32))
            sheet.alpha_composite(img.resize((32 * S, 24 * S), Image.NEAREST), (c * (32 * S + pad), r * (24 * S + pad)))
    sheet.save(out)
    print("wrote", len(poses), "poses; preview", out)


if __name__ == "__main__":
    main()
