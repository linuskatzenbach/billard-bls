"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { PLAYERS } from "@/lib/players";
import { Ball, poolBall } from "../RankBall";
import type { VictoryProps, VictoryResult } from "../VictoryAnimation";

// Die Sieges-Animation wird erst geladen, wenn sie gebraucht wird.
const loadVictory = () => import("../VictoryAnimation");
const VictoryAnimation = dynamic(loadVictory, { ssr: false });

type AnimSetup = Omit<VictoryProps, "result" | "onDone" | "onError">;

// Misst die beiden gewählten Kugeln und den Tisch, der sich darunter
// einblendet. Liegen die Kugeln nicht beide im sichtbaren Bereich, wird
// vorher passend gescrollt.
function measureAnimation(form: HTMLFormElement, winnerId: string, loserId: string): AnimSetup | null {
  const grid = form.querySelector<HTMLElement>(".picker-grid");
  const find = (role: string) => form.querySelector<HTMLElement>(`.picker-option.${role} .ball`);
  const wEl = find("is-winner");
  const lEl = find("is-loser");
  const wi = PLAYERS.findIndex((p) => p.id === winnerId);
  const li = PLAYERS.findIndex((p) => p.id === loserId);
  if (!grid || !wEl || !lEl || wi < 0 || li < 0) return null;

  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const padX = 12;
  const padY = 34;

  // Der Tisch deckt das ganze Auswahlfeld ab, damit alle anderen Kugeln
  // darunter verschwinden. Liegt es nicht ganz im Bild, wird vorher gescrollt.
  const g0 = grid.getBoundingClientRect();
  const margin = padY + 8;
  let shift = 0;
  if (g0.height + 2 * margin <= vh) {
    if (g0.top < margin) shift = g0.top - margin;
    else if (g0.bottom > vh - margin) shift = g0.bottom - (vh - margin);
  } else {
    shift = (g0.top + g0.bottom) / 2 - vh / 2;
  }
  if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: "instant" as ScrollBehavior });

  const g = grid.getBoundingClientRect();
  const wr = wEl.getBoundingClientRect();
  const lr = lEl.getBoundingClientRect();
  const R = wr.width / 2;
  const wc = { x: wr.left + R, y: wr.top + R };
  const lc = { x: lr.left + R, y: lr.top + R };
  const left = Math.max(6, g.left - padX);
  const right = Math.min(vw - 6, g.right + padX);
  const tTop = Math.max(6, Math.min(g.top - padY, Math.min(wc.y, lc.y) - R - 40));
  const tBottom = Math.min(vh - 6, Math.max(g.bottom + padY, Math.max(wc.y, lc.y) + R + 40));

  const ball = (p: (typeof PLAYERS)[number], i: number, c: { x: number; y: number }) => ({
    name: p.name,
    label: p.name.charAt(0).toUpperCase(),
    ...poolBall(i + 1),
    ...c,
  });
  return {
    winner: ball(PLAYERS[wi], wi, wc),
    loser: ball(PLAYERS[li], li, lc),
    radius: R,
    table: { left, top: tTop, width: right - left, height: tBottom - tTop },
  };
}

// Spieler-Auswahl als antippbare Kugeln: erst den Gewinner antippen,
// dann den Verlierer. Jeder Spieler hat eine feste Kugelfarbe (nach
// Reihenfolge in lib/players.ts) mit seinem Anfangsbuchstaben.
function PlayerPicker({
  winnerId,
  loserId,
  onPick,
}: {
  winnerId: string;
  loserId: string;
  onPick: (id: string) => void;
}) {
  const winner = PLAYERS.find((p) => p.id === winnerId);
  const loser = PLAYERS.find((p) => p.id === loserId);
  const hint = !winner
    ? "Tippe den Gewinner an"
    : !loser
      ? `${winner.name} gewinnt – jetzt den Verlierer antippen`
      : `${winner.name} schlägt ${loser.name}`;
  return (
    <fieldset className="picker">
      <legend className="sr-only">Gewinner und Verlierer</legend>
      <div className="picker-grid">
        {PLAYERS.map((p, i) => {
          const role = p.id === winnerId ? "is-winner" : p.id === loserId ? "is-loser" : "";
          const dim = winner && loser && !role;
          return (
            <button
              key={p.id}
              type="button"
              className={`picker-option${role ? ` selected ${role}` : ""}${dim ? " dim" : ""}`}
              aria-label={`${p.name}${role === "is-winner" ? " (Gewinner)" : role === "is-loser" ? " (Verlierer)" : ""}`}
              onClick={() => onPick(p.id)}
            >
              {role && (
                <span className="picker-badge">{role === "is-winner" ? "Sieger" : "Verlierer"}</span>
              )}
              <Ball label={p.name.charAt(0).toUpperCase()} {...poolBall(i + 1)} />
              <span className="picker-name">{p.name}</span>
            </button>
          );
        })}
      </div>
      <p className="picker-hint" aria-live="polite">{hint}</p>
    </fieldset>
  );
}

export default function EintragenPage() {
  const router = useRouter();
  const [winnerId, setWinnerId] = useState("");
  const [loserId, setLoserId] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<
    { type: "idle" } | { type: "loading" } | { type: "error"; message: string } | { type: "success"; message: string }
  >({ type: "idle" });
  const formRef = useRef<HTMLFormElement>(null);

  // Erster Tipp: Gewinner, zweiter: Verlierer. Gewählte Kugel nochmal
  // antippen hebt die Wahl auf; ein dritter Tipp beginnt neu.
  function pick(id: string) {
    if (status.type === "error") setStatus({ type: "idle" });
    if (id === winnerId) { setWinnerId(loserId); setLoserId(""); return; }
    if (id === loserId) { setLoserId(""); return; }
    if (!winnerId) { setWinnerId(id); return; }
    if (!loserId) { setLoserId(id); return; }
    setWinnerId(id);
    setLoserId("");
  }
  const [anim, setAnim] = useState<VictoryProps | null>(null);

  // Animation vorladen, sobald beide Spieler gewählt sind.
  useEffect(() => {
    if (winnerId && loserId) void loadVictory();
  }, [winnerId, loserId]);

  function finish(r: VictoryResult) {
    setStatus({
      type: "success",
      message: `Ergebnis gespeichert! (+${r.winnerDelta} / −${Math.abs(r.loserDelta)} Elo)`,
    });
    setPassword("");
    setWinnerId("");
    setLoserId("");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!winnerId || !loserId) {
      setStatus({ type: "error", message: "Bitte erst den Gewinner, dann den Verlierer antippen." });
      return;
    }

    if (winnerId === loserId) {
      setStatus({ type: "error", message: "Gewinner und Verlierer müssen unterschiedlich sein." });
      return;
    }

    setStatus({ type: "loading" });

    const result: Promise<VictoryResult> = (async () => {
      let res: Response;
      try {
        res = await fetch("/api/results", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ winnerId, loserId, password }),
        });
      } catch {
        throw new Error("Verbindung fehlgeschlagen. Bitte erneut versuchen.");
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Etwas ist schiefgelaufen.");
      return { winnerDelta: data.winnerDelta ?? 0, loserDelta: data.loserDelta ?? 0 };
    })();
    // Fehler werden unten bzw. in der Animation behandelt.
    result.catch(() => {});

    const setup = formRef.current ? measureAnimation(formRef.current, winnerId, loserId) : null;
    if (setup) {
      setAnim({
        ...setup,
        result,
        onDone: () => {
          // Zurück zur Rangliste, die dann schon die neuen Elo-Zahlen zeigt.
          router.push("/");
          router.refresh();
        },
        onError: (message) => {
          setAnim(null);
          setStatus({ type: "error", message });
        },
      });
      return;
    }

    try {
      finish(await result);
    } catch (err) {
      setStatus({ type: "error", message: err instanceof Error ? err.message : "Etwas ist schiefgelaufen." });
    }
  }

  return (
    <>
      <h1>Ergebnis eintragen</h1>
      <p className="subtitle">Wer hat gegen wen gewonnen?</p>

      <form ref={formRef} onSubmit={handleSubmit}>
        <PlayerPicker winnerId={winnerId} loserId={loserId} onPick={pick} />

        <label>
          Passwort
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button type="submit" disabled={status.type === "loading"}>
          {status.type === "loading" ? "Speichert…" : "Ergebnis speichern"}
        </button>

        {status.type === "error" && <p className="message error">{status.message}</p>}
        {status.type === "success" && <p className="message success">{status.message}</p>}
      </form>

      {anim && <VictoryAnimation {...anim} />}

      <Link href="/" className="nav-link">
        ← Zurück zur Rangliste
      </Link>
    </>
  );
}
