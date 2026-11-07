import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { countUnread, countUnseenDisputes, countUnseenSignups } from "@/lib/db";
import { countIncomingRequests } from "@/lib/tournament";

// Für den roten Punkt in der Leiste unten.
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ loggedIn: false, unread: 0, turnier: 0 });
  const [unread, disputes, signups, turnier] = await Promise.all([
    countUnread(session.playerId),
    session.admin ? countUnseenDisputes() : Promise.resolve(0),
    session.admin ? countUnseenSignups() : Promise.resolve(0),
    // Offene Team-Anfragen fürs 2v2-Turnier (roter Punkt am Turnier-Tab).
    countIncomingRequests(session.playerId).catch(() => 0),
  ]);
  return NextResponse.json(
    { loggedIn: true, unread: unread + disputes + signups, turnier },
    { headers: { "Cache-Control": "no-store" } }
  );
}
