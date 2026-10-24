"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Dezenter Widerspruch: löscht ein Spiel (nur innerhalb von 24 h).
export default function DisputeButton({ matchId, own }: { matchId: number; own: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "confirm" | "busy" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  if (state === "done") return <span className="dispute-done">gelöscht</span>;

  if (state === "confirm" || state === "busy") {
    return (
      <span className="dispute-confirm">
        Spiel wirklich löschen?{" "}
        <button
          type="button"
          className="linkish danger"
          disabled={state === "busy"}
          onClick={async () => {
            setState("busy");
            const res = await fetch("/api/matches/dispute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ matchId }),
            }).catch(() => null);
            const data = res ? await res.json().catch(() => ({})) : {};
            if (!res || !res.ok) {
              setMsg(data.error ?? "Hat nicht geklappt.");
              setState("error");
              return;
            }
            setState("done");
            router.refresh();
          }}
        >
          {state === "busy" ? "…" : "Ja, löschen"}
        </button>{" "}
        <button type="button" className="linkish" onClick={() => setState("idle")}>
          Nein
        </button>
      </span>
    );
  }

  return (
    <span className="dispute">
      <button type="button" className="linkish" onClick={() => setState("confirm")}>
        {own ? "Fehler? Löschen" : "Stimmt nicht?"}
      </button>
      {state === "error" && <span className="dispute-err"> {msg}</span>}
    </span>
  );
}
