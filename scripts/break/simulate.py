"""
Physiksimulation eines 8-Ball-Breaks für die Start-Animation.

Die Bahnen werden EINMAL hier berechnet; generate.py macht daraus eine feste
CSS-Animation. Auf dem Gerät wird nichts gerechnet.

Tisch: 9 ft, Spielfläche 2,54 m x 1,27 m, hochkant, Kopfende unten.
Kugeln: Ø 57,15 mm, 170 g. Intern SI-Einheiten, Ausgabe in Millimetern.

Modell:
- Kugel-Kugel-Kontakt nach Hertz (F = k·δ^1,5) mit Dämpfung. Weiche
  Kontakte sind nötig, damit sich der Stoß im eng gelegten Dreieck so
  ausbreitet wie in echt: Bei starr-sequentiellen Stößen liefe der Impuls
  wie beim Kugelpendel nur zu den hinteren Ecken durch.
  Kräfte wirken entlang der Mittelpunktsverbindung (glatte Kugeln), daher
  stimmen alle Abprallwinkel – z. B. die 90°-Regel nach einem
  Halbtreffer.
- Bande: Spiegelung der Normalkomponente (Einfalls- ≈ Ausfallswinkel) mit
  Restitution, leichter Reibungsverlust tangential.
- Rollreibung: konstante Verzögerung entgegen der Laufrichtung.
- Taschen: Kugelmittelpunkt erreicht den Fangradius um den Taschenpunkt.
"""
import json
import math
import sys

import numpy as np

R = 0.057150 / 2
M = 0.170
W, L = 1.270, 2.540  # x quer, y längs (wächst zum Kopfende/unten)

# Hertz-Kontakt (Phenolharz: E ≈ 5 GPa, ν ≈ 0,35)
E_STAR = 5e9 / (2 * (1 - 0.35**2))
K_HERTZ = 4 / 3 * E_STAR * math.sqrt(R / 2)
DAMP = float(sys.argv[4]) if len(sys.argv) > 4 else 0.025  # → Restitution ≈ 0,93

E_RAIL = 0.78
RAIL_TANGENT = 0.93
DECEL = float(sys.argv[1]) if len(sys.argv) > 1 else 1.4    # m/s²
V0 = float(sys.argv[2]) if len(sys.argv) > 2 else 7.0       # m/s
CUE_OFFSET = float(sys.argv[3]) if len(sys.argv) > 3 else 0.004  # m
T_END = 4.0
DT_OUT = 1 / 240

# Standard-8-Ball-Aufbau: Spitze auf dem Fußpunkt, 8 in der Mitte der
# dritten Reihe, hintere Ecken eine Volle (5) und eine Halbe (12).
RACK = [
    [1],
    [9, 2],
    [10, 8, 3],
    [4, 14, 7, 11],
    [12, 6, 15, 13, 5],
]
FOOT_SPOT = (W / 2, L / 4)
HEAD_SPOT = (W / 2, 3 * L / 4)
POCKETS = [  # (x, y, Fangradius) in m
    (0, 0, 0.072), (W, 0, 0.072), (0, L, 0.072), (W, L, 0.072),
    (0, L / 2, 0.060), (W, L / 2, 0.060),
]


def initial_state():
    P = np.zeros((16, 2))
    V = np.zeros((16, 2))
    # Kugeln liegen exakt aneinander: Abstand 2R in der Reihe,
    # Reihenabstand 2R·sin 60° = √3·R.
    for k, row in enumerate(RACK):
        for j, n in enumerate(row):
            P[n] = (FOOT_SPOT[0] + (j - k / 2) * 2 * R,
                    FOOT_SPOT[1] - k * math.sqrt(3) * R)
    P[0] = (HEAD_SPOT[0] + CUE_OFFSET, HEAD_SPOT[1])
    V[0] = (0, -V0)
    return P, V


I, J = np.triu_indices(16, 1)


def forces(P, V, alive):
    d = P[J] - P[I]
    dist = np.linalg.norm(d, axis=1)
    delta = 2 * R - dist
    c = (delta > 0) & alive[I] & alive[J]
    F = np.zeros((16, 2))
    if not c.any():
        return F, False
    n = d[c] / dist[c, None]
    dl = delta[c]
    ddot = -((V[J[c]] - V[I[c]]) * n).sum(1)  # Kompressionsrate
    meff = M / 2
    f = K_HERTZ * dl**1.5 + DAMP * 2 * math.sqrt(meff * K_HERTZ) * dl**0.25 * ddot
    f = np.maximum(f, 0)  # keine Anziehung
    np.add.at(F, I[c], -f[:, None] * n)
    np.add.at(F, J[c], f[:, None] * n)
    return F, True


def pick_dt(P, V, alive, contact):
    if contact:
        return 1e-6
    d = P[J] - P[I]
    gap = np.linalg.norm(d, axis=1) - 2 * R
    closing = -((V[J] - V[I]) * d).sum(1) / np.maximum(np.linalg.norm(d, axis=1), 1e-12)
    m = alive[I] & alive[J] & (closing > 1e-9)
    if not m.any():
        return 2e-4
    tmin = (np.maximum(gap[m], 0) / closing[m]).min()
    return float(np.clip(0.5 * tmin, 1e-6, 2e-4))


def simulate():
    P, V = initial_state()
    alive = np.ones(16, bool)
    pocketed = {}
    frames = []
    t, t_next = 0.0, 0.0
    F, contact = forces(P, V, alive)
    while t < T_END:
        if t >= t_next - 1e-12:
            frames.append((P.copy(), alive.copy()))
            t_next += DT_OUT
        dt = min(pick_dt(P, V, alive, contact), t_next - t)
        # Velocity-Verlet
        V += 0.5 * dt * F / M
        P[alive] += V[alive] * dt
        F, contact = forces(P, V, alive)
        V += 0.5 * dt * F / M
        # Rollreibung (nur ohne Kontakt relevant, sonst vernachlässigbar)
        sp = np.linalg.norm(V, axis=1)
        mv = sp > 0
        V[mv] *= (np.maximum(sp[mv] - DECEL * dt, 0) / sp[mv])[:, None]
        # Taschen und Banden
        for i in np.nonzero(alive)[0]:
            for pi, (px, py, rc) in enumerate(POCKETS):
                if (P[i, 0] - px) ** 2 + (P[i, 1] - py) ** 2 < rc * rc:
                    alive[i] = False
                    pocketed[int(i)] = {"t": t + dt, "pocket": pi}
                    V[i] = 0
                    break
            if not alive[i]:
                continue
            for ax, lo, hi in ((0, R, W - R), (1, R, L - R)):
                if P[i, ax] < lo and V[i, ax] < 0:
                    P[i, ax] = 2 * lo - P[i, ax]
                    V[i, ax] *= -E_RAIL
                    V[i, 1 - ax] *= RAIL_TANGENT
                elif P[i, ax] > hi and V[i, ax] > 0:
                    P[i, ax] = 2 * hi - P[i, ax]
                    V[i, ax] *= -E_RAIL
                    V[i, 1 - ax] *= RAIL_TANGENT
        t += dt
    return frames, pocketed


if __name__ == "__main__":
    frames, pocketed = simulate()
    settle = 0
    for k in range(1, len(frames)):
        a = frames[k][1]
        if np.abs(frames[k][0][a] - frames[k - 1][0][a]).max() > 2e-5:
            settle = k * DT_OUT
    mm = 1000
    out = {
        "R": R * mm, "W": W * mm, "L": L * mm,
        "pockets": [(x * mm, y * mm, r * mm) for x, y, r in POCKETS],
        "rack": RACK, "dt": DT_OUT, "pocketed": pocketed, "settle": settle,
        "frames": [[(p * mm).round(2).tolist(), a.tolist()] for p, a in frames],
    }
    json.dump(out, open(sys.argv[5] if len(sys.argv) > 5 else "sim.json", "w"))
    print(f"settle={settle:.2f}s pocketed={ {k: round(v['t'], 2) for k, v in pocketed.items()} }")
