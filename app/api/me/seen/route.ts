import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { markSeen } from "@/lib/db";

export async function POST() {
  const session = await getSession();
  if (session) await markSeen(session.playerId);
  return NextResponse.json({ success: true });
}
