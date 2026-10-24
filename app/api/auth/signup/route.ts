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
import { COHORTS, validateName } from "@/lib/names";

// Profil anlegen (nach dem ersten Login mit einer neuen Uni-Mail).
export async function POST(req: NextRequest) {
  const email = await getSignupEmail();
  if (!email) return jsonError("Deine Anmeldung ist abgelaufen. Bitte fordere einen neuen Link an.", 401);

  const body = await readJson<{ name: string; cohort: string | null }>(req);
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ");
  const nameError = validateName(name);
  if (nameError) return jsonError(nameError);
  if (await isNameTaken(name)) return jsonError("Diesen Namen gibt es schon. Ergänze z. B. den Anfangsbuchstaben deines Nachnamens.");
  const cohort = body.cohort && COHORTS.includes(body.cohort) ? body.cohort : null;

  const existing = await getPlayerByEmail(email);
  const player = existing ?? (await createPlayer({ email, name, cohort }));
  refreshWorld();

  const res = NextResponse.json({ success: true, playerId: player.id });
  res.cookies.set(SESSION_COOKIE, sessionToken({ playerId: player.id, admin: player.is_admin }), cookieOptions(SESSION_MAX_AGE));
  res.cookies.set(SIGNUP_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
