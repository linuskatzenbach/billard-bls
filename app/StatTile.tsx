"use client";

import type React from "react";
import { useRef } from "react";
import RankBall from "./RankBall";

export type TopRow = {
  rank: number;
  name: string;
  value: string;
};

// Statistik-Kachel auf der Startseite. Ein Tipp darauf öffnet ein
// Fenster mit den Top 3 der jeweiligen Kategorie.
export default function StatTile({
  label,
  title,
  name,
  value,
  top,
}: {
  label: React.ReactNode;
  title: string;
  name: string;
  value: string;
  top: TopRow[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const clickable = top.length > 0;

  return (
    <>
      <button
        type="button"
        className="stat stat-button"
        onClick={() => dialogRef.current?.showModal()}
        disabled={!clickable}
        aria-haspopup="dialog"
      >
        <span className="stat-label">{label}</span>
        <span className="stat-name">{name}</span>
        <span className="stat-value">{value}</span>
      </button>

      {clickable && (
        <dialog
          ref={dialogRef}
          className="top-dialog"
          // Klick auf den abgedunkelten Hintergrund schließt das Fenster.
          onClick={(e) => {
            if (e.target === e.currentTarget) e.currentTarget.close();
          }}
        >
          <div className="top-dialog-inner">
            <h3>{title}</h3>
            <ol className="top-list">
              {top.map((row, i) => (
                <li key={i} className="top-row">
                  <RankBall rank={row.rank} />
                  <span className="top-name">{row.name}</span>
                  <span className="top-value">{row.value}</span>
                </li>
              ))}
            </ol>
            <button
              type="button"
              className="top-close"
              onClick={() => dialogRef.current?.close()}
            >
              Schließen
            </button>
          </div>
        </dialog>
      )}
    </>
  );
}
