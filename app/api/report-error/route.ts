import { NextRequest, NextResponse } from "next/server";
import { reportError } from "@/lib/alert";
import { readJson } from "@/lib/server";

// Die Fehlerseite meldet hierher, wenn eine Seite nicht laden konnte.
export async function POST(req: NextRequest) {
  const body = await readJson<{ where: string; message: string; digest: string }>(req);
  const where = String(body.where ?? "?").slice(0, 120);
  const msg = [String(body.message ?? "").slice(0, 300), body.digest ? `(Digest ${String(body.digest).slice(0, 40)})` : ""]
    .filter(Boolean)
    .join(" ");
  await reportError(`Seite ${where}`, msg || "unbekannter Fehler");
  return NextResponse.json({ success: true });
}
