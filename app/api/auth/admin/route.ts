import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_MAX_AGE, adminConfigured, checkAdminLogin, cookieOptions, sessionToken } from "@/lib/auth";
import { jsonError, readJson } from "@/lib/server";

// Notfall-Login für den Admin mit Benutzername und Passwort.
export async function POST(req: NextRequest) {
  const body = await readJson<{ username: string; password: string }>(req);
  if (!adminConfigured()) return jsonError("Admin-Login ist nicht eingerichtet (ADMIN_PASSWORD fehlt).", 500);
  const session = checkAdminLogin(body.username ?? "", body.password ?? "");
  if (!session) {
    await new Promise((r) => setTimeout(r, 600));
    return jsonError("Benutzername oder Passwort falsch.", 401);
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, sessionToken(session), cookieOptions(SESSION_MAX_AGE));
  return res;
}
