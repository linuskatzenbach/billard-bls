import Link from "next/link";
import OopsBall from "./OopsBall";

export const metadata = { title: "Nicht gefunden · Billard BLS" };

// Für Links, die es (nicht mehr) gibt – z. B. ein altes Profil.
export default function NotFound() {
  return (
    <div className="oops">
      <OopsBall />
      <h1>Daneben</h1>
      <p>Diese Seite gibt es nicht (mehr). Vielleicht ein alter Link?</p>
      <Link href="/" className="oops-link">
        Zur Rangliste
      </Link>
    </div>
  );
}
