import { NextRequest, NextResponse } from "next/server";
import { calculateNewElo } from "@/lib/elo";
import { getSession } from "@/lib/auth";
import { getWorld } from "@/lib/db";
import { computeOverview } from "@/lib/progress";
import { computeReward } from "@/lib/reward";
import { jsonError, readJson } from "@/lib/server";

// Testspiel im Admin-Bereich: rechnet mit den echten Zahlen (inkl.
// Belohnungsbildschirm), speichert aber NICHTS.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.admin) return jsonError("Nur im Admin-Bereich möglich.", 401);
  const body = await readJson<{ opponentId: string; won: boolean }>(req);
  const world = await getWorld();
  const ov = computeOverview(world);
  const me = ov.byId[session.playerId];
  const opp = ov.byId[String(body.opponentId ?? "")];
  if (!me || !opp || me.id === opp.id) return jsonError("Bitte einen Gegner wählen.");
  const [w, l] = body.won ? [me, opp] : [opp, me];
  const { newWinnerElo, newLoserElo } = calculateNewElo(w.elo, l.elo);
  const fake = {
    id: -1,
    winner_id: w.id,
    loser_id: l.id,
    winner_elo_before: w.elo,
    loser_elo_before: l.elo,
    winner_elo_after: newWinnerElo,
    loser_elo_after: newLoserElo,
    created_at: new Date().toISOString(),
    entered_by: me.id,
  };
  return NextResponse.json({
    success: true,
    test: true,
    winnerDelta: newWinnerElo - w.elo,
    loserDelta: newLoserElo - l.elo,
    reward: computeReward(world, fake, me.id),
  });
}
