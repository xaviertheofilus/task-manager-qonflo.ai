import { readFile } from "node:fs/promises";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL belum diatur; jalankan supabase/schema.sql di SQL Editor Supabase.");
  process.exit(1);
}

const url = new URL(connectionString);
// Supabase memberi sslmode=require; samakan dengan perilaku libpq untuk koneksi terenkripsi.
url.searchParams.set("uselibpqcompat", "true");
const client = new pg.Client({ connectionString: url.toString(), connectionTimeoutMillis: 10_000 });
try {
  await client.connect();
  const existing = await client.query(
    "select table_name from information_schema.tables where table_schema = $1 and table_name = any($2::text[])",
    ["public", ["tasks", "audit_logs"]],
  );
  if (process.argv.includes("--check")) {
    console.log(`Tabel terkait: ${existing.rows.map((row) => row.table_name).join(", ") || "belum ada"}`);
  } else {
    await client.query("begin");
    await client.query(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
    await client.query("commit");
    console.log("Skema Supabase siap.");
  }
} catch (error) {
  await client.query("rollback").catch(() => {});
  console.error(error instanceof Error ? error.message : "Gagal menyiapkan database");
  process.exitCode = 1;
} finally {
  await client.end().catch(() => {});
}
