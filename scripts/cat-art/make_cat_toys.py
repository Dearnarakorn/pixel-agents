"""Cat theme floor toys (layout/catToys.ts): 16x16 sprites lying flat on a tile.

    python make_cat_toys.py <preview dir> [<theme art dir>]

Writes <preview>/cat_toys.png (x8 on a wood floor) and, with a theme art dir
(webview-ui/src/office/themes/cat), TOY.<kind>.png for each toy.
"""
import os
import sys

from PIL import Image

OUT = (43, 29, 20)


def draw(rows, colours):
    img = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    top = 16 - len(rows)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if ch in colours:
                img.putpixel((x, top + y), colours[ch] + (255,))
    return img


SHADOW = (0, 0, 0)


def with_shadow(img, w0, w1, y):
    """A soft shadow line under a toy (semi-transparent)."""
    out = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for x in range(w0, w1 + 1):
        out.putpixel((x, y), (0, 0, 0, 60))
    out.alpha_composite(img)
    return out


TOYS = {
    "yarn": with_shadow(draw([
        "................",
        "......aaaa......",
        ".....abcbba.....",
        "....abbcbcba....",
        "....acbbcbba....",
        "....abcbbcba....",
        ".....abcbba.....",
        "......aaaab.....",
        "..........bb....",
        "...........bbb..",
    ], {"a": OUT, "b": (220, 70, 80), "c": (250, 140, 140)}), 4, 10, 13),
    "mouse": with_shadow(draw([
        "................",
        ".......aa.......",
        "......acda......",
        "..aaaaaccca.....",
        ".abbbbbbbbba....",
        "abbbbbbbbbbea...",
        ".abbbbbbbbba....",
        "..aaaaaaaaa.....",
        "..f.............",
        "...ff...........",
    ], {"a": OUT, "b": (160, 160, 170), "c": (190, 190, 200), "d": (240, 150, 170),
        "e": (240, 120, 150), "f": (200, 120, 130)}), 1, 11, 14),
    "mat": draw([
        "aaaaaaaaaaaaaa..",
        "abcbcbcbcbcbca..",
        "acbcbcbcbcbcba..",
        "abcbcbcbcbcbca..",
        "acbcbcbcbcbcba..",
        "aaaaaaaaaaaaaa..",
    ], {"a": (120, 80, 50), "b": (210, 170, 110), "c": (180, 140, 90)}),
    "ball": with_shadow(draw([
        "................",
        ".....aaaa.......",
        "....abbcba......",
        "....abddba......",
        "....acbbba......",
        ".....aaaa.......",
        "................",
    ], {"a": OUT, "b": (90, 170, 240), "c": (200, 230, 250), "d": (250, 210, 80)}), 4, 9, 15),
    "feather": draw([
        "............ab..",
        "...........abcb.",
        "..........abcba.",
        ".........abcba..",
        "........dbba....",
        ".......d........",
        "......d.........",
        ".....d..........",
        "....d...........",
        "...d............",
    ], {"a": OUT, "b": (110, 200, 190), "c": (190, 240, 230), "d": (150, 110, 70)}),
}


def main():
    prev = sys.argv[1]
    os.makedirs(prev, exist_ok=True)
    s = 8
    sheet = Image.new("RGBA", (len(TOYS) * 16 * s, 16 * s), (150, 100, 60, 255))
    for i, img in enumerate(TOYS.values()):
        sheet.alpha_composite(img.resize((16 * s, 16 * s), Image.NEAREST), (i * 16 * s, 0))
    sheet.save(os.path.join(prev, "cat_toys.png"))
    if len(sys.argv) > 2:
        for name, img in TOYS.items():
            img.save(os.path.join(sys.argv[2], f"TOY.{name}.png"))
        print("wrote", len(TOYS), "toys to", sys.argv[2])
    print("preview", prev)


if __name__ == "__main__":
    main()
