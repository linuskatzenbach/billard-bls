"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Ball, type BallKind } from "./RankBall";

// Sieges-Animation beim Eintragen eines Ergebnisses: Unter den beiden
// gewählten Kugeln blendet sich ein Billardtisch ein, die Gewinnerkugel
// stößt die Verliererkugel in eine Tasche und jubelt danach, während die
// Elo-Änderung hochzählt. Die Kugeln bleiben dabei genau dort, wo sie in
// der Auswahl lagen. Gespeichert wird parallel im Hintergrund.
//
// Physik (gleich schwere Kugeln, elastischer Stoß): Die getroffene Kugel
// läuft entlang der Verbindungslinie der Mittelpunkte, die stoßende Kugel
// im rechten Winkel dazu weiter (bei geradem Treffer bleibt sie stehen).
// Dazu kommen Rollreibung und Abprall an der Bande.

export type VictoryBall = {
  name: string;
  label: string;
  color: string;
  kind: BallKind;
  x: number; // Mittelpunkt in Viewport-Koordinaten
  y: number;
};

export type VictoryResult = { winnerDelta: number; loserDelta: number };

export type VictoryProps = {
  winner: VictoryBall;
  loser: VictoryBall;
  radius: number;
  table: { left: number; top: number; width: number; height: number };
  result: Promise<VictoryResult>;
  onDone: (result: VictoryResult) => void;
  onError: (message: string) => void;
};

type Pt = { x: number; y: number };
type Moving = Pt & { vx: number; vy: number };

const RAIL = 14; // Breite der Holzbande in px
const HOLD = 2.4; // so lange bleibt das Ergebnis stehen (s)

function geometry(table: VictoryProps["table"], R: number) {
  const fx0 = table.left + RAIL;
  const fy0 = table.top + RAIL;
  const fx1 = table.left + table.width - RAIL;
  const fy1 = table.top + table.height - RAIL;
  const pr = Math.max(R * 1.15, 15); // Taschenradius, größer als die Kugel
  const ci = pr * 0.3;
  const pockets: Pt[] = [
    { x: fx0 + ci, y: fy0 + ci },
    { x: fx1 - ci, y: fy0 + ci },
    { x: fx0 + ci, y: fy1 - ci },
    { x: fx1 - ci, y: fy1 - ci },
  ];
  // Mitteltaschen sitzen an den langen Seiten.
  if (table.height > table.width) {
    pockets.push({ x: fx0 - pr * 0.2, y: (fy0 + fy1) / 2 }, { x: fx1 + pr * 0.2, y: (fy0 + fy1) / 2 });
  } else {
    pockets.push({ x: (fx0 + fx1) / 2, y: fy0 - pr * 0.2 }, { x: (fx0 + fx1) / 2, y: fy1 + pr * 0.2 });
  }
  return {
    pockets,
    pr,
    minX: fx0 + R,
    maxX: fx1 - R,
    minY: fy0 + R,
    maxY: fy1 - R,
  };
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export default function VictoryAnimation({
  winner,
  loser,
  radius: R,
  table,
  result,
  onDone,
  onError,
}: VictoryProps) {
  const geo = useMemo(() => geometry(table, R), [table, R]);
  const rootRef = useRef<HTMLDivElement>(null);
  const winnerRef = useRef<HTMLDivElement>(null);
  const loserRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const ring1Ref = useRef<HTMLDivElement>(null);
  const ring2Ref = useRef<HTMLDivElement>(null);
  const winDeltaRef = useRef<HTMLSpanElement>(null);
  const loseDeltaRef = useRef<HTMLSpanElement>(null);
  const tapRef = useRef<() => void>(() => {});
  const [showResult, setShowResult] = useState(false);
  const [closing, setClosing] = useState(false);
  const [waiting, setWaiting] = useState(false);

  // Ringfarbe: schwarze Kugel bekommt cremefarbene Ringe, sonst die Kugelfarbe.
  const ringColor = winner.color === "#151515" ? "#f1e9d8" : winner.color;

  useEffect(() => {
    const { pockets, pr, minX, maxX, minY, maxY } = geo;
    const SAFE = pr + R + 18;
    const W: Pt = { x: winner.x, y: winner.y };
    const L: Pt = { x: loser.x, y: loser.y };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const pocketDist = (x: number, y: number) =>
      Math.min(...pockets.map((p) => Math.hypot(p.x - x, p.y - y)));

    function step(b: Moving, fr: number, dt: number) {
      const sp = Math.hypot(b.vx, b.vy);
      // In Taschennähe bremst die Gewinnerkugel stärker, damit sie nie hineinrollt.
      const a = pocketDist(b.x, b.y) < SAFE + 15 ? fr * 4 : fr;
      if (sp > 0.5) {
        const ns = Math.max(0, sp - a * dt);
        b.vx *= ns / sp;
        b.vy *= ns / sp;
      } else {
        b.vx = b.vy = 0;
      }
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < minX) { b.x = minX; b.vx = -b.vx * 0.7; }
      if (b.x > maxX) { b.x = maxX; b.vx = -b.vx * 0.7; }
      if (b.y < minY) { b.y = minY; b.vy = -b.vy * 0.7; }
      if (b.y > maxY) { b.y = maxY; b.vy = -b.vy * 0.7; }
    }

    // Für jede Tasche: Wo muss die Gewinnerkugel treffen (C), wie schnell,
    // und wo bleibt sie danach liegen? Die Bahn wird vorab simuliert.
    type Shot = {
      p: Pt; d: number; u: Pt; C: Pt; D: number; cos: number; vh: Pt;
      v0: number; fr: number; s1: number; minPd: number; end: Pt;
    };
    const shots: Shot[] = [];
    for (const p of pockets) {
      const d = Math.hypot(p.x - L.x, p.y - L.y);
      if (d < 1) continue;
      const u = { x: (p.x - L.x) / d, y: (p.y - L.y) / d };
      const C = { x: L.x - u.x * 2 * R, y: L.y - u.y * 2 * R };
      const D = Math.hypot(C.x - W.x, C.y - W.y);
      if (D < 1) continue;
      const vh = { x: (C.x - W.x) / D, y: (C.y - W.y) / D };
      const cos = vh.x * u.x + vh.y * u.y;
      if (C.x < minX - 2 || C.x > maxX + 2 || C.y < minY - 2 || C.y > maxY + 2 || cos <= 0.2) continue;
      const T = 0.75, k = 0.75;
      const v0 = (2 * D) / (T * (1 + k));
      const fr = ((1 - k) * v0) / T;
      const s1 = k * v0;
      const w: Moving = { x: C.x, y: C.y, vx: s1 * (vh.x - cos * u.x), vy: s1 * (vh.y - cos * u.y) };
      let minPd = pocketDist(w.x, w.y);
      for (let n = 0; n < 2000 && Math.hypot(w.vx, w.vy) > 0.5; n++) {
        step(w, fr, 1 / 120);
        minPd = Math.min(minPd, pocketDist(w.x, w.y));
      }
      shots.push({ p, d, u, C, D, cos, vh, v0, fr, s1, minPd, end: { x: w.x, y: w.y } });
    }
    const score = (s: Shot) => s.d + s.D * 0.3 + (1 - s.cos) * 300;
    const good = shots.filter((s) => s.cos > 0.45 && s.minPd >= SAFE).sort((a, b) => score(a) - score(b));
    const S: Shot | undefined = good[0] ?? [...shots].sort((a, b) => b.minPd - a.minPd)[0];

    // Bewegungsprofil der Verliererkugel: rollt bremsend bis in die Tasche.
    const nearest = pockets.reduce((a, p) =>
      Math.hypot(p.x - L.x, p.y - L.y) < Math.hypot(a.x - L.x, a.y - L.y) ? p : a
    );
    const vn = S ? Math.max(S.s1 * S.cos, 60) : 0;
    const va = 0.35 * vn;
    const al = S ? (vn * vn - va * va) / (2 * S.d) : 1;
    const ta = S ? (vn - va) / al : 0;

    const put = (el: HTMLElement | null, x: number, y: number, s: number) => {
      if (el) el.style.transform = `translate(${x - R}px, ${y - R}px) scale(${s})`;
    };
    const ring = (el: HTMLElement | null, x: number, y: number, r: number, o: number) => {
      if (!el) return;
      el.style.display = "block";
      el.style.width = el.style.height = `${2 * r}px`;
      el.style.transform = `translate(${x - r}px, ${y - r}px)`;
      el.style.opacity = String(o);
    };
    const hide = (el: HTMLElement | null) => {
      if (el) el.style.display = "none";
    };

    let w: Moving = { x: W.x, y: W.y, vx: 0, vy: 0 };
    let lx = L.x, ly = L.y, ls = 1, sunk = false;
    let ph = 0; // 0 Tisch erscheint, 1 Anlauf, 2 nach dem Stoß, 3 fertig
    let tc = 0, th = -1, fin = -1, celeb = -1, closeAt = -1;
    let res: VictoryResult | null = null;
    let resAt = -1;
    let t = 0;
    let t0: number | null = null;
    let last = 0;
    let raf = 0;
    let alive = true;
    let doneCalled = false;
    let waitShown = false;

    function snapToEnd() {
      if (S) { w = { ...S.end, vx: 0, vy: 0 }; } else { w = { x: W.x, y: W.y, vx: 0, vy: 0 }; }
      ls = 0;
      sunk = true;
      ph = 3;
      fin = t;
      hide(hitRef.current);
    }

    function close() {
      if (closeAt >= 0) return;
      closeAt = t;
      setClosing(true);
    }

    tapRef.current = () => {
      if (ph < 3) snapToEnd();
      else if (res) close();
    };

    result.then(
      (r) => { if (alive) { res = r; resAt = t; } },
      (e: unknown) => {
        if (!alive) return;
        alive = false;
        cancelAnimationFrame(raf);
        onError(e instanceof Error ? e.message : "Etwas ist schiefgelaufen.");
      }
    );

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function frame(now: number) {
      if (!alive) return;
      if (t0 === null) { t0 = last = now; }
      t = (now - t0) / 1000;
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;

      if (reduced && ph < 3) snapToEnd();

      if (ph === 0 && t > 0.6) {
        if (S) { ph = 1; tc = t; }
        else { ph = 2; th = t; } // Notfall ohne sinnvollen Stoß: Kugel verschwindet in der nächsten Tasche
      }

      if (ph === 1 && S) {
        const tau = t - tc;
        const tr = S.v0 * tau - 0.5 * S.fr * tau * tau;
        if (tr >= S.D) {
          w = { x: S.C.x, y: S.C.y, vx: S.s1 * (S.vh.x - S.cos * S.u.x), vy: S.s1 * (S.vh.y - S.cos * S.u.y) };
          ph = 2;
          th = t;
        } else {
          w.x = W.x + S.vh.x * tr;
          w.y = W.y + S.vh.y * tr;
        }
      }

      if (ph === 2) {
        const tau = t - th;
        if (S) {
          step(w, S.fr, dt);
          if (tau < ta) {
            const s = vn * tau - 0.5 * al * tau * tau;
            lx = L.x + S.u.x * s;
            ly = L.y + S.u.y * s;
          } else {
            lx = S.p.x;
            ly = S.p.y;
            const q = clamp01((tau - ta) / 0.2);
            ls = 1 - 0.45 * q - 0.55 * q * q;
            if (q >= 1) sunk = true;
          }
          const q = (t - th) / 0.3;
          const hx = S.C.x + S.u.x * R, hy = S.C.y + S.u.y * R;
          if (q < 1) ring(hitRef.current, hx, hy, 6 + 20 * q, (1 - q) * 0.8);
          else hide(hitRef.current);
        } else {
          const q = clamp01(tau / 0.5);
          lx = L.x + (nearest.x - L.x) * q;
          ly = L.y + (nearest.y - L.y) * q;
          ls = 1 - q * q;
          if (q >= 1) sunk = true;
        }
        if (sunk && Math.hypot(w.vx, w.vy) < 1) { ph = 3; fin = t; }
      }

      // Jubel der Gewinnerkugel startet, sobald sie liegt UND gespeichert ist.
      if (ph === 3 && !res && !waitShown) {
        waitShown = true;
        setWaiting(true);
      }
      if (ph === 3 && res && celeb < 0) {
        celeb = Math.max(t, resAt);
        setShowResult(true);
      }

      let ws = 1;
      if (celeb >= 0) {
        const g = (t - celeb) / 0.7;
        if (!reduced && g < 1) {
          ws = g < 0.62
            ? 1 + 0.28 * Math.sin(Math.PI * Math.min(1, g * 1.6))
            : 1 + 0.1 * Math.sin((Math.PI * (g - 0.62)) / 0.38);
        }
        if (!reduced) {
          ([[ring1Ref.current, 0], [ring2Ref.current, 0.18]] as const).forEach(([el, o]) => {
            const q = (t - celeb - o) / 0.55;
            if (q >= 0 && q < 1) ring(el, w.x, w.y, R + 4 + 26 * q, (1 - q) * 0.9);
            else hide(el);
          });
        }
        const e = reduced ? 1 : clamp01((t - celeb) / 0.7);
        const ease = 1 - (1 - e) * (1 - e);
        if (res && winDeltaRef.current && loseDeltaRef.current) {
          const wd = Math.round(res.winnerDelta * ease);
          const ld = Math.round(Math.abs(res.loserDelta) * ease);
          winDeltaRef.current.textContent = `+${wd}`;
          loseDeltaRef.current.textContent = `−${ld}`;
        }
        if (t - celeb > HOLD) close();
      }

      put(winnerRef.current, w.x, w.y, ws);
      put(loserRef.current, lx, ly, Math.max(ls, 0.001));
      if (sunk && loserRef.current) loserRef.current.style.opacity = "0";

      if (closeAt >= 0 && t - closeAt > 0.32) {
        alive = false;
        if (!doneCalled && res) { doneCalled = true; onDone(res); }
        return;
      }
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      document.body.style.overflow = prevOverflow;
    };
    // Die Animation läuft genau einmal pro Einblendung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ergebnis unter dem Tisch, sonst darüber, sonst mittig auf dem Filz.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const tableBottom = table.top + table.height;
  const resultStyle: React.CSSProperties =
    vh - tableBottom >= 64
      ? { top: tableBottom + 12 }
      : table.top >= 64
        ? { top: table.top - 56 }
        : { top: table.top + table.height / 2 - 26 };

  const ballStyle = (b: VictoryBall): React.CSSProperties => ({
    width: 2 * R,
    height: 2 * R,
    transform: `translate(${b.x - R}px, ${b.y - R}px)`,
  });

  return (
    <div
      ref={rootRef}
      className={`victory${closing ? " closing" : ""}`}
      role="dialog"
      aria-label={`${winner.name} schlägt ${loser.name}`}
      onClick={() => tapRef.current()}
    >
      <div className="victory-backdrop" />
      <div
        className="victory-table"
        style={{ left: table.left, top: table.top, width: table.width, height: table.height }}
      >
        <div className="victory-felt" style={{ inset: RAIL }} />
      </div>
      {geo.pockets.map((p, i) => (
        <div
          key={i}
          className="victory-pocket"
          style={{ left: p.x - geo.pr, top: p.y - geo.pr, width: 2 * geo.pr, height: 2 * geo.pr }}
        />
      ))}
      <div ref={hitRef} className="victory-ring" style={{ borderColor: "#f1e9d8" }} />
      <div ref={ring1Ref} className="victory-ring" style={{ borderColor: ringColor }} />
      <div ref={ring2Ref} className="victory-ring" style={{ borderColor: ringColor }} />
      <div ref={loserRef} className="victory-ball" style={ballStyle(loser)}>
        <Ball label={loser.label} color={loser.color} kind={loser.kind} />
      </div>
      <div ref={winnerRef} className="victory-ball" style={ballStyle(winner)}>
        <Ball label={winner.label} color={winner.color} kind={winner.kind} />
      </div>
      <div className="victory-result" style={resultStyle} aria-live="polite">
        {showResult ? (
          <>
            <p>
              <strong>{winner.name}</strong> schlägt {loser.name}
            </p>
            <p className="victory-elo">
              <span ref={winDeltaRef} className="victory-up">+0</span>
              <span className="victory-sep"> / </span>
              <span ref={loseDeltaRef} className="victory-down">−0</span> Elo
            </p>
          </>
        ) : waiting ? (
          <p className="victory-wait">Speichert…</p>
        ) : null}
      </div>
    </div>
  );
}
