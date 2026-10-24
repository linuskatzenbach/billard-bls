import { NextRequest, NextResponse } from "next/server";
import { createPlayer, getPlayerByEmail, isNameTaken } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  SIGNUP_COOKIE,
  cookieOptions,
  getSignupEmail,
  sessionToken,
} from "@/lib/auth";
import { jsonError, readJson, refreshWorld } from "@/lib/server";
import { COHORTS, nameCandidates } from "@/lib/names";

// Profil anlegen (nach dem ersten Login mit einer neuen Uni-Mail).
export async function POST(req: NextRequest) {
  const email = await getSignupEmail();
  if (!email) return jsonError("Deine Anmeldung ist abgelaufen. Bitte fordere einen neuen Link an.", 401);

  const body = await readJson<{ cohort: string | null }>(req);
  const cohort = body.cohort && COHORTS.includes(body.cohort) ? body.cohort : null;
  if (!cohort) return jsonError("Bitte wähle deinen Jahrgang aus.");

  // Name = Vorname aus der Mail; bei Gleichheit mit Anfangsbuchstaben des Nachnamens.
  let name = "";
  for (const c of nameCandidates(email)) {
    if (c.length >= 2 && !(await isNameTaken(c))) {
      name = c;
      break;
    }
  }
  if (!name) return jsonError("Das hat nicht geklappt. Bitte schreib uns an bls.billard@gmail.com.");

  const existing = await getPlayerByEmail(email);
  const player = existing ?? (await createPlayer({ email, name, cohort }));
  refreshWorld();

  const res = NextResponse.json({ success: true, playerId: player.id, name: player.name });
  res.cookies.set(SESSION_COOKIE, sessionToken({ playerId: player.id, admin: player.is_admin }), cookieOptions(SESSION_MAX_AGE));
  res.cookies.set(SIGNUP_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
