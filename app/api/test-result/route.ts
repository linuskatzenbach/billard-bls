import { NextRequest, NextResponse } from "next/server";
import { PLAYERS } from "@/lib/players";
import { calculateNewElo } from "@/lib/elo";
import { getElo } from "@/lib/db";
import { isAdmin } from "@/lib/auth";

// Testspiel für das Admin-Profil: rechnet die Elo-Änderung mit den
// aktuellen Zahlen aus, speichert aber NICHTS. Rangliste, Statistiken
// und Profile bleiben unverändert.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Nur im Admin-Profil möglich." }, { status: 401 });
  }

  const { winnerId, loserId } = (await req.json().catch(() => ({}))) as {
    winnerId?: string;
    loserId?: string;
  };
  const validIds = new Set(PLAYERS.map((p) => p.id));
  if (!winnerId || !loserId || winnerId === loserId || !validIds.has(winnerId) || !validIds.has(loserId)) {
    return NextResponse.json({ error: "Bitte zwei verschiedene Spieler wählen." }, { status: 400 });
  }

  const winnerEloBefore = await getElo(winnerId);
  const loserEloBefore = await getElo(loserId);
  const { newWinnerElo, newLoserElo } = calculateNewElo(winnerEloBefore, loserEloBefore);

  return NextResponse.json({
    success: true,
    test: true,
    winnerDelta: newWinnerElo - winnerEloBefore,
    loserDelta: newLoserElo - loserEloBefore,
  });
}
