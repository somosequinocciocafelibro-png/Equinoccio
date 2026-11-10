import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { setupDb } from "@/server/setup";
import { makeEmptyDb } from "../helpers/testDb";

const migrationsDir = new URL("../../db/migrations", import.meta.url).pathname;

describe("setupDb", () => {
  test("sobre una base vacía aplica la migración y carga el catálogo", async () => {
    const db = await makeEmptyDb();
    const r = await setupDb(db, { migrationsDir });
    expect(r).toEqual({ migrated: ["001_init.sql"], seeded: true });
    expect(await db.query(`select count(*)::int as n from products`)).toEqual([{ n: 43 }]);
    expect(await db.query(`select count(*)::int as n from dining_tables`)).toEqual([{ n: 13 }]);
  });

  test("ejecutarlo otra vez no repite la migración ni duplica el catálogo", async () => {
    const db = await makeEmptyDb();
    await setupDb(db, { migrationsDir });
    const r = await setupDb(db, { migrationsDir });
    expect(r).toEqual({ migrated: [], seeded: false });
    expect(await db.query(`select count(*)::int as n from products`)).toEqual([{ n: 43 }]);
  });

  test("no vuelve a cargar el catálogo si el dueño ya tiene productos propios", async () => {
    const db = await makeEmptyDb();
    await setupDb(db, { migrationsDir, seed: false });
    await db.query(`insert into products (id, name, category, price) values ('p', 'Propio', 'Otros', 1000)`);
    const r = await setupDb(db, { migrationsDir });
    expect(r.seeded).toBe(false);
    expect(await db.query(`select count(*)::int as n from products`)).toEqual([{ n: 1 }]);
  });

  test("aplica solo las migraciones nuevas, en orden", async () => {
    const dir = mkdtempSync(join(tmpdir(), "eq-mig-"));
    writeFileSync(join(dir, "001_a.sql"), "create table a (id int);");
    const db = await makeEmptyDb();
    expect((await setupDb(db, { migrationsDir: dir, seed: false })).migrated).toEqual(["001_a.sql"]);
    writeFileSync(join(dir, "002_b.sql"), "create table b (id int);");
    expect((await setupDb(db, { migrationsDir: dir, seed: false })).migrated).toEqual(["002_b.sql"]);
  });

  test("una migración que falla no queda registrada y no deja la base a medias", async () => {
    const dir = mkdtempSync(join(tmpdir(), "eq-mig-"));
    writeFileSync(join(dir, "001_mala.sql"), "create table t (id int); select * from no_existe;");
    const db = await makeEmptyDb();
    await expect(setupDb(db, { migrationsDir: dir, seed: false })).rejects.toThrow();
    expect(await db.query(`select 1 from information_schema.tables where table_name = 't'`)).toEqual([]);
    expect(await db.query(`select name from schema_migrations`)).toEqual([]);
  });
});
