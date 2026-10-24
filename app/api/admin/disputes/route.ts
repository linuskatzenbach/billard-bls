import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { markDisputesSeen } from "@/lib/db";

export async function POST() {
  if (await isAdmin()) await markDisputesSeen();
  return NextResponse.json({ success: true });
}
