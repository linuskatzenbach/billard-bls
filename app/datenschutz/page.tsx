import Link from "next/link";

// ENTWURF – bitte vom Betreiber prüfen und ergänzen.
export default function DatenschutzPage() {
  return (
    <div className="legal">
      <Link href="/mein" className="back-link">
        ← Zurück
      </Link>
      <h1>Datenschutz</h1>

      <h2>Wer betreibt Billard BLS?</h2>
      <p>
        Billard BLS ist ein privates, nicht kommerzielles Projekt von Studierenden der Bucerius Law School. Es ist kein
        Angebot der Bucerius Law School. Kontakt: <a href="mailto:bls.billard@gmail.com">bls.billard@gmail.com</a>
      </p>

      <h2>Welche Daten speichern wir?</h2>
      <ul>
        <li>deine Uni-Mail-Adresse (nur für die Anmeldung, nicht öffentlich sichtbar)</li>
        <li>deinen Anzeigenamen und deinen Jahrgang</li>
        <li>deine eingetragenen Spiele mit Datum und Uhrzeit sowie die daraus berechneten Werte (Elo, Level, Statistiken)</li>
      </ul>
      <p>
        Öffentlich sichtbar sind dein Anzeigename, dein Jahrgang, deine Spiele und die daraus berechneten Werte – das ist der Sinn der
        Rangliste.
      </p>

      <h2>Wofür?</h2>
      <p>
        Nur für den Betrieb der Rangliste: Anmeldung, Anzeige der Spiele und Ranglisten. Keine Werbung, kein Tracking,
        keine Weitergabe an Dritte zu anderen Zwecken.
      </p>

      <h2>Technik</h2>
      <p>
        Die Seite läuft bei Vercel (Hosting), die Daten liegen in einer Datenbank bei Neon. Anmelde-Mails werden über
        Gmail verschickt. Es wird nur ein Anmelde-Cookie gesetzt, das für die Funktion nötig ist.
      </p>

      <h2>Löschen</h2>
      <p>
        Schreib eine Mail an <a href="mailto:bls.billard@gmail.com">bls.billard@gmail.com</a>, dann löschen wir dein
        Profil bzw. deine Mail-Adresse.
      </p>
    </div>
  );
}
