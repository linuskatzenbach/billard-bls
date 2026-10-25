import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, getSignupEmail } from "@/lib/auth";
import { countUnread, countUnseenDisputes, countUnseenSignups, getSeenAt } from "@/lib/db";
import { getOverview } from "@/lib/server";
import ProfileView from "../ProfileView";
import EmailLogin from "./EmailLogin";
import LogoutButton from "./LogoutButton";
import MarkSeen from "./MarkSeen";

// Persönlicher Bereich: ohne Login die Anmeldung per Uni-Mail, sonst das
// eigene Profil.
export default async function MeinPage() {
  await connection();
  const session = await getSession();

  if (!session) {
    if (await getSignupEmail()) redirect("/willkommen");
    return <EmailLogin />;
  }

  const [{ world, ov }, seenAt, unread, disputes, signups] = await Promise.all([
    getOverview(),
    getSeenAt(session.playerId),
    countUnread(session.playerId),
    session.admin ? countUnseenDisputes() : Promise.resolve(0),
    session.admin ? countUnseenSignups() : Promise.resolve(0),
  ]);
  const adminNew = disputes + signups;
  const me = ov.byId[session.playerId];

  if (!me) {
    return (
      <div className="auth">
        <h1>Hoppla</h1>
        <p className="subtitle">Dein Profil wurde nicht gefunden.</p>
        <LogoutButton />
      </div>
    );
  }

  return (
    <>
      <MarkSeen needed={unread > 0} />
      {session.admin && (
        <Link href="/profil/admin" className="admin-link">
          🛡️ Admin-Bereich
          {adminNew > 0 && <span className="admin-badge">{adminNew} neu</span>}
        </Link>
      )}
      <ProfileView s={me} world={world} ov={ov} own viewerId={session.playerId} seenAt={seenAt} />
      <div className="me-foot">
        <LogoutButton />
        <Link href="/regeln" className="foot-link">
          Regeln
        </Link>
        <Link href="/datenschutz" className="foot-link">
          Datenschutz
        </Link>
      </div>
    </>
  );
}
