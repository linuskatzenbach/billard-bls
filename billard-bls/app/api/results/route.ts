import { NextRequest, NextResponse } from "next/server";
import { PLAYERS } from "@/lib/players";
import { calculateNewElo } from "@/lib/elo";
import { getElo, recordMatch } from "@/lib/db";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  const { winnerId, loserId, password } = body as {
    winnerId?: string;
    loserId?: string;
    password?: string;
  };

  const expectedPassword = process.env.RESULT_PASSWORD;
  if (!expectedPassword) {
    return NextResponse.json(
      { error: "Server ist nicht korrekt konfiguriert (RESULT_PASSWORD fehlt)." },
      { status: 500 }
    );
  }
  if (password !== expectedPassword) {
    return NextResponse.json({ error: "Falsches Passwort." }, { status: 401 });
  }

  if (!winnerId || !loserId) {
    return NextResponse.json(
      { error: "Bitte Gewinner und Verlierer auswählen." },
      { status: 400 }
    );
  }
  if (winnerId === loserId) {
    return NextResponse.json(
      { error: "Gewinner und Verlierer dürfen nicht gleich sein." },
      { status: 400 }
    );
  }
  const validIds = new Set(PLAYERS.map((p) => p.id));
  if (!validIds.has(winnerId) || !validIds.has(loserId)) {
    return NextResponse.json({ error: "Unbekannter Spieler." }, { status: 400 });
  }

  const winnerEloBefore = await getElo(winnerId);
  const loserEloBefore = await getElo(loserId);

  const { newWinnerElo, newLoserElo } = calculateNewElo(
    winnerEloBefore,
    loserEloBefore
  );

  await recordMatch({
    winnerId,
    loserId,
    winnerEloBefore,
    loserEloBefore,
    winnerEloAfter: newWinnerElo,
    loserEloAfter: newLoserElo,
  });

  return NextResponse.json({
    success: true,
    winnerElo: newWinnerElo,
    loserElo: newLoserElo,
  });
}
