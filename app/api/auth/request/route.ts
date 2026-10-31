import { NextRequest, NextResponse } from "next/server";
import { createLoginToken, recentTokenCount } from "@/lib/db";
import { newCode, newToken, normalizeEmail, sha256, UNI_DOMAIN } from "@/lib/auth";
import { MailNotConfigured, loginMail, sendMail } from "@/lib/mail";
import { jsonError, readJson, siteOrigin } from "@/lib/server";
import { reportError } from "@/lib/alert";

// Schickt einen Anmeldelink plus 6-stelligen Code an eine Uni-Mail.
export async function POST(req: NextRequest) {
  const body = await readJson<{ email: string }>(req);
  const email = normalizeEmail(body.email ?? "");
  if (!email) return jsonError(`Bitte deine Uni-Mail eingeben (…@${UNI_DOMAIN}).`);

  // Höchstens 3 Mails in 10 Minuten pro Adresse.
  if ((await recentTokenCount(email, 600)) >= 3) {
    return jsonError("Du hast schon mehrere Links angefordert. Bitte warte ein paar Minuten.", 429);
  }

  const token = newToken();
  const code = newCode();
  await createLoginToken({ email, tokenHash: sha256(token), codeHash: sha256(`${email}:${code}`), minutes: 15 });

  const link = `${siteOrigin(req)}/anmelden?t=${token}`;
  const mail = loginMail(link, code);
  try {
    await sendMail(email, mail.subject, mail.text, mail.html);
  } catch (err) {
    await reportError("Anmeldemail an " + email, err);
    if (err instanceof MailNotConfigured) {
      return jsonError("Der Mail-Versand ist noch nicht eingerichtet. Bitte gib dem Admin Bescheid.", 503);
    }
    return jsonError("Die Mail konnte gerade nicht verschickt werden. Bitte später nochmal versuchen.", 502);
  }
  return NextResponse.json({ success: true, email });
}
