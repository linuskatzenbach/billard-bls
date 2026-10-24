import { NextRequest } from "next/server";
import { consumeToken } from "@/lib/db";
import { sha256 } from "@/lib/auth";
import { jsonError, loginResponse, readJson } from "@/lib/server";

// Löst den Link aus der Mail ein. Absichtlich per Knopfdruck (POST) statt
// direkt beim Öffnen: Mail-Programme rufen Links manchmal vorab auf, um sie
// zu prüfen – sonst wäre der Link verbraucht, bevor man selbst klickt.
export async function POST(req: NextRequest) {
  const body = await readJson<{ token: string }>(req);
  const token = String(body.token ?? "");
  if (!token) return jsonError("Ungültiger Link.");
  const email = await consumeToken(sha256(token));
  if (!email) return jsonError("Dieser Link ist abgelaufen oder wurde schon benutzt. Fordere einfach einen neuen an.", 401);
  return loginResponse(email);
}
