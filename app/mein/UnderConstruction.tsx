// Baustellenschild für „Mein Bereich“: hängt an zwei Ketten, Holzrahmen
// wie die Bande, Filz-Schild mit Warnstreifen in Messing/Schwarz.
export default function UnderConstruction() {
  return (
    <div className="construction" role="note" aria-label="Hinweis: Dieser Bereich ist noch im Aufbau">
      <span className="construction-chain left" aria-hidden="true" />
      <span className="construction-chain right" aria-hidden="true" />
      <div className="construction-sign">
        <span className="construction-stripes" aria-hidden="true" />
        <div className="construction-felt">
          <svg className="construction-icon" viewBox="0 0 64 40" aria-hidden="true">
            {/* Dreieck mit Kugeln: das Rack wird noch aufgebaut */}
            <path className="rack" d="M32 4 58 36H6Z" />
            <circle className="b b1" cx="32" cy="17" r="5" />
            <circle className="b b2" cx="25.5" cy="28" r="5" />
            <circle className="b b3" cx="38.5" cy="28" r="5" />
          </svg>
          <strong className="construction-title">Hier wird noch gebaut</strong>
        </div>
        <span className="construction-stripes" aria-hidden="true" />
      </div>
    </div>
  );
}
