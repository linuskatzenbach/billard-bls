// Sicherung: enthält alle Spiele; die automatische Mail geht höchstens
// einmal in 6 Tagen raus.
import { mkdtempSync, readFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
const dir = mkdtempSync(join(tmpdir(), "billard-backup-"));
process.env.LOCAL_PGLITE_DIR = dir;
process.env.LOCAL_MAIL_LOG = join(dir, "mails.jsonl");
delete process.env.CRON_SECRET;

const { recordMatch } = await import("../lib/db.ts");
const { buildBackup } = await import("../lib/backup.ts");
const { GET } = await import("../app/api/cron/backup/route.ts");

await recordMatch({ winnerIds: ["linus"], loserIds: ["julian"], enteredBy: "linus" });
await recordMatch({ winnerIds: ["jannik", "tobias"], loserIds: ["linus", "philip"], enteredBy: "jannik" });

const { json, filename } = await buildBackup();
const data = JSON.parse(json);
const req = () => new Request("http://localhost/api/cron/backup") as any;
const first = await (await GET(req())).json();
const second = await (await GET(req())).json();
const mails = readFileSync(process.env.LOCAL_MAIL_LOG!, "utf8").trim().split("\n");

const ok =
  data.matches.length === 2 && data.players.length >= 6 && /^billard-bls-sicherung-\d{4}-\d{2}-\d{2}\.json$/.test(filename) &&
  first.success === true && second.skipped === true && mails.length === 1;
console.log(ok ? "OK – Sicherung vollständig, Mail nur einmal" : `FEHLER ${JSON.stringify({ first, second, mails: mails.length, m: data.matches.length })}`);
process.exit(ok ? 0 : 1);
