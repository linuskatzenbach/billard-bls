import { NextRequest, NextResponse } from "next/server";
import { adminConfigured, checkLogin, createToken, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { username?: string; password?: string };

  if (!adminConfigured()) {
    return NextResponse.json(
      { error: "Login ist noch nicht eingerichtet (ADMIN_PASSWORD fehlt)." },
      { status: 500 }
    );
  }

  const session = checkLogin(body.username ?? "", body.password ?? "");
  if (!session) {
    // Kleine Verzögerung bremst wildes Durchprobieren.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Benutzername oder Passwort falsch." }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, createToken(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
