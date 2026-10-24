import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { countUnread, countUnseenDisputes } from "@/lib/db";

// Für den roten Punkt in der Leiste unten.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ loggedIn: false, unread: 0 });
  const [unread, disputes] = await Promise.all([
    countUnread(session.playerId),
    session.admin ? countUnseenDisputes() : Promise.resolve(0),
  ]);
  return NextResponse.json(
    { loggedIn: true, unread: unread + disputes },
    { headers: { "Cache-Control": "no-store" } }
  );
}
