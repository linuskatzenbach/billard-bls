import type { Metal } from "@/lib/achievements";

// Runde Medaille für Abzeichen (Bronze, Silber, Gold oder geheim).
export default function Medal({
  metal,
  icon,
  size = "3.4rem",
  locked = false,
  isNew = false,
}: {
  metal: Metal;
  icon: string;
  size?: string;
  locked?: boolean;
  isNew?: boolean;
}) {
  return (
    <span className={`medal medal-${metal}${locked ? " locked" : ""}`} style={{ width: size, height: size }} aria-hidden="true">
      <span className="medal-icon">{icon}</span>
      {isNew && <span className="medal-new">NEU</span>}
    </span>
  );
}
