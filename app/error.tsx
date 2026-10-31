"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import OopsBall from "./OopsBall";

// Wird angezeigt, wenn beim Laden einer Seite etwas schiefgeht (z. B. die
// Datenbank kurz nicht antwortet). Statt einer leeren Standard-Fehlerseite
// kommt ein Hinweis im App-Design mit „Nochmal laden“.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    console.error(error);
    // Fehler an den Server melden (Admin-Mail, gedrosselt).
    fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ where: location.pathname, message: error.message, digest: error.digest }),
      keepalive: true,
    }).catch(() => {});
  }, [error]);

  const retry = () => {
    setTries((n) => n + 1);
    start(() => {
      router.refresh();
      reset();
    });
  };

  return (
    <div className="oops" role="alert">
      <OopsBall />
      <h1>Gerade hakt&apos;s kurz</h1>
      <p>Die Seite konnte nicht geladen werden. Meistens klappt es beim zweiten Versuch.</p>
      <button type="button" onClick={retry} disabled={pending}>
        {pending ? "Lädt…" : "Nochmal laden"}
      </button>
      {tries >= 2 && (
        <p className="oops-hint">
          Klappt immer noch nicht? Dann bitte kurz später nochmal probieren – der Admin bekommt automatisch Bescheid.
        </p>
      )}
    </div>
  );
}
