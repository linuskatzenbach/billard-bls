import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { disputeMatch, getWorld, recordMatch } from "@/lib/db";
import { computeReward } from "@/lib/reward";
import { jsonError, readJson, refreshWorld } from "@/lib/server";
import { reportError } from "@/lib/alert";
import { getDraw, getResults, getTeams, saveResult } from "@/lib/tournament";
import { pairKey } from "@/lib/tournament-draw";

// Ergebnis eines Gruppenspiels eintragen. Dürfen nur die vier Beteiligten. Es entsteht ein ganz normales Doppel (Elo, Widerspruch usw.).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Bitte zuerst anmelden.", 401);
  const body = await readJson<{ a: number; b: number; winner: number }>(req);
  const a = Number(body.a);
  const b = Number(body.b);
  const winner = Number(body.winner);
  if (winner !== a && winner !== b) return jsonError("Bitte das Siegerteam antippen.");

  const [draw, teams, results] = await Promise.all([getDraw(), getTeams(), getResults()]);
  if (!draw?.published) return jsonError("Die Gruppen stehen noch nicht fest.");
  if (!draw.groups.some((g) => g.includes(a) && g.includes(b)) || a === b) return jsonError("Diese Paarung gibt es nicht.");
  const key = pairKey(a, b);
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

  const reward = computeReward(world, match, session.playerId);
  return NextResponse.json({
    success: true,
    matchId: match.id,
    winnerDelta: match.winner_elo_after - match.winner_elo_before,
    loserDelta: match.loser_elo_after - match.loser_elo_before,
    reward,
  });
}
