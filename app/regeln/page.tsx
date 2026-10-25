import Link from "next/link";

export const metadata = { title: "Regeln · Billard BLS" };

// Hausregeln (8-Ball nach Kneipenregeln) zum Nachschauen bei Streit.
export default function RegelnPage() {
  return (
    <div className="legal rules">
      <Link href="/" className="back-link">
        ← Rangliste
      </Link>
      <h1>Regeln</h1>
      <p className="rules-intro">
        Das hier sind die Hausregeln von Billard BLS. Wenn ihr euch vor dem Spiel auf etwas anderes einigt, gilt
        natürlich das.
      </p>

      <h2>Aufbau &amp; Anstoß</h2>
      <ul>
        <li>Gespielt wird 8-Ball mit 15 Kugeln: Volle (1–7), Halbe (9–15) und die schwarze 8.</li>
        <li>
          Dreieck: Spitze auf dem Fußpunkt, die 8 in die Mitte, je eine Volle und eine Halbe in die hinteren Ecken.
        </li>
        <li>Wer anstößt, wird ausgelost. Danach stößt der Verlierer des letzten Spiels an.</li>
        <li>Angestoßen wird aus dem Kopffeld, also hinter der Linie.</li>
      </ul>

      <h2>Nach dem Anstoß</h2>
      <ul>
        <li>Der Tisch ist offen, auch wenn beim Anstoß Kugeln fallen.</li>
        <li>Fällt beim Anstoß eine Kugel, bleibt der Anstoßende dran.</li>
        <li>Wer als Erstes nach dem Anstoß regulär eine Kugel versenkt, hat diese Farbe.</li>
        <li>
          Fällt die 8 beim Anstoß, hat der Anstoßende gewonnen. Fällt dabei auch die Weiße, hat er verloren.
        </li>
      </ul>

      <h2>Spielablauf</h2>
      <ul>
        <li>Wer eine eigene Kugel versenkt, darf weiterspielen.</li>
        <li>Kugeln müssen nicht angesagt werden.</li>
        <li>
          Mitversenkte gegnerische Kugeln bleiben drin. Fällt nur eine gegnerische Kugel, ist der Gegner dran.
        </li>
        <li>Wer alle eigenen Kugeln versenkt hat, spielt auf die 8.</li>
      </ul>

      <h2>Fouls</h2>
      <ul>
        <li>Die Weiße fällt in eine Tasche oder springt vom Tisch.</li>
        <li>Es wird keine Kugel getroffen.</li>
        <li>Zuerst wird eine gegnerische Kugel oder die 8 getroffen (solange noch eigene Kugeln liegen).</li>
        <li>Eine Kugel springt vom Tisch.</li>
        <li>Die Weiße wird zweimal berührt oder geschoben.</li>
        <li>Kugeln werden mit Hand, Kleidung oder Queue berührt.</li>
        <li>Beim Stoß ist kein Fuß am Boden.</li>
      </ul>

      <h2>Nach einem Foul</h2>
      <ul>
        <li>Der Gegner bekommt die Weiße in die Hand und legt sie beliebig auf dem ganzen Tisch ab.</li>
        <li>
          Versenkt jemand bei einem Foul eine eigene Kugel, bleibt sie drin, der Spieler ist aber trotzdem nicht mehr
          dran.
        </li>
      </ul>

      <h2>Die 8</h2>
      <ul>
        <li>
          Die 8 muss in die Tasche diagonal gegenüber der Tasche, in die die letzte eigene Kugel gefallen ist. Bei
          einer Mitteltasche ist das die andere Mitteltasche.
        </li>
        <li>
          Hat der Gegner die letzte eigene Kugel versenkt, darf der Spieler die Tasche für die 8 frei wählen und sagt
          sie an.
        </li>
        <li>
          Verloren hat, wer:
          <ul>
            <li>die 8 versenkt, bevor die eigenen Kugeln weg sind,</li>
            <li>die 8 in eine andere als die vorgeschriebene oder angesagte Tasche spielt,</li>
            <li>die 8 vom Tisch spielt,</li>
            <li>beim Versenken der 8 die Weiße mitversenkt.</li>
          </ul>
        </li>
      </ul>

      <h2>Nach Spielende</h2>
      <ul>
        <li>Eingetragen wird das Ergebnis nach Spielende vom Gewinner.</li>
        <li>
          Wenn es einen Eingabefehler gab, kann der andere Spieler innerhalb von 24 Stunden in der App widersprechen
          und das Ergebnis löschen. Sollten trotzdem Probleme bestehen, bitte{" "}
          <a href="mailto:bls.billard@gmail.com">bls.billard@gmail.com</a> schreiben.
        </li>
      </ul>
    </div>
  );
}
