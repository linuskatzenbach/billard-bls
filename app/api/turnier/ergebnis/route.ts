import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { disputeMatch, getWorld, recordMatch } from "@/lib/db";
import { computeReward } from "@/lib/reward";
import { jsonError, readJson, refreshWorld } from "@/lib/server";
import { reportError } from "@/lib/alert";
import { TOURNAMENT, getDraw, getResults, getTeams, saveResult } from "@/lib/tournament";
import { groupStandings, pairKey, relKey, splitResults } from "@/lib/tournament-draw";

// Ergebnis eines Gruppen- oder Relegationsspiels eintragen (rel = Runde der
// Relegation). Dürfen nur die vier Beteiligten. Es entsteht ein ganz normales Doppel (Elo, Widerspruch usw.).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Bitte zuerst anmelden.", 401);
  const body = await readJson<{ a: number; b: number; winner: number; rel?: number }>(req);
  const a = Number(body.a);
  const b = Number(body.b);
  const winner = Number(body.winner);
  if (winner !== a && winner !== b) return jsonError("Bitte das Siegerteam antippen.");

  const [draw, teams, results] = await Promise.all([getDraw(), getTeams(), getResults()]);
  if (!draw?.published) return jsonError("Die Gruppen stehen noch nicht fest.");
  if (!draw.groups.some((g) => g.includes(a) && g.includes(b)) || a === b) return jsonError("Diese Paarung gibt es nicht.");
  const relRound = body.rel ? Number(body.rel) : null;
  let key = pairKey(a, b);
  if (relRound !== null) {
    const g = draw.groups.find((x) => x.includes(a))!;
    const { group, rel } = splitResults(results);
    const info = groupStandings(g, group, rel).rel;
    if (!info || info.done || info.round !== relRound || !info.teams.includes(a) || !info.teams.includes(b)) {
      return jsonError("Diese Relegationspartie steht gerade nicht an.");
    }
    key = relKey(relRound, a, b);
  }
  if (results.some((r) => r.key === key)) return jsonError("Dieses Spiel ist schon eingetragen.");
  const ta = teams.find((t) => t.id === a);
  const tb = teams.find((t) => t.id === b);
  if (!ta || !tb) return jsonError("Team nicht gefunden.");
  const players = [ta.player1, ta.player2, tb.player1, tb.player2];
  if (!players.includes(session.playerId)) {
    return jsonError("Eintragen können nur die vier Spieler dieser Partie.", 403);
  }

  const win = winner === a ? ta : tb;
  const lose = winner === a ? tb : ta;
  const world = await getWorld();
  let match;
  try {
    match = await recordMatch({
      winnerIds: [win.player1, win.player2],
      loserIds: [lose.player1, lose.player2],
      enteredBy: session.playerId,
    });
  } catch (err) {
    await reportError("Turnierspiel speichern", err);
    return jsonError("Das Spiel konnte gerade nicht gespeichert werden. Bitte nochmal versuchen.", 503);
  }
  // Hat jemand gleichzeitig dieselbe Paarung eingetragen, das doppelte Spiel wieder löschen.
  if (!(await saveResult(key, match.id, winner))) {
    await disputeMatch(match.id, session.playerId);
    refreshWorld();
    return jsonError("Dieses Spiel wurde gerade schon eingetragen.");
  }
  refreshWorld();

  // Für den Belohnungsbildschirm: Stand nach dem Spiel inkl. neuem Turnierergebnis
  // (Turnier-Abzeichen).
  const tournaments = world.tournaments ?? [];
  const afterWorld = {
    ...world,
    matches: [...world.matches, match],
    tournaments: tournaments.some((t) => t.id === TOURNAMENT.id)
      ? tournaments.map((t) =>
          t.id === TOURNAMENT.id ? { ...t, results: [...t.results, { key, matchId: match.id, winnerTeam: winner }] } : t,
        )
      : [...tournaments, { id: TOURNAMENT.id, teams, groups: draw.groups, results: [{ key, matchId: match.id, winnerTeam: winner }] }],
  };
  const reward = computeReward(world, match, session.playerId, afterWorld);
  return NextResponse.json({
    success: true,
    matchId: match.id,
    winnerDelta: match.winner_elo_after - match.winner_elo_before,
    loserDelta: match.loser_elo_after - match.loser_elo_before,
    reward,
  });
}
