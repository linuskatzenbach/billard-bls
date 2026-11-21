import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { jsonError, refreshWorld } from "@/lib/server";

// Zwischengespeicherte Daten sofort verwerfen – z. B. nach einer Korrektur
// direkt in der Datenbank, die an der App vorbeigelaufen ist. Nur Admin.
export async function POST() {
  if (!(await isAdmin())) return jsonError("Nur für den Admin.", 403);
  refreshWorld();
  return NextResponse.json({ success: true });
}
