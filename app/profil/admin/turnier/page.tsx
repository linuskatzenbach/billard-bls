import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { berlinDateTime, getOverview } from "@/lib/server";
import { TOURNAMENT, getDraw, getTeams, type SavedSeed } from "@/lib/tournament";
import { FORMAT, GROUPS, GROUP_ROUNDS, QUARTERS, TEAM_COUNT, TIEBREAK, eloAt, seedTeams, type Slot } from "@/lib/tournament-draw";
import DrawButton from "./DrawButton";

// Interne Vorschau: Setzliste, Auslosung, Gruppen-Spielplan und Turnierbaum.
// Nur für den Admin – im Turnier-Tab erscheint davon noch nichts.
export default async function AdminTurnierPage() {
  await connection();
  const session = await getSession();
  if (!session?.admin) redirect("/profil");
  const [{ world, nameOf }, teams, draw] = await Promise.all([getOverview(), getTeams(), getDraw()]);

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const label = (teamId: number) => {
    const t = teamById.get(teamId);
    return t ? `${nameOf(t.player1)} & ${nameOf(t.player2)}` : `Team ${teamId}`;
  };
  // Setzliste: nach der Auslosung die gespeicherte, vorher die aktuelle Vorschau.
  const seeds: SavedSeed[] =
    draw?.seeds ?? seedTeams(teams, (id) => eloAt(world.matches, id, TOURNAMENT.deadline));
  const seedOf = new Map(seeds.map((s) => [s.teamId, s]));
  const groupOf = (s: Slot) => draw?.groups[GROUPS.indexOf(s.group)];
  // Wer käme weiter, wenn in jeder Gruppe Topf 1 vor Topf 2 landet?
  const projected = (s: Slot) => {
    const g = groupOf(s);
    return g ? label(g[s.place - 1]) : null;
  };
  const slotText = (s: Slot) => `${s.place === 1 ? "Sieger" : "Zweiter"} ${s.group}`;
  const ok = teams.length === TEAM_COUNT;

  return (
    <>
      <Link href="/profil/admin" className="back-link">
        ← Admin-Bereich
      </Link>
      <h1>Turnier-Vorschau</h1>
      <p className="subtitle">Nur für dich sichtbar – im Turnier-Tab ist davon noch nichts zu sehen.</p>

      <div className="card td-rules">
        <p><b>Gruppenphase:</b> {FORMAT.groups} gegen jeden (3 pro Team) · beste 2 weiter</p>
        <p><b>Viertel- und Halbfinale:</b> {FORMAT.quarter} · <b>Finale:</b> {FORMAT.final}</p>
        <p><b>Gleichstand:</b> {TIEBREAK.map((t, i) => `${i + 1}) ${t}`).join(" · ")}</p>
        <p><b>Turnierregel:</b> Nur für die 8 wird die Tasche angesagt (einmal).</p>
      </div>

      <div className="section-h">
        <h2>Setzliste</h2>
        <span>Ø Elo zum Anmeldeschluss</span>
      </div>
      {!ok && (
        <p className="message error">
          Es sind {teams.length} Teams angemeldet – für 4 Vierergruppen braucht es genau {TEAM_COUNT}.
        </p>
      )}
      <div className="td-pots">
        {[1, 2, 3, 4].map((pot) => (
          <div className="card td-pot" key={pot}>
            <p className="td-pot-h">Topf {pot}{pot === 1 && <span> · gesetzt</span>}</p>
            <ol className="td-list">
              {seeds.filter((s) => s.pot === pot).map((s) => (
                <li key={s.teamId}>
                  <span className="td-seed">{s.seed}</span>
                  <span className="td-name">{label(s.teamId)}</span>
                  <span className="td-elo">{Math.round(s.elo)}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      <div className="section-h">
        <h2>Gruppen</h2>
        <span>{draw ? `gelost ${berlinDateTime(draw.drawnAt)}` : "noch nicht gelost"}</span>
      </div>
      <p className="hint-left">
        Topf 1 ist fest gesetzt (Nr. 1 → A, Nr. 2 → B, Nr. 3 → C, Nr. 4 → D). Aus den Töpfen 2–4 bekommt jede Gruppe ein
        zufälliges Team. Neu losen geht, bis die Gruppen veröffentlicht sind.
      </p>
      {ok && !draw?.published && <DrawButton again={Boolean(draw)} />}

      {draw && (
        <div className="td-groups">
          {GROUPS.map((g, gi) => {
            const ids = draw.groups[gi];
            return (
              <div className="card td-group" key={g}>
                <p className="td-group-h">Gruppe {g}</p>
                <ol className="td-list">
                  {ids.map((id, pos) => (
                    <li key={id}>
                      <span className="td-seed">{pos + 1}</span>
                      <span className="td-name">{label(id)}</span>
                      <span className="td-elo">{Math.round(seedOf.get(id)?.elo ?? 0)}</span>
                    </li>
                  ))}
                </ol>
                <div className="td-rounds">
                  {GROUP_ROUNDS.map((round, ri) => (
                    <div key={ri} className="td-round">
                      <span className="td-round-h">Runde {ri + 1}</span>
                      {round.map(([a, b]) => (
                        <span key={`${a}-${b}`} className="td-pair">
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
      )}

      <div className="section-h">
        <h2>Turnierbaum</h2>
        <span>{draw ? "kursiv: Favoriten-Tipp" : "nach der Auslosung mit Namen"}</span>
      </div>
      <div className="td-bracket">
        {[0, 1].map((half) => (
          <div className="td-half" key={half}>
            <p className="td-half-h">{half === 0 ? "Obere Hälfte" : "Untere Hälfte"}</p>
            {QUARTERS.slice(half * 2, half * 2 + 2).map(([a, b], i) => (
              <div className="card td-match" key={i}>
                <span className="td-match-h">Viertelfinale {half * 2 + i + 1} · {FORMAT.quarter}</span>
                {[a, b].map((s) => (
                  <span className="td-side" key={slotText(s)}>
                    <b>{slotText(s)}</b>
                    {projected(s) && <em>{projected(s)}</em>}
                  </span>
                ))}
              </div>
            ))}
            <div className="card td-match td-semi">
              <span className="td-match-h">Halbfinale {half + 1} · {FORMAT.semi}</span>
              <span className="td-side"><b>Sieger VF {half * 2 + 1}</b></span>
              <span className="td-side"><b>Sieger VF {half * 2 + 2}</b></span>
            </div>
          </div>
        ))}
        <div className="card td-match td-final">
          <span className="td-match-h">🏆 Finale · {FORMAT.final}</span>
          <span className="td-side"><b>Sieger HF 1</b></span>
          <span className="td-side"><b>Sieger HF 2</b></span>
        </div>
      </div>
      <p className="hint-left small muted">
        Teams aus derselben Gruppe stehen in verschiedenen Hälften und können sich erst im Finale wiedersehen – ebenso
        die Nr. 1 und Nr. 2 der Setzliste.
      </p>
    </>
  );
}
