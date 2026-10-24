import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { disputeMatch, getMatch, getPlayerById } from "@/lib/db";
import { ADMIN_MAIL, disputeMail, sendMail } from "@/lib/mail";
import { DISPUTE_HOURS, berlinDateTime, jsonError, readJson, refreshWorld, siteOrigin } from "@/lib/server";

// "Stimmt nicht": Beteiligte können ein Spiel innerhalb von 24 Stunden
// löschen. Der Admin sieht das im Admin-Bereich und bekommt eine Mail.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Bitte zuerst anmelden.", 401);
  const body = await readJson<{ matchId: number }>(req);
  const matchId = Number(body.matchId);
  const m = await getMatch(matchId);
  if (!m) return jsonError("Dieses Spiel gibt es nicht mehr.", 404);
  if (m.winner_id !== session.playerId && m.loser_id !== session.playerId && !session.admin) {
    return jsonError("Nur Beteiligte können widersprechen.", 403);
  }
  const age = Date.now() - new Date(m.created_at).getTime();
  if (age > DISPUTE_HOURS * 3600_000 && !session.admin) {
    return jsonError("Widersprechen geht nur innerhalb von 24 Stunden. Melde dich sonst beim Admin.", 403);
  }

  const deleted = await disputeMatch(matchId, session.playerId);
  if (!deleted) return jsonError("Dieses Spiel gibt es nicht mehr.", 404);
  refreshWorld();

  try {
    const name = async (id: string | null) => (id ? (await getPlayerById(id))?.name ?? id : "unbekannt");
    const mail = disputeMail({
      winner: await name(m.winner_id),
      loser: await name(m.loser_id),
      enteredBy: await name(m.entered_by),
      disputedBy: await name(session.playerId),
      playedAt: berlinDateTime(m.created_at),
      adminLink: `${siteOrigin(req)}/mein/admin`,
    });
    await sendMail(ADMIN_MAIL, mail.subject, mail.text, mail.html);
  } catch (err) {
    console.error("Admin-Mail fehlgeschlagen", err);
  }
  return NextResponse.json({ success: true });
}
