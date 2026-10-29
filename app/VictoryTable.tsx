"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Ball, type BallKind } from "./RankBall";
import { buildScript, FIELD_H, FIELD_W, FPS, POCKETS, R, type Script, type Vec } from "@/lib/billiards";

// Sieges-Animation (neu): Ein Billardtisch über die ganze Breite, die
// Kugeln werden frei aufgestellt (links Sieger, rechts Verlierer bzw. im
// Doppel beliebig). Der Queue zielt, stößt, und die Siegerkugel locht die
// Verliererkugel ein – direkt, mit Schnitt oder über die Bande, mal hart,
// mal schleicht sie langsam in die Tasche. Im Doppel locht jeder Sieger
// eine Kugel ein. Alles, was zu sehen ist,
// ist die echte Simulation aus lib/billiards.ts.

export type TablePlayer = { name: string; label: string; color: string; kind: BallKind };
export type VictoryResult = { winnerDelta: number; loserDelta: number };

export type VictoryTableProps = {
  winners: TablePlayer[];
  losers: TablePlayer[];
  result: Promise<VictoryResult>;
  onDone: (result: VictoryResult) => void;
  onError: (message: string) => void;
  seed?: number;
};

const HOLD = 2.6; // so lange bleibt das Ergebnis stehen (s)
const RAIL = 0.075; // Holzbande, in Tischbreiten
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

type Layout = { s: number; fx: number; fy: number; rail: number; resultTop: number };

function measure(): Layout {
  const vw = window.visualViewport?.width ?? window.innerWidth;
  const vh = window.visualViewport?.height ?? window.innerHeight;
  // sichere Ränder (Notch, Home-Balken) über ein unsichtbares Messelement
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)";
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const safeTop = parseFloat(cs.paddingTop) || 0;
  const safeBottom = parseFloat(cs.paddingBottom) || 0;
  probe.remove();
  const top = 12 + safeTop;
  const bottom = 92 + safeBottom; // Platz für Ergebnis und Elo
  const s = Math.min((vw - 12) / (FIELD_W + 2 * RAIL), (vh - top - bottom) / (FIELD_H + 2 * RAIL));
  const tw = s * (FIELD_W + 2 * RAIL), th = s * (FIELD_H + 2 * RAIL);
  const left = (vw - tw) / 2;
  const tableTop = top + Math.max(0, (vh - top - bottom - th) / 2);
  return { s, fx: left + RAIL * s, fy: tableTop + RAIL * s, rail: RAIL * s, resultTop: tableTop + th + 14 };
}

// Lage der Beschriftung auf der rollenden Kugel (Einheitsvektor, z zum Betrachter).
type V3 = [number, number, number];
function rollLabels(sc: Script): V3[][] {
  const out: V3[][] = [];
  let cur: V3[] = Array.from({ length: sc.n }, () => [0, 0, 1] as V3);
  out.push(cur);
  for (let f = 1; f < sc.frames.length; f++) {
    cur = cur.map((n, i) => {
      const a = sc.frames[f - 1][i], b = sc.frames[f][i];
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d < 1e-9) return n;
      // Drehachse liegt in der Tischebene, senkrecht zur Bewegung.
      const kx = -dy / d, ky = dx / d;
      const ang = d / R;
      const c = Math.cos(ang), s = Math.sin(ang);
      const dot = kx * n[0] + ky * n[1];
      // Rodrigues: n' = n c + (k × n) s + k (k·n)(1 − c), k = (kx, ky, 0)
      const cx = ky * n[2], cy = -kx * n[2], cz = kx * n[1] - ky * n[0];
      return [
        n[0] * c + cx * s + kx * dot * (1 - c),
        n[1] * c + cy * s + ky * dot * (1 - c),
        n[2] * c + cz * s,
      ];
    });
    out.push(cur);
  }
  return out;
}

export default function VictoryTable({ winners, losers, result, onDone, onError, seed }: VictoryTableProps) {
  const pairs = (winners.length === 2 && losers.length === 2 ? 2 : 1) as 1 | 2;
  const script = useMemo(() => buildScript(pairs, seed ?? Date.now()), [pairs, seed]);
  const labels = useMemo(() => rollLabels(script), [script]);
  const [lay, setLay] = useState<Layout | null>(null);
  const players = useMemo(() => [...winners.slice(0, pairs), ...losers.slice(0, pairs)], [winners, losers, pairs]);

  const ballRefs = useRef<(HTMLDivElement | null)[]>([]);
  const cueRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const ringRefs = useRef<(HTMLDivElement | null)[]>([]);
  const winDeltaRef = useRef<HTMLSpanElement>(null);
  const loseDeltaRef = useRef<HTMLSpanElement>(null);
  const tapRef = useRef<() => void>(() => {});
  const [showResult, setShowResult] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    setLay(measure());
  }, []);

  useEffect(() => {
    if (!lay) return;
    const { s, fx, fy } = lay;
    const rp = R * s;
    const px = (v: Vec) => ({ x: fx + v.x * s, y: fy + v.y * s });
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const last = script.frames.length - 1;
    const pottedAt = new Map(script.potted.map((p) => [p.ball, p]));

    let t = reduced ? script.restAt : 0;
    let t0: number | null = null;
    let offset = t;
    let raf = 0;
    let alive = true;
    let res: VictoryResult | null = null;
    let resAt = -1;
    let celeb = -1;
    let closeAt = -1;
    let done = false;
    let waitShown = false;

    const ring = (el: HTMLElement | null, c: Vec, r: number, o: number) => {
      if (!el) return;
      el.style.display = "block";
      el.style.width = el.style.height = `${2 * r}px`;
      el.style.transform = `translate(${c.x - r}px, ${c.y - r}px)`;
      el.style.opacity = String(o);
    };
    const hide = (el: HTMLElement | null) => {
      if (el) el.style.display = "none";
    };

    function close() {
      if (closeAt >= 0) return;
      closeAt = t;
      setClosing(true);
    }
    tapRef.current = () => {
      if (t < script.restAt) {
        if (t0 !== null) t0 -= (script.restAt - t) * 1000;
        else offset = script.restAt;
      } else if (res) close();
    };

    result.then(
      (r) => {
        if (alive) { res = r; resAt = t; }
      },
      (e: unknown) => {
        if (!alive) return;
        alive = false;
        cancelAnimationFrame(raf);
        onError(e instanceof Error ? e.message : "Etwas ist schiefgelaufen.");
      }
    );

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function drawBalls(fi: number) {
      const frame = script.frames[Math.min(fi, last)];
      for (let i = 0; i < script.n; i++) {
        const el = ballRefs.current[i];
        if (!el) continue;
        let p = px(frame[i]);
        let scale = 1;
        let op = 1;
        const pot = pottedAt.get(i);
        if (pot && t >= pot.t) {
          // fällt in die Tasche: zur Mitte rutschen, kleiner und dunkler werden
          const q = clamp01((t - pot.t) / 0.28);
          const pk = px(POCKETS[pot.pocket]);
          p = { x: p.x + (pk.x - p.x) * q, y: p.y + (pk.y - p.y) * q };
          scale = 1 - 0.45 * q;
          op = 1 - q * q;
        }
        // Jubel: Sieger hüpfen
        if (celeb >= 0 && script.winners.includes(i) && !reduced) {
          const g = (t - celeb - script.winners.indexOf(i) * 0.12) / 0.7;
          if (g > 0 && g < 1) {
            scale *= g < 0.62 ? 1 + 0.3 * Math.sin(Math.PI * Math.min(1, g * 1.6)) : 1 + 0.1 * Math.sin((Math.PI * (g - 0.62)) / 0.38);
          }
        }
        el.style.transform = `translate(${p.x - rp}px, ${p.y - rp}px) scale(${scale})`;
        el.style.opacity = String(Math.max(op, 0));
        if (op <= 0.001) el.style.visibility = "hidden";
        // rollende Beschriftung
        const n = labels[Math.min(fi, last)][i];
        const disc = el.querySelector<HTMLElement>(".ball-number");
        if (disc) {
          if (n[2] <= 0.05) disc.style.opacity = "0";
          else {
            const off = 0.92 * rp;
            const ang = Math.atan2(n[1], n[0]);
            const sq = Math.max(0.05, n[2]);
            disc.style.opacity = "1";
            disc.style.transform = `translate(${n[0] * off}px, ${n[1] * off}px) rotate(${ang}rad) scaleX(${sq}) rotate(${-ang}rad)`;
          }
        }
      }
    }

    function drawCue() {
      const el = cueRef.current;
      if (!el) return;
      const aim = script.aims.find((a) => t >= a.start && t < a.strike + 0.5);
      if (!aim || reduced) { el.style.opacity = "0"; return; }
      const fi = Math.round(aim.start * FPS);
      const ball = px(script.frames[fi][aim.shooter]);
      const { dir, power } = aim;
      const into = t - aim.start;
      const dur = aim.strike - aim.start;
      let gap: number;
      let op = 1;
      const back = rp * (2.2 + 4.5 * power); // Ausholen, je fester desto weiter
      if (t < aim.strike) {
        const q = into / dur;
        if (q < 0.25) { gap = rp * 3.2 - rp * 1.6 * (q / 0.25); op = q / 0.25; }
        else if (q < 0.45) gap = rp * 1.6 + rp * 0.5 * Math.sin(((q - 0.25) / 0.2) * Math.PI); // kurzes Anvisieren
        else if (q < 0.82) gap = rp * 1.6 + back * Math.sin((((q - 0.45) / 0.37) * Math.PI) / 2);
        else { const k = (q - 0.82) / 0.18; gap = rp * 1.6 + back - (back + rp * 0.6) * k * k; }
      } else {
        const k = clamp01((t - aim.strike) / 0.5);
        gap = rp * 1.0 - rp * 1.5 * Math.min(1, k * 3); // durchschwingen
        op = 1 - k;
      }
      const tip = { x: ball.x - dir.x * (rp + gap), y: ball.y - dir.y * (rp + gap) };
      const ang = Math.atan2(-dir.y, -dir.x);
      const h = el.offsetHeight;
      el.style.opacity = String(op);
      el.style.transform = `translate(${tip.x}px, ${tip.y - h / 2}px) rotate(${ang}rad)`;
    }

    function frame(now: number) {
      if (!alive) return;
      if (t0 === null) t0 = now - offset * 1000;
      t = (now - t0) / 1000;
      if (t < offset) t = offset;
      const fi = Math.round(t * FPS);
      drawBalls(fi);
      drawCue();

      // kurzer Lichtring beim Treffer
      const hit = script.hits.find((h) => t >= h.t && t < h.t + 0.3);
      if (hit && !reduced) {
        const q = (t - hit.t) / 0.3;
        ring(hitRef.current, px(hit), rp * 0.6 + rp * 2 * q, (1 - q) * 0.8);
      } else hide(hitRef.current);

      if (t >= script.restAt && !res && !waitShown) {
        waitShown = true;
        setWaiting(true);
      }
      if (t >= script.restAt && res && celeb < 0) {
        celeb = Math.max(t, resAt);
        setShowResult(true);
      }
      if (celeb >= 0) {
        if (!reduced) {
          script.winners.forEach((w, wi) => {
            const c = px(script.frames[last][w]);
            [0, 0.18].forEach((o, k) => {
              const el = ringRefs.current[wi * 2 + k];
              const q = (t - celeb - o - wi * 0.12) / 0.6;
              if (q >= 0 && q < 1) ring(el, c, rp + 4 + rp * 2.6 * q, (1 - q) * 0.9);
              else hide(el);
            });
          });
        }
        const e = reduced ? 1 : clamp01((t - celeb) / 0.7);
        const ease = 1 - (1 - e) * (1 - e);
        if (res && winDeltaRef.current && loseDeltaRef.current) {
          winDeltaRef.current.textContent = `+${Math.round(res.winnerDelta * ease)}`;
          loseDeltaRef.current.textContent = `−${Math.round(Math.abs(res.loserDelta) * ease)}`;
        }
        if (t - celeb > HOLD) close();
      }

      if (closeAt >= 0 && t - closeAt > 1.1) {
        alive = false;
        if (!done && res) { done = true; onDone(res); }
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
  }, [lay]);

  const names = (ps: TablePlayer[]) => ps.map((p) => p.name).join(" & ");
  const title = pairs === 2 ? `${names(winners)} schlagen ${names(losers)}` : `${winners[0].name} schlägt ${losers[0].name}`;

  if (!lay) return <div className="victory" />;
  const { s, fx, fy, rail } = lay;
  const rp = R * s;
  const ringColor = (c: string) => (c === "#151515" ? "#f1e9d8" : c);
  const start = script.frames[0];
  // Diamanten auf der Bande (Zielmarken): 3 auf den kurzen, 2×3 auf den langen Seiten
  const diamonds: Vec[] = [];
  for (const k of [1, 2, 3]) {
    diamonds.push({ x: k / 4, y: -RAIL / 2 }, { x: k / 4, y: FIELD_H + RAIL / 2 });
  }
  for (const k of [1, 2, 3, 5, 6, 7]) {
    diamonds.push({ x: -RAIL / 2, y: (k / 8) * FIELD_H }, { x: FIELD_W + RAIL / 2, y: (k / 8) * FIELD_H });
  }

  return (
    <div className={`victory${closing ? " closing" : ""}`} role="dialog" aria-label={title} onClick={() => tapRef.current()}>
      <div className="victory-backdrop vt-backdrop" />
      <div className="victory-stage">
        <div
          className="victory-table vt-table"
          style={{ left: fx - rail, top: fy - rail, width: s * FIELD_W + 2 * rail, height: s * FIELD_H + 2 * rail }}
        >
          <div className="victory-felt vt-felt" style={{ inset: rail }}>
            <span className="vt-spot" style={{ left: s * 0.5 - 2, top: s * 1.5 - 2 }} />
            <span className="vt-headline" style={{ top: s * 0.5 }} />
          </div>
        </div>
        {diamonds.map((d, i) => (
          <span key={i} className="vt-diamond" style={{ left: fx + d.x * s, top: fy + d.y * s }} />
        ))}
        {POCKETS.map((p, i) => {
          const r = (p.corner ? 1.8 : 1.7) * rp;
          return (
            <div
              key={i}
              className="victory-pocket vt-pocket"
              style={{ left: fx + p.x * s - r, top: fy + p.y * s - r, width: 2 * r, height: 2 * r }}
            />
          );
        })}
        <div ref={hitRef} className="victory-ring" style={{ borderColor: "#f1e9d8" }} />
        {script.winners.flatMap((w, wi) =>
          [0, 1].map((k) => (
            <div
              key={`${w}-${k}`}
              ref={(el) => {
                ringRefs.current[wi * 2 + k] = el;
              }}
              className="victory-ring"
              style={{ borderColor: ringColor(players[w].color) }}
            />
          ))
        )}
        {players.map((p, i) => (
          <div
            key={i}
            ref={(el) => {
              ballRefs.current[i] = el;
            }}
            className="victory-ball vt-ball"
            style={{
              width: 2 * rp,
              height: 2 * rp,
              transform: `translate(${fx + start[i].x * s - rp}px, ${fy + start[i].y * s - rp}px)`,
              fontSize: `${rp * 1.05}px`,
            }}
          >
            <Ball label={p.label} color={p.color} kind={p.kind} />
          </div>
        ))}
        <div ref={cueRef} className="vt-cue" style={{ width: s * 1.35, height: Math.max(7, rp * 0.95) }}>
          <div className="vt-cue-stick" />
        </div>
        <div className="victory-result" style={{ top: lay.resultTop }} aria-live="polite">
          {showResult ? (
            <>
              <p>
                <strong>{pairs === 2 ? names(winners) : winners[0].name}</strong>{" "}
                {pairs === 2 ? "schlagen" : "schlägt"} {pairs === 2 ? names(losers) : losers[0].name}
              </p>
              <p className="victory-elo">
                <span ref={winDeltaRef} className="victory-up">+0</span>
                <span className="victory-sep"> / </span>
                <span ref={loseDeltaRef} className="victory-down">−0</span> Elo
              </p>
              {pairs === 2 && <p className="vt-each">für jeden im Team</p>}
            </>
          ) : waiting ? (
            <p className="victory-wait">Speichert…</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
