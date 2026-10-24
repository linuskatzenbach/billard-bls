import { NextRequest, NextResponse } from "next/server";
import { calculateNewElo } from "@/lib/elo";
import { getSession } from "@/lib/auth";
import { getWorld } from "@/lib/db";
import { computeOverview } from "@/lib/progress";
import { jsonError, readJson } from "@/lib/server";

// Testspiel im Admin-Bereich: rechnet mit den echten Zahlen, speichert aber NICHTS.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.admin) return jsonError("Nur im Admin-Bereich möglich.", 401);
  const body = await readJson<{ opponentId: string; won: boolean }>(req);
  const ov = computeOverview(await getWorld());
  const me = ov.byId[session.playerId];
  const opp = ov.byId[String(body.opponentId ?? "")];
  if (!me || !opp || me.id === opp.id) return jsonError("Bitte einen Gegner wählen.");
  const [w, l] = body.won ? [me, opp] : [opp, me];
  const { newWinnerElo, newLoserElo } = calculateNewElo(w.elo, l.elo);
  return NextResponse.json({
    success: true,
    test: true,
    winnerDelta: newWinnerElo - w.elo,
    loserDelta: newLoserElo - l.elo,
    xp: 0,
    levelBefore: me.level,
    levelAfter: me.level,
  });
}
