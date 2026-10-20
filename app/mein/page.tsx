import Link from "next/link";
import { getSession } from "@/lib/auth";
import LoginForm from "./LoginForm";
import LogoutButton from "./LogoutButton";

// Persönlicher Bereich: ohne Login das Login-Formular, als Admin der
// Testbereich. Spielerprofile folgen später.
export default async function MeinPage() {
  const session = await getSession();

  if (!session) {
    return (
      <>
        <h1>Mein Bereich</h1>
        <p className="subtitle">Einloggen, um dein Profil zu sehen.</p>
        <LoginForm />
      </>
    );
  }

  return (
    <>
      <div className="me-head">
        <span className="me-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 2.5 4.5 5.6v5.5c0 4.6 3.1 8.7 7.5 10.4 4.4-1.7 7.5-5.8 7.5-10.4V5.6L12 2.5Z" />
          </svg>
        </span>
        <h1>Admin</h1>
        <p className="subtitle">Testbereich – hier zählt nichts</p>
      </div>

      <Link href="/mein/test" className="cta cta-test">
        <span className="cta-felt">
          <span className="cta-label">Testspiel eintragen</span>
          <span className="cta-track" aria-hidden="true">
            <span className="cta-pocket" />
            <span className="cta-cue" />
            <span className="cta-ball" />
          </span>
        </span>
      </Link>

      <p className="me-note">
        Testspiele laufen mit der kompletten Sieges-Animation und echten Elo-Zahlen als Vorschau, werden aber nicht
        gespeichert. Rangliste, Statistiken und Spielerprofile bleiben unverändert.
      </p>

      <LogoutButton />
    </>
  );
}
