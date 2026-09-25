# Billard Elo

Eine winzige Website, auf der ihr Billard-Ergebnisse eintragt und die daraus
automatisch eine Elo-Rangliste berechnet (gleiches System wie im Schach).

- Rangliste ist **ohne Passwort** öffentlich einsehbar.
- Ergebnis eintragen erfordert ein **gemeinsames Passwort**.
- Spieler werden **im Code** verwaltet (Datei `lib/players.ts`) – Besucher
  der Website können keine Spieler hinzufügen oder löschen.

## Wie es funktioniert (kurz)

- **Next.js**: das Framework, das sowohl die Seiten (Rangliste, Formular)
  als auch die kleine API dahinter (`/api/results`) bereitstellt.
- **Neon Postgres**: eine kostenlose Datenbank, die Vercel dir direkt aus
  dem Dashboard heraus anlegt. Dort werden Elo-Werte und Spielverlauf
  gespeichert.
- **Vercel**: hostet die Website kostenlos (Hobby-Plan) und deployt
  automatisch neu, sobald du etwas auf GitHub pushst.

Kosten: 0 €, solange ihr im kostenlosen Rahmen von Vercel und Neon bleibt
(für eine private Freundesrunde bei Weitem ausreichend).

---

## Einmalige Einrichtung

### 1. Bei GitHub hochladen

1. Erstelle auf [github.com](https://github.com) ein neues, leeres
   Repository (z.B. `billard-elo`). **Kein** README/gitignore beim
   Erstellen mit anhaken, das bringen wir schon mit.
2. Lade diesen kompletten Ordner (alle Dateien, inkl. der "unsichtbaren"
   `.gitignore`) in das Repository hoch. Am einfachsten geht das über die
   GitHub-Weboberfläche: Repository öffnen → "Add file" → "Upload files" →
   alle Dateien/Ordner reinziehen → "Commit changes".
   (Wenn du lieber mit Git auf der Kommandozeile arbeitest, geht das
   natürlich auch mit `git init`, `git add .`, `git commit`, `git push`.)

### 2. Bei Vercel importieren

1. Gehe auf [vercel.com](https://vercel.com) und logge dich mit deinem
   GitHub-Account ein.
2. "Add New" → "Project" → das gerade hochgeladene Repository auswählen →
   "Import".
3. Die Voreinstellungen (Framework: Next.js) einfach so lassen. **Noch
   nicht** auf "Deploy" klicken, oder nach dem ersten (fehlschlagenden)
   Deploy einfach gleich weiter zu Schritt 3 gehen – ohne Datenbank und
   Passwort funktioniert die Seite nämlich noch nicht ganz.

### 3. Datenbank hinzufügen

1. Im Vercel-Projekt: Tab **Storage** → **Create Database** → **Neon**
   (Postgres) auswählen → kostenlosen Plan wählen → erstellen.
2. Vercel verbindet die Datenbank automatisch mit deinem Projekt und setzt
   die nötige Umgebungsvariable (`DATABASE_URL`) selbst. Du musst hier
   nichts weiter eintragen.

### 4. Passwort setzen

1. Im Vercel-Projekt: **Settings** → **Environment Variables**.
2. Neue Variable anlegen:
   - Name: `RESULT_PASSWORD`
   - Value: euer gemeinsames Passwort, z.B. `neunball2024`
   - Environment: alle Häkchen (Production, Preview, Development) lassen.
3. Speichern.

### 5. Deployen

1. Tab **Deployments** → beim letzten Deployment auf die drei Punkte →
   **Redeploy** (falls schon einmal fehlgeschlagen), oder beim ersten Mal
   einfach auf **Deploy** klicken.
2. Nach ca. einer Minute ist die Seite unter der von Vercel vergebenen
   `.vercel.app`-Adresse live.

Fertig! Alle vier hinterlegten Spieler starten automatisch mit Elo 1500,
sobald die Seite zum ersten Mal aufgerufen wird.

---

## Spieler hinzufügen oder umbenennen

Nur du als Entwickler kannst das, über den Code:

1. Öffne `lib/players.ts` in deinem Repository (auf GitHub direkt mit dem
   Stift-Symbol editierbar, oder lokal).
2. Füge eine neue Zeile in der `PLAYERS`-Liste hinzu, z.B.:
   ```ts
   { id: "julia", name: "Julia" },
   ```
   `id` muss eindeutig sein und sollte keine Leerzeichen/Umlaute/Sonder-
   zeichen enthalten. `name` ist der Anzeigename.
3. Speichern/committen. Vercel deployt automatisch neu. Der neue Spieler
   taucht danach mit Start-Elo 1500 in der Rangliste auf.

Zum Entfernen eines Spielers einfach die Zeile löschen – seine bisherigen
Ergebnisse bleiben in der Datenbank erhalten, er verschwindet aber aus der
Rangliste und der Auswahl im Formular.

## Passwort ändern

Settings → Environment Variables → `RESULT_PASSWORD` bearbeiten →
speichern → einmal redeployen (Deployments → Redeploy), damit die Änderung
wirksam wird.

## K-Faktor anpassen

Die "Empfindlichkeit" der Elo-Berechnung (wie stark ein einzelnes Spiel den
Wert verändert) steht in `lib/elo.ts` als `K_FACTOR` (Standard: 32). Höher
= größere Ausschläge pro Spiel, niedriger = stabilere, langsamere Werte.

## Lokal entwickeln (optional)

Nur nötig, wenn du selbst am Code herumbasteln willst, bevor du pushst:

```bash
npm install
cp .env.local.example .env.local   # dann DATABASE_URL/RESULT_PASSWORD eintragen
npm run dev
```

Für eine lokale `DATABASE_URL` kannst du entweder eine zweite (kostenlose)
Neon-Datenbank direkt auf [neon.tech](https://neon.tech) anlegen, oder mit
`vercel env pull .env.local` die Werte aus dem Vercel-Projekt lokal holen
(dafür vorher `npm install -g vercel` und `vercel link`).
