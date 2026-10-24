import { neon } from "@neondatabase/serverless";

// Datenbankzugriff. Auf Vercel läuft alles über Neon. Für Tests auf dem
// eigenen Rechner kann stattdessen eine lokale Datenbank-Datei benutzt
// werden: dafür LOCAL_PGLITE_DIR setzen (z. B. "./.localdb"). Auf Vercel ist
// diese Variable nie gesetzt, der Testteil wird dort nie geladen.

export type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Eine Abfrage wird erst ausgeführt, wenn man auf sie wartet – oder
// gesammelt in einer Transaktion (alles oder nichts).
export type Query = PromiseLike<Row[]>;

export type Sql = {
  (strings: TemplateStringsArray, ...values: unknown[]): Query;
  transaction(queries: Query[]): Promise<Row[][]>;
};

let cached: Sql | null = null;

export function getSql(): Sql {
  if (cached) return cached;

  if (process.env.LOCAL_PGLITE_DIR) {
    cached = localSql(process.env.LOCAL_PGLITE_DIR);
    return cached;
  }

  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    process.env.POSTGRES_PRISMA_URL;

  if (!connectionString) {
    throw new Error(
      "Keine Datenbank-Verbindung gefunden. Bitte in Vercel unter Storage eine Postgres-Datenbank (Neon) mit diesem Projekt verbinden."
    );
  }

  cached = neon(connectionString) as unknown as Sql;
  return cached;
}

// ---- Nur für lokale Tests ---------------------------------------------

type LazyQuery = Query & { text: string; params: unknown[] };

function localSql(dir: string): Sql {
  // Eine gemeinsame Instanz für den ganzen Prozess (Seiten und API-Routen
  // laden dieses Modul getrennt).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = globalThis as any;
  const db = () => {
    if (!g.__billardPglite) {
      const modName = "@electric-sql/pglite";
      g.__billardPglite = import(/* webpackIgnore: true */ /* turbopackIgnore: true */ modName).then(
        ({ PGlite }) => new PGlite(dir)
      );
    }
    return g.__billardPglite;
  };

  // Mehrere gleichzeitige Anfragen nacheinander abarbeiten.
  g.__billardChain ??= Promise.resolve();
  const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
    const next = g.__billardChain.then(fn, fn);
    g.__billardChain = next.catch(() => {});
    return next;
  };

  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    let text = strings[0];
    for (let i = 0; i < values.length; i++) text += `$${i + 1}` + strings[i + 1];
    const q: LazyQuery = {
      text,
      params: values,
      then(onOk, onErr) {
        return serial(async () => {
          const d = await db();
          const res = await d.query(text, values);
          return res.rows as Row[];
        }).then(onOk, onErr);
      },
    };
    return q;
  }) as unknown as Sql;

  sql.transaction = (queries: Query[]) =>
    serial(async () => {
      const d = await db();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return d.transaction(async (tx: any) => {
        const out: Row[][] = [];
        for (const q of queries as LazyQuery[]) {
          const res = await tx.query(q.text, q.params);
          out.push(res.rows as Row[]);
        }
        return out;
      });
    });

  return sql;
}
