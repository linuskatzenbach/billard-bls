import { NextRequest, NextResponse } from "next/server";
import { eloDelta } from "@/lib/elo";
import { getSession } from "@/lib/auth";
import type { MatchRow } from "@/lib/db";
import { getWorld } from "@/lib/db";
import { computeOverview } from "@/lib/progress";
import { computeReward } from "@/lib/reward";
import { jsonError, readJson } from "@/lib/server";

// Testspiel im Admin-Bereich: rechnet mit den echten Zahlen (inkl.
// Belohnungsbildschirm), speichert aber NICHTS. Einzel oder Doppel.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.admin) return jsonError("Nur im Admin-Bereich möglich.", 401);
  const body = await readJson<{ opponentId?: string; won: boolean; partnerId?: string; opponentIds?: string[] }>(req);
  const world = await getWorld();
  const ov = computeOverview(world);
  const me = ov.byId[session.playerId];
  const doubles = body.partnerId !== undefined || body.opponentIds !== undefined;

  const myTeam = doubles ? [me, ov.byId[String(body.partnerId ?? "")]] : [me];
  const theirs = doubles ? (body.opponentIds ?? []).map((id) => ov.byId[String(id)]) : [ov.byId[String(body.opponentId ?? "")]];
  const ids = [...myTeam, ...theirs].map((p) => p?.id);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length || (doubles && theirs.length !== 2)) {
    return jsonError(doubles ? "Bitte Partner und zwei Gegner wählen." : "Bitte einen Gegner wählen.");
  }
  const W = body.won ? myTeam : theirs;
  const L = body.won ? theirs : myTeam;
  const avg = (xs: typeof W) => xs.reduce((n, p) => n + p!.elo, 0) / xs.length;
  const d = eloDelta(avg(W), avg(L));
  const fake: MatchRow = {
    id: -1,
    winner_id: W[0]!.id,
    loser_id: L[0]!.id,
    winner_elo_before: W[0]!.elo,
    loser_elo_before: L[0]!.elo,
    winner_elo_after: W[0]!.elo + d.win,
    loser_elo_after: L[0]!.elo + d.lose,
    created_at: new Date().toISOString(),
    entered_by: me!.id,
    winner2_id: W[1]?.id ?? null,
    loser2_id: L[1]?.id ?? null,
    winner2_elo_before: W[1] ? W[1].elo : null,
    loser2_elo_before: L[1] ? L[1].elo : null,
    winner2_elo_after: W[1] ? W[1].elo + d.win : null,
    loser2_elo_after: L[1] ? L[1].elo + d.lose : null,
  };
  return NextResponse.json({
    success: true,
    test: true,
    winnerDelta: d.win,
    loserDelta: d.lose,
    reward: computeReward(world, fake, me!.id),
  });
}
