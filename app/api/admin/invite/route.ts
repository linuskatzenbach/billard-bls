import { NextRequest, NextResponse } from "next/server";
import { isAdmin, newCode, newToken, sha256 } from "@/lib/auth";
import { createLoginToken, getPlayerById } from "@/lib/db";
import { MailNotConfigured, inviteMail, sendMail } from "@/lib/mail";
import { jsonError, readJson, siteOrigin } from "@/lib/server";

const INVITE_DAYS = 7;

// Admin: Einladung mit Anmeldelink an die hinterlegte Uni-Mail schicken.
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return jsonError("Nur für den Admin.", 403);
  const body = await readJson<{ id: string }>(req);
  const player = await getPlayerById(String(body.id ?? ""));
  if (!player) return jsonError("Unbekannter Spieler.", 404);
  if (!player.email) return jsonError("Bitte zuerst eine Uni-Mail eintragen und speichern.");

  const token = newToken();
  const code = newCode();
  await createLoginToken({
    email: player.email,
    tokenHash: sha256(token),
    codeHash: sha256(`${player.email}:${code}`),
    minutes: INVITE_DAYS * 24 * 60,
  });
  const mail = inviteMail(player.name, `${siteOrigin(req)}/anmelden?t=${token}`, code, INVITE_DAYS);
  try {
    await sendMail(player.email, mail.subject, mail.text, mail.html);
  } catch (err) {
    console.error("Einladung fehlgeschlagen", err);
    if (err instanceof MailNotConfigured) {
      return jsonError("Der Mail-Versand ist noch nicht eingerichtet (GMAIL_USER / GMAIL_APP_PASSWORD in Vercel).", 503);
    }
    return jsonError(`Gmail hat die Mail nicht angenommen: ${err instanceof Error ? err.message : "unbekannter Fehler"}`, 502);
  }
  return NextResponse.json({ success: true, email: player.email });
}
