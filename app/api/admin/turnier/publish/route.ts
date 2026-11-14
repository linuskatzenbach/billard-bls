import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/server";
import { TournamentError, publishDraw } from "@/lib/tournament";

// Auslosung veröffentlichen (danach fest und im Turnier-Tab sichtbar). Nur Admin.
export async function POST() {
  if (!(await isAdmin())) return jsonError("Nur für den Admin.", 403);
  try {
    await publishDraw();
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof TournamentError) return jsonError(err.message);
    throw err;
  }
}
