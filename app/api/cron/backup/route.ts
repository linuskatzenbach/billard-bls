import { NextRequest, NextResponse, connection } from "next/server";
import { runWeeklyBackup } from "@/lib/backup";
import { jsonError } from "@/lib/server";

// Wöchentliche Sicherung per Mail an den Admin. Wird von Vercel automatisch
// aufgerufen (siehe vercel.json, sonntags früh).
//
// Schutz: Ist in Vercel CRON_SECRET gesetzt, schickt Vercel ihn mit und nur
// dann läuft die Sicherung. Unabhängig davon wird höchstens alle 6 Tage eine
// Mail verschickt – selbst wenn jemand die Adresse von Hand aufruft.
export async function GET(req: NextRequest) {
  // Nie beim Bauen der App ausführen, sondern immer erst beim echten Aufruf.
  await connection();
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return jsonError("Nicht erlaubt.", 401);
  }
  const result = await runWeeklyBackup();
  if ("error" in result) return jsonError("Sicherung konnte nicht verschickt werden.", 500);
  return NextResponse.json(result);
}
