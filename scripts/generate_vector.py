import potrace
import numpy as np
from PIL import Image, ImageDraw

def generate_clean_vector():
    img_path = r'C:\Users\GXL\.gemini\antigravity\brain\ae73ce2e-d457-41ef-81a0-883bda56ddd5\.user_uploaded\media_1792267950463_6cba24c4.png'
    im = Image.open(img_path).convert('RGB')
    arr = np.array(im)
    
    # Background threshold
    is_bird = ~((arr[:, :, 0] > 240) & (arr[:, :, 1] > 240) & (arr[:, :, 2] > 240))
    
    # Trace outer bird contour
    bmp = potrace.Bitmap(is_bird)
    # turdsize=6 removes small noise, alphamax=1.0 gives smooth curves
    path = bmp.trace(turdsize=6, alphamax=1.0)
    
    # Filter out curve 0 (the full image bounding box)
    bird_curve = None
    for curve in path:
        xs = [seg.end_point.x for seg in curve]
        ys = [seg.end_point.y for seg in curve]
        if min(xs) > 10 and max(xs) < 690:
            bird_curve = curve
            break
            
    if not bird_curve:
        print("Error: Bird curve not found!")
        return
        
    xs = [seg.end_point.x for seg in bird_curve] + [bird_curve.start_point.x]
    ys = [seg.end_point.y for seg in bird_curve] + [bird_curve.start_point.y]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    bw = max_x - min_x
    bh = max_y - min_y
    print(f"Bird size: {bw:.1f} x {bh:.1f}")
    
    # Normalize to 0 0 100 100 with padding
    pad = 5.0
    scale = (100.0 - 2 * pad) / max(bw, bh)
    offset_x = (100.0 - bw * scale) / 2.0
    offset_y = (100.0 - bh * scale) / 2.0
    
    def tx(x): return (x - min_x) * scale + offset_x
    def ty(y): return (y - min_y) * scale + offset_y
    
    segments = []
    start = bird_curve.start_point
    segments.append(f"M {tx(start.x):.2f} {ty(start.y):.2f}")
    for seg in bird_curve:
        if seg.is_corner:
            c, end = seg.c, seg.end_point
            segments.append(f"L {tx(c.x):.2f} {ty(c.y):.2f} L {tx(end.x):.2f} {ty(end.y):.2f}")
        else:
            c1, c2, end = seg.c1, seg.c2, seg.end_point
            segments.append(f"C {tx(c1.x):.2f} {ty(c1.y):.2f} {tx(c2.x):.2f} {ty(c2.y):.2f} {tx(end.x):.2f} {ty(end.y):.2f}")
    segments.append("Z")
    body_d = " ".join(segments)
    
    # Eye position in original: (356, 43)
    eye_cx = tx(356)
    eye_cy = ty(43)
    
    # Beak tip in original: (311, 62)
    beak_x = tx(311)
    beak_y = ty(62)
    
    # Wing fold line: starts behind neck (tx(385), ty(100)) down along body to tail
    # Wing curve:
    w1_x, w1_y = tx(385), ty(115)
    w2_x, w2_y = tx(375), ty(175)
    w3_x, w3_y = tx(420), ty(250)
    w4_x, w4_y = tx(585), ty(305)
    wing_d = f"M {w1_x:.2f} {w1_y:.2f} C {w2_x:.2f} {w2_y:.2f} {w3_x:.2f} {w3_y:.2f} {w4_x:.2f} {w4_y:.2f}"
    
    # Export JS module with this clean vector
    js_code = f'''// Otomatik türetilen vektörel güvercin (Kullanıcı çizimi / paçalı kostüm güvercini)
export const PIGEON_SVG_VIEWBOX = "0 0 100 100"
export const PIGEON_BODY_PATH = "{body_d}"
export const PIGEON_WING_PATH = "{wing_d}"
export const PIGEON_EYE = {{ cx: {eye_cx:.2f}, cy: {eye_cy:.2f}, r: 1.8, pupilR: 0.9 }}
'''
    with open('src/components/pigeonVectorPath.js', 'w', encoding='utf-8') as f:
        f.write(js_code)
    print("Saved src/components/pigeonVectorPath.js")
    
    # Generate standalone SVG icons for each breed
    breeds = [
        ('cakal', '#8a5a34', 'Çakal', '#653a18'),
        ('limoni', '#eab308', 'Limoni', '#ca8a04'),
        ('kirmizi_komple', '#dc2626', 'Kırmızı Komple', '#b91c1c'),
        ('beyaz', '#f8fafc', 'Beyaz', '#cbd5e1'),
        ('siyah', '#1e293b', 'Siyah', '#0f172a'),
        ('mavi', '#3b82f6', 'Mavi', '#2563eb')
    ]
    
    for name, color, label, border in breeds:
        is_light = name == 'beyaz'
        stroke_color = '#94a3b8' if is_light else 'rgba(0,0,0,0.3)'
        stroke_w = '1.2' if is_light else '0.6'
        wing_stroke = '#cbd5e1' if is_light else 'rgba(255,255,255,0.35)'
        
        svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <filter id="shadow-{name}" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <!-- Güvercin Gövdesi (Referans çiziminden vektör) -->
  <path d="{body_d}" fill="{color}" stroke="{stroke_color}" stroke-width="{stroke_w}" filter="url(#shadow-{name})" />
  <!-- Kanat Ayrımı Çizgisi -->
  <path d="{wing_d}" fill="none" stroke="{wing_stroke}" stroke-width="1.2" stroke-linecap="round" />
  <!-- Göz -->
  <circle cx="{eye_cx:.2f}" cy="{eye_cy:.2f}" r="1.9" fill="#ffffff" stroke="#334155" stroke-width="0.5" />
  <circle cx="{eye_cx:.2f}" cy="{eye_cy:.2f}" r="0.95" fill="#0f172a" />
</svg>'''
        with open(f'public/breeds/{name}.svg', 'w', encoding='utf-8') as f:
            f.write(svg)
            
    print("Generated all breed SVGs in public/breeds/")

if __name__ == '__main__':
    generate_clean_vector()
