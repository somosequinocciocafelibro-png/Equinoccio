"""Genera la hoja para el portaprecios de acrílico tipo T, media carta (14 x 21,6 cm), con los dos QR en los colores del logo.
Uso: pip install segno pillow && python3 generar-acrilico.py salida.html ../assets/logo.png [a4|exact]
  a4    -> hoja A4 con marcas de corte y 3 mm de sangrado (para imprimir en casa u oficina)
  exact -> 140 x 216 mm exactos (para llevar a una imprenta)
Luego abrir salida.html en Chrome e imprimir a PDF (100 %, con gráficos de fondo). Salen 2 páginas: frente y reverso iguales."""
"""Builds the folded table-tent card (A4 landscape, two tents per sheet) with QR codes styled after the Equinoccio color logo."""
import base64, io, math, random, sys
import segno
from PIL import Image, ImageFilter, ImageDraw

OUT = sys.argv[1]            # output html path
LOGO = sys.argv[2]           # wooden seal png
URL_MENU = "https://equinoccio.online/carta"
URL_REVIEW = "https://equinoccio.online/resena"

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
    W, H = 826, 1300
    random.seed(7)
    base = Image.new("RGB", (W, H), (251, 246, 238))
    layer = Image.new("RGB", (W, H), (251, 246, 238))
    d = ImageDraw.Draw(layer)
    blobs = [((-160, -200, 560, 420), (146, 172, 214), 0.78), ((420, -180, 1050, 460), (243, 184, 98), 0.78),
             ((150, -240, 700, 200), (214, 226, 240), 0.6), ((-200, 900, 560, 1500), (160, 196, 152), 0.72),
             ((380, 980, 1100, 1500), (246, 222, 170), 0.72), ((120, 520, 760, 980), (252, 247, 238), 0.5)]
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


MODE = sys.argv[3] if len(sys.argv) > 3 else "a4"     # "a4" (crop marks + bleed) or "exact" (140x216 mm)

def row(url, title, sub, extra):
    return f"""<div class="qrrow"><div class="qrsvg">{qr_svg(url, logo_small, 46)}</div>
<div class="txt"><h3>{title}</h3><p class="sub">{sub}</p>{extra}</div></div>"""

card_inner = f"""<div class="frame"></div>
<div class="head"><img class="seal" src="data:image/png;base64,{logo_head}" alt="">
<p class="lema">Un encuentro único entre el café, los libros y tus momentos favoritos</p></div>
<div class="rows">
{row(URL_MENU, "Mira la carta", "Bebidas, hojaldres y precios", '<div class="pill">equinoccio.online/carta</div>')}
{row(URL_REVIEW, "Ubicación y reseñas", "Encuéntranos y cuéntanos tu experiencia en Google", f'<div class="stars">{star*5}</div>')}
</div>
<p class="addr">Equinoccio Café Libro · Cra. 6 #4B-19, 2.º piso · Cajicá</p>"""

def card():
    return f"""<div class="card"><div class="bleed"></div>{card_inner}</div>"""

if MODE == "a4":
    marks = "".join(f'<i class="m" style="left:{x}mm;top:{y}mm;width:{w}mm;height:{h}mm"></i>' for x, y, w, h in [
        (27,40.5,6,.2),(27,256.5,6,.2),(177,40.5,6,.2),(177,256.5,6,.2),   # horizontal ticks
        (35,32,.2,6),(175,32,.2,6),(35,258.5,.2,6),(175,258.5,.2,6)])      # vertical ticks
    page = f'<section class="sheet a4">{marks}<div class="pos">{card()}</div></section>'
    size = "210mm 297mm"
else:
    page = f'<section class="sheet exact">{card()}</section>'
    size = "140mm 216mm"

html = f"""<!doctype html><html lang="es"><meta charset="utf-8"><title>Acrílico media carta Equinoccio</title>
<link href="https://fonts.googleapis.com/css2?family=Young+Serif&family=Nunito+Sans:ital,wght@0,400;0,800;1,400&display=swap" rel="stylesheet">
<style>
@page{{size:{size};margin:0}}*{{box-sizing:border-box}}
html{{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
body{{margin:0;font-family:"Nunito Sans",sans-serif;color:{CAFE}}}
.sheet{{position:relative;page-break-after:always;overflow:hidden;background:#fff}}
.a4{{width:210mm;height:297mm}}.exact{{width:140mm;height:216mm}}
.pos{{position:absolute;left:35mm;top:40.5mm}}
.m{{position:absolute;background:#000}}
.card{{position:relative;width:140mm;height:216mm}}
.bleed{{position:absolute;left:-3mm;top:-3mm;right:-3mm;bottom:-3mm;background:url(data:image/jpeg;base64,{bg}) center/cover}}
.exact .bleed{{left:0;top:0;right:0;bottom:0}}
.frame{{position:absolute;inset:5mm;border:.3mm solid {BEIGE};border-radius:6mm}}
.head{{position:absolute;left:0;right:0;top:12mm;display:flex;flex-direction:column;align-items:center;gap:3mm}}
.seal{{width:24mm;filter:drop-shadow(0 .8mm 1.2mm rgba(60,40,20,.3))}}
.lema{{margin:0;font:400 12.5pt/1.25 "Young Serif",serif;color:{NOCHE};text-align:center;max-width:104mm;text-wrap:balance}}
.rows{{position:absolute;left:0;right:0;top:63mm;display:flex;flex-direction:column;align-items:center;gap:6mm}}
.qrrow{{width:122mm;height:62mm;background:#fff;border-radius:5mm;display:flex;align-items:center;gap:3mm;padding:0 5mm 0 4mm;box-shadow:0 1mm 3mm rgba(60,40,20,.22);border:.3mm solid {BEIGE}}}
.qrsvg svg{{display:block}}
.txt{{flex:1;display:flex;flex-direction:column;align-items:flex-start}}
h3{{font:400 16pt/1.1 "Young Serif",serif;margin:0 0 1.8mm;color:{NOCHE}}}
.sub{{margin:0;font-size:9pt;line-height:1.3;color:#5a4538;text-wrap:balance}}
.pill{{margin-top:2.6mm;background:#fff;border:.3mm solid {BEIGE};border-radius:6mm;padding:.8mm 3mm;font-weight:800;font-size:7.6pt;color:{NOCHE}}}
.stars{{margin-top:2.4mm;display:flex;gap:.6mm}}.stars svg{{width:4.4mm;height:4.4mm}}
.addr{{position:absolute;left:0;right:0;top:197mm;margin:0;text-align:center;font-size:7.2pt;letter-spacing:.06em;color:#5a4538}}
</style>
<body>{page}{page}</body></html>"""
open(OUT, "w").write(html); print("html bytes:", len(html), "mode:", MODE)
