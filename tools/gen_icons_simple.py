"""
Generate PNG icons with no external dependencies.
Draws the InstaForm lightning-bolt logo using raw PNG output.
Run: python tools/gen_icons_simple.py
"""
import struct, zlib, os, math

OUTDIR = os.path.join(os.path.dirname(__file__), '..', 'icons')
SIZES  = [16, 32, 48, 128]

# Palette
BG_DARK  = (13,  13,  26,  255)   # #0d0d1a
BG_LIGHT = (30,  30,  56,  255)   # #1e1e38
VIOLET   = (79,  70,  229, 255)   # #4f46e5
LAVENDER = (129, 140, 248, 255)   # #818cf8
BORDER   = (42,  42,  74,  255)   # #2a2a4a

def lerp(a, b, t):
    return a + (b - a) * t

def lerp_color(c1, c2, t):
    return tuple(round(lerp(c1[i], c2[i], t)) for i in range(4))

def make_png(size):
    pixels = [list(BG_DARK) for _ in range(size * size)]

    def px(x, y):
        if 0 <= x < size and 0 <= y < size:
            return y * size + x
        return None

    def set_px(x, y, color):
        i = px(x, y)
        if i is not None:
            pixels[i] = list(color)

    # Draw rounded-square background with gradient + border
    cx, cy, r = size / 2, size / 2, size * 0.22  # corner radius fraction
    for y in range(size):
        for x in range(size):
            # Corner rounding via distance to nearest corner
            dx = max(abs(x - cx) - (size / 2 - r - 0.5), 0)
            dy = max(abs(y - cy) - (size / 2 - r - 0.5), 0)
            dist_corner = math.sqrt(dx * dx + dy * dy)

            on_bg = dist_corner <= r
            on_border = dist_corner <= r + 1.2

            if on_bg:
                t = (x + y) / (size * 2)
                c = lerp_color(BG_LIGHT, BG_DARK, t)
                set_px(x, y, c)
            elif on_border:
                set_px(x, y, BORDER)

    # Lightning bolt vertices (normalised 0-1 relative to bolt bounding box)
    # Top point → right bulge → center left → bottom point → left bulge → center right
    # Defined in normalised coords (0-1), mapped to icon
    pad = size * 0.18
    w_b = size - 2 * pad   # bolt bounding box width
    h_b = size - 2 * pad   # bolt bounding box height

    # Bolt polygon in normalised [0,1] coords
    bolt_norm = [
        (0.56, 0.0 ),  # tip top-right
        (0.22, 0.48),  # mid-right notch
        (0.50, 0.48),  # mid-right inner
        (0.44, 1.0 ),  # tip bottom-left
        (0.78, 0.52),  # mid-left notch
        (0.50, 0.52),  # mid-left inner
    ]

    bolt = [(pad + nx * w_b, pad + ny * h_b) for nx, ny in bolt_norm]

    # Rasterise polygon using scanline fill
    min_y = int(min(v[1] for v in bolt))
    max_y = int(max(v[1] for v in bolt)) + 1

    for y in range(min_y, min(max_y + 1, size)):
        intersections = []
        n = len(bolt)
        for i in range(n):
            x1, y1 = bolt[i]
            x2, y2 = bolt[(i + 1) % n]
            if (y1 <= y < y2) or (y2 <= y < y1):
                if y2 != y1:
                    xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
                    intersections.append(xi)
        intersections.sort()
        for k in range(0, len(intersections) - 1, 2):
            x_start = int(math.ceil(intersections[k]))
            x_end   = int(math.floor(intersections[k + 1]))
            for x in range(x_start, x_end + 1):
                # Gradient: top = LAVENDER, bottom = VIOLET
                t = (y - min_y) / max(max_y - min_y, 1)
                c = lerp_color(LAVENDER, VIOLET, t)
                set_px(x, y, c)

    # Build PNG bytes
    raw = b''
    for y in range(size):
        raw += b'\x00'  # filter = None
        for x in range(size):
            raw += bytes(pixels[y * size + x])

    def chunk(name, data):
        crc_data = name + data
        return (struct.pack('>I', len(data)) + crc_data +
                struct.pack('>I', zlib.crc32(crc_data) & 0xffffffff))

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    sig  = b'\x89PNG\r\n\x1a\n'
    return sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


os.makedirs(OUTDIR, exist_ok=True)
for size in SIZES:
    data = make_png(size)
    path = os.path.join(OUTDIR, f'icon{size}.png')
    with open(path, 'wb') as f:
        f.write(data)
    print(f'  OK  icon{size}.png  ({len(data)} bytes)')

print('Done.')
