// Kleine Billard-Physik für die Sieges-Animation.
//
// Maße wie ein Kneipentisch (7 Fuß): Spielfläche 99 × 198 cm, Kugeln 57 mm.
// Gerechnet wird in Tischbreiten (Spielfläche = 1 × 2), hochkant.
// Die Kugeln sind gut 10 % größer als echt, damit die Buchstaben lesbar bleiben.
//
// Ablauf: Der Planer würfelt Lage und Stoß (direkt, mit Schnitt oder über
// die Bande), rechnet rückwärts aus, wie fest gestoßen werden muss, damit
// die Kugel langsam in die Tasche „schleicht“, und spielt den Stoß dann mit
// echter Physik durch (Rollreibung, Bande, Kugel gegen Kugel). Nur Stöße,
// bei denen genau das Gewünschte passiert, werden genommen – was am Ende zu
// sehen ist, ist also immer die echte Simulation.

export type Vec = { x: number; y: number };

export const FIELD_W = 1;
export const FIELD_H = 2;
export const R = (0.057 / 0.99 / 2) * 1.12; // Kugelradius
const DECEL = 0.42; // Rollreibung (Tischbreiten / s²)
const E_RAIL = 0.74; // Bande: so viel Tempo bleibt senkrecht zur Bande
const RAIL_SLIDE = 0.96; // … und so viel entlang der Bande
const E_BALL = 0.95;
const VMAX = 3.4; // härtester Stoß
const DT = 1 / 400;
export const FPS = 60;

export type Pocket = Vec & { capture: number; corner: boolean };

// Ecktaschen sitzen knapp hinter der Ecke, Mitteltaschen in der langen Bande.
export const POCKETS: Pocket[] = [
  { x: -0.3 * R, y: -0.3 * R, capture: 2.0 * R, corner: true },
  { x: FIELD_W + 0.3 * R, y: -0.3 * R, capture: 2.0 * R, corner: true },
  { x: -0.3 * R, y: FIELD_H + 0.3 * R, capture: 2.0 * R, corner: true },
  { x: FIELD_W + 0.3 * R, y: FIELD_H + 0.3 * R, capture: 2.0 * R, corner: true },
  { x: -0.75 * R, y: FIELD_H / 2, capture: 1.95 * R, corner: false },
  { x: FIELD_W + 0.75 * R, y: FIELD_H / 2, capture: 1.95 * R, corner: false },
];

// ---------------------------------------------------------------- Zufall

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
type Rand = () => number;
const between = (r: Rand, a: number, b: number) => a + (b - a) * r();

// ---------------------------------------------------------------- Vektoren

const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const len = (a: Vec) => Math.hypot(a.x, a.y);
const norm = (a: Vec): Vec => {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
};
const rot = (a: Vec, ang: number): Vec => ({
  x: a.x * Math.cos(ang) - a.y * Math.sin(ang),
  y: a.x * Math.sin(ang) + a.y * Math.cos(ang),
});
const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------- Physik

type Body = Vec & { vx: number; vy: number; potted: number; pocket: number };

export type Sim = {
  balls: Body[];
  t: number;
  firstHit: number[]; // erste Kugel, die jede Kugel berührt (-1 = keine)
  touched: boolean[];
  hits: { t: number; x: number; y: number }[];
  follow: number[]; // Nachlauf der stoßenden Kugel nach dem Treffer
  railHits: number[];
};

function newSim(pos: Vec[]): Sim {
  return {
    balls: pos.map((p) => ({ x: p.x, y: p.y, vx: 0, vy: 0, potted: -1, pocket: -1 })),
    t: 0,
    firstHit: pos.map(() => -1),
    touched: pos.map(() => false),
    hits: [],
    follow: pos.map(() => 0),
    railHits: pos.map(() => 0),
  };
}

function cloneSim(s: Sim): Sim {
  return {
    balls: s.balls.map((b) => ({ ...b })),
    t: s.t,
    firstHit: [...s.firstHit],
    touched: [...s.touched],
    hits: [...s.hits],
    follow: [...s.follow],
    railHits: [...s.railHits],
  };
}

const live = (b: Body) => b.potted < 0;
const moving = (b: Body) => live(b) && (b.vx !== 0 || b.vy !== 0);

// Zeit bis zur Berührung zweier Kugeln bei gleichförmiger Bewegung.
function toi(a: Body, b: Body, maxT: number) {
  const px = b.x - a.x, py = b.y - a.y;
  const vx = b.vx - a.vx, vy = b.vy - a.vy;
  const A = vx * vx + vy * vy;
  if (A < 1e-14) return Infinity;
  const B = 2 * (px * vx + py * vy);
  if (B >= 0) return Infinity; // entfernen sich
  const C = px * px + py * py - 4 * R * R;
  const D = B * B - 4 * A * C;
  if (D < 0) return Infinity;
  const t = (-B - Math.sqrt(D)) / (2 * A);
  if (t < -1e-9 || t > maxT) return Infinity;
  return Math.max(0, t);
}

function advance(s: Sim, dt: number) {
  for (const b of s.balls) {
    if (!moving(b)) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  s.t += dt;
}

function collide(s: Sim, i: number, j: number) {
  const a = s.balls[i], b = s.balls[j];
  const n = norm(sub(b, a));
  const vr = (a.vx - b.vx) * n.x + (a.vy - b.vy) * n.y;
  if (vr <= 0) return;
  const jmp = ((1 + E_BALL) / 2) * vr;
  a.vx -= jmp * n.x; a.vy -= jmp * n.y;
  b.vx += jmp * n.x; b.vy += jmp * n.y;
  // Nachlauf: eine rollende Kugel läuft nach dem Treffer etwas nach vorn weiter.
  if (s.follow[i] > 0) { a.vx += s.follow[i] * jmp * n.x; a.vy += s.follow[i] * jmp * n.y; s.follow[i] = 0; }
  if (s.follow[j] > 0) { b.vx -= s.follow[j] * jmp * n.x; b.vy -= s.follow[j] * jmp * n.y; s.follow[j] = 0; }
  if (s.firstHit[i] < 0) s.firstHit[i] = j;
  if (s.firstHit[j] < 0) s.firstHit[j] = i;
  s.touched[i] = s.touched[j] = true;
  s.hits.push({ t: s.t, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
}

function step(s: Sim) {
  let left = DT;
  for (let guard = 0; guard < 6 && left > 1e-12; guard++) {
    let best = Infinity, bi = -1, bj = -1;
    const n = s.balls.length;
    for (let i = 0; i < n; i++) {
      const a = s.balls[i];
      if (!live(a)) continue;
      for (let j = i + 1; j < n; j++) {
        const b = s.balls[j];
        if (!live(b) || (!moving(a) && !moving(b))) continue;
        const t = toi(a, b, left);
        if (t < best) { best = t; bi = i; bj = j; }
      }
    }
    if (bi < 0) { advance(s, left); left = 0; break; }
    advance(s, best);
    left -= best;
    collide(s, bi, bj);
  }

  for (let i = 0; i < s.balls.length; i++) {
    const b = s.balls[i];
    if (!live(b)) continue;
    // Taschen zuerst, dann Bande.
    for (let k = 0; k < POCKETS.length; k++) {
      const p = POCKETS[k];
      if (dist(b, p) < p.capture) {
        b.potted = s.t;
        b.pocket = k;
        break;
      }
    }
    if (!live(b)) continue;
    let hit = false;
    if (b.x < R) { b.x = 2 * R - b.x; b.vx = -b.vx * E_RAIL; b.vy *= RAIL_SLIDE; hit = true; }
    if (b.x > FIELD_W - R) { b.x = 2 * (FIELD_W - R) - b.x; b.vx = -b.vx * E_RAIL; b.vy *= RAIL_SLIDE; hit = true; }
    if (b.y < R) { b.y = 2 * R - b.y; b.vy = -b.vy * E_RAIL; b.vx *= RAIL_SLIDE; hit = true; }
    if (b.y > FIELD_H - R) { b.y = 2 * (FIELD_H - R) - b.y; b.vy = -b.vy * E_RAIL; b.vx *= RAIL_SLIDE; hit = true; }
    if (hit) s.railHits[i]++;
    // Rollreibung
    const sp = Math.hypot(b.vx, b.vy);
    if (sp > 0) {
      const ns = sp - DECEL * DT;
      if (ns <= 0.004) { b.vx = b.vy = 0; } else { b.vx *= ns / sp; b.vy *= ns / sp; }
    }
  }
}

// Läuft, bis alles liegt. frames: Lage aller Kugeln im Takt von FPS.
function runUntilRest(s: Sim, frames: Vec[][] | null, maxT = 9, abort?: () => boolean) {
  const t0 = s.t;
  let next = s.t;
  const snap = () => frames?.push(s.balls.map((b) => ({ x: b.x, y: b.y })));
  while (s.t - t0 < maxT) {
    if (frames && s.t >= next - 1e-9) { snap(); next += 1 / FPS; }
    if (!s.balls.some(moving)) break;
    step(s);
    if (abort?.()) return false;
  }
  snap();
  return s.t - t0 < maxT;
}

// ---------------------------------------------------------------- Planung

type Path = { dir: Vec; v0: number; kind: "direct" | "bank"; pocket: number };

// Wie schnell muss die Objektkugel starten, damit sie mit va an der Tasche ankommt?
const speedFor = (s: number, va: number) => Math.sqrt(va * va + 2 * DECEL * s);

function directPath(L: Vec, k: number, va: number): Path | null {
  const p = POCKETS[k];
  const d = dist(L, p);
  const s = d - p.capture * 0.75;
  if (s < 4 * R) return null;
  const dir = norm(sub(p, L));
  // Ecktaschen nur aus einem sinnvollen Winkel anspielen.
  if (p.corner) {
    const diag = norm({ x: p.x < 0.5 ? -1 : 1, y: p.y < 1 ? -1 : 1 });
    if (dir.x * diag.x + dir.y * diag.y < Math.cos((50 * Math.PI) / 180)) return null;
  } else {
    if (Math.abs(dir.x) < Math.cos((52 * Math.PI) / 180)) return null;
  }
  return { dir, v0: speedFor(s, va), kind: "direct", pocket: k };
}

// Über eine Bande: Treffpunkt auf der Bande so suchen, dass die Kugel nach
// dem Abprall (mit Tempoverlust senkrecht zur Bande) genau zur Tasche läuft.
function bankPath(L: Vec, k: number, va: number, side: number): Path | null {
  const p = POCKETS[k];
  // side: 0 links, 1 rechts, 2 oben, 3 unten (Linie der Kugelmittelpunkte)
  const vertical = side < 2;
  const c = side === 0 ? R : side === 1 ? FIELD_W - R : side === 2 ? R : FIELD_H - R;
  // Kugel und Tasche müssen auf derselben Seite der Bande liegen und die Tasche nicht in ihr.
  const lc = vertical ? L.x : L.y;
  const pc = vertical ? p.x : p.y;
  if (Math.abs(pc - c) < 4 * R) return null;
  if ((lc - c) * (pc - c) <= 0) return null;
  const lo = (vertical ? FIELD_H : FIELD_W) * 0 + 3 * R;
  const hi = (vertical ? FIELD_H : FIELD_W) - 3 * R;
  const outDir = (t: number) => {
    const B = vertical ? { x: c, y: t } : { x: t, y: c };
    const din = norm(sub(B, L));
    const o = vertical
      ? { x: -din.x * E_RAIL, y: din.y * RAIL_SLIDE }
      : { x: din.x * RAIL_SLIDE, y: -din.y * E_RAIL };
    return { B, din, o };
  };
  const miss = (t: number) => {
    const { B, o } = outDir(t);
    const q = sub(p, B);
    return o.x * q.y - o.y * q.x;
  };
  const N = 40;
  const roots: number[] = [];
  let prev = miss(lo);
  for (let i = 1; i <= N; i++) {
    const t = lo + ((hi - lo) * i) / N;
    const m = miss(t);
    if (prev * m < 0) {
      let a = t - (hi - lo) / N, b = t, fa = prev;
      for (let it = 0; it < 40; it++) {
        const mid = (a + b) / 2, fm = miss(mid);
        if (fa * fm <= 0) b = mid; else { a = mid; fa = fm; }
      }
      roots.push((a + b) / 2);
    }
    prev = m;
  }
  for (const t of roots) {
    const { B, din, o } = outDir(t);
    const q = sub(p, B);
    if (o.x * q.x + o.y * q.y <= 0) continue; // falsche Richtung
    const s1 = dist(L, B), s2 = len(q) - p.capture * 0.75;
    if (s1 < 3 * R || s2 < 6 * R) continue;
    // Tempo vor und nach der Bande
    const k2 = len(o);
    const vAfter = speedFor(s2, va);
    const vBefore = vAfter / k2;
    return { dir: din, v0: Math.sqrt(vBefore * vBefore + 2 * DECEL * s1), kind: "bank", pocket: k };
  }
  return null;
}

function inField(p: Vec, margin: number) {
  return p.x > margin && p.x < FIELD_W - margin && p.y > margin && p.y < FIELD_H - margin;
}
const nearPocket = (p: Vec, gap: number) => POCKETS.some((k) => dist(p, k) < k.capture + gap);

export type Shot = {
  shooter: number;
  target: number;
  dir: Vec; // Stoßrichtung der stoßenden Kugel
  v: number; // Anfangstempo
  follow: number;
  kind: "direct" | "bank";
  pocket: number;
};

// Würfelt eine Lage für stoßende Kugel und Zielkugel samt Stoß.
function sampleShot(r: Rand, others: Vec[], wantBank: boolean): { W: Vec; L: Vec; shot: Omit<Shot, "shooter" | "target"> } | null {
  const L = { x: between(r, 3 * R, FIELD_W - 3 * R), y: between(r, 3 * R, FIELD_H - 3 * R) };
  if (nearPocket(L, 3 * R) || others.some((o) => dist(o, L) < 3.2 * R)) return null;
  const k = Math.floor(r() * POCKETS.length);
  // langsam ankommen = spannend; manchmal kriecht sie richtig rein
  const va = r() < 0.4 ? between(r, 0.05, 0.1) : between(r, 0.1, 0.32);
  let path: Path | null;
  if (wantBank) path = bankPath(L, k, va, Math.floor(r() * 4));
  else path = directPath(L, k, va);
  if (!path) return null;
  const objLen = path.kind === "direct" ? dist(L, POCKETS[k]) : 1;
  if (path.kind === "direct" && objLen < 0.35) return null; // zu kurz ist langweilig
  const G = { x: L.x - 2 * R * path.dir.x, y: L.y - 2 * R * path.dir.y };
  const cut = (r() < 0.5 ? -1 : 1) * between(r, 0, r() < 0.6 ? 0.45 : 0.85);
  const w = rot(path.dir, cut);
  const D = between(r, 0.18, 0.75);
  const W = { x: G.x - D * w.x, y: G.y - D * w.y };
  if (!inField(W, 1.6 * R) || nearPocket(W, 2 * R) || others.some((o) => dist(o, W) < 3.2 * R)) return null;
  const transfer = ((1 + E_BALL) / 2) * Math.cos(cut);
  const vi = path.v0 / transfer;
  const v = Math.sqrt(vi * vi + 2 * DECEL * D);
  if (v > VMAX) return null;
  const follow = r() < 0.5 ? between(r, 0, 0.12) : between(r, 0.12, 0.4);
  return { W, L, shot: { dir: w, v, follow, kind: path.kind, pocket: k } };
}

function play(s: Sim, shot: Shot, frames: Vec[][] | null, abort?: () => boolean) {
  const b = s.balls[shot.shooter];
  b.vx = shot.dir.x * shot.v;
  b.vy = shot.dir.y * shot.v;
  s.follow[shot.shooter] = shot.follow;
  s.firstHit = s.balls.map(() => -1);
  s.touched = s.balls.map(() => false);
  s.hits = [];
  return runUntilRest(s, frames, 9, abort);
}

// Prüft, ob der Stoß genau das tut, was er soll.
function shotWorks(before: Sim, shot: Shot, mustStay: number[]) {
  const s = cloneSim(before);
  const startPos = s.balls.map((b) => ({ x: b.x, y: b.y }));
  // früh abbrechen, sobald klar ist, dass es schiefgeht
  const abort = () =>
    (s.firstHit[shot.shooter] >= 0 && s.firstHit[shot.shooter] !== shot.target) ||
    s.balls[shot.shooter].potted >= 0 ||
    mustStay.some((i) => s.touched[i] || s.balls[i].potted >= 0);
  if (!play(s, shot, null, abort)) return null;
  const tb = s.balls[shot.target];
  if (tb.potted < 0) return null;
  if (s.firstHit[shot.shooter] !== shot.target) return null;
  if (s.balls[shot.shooter].potted >= 0) return null;
  for (const i of mustStay) {
    if (s.balls[i].potted >= 0 || s.touched[i]) return null;
    if (dist(startPos[i], s.balls[i]) > 1e-6) return null;
  }
  // die stoßende Kugel soll nicht klebend an einer anderen liegen bleiben
  for (let i = 0; i < s.balls.length; i++) {
    if (i === shot.shooter || s.balls[i].potted >= 0) continue;
    if (dist(s.balls[i], s.balls[shot.shooter]) < 2.3 * R) return null;
  }
  return s;
}

export type Phase =
  | { kind: "aim"; shooter: number; dir: Vec; start: number; end: number; power: number }
  | { kind: "roll"; start: number; end: number };

export type Script = {
  n: number; // Anzahl Kugeln: erst Sieger, dann Verlierer
  winners: number[];
  losers: number[];
  frames: Vec[][]; // je Frame (FPS) die Lage aller Kugeln
  potted: { ball: number; pocket: number; t: number }[];
  hits: { t: number; x: number; y: number }[];
  aims: { shooter: number; dir: Vec; start: number; strike: number; power: number }[];
  restAt: number; // ab hier liegt alles
  shots: Shot[];
};

const AIM = 0.85; // so lange zielt der Queue
const PAUSE = 0.45;

// Baut den kompletten Ablauf für 1 gegen 1 (pairs = 1) oder 2 gegen 2 (pairs = 2).
export function buildScript(pairs: 1 | 2, seed = Date.now()): Script {
  const r = rng(seed);
  for (let attempt = 0; attempt < 4000; attempt++) {
    const pos: Vec[] = [];
    const plans: { W: Vec; L: Vec; shot: Omit<Shot, "shooter" | "target"> }[] = [];
    let ok = true;
    for (let p = 0; p < pairs; p++) {
      const wantBank = r() < 0.38;
      let got = null;
      const placed = plans.flatMap((q) => [q.W, q.L]);
      for (let tries = 0; tries < 400 && !got; tries++) {
        got = sampleShot(r, placed, wantBank);
        // gleich allein durchspielen (mit den schon platzierten Kugeln als Hindernis)
        if (got) {
          const sim = newSim([got.W, got.L, ...placed]);
          const ok1 = shotWorks(sim, { ...got.shot, shooter: 0, target: 1 }, placed.map((_, i) => i + 2));
          if (!ok1) got = null;
        }
      }
      if (!got) { ok = false; break; }
      plans.push(got);
    }
    if (!ok) continue;
    // Reihenfolge der Kugeln: Sieger 0..pairs-1, Verlierer pairs..2*pairs-1
    for (const q of plans) pos.push(q.W);
    for (const q of plans) pos.push(q.L);
    const shots: Shot[] = plans.map((q, i) => ({ ...q.shot, shooter: i, target: pairs + i }));

    // Alle Stöße nacheinander prüfen, jeweils von der Lage danach aus.
    let s = newSim(pos);
    for (let i = 0; i < shots.length && ok; i++) {
      const stay = [];
      for (let j = i + 1; j < shots.length; j++) stay.push(shots[j].shooter, shots[j].target);
      const after = shotWorks(s, shots[i], stay);
      if (!after) ok = false;
      else s = after;
    }
    if (!ok) continue;

    // Jetzt wirklich abspielen und mitschreiben.
    const sim = newSim(pos);
    const frames: Vec[][] = [];
    const aims: Script["aims"] = [];
    const potted: Script["potted"] = [];
    const hits: Script["hits"] = [];
    const hold = (sec: number) => {
      const f = sim.balls.map((b) => ({ x: b.x, y: b.y }));
      for (let i = 0; i < Math.round(sec * FPS); i++) frames.push(f.map((v) => ({ ...v })));
    };
    hold(0.55); // Tisch blendet ein
    for (const shot of shots) {
      const start = frames.length / FPS;
      hold(AIM);
      aims.push({ shooter: shot.shooter, dir: shot.dir, start, strike: frames.length / FPS, power: shot.v / VMAX });
      const t0 = frames.length / FPS;
      const simT0 = sim.t;
      play(sim, shot, frames);
      for (const h of sim.hits) hits.push({ t: t0 + (h.t - simT0), x: h.x, y: h.y });
      sim.balls.forEach((b, i) => {
        if (b.potted >= 0 && !potted.some((p) => p.ball === i)) potted.push({ ball: i, pocket: b.pocket, t: t0 + (b.potted - simT0) });
      });
      hold(PAUSE);
    }

    const restAt = frames.length / FPS;
    return {
      n: pos.length,
      winners: shots.map((q) => q.shooter),
      losers: shots.map((q) => q.target),
      frames,
      potted,
      hits,
      aims,
      restAt,
      shots,
    };
  }
  throw new Error("Kein Stoß gefunden");
}
