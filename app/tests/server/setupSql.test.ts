import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { buildSetupSql, setupDb, sqlString } from "@/server/setup";
import { makeEmptyDb } from "../helpers/testDb";

const migrationsDir = new URL("../../db/migrations", import.meta.url).pathname;

describe("sqlString", () => {
  test("escapa las comillas simples", () => {
    expect(sqlString("D'Amico")).toBe("'D''Amico'");
    expect(sqlString("Té y aromáticas")).toBe("'Té y aromáticas'");
  });
});

describe("buildSetupSql", () => {
  test("ejecutar el archivo SQL deja la base igual que setupDb", async () => {
    const porSql = await makeEmptyDb();
    await porSql.exec(buildSetupSql(migrationsDir));
    const porScript = await makeEmptyDb();
    await setupDb(porScript, { migrationsDir });
    for (const consulta of [
      `select * from dining_tables order by id`,
      `select * from extras order by id`,
      `select * from products order by id`,
      `select * from settings`,
      `select name from schema_migrations order by name`,
    ]) {
      expect(await porSql.query(consulta), consulta).toEqual(await porScript.query(consulta));
    }
  });

  test("después del archivo SQL, setupDb no repite migraciones ni catálogo", async () => {
    const db = await makeEmptyDb();
    await db.exec(buildSetupSql(migrationsDir));
    expect(await setupDb(db, { migrationsDir })).toEqual({ migrated: [], seeded: false });
  });

  test("falla entero y no deja nada a medias si una parte tiene un error", async () => {
    const db = await makeEmptyDb();
    await db.exec(`create table products (id text)`); // choca con la migración
    await expect(db.exec(buildSetupSql(migrationsDir))).rejects.toThrow();
    await db.exec("rollback"); // la sesión queda abortada hasta cerrar la transacción; nada se había guardado
    expect(await db.query(`select 1 from information_schema.tables where table_name = 'dining_tables'`)).toEqual([]);
  });

  test("el archivo db/setup.sql del repositorio está al día", () => {
    const guardado = readFileSync(new URL("../../db/setup.sql", import.meta.url), "utf8");
    expect(guardado).toBe(buildSetupSql(migrationsDir));
  });
});
