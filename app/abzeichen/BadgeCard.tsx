"use client";

import { useRef } from "react";
import type { Metal } from "@/lib/achievements";
import Medal from "../Medal";

export type BadgeDetail = {
  title: string;
  desc: string;
  tiers?: { label: string; metal: Metal; need: string; done: boolean; pct: number }[];
  mine?: string; // eigener Stand, z. B. "27 Siege"
  pct?: number; // einstufige: Anteil der Spieler mit diesem Abzeichen
  leader?: string; // "Leonie S. · 42 Siege"
  first?: string; // einstufige: wer es zuerst geschafft hat
};

export type BadgeView = {
  key: string;
  icon: string;
  metal: Metal;
  locked: boolean;
  isNew: boolean;
  name: string;
  line: string;
  date?: string;
  bar?: number; // 0–100
  detail: BadgeDetail | null; // null = nicht antippbar
};

export default function BadgeCard({ b }: { b: BadgeView }) {
  const ref = useRef<HTMLDialogElement>(null);
  const body = (
    <>
      <Medal metal={b.metal} icon={b.icon} locked={b.locked} isNew={b.isNew} />
      <span className="badge-name">{b.name}</span>
      <span className="badge-desc">{b.line}</span>
      {b.date && <span className="badge-date">{b.date}</span>}
      {b.bar !== undefined && (
        <span className="bar thin">
          <span style={{ width: `${b.bar}%` }} />
        </span>
      )}
    </>
  );
  if (!b.detail) return <div className={`badge card${b.locked ? " is-locked" : ""}`}>{body}</div>;
  const d = b.detail;
  return (
    <>
      <button
        type="button"
        className={`badge card badge-btn${b.locked ? " is-locked" : ""}`}
        onClick={() => ref.current?.showModal()}
        aria-haspopup="dialog"
      >
        {body}
      </button>
      <dialog
        ref={ref}
        className="top-dialog badge-dialog"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
      >
        <div className="top-dialog-inner">
          <div className="bd-head">
            <Medal metal={b.metal} icon={b.icon} locked={b.locked} size="3.6rem" />
            <div>
              <div className="bd-title">{d.title}</div>
              <div className="bd-desc">{d.desc}</div>
            </div>
          </div>
          {d.mine && <div className="bd-mine">{d.mine}</div>}
          {d.tiers && (
            <div className="bd-tiers">
              {d.tiers.map((t) => (
                <div className={`bd-tier${t.done ? " done" : ""}`} key={t.label}>
                  <Medal metal={t.metal} icon={b.icon} locked={!t.done} size="2.2rem" />
                  <span className="bd-tier-main">
                    <b>{t.label}</b>
                    <span>{t.need}</span>
                  </span>
                  <span className="bd-tier-pct">
                    {t.done && <span className="bd-check">✓ </span>}
                    {t.pct} % der Spieler
                  </span>
                </div>
              ))}
            </div>
          )}
          {d.pct !== undefined && <div className="bd-row">Haben {d.pct} % der Spieler</div>}
          {d.first && <div className="bd-row">Zuerst geschafft: {d.first}</div>}
          {d.leader && <div className="bd-row">Spitze: {d.leader}</div>}
          <button type="button" className="top-close" onClick={() => ref.current?.close()}>
            Schließen
          </button>
        </div>
      </dialog>
    </>
  );
}
