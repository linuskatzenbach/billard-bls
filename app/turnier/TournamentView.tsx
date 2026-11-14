import type React from "react";
import Link from "next/link";
import { FORMAT, GROUPS, GROUP_ROUNDS, QUARTERS, TIEBREAK, groupStandings, pairKey, type GroupResult, type Slot } from "@/lib/tournament-draw";

// Gemeinsame Bausteine für Turnier-Tab und Admin-Vorschau.

// Turnier-Sonderregeln – anders als sonst üblich, deshalb deutlich hervorgehoben.
export function SpecialRules() {
  return (
    <div className="tn-special">
      <p className="tn-special-h">Nur im Turnier – anders als sonst!</p>
      <ul>
        <li>
          Nur für die <b>8</b> wird die Tasche angesagt – <b>einmal</b>. Alle anderen Kugeln ohne Ansage.
        </li>
        <li>
          Fällt die <b>8 beim Anstoß</b>, hat der Anstoßende <b>gewonnen</b>.
        </li>
      </ul>
    </div>
  );
}

export function Rules() {
  return (
      <div className="card td-rules">
        <p><b>Gruppenphase:</b> {FORMAT.groups} gegen jeden (3 pro Team) · beste 2 weiter</p>
        <p><b>Viertel- und Halbfinale:</b> {FORMAT.quarter} · <b>Finale:</b> {FORMAT.final}</p>
        <p><b>Gleichstand:</b> {TIEBREAK.map((t, i) => `${i + 1}) ${t}`).join(" · ")}</p>
        <p><b>Dreiergleichstand im Kreis</b> (jeder hat einen Sieg gegen die anderen): Relegation unter den drei Teams.</p>
      </div>

  );
}

export function GroupCards({
  groups,
  label,
  eloOf,
  mine,
  showElo = true,
  results,
  enterHref,
}: {
  groups: number[][];
  label: (teamId: number) => React.ReactNode;
  eloOf: (teamId: number) => number;
  mine?: number | null;
  showElo?: boolean;
  // Mit Ergebnissen: Tabelle nach Siegen statt Topf-Reihenfolge.
  results?: GroupResult[];
  // Link zum Eintragen, wenn der Betrachter diese Paarung eintragen darf.
  enterHref?: (a: number, b: number) => string | null;
}) {
  return (
    <div className="td-groups">
      {GROUPS.map((g, gi) => {
        const ids = groups[gi];
        const avg = ids.reduce((sum, id) => sum + eloOf(id), 0) / ids.length;
        const table = results ? groupStandings(ids, results) : null;
        const complete = table ? table.rows.every((r) => r.played === ids.length - 1) : false;
        const resultOf = (x: number, y: number) => results?.find((r) => pairKey(r.a, r.b) === pairKey(x, y));
        return (
          <div className="card td-group" key={g}>
            <p className="td-group-h">
              Gruppe {g}
              {showElo && <span className="td-group-avg">Ø {Math.round(avg)}</span>}
              {table && <span className="td-group-avg">S:N</span>}
            </p>
            <ol className="td-list">
              {(table ? table.rows.map((r) => r.teamId) : ids).map((id, pos) => {
                const row = table?.rows.find((r) => r.teamId === id);
                const cls = [id === mine ? "mine" : "", complete && pos < 2 ? "through" : ""].filter(Boolean).join(" ");
                return (
                  <li key={id} className={cls || undefined}>
                    <span className="td-seed">{pos + 1}</span>
                    <span className="td-name">{label(id)}</span>
                    {showElo && <span className="td-elo">{Math.round(eloOf(id))}</span>}
                    {row && (
                      <span className="td-wl">
                        {row.wins}:{row.losses}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {table?.relegation && (
              <p className="td-relegation">Dreiergleichstand im Kreis – Relegation nötig.</p>
            )}
            <div className="td-rounds">
              {GROUP_ROUNDS.map((round, ri) => (
                <div key={ri} className="td-round">
                  <span className="td-round-h">Runde {ri + 1}</span>
                  {round.map(([p, q]) => {
                    const x = ids[p - 1];
                    const y = ids[q - 1];
                    const res = resultOf(x, y);
                    const href = !res && enterHref ? enterHref(x, y) : null;
                    const side = (id: number) => (
                      <span className={res ? (res.winner === id ? "won" : "lost") : undefined}>{label(id)}</span>
                    );
                    return (
                      <span key={`${p}-${q}`} className={`td-pair${x === mine || y === mine ? " mine" : ""}`}>
                        <span className="td-pair-teams">
                          {side(x)} <i>vs.</i> {side(y)}
                        </span>
                        {res && <span className="td-done" aria-label="gespielt">✓</span>}
                        {href && (
                          <Link href={href} className="td-plus" aria-label="Ergebnis eintragen">
                            +
                          </Link>
                        )}
                      </span>
                    );
                  })}
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
