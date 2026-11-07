import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getPlayerById } from "@/lib/db";
import { sendMail, teamRequestMail } from "@/lib/mail";
import { reportError } from "@/lib/alert";
import { jsonError, readJson, siteOrigin } from "@/lib/server";
import {
  TOURNAMENT,
  TournamentError,
  acceptRequest,
  declineRequest,
  sendRequest,
  withdrawRequest,
} from "@/lib/tournament";

// 2v2-Turnier: Partner anfragen, Anfrage zurückziehen, annehmen, ablehnen.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return jsonError("Bitte zuerst anmelden.", 401);
  const body = await readJson<{ action: string; playerId: string; requestId: number }>(req);
  const me = session.playerId;

  try {
    switch (body.action) {
      case "invite": {
        const toId = String(body.playerId ?? "");
        const [from, to] = await Promise.all([getPlayerById(me), getPlayerById(toId)]);
        if (!from) return jsonError("Dein Profil wurde nicht gefunden. Bitte neu anmelden.", 401);
        if (!to || to.hidden || !to.email) return jsonError("Diese Person kann gerade nicht angefragt werden.");
        await sendRequest(me, toId);
        try {
          const mail = teamRequestMail({
            to: to.name,
            from: from.name,
            link: `${siteOrigin(req)}/turnier`,
            deadline: TOURNAMENT.deadlineLabel,
          });
          await sendMail(to.email, mail.subject, mail.text, mail.html);
        } catch (err) {
          // Die Anfrage steht trotzdem – die Person sieht sie in der App.
          await reportError("Turnier-Anfrage-Mail", err);
        }
        break;
      }
      case "withdraw":
        await withdrawRequest(me);
        break;
      case "accept":
        await acceptRequest(Number(body.requestId), me);
        break;
      case "decline":
        await declineRequest(Number(body.requestId), me);
        break;
      default:
        return jsonError("Unbekannte Aktion.");
    }
  } catch (err) {
    if (err instanceof TournamentError) return jsonError(err.message, 409);
    await reportError("Turnier", err);
    return jsonError("Etwas ist schiefgelaufen. Bitte nochmal versuchen.", 500);
  }
  return NextResponse.json({ success: true });
}
