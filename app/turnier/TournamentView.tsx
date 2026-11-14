import type React from "react";
import { FORMAT, GROUPS, GROUP_ROUNDS, QUARTERS, TIEBREAK, type Slot } from "@/lib/tournament-draw";

// Gemeinsame Bausteine für Turnier-Tab und Admin-Vorschau.

export function Rules() {
  return (
      <div className="card td-rules">
        <p><b>Gruppenphase:</b> {FORMAT.groups} gegen jeden (3 pro Team) · beste 2 weiter</p>
        <p><b>Viertel- und Halbfinale:</b> {FORMAT.quarter} · <b>Finale:</b> {FORMAT.final}</p>
        <p><b>Gleichstand:</b> {TIEBREAK.map((t, i) => `${i + 1}) ${t}`).join(" · ")}</p>
        <p><b>Dreiergleichstand im Kreis</b> (jeder hat einen Sieg gegen die anderen): Relegation unter den drei Teams.</p>
        <p><b>Turnierregeln:</b> Nur für die 8 wird die Tasche angesagt (einmal). Fällt die 8 beim Anstoß, gewinnt der Anstoßende.</p>
      </div>

  );
}

export function GroupCards({
  groups,
  label,
  eloOf,
  mine,
  showElo = true,
}: {
  groups: number[][];
  label: (teamId: number) => React.ReactNode;
  eloOf: (teamId: number) => number;
  mine?: number | null;
  showElo?: boolean;
}) {
  return (
        <div className="td-groups">
          {GROUPS.map((g, gi) => {
            const ids = groups[gi];
            const avg = ids.reduce((sum, id) => sum + eloOf(id), 0) / ids.length;
            return (
              <div className="card td-group" key={g}>
                <p className="td-group-h">
                  Gruppe {g}
                  {showElo && <span className="td-group-avg">Ø {Math.round(avg)}</span>}
                </p>
                <ol className="td-list">
                  {ids.map((id, pos) => (
                    <li key={id} className={id === mine ? "mine" : undefined}>
                      <span className="td-seed">{pos + 1}</span>
                      <span className="td-name">{label(id)}</span>
                      {showElo && <span className="td-elo">{Math.round(eloOf(id))}</span>}
                    </li>
                  ))}
                </ol>
                <div className="td-rounds">
                  {GROUP_ROUNDS.map((round, ri) => (
                    <div key={ri} className="td-round">
                      <span className="td-round-h">Runde {ri + 1}</span>
                      {round.map(([a, b]) => (
                        <span key={`${a}-${b}`} className={`td-pair${ids[a - 1] === mine || ids[b - 1] === mine ? " mine" : ""}`}>
                          {label(ids[a - 1])} <i>vs.</i> {label(ids[b - 1])}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
  );
}

const slotText = (s: Slot) => `${s.place === 1 ? "Sieger" : "Zweiter"} ${s.group}`;

export function Bracket() {
  return (
    <>
      <div className="tb-heads">
        <span>Viertelfinale<small>{FORMAT.quarter}</small></span>
        <span>Halbfinale<small>{FORMAT.semi}</small></span>
        <span>Finale<small>{FORMAT.final}</small></span>
      </div>
      <div className="tb">
        <div className="tb-col">
          {[0, 1].map((half) => (
            <div className="tb-pair" key={half}>
              {QUARTERS.slice(half * 2, half * 2 + 2).map((pair, i) => (
                <div className="tb-match" key={i}>
                  {pair.map((s) => (
                    <span className="tb-side" key={slotText(s)}>
                      <span className="tb-name">{slotText(s)}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="tb-col">
          <div className="tb-pair">
            {[0, 1].map((half) => (
              <div className="tb-match" key={half}>
                <span className="tb-side"><span className="tb-name">Sieger VF {half * 2 + 1}</span></span>
                <span className="tb-side"><span className="tb-name">Sieger VF {half * 2 + 2}</span></span>
              </div>
            ))}
          </div>
        </div>
        <div className="tb-col">
          <div className="tb-match tb-final">
            <span className="tb-cup" aria-hidden="true">🏆</span>
            <span className="tb-side"><span className="tb-name">Sieger HF 1</span></span>
            <span className="tb-side"><span className="tb-name">Sieger HF 2</span></span>
          </div>
        </div>
      </div>
    </>
  );
}
