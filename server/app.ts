import express from "express";
import { randomUUID } from "node:crypto";
import { actors, priorities, statuses, type AuditLog, type Priority, type Status, type Task } from "../src/domain";
import { getSupabase } from "./supabase";

const app = express();
app.use(express.json());

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validId = (id: string) => uuidPattern.test(id);
const isStatus = (value: unknown): value is Status =>
  typeof value === "string" && statuses.includes(value as Status);
const isPriority = (value: unknown): value is Priority =>
  typeof value === "string" && priorities.includes(value as Priority);
const isDueDate = (value: unknown): value is string | null => {
  if (value === null) return true;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
};

type TaskRow = {
  id: string;
  title: string;
  status: Status;
  priority: Priority;
  due_date: string | null;
  created_at: string;
  deleted_at: string | null;
};
type LogRow = {
  id: number;
  task_id: string;
  actor: string;
  from_status: Status;
  to_status: Status;
  changed_at: string;
};

const taskFromRow = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  status: row.status,
  priority: row.priority,
  dueDate: row.due_date,
  createdAt: row.created_at,
  deletedAt: row.deleted_at,
});
const logFromRow = (row: LogRow): AuditLog => ({
  id: row.id,
  taskId: row.task_id,
  actor: row.actor,
  fromStatus: row.from_status,
  toStatus: row.to_status,
  changedAt: row.changed_at,
});

app.get("/api/tasks", async (req, res) => {
  const query = getSupabase().from("tasks").select("*");
  const filtered = req.query.deleted === "true"
    ? query.not("deleted_at", "is", null)
    : query.is("deleted_at", null);
  const { data, error } = await filtered.order("created_at", { ascending: false });
  if (error) throw error;
  res.json((data as TaskRow[]).map(taskFromRow));
});

app.get("/api/tasks/:id", async (req, res) => {
  const id = req.params.id;
  if (!validId(id)) return res.status(404).json({ error: "Task tidak ditemukan" });
  const { data, error } = await getSupabase()
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return res.status(404).json({ error: "Task tidak ditemukan" });
  res.json(taskFromRow(data as TaskRow));
});

app.post("/api/tasks", async (req, res) => {
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  if (!title) return res.status(400).json({ error: "Judul task wajib diisi" });
  const priority = req.body?.priority ?? "medium";
  const dueDate = req.body?.dueDate ?? null;
  if (!isPriority(priority)) return res.status(400).json({ error: "Prioritas tidak valid" });
  if (!isDueDate(dueDate)) return res.status(400).json({ error: "Tanggal tenggat tidak valid" });

  const { data, error } = await getSupabase()
    .from("tasks")
    .insert({ id: randomUUID(), title, priority, due_date: dueDate })
    .select("*")
    .single();
  if (error) throw error;
  res.status(201).json(taskFromRow(data as TaskRow));
});

app.patch("/api/tasks/:id", async (req, res) => {
  const id = req.params.id;
  if (!validId(id)) return res.status(404).json({ error: "Task tidak ditemukan" });
  const body = req.body ?? {};
  const changes: { priority?: Priority; due_date?: string | null } = {};
  if (Object.hasOwn(body, "priority")) {
    if (!isPriority(body.priority)) return res.status(400).json({ error: "Prioritas tidak valid" });
    changes.priority = body.priority;
  }
  if (Object.hasOwn(body, "dueDate")) {
    if (!isDueDate(body.dueDate)) return res.status(400).json({ error: "Tanggal tenggat tidak valid" });
    changes.due_date = body.dueDate;
  }
  if (!Object.keys(changes).length) return res.status(400).json({ error: "Tidak ada perubahan task" });
  const client = getSupabase();
  const { data, error } = await client.from("tasks").update(changes).eq("id", id)
    .is("deleted_at", null).select("*").maybeSingle();
  if (error) throw error;
  if (data) return res.json(taskFromRow(data as TaskRow));
  const existing = await client.from("tasks").select("id").eq("id", id).maybeSingle();
  if (existing.error) throw existing.error;
  return res.status(existing.data ? 409 : 404).json({
    error: existing.data ? "Task sudah dihapus" : "Task tidak ditemukan",
  });
});

app.put("/api/tasks/:id/status", async (req, res) => {
  const id = req.params.id;
  if (!validId(id)) return res.status(404).json({ error: "Task tidak ditemukan" });
  if (!isStatus(req.body?.status)) {
    return res.status(400).json({ error: "Status tidak valid" });
  }
  if (!actors.includes(req.body?.actor)) {
    return res.status(400).json({ error: "Actor tidak valid" });
  }

  const { data, error } = await getSupabase().rpc("change_task_status", {
    p_task_id: id,
    p_status: req.body.status,
    p_actor: req.body.actor,
  });
  if (error) {
    if (error.code === "P0002") return res.status(404).json({ error: error.message });
    if (error.code === "P0001") return res.status(409).json({ error: error.message });
    throw error;
  }
  res.json(taskFromRow(data as TaskRow));
});

app.delete("/api/tasks/:id", async (req, res) => {
  const id = req.params.id;
  if (!validId(id)) return res.status(404).json({ error: "Task tidak ditemukan" });
  const client = getSupabase();
  const { data, error } = await client
    .from("tasks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (data) return res.status(204).end();
  const existing = await client.from("tasks").select("id").eq("id", id).maybeSingle();
  if (existing.error) throw existing.error;
  return res.status(existing.data ? 409 : 404).json({
    error: existing.data ? "Task sudah dihapus" : "Task tidak ditemukan",
  });
});

app.get("/api/tasks/:id/audit-logs", async (req, res) => {
  const id = req.params.id;
  if (!validId(id)) return res.status(404).json({ error: "Task tidak ditemukan" });
  const client = getSupabase();
  const existing = await client.from("tasks").select("id").eq("id", id).maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data) return res.status(404).json({ error: "Task tidak ditemukan" });

  const { data, error } = await client
    .from("audit_logs")
    .select("*")
    .eq("task_id", id)
    .order("changed_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;
  res.json((data as LogRow[]).map(logFromRow));
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Terjadi kesalahan pada server" });
});

export default app;
