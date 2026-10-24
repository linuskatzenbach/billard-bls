"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Reward } from "@/lib/reward";
import { Ball, poolBall } from "./RankBall";
import { WreathSvg } from "./Wreath";
import Medal from "./Medal";

// Belohnungsbildschirm nach dem Eintragen: Level-Up, Elo, Platz,
// XP-Aufschlüsselung und neue Abzeichen. Wird vom Eintragen-Formular per
// Ereignis geöffnet, sobald die Sieges-Animation fertig ist.
const EVENT = "billard:reward";

export function showReward(reward: Reward, test = false) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { reward, test } }));
}

const fmt = (n: number) => n.toLocaleString("de-DE");

function RankBallSmall({ rank }: { rank: number | null }) {
  const b = rank ? poolBall(rank) : { color: "#f4efe4", kind: "cue" as const };
  return <Ball label={rank ? String(rank) : ""} {...b} />;
}

export default function RewardOverlay() {
  const [state, setState] = useState<{ reward: Reward; test: boolean } | null>(null);

  useEffect(() => {
    const on = (e: Event) => setState((e as CustomEvent).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setState(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  if (!state) return null;
  const r = state.reward;
  const up = r.levelAfter > r.levelBefore;
  const rankChanged = r.rankAfter !== r.rankBefore;
  const close = () => setState(null);
  const confetti = up || r.badges.length > 0 || (r.rankAfter !== null && (r.rankBefore === null || r.rankAfter < r.rankBefore));

  return (
    <div className="reward" role="dialog" aria-modal="true" aria-label="Belohnung">
      <div className="reward-rays" aria-hidden="true" />
      {confetti && (
        <div className="reward-confetti" aria-hidden="true">
          {["#f2c230", "#1f4fb4", "#c8322a", "#ee7a1f", "#1d7a44", "#5b2d8e", "#f2c230", "#c8322a"].map((c, i) => (
            <i key={i} style={{ background: c, left: `${8 + i * 12}%`, animationDelay: `${i * 0.18}s` }} />
          ))}
        </div>
      )}
      <div className="reward-inner">
        {state.test && <p className="reward-test">Testspiel – nichts gespeichert</p>}
        <div className="reward-medallion-wrap">
          <span className="reward-wreath">
            <WreathSvg level={r.levelAfter} />
          </span>
          <span className="reward-medallion">
            <small>LEVEL</small>
            <b>{r.levelAfter}</b>
          </span>
        </div>
        {up ? (
          <>
            <p className="reward-kicker">LEVEL UP</p>
            <h1 className="reward-title">Level {r.levelAfter}</h1>
            <p className="reward-sub">Neuer Lorbeerkranz!</p>
          </>
        ) : (
          <>
            <p className="reward-kicker">{r.won ? "SIEG" : "GESPIELT"}</p>
            <h1 className="reward-title">+{fmt(r.xp)} XP</h1>
            <p className="reward-sub">{r.won ? `gegen ${r.opponent}` : `Niederlage gegen ${r.opponent} – jedes Spiel zählt`}</p>
          </>
        )}

        <div className="reward-gains">
          <div className="card">
            <span className="kpi-l">Elo</span>
            <span className={`reward-big ${r.eloAfter >= r.eloBefore ? "up" : "down"}`}>
              {r.eloAfter >= r.eloBefore ? "+" : "−"}
              {Math.abs(r.eloAfter - r.eloBefore)}
            </span>
            <span className="kpi-s">
              {fmt(r.eloBefore)} → {fmt(r.eloAfter)}
            </span>
          </div>
          <div className="card">
            <span className="kpi-l">Platz</span>
            {rankChanged ? (
              <span className="reward-rank">
                <RankBallSmall rank={r.rankBefore} />
                <span>→</span>
                <RankBallSmall rank={r.rankAfter} />
              </span>
            ) : (
              <span className="reward-big">{r.rankAfter ? `#${r.rankAfter}` : "–"}</span>
            )}
            <span className="kpi-s">
              {r.passed.length > 0
                ? `an ${r.passed.join(" & ")} vorbei`
                : r.leader
                  ? "Platz 1 👑"
                  : r.rankAfter
                    ? "gehalten"
                    : "noch vorläufig"}
            </span>
          </div>
        </div>

        <div className="card reward-lines">
          {r.lines.map((l, i) => (
            <div key={i}>
              <span>{l.label}</span>
              <b>+{l.xp}</b>
            </div>
          ))}
          <div className="tot">
            <span>Gesamt</span>
            <b>+{fmt(r.xp)} XP</b>
          </div>
        </div>

        {r.badges.map((b) => (
          <div className="card reward-badge" key={b.name}>
            <Medal metal={b.metal} icon={b.icon} size="2.8rem" />
            <div>
              <div className="reward-badge-title">Neues Abzeichen: {b.name}</div>
              <div className="reward-badge-desc">{b.desc}</div>
            </div>
          </div>
        ))}

        <div className="reward-btns">
          <Link href={state.test ? "/profil/admin" : "/profil"} className="bigbtn ghost-btn" onClick={close}>
            Profil
          </Link>
          <Link href={state.test ? "/profil/test" : "/eintragen"} className="bigbtn" onClick={close}>
            Noch ein Spiel
          </Link>
        </div>
        <button type="button" className="linkish reward-close" onClick={close}>
          Schließen
        </button>
      </div>
    </div>
  );
}
