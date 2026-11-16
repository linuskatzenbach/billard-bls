// Kleiner Pokal für Turnierspiele in „Letzte Spiele“ (statt des 2v2-Kürzels).
export default function TourneyChip() {
  return (
    <span className="chip-2v2 chip-cup" title="Turnierspiel" aria-label="Turnierspiel">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
        <path d="M8 6H5v1.5A3 3 0 0 0 8 10.5M16 6h3v1.5a3 3 0 0 1-3 3" />
        <path d="M12 13v3.5M8.5 20h7M9.5 20l.8-3.5h3.4l.8 3.5" />
      </svg>
    </span>
  );
}
