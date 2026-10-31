import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPlayerById, getWorld, recordMatch } from "@/lib/db";
import { computeReward } from "@/lib/reward";
import { jsonError, readJson, refreshWorld } from "@/lib/server";

// Spiel eintragen – immer vom eigenen Konto aus, zählt sofort.
// Die anderen Beteiligten sehen es als roten Punkt und können 24 h lang
// widersprechen. Einzel: opponentId. Doppel: partnerId + opponentIds (2).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Bitte zuerst anmelden.", 401);

  const body = await readJson<{ opponentId: string; partnerId: string; opponentIds: string[]; won: boolean }>(req);
  if (typeof body.won !== "boolean") return jsonError("Bitte auswählen, wer gewonnen hat.");
  const doubles = body.partnerId !== undefined || body.opponentIds !== undefined;

  const myTeam = doubles ? [session.playerId, String(body.partnerId ?? "")] : [session.playerId];
  const theirs = doubles ? (Array.isArray(body.opponentIds) ? body.opponentIds.map(String) : []) : [String(body.opponentId ?? "")];
  const ids = [...myTeam, ...theirs];
  if (doubles && (theirs.length !== 2 || !myTeam[1])) return jsonError("Bitte Partner und zwei Gegner wählen.");
  if (ids.some((id) => !id)) return jsonError("Bitte einen Gegner auswählen.");
  if (new Set(ids).size !== ids.length) return jsonError("Jeder Spieler darf nur einmal vorkommen.");

  const players = await Promise.all(ids.map((id) => getPlayerById(id)));
  if (!players[0]) return jsonError("Dein Profil wurde nicht gefunden. Bitte neu anmelden.", 401);
  if (players.slice(1).some((p) => !p || p.hidden)) return jsonError(doubles ? "Unbekannter Spieler." : "Unbekannter Gegner.");

  const world = await getWorld();
  const match = await recordMatch({
    winnerIds: body.won ? myTeam : theirs,
    loserIds: body.won ? theirs : myTeam,
    enteredBy: session.playerId,
  });
  refreshWorld();

  // Belohnung berechnen (Stand vorher gegen Stand mit dem neuen Spiel)
  const reward = computeReward(world, match, session.playerId);

  return NextResponse.json({
    success: true,
    matchId: match.id,
    winnerDelta: match.winner_elo_after - match.winner_elo_before,
    loserDelta: match.loser_elo_after - match.loser_elo_before,
    reward,
  });
}
