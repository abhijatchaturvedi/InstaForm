"""
Generate PNG icons for InstaForm from icon.svg.
Requires: pip install cairosvg
Run: python tools/create_icons.py
"""
import os, sys

try:
    import cairosvg
except ImportError:
    sys.exit("Install cairosvg first:  pip install cairosvg")

SIZES  = [16, 32, 48, 128]
SVG    = os.path.join(os.path.dirname(__file__), '..', 'icons', 'icon.svg')
OUTDIR = os.path.join(os.path.dirname(__file__), '..', 'icons')

for size in SIZES:
    out = os.path.join(OUTDIR, f'icon{size}.png')
    cairosvg.svg2png(url=SVG, write_to=out, output_width=size, output_height=size)
    print(f'  ✓  {out}')

print("Done.")
