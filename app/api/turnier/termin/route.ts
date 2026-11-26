import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/server";
import { clearSchedule, getDraw, getResults, getTeams, saveSchedule } from "@/lib/tournament";
import { koBracket, validTermin } from "@/lib/tournament-draw";

// Termin einer K.O.-Serie setzen oder löschen. Dürfen die vier Beteiligten
// (und der Admin, falls ihm jemand den Termin nur zuruft).
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Bitte zuerst anmelden.", 401);
  const body = await readJson<{ ko: string; day?: string; time?: string; clear?: boolean }>(req);

  const [draw, teams, results] = await Promise.all([getDraw(), getTeams(), getResults()]);
  if (!draw?.published) return jsonError("Die Gruppen stehen noch nicht fest.");
  const s = koBracket(draw.groups, results).find((x) => x.id === body.ko);
  if (!s || s.teams[0] === null || s.teams[1] === null) return jsonError("Diese Partie steht noch nicht fest.");
  if (s.winner !== null) return jsonError("Diese Serie ist schon entschieden.");
  const four = teams
    .filter((t) => t.id === s.teams[0] || t.id === s.teams[1])
    .flatMap((t) => [t.player1, t.player2]);
  if (!four.includes(session.playerId) && !session.admin) {
    return jsonError("Den Termin können nur die vier Spieler dieser Partie eintragen.", 403);
  }

  if (body.clear) {
    await clearSchedule(s.id);
    return NextResponse.json({ success: true });
  }
  const day = String(body.day ?? "");
  const time = String(body.time ?? "");
  if (!validTermin(day, time)) return jsonError("Bitte Tag und Uhrzeit angeben.");
  await saveSchedule(s.id, day, time, "", session.playerId);
  return NextResponse.json({ success: true });
}
