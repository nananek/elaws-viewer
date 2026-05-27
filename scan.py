#!/usr/bin/env python3
"""Scan IMG_1817.jpg horizontally to extract marker/underline colors per character position."""
from PIL import Image
import numpy as np
from pathlib import Path

img = Image.open(Path(__file__).parent / 'IMG_1817.jpg').convert('RGB')
arr = np.array(img)
H, W, _ = arr.shape
print(f'image {W}x{H}')

# Find the rows that aren't paper-color (paper looks beige ~ (250,247,232))
# A marker row will have many non-paper pixels.
def is_paper(px):
    r,g,b = px
    return r > 235 and g > 230 and b > 215 and abs(int(r)-int(g)) < 25 and abs(int(g)-int(b)) < 35

# Count colored pixels per row
row_colored = []
for y in range(H):
    cnt = 0
    for x in range(W):
        if not is_paper(arr[y,x]):
            r,g,b = arr[y,x]
            # ignore near-black text
            if not (r < 80 and g < 80 and b < 80):
                cnt += 1
    row_colored.append(cnt)

# Print top rows by colored-pixel count
top = sorted(range(H), key=lambda y: -row_colored[y])[:20]
print('rows with most non-paper / non-text pixels:')
for y in top:
    print(f'  y={y}  count={row_colored[y]}')
