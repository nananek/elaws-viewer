#!/usr/bin/env python3
"""Sample color along the highlight line and segment by color transitions."""
from PIL import Image
import numpy as np
from pathlib import Path

img = Image.open(Path(__file__).parent / 'IMG_1817.jpg').convert('RGB')
arr = np.array(img)
H, W, _ = arr.shape
print(f'image {W}x{H}')

# Sample bands. Tighter ranges to avoid text strokes.
# Marker fill is visible at top & bottom of text glyph -- pick a row well above baseline.
MARKER_Y_RANGE = list(range(218, 226))   # top edge of marker fill, above glyph centers
UNDERLINE_Y_RANGE = list(range(251, 255))  # the underline strip

def is_text(r,g,b):
    return r < 90 and g < 90 and b < 90

def col_avg(x, ys):
    pxs = []
    for y in ys:
        r,g,b = arr[y,x]
        if is_text(r,g,b): continue
        pxs.append((int(r),int(g),int(b)))
    if not pxs: return None
    return (sum(p[0] for p in pxs)//len(pxs),
            sum(p[1] for p in pxs)//len(pxs),
            sum(p[2] for p in pxs)//len(pxs))

# print per-column color for both bands
def col_to_str(rgb):
    if rgb is None: return '----'
    return f'#{rgb[0]:02x}{rgb[1]:02x}{rgb[2]:02x}'

# Find color transitions along x using lightness/hue change
def colour_diff(a, b):
    if a is None or b is None: return 999
    return abs(a[0]-b[0]) + abs(a[1]-b[1]) + abs(a[2]-b[2])

def scan_band(ys, band_name):
    print(f'\n=== {band_name} band y={ys[0]}..{ys[-1]} ===')
    samples = []
    for x in range(80, 580):
        c = col_avg(x, ys)
        samples.append((x, c))
    # group by color: when colour_diff > threshold, start new group
    groups = []  # list of (x0,x1,avg_color)
    cur = []
    cur_avg = None
    THRESH = 40
    for x, c in samples:
        if c is None:
            if cur:
                groups.append((cur[0][0], cur[-1][0], cur_avg))
                cur = []; cur_avg = None
            continue
        if cur_avg is None or colour_diff(c, cur_avg) <= THRESH:
            cur.append((x,c))
            r = sum(p[1][0] for p in cur)//len(cur)
            g = sum(p[1][1] for p in cur)//len(cur)
            b = sum(p[1][2] for p in cur)//len(cur)
            cur_avg = (r,g,b)
        else:
            groups.append((cur[0][0], cur[-1][0], cur_avg))
            cur = [(x,c)]; cur_avg = c
    if cur:
        groups.append((cur[0][0], cur[-1][0], cur_avg))
    # report groups wider than 8px
    for x0,x1,c in groups:
        if x1-x0 >= 7:
            print(f'  x={x0:>3}..{x1:>3}  width={x1-x0+1:>3}  rgb={col_to_str(c)}  ({c})')

scan_band(MARKER_Y_RANGE, 'marker')
scan_band(UNDERLINE_Y_RANGE, 'underline')
