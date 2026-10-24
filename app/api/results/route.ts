import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPlayerById, getWorld, recordMatch } from "@/lib/db";
import { computeOverview, gameXp, levelFor } from "@/lib/progress";
import { jsonError, readJson, refreshWorld } from "@/lib/server";

// Spiel eintragen – immer vom eigenen Konto aus, zählt sofort.
// Der Gegner sieht es als roten Punkt und kann 24 h lang widersprechen.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Bitte zuerst anmelden.", 401);

  const body = await readJson<{ opponentId: string; won: boolean }>(req);
  const opponentId = String(body.opponentId ?? "");
  if (typeof body.won !== "boolean") return jsonError("Bitte auswählen, wer gewonnen hat.");
  if (!opponentId || opponentId === session.playerId) return jsonError("Bitte einen Gegner auswählen.");

  const [me, opponent] = await Promise.all([getPlayerById(session.playerId), getPlayerById(opponentId)]);
  if (!me) return jsonError("Dein Profil wurde nicht gefunden. Bitte neu anmelden.", 401);
  if (!opponent || opponent.hidden) return jsonError("Unbekannter Gegner.");

  // Stand vorher (für Level-Up-Anzeige)
  const before = computeOverview(await getWorld()).byId[me.id];

  const winnerId = body.won ? me.id : opponent.id;
  const loserId = body.won ? opponent.id : me.id;
  const match = await recordMatch({ winnerId, loserId, enteredBy: me.id });
  refreshWorld();

  const myXp = gameXp(match, me.id);
  const xpBefore = before?.xp ?? 0;
  const lvBefore = levelFor(xpBefore).level;
  const lvAfter = levelFor(xpBefore + myXp).level;

  return NextResponse.json({
    success: true,
    matchId: match.id,
    winnerDelta: match.winner_elo_after - match.winner_elo_before,
    loserDelta: match.loser_elo_after - match.loser_elo_before,
    xp: myXp,
    levelBefore: lvBefore,
    levelAfter: lvAfter,
  });
}
