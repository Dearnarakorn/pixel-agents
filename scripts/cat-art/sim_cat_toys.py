"""Try the Cat theme's floor-toy placement rule on the real layout (no build).

    python sim_cat_toys.py <fork root> [gap] [every]

Prints the office as text: # wall, . floor, F furniture, T a toy.
"""
import glob
import json
import os
import sys

FORK = sys.argv[1]
GAP = int(sys.argv[2]) if len(sys.argv) > 2 else 1
EVERY = int(sys.argv[3]) if len(sys.argv) > 3 else 3

foot = {}


def walk(node, w=None, h=None, bg=0):
    w = node.get("footprintW", w)
    h = node.get("footprintH", h)
    bg = node.get("backgroundTiles", bg)
    if node.get("type") == "asset":
        foot[node["id"]] = (w, h, bg)
    for m in node.get("members", []):
        walk(m, w, h, bg)


roots = [os.path.join(FORK, "webview-ui", "public", "assets", "furniture"),
         os.path.expanduser("~/.pixel-agents/custom-assets/assets/furniture")]
for root in roots:
    for p in glob.glob(os.path.join(root, "*", "manifest.json")):
        walk(json.load(open(p, encoding="utf-8")))

L = json.load(open(os.path.expanduser("~/.pixel-agents/layout.json"), encoding="utf-8"))
C, R, T = L["cols"], L["rows"], L["tiles"]
occupied = set()   # every footprint tile (background rows too: nothing on top of furniture)
for f in L["furniture"]:
    w, h, bg = foot.get(f["type"].split(":")[0], (1, 1, 0))
    for dr in range(h):
        for dc in range(w):
            occupied.add((f["col"] + dc, f["row"] + dr))

floor = lambda c, r: 0 <= c < C and 0 <= r < R and T[r * C + c] not in (0, 255)


def h32(c, r):
    x = (c * 73856093) ^ (r * 19349663)
    return (x ^ (x >> 13)) & 0xFFFFFFFF


ANCHORS = ("SOFA_FRONT", "SOFA_BACK", "SOFA_SIDE", "COFFEE_TABLE", "PLANT_2", "LARGE_PLANT")
toys = []
for f in sorted(L["furniture"], key=lambda f: (f["row"], f["col"])):
    base = f["type"].split(":")[0]
    if base not in ANCHORS:
        continue
    w, h, _ = foot.get(base, (1, 1, 0))
    cands = []
    for r in range(f["row"] - 2, f["row"] + h + 2):
        for c in range(f["col"] - 2, f["col"] + w + 2):
            if not floor(c, r) or (c, r) in occupied:
                continue
            if any(abs(c - tc) <= GAP and abs(r - tr) <= GAP for tc, tr in toys):
                continue
            cands.append((h32(c, r), c, r))
    if cands:
        _, c, r = min(cands)
        toys.append((c, r))

for r in range(R):
    print("%2d " % r + "".join(
        "T" if (c, r) in toys else "F" if (c, r) in occupied else "." if floor(c, r) else
        "#" if T[r * C + c] == 0 else " " for c in range(C)))
print(len(toys), "toys")
