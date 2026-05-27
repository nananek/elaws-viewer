#!/usr/bin/env python3
from PIL import Image
import numpy as np
from pathlib import Path

img = Image.open(Path(__file__).parent / 'IMG_1817.jpg').convert('RGB')
arr = np.array(img)
H, W, _ = arr.shape

def is_paper(r,g,b):
    return r > 235 and g > 230 and b > 215 and abs(int(r)-int(g)) < 25 and abs(int(g)-int(b)) < 35

def is_text(r,g,b):
    return r < 90 and g < 90 and b < 90

# === MARKER BAND ===
# Marker fills span both the character body and behind it.
# Pick y where the row is "mostly colored" (not paper, not text).
# From previous scan, marker text rows = 220-247, underline at 251-254
MARKER_Y = (220, 245)   # band where marker FILL is visible behind characters
UNDERLINE_Y = (250, 256)

def avg_color_in_col(x, y0, y1):
    """Average non-paper, non-text pixels in column x within y0..y1"""
    pxs = []
    for y in range(y0, y1+1):
        r,g,b = arr[y,x]
        if is_paper(r,g,b): continue
        if is_text(r,g,b): continue
        pxs.append((int(r),int(g),int(b)))
    if not pxs: return None
    rs = [p[0] for p in pxs]; gs = [p[1] for p in pxs]; bs = [p[2] for p in pxs]
    return (sum(rs)//len(rs), sum(gs)//len(gs), sum(bs)//len(bs)), len(pxs)

# Scan marker band column-by-column, average color
print('# Marker band column scan (y=%d..%d)' % MARKER_Y)
buckets = []  # list of (x_start, x_end, avg_rgb)
in_run = False
cur_pixels = []
run_start = None
for x in range(W):
    r = avg_color_in_col(x, *MARKER_Y)
    if r is None:
        if in_run and len(cur_pixels) > 0:
            r0 = sum(p[0] for p in cur_pixels)//len(cur_pixels)
            g0 = sum(p[1] for p in cur_pixels)//len(cur_pixels)
            b0 = sum(p[2] for p in cur_pixels)//len(cur_pixels)
            buckets.append((run_start, x-1, (r0,g0,b0), len(cur_pixels)))
            cur_pixels = []
        in_run = False
    else:
        rgb, cnt = r
        if not in_run:
            run_start = x
            in_run = True
        cur_pixels.append(rgb)
if in_run and cur_pixels:
    r0 = sum(p[0] for p in cur_pixels)//len(cur_pixels)
    g0 = sum(p[1] for p in cur_pixels)//len(cur_pixels)
    b0 = sum(p[2] for p in cur_pixels)//len(cur_pixels)
    buckets.append((run_start, W-1, (r0,g0,b0), len(cur_pixels)))

# print only buckets with width >= 5 (real fills)
print('Marker fill runs:')
for x0,x1,rgb,n in buckets:
    if x1-x0 < 4: continue
    print(f'  x={x0:>3}..{x1:>3} ({x1-x0+1:>3} wide)  rgb={rgb}  n={n}')

print('\n# Underline band column scan (y=%d..%d)' % UNDERLINE_Y)
buckets2 = []
in_run = False
cur_pixels = []
run_start = None
for x in range(W):
    r = avg_color_in_col(x, *UNDERLINE_Y)
    if r is None:
        if in_run and len(cur_pixels) > 0:
            r0 = sum(p[0] for p in cur_pixels)//len(cur_pixels)
            g0 = sum(p[1] for p in cur_pixels)//len(cur_pixels)
            b0 = sum(p[2] for p in cur_pixels)//len(cur_pixels)
            buckets2.append((run_start, x-1, (r0,g0,b0), len(cur_pixels)))
            cur_pixels = []
        in_run = False
    else:
        rgb, cnt = r
        if not in_run:
            run_start = x
            in_run = True
        cur_pixels.append(rgb)
if in_run and cur_pixels:
    r0 = sum(p[0] for p in cur_pixels)//len(cur_pixels)
    g0 = sum(p[1] for p in cur_pixels)//len(cur_pixels)
    b0 = sum(p[2] for p in cur_pixels)//len(cur_pixels)
    buckets2.append((run_start, W-1, (r0,g0,b0), len(cur_pixels)))

print('Underline runs:')
for x0,x1,rgb,n in buckets2:
    if x1-x0 < 4: continue
    print(f'  x={x0:>3}..{x1:>3} ({x1-x0+1:>3} wide)  rgb={rgb}  n={n}')
