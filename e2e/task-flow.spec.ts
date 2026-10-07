import { expect, test } from "@playwright/test";
import type { AuditLog, Task } from "../src/domain";

test("task journey across dashboard, timeline, insights, board, and trash", async ({ page, request }) => {
  const title = `Browser test ${Date.now()}`;
  const dueDate = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Ringkasan task" })).toBeVisible();
  await page.getByRole("button", { name: "Sembunyikan sidebar" }).click();
  await expect(page.locator("#sidebar")).toBeHidden();
  await expect(page.locator(".main-area")).toHaveCSS("margin-left", "0px");
  await page.getByRole("button", { name: "Tampilkan sidebar" }).click();
  await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeVisible();
  await page.getByRole("button", { name: "Aktifkan tema gelap" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Aktifkan tema terang" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const tasksLink = page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link", { name: "Semua task" });
  await tasksLink.hover();
  await expect(tasksLink).not.toHaveCSS("box-shadow", "none");
  await tasksLink.click();
  await page.getByLabel("Judul task").fill(title);
  await page.getByLabel("Prioritas").selectOption("high");
  await page.getByLabel("Tenggat (opsional)").fill(dueDate);
  await page.getByRole("button", { name: /Menu pengguna/ }).click();
  await page.getByRole("group", { name: "Pilih pengguna" }).getByRole("button", { name: /john.doe/ }).click();
  await page.getByRole("button", { name: "Tambah task" }).click();

  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  await expect(page.locator(".detail-field .status")).toHaveText("To do");
  await expect(page.getByLabel("Prioritas")).toHaveValue("high");
  const id = new URL(page.url()).pathname.split("/").at(-1)!;
  const logsPath = `/api/tasks/${id}/audit-logs`;

  await page.getByLabel("Prioritas").selectOption("low");
  await page.getByRole("button", { name: "Simpan detail" }).click();
  await expect(page.getByRole("button", { name: "Simpan detail" })).toBeDisabled();
  expect(((await (await request.get(`/api/tasks/${id}`)).json()) as Task).priority).toBe("low");

  await page.getByRole("link", { name: "Timeline" }).click();
  await expect(page.getByRole("heading", { name: "Timeline" })).toBeVisible();
  await expect(page.locator(".schedule-list").getByRole("link", { name: title })).toBeVisible();
  await expect(page.locator(".schedule-overdue").filter({ hasText: title })).toBeVisible();

  await page.getByRole("link", { name: "Users" }).click();
  await page.locator(".user-row").filter({ hasText: "jane.doe" }).getByRole("button", { name: "Pilih" }).click();
  await expect(page.getByRole("button", { name: "Menu pengguna: jane.doe" })).toBeVisible();
  await page.getByRole("button", { name: "Menu pengguna: jane.doe" }).click();
  await page.getByRole("group", { name: "Pilih pengguna" }).getByRole("button", { name: /john.doe/ }).click();
  await expect(page.getByRole("button", { name: "Menu pengguna: john.doe" })).toBeVisible();

  await page.getByRole("link", { name: "Insights" }).click();
  await expect(page.getByRole("heading", { name: "Task Insights" })).toBeVisible();
  const activeTasks = (await (await request.get("/api/tasks")).json()) as Task[];
  const today = await page.evaluate(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  const overdue = activeTasks.filter((task) => task.dueDate && task.dueDate < today && task.status !== "done").length;
  await expect(page.locator(".insight-card").filter({ hasText: "Terlambat" }).locator("strong")).toHaveText(String(overdue));
  await expect(page.locator(".priority-bar-row").filter({ hasText: "Rendah" }).locator("strong"))
    .toHaveText(String(activeTasks.filter((task) => task.priority === "low").length));
  await expect(page.locator(".chart-legend")).toContainText(`To do: ${activeTasks.filter((task) => task.status === "to_do").length}`);
  await page.getByLabel("Tanggal mulai").fill("2999-01-01");
  await expect(page.locator(".insight-card").filter({ hasText: "Total task" }).locator("strong")).toHaveText("0");
  await page.getByLabel("Tanggal mulai").fill("");

  await page.getByRole("link", { name: "Ringkasan" }).click();
  await expect(page.locator(".recent-list").getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await page.locator(".recent-list").getByRole("link", { name: new RegExp(title) }).click();
  await page.getByRole("button", { name: "Lanjut ke Pending" }).click();
  await expect(page.locator(".detail-field .status")).toHaveText("Pending");

  await page.getByRole("link", { name: "Board", exact: true }).click();
  const pendingColumn = page.getByRole("region", { name: "Pending" });
  await expect(pendingColumn.getByRole("link", { name: title })).toBeVisible();
  await pendingColumn.getByRole("button", { name: "Lanjut ke In progress" }).click();
  await expect(page.getByRole("region", { name: "In progress" }).getByRole("link", { name: title })).toBeVisible();
  await page.getByRole("region", { name: "In progress" }).getByRole("link", { name: title }).click();
  await expect(page.locator(".detail-field .status")).toHaveText("In progress");
  await page.getByRole("button", { name: "Lanjut ke Done" }).click();
  await expect(page.locator(".detail-field .status")).toHaveText("Done");
  await expect(page.locator(".timeline li")).toHaveCount(3);
  await expect(page.locator(".timeline li").first()).toContainText("john.doe");

  await page.getByRole("navigation", { name: "Navigasi utama" }).getByRole("link", { name: "Semua task" }).click();
  await page.getByLabel("Cari task").fill(title);
  await page.getByLabel("Filter status").selectOption("done");
  await expect(page.locator(".task-list-row")).toHaveCount(1);
  await page.getByLabel("Filter status").selectOption("pending");
  await expect(page.locator(".task-list-row")).toHaveCount(0);
  await page.getByLabel("Filter status").selectOption("done");
  await page.locator(".task-list-row").getByRole("link", { name: title, exact: true }).click();

  const sameStatus = await request.put(`/api/tasks/${id}/status`, { data: { status: "done", actor: "john.doe" } });
  expect(sameStatus.status()).toBe(200);
  expect(((await (await request.get(logsPath)).json()) as AuditLog[]).length).toBe(3);
  const invalid = await request.put(`/api/tasks/${id}/status`, { data: { status: "pending", actor: "john.doe" } });
  expect(invalid.status()).toBe(409);

  await page.getByRole("button", { name: "Hapus task" }).click();
  await expect(page.getByRole("heading", { name: "Task terhapus" })).toBeVisible();
  await expect(page.locator(".trash-list").getByRole("link", { name: new RegExp(title) })).toBeVisible();
  const deletedTasks = (await (await request.get("/api/tasks?deleted=true")).json()) as Task[];
  expect(deletedTasks.some((task) => task.id === id)).toBe(true);
  await page.locator(".trash-list").getByRole("link", { name: new RegExp(title) }).click();
  await expect(page.getByText("Task ini sudah dihapus. Riwayat status tetap tersedia.")).toBeVisible();
  await expect(page.locator(".timeline li")).toHaveCount(3);
  await page.reload();
  await expect(page.locator(".timeline li")).toHaveCount(3);
  expect(((await (await request.get(logsPath)).json()) as AuditLog[]).length).toBe(3);

  await page.setViewportSize({ width: 820, height: 900 });
  await page.getByRole("button", { name: "Buka navigasi" }).click();
  await expect(page.getByRole("navigation", { name: "Navigasi utama" })).toBeInViewport();
  await page.locator(".sidebar-close").click();
  await page.setViewportSize({ width: 390, height: 800 });
  await page.getByRole("button", { name: "Buka navigasi" }).click();
  await page.getByRole("link", { name: "Board", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Board status" })).toBeVisible();
});
