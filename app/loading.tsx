// Wird automatisch angezeigt, während eine Seite ihre Daten lädt.
export default function Loading() {
  return (
    <div className="loader" role="status" aria-label="Lädt">
      <div className="loader-track">
        <div className="loader-roll">
          <svg className="loader-ball" viewBox="0 0 100 100" aria-hidden="true">
            <defs>
              <radialGradient id="loader-shine" cx="38%" cy="32%" r="75%">
                <stop offset="0" stopColor="#3a3a3a" />
                <stop offset="0.45" stopColor="#151515" />
                <stop offset="1" stopColor="#050505" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="50" fill="url(#loader-shine)" />
            <g className="loader-face">
              <circle cx="50" cy="50" r="21" fill="#f1e9d8" />
              <circle cx="50" cy="43.6" r="5.8" fill="none" stroke="#151515" strokeWidth="4" />
              <circle cx="50" cy="56.6" r="7.1" fill="none" stroke="#151515" strokeWidth="4" />
            </g>
          </svg>
        </div>
        <div className="loader-shadow" />
      </div>
      <p className="loader-text">Kugeln werden aufgebaut …</p>
    </div>
  );
}
