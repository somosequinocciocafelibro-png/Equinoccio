import postgres from "postgres";

/** Acceso mínimo a Postgres; la misma interfaz la usan el servidor real y las pruebas (PGlite). */
export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Ejecuta uno o varios comandos SQL sin parámetros (migraciones). */
  exec(sql: string): Promise<void>;
  tx<R>(fn: (t: Db) => Promise<R>): Promise<R>;
}

let shared: Db | undefined;

/** Conexión compartida del servidor, creada la primera vez que se pide. */
export function getDb(): Db {
  if (!shared) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Falta la variable de entorno DATABASE_URL");
    shared = createDb(url);
  }
  return shared;
}

export function createDb(url: string): Db {
  const sql = postgres(url, { prepare: false, max: 5 });
  const wrap = (q: postgres.Sql | postgres.TransactionSql, inTx: boolean): Db => {
    const self: Db = {
      query: async <T>(text: string, params: unknown[] = []) =>
        (await q.unsafe(text, params as never[])) as unknown as T[],
      exec: async (text: string) => {
        await q.unsafe(text);
      },
      tx: <R>(fn: (t: Db) => Promise<R>): Promise<R> =>
        inTx ? fn(self) : (sql.begin((t) => fn(wrap(t, true))) as Promise<R>),
    };
    return self;
  };
  return wrap(sql, false);
}
