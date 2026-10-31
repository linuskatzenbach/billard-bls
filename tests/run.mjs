// Führt alle Tests nacheinander aus: npm test
import { execFileSync } from "child_process";
import { readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const dir = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith(".test.mts")).sort();
let failed = 0;
for (const f of files) {
  try {
    const out = execFileSync("npx", ["tsx", join(dir, f)], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 });
    console.log(`${f.padEnd(18)} ${out.trim().split("\n").filter((l) => /^(OK|FEHLER|✗)/.test(l)).join("\n") || "OK"}`);
  } catch (err) {
    failed++;
    const out = `${err.stdout ?? ""}${err.stderr ?? ""}`.trim().split("\n").filter((l) => !l.startsWith("    at ")).slice(-8).join("\n");
    console.log(`${f.padEnd(18)} FEHLER\n${out}`);
  }
}
console.log(failed === 0 ? `\nAlle ${files.length} Testdateien bestanden.` : `\n${failed} von ${files.length} Testdateien fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
