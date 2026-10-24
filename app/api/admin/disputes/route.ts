import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { markDisputesSeen, markSignupsSeen } from "@/lib/db";

export async function POST() {
  // Beim Öffnen des Admin-Bereichs: Widersprüche und neue Anmeldungen als gesehen markieren.
  if (await isAdmin()) await Promise.all([markDisputesSeen(), markSignupsSeen()]);
  return NextResponse.json({ success: true });
}
