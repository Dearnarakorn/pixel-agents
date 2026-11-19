"""Laptop screen games for the Cat theme: three 3-frame loops for PC_FRONT_ON_1..3.

The office plays a working laptop's ON frames in turn, 0.2 s each (3 frames,
FURNITURE_ANIM_INTERVAL_SEC), so each game is a loop of three. The screen's
inside is 8x8 (x 4-11, y 9-16) of a 16x32 laptop drawn like
make_cat_room_samples.laptop().

  python make_laptop_games.py <preview dir> [<theme art dir>]

With a theme art dir (webview-ui/src/office/themes/cat) it also writes the
variants PC_FRONT_ON_<1-3>.<game>.png: each working laptop plays one game,
picked by its uid (themeFurniture.ts).

Writes <dir>/laptop_games.png (frames, x8) and <dir>/laptop_games.gif (all
three games side by side, animated at the office's pace).
"""
import os
import sys

from PIL import Image

LAP, LAP_D, LAP_L = (176, 182, 196), (120, 126, 142), (214, 220, 230)
SCREEN_ON = (28, 44, 40)
X0, Y0 = 4, 9            # screen inside, 8x8


def base(screen):
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    for y in range(8, 18):
        for x in range(3, 13):
            edge = x in (3, 12) or y in (8, 17)
            img.putpixel((x, y), (LAP_D if edge else screen) + (255,))
    for x in range(4, 12):
        img.putpixel((x, 8), LAP_L + (255,))
    for y, (x0, x1) in zip(range(18, 22), ((2, 13), (2, 13), (1, 14), (1, 14))):
        for x in range(x0, x1 + 1):
            edge = x in (x0, x1) or y == 21
            img.putpixel((x, y), (LAP_D if edge else (LAP if y < 20 else LAP_L)) + (255,))
    for x in range(4, 12, 2):
        img.putpixel((x, 19), LAP_D + (255,))
    return img


def dot(img, x, y, c):
    """A pixel in screen coordinates (0-7), clipped to the screen."""
    if 0 <= x < 8 and 0 <= y < 8:
        img.putpixel((X0 + x, Y0 + y), c + (255,))


# ---------------------------------------------------------------- blocks
BLOCK = [(240, 90, 90), (90, 170, 240), (240, 200, 80), (120, 210, 120)]


def blocks(f):
    img = base((22, 22, 40))
    floor = {  # the stack: (x, y): colour, with a 2-wide gap at x 3-4 on the bottom row
        **{(x, 7): BLOCK[x % 4] for x in range(8) if x not in (3, 4)},
        **{(x, 6): BLOCK[(x + 1) % 4] for x in (0, 1, 6, 7)},
    }
    for (x, y), c in floor.items():
        dot(img, x, y, c)
    top = (0, 2, 4)[f]          # the falling square drops two rows a frame into the gap
    for dx in (3, 4):
        for dy in (0, 1):
            dot(img, dx, top + dy, BLOCK[2])
    return img


# ---------------------------------------------------------------- invaders
ALIEN, SHIP, SHOT = (150, 230, 120), (120, 190, 250), (250, 240, 160)


def invaders(f):
    img = base((14, 14, 30))
    shift = (0, 1, 0)[f]                     # the row steps right and back
    legs = f == 1
    for ax in (0, 3, 6):
        x = ax + shift
        dot(img, x, 0, ALIEN)
        dot(img, x + 1, 0, ALIEN)
        dot(img, x, 1, ALIEN if not legs else (14, 14, 30))
        dot(img, x + 1, 1, ALIEN if legs else (14, 14, 30))
    ship = (2, 3, 4)[f]
    dot(img, ship + 1, 6, SHIP)
    for dx in range(3):
        dot(img, ship + dx, 7, SHIP)
    shot_y = (5, 3, 1)[f]                    # a shot flying up
    dot(img, 3, shot_y, SHOT)
    if f == 2:                               # ...and the alien it hits flashes
        dot(img, 3, 1, (250, 120, 80))
        dot(img, 4, 2, (250, 120, 80))
    return img


# ---------------------------------------------------------------- fish
WATER, WATER_L = (24, 60, 104), (40, 90, 140)
FISH, FISH_D = (250, 150, 60), (200, 100, 40)
SAND = (200, 170, 110)
WEED = (80, 170, 100)


def fish(f):
    img = base(WATER)
    for x in range(8):
        dot(img, x, 7, SAND)
    for y, x in ((6, 1), (5, 1), (4, 2), (6, 6), (5, 7)):
        dot(img, x if not (f == 1 and y == 4) else x - 1, y, WEED)
    fx, fy = ((1, 2), (3, 3), (5, 2))[f]     # the fish swims right, bobbing
    dot(img, fx, fy, FISH_D)                 # tail
    dot(img, fx + 1, fy, FISH)
    dot(img, fx + 2, fy, FISH)
    dot(img, fx + 1, fy + 1, FISH_D)
    dot(img, fx + 2, fy - 1 if f != 1 else fy + 1, FISH_D)
    dot(img, fx + 3, fy, (20, 20, 20))       # eye/nose end
    for i, (bx, by) in enumerate(((6, 5), (6, 3), (7, 1))):  # a bubble rising
        if i == f:
            dot(img, bx, by, WATER_L)
    return img


GAMES = [("blocks", blocks), ("invaders", invaders), ("fish", fish)]


def side(game, f):
    """The meeting table's laptop (PC_SIDE, lying closed when no one works) opened:
    the deck flat on the table, the lid up at its far end turned a little to the
    viewer, showing the same game. The cat sits on its left (mirrored for the right)."""
    front = game(f)
    img = Image.new("RGBA", (16, 32), (0, 0, 0, 0))
    # deck: a flat slab, keys on top, lit edge at the front
    for y in range(19, 24):
        for x in range(1, 15):
            edge = x in (1, 14) or y in (19, 23)
            c = LAP_D if edge else (LAP_L if y == 22 else LAP)
            img.putpixel((x, y), c + (255,))
    for y in (20, 21):
        for x in range(3, 12, 2):
            img.putpixel((x, y), LAP_D + (255,))
    # lid: the front laptop's screen box, set at the deck's far (right) end
    lid = front.crop((3, 8, 13, 18))
    img.alpha_composite(lid, (5, 9))
    # the lid's thickness on the side towards the cat
    for y in range(10, 19):
        img.putpixel((4, y), LAP_D + (255,))
    return img


def main():
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    s = 8
    sheet = Image.new("RGBA", (16 * 3 * s + 40, len(GAMES) * (20 * s + 4)), (52, 56, 66, 255))
    for gi, (_, game) in enumerate(GAMES):
        for f in range(3):
            fr = game(f).crop((0, 4, 16, 24)).resize((16 * s, 20 * s), Image.NEAREST)
            sheet.alpha_composite(fr, (f * (16 * s + 10), gi * (20 * s + 4)))
    sheet.save(os.path.join(out, "laptop_games.png"))
    s = 10
    frames = []
    for f in range(3):
        im = Image.new("RGB", (len(GAMES) * 16 * s, 20 * s), (52, 56, 66))
        for gi, (_, game) in enumerate(GAMES):
            fr = game(f).crop((0, 4, 16, 24)).resize((16 * s, 20 * s), Image.NEAREST)
            im.paste(fr, (gi * 16 * s, 0), fr)
        frames.append(im)
    frames[0].save(os.path.join(out, "laptop_games.gif"), save_all=True, append_images=frames[1:],
                   duration=200, loop=0)
    if len(sys.argv) > 2:   # the theme art dir: PC_FRONT_ON_<n>.<game>.png, one variant per game
        theme = sys.argv[2]
        for name, game in GAMES:
            for f in range(3):
                game(f).save(os.path.join(theme, f"PC_FRONT_ON_{f + 1}.{name}.png"))
                side(game, f).save(os.path.join(theme, f"PC_SIDE_ON_{f + 1}.{name}.png"))
        print("wrote", len(GAMES) * 6, "variants to", theme)
    frames = []
    for f in range(3):
        im = Image.new("RGB", (len(GAMES) * 16 * 10, 20 * 10), (150, 110, 70))
        for gi, (_, game) in enumerate(GAMES):
            fr = side(game, f).crop((0, 6, 16, 26)).resize((160, 200), Image.NEAREST)
            im.paste(fr, (gi * 160, 0), fr)
        frames.append(im)
    frames[0].save(os.path.join(out, "laptop_side_games.gif"), save_all=True, append_images=frames[1:],
                   duration=200, loop=0)
    print("wrote", out)


if __name__ == "__main__":
    main()
