import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";
import type { Request, Response } from "express";
import vercelHandler from "../api/index";
import app from "./app";
import { getSupabase } from "./supabase";
import type { AuditLog, Task } from "../src/domain";

test("status transitions, audit immutability, idempotency, and soft delete", async (t) => {
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => new Promise<void>((resolve) =>
    server.listening ? server.close(() => resolve()) : resolve(),
  ));
  const address = server.address();
  assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const functionServer = createServer((req, res) =>
    vercelHandler(req as Request, res as Response),
  );
  functionServer.listen(0);
  await once(functionServer, "listening");
  t.after(() => new Promise<void>((resolve) => functionServer.close(() => resolve())));
  const functionAddress = functionServer.address();
  assert(functionAddress && typeof functionAddress !== "string");
  const functionResponse = await fetch(`http://127.0.0.1:${functionAddress.port}/api/index?taskPath=tasks`);
  assert.equal(functionResponse.status, 200);

  async function request<T>(path: string, method = "GET", body?: object) {
    const response = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = response.status === 204 ? undefined : await response.json();
    return { status: response.status, data: data as T };
  }

  assert.equal((await request("/api/tasks", "POST", { title: "  " })).status, 400);
  assert.equal((await request("/api/tasks", "POST", { title: "Bad priority", priority: "urgent" })).status, 400);
  assert.equal((await request("/api/tasks", "POST", { title: "Bad date", dueDate: "2026-02-30" })).status, 400);
  const created = await request<Task>("/api/tasks", "POST", {
    title: `API test ${Date.now()}`,
    priority: "high",
    dueDate: "2026-10-01",
  });
  assert.equal(created.status, 201);
  assert.equal(created.data.status, "to_do");
  assert.equal(created.data.priority, "high");
  assert.equal(created.data.dueDate, "2026-10-01");
  const id = created.data.id;
  const statusPath = `/api/tasks/${id}/status`;
  const logsPath = `/api/tasks/${id}/audit-logs`;
  const rewrittenLogs = await fetch(
    `http://127.0.0.1:${functionAddress.port}/api/index?taskPath=tasks/${id}/audit-logs`,
  );
  assert.equal(rewrittenLogs.status, 200);

  assert.equal((await request(`/api/tasks/${id}`, "PATCH", { priority: "urgent" })).status, 400);
  assert.equal((await request(`/api/tasks/${id}`, "PATCH", { dueDate: "2026-02-30" })).status, 400);
  const rewrittenEdit = await fetch(`http://127.0.0.1:${functionAddress.port}/api/index?taskPath=tasks/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priority: "low", dueDate: null }),
  });
  assert.equal(rewrittenEdit.status, 200);
  const edited = await rewrittenEdit.json() as Task;
  assert.equal(edited.priority, "low");
  assert.equal(edited.dueDate, null);
  assert.deepEqual((await request<AuditLog[]>(logsPath)).data, []);

  assert.equal((await request(statusPath, "PUT", { status: "pending", actor: "stranger" })).status, 400);
  assert.equal((await request(statusPath, "PUT", { status: "unknown", actor: "john.doe" })).status, 400);

  assert.equal((await request(statusPath, "PUT", { status: "done", actor: "john.doe" })).status, 409);
  assert.deepEqual((await request<AuditLog[]>(logsPath)).data, []);

  assert.equal((await request(statusPath, "PUT", { status: "pending", actor: "john.doe" })).status, 200);
  assert.equal((await request(statusPath, "PUT", { status: "pending", actor: "john.doe" })).status, 200);
  assert.equal((await request<AuditLog[]>(logsPath)).data.length, 1);

  const concurrent = await Promise.all([
    request(statusPath, "PUT", { status: "in_progress", actor: "jane.doe" }),
    request(statusPath, "PUT", { status: "in_progress", actor: "jane.doe" }),
  ]);
  assert.deepEqual(concurrent.map((result) => result.status), [200, 200]);
  const logs = (await request<AuditLog[]>(logsPath)).data;
  assert.deepEqual(logs.map((log) => [log.fromStatus, log.toStatus]), [
    ["to_do", "pending"],
    ["pending", "in_progress"],
  ]);

  const tamper = await getSupabase().from("audit_logs").update({ actor: "tampered" }).eq("id", logs[0].id);
  assert(tamper.error, "the database must reject audit log updates");
  const removeLog = await getSupabase().from("audit_logs").delete().eq("id", logs[0].id);
  assert(removeLog.error, "the database must reject audit log deletes");
  assert.equal((await request<AuditLog[]>(logsPath)).data[0].actor, "john.doe");

  assert.equal((await request(`/api/tasks/${id}`, "DELETE")).status, 204);
  assert.equal((await request(`/api/tasks/${id}`, "PATCH", { priority: "high" })).status, 409);
  assert.equal((await request(statusPath, "PUT", { status: "done", actor: "john.doe" })).status, 409);
  assert.equal((await request<AuditLog[]>(logsPath)).data.length, 2);
  assert(!(await request<Task[]>("/api/tasks")).data.some((task) => task.id === id));
  assert((await request<Task[]>("/api/tasks?deleted=true")).data.some((task) => task.id === id));
  const rewrittenDeleted = await fetch(`http://127.0.0.1:${functionAddress.port}/api/index?taskPath=tasks&deleted=true`);
  assert((await rewrittenDeleted.json() as Task[]).some((task) => task.id === id));
  assert((await request<Task>(`/api/tasks/${id}`)).data.deletedAt);

  await new Promise<void>((resolve) => server.close(() => resolve()));
  const restarted = app.listen(0);
  await once(restarted, "listening");
  t.after(() => new Promise<void>((resolve) => restarted.close(() => resolve())));
  const restartedAddress = restarted.address();
  assert(restartedAddress && typeof restartedAddress !== "string");
  const persisted = await fetch(`http://127.0.0.1:${restartedAddress.port}${logsPath}`);
  assert.equal((await persisted.json() as AuditLog[]).length, 2);
});
