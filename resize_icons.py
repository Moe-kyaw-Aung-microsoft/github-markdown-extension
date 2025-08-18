"""
This script resizes icon128.png and icon128-dark.png to 48x48, 32x32, and 16x16 pixels.
Requires: Pillow
Install with: pip install pillow
"""
import os
from PIL import Image

# Directory containing the icons
ICON_DIR = os.path.join(os.path.dirname(__file__), 'src/icons')

# Source icon filenames
ICONS = [
    ('icon128.png', ''),
    ('icon128-dark.png', '-dark'),
]

# Target sizes
SIZES = [48, 32, 16]

for src_name, suffix in ICONS:
    src_path = os.path.join(ICON_DIR, src_name)
    if not os.path.exists(src_path):
        print(f"Source icon not found: {src_path}")
        continue
    with Image.open(src_path) as img:
        for size in SIZES:
            resized = img.resize((size, size), Image.LANCZOS)
            out_name = f"icon{size}{suffix}.png"
            out_path = os.path.join(ICON_DIR, out_name)
            resized.save(out_path, format='PNG')
            print(f"Saved {out_path}")
