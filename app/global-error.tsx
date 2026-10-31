"use client";

import "./globals.css";
import OopsBall from "./OopsBall";

// Letzte Rettung, falls sogar das Grundgerüst der App nicht lädt.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="de">
      <body>
        <div className="container">
          <div className="oops" role="alert">
            <OopsBall />
            <h1>Gerade hakt&apos;s kurz</h1>
            <p>Die App konnte nicht geladen werden. Bitte gleich nochmal versuchen.</p>
            <button type="button" onClick={() => (reset(), location.reload())}>
              Nochmal laden
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
