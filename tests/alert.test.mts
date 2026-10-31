// Fehlermeldungen: protokolliert, aber höchstens eine Mail pro halbe Stunde.
import { mkdtempSync, readFileSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
const dir = mkdtempSync(join(tmpdir(), "billard-alert-"));
process.env.LOCAL_PGLITE_DIR = dir;
process.env.LOCAL_MAIL_LOG = join(dir, "mails.jsonl");

const { reportError } = await import("../lib/alert.ts");
const { countErrors } = await import("../lib/db.ts");
const orig = console.error; console.error = () => {};
for (let i = 0; i < 5; i++) await reportError("Test", new Error(`Fehler ${i}`));
console.error = orig;

const mails = existsSync(process.env.LOCAL_MAIL_LOG!) ? readFileSync(process.env.LOCAL_MAIL_LOG!, "utf8").trim().split("\n") : [];
const n = await countErrors(7);
const ok = n === 5 && mails.length === 1 && JSON.parse(mails[0]).text.includes("Fehler 0");
console.log(ok ? "OK – 5 Fehler protokolliert, 1 Mail" : `FEHLER – ${n} protokolliert, ${mails.length} Mails`);
process.exit(ok ? 0 : 1);
