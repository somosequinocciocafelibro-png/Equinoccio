"""Genera la tarjeta de mesa doblada (A4 horizontal, 2 por hoja) con los dos QR (carta y ubicación) en los colores del logo.
Uso: pip install segno pillow && python3 generar-tarjeta-doblada.py salida.html ../assets/logo.png
Luego abrir salida.html en Chrome e imprimir a PDF (A4 horizontal, 100 %, con gráficos de fondo)."""
import base64, io, math, random, sys
import segno
from PIL import Image, ImageFilter, ImageDraw

OUT = sys.argv[1]            # output html path
LOGO = sys.argv[2]           # wooden seal png
URL_MENU = "https://equinoccio.online/carta"
URL_REVIEW = "https://maps.google.com/?cid=13207318301799707814"

# Palette taken from the watercolor logo, deepened so the QR keeps scanning contrast
NOCHE, NOCHE2 = "#22314F", "#2F4575"
SOL, SOL_DEEP = "#E9A04A", "#B85A1E"
SALVIA_DEEP = "#2F5B4A"
BEIGE = "#C9A992"
CAFE = "#3B2A20"

def lerp(a, b, t):
    a = [int(a[i:i+2], 16) for i in (1, 3, 5)]; b = [int(b[i:i+2], 16) for i in (1, 3, 5)]
    return "#%02X%02X%02X" % tuple(round(a[i] + (b[i]-a[i])*t) for i in range(3))

def grad(t):                  # night blue -> indigo -> deep sage along the diagonal
    return lerp(NOCHE, NOCHE2, t/0.5) if t < .5 else lerp(NOCHE2, SALVIA_DEEP, (t-.5)/.5)

def qr_svg(url, logo_b64, size_mm):
    q = segno.make(url, error="h", boost_error=False)
    m = [list(r) for r in q.matrix]; n = len(m); quiet = 2
    box = n + quiet*2
    clear = (n * 0.215)       # logo keeps ~4.6% of the area, well inside level-H recovery
    c = n/2
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {box} {box}" width="{size_mm}mm" height="{size_mm}mm">']
    def in_finder(x, y):
        return (x < 8 and y < 8) or (x >= n-8 and y < 8) or (x < 8 and y >= n-8)
    for y in range(n):
        for x in range(n):
            if not m[y][x] or in_finder(x, y): continue
            if math.hypot(x+.5-c, y+.5-c) < clear/2 + .6: continue
            t = (x + y) / (2*(n-1))
            out.append(f'<circle cx="{x+quiet+.5:.2f}" cy="{y+quiet+.5:.2f}" r=".47" fill="{grad(t)}"/>')
    for fx, fy in ((0, 0), (n-7, 0), (0, n-7)):
        X, Y = fx+quiet, fy+quiet
        out.append(f'<rect x="{X+.5}" y="{Y+.5}" width="6" height="6" rx="1.7" fill="none" stroke="{NOCHE}" stroke-width="1"/>')
        out.append(f'<rect x="{X+2}" y="{Y+2}" width="3" height="3" rx="1" fill="{SOL_DEEP}"/>')
    r = clear/2 + .35
    out.append(f'<circle cx="{box/2}" cy="{box/2}" r="{r:.2f}" fill="#fff"/>')
    out.append(f'<circle cx="{box/2}" cy="{box/2}" r="{r:.2f}" fill="none" stroke="{BEIGE}" stroke-width=".18"/>')
    out.append(f'<image href="data:image/png;base64,{logo_b64}" x="{box/2-r+.35:.2f}" y="{box/2-r+.35:.2f}" width="{(r-.35)*2:.2f}" height="{(r-.35)*2:.2f}"/>')
    out.append('</svg>')
    return "".join(out)

def watercolor_bg():
    """Soft watercolor wash echoing the logo: night blue (top-left), sky, sun (top-right), sage (bottom)."""
    W, H = 1170, 826
    random.seed(7)
    base = Image.new("RGB", (W, H), (251, 246, 238))
    layer = Image.new("RGB", (W, H), (251, 246, 238))
    d = ImageDraw.Draw(layer)
    blobs = [((-120, -160, 560, 360), (146, 172, 214), 0.75), ((660, -170, 1320, 380), (243, 184, 98), 0.78),
             ((250, -200, 760, 180), (214, 226, 240), 0.6), ((-140, 540, 600, 1040), (160, 196, 152), 0.72),
             ((560, 600, 1330, 1020), (246, 222, 170), 0.7), ((380, 380, 860, 760), (252, 247, 238), 0.55)]
    for box, col, a in blobs:
        ov = Image.new("RGB", (W, H), col); mask = Image.new("L", (W, H), 0)
        ImageDraw.Draw(mask).ellipse(box, fill=int(255*a)); mask = mask.filter(ImageFilter.GaussianBlur(70))
        layer.paste(ov, (0, 0), mask)
    layer = Image.blend(base, layer, 0.8)
    px = layer.load()
    for _ in range(26000):                       # paper grain
        x, y = random.randrange(W), random.randrange(H); r, g, b = px[x, y]; k = random.randint(-7, 7)
        px[x, y] = (max(0, min(255, r+k)), max(0, min(255, g+k)), max(0, min(255, b+k)))
    buf = io.BytesIO(); layer.save(buf, "JPEG", quality=82); return base64.b64encode(buf.getvalue()).decode()

def png_b64(path, px):
    im = Image.open(path).convert("RGBA"); im.thumbnail((px, px), Image.LANCZOS)
    b = io.BytesIO(); im.save(b, "PNG", optimize=True); return base64.b64encode(b.getvalue()).decode()

logo_small = png_b64(LOGO, 200)       # center of the QR
logo_head = png_b64(LOGO, 360)
bg = watercolor_bg()
star = '<svg viewBox="0 0 24 24" width="5.2mm" height="5.2mm"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" fill="#E9A04A" stroke="#B85A1E" stroke-width="1"/></svg>'

def qrbox(url, title, sub, extra=""):
    return f'''<div class="qrcard"><div class="qrsvg">{qr_svg(url, logo_small, 41)}</div>
<h3>{title}</h3><p class="sub">{sub}</p>{extra}</div>'''

def panel():
    menu = qrbox(URL_MENU, "Mira la carta", "Bebidas, hojaldres y precios", '<div class="pill">equinoccio.online/carta</div>')
    ubic = qrbox(URL_REVIEW, "Ubicación y reseñas", "Encuéntranos y cuéntanos tu experiencia en Google", f'<div class="stars">{star*5}</div>')
    return f'''<div class="panel"><div class="head"><img class="seal" src="data:image/png;base64,{logo_head}" alt="">
<p class="lema">Un encuentro único entre el café, los libros y tus momentos favoritos</p></div>
<div class="row">{menu}{ubic}</div>
<p class="addr">Equinoccio Café Libro · Cra. 6 #4B-19, 2.º piso · Cajicá</p></div>'''

tent = f'''<div class="tent"><div class="top">{panel()}</div><div class="fold"><span>doblar aquí</span></div><div class="bottom">{panel()}</div></div>'''

html = f'''<!doctype html><html lang="es"><meta charset="utf-8"><title>Tarjeta de mesa Equinoccio</title>
<link href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Nunito+Sans:ital,wght@0,400;0,800;1,400&display=swap" rel="stylesheet">
<style>
@page{{size:A4 landscape;margin:0}}*{{box-sizing:border-box}}
html{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
body{{margin:0;width:297mm;height:210mm;display:grid;grid-template-columns:148.5mm 148.5mm;font-family:"Nunito Sans",sans-serif;color:{CAFE};background:#fff}}
.tent{{position:relative;width:148.5mm;height:210mm;display:grid;grid-template-rows:105mm 0 105mm;outline:.25mm dashed #b9a99a;outline-offset:-.12mm}}
.top{{transform:rotate(180deg)}}
.fold{{position:relative;border-top:.35mm dashed #8a7a6c;z-index:3}}
.fold span{{position:absolute;left:50%;top:-1.6mm;transform:translateX(-50%);background:#fff;padding:0 2mm;font-size:5.5pt;letter-spacing:.2em;text-transform:uppercase;color:#8a7a6c}}
.panel{{position:relative;width:148.5mm;height:105mm;background:url(data:image/jpeg;base64,{bg}) center/cover;overflow:hidden}}
.panel::before{{content:"";position:absolute;inset:3.2mm;border:.3mm solid {BEIGE};border-radius:5mm;pointer-events:none}}
.head{{position:absolute;left:0;right:0;top:7.5mm;display:flex;align-items:center;justify-content:center;gap:4.5mm}}
.seal{{width:16mm;filter:drop-shadow(0 .6mm 1mm rgba(60,40,20,.3))}}
.lema{{margin:0;font:400 11pt/1.25 "Young Serif",serif;color:{NOCHE};max-width:94mm;text-wrap:balance}}
.row{{position:absolute;left:0;right:0;top:27mm;display:flex;justify-content:center;gap:9mm}}
.qrcard{{width:55mm;background:#fff;border-radius:4.5mm;padding:3.8mm 2.5mm 3.2mm;display:flex;flex-direction:column;align-items:center;text-align:center;box-shadow:0 1mm 3mm rgba(60,40,20,.22);border:.3mm solid {BEIGE}}}
.qrsvg svg{{display:block}}
h3{{font:400 12.5pt/1.1 "Young Serif",serif;margin:1.4mm 0 .8mm;color:{NOCHE}}}
.sub{{margin:0;font-size:7.8pt;line-height:1.25;color:#5a4538;max-width:47mm;text-wrap:balance}}
.pill{{margin-top:1.4mm;background:#fff;border:.3mm solid {BEIGE};border-radius:6mm;padding:.5mm 2.8mm;font-weight:800;font-size:7.4pt;color:{NOCHE}}}
.stars{{margin-top:1mm;display:flex;gap:.5mm}}.stars svg{{width:3.6mm;height:3.6mm}}
.addr{{position:absolute;left:0;right:0;bottom:5.8mm;margin:0;text-align:center;font-size:6.8pt;letter-spacing:.06em;color:#5a4538}}
</style>
<body>{tent}{tent}</body></html>'''
open(OUT, "w").write(html)
print("html bytes:", len(html))
