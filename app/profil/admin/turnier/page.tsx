import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { berlinDateTime, getOverview } from "@/lib/server";
import { TOURNAMENT, getDraw, getTeams, type SavedSeed } from "@/lib/tournament";
import { TEAM_COUNT, eloAt, seedTeams } from "@/lib/tournament-draw";
import DrawButton from "./DrawButton";
import PublishButton from "./PublishButton";
import { Bracket, GroupCards, Rules } from "@/app/turnier/TournamentView";

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
  const ok = teams.length === TEAM_COUNT;

  return (
    <>
      <Link href="/profil/admin" className="back-link">
        ← Admin-Bereich
      </Link>
      <h1>Turnier-Vorschau</h1>
      <p className="subtitle">Setzliste und Auslosung – erst nach dem Veröffentlichen im Turnier-Tab sichtbar.</p>

      <Rules />

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
      {draw && !draw.published && <PublishButton />}
      {draw?.published && <p className="message success">Veröffentlicht – Gruppen und Turnierbaum stehen im Turnier-Tab.</p>}

      {draw && <GroupCards groups={draw.groups} label={label} eloOf={(id) => seedOf.get(id)?.elo ?? 0} />}

      <div className="section-h">
        <h2>Turnierbaum</h2>
        <span>Sieger gegen Zweiten</span>
      </div>
      <Bracket />
      <p className="hint-left small muted">
        Teams aus derselben Gruppe stehen in verschiedenen Hälften und können sich erst im Finale wiedersehen – ebenso
        die Nr. 1 und Nr. 2 der Setzliste.
      </p>
    </>
  );
}
