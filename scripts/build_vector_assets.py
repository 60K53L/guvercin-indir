from PIL import Image, ImageDraw, ImageFilter
import numpy as np
import potrace
from collections import deque

def build():
    img_path = r'C:\Users\GXL\.gemini\antigravity\brain\ae73ce2e-d457-41ef-81a0-883bda56ddd5\.user_uploaded\media_1792267950463_6cba24c4.png'
    im = Image.open(img_path).convert('RGB')
    arr = np.array(im)
    h, w, _ = arr.shape

    # 1. Body mask with BFS flood fill
    bg = np.zeros((h, w), dtype=bool)
    q = deque([(0, 0), (0, w-1), (h-1, 0), (h-1, w-1)])
    for y, x in q: bg[y, x] = True
    while q:
        cy, cx = q.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not bg[ny, nx]:
                if arr[ny, nx, 0] > 248 and arr[ny, nx, 1] > 248 and arr[ny, nx, 2] > 248:
                    bg[ny, nx] = True
                    q.append((ny, nx))

    is_bird = ~bg
    mask_img = Image.fromarray((is_bird * 255).astype(np.uint8))
    smoothed = mask_img.filter(ImageFilter.GaussianBlur(radius=1.0))
    bmp = potrace.Bitmap(np.array(smoothed) > 128)
    path = bmp.trace(turdsize=10, alphamax=1.1, opttolerance=0.2)
    bird_curve = [c for c in path if min(s.end_point.x for s in c) > 10][0]

    # 2. Wing mask: filter curves where min_x > 10 and max_x < 690
    gray = np.mean(arr, axis=2)
    wing_mask = is_bird & (gray < 85) & (np.arange(w)[None, :] > 325)
    wing_smooth = Image.fromarray((wing_mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=1.8))
    bmp_w = potrace.Bitmap(np.array(wing_smooth) > 128)
    path_w = bmp_w.trace(turdsize=30, alphamax=1.1)
    
    valid_wings = [c for c in path_w if min(s.end_point.x for s in c) > 10]
    wing_curve = sorted(valid_wings, key=lambda c: max(s.end_point.x for s in c) - min(s.end_point.x for s in c), reverse=True)[0]

    # 3. Bib mask: filter curves where min_x > 10
    bib_mask = is_bird & (gray > 175) & (arr[:, :, 0] > 160) & (np.arange(w)[None, :] < 420)
    bib_smooth = Image.fromarray((bib_mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius=1.5))
    bmp_b = potrace.Bitmap(np.array(bib_smooth) > 128)
    path_b = bmp_b.trace(turdsize=20, alphamax=1.1)
    valid_bibs = [c for c in path_b if min(s.end_point.x for s in c) > 10]
    bib_curve = sorted(valid_bibs, key=lambda c: (max(s.end_point.x for s in c) - min(s.end_point.x for s in c)) * (max(s.end_point.y for s in c) - min(s.end_point.y for s in c)), reverse=True)[0]

    # Bounding box of bird
    xs = [seg.end_point.x for seg in bird_curve] + [bird_curve.start_point.x]
    ys = [seg.end_point.y for seg in bird_curve] + [bird_curve.start_point.y]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    bw = max_x - min_x
    bh = max_y - min_y

    pad = 5.0
    scale = (100.0 - 2 * pad) / max(bw, bh)
    offset_x = (100.0 - bw * scale) / 2.0
    offset_y = (100.0 - bh * scale) / 2.0

    def tx(x): return (x - min_x) * scale + offset_x
    def ty(y): return (y - min_y) * scale + offset_y

    def curve_to_svg(c):
        segs = [f"M {tx(c.start_point.x):.2f} {ty(c.start_point.y):.2f}"]
        for seg in c:
            if seg.is_corner:
                segs.append(f"L {tx(seg.c.x):.2f} {ty(seg.c.y):.2f} L {tx(seg.end_point.x):.2f} {ty(seg.end_point.y):.2f}")
            else:
                segs.append(f"C {tx(seg.c1.x):.2f} {ty(seg.c1.y):.2f} {tx(seg.c2.x):.2f} {ty(seg.c2.y):.2f} {tx(seg.end_point.x):.2f} {ty(seg.end_point.y):.2f}")
        segs.append("Z")
        return " ".join(segs)

    body_d = curve_to_svg(bird_curve)
    wing_d = curve_to_svg(wing_curve)
    bib_d = curve_to_svg(bib_curve)
    eye_cx = tx(356)
    eye_cy = ty(43)
    beak_cx = tx(310)
    beak_cy = ty(56)

    print("Curve normalization complete!")

    # Export JS module
    js_code = f'''// Vektörel güvercin koordinatları (Kullanıcının paylaştığı paçalı kostüm güvercini referansından üretildi)
export const PIGEON_BODY_D = "{body_d}"
export const PIGEON_WING_D = "{wing_d}"
export const PIGEON_BIB_D = "{bib_d}"
export const PIGEON_EYE = {{ cx: {eye_cx:.2f}, cy: {eye_cy:.2f}, r: 1.85, pupilR: 0.95 }}
export const PIGEON_BEAK = {{ cx: {beak_cx:.2f}, cy: {beak_cy:.2f} }}
'''
    with open('src/components/pigeonVectorPath.js', 'w', encoding='utf-8') as f:
        f.write(js_code)
    print("Wrote src/components/pigeonVectorPath.js")

    breeds = [
        {
            'file': 'cakal.svg',
            'body': '#8a5a34',
            'wing': '#6e4424',
            'bib': None,
            'outline': 'rgba(0,0,0,0.35)',
            'eye_outer': '#ffffff',
            'eye_pupil': '#1e2430'
        },
        {
            'file': 'limoni.svg',
            'body': '#facc15',
            'wing': '#ca8a04',
            'bib': None,
            'outline': 'rgba(0,0,0,0.25)',
            'eye_outer': '#ffffff',
            'eye_pupil': '#1e2430'
        },
        {
            'file': 'kirmizi_komple.svg',
            'body': '#8a5a34',
            'wing': '#6e4424',
            'bib': '#f8fafc',  # Komple önlük
            'outline': 'rgba(0,0,0,0.3)',
            'eye_outer': '#ffffff',
            'eye_pupil': '#1e2430'
        },
        {
            'file': 'beyaz.svg',
            'body': '#f8fafc',
            'wing': '#e2e8f0',
            'bib': None,
            'outline': '#94a3b8',
            'eye_outer': '#334155',
            'eye_pupil': '#0f172a'
        }
    ]

    for b in breeds:
        bib_el = f'<path d="{bib_d}" fill="{b["bib"]}" opacity="0.95" />' if b['bib'] else ''
        svg_text = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <g id="pigeon">
    <!-- Gövde (Paçalı kostüm güvercini silueti) -->
    <path d="{body_d}" fill="{b['body']}" stroke="{b['outline']}" stroke-width="0.8" />
    <!-- Kanat -->
    <path d="{wing_d}" fill="{b['wing']}" opacity="0.85" />
    <!-- Önlük / Bib (Varsa) -->
    {bib_el}
    <!-- Göz -->
    <circle cx="{eye_cx:.2f}" cy="{eye_cy:.2f}" r="1.85" fill="{b['eye_outer']}" stroke="#334155" stroke-width="0.4" />
    <circle cx="{eye_cx:.2f}" cy="{eye_cy:.2f}" r="0.95" fill="{b['eye_pupil']}" />
  </g>
</svg>'''
        with open(f'public/breeds/{b["file"]}', 'w', encoding='utf-8') as f:
            f.write(svg_text)

    # Render a clean 4-card preview image
    preview = Image.new('RGB', (800, 220), (24, 29, 39))
    draw = ImageDraw.Draw(preview)
    
    for idx, b in enumerate(breeds):
        ox = idx * 200 + 10
        oy = 10
        draw.rounded_rectangle([ox, oy, ox + 180, oy + 200], radius=12, fill=(30, 36, 48), outline=(51, 65, 85))
        
        s = 1.5
        def ptx(x): return ox + 15 + tx(x) * s
        def pty(y): return oy + 15 + ty(y) * s
        
        def curve_to_pts(c):
            pts = [(ptx(c.start_point.x), pty(c.start_point.y))]
            for seg in c:
                if seg.is_corner:
                    pts.extend([(ptx(seg.c.x), pty(seg.c.y)), (ptx(seg.end_point.x), pty(seg.end_point.y))])
                else:
                    c1, c2, end = seg.c1, seg.c2, seg.end_point
                    p0 = pts[-1]
                    for t in np.linspace(0.1, 1.0, 10):
                        x = (1-t)**3 * p0[0] + 3*(1-t)**2*t * ptx(c1.x) + 3*(1-t)*t**2 * ptx(c2.x) + t**3 * ptx(end.x)
                        y = (1-t)**3 * p0[1] + 3*(1-t)**2*t * pty(c1.y) + 3*(1-t)*t**2 * pty(c2.y) + t**3 * pty(end.y)
                        pts.append((x, y))
            return pts
            
        def h2rgb(h):
            h = h.lstrip('#')
            return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
            
        draw.polygon(curve_to_pts(bird_curve), fill=h2rgb(b['body']))
        draw.polygon(curve_to_pts(wing_curve), fill=h2rgb(b['wing']))
        if b['bib']:
            draw.polygon(curve_to_pts(bib_curve), fill=h2rgb(b['bib']))
            
        ecx = ox + 15 + eye_cx * s
        ecy = oy + 15 + eye_cy * s
        draw.ellipse([ecx - 3, ecy - 3, ecx + 3, ecy + 3], fill=h2rgb(b['eye_outer']))
        draw.ellipse([ecx - 1.5, ecy - 1.5, ecx + 1.5, ecy + 1.5], fill=h2rgb(b['eye_pupil']))
        
        names = ['ÇAKAL', 'LİMONİ', 'KIRMIZI KOMPLE', 'BEYAZ']
        draw.text((ox + 90, oy + 178), names[idx], fill=(226, 232, 240), anchor="mm")

    preview.save('preview_4_breeds_vector.png')
    print("Saved preview_4_breeds_vector.png successfully!")

if __name__ == '__main__':
    build()
