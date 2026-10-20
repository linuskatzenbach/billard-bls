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
  const find = (picker: string) =>
    form.querySelector<HTMLElement>(`[data-picker="${picker}"] .picker-option.selected .ball`);
  const wEl = find("winner");
  const lEl = find("loser");
  const wi = PLAYERS.findIndex((p) => p.id === winnerId);
  const li = PLAYERS.findIndex((p) => p.id === loserId);
  if (!wEl || !lEl || wi < 0 || li < 0) return null;

  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const wPicker = form.querySelector<HTMLElement>('[data-picker="winner"]');
  const lPicker = form.querySelector<HTMLElement>('[data-picker="loser"]');

  // Am schönsten: Der Tisch deckt beide Auswahlfelder ganz ab, dann
  // verschwinden alle anderen Kugeln darunter. Passt das nicht auf den
  // Bildschirm, wird der Tisch nur um die beiden Kugeln gelegt.
  const spanOf = (els: HTMLElement[]) => {
    const rs = els.map((el) => el.getBoundingClientRect());
    return { top: Math.min(...rs.map((r) => r.top)), bottom: Math.max(...rs.map((r) => r.bottom)) };
  };
  const pad = 12;
  let cover = false;
  let margin = 90;
  let targets: HTMLElement[] = [wEl, lEl];
  if (wPicker && lPicker) {
    const s = spanOf([wPicker, lPicker]);
    if (s.bottom - s.top + 2 * (pad + 8) <= vh) {
      cover = true;
      margin = pad + 8;
      targets = [wPicker, lPicker];
    }
  }
  const { top, bottom } = spanOf(targets);
  let shift = 0;
  if (bottom - top + 2 * margin <= vh) {
    if (top < margin) shift = top - margin;
    else if (bottom > vh - margin) shift = bottom - (vh - margin);
  } else {
    shift = (top + bottom) / 2 - vh / 2;
  }
  if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: "instant" as ScrollBehavior });

  const wr = wEl.getBoundingClientRect();
  const lr = lEl.getBoundingClientRect();
  const fr = form.getBoundingClientRect();
  const R = wr.width / 2;
  const wc = { x: wr.left + R, y: wr.top + R };
  const lc = { x: lr.left + R, y: lr.top + R };
  const left = Math.max(6, fr.left - pad);
  const right = Math.min(vw - 6, fr.right + pad);
  let tTop: number;
  let tBottom: number;
  if (cover) {
    const s = spanOf(targets);
    tTop = Math.max(6, s.top - pad);
    tBottom = Math.min(vh - 6, s.bottom + pad);
  } else {
    tTop = Math.max(6, Math.min(wc.y, lc.y) - R - 70);
    tBottom = Math.min(vh - 6, Math.max(wc.y, lc.y) + R + 70);
  }

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

// Spieler-Auswahl als antippbare Kugeln. Jeder Spieler hat eine feste
// Kugelfarbe (nach Reihenfolge in lib/players.ts) mit seinem Anfangsbuchstaben.
function PlayerPicker({
  picker,
  legend,
  value,
  onChange,
  blockedId,
}: {
  picker: "winner" | "loser";
  legend: string;
  value: string;
  onChange: (id: string) => void;
  blockedId: string;
}) {
  return (
    <fieldset className="picker" data-picker={picker}>
      <legend>{legend}</legend>
      <div className="picker-grid">
        {PLAYERS.map((p, i) => {
          const selected = value === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`picker-option${selected ? " selected" : ""}`}
              aria-pressed={selected}
              disabled={p.id === blockedId}
              onClick={() => onChange(selected ? "" : p.id)}
            >
              <Ball label={p.name.charAt(0).toUpperCase()} {...poolBall(i + 1)} />
              <span className="picker-name">{p.name}</span>
            </button>
          );
        })}
      </div>
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
      setStatus({ type: "error", message: "Bitte Gewinner und Verlierer auswählen." });
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
        onDone: (r) => {
          setAnim(null);
          finish(r);
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
        <PlayerPicker
          picker="winner"
          legend="Gewinner"
          value={winnerId}
          onChange={setWinnerId}
          blockedId={loserId}
        />

        <PlayerPicker
          picker="loser"
          legend="Verlierer"
          value={loserId}
          onChange={setLoserId}
          blockedId={winnerId}
        />

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
