import math
FACE = "M232 38 C262 56 270 100 264 128 C262 140 270 160 284 188 C289 197 284 205 270 207 C265 208 265 214 270 218 C275 223 273 229 266 231 C271 237 270 243 264 248 C266 257 262 268 256 277 C252 296 244 316 228 334 L218 440 L170 440 L170 60 Z"
def face(skin_a, skin_b, line, lip, gid):
    return f'''<defs><linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{skin_a}"/><stop offset="1" stop-color="{skin_b}"/></linearGradient>
<linearGradient id="{gid}h" x1="170" y1="0" x2="232" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>
<linearGradient id="{gid}v" x1="0" y1="330" x2="0" y2="430" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>
<mask id="{gid}mh" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="520"><rect width="400" height="520" fill="url(#{gid}h)"/></mask>
<mask id="{gid}mv" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="520"><rect width="400" height="520" fill="url(#{gid}v)"/><rect width="400" height="330" fill="#fff"/></mask></defs>
<g mask="url(#{gid}mv)"><g mask="url(#{gid}mh)"><path d="{FACE}" fill="url(#{gid})"/></g></g>
<path d="M232 38 C262 56 270 100 264 128 C262 140 270 160 284 188 C289 197 284 205 270 207 C265 208 265 214 270 218 C275 223 273 229 266 231 C271 237 270 243 264 248 C266 257 262 268 256 277 C252 296 244 316 228 334" fill="none" stroke="{line}" stroke-width="2.6" stroke-linecap="round" opacity=".55"/>
<path d="M262 206 q6 12 4 24" fill="none" stroke="{lip}" stroke-width="5" stroke-linecap="round" opacity=".85"/>
<path d="M232 138 q17 -9 32 -2" fill="none" stroke="{line}" stroke-width="3.2" stroke-linecap="round"/>
<path d="M234 152 q15 11 30 0" fill="none" stroke="{line}" stroke-width="3.4" stroke-linecap="round"/>
<g stroke="{line}" stroke-width="1.6" stroke-linecap="round"><path d="M240 160 l-3 6"/><path d="M249 163 l-1 7"/><path d="M258 161 l2 6"/></g>
<circle cx="248" cy="180" r="14" fill="#fff" opacity=".12"/>'''
def moon():
    s='<svg class="moon" viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'
    s+='<defs><linearGradient id="hairM" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B2F80"/><stop offset="1" stop-color="#3F68C8"/></linearGradient><radialGradient id="crM" cx="30%" cy="30%" r="80%"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#BFCDEB"/></radialGradient></defs>'
    s+='<path d="M268 58 C110 70 52 240 120 350 C145 392 200 420 262 426 C170 388 150 220 268 58 Z" fill="url(#crM)"/>'
    s+='<g class="mh">'
    s+='<path d="M236 34 C150 20 60 90 62 200 C64 270 100 330 96 450 L196 450 C176 380 180 310 196 250 C190 190 200 120 236 34 Z" fill="url(#hairM)"/>'
    for d,w,c in [("M226 52 C130 40 44 124 72 226 C92 296 46 346 98 430",14,"#5B86D8"),("M212 86 C128 90 86 160 108 232 C124 282 96 332 138 392",11,"#7FA6EA"),("M200 124 C152 134 132 190 144 242",9,"#9DBBF2"),("M236 70 C170 64 108 120 114 190",8,"#2A4BA0"),("M150 300 C120 330 150 360 128 410",9,"#5B86D8")]:
        s+=f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" opacity=".9"/>'
    s+='<path d="M72 262 c-34 -10 -40 -56 -6 -64 c28 -6 46 24 28 44 c-14 14 -34 6 -32 -10" fill="none" stroke="#9DBBF2" stroke-width="7" stroke-linecap="round"/>'
    s+='<path d="M100 120 c-30 -14 -22 -52 8 -50 c22 2 28 28 12 38" fill="none" stroke="#7FA6EA" stroke-width="6" stroke-linecap="round"/>'
    s+='<g fill="#FFF">'+''.join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x,y,r in [(120,150,3),(86,260,2.4),(150,330,2.6),(170,200,2),(110,360,2.2),(196,110,2)])+'</g></g>'
    s+=face("#A9C6F6","#4C74CC","#10246B","#2F4FA8","skM")
    s+='</svg>'; return s
def sun():
    cx,cy=190,205
    s='<svg class="sun" viewBox="0 0 400 520" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g transform="translate(400,0) scale(-1,1)">'
    s+='<defs><radialGradient id="dsS" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="#FFB347"/><stop offset="1" stop-color="#E4631C"/></radialGradient><linearGradient id="rayS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFC247"/><stop offset="1" stop-color="#E4501E"/></linearGradient></defs>'
    s+='<g class="rays">'
    n=26
    for i in range(n):
        a=i*2*math.pi/n; L=215 if i%2==0 else 175; w=.1
        p=[(cx+math.cos(a-w)*140,cy+math.sin(a-w)*140),(cx+math.cos(a)*L,cy+math.sin(a)*L),(cx+math.cos(a+w)*140,cy+math.sin(a+w)*140)]
        s+='<path d="M%.1f %.1f L%.1f %.1f L%.1f %.1f Z" fill="url(#rayS)" transform="rotate(%d %d %d)" opacity="%s"/>'%(p[0][0],p[0][1],p[1][0],p[1][1],p[2][0],p[2][1],0,cx,cy,"1" if i%2==0 else ".8")
    s+='</g>'
    s+=f'<circle cx="{cx}" cy="{cy}" r="148" fill="url(#dsS)"/>'
    s+='<g fill="#E78914" opacity=".5">'+''.join(f'<circle cx="{x}" cy="{y}" r="{r}"/>' for x,y,r in [(110,130,17),(262,118,12),(120,290,14),(235,300,19),(160,90,9),(290,215,10),(100,215,8)])+'</g>'
    s+='<g class="flame">'
    for d,w,c in [("M170 40 C110 60 74 130 90 210 C98 250 78 290 110 330",14,"#FFB224"),("M160 80 C112 100 96 170 116 226",11,"#FF8A1F"),("M190 60 C150 40 100 60 70 110",9,"#E4501E"),("M130 330 C100 360 118 400 96 440",10,"#FFB224")]:
        s+=f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" opacity=".9"/>'
    s+='</g>'
    s+=face("#FFF6CF","#FFD76A","#7A2E05","#C0501A","skS")
    s+='</g></svg>'; return s
open('moon.svg.txt','w').write(moon()); open('sun.svg.txt','w').write(sun())
open('preview.html','w').write('<!doctype html><body style="margin:0;display:flex;gap:20px;background:#fff"><div style="width:420px;background:#dbe4f7">'+moon().replace('class="moon"','width="420"')+'</div><div style="width:420px;background:#fbe8c4">'+sun().replace('class="sun"','width="420"')+'</div></body>')
