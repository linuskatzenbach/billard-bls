import { connection } from "next/server";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getOverview } from "@/lib/server";
import type { Pick } from "@/lib/picks";
import { getDraw, getResults, getTeams } from "@/lib/tournament";
import { GROUPS, groupStandings, pairKey, relKey, splitResults } from "@/lib/tournament-draw";
import TournamentResultForm, { type FormTeam } from "./TournamentResultForm";

// Eigenes Eintragen-Fenster fürs Turnier: /turnier/eintragen?a=<Team>&b=<Team>
export default async function TurnierEintragenPage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string; rel?: string }> }) {
  await connection();
  const { a: aRaw, b: bRaw, rel: relRaw } = await searchParams;
  const relRound = relRaw ? Number(relRaw) : null;
  const a = Number(aRaw);
  const b = Number(bRaw);
  const session = await getSession();
  const [{ ov }, teams, draw, results] = await Promise.all([getOverview(), getTeams(), getDraw(), getResults()]);

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
  const gi = draw?.published ? draw.groups.findIndex((g) => g.includes(a) && g.includes(b)) : -1;
  if (gi < 0 || a === b) return fail("Diese Paarung gibt es nicht.");
  if (relRound !== null) {
    const { group, rel } = splitResults(results);
    const info = groupStandings(draw!.groups[gi], group, rel).rel;
    if (!info || info.done || info.round !== relRound || !info.teams.includes(a) || !info.teams.includes(b)) {
      return fail("Diese Relegationspartie steht gerade nicht an.");
    }
  }
  const key = relRound !== null ? relKey(relRound, a, b) : pairKey(a, b);
  if (results.some((r) => r.key === key)) return fail("Dieses Spiel ist schon eingetragen.");

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
      <p className="subtitle">
        Gruppe {GROUPS[gi]} · {relRound !== null ? `Relegation${relRound > 1 ? ` Runde ${relRound}` : ""} · ein Spiel` : "ein Spiel"}
      </p>
      <TournamentResultForm a={ta} b={tb} rel={relRound} />
    </>
  );
}
