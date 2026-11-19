import potrace
import numpy as np
from PIL import Image

def trace_reference_pigeon():
    img_path = r'C:\Users\GXL\.gemini\antigravity\brain\ae73ce2e-d457-41ef-81a0-883bda56ddd5\.user_uploaded\media_1792267950463_6cba24c4.png'
    im = Image.open(img_path).convert('RGB')
    arr = np.array(im)
    
    # Background is white (> 240 in all RGB)
    is_bird = ~((arr[:, :, 0] > 240) & (arr[:, :, 1] > 240) & (arr[:, :, 2] > 240))
    
    # Trace with potrace
    bmp = potrace.Bitmap(is_bird)
    path = bmp.trace(turdsize=8, alphamax=1.0)
    
    # Calculate bounding box of the curve
    min_x, max_x = 9999, -9999
    min_y, max_y = 9999, -9999
    
    paths_d = []
    for curve in path:
        segments = []
        start = curve.start_point
        min_x = min(min_x, start.x)
        max_x = max(max_x, start.x)
        min_y = min(min_y, start.y)
        max_y = max(max_y, start.y)
        segments.append(f"M {start.x:.2f} {start.y:.2f}")
        for seg in curve:
            if seg.is_corner:
                c = seg.c
                end = seg.end_point
                min_x = min(min_x, c.x, end.x)
                max_x = max(max_x, c.x, end.x)
                min_y = min(min_y, c.y, end.y)
                max_y = max(max_y, c.y, end.y)
                segments.append(f"L {c.x:.2f} {c.y:.2f} L {end.x:.2f} {end.y:.2f}")
            else:
                c1, c2, end = seg.c1, seg.c2, seg.end_point
                min_x = min(min_x, c1.x, c2.x, end.x)
                max_x = max(max_x, c1.x, c2.x, end.x)
                min_y = min(min_y, c1.y, c2.y, end.y)
                max_y = max(max_y, c1.y, c2.y, end.y)
                segments.append(f"C {c1.x:.2f} {c1.y:.2f} {c2.x:.2f} {c2.y:.2f} {end.x:.2f} {end.y:.2f}")
        segments.append("Z")
        paths_d.append(" ".join(segments))
        
    full_d = " ".join(paths_d)
    w = max_x - min_x
    h = max_y - min_y
    print(f"Traced bounding box: ({min_x:.1f}, {min_y:.1f}) to ({max_x:.1f}, {max_y:.1f}), width={w:.1f}, height={h:.1f}")
    
    # Normalize to a standard 0 0 100 100 viewBox
    pad = 4.0
    scale = (100.0 - 2 * pad) / max(w, h)
    
    norm_paths = []
    for curve in path:
        segments = []
        def tx(x): return (x - min_x) * scale + pad + ((100.0 - 2 * pad) - w * scale) / 2.0
        def ty(y): return (y - min_y) * scale + pad + ((100.0 - 2 * pad) - h * scale) / 2.0
        
        start = curve.start_point
        segments.append(f"M {tx(start.x):.2f} {ty(start.y):.2f}")
        for seg in curve:
            if seg.is_corner:
                c, end = seg.c, seg.end_point
                segments.append(f"L {tx(c.x):.2f} {ty(c.y):.2f} L {tx(end.x):.2f} {ty(end.y):.2f}")
            else:
                c1, c2, end = seg.c1, seg.c2, seg.end_point
                segments.append(f"C {tx(c1.x):.2f} {ty(c1.y):.2f} {tx(c2.x):.2f} {ty(c2.y):.2f} {tx(end.x):.2f} {ty(end.y):.2f}")
        segments.append("Z")
        norm_paths.append(" ".join(segments))
        
    norm_d = " ".join(norm_paths)
    eye_x = tx(356)
    eye_y = ty(43)
    
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <path d="{norm_d}" fill="currentColor" fill-rule="evenodd"/>
  <circle cx="{eye_x:.2f}" cy="{eye_y:.2f}" r="1.8" fill="#ffffff"/>
  <circle cx="{eye_x:.2f}" cy="{eye_y:.2f}" r="0.9" fill="#111827"/>
</svg>'''
    
    with open('public/breeds/pigeon_vector.svg', 'w', encoding='utf-8') as f:
        f.write(svg_content)
        
    print("Wrote public/breeds/pigeon_vector.svg successfully!")
    print(f"Eye position: ({eye_x:.2f}, {eye_y:.2f})")
    
    # Also save the path string to a JS export
    with open('src/components/pigeonVectorPath.js', 'w', encoding='utf-8') as f:
        f.write(f'''// Vektörel güvercin silueti (Kullanıcının paylaştığı paçalı kostüm güvercini referansından üretildi)
export const PIGEON_VECTOR_PATH = "{norm_d}"
export const PIGEON_EYE = {{ cx: {eye_x:.2f}, cy: {eye_y:.2f}, r: 1.8, pupilR: 0.9 }}
''')
    print("Wrote src/components/pigeonVectorPath.js")

if __name__ == '__main__':
    trace_reference_pigeon()
