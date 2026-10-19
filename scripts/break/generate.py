"""
Erzeugt aus sim.json die feste Start-Animation:
  app/BreakSplash.tsx   (Markup)
  app/break-splash.css  (CSS-Keyframes)

Ablauf: python3 simulate.py 0.9 10 0.008 0.025 sim.json && python3 generate.py
"""
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "..", "app")

d = json.load(open(os.path.join(HERE, "sim.json")))
R, W, L, DT = d["R"], d["W"], d["L"], d["dt"]
frames = d["frames"]
pockets = d["pockets"]

COLORS = ["#f2c230", "#1f4fb4", "#c8322a", "#5b2d8e",
          "#ee7a1f", "#1d7a44", "#7a2232", "#151515"]

# ---- Zeitplan (Sekunden) -------------------------------------------------
STICK_IN = 0.15        # Queue blendet ein
BACK_END = 0.40        # Ausholen fertig
CONTACT = 0.46         # Queue trifft die Weiße → Simulation startet
SIM_SHOW = 2.30        # so lange läuft die Simulation sichtbar vor dem Ausblenden
FADE = 0.45
SIM_LEN = min(d["settle"], SIM_SHOW + FADE)
TOTAL = CONTACT + SIM_LEN
POCKET_DROP = 0.12     # Kugel rutscht in die Tasche
TOL = 1.2              # mm, max. Abweichung der Keyframe-Vereinfachung

RAIL = 70              # Bandenbreite (mm, nur Optik)


def pct(t):
    return f"{100 * t / TOTAL:.3f}".rstrip("0").rstrip(".") + "%"


def simplify(pts):
    """Douglas-Peucker in der Zeit: behält nur Keyframes, ohne die die
    lineare Interpolation um mehr als TOL von der Bahn abweicht."""
    keep = {0, len(pts) - 1}

    def rec(a, b):
        ta, pa = pts[a]
        tb, pb = pts[b]
        worst, wi = 0, None
        for k in range(a + 1, b):
            tk, pk = pts[k]
            f = (tk - ta) / (tb - ta) if tb > ta else 0
            ix = pa[0] + f * (pb[0] - pa[0])
            iy = pa[1] + f * (pb[1] - pa[1])
            e = math.hypot(pk[0] - ix, pk[1] - iy)
            if e > worst:
                worst, wi = e, k
        if wi is not None and worst > TOL:
            keep.add(wi)
            rec(a, wi)
            rec(wi, b)

    rec(0, len(pts) - 1)
    return [pts[k] for k in sorted(keep)]


css = []
n_frames = int(round(SIM_LEN / DT)) + 1
total_kf = 0
for i in range(16):
    pts = []
    pocket = d["pocketed"].get(str(i))
    for k in range(n_frames):
        pos, alive = frames[k]
        if not alive[i]:
            break
        pts.append((CONTACT + k * DT, pos[i]))
    kf = simplify(pts)
    lines = [f"0%{{transform:translate({kf[0][1][0]:.1f}px,{kf[0][1][1]:.1f}px)}}"]
    for t, (x, y) in kf:
        lines.append(f"{pct(t)}{{transform:translate({x:.1f}px,{y:.1f}px)}}")
    if pocket:
        px, py, _ = pockets[pocket["pocket"]]
        t_end = min(CONTACT + pocket["t"] + POCKET_DROP, TOTAL)
        lines.append(f"{pct(t_end)},100%{{transform:translate({px:.1f}px,{py:.1f}px) scale(0)}}")
    else:
        x, y = kf[-1][1]
        lines.append(f"100%{{transform:translate({x:.1f}px,{y:.1f}px)}}")
    total_kf += len(lines)
    css.append(f"@keyframes bs-b{i}{{{''.join(lines)}}}")
    css.append(f".bs-b{i}{{animation-name:bs-b{i}}}")

cue0 = frames[0][0][0]
# Queue: Spitze liegt mit kleinem Abstand unter der Weißen.
GAP = 40
BACK = 220
FOLLOW = 50
stick = [
    (0, GAP, 0), (STICK_IN, GAP, 1), (BACK_END, BACK, 1),
    (CONTACT, 0, 1), (CONTACT + 0.10, -FOLLOW, 1), (CONTACT + 0.32, -FOLLOW, 0),
]
ease = {0: "ease-out", STICK_IN: "ease-in-out", BACK_END: "cubic-bezier(.55,0,1,.6)",
        CONTACT: "ease-out", CONTACT + 0.10: "linear", CONTACT + 0.32: "linear"}
sk = []
for t, off, op in stick:
    sk.append(f"{pct(t)}{{transform:translate({cue0[0]:.1f}px,{cue0[1] + R + off:.1f}px);"
              f"opacity:{op};animation-timing-function:{ease[t]}}}")
sk.append(f"100%{{transform:translate({cue0[0]:.1f}px,{cue0[1] + R - FOLLOW:.1f}px);opacity:0}}")
css.append(f"@keyframes bs-stick{{{''.join(sk)}}}")

fade_start = CONTACT + SIM_SHOW

header = f"""/* GENERIERT von scripts/break/generate.py – nicht von Hand bearbeiten.
   Start-Animation: 8-Ball-Break, Bahnen aus einer Physiksimulation
   (scripts/break/simulate.py). Läuft bei jedem Start identisch ab. */

.bs {{
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--felt-dark);
  background-image: radial-gradient(circle at 50% -10%, var(--felt) 0%, var(--felt-dark) 60%);
  pointer-events: none;
  animation: bs-out {FADE}s ease-in {fade_start:.2f}s forwards;
}}

.bs svg {{
  height: min(80vh, 165vw);
  height: min(80dvh, 165vw);
  width: auto;
  overflow: visible;
}}

.bs-ball, .bs-stick {{
  transform-box: view-box;
  transform-origin: 0 0;
  animation-duration: {TOTAL:.3f}s;
  animation-timing-function: linear;
  animation-fill-mode: both;
}}

.bs-stick {{ animation-name: bs-stick; }}

@keyframes bs-out {{
  to {{ opacity: 0; visibility: hidden; }}
}}

@media (prefers-reduced-motion: reduce) {{
  .bs {{ display: none; }}
}}
"""
open(os.path.join(APP, "break-splash.css"), "w").write(header + "\n" + "\n".join(css) + "\n")

# ---- Markup ---------------------------------------------------------------
def ball_svg(i):
    x, y = frames[0][0][i]
    style = f'{{{{ transform: "translate({x:.1f}px,{y:.1f}px)" }}}}'
    if i == 0:
        body = f'<circle r="{R}" fill="#f4efe4" />'
    elif i <= 8:
        body = (f'<circle r="{R}" fill="{COLORS[i - 1]}" />'
                f'<circle r="{R * 0.42:.2f}" fill="#f4efe4" />')
    else:
        c = COLORS[i - 9]
        body = (f'<circle r="{R}" fill="#f4efe4" />'
                f'<rect x="{-R}" y="{-R * 0.56:.2f}" width="{2 * R}" height="{R * 1.12:.2f}" '
                f'fill="{c}" clipPath="url(#bs-clip)" />'
                f'<circle r="{R * 0.42:.2f}" fill="#f4efe4" />')
    shine = f'<circle cx="{-R * 0.35:.2f}" cy="{-R * 0.38:.2f}" r="{R * 0.32:.2f}" fill="#fff" opacity="0.28" />'
    return f'        <g className="bs-ball bs-b{i}" style={style}>{body}{shine}</g>'


def diamonds():
    out = []
    # je 3 Diamanten zwischen zwei Taschen, auf der Bandenmitte
    for k in (1, 2, 3):
        x = W * k / 4
        for y in (-RAIL / 2, L + RAIL / 2):
            out.append((x, y))
    for k in (1, 2, 3, 5, 6, 7):
        y = L * k / 8
        for x in (-RAIL / 2, W + RAIL / 2):
            out.append((x, y))
    return "\n".join(f'        <circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="#f1e9d8" opacity="0.35" />'
                     for x, y in out)


pocket_svg = "\n".join(
    f'        <circle cx="{px:.1f}" cy="{py:.1f}" r="{56 if rc > 65 else 50}" fill="#07130f" />'
    for px, py, rc in pockets)

# Queue: Spitze bei (0,0), zeigt nach oben, Griff nach unten
stick_svg = f"""        <g className="bs-stick">
          <polygon points="-6.5,0 6.5,0 15,1450 -15,1450" fill="url(#bs-wood)" />
          <rect x="-6.5" y="0" width="13" height="10" rx="2" fill="#5f87b8" />
          <rect x="-6.6" y="10" width="13.2" height="22" fill="#f1e9d8" />
        </g>"""

vb = f"{-RAIL} {-RAIL} {W + 2 * RAIL} {L + 2 * RAIL}"
balls = "\n".join(ball_svg(i) for i in [*range(1, 16), 0])
tsx = f"""// GENERIERT von scripts/break/generate.py – nicht von Hand bearbeiten.
// Start-Animation beim Laden der Website: 8-Ball-Break. Die Bahnen wurden
// einmal physikalisch berechnet und sind als feste CSS-Animation hinterlegt;
// im Browser wird nichts gerechnet. Reines Server-Markup, läuft also schon,
// bevor JavaScript geladen ist.
import "./break-splash.css";

export default function BreakSplash() {{
  return (
    <div className="bs" aria-hidden="true">
      <svg viewBox="{vb}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <clipPath id="bs-clip">
            <circle r="{R}" />
          </clipPath>
          <linearGradient id="bs-wood" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e6cf9c" />
            <stop offset="0.6" stopColor="#c9a46a" />
            <stop offset="0.62" stopColor="#3a2416" />
            <stop offset="1" stopColor="#24160d" />
          </linearGradient>
        </defs>
        <rect x="{-RAIL}" y="{-RAIL}" width="{W + 2 * RAIL}" height="{L + 2 * RAIL}" rx="38" fill="#0c211b" />
        <rect x="0" y="0" width="{W}" height="{L}" fill="#1f4a3d" />
{pocket_svg}
{diamonds()}
        <circle cx="{W / 2}" cy="{L / 4}" r="5" fill="#f1e9d8" opacity="0.25" />
{balls}
{stick_svg}
      </svg>
    </div>
  );
}}
"""
open(os.path.join(APP, "BreakSplash.tsx"), "w").write(tsx)
print(f"TOTAL={TOTAL:.2f}s fade_start={fade_start:.2f}s keyframes={total_kf} "
      f"css={os.path.getsize(os.path.join(APP, 'break-splash.css'))} B")
