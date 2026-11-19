# Cat theme art

Python scripts (Pillow) that draw the Cat theme's pixel art. The PNGs they make
are committed; run a script again only to change the art. Each script's
docstring says what it draws and how to call it.

| Script | Makes | Writes to |
| --- | --- | --- |
| `make_pet_cat_sheets.py` | the cat agents: 8 coats, eyes open + `.blink`, 10 frames per row (walk, type, read, seated, sleep) | `webview-ui/src/characters/cats/` |
| `make_cat_poses.py` | experimental idle poses (groom, stretch, bat) from the pet cat's side walk; preview only | beside the preview |
| `make_cat_furniture.py` | cat versions of paintings, plants, bin, pot (`<TYPE>.png`) | `webview-ui/src/office/themes/cat/` |
| `make_cat_room_samples.py` | room furniture (donut beds, box desks, cat house, climbing wall, cushions, ...) and a mock scene | out dir given; copy the pieces wanted into `webview-ui/src/office/themes/cat/` |
| `make_laptop_games.py` | laptop screen games (`PC_FRONT_ON_n`, `PC_SIDE_ON_n`) | theme dir given |
| `make_cat_toys.py` | floor toys (`TOY.<kind>.png`) | theme dir given |
| `make_cat_floors.py` | floor patterns (`FLOOR_<n>.png`) | theme dir given |
| `make_cat_carpet.py` | paw-print carpet inside (`CARPET_0_15.png`) | theme dir given |
| `sim_cat_toys.py` | where the toys land on the current layout (check only) | prints |

Scripts that read the layout or the custom bed assets use `~/.pixel-agents/`.

```bash
pip install pillow
python scripts/cat-art/make_pet_cat_sheets.py --preview cats.png
```
