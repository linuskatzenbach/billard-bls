import { connection } from "next/server";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getOverview } from "@/lib/server";
import type { Pick } from "@/lib/picks";
import { getDraw, getResults, getTeams } from "@/lib/tournament";
import { GROUPS, KO_LABEL, KO_WINS, groupStandings, koBracket, pairKey, relKey, splitResults } from "@/lib/tournament-draw";
import TournamentResultForm, { type FormTeam } from "./TournamentResultForm";

// Eigenes Eintragen-Fenster fürs Turnier: /turnier/eintragen?a=<Team>&b=<Team>
export default async function TurnierEintragenPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string; rel?: string; ko?: string }> }) {
  await connection();
  const { a: aRaw, b: bRaw, rel: relRaw, ko: koRaw } = await searchParams;
  const relRound = relRaw ? Number(relRaw) : null;
  const session = await getSession();
  const [{ ov }, teams, draw, results] = await Promise.all([getOverview(), getTeams(), getDraw(), getResults()]);
  // K.O.-Serie (?ko=vf1): Teams kommen aus dem Baum.
  const series = koRaw && draw?.published ? koBracket(draw.groups, results).find((x) => x.id === koRaw) ?? null : null;
  const a = series ? Number(series.teams[0]) : Number(aRaw);
  const b = series ? Number(series.teams[1]) : Number(bRaw);

  const back = (
    <Link href="/turnier" className="back-link">
      ← Turnier
    </Link>
  );
  const fail = (msg: string) => (
    <>
      {back}
      <h1>Turnierspiel</h1>
      <p className="empty">{msg}</p>
    </>
  );

  if (!session) return fail("Bitte zuerst anmelden – eingetragen wird vom eigenen Profil aus.");
  if (koRaw && (!series || series.nextGame === null)) {
    return fail(series?.winner ? "Diese Serie ist schon entschieden." : "Diese Partie steht noch nicht fest.");
  }
  const gi = series ? -2 : draw?.published ? draw.groups.findIndex((g) => g.includes(a) && g.includes(b)) : -1;
  if (gi === -1 || a === b) return fail("Diese Paarung gibt es nicht.");
  if (!series && relRound !== null) {
    const { group, rel } = splitResults(results);
    const info = groupStandings(draw!.groups[gi], group, rel).rel;
    if (!info || info.done || info.round !== relRound || !info.teams.includes(a) || !info.teams.includes(b)) {
      return fail("Diese Relegationspartie steht gerade nicht an.");
    }
  }
  const key = series ? `${series.id}:${series.nextGame}` : relRound !== null ? relKey(relRound, a, b) : pairKey(a, b);
  if (!series && results.some((r) => r.key === key)) return fail("Dieses Spiel ist schon eingetragen.");

  const toPick = (id: string): Pick => {
    const s = ov.byId[id];
    return s
      ? { id, name: s.name, rank: s.rank, level: s.level, cohort: s.cohort, elo: s.elo }
      : { id, name: id, rank: null, level: 0, cohort: null, elo: 1500 };
  };
  const team = (id: number): FormTeam | null => {
    const t = teams.find((x) => x.id === id);
    return t ? { id, players: [toPick(t.player1), toPick(t.player2)] } : null;
  };
  const ta = team(a);
  const tb = team(b);
  if (!ta || !tb) return fail("Team nicht gefunden.");
  const involved = [...ta.players, ...tb.players].some((p) => p.id === session.playerId);
  if (!involved) return fail("Eintragen können nur die vier Spieler dieser Partie.");

  return (
    <>
      {back}
      <h1>Turnierspiel</h1>
      {series ? (
        <p className="subtitle">
          {KO_LABEL[series.round]} · Spiel {series.nextGame} · Stand {series.wins[0]}:{series.wins[1]} · {KO_WINS[series.round]} Siege zum Weiterkommen
        </p>
      ) : (
      <p className="subtitle">
        Gruppe {GROUPS[gi]} · {relRound !== null ? `Relegation${relRound > 1 ? ` Runde ${relRound}` : ""} · ein Spiel` : "ein Spiel"}
      </p>
      )}
      <TournamentResultForm a={ta} b={tb} rel={series ? null : relRound} ko={series ? `${series.id}:${series.nextGame}` : null} />
    </>
  );
}
