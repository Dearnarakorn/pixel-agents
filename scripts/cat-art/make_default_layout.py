"""Bundled default layout for Pixel Cat Agents, from this office's own layout.

Keeps rooms, furniture, floors and carpets; keeps only the Areas whose names
the app itself relies on or that are generic (Bedroom, Cafe) and drops the
rest (project/team names). Revision stays 1 so existing users' own layouts
(revision 1) are never reset by the bundled one.

    python make_default_layout.py <out.json>
"""
import collections
import json
import os
import sys

KEEP = {"Bedroom", "Cafe"}

L = json.load(open(os.path.expanduser("~/.pixel-agents/layout.json"), encoding="utf-8"))
areas = L.get("areas", [])
print("areas", [a["label"] for a in areas])
print("areaTiles values", collections.Counter(v for v in L.get("areaTiles", []) if v is not None))

kept = [a for a in areas if a["label"] in KEEP]
remap = {}
for i, a in enumerate(areas):
    if a["label"] in KEEP:
        remap[i] = kept.index(a)
# areaTiles may hold indexes or labels; handle both
tiles = []
for v in L.get("areaTiles", []):
    if v is None:
        tiles.append(None)
    elif isinstance(v, int):
        tiles.append(remap.get(v))
    elif isinstance(v, str):
        tiles.append(v if v in KEEP else None)
    else:
        raise SystemExit(f"unknown areaTiles value {v!r}")

out = dict(L)
out["areas"] = kept
out["areaTiles"] = tiles
out["pets"] = []
out["layoutRevision"] = 1
text = json.dumps(out, ensure_ascii=False, indent=2)
for word in ("Yield", "LULC", "Precision", "Boss", "Secretary", "Library", "Engineer", "Analyst", "Mitr", "cane"):
    if word.lower() in text.lower():
        print("WARNING still contains", word)
open(sys.argv[1], "w", encoding="utf-8").write(text + "\n")
print("wrote", sys.argv[1], "areas", [a["label"] for a in kept], "furniture", len(out["furniture"]))
