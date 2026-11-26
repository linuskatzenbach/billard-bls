import type React from "react";
import Link from "next/link";
import { FORMAT, GROUPS, GROUP_ROUNDS, QUARTERS, RELEGATION, TIEBREAK, groupStandings, pairKey, type GroupResult, type KoSeries, type RelResult, type Slot } from "@/lib/tournament-draw";

// Gemeinsame Bausteine für Turnier-Tab und Admin-Vorschau.

// Turnier-Sonderregel – anders als sonst üblich, deshalb deutlich hervorgehoben.
export function SpecialRules() {
  return (
    <div className="tn-special">
      <p className="tn-special-h">Nur im Turnier – anders als sonst!</p>
      <p className="tn-special-text">
        Nur für die <b>8</b> wird die Tasche angesagt – <b>einmal</b>, unmittelbar bevor das Team erneut dran ist.
      </p>
    </div>
  );
}

export function Rules() {
  return (
      <div className="card td-rules">
        <p><b>Gruppenphase:</b> {FORMAT.groups} gegen jeden (3 pro Team) · beste 2 weiter</p>
        <p><b>Viertel- und Halbfinale:</b> {FORMAT.quarter} · <b>Finale:</b> {FORMAT.final}</p>
        <p><b>Gleichstand:</b> {TIEBREAK.map((t, i) => `${i + 1}) ${t}`).join(" · ")}</p>
        <p>
          <b>Anstoß:</b> Wer anstößt, wird ausgelost. In der K.O.-Runde soll dies durch Ausstoßen (Lag) entschieden
          werden. Wer das Lag gewinnt, darf entscheiden, wer anstößt. Danach wird immer abwechselnd angestoßen.
        </p>
        <p><b>Im Team:</b> Die beiden Partner stoßen immer abwechselnd.</p>
        <p>
          <b>Dreiergleichstand im Kreis</b> (jeder hat einen Sieg gegen die anderen): Relegation – die drei Teams spielen
          noch einmal jeder gegen jeden (je ein Spiel). Gibt es wieder einen Kreis, wird die Runde wiederholt.
        </p>
      </div>

  );
}

export function GroupCards({
  groups,
  label,
  eloOf,
  mine,
  showElo = true,
  showGroupAvg = showElo,
  results,
  relResults = [],
  enterHref,
  mailHref,
}: {
  groups: number[][];
  label: (teamId: number) => React.ReactNode;
  eloOf: (teamId: number) => number;
  mine?: number | null;
  showElo?: boolean;
  // Ø der ganzen Gruppe im Kopf (nur Admin-Vorschau).
  showGroupAvg?: boolean;
  // Mit Ergebnissen: Tabelle nach Siegen statt Topf-Reihenfolge.
  results?: GroupResult[];
  relResults?: RelResult[];
  // Link zum Eintragen, wenn der Betrachter diese Paarung eintragen darf
  // (rel = Runde der Relegation).
  enterHref?: (a: number, b: number, rel?: number) => string | null;
  // mailto-Link an die Gegner (nur eigene, noch offene Paarungen).
  mailHref?: (a: number, b: number, rel?: number) => string | null;
}) {
  return (
    <div className="td-groups">
      {GROUPS.map((g, gi) => {
        const ids = groups[gi];
        const avg = ids.reduce((sum, id) => sum + eloOf(id), 0) / ids.length;
        const table = results ? groupStandings(ids, results, relResults) : null;
        const complete = table ? table.rows.every((r) => r.played === ids.length - 1) && !table.relegation : false;
        const resultOf = (x: number, y: number) => results?.find((r) => pairKey(r.a, r.b) === pairKey(x, y));
        const rel = table?.rel ?? null;
        const relOf = (round: number, x: number, y: number) =>
          relResults.find((r) => r.round === round && pairKey(r.a, r.b) === pairKey(x, y));
        // Eine Paarung (Gruppen- oder Relegationsspiel) mit ✓, Nachricht und „+“.
        const pair = (x: number, y: number, res: GroupResult | undefined, relRound?: number) => {
          const href = !res && enterHref ? enterHref(x, y, relRound) : null;
          const mail = !res && mailHref ? mailHref(x, y, relRound) : null;
          const side = (id: number) => (
            <span className={res ? (res.winner === id ? "won" : "lost") : undefined}>{label(id)}</span>
          );
          return (
            <span key={`${relRound ?? 0}-${x}-${y}`} className={`td-pair${x === mine || y === mine ? " mine" : ""}`}>
              <span className="td-pair-teams">
                {side(x)} <i>vs.</i> {side(y)}
              </span>
              {res && <span className="td-done" aria-label="gespielt">✓</span>}
              {mail && (
                <a href={mail} className="td-msg" aria-label="Nachricht an die Gegner">
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
                  </svg>
                </a>
              )}
              {href && (
                <Link href={href} className="td-plus" aria-label="Ergebnis eintragen">
                  +
                </Link>
              )}
            </span>
          );
        };
        return (
          <div className="card td-group" key={g}>
            <p className="td-group-h">
              Gruppe {g}
              {showGroupAvg && <span className="td-group-avg">Ø {Math.round(avg)}</span>}
              {table && <span className="td-group-avg">S:N</span>}
            </p>
            <ol className="td-list">
              {(table ? table.rows.map((r) => r.teamId) : ids).map((id, pos) => {
                const row = table?.rows.find((r) => r.teamId === id);
                const cls = [id === mine ? "mine" : "", complete && pos < 2 ? "through" : ""].filter(Boolean).join(" ");
                return (
                  <li key={id} className={cls || undefined}>
                    <span className="td-seed">{pos + 1}</span>
                    <span className="td-name">
                      {label(id)}
                      {showElo && <span className="td-elo" title="Elo-Schnitt des Teams">Ø {Math.round(eloOf(id))}</span>}
                    </span>
                    {row && (
                      <span className="td-wl">
                        {row.wins}:{row.losses}
                      </span>
                    )}
                  </li>
                );
              })}
            </ol>
            {rel && (
              <div className="td-rel">
                <p className="td-rel-h">
                  <span>Relegation</span>
                  <span className="td-rel-when">{rel.done ? "entschieden" : `bis ${RELEGATION.deadlineLabel}`}</span>
                </p>
                {!rel.done && (
                  <p className="td-rel-text">
                    Dreiergleichstand im Kreis – die drei spielen noch einmal jeder gegen jeden.
                    {rel.round > 1 && " Runde 1 ging wieder im Kreis aus, deshalb geht es von vorn los."}
                  </p>
                )}
                {Array.from({ length: rel.round }, (_, i) => i + 1).map((round) => (
                  <div key={round} className="td-round">
                    {rel.round > 1 && <span className="td-round-h">Relegation {round}</span>}
                    {rel.pairs.map(([x, y]) => {
                      const res = relOf(round, x, y);
                      return pair(x, y, res, round === rel.round && !rel.done ? round : undefined);
                    })}
                  </div>
                ))}
              </div>
            )}
            <div className="td-rounds">
              {GROUP_ROUNDS.map((round, ri) => (
                <div key={ri} className="td-round">
                  <span className="td-round-h">Runde {ri + 1}</span>
                  {round.map(([p, q]) => pair(ids[p - 1], ids[q - 1], resultOf(ids[p - 1], ids[q - 1])))}
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

// Turnierbaum. Ohne series nur Platzhalter („Sieger A“); mit series die Teams,
// der Serienstand und – für die Beteiligten – Nachricht und „+“.
export function Bracket({
  series,
  label,
  mine = null,
  enterHref,
  mailHref,
  termin,
  terminHref,
}: {
  series?: KoSeries[];
  // Termin der Serie als Text („Fr 27.11., 18:30“) und Link zum Eintragen.
  termin?: (s: KoSeries) => string | null;
  terminHref?: (s: KoSeries) => string | null;
  label?: (teamId: number) => React.ReactNode;
  mine?: number | null;
  enterHref?: (s: KoSeries) => string | null;
  mailHref?: (s: KoSeries) => string | null;
} = {}) {
  const fallback: KoSeries[] = [
    ...QUARTERS.map(([x, y], i) => ({ id: `vf${i + 1}`, round: "vf" as const, placeholders: [slotText(x), slotText(y)] as [string, string] })),
    ...[0, 1].map((h) => ({ id: `hf${h + 1}`, round: "hf" as const, placeholders: [`Sieger VF ${h * 2 + 1}`, `Sieger VF ${h * 2 + 2}`] as [string, string] })),
    { id: "f", round: "f" as const, placeholders: ["Sieger HF 1", "Sieger HF 2"] as [string, string] },
  ].map((x) => ({ ...x, teams: [null, null] as [null, null], wins: [0, 0] as [number, number], winner: null, nextGame: null }));
  const all = series ?? fallback;
  const byId = (id: string) => all.find((x) => x.id === id)!;

  const match = (s: KoSeries, extra = "") => {
    const started = s.wins[0] + s.wins[1] > 0;
    const isMine = mine !== null && s.teams.includes(mine);
    const href = enterHref && s.nextGame !== null ? enterHref(s) : null;
    const mail = mailHref && s.nextGame !== null ? mailHref(s) : null;
    const when = termin && s.winner === null ? termin(s) : null;
    const cal = terminHref && s.nextGame !== null ? terminHref(s) : null;
    return (
      <div className={`tb-match${extra}${isMine ? " mine" : ""}`} key={s.id}>
        {s.round === "f" && <span className="tb-cup" aria-hidden="true">🏆</span>}
        {[0, 1].map((i) => {
          const t = s.teams[i];
          const cls = s.winner === null ? "" : s.winner === t ? " won" : " lost";
          return (
            <span className={`tb-side${cls}`} key={i}>
              <span className="tb-name">{t !== null && label ? label(t) : s.placeholders[i]}</span>
              {t !== null && (started || s.winner !== null) && <b className="tb-score">{s.wins[i]}</b>}
            </span>
          );
        })}
        {when && <span className="tb-when">{when}</span>}
        {(href || mail || cal) && (
          <span className="tb-actions">
            {cal && (
              <Link href={cal} className="td-msg" aria-label={when ? "Termin ändern" : "Termin eintragen"}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <rect x="4" y="5.5" width="16" height="14" rx="1.5" />
                  <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" />
                </svg>
              </Link>
            )}
            {mail && (
              <a href={mail} className="td-msg" aria-label="Nachricht an die Gegner">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
                </svg>
              </a>
            )}
            {href && (
              <Link href={href} className="td-plus" aria-label={`Spiel ${s.nextGame} eintragen`}>
                +
              </Link>
            )}
          </span>
        )}
      </div>
    );
  };

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
              {[1, 2].map((i) => match(byId(`vf${half * 2 + i}`)))}
            </div>
          ))}
        </div>
        <div className="tb-col">
          <div className="tb-pair">{[1, 2].map((i) => match(byId(`hf${i}`)))}</div>
        </div>
        <div className="tb-col">{match(byId("f"), " tb-final")}</div>
      </div>
    </>
  );
}
