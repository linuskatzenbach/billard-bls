// Schwarze 8, die schräg liegt – für Fehler- und 404-Seiten.
export default function OopsBall() {
  return (
    <svg className="oops-ball" viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <radialGradient id="oops-shine" cx="38%" cy="32%" r="75%">
          <stop offset="0" stopColor="#3a3a3a" />
          <stop offset="0.45" stopColor="#151515" />
          <stop offset="1" stopColor="#050505" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="50" fill="url(#oops-shine)" />
      <g transform="rotate(-28 50 50)">
        <circle cx="50" cy="50" r="21" fill="#f1e9d8" />
        <circle cx="50" cy="43.6" r="5.8" fill="none" stroke="#151515" strokeWidth="4" />
        <circle cx="50" cy="56.6" r="7.1" fill="none" stroke="#151515" strokeWidth="4" />
      </g>
    </svg>
  );
}
