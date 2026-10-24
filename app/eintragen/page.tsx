import { connection } from "next/server";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getOverview } from "@/lib/server";
import { picksFor } from "@/lib/picks";
import ResultForm from "../ResultForm";

export default async function EintragenPage() {
  await connection();
  const session = await getSession();
  if (!session) {
    return (
      <>
        <h1>Spiel eintragen</h1>
        <p className="subtitle">Eingetragen wird vom eigenen Profil aus.</p>
        <div className="card login-needed">
          <p>Melde dich mit deiner Uni-Mail an – dauert 30 Sekunden, ganz ohne Passwort.</p>
          <Link href="/profil" className="bigbtn">
            Anmelden
          </Link>
        </div>
        <Link href="/" className="nav-link">
          ← Zurück zur Rangliste
        </Link>
      </>
    );
  }
  const { ov } = await getOverview();
  const { me, opponents } = picksFor(ov, session.playerId);
  if (!me) {
    return (
      <>
        <h1>Spiel eintragen</h1>
        <p className="empty">Dein Profil wurde nicht gefunden. Bitte melde dich neu an.</p>
      </>
    );
  }
  return <ResultForm mode="live" me={me} opponents={opponents} />;
}
