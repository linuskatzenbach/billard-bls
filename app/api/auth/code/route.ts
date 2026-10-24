import { NextRequest } from "next/server";
import { consumeCode } from "@/lib/db";
import { normalizeEmail, sha256 } from "@/lib/auth";
import { jsonError, loginResponse, readJson } from "@/lib/server";

// Anmeldung mit dem 6-stelligen Code aus der Mail (praktisch, wenn die App
// als Icon auf dem Homescreen liegt und der Link im Browser aufgehen würde).
export async function POST(req: NextRequest) {
  const body = await readJson<{ email: string; code: string }>(req);
  const email = normalizeEmail(body.email ?? "");
  const code = String(body.code ?? "").replace(/\D/g, "");
  if (!email || code.length !== 6) return jsonError("Bitte den 6-stelligen Code eingeben.");
  const ok = await consumeCode(email, sha256(`${email}:${code}`));
  if (!ok) {
    await new Promise((r) => setTimeout(r, 500));
    return jsonError("Der Code stimmt nicht oder ist abgelaufen.", 401);
  }
  return loginResponse(email);
}
