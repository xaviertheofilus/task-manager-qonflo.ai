import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LuCircleAlert as AlertCircle, LuArrowLeft as ArrowLeft, LuArrowRight as ArrowRight, LuChartNoAxesColumn as BarChart3, LuCalendarDays as CalendarDays, LuCircleCheck as CheckCircle2, LuChevronRight as ChevronRight, LuClock3 as Clock3, LuColumns3 as Columns3, LuHistory as History, LuListChecks as ListChecks, LuListTodo as ListTodo, LuPlus as Plus, LuSearch as Search, LuTrash2 as Trash2, LuUsersRound as UsersRound } from "react-icons/lu";
import { Link, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { api } from "./api";
import { actors, nextStatus, priorities, priorityLabels, statusLabels, statuses, type AuditLog, type Priority, type Status, type Task } from "./domain";
import type { PageContext } from "./App";

const formatTime = (value: string) => new Date(value).toLocaleString("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
});
const formatDate = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", { dateStyle: "medium" });
const localDate = (value: string | Date) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const isOverdue = (task: Task) => Boolean(task.dueDate && task.dueDate < localDate(new Date()) && task.status !== "done");
const taskStats = (tasks: Task[]) => ({
  total: tasks.length,
  to_do: tasks.filter((task) => task.status === "to_do").length,
  pending: tasks.filter((task) => task.status === "pending").length,
  in_progress: tasks.filter((task) => task.status === "in_progress").length,
  done: tasks.filter((task) => task.status === "done").length,
  overdue: tasks.filter(isOverdue).length,
});

function useTasks(deleted = false) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    setTasks(await api<Task[]>(`/api/tasks${deleted ? "?deleted=true" : ""}`));
  }, [deleted]);
  useEffect(() => {
    refresh().catch((cause) => setError((cause as Error).message)).finally(() => setLoading(false));
  }, [refresh]);
  return { tasks, loading, error, refresh };
}

function PageHeading({ eyebrow, title, description, actions }: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return <header className="page-heading">
    <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>
    {actions && <div className="page-actions">{actions}</div>}
  </header>;
}

function StatusBadge({ status }: { status: Status }) {
  return <span className={`status status-${status}`}>{statusLabels[status]}</span>;
}

function ErrorNotice({ message }: { message: string }) {
  return message ? <p className="error" role="alert">{message}</p> : null;
}

function Empty({ message }: { message: string }) {
  return <div className="empty"><ListTodo aria-hidden="true" /><p>{message}</p></div>;
}

export function DashboardPage() {
  const { tasks, loading, error } = useTasks();
  const stats = taskStats(tasks);
  const cards = [
    { label: "Total task", value: stats.total, icon: ListChecks, tone: "blue" },
    { label: "To do", value: stats.to_do, icon: ListTodo, tone: "slate" },
    { label: "Pending", value: stats.pending, icon: Clock3, tone: "amber" },
    { label: "In progress", value: stats.in_progress, icon: Clock3, tone: "blue" },
    { label: "Selesai", value: stats.done, icon: CheckCircle2, tone: "green" },
    { label: "Terlambat", value: stats.overdue, icon: AlertCircle, tone: "red" },
  ];
  return <>
    <PageHeading eyebrow="WORKSPACE / RINGKASAN" title="Ringkasan task" description="Pantau pekerjaan tim dan buka task yang perlu ditindaklanjuti."
      actions={<Link className="button button-primary" to="/tasks"><Plus aria-hidden="true" /> Task baru</Link>} />
    <ErrorNotice message={error} />
    <section className="stats-grid" aria-label="Metrik task">
      {cards.map(({ label, value, icon: Icon, tone }) => <div className="stat-card" key={label}>
        <span className="stat-label">{label}</span>
        <strong>{loading ? "–" : value}</strong>
        <span className={`metric-icon metric-${tone}`}><Icon aria-hidden="true" /></span>
      </div>)}
    </section>
    <section className="panel">
      <div className="panel-heading"><div><h2>Task terbaru</h2><p>Task aktif yang baru dibuat</p></div><Link className="text-link" to="/tasks">Lihat semua <ArrowRight aria-hidden="true" /></Link></div>
      {loading ? <p className="loading">Memuat task...</p> : tasks.length === 0 ? <Empty message="Belum ada task. Buat task pertama dari halaman Semua task." /> :
        <ul className="recent-list">{tasks.slice(0, 5).map((task) => <li key={task.id}>
          <Link to={`/tasks/${task.id}`}><span>{task.title}</span><StatusBadge status={task.status} /><ChevronRight aria-hidden="true" /></Link>
        </li>)}</ul>}
    </section>
    <Link className="view-card" to="/board"><Columns3 aria-hidden="true" /><span><strong>Lihat sebagai board</strong><small>Kelompokkan task sesuai alur status</small></span><ArrowRight aria-hidden="true" /></Link>
  </>;
}

export function TasksPage() {
  const { actor } = useOutletContext<PageContext>();
  const { tasks, loading, error: loadError, refresh } = useTasks();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Status | "all">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const visible = tasks.filter((task) =>
    task.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
    (filter === "all" || task.status === filter));

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true); setError("");
    try {
      const task = await api<Task>("/api/tasks", { method: "POST", body: JSON.stringify({ title, priority, dueDate: dueDate || null }) });
      navigate(`/tasks/${task.id}`);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function advance(task: Task) {
    const status = nextStatus(task.status);
    if (!status) return;
    setBusy(true); setError("");
    try {
      await api<Task>(`/api/tasks/${task.id}/status`, { method: "PUT", body: JSON.stringify({ status, actor }) });
      await refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(task: Task) {
    setBusy(true); setError("");
    try {
      await api<void>(`/api/tasks/${task.id}`, { method: "DELETE" });
      await refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading eyebrow="WORKSPACE / SEMUA TASK" title="Semua task" description="Buat task, cari pekerjaan, dan lanjutkan status satu langkah."
      actions={<Link className="button button-outline" to="/board"><Columns3 aria-hidden="true" /> Lihat board</Link>} />
    <section className="panel create-panel" aria-labelledby="create-heading">
      <div className="panel-heading"><div><h2 id="create-heading">Buat task</h2><p>Task baru dimulai dari To do.</p></div></div>
      <form className="create-form" onSubmit={(event) => void createTask(event)}>
        <div className="create-title-row">
          <label className="sr-only" htmlFor="task-title">Judul task</label>
          <input id="task-title" placeholder="Contoh: Prepare Invoice" value={title} onChange={(event) => setTitle(event.target.value)} required />
          <button className="button button-primary" type="submit" disabled={busy}><Plus aria-hidden="true" /> Tambah task</button>
        </div>
        <div className="create-extra">
          <label>Prioritas<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
            {priorities.map((item) => <option key={item} value={item}>{priorityLabels[item]}</option>)}
          </select></label>
          <label>Tenggat (opsional)<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
        </div>
      </form>
    </section>
    <section className="panel" aria-labelledby="list-heading">
      <div className="panel-heading"><div><h2 id="list-heading">Daftar task</h2><p>{tasks.length} task aktif</p></div></div>
      <div className="filters">
        <label className="search-field"><Search aria-hidden="true" /><input aria-label="Cari task" placeholder="Cari task..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <label className="sr-only" htmlFor="status-filter">Filter status</label>
        <select id="status-filter" value={filter} onChange={(event) => setFilter(event.target.value as Status | "all")}>
          <option value="all">Semua status</option>{statuses.map((status) => <option value={status} key={status}>{statusLabels[status]}</option>)}
        </select>
      </div>
      <ErrorNotice message={error || loadError} />
      {loading ? <p className="loading">Memuat task...</p> : visible.length === 0 ? <Empty message={tasks.length ? "Tidak ada task yang cocok." : "Belum ada task. Tambahkan task pertama di atas."} /> :
        <ul className="task-list">{visible.map((task) => {
          const next = nextStatus(task.status);
          return <li className="task-list-row" key={task.id}>
            <div className="task-list-main"><Link to={`/tasks/${task.id}`} className="task-title">{task.title}</Link><span className="task-date">{priorityLabels[task.priority]} · {task.dueDate ? `Tenggat ${formatDate(task.dueDate)}` : `Dibuat ${formatTime(task.createdAt)}`}{isOverdue(task) ? " · Terlambat" : ""}</span></div>
            <StatusBadge status={task.status} />
            <div className="row-actions">
              {next && <button className="button button-small button-outline" disabled={busy} onClick={() => void advance(task)}><ArrowRight aria-hidden="true" /> {statusLabels[next]}</button>}
              <Link className="icon-button" to={`/tasks/${task.id}`} aria-label={`Detail ${task.title}`}><ChevronRight aria-hidden="true" /></Link>
              <button className="icon-button icon-danger" disabled={busy} aria-label={`Hapus ${task.title}`} onClick={() => void remove(task)}><Trash2 aria-hidden="true" /></button>
            </div>
          </li>;
        })}</ul>}
    </section>
  </>;
}

export function BoardPage() {
  const { actor } = useOutletContext<PageContext>();
  const { tasks, loading, error: loadError, refresh } = useTasks();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function advance(task: Task) {
    const status = nextStatus(task.status);
    if (!status) return;
    setBusy(true); setError("");
    try {
      await api<Task>(`/api/tasks/${task.id}/status`, { method: "PUT", body: JSON.stringify({ status, actor }) });
      await refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return <>
    <PageHeading eyebrow="WORKSPACE / BOARD" title="Board status" description="Empat kolom mengikuti urutan status yang ditetapkan."
      actions={<Link className="button button-primary" to="/tasks"><Plus aria-hidden="true" /> Task baru</Link>} />
    <ErrorNotice message={error || loadError} />
    {loading ? <p className="loading">Memuat board...</p> : <div className="board-grid">
      {statuses.map((status) => {
        const columnTasks = tasks.filter((task) => task.status === status);
        return <section className="board-column" key={status} aria-label={statusLabels[status]}>
          <div className="board-column-heading"><span className={`stat-dot stat-dot-${status}`} /><h2>{statusLabels[status]}</h2><span className="count-pill">{columnTasks.length}</span></div>
          <div className="board-column-body">{columnTasks.length === 0 ? <p className="board-empty">Belum ada task</p> : columnTasks.map((task) => {
            const next = nextStatus(task.status);
            return <article className="board-card" key={task.id}>
              <Link className="board-card-title" to={`/tasks/${task.id}`}>{task.title}</Link>
              <small>{priorityLabels[task.priority]} · {task.dueDate ? `Tenggat ${formatDate(task.dueDate)}` : `Dibuat ${formatTime(task.createdAt)}`}</small>
              {next && <button className="board-advance" disabled={busy} onClick={() => void advance(task)}>Lanjut ke {statusLabels[next]} <ArrowRight aria-hidden="true" /></button>}
            </article>;
          })}</div>
        </section>;
      })}
    </div>}
  </>;
}

export function TaskDetailPage() {
  const { id } = useParams();
  const { actor } = useOutletContext<PageContext>();
  const navigate = useNavigate();
  const [task, setTask] = useState<Task | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [priority, setPriority] = useState<Priority>("medium");
  const [dueDate, setDueDate] = useState("");
  const formTaskId = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    const [current, history] = await Promise.all([
      api<Task>(`/api/tasks/${id}`),
      api<AuditLog[]>(`/api/tasks/${id}/audit-logs`),
    ]);
    setTask(current); setLogs(history);
    if (formTaskId.current !== current.id) {
      formTaskId.current = current.id;
      setPriority(current.priority); setDueDate(current.dueDate ?? "");
    }
  }, [id]);
  useEffect(() => {
    setLoading(true);
    setTask(null);
    setLogs([]);
    setError("");
    refresh().catch((cause) => setError((cause as Error).message)).finally(() => setLoading(false));
  }, [refresh]);

  async function advance() {
    if (!task) return;
    const status = nextStatus(task.status);
    if (!status) return;
    setBusy(true); setError("");
    try {
      await api<Task>(`/api/tasks/${task.id}/status`, { method: "PUT", body: JSON.stringify({ status, actor }) });
      await refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function saveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!task || (priority === task.priority && (dueDate || null) === task.dueDate)) return;
    setBusy(true); setError("");
    try {
      await api<Task>(`/api/tasks/${task.id}`, { method: "PATCH", body: JSON.stringify({ priority, dueDate: dueDate || null }) });
      await refresh();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!task) return;
    setBusy(true); setError("");
    try {
      await api<void>(`/api/tasks/${task.id}`, { method: "DELETE" });
      navigate("/trash");
    } catch (cause) { setError((cause as Error).message); setBusy(false); }
  }

  if (loading) return <p className="loading">Memuat task...</p>;
  if (!task) return <><ErrorNotice message={error || "Task tidak ditemukan"} /><Link className="text-link" to="/tasks">Kembali ke daftar</Link></>;
  const next = nextStatus(task.status);
  return <>
    <Link className="back-link" to={task.deletedAt ? "/trash" : "/tasks"}><ArrowLeft aria-hidden="true" /> {task.deletedAt ? "Task terhapus" : "Semua task"}</Link>
    <PageHeading eyebrow="WORKSPACE / DETAIL TASK" title={task.title} description={`Dibuat ${formatTime(task.createdAt)}`} />
    <ErrorNotice message={error} />
    <div className="detail-grid">
      <section className="panel task-detail-card" aria-labelledby="task-detail-heading">
        <div className="panel-heading"><div><h2 id="task-detail-heading">Detail task</h2><p>Status saat ini dan tindakan berikutnya</p></div></div>
        <div className="detail-field"><span>Status</span><StatusBadge status={task.status} /></div>
        <div className="detail-field"><span>Dibuat</span><strong>{formatTime(task.createdAt)}</strong></div>
        {task.deletedAt ? <>
          <div className="detail-field"><span>Prioritas</span><strong>{priorityLabels[task.priority]}</strong></div>
          <div className="detail-field"><span>Tenggat</span><strong>{task.dueDate ? formatDate(task.dueDate) : "Tidak ada"}</strong></div>
          <p className="deleted-note">Task ini sudah dihapus. Riwayat status tetap tersedia.</p>
        </> : <>
          <form className="detail-edit" onSubmit={(event) => void saveDetails(event)}>
            <label>Prioritas<select value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {priorities.map((item) => <option key={item} value={item}>{priorityLabels[item]}</option>)}
            </select></label>
            <label>Tenggat<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            <button className="button button-outline" type="submit" disabled={busy || (priority === task.priority && (dueDate || null) === task.dueDate)}>Simpan detail</button>
          </form>
          <p className="actor-note">Perubahan akan dicatat atas nama <strong>{actor}</strong>.</p>
          <div className="detail-actions">
            {next && <button className="button button-primary" disabled={busy} onClick={() => void advance()}><ArrowRight aria-hidden="true" /> Lanjut ke {statusLabels[next]}</button>}
            <button className="button button-danger" disabled={busy} onClick={() => void remove()}><Trash2 aria-hidden="true" /> Hapus task</button>
          </div>
        </>}
      </section>
      <section className="panel audit-panel" aria-labelledby="audit-heading">
        <div className="panel-heading"><div><h2 id="audit-heading">Riwayat status</h2><p>{logs.length} perubahan tercatat</p></div><History aria-hidden="true" /></div>
        {logs.length === 0 ? <Empty message="Belum ada perubahan status." /> : <ol className="timeline">
          {logs.map((log) => <li key={log.id}>
            <span className="timeline-dot" />
            <div><p><strong>{log.actor}</strong> mengubah <StatusBadge status={log.fromStatus} /> <ArrowRight aria-hidden="true" /> <StatusBadge status={log.toStatus} /></p>
              <time dateTime={log.changedAt}>{formatTime(log.changedAt)}</time></div>
          </li>)}
        </ol>}
      </section>
    </div>
  </>;
}

export function TrashPage() {
  const { tasks, loading, error } = useTasks(true);
  return <>
    <PageHeading eyebrow="WORKSPACE / RIWAYAT" title="Task terhapus" description="Task hilang dari daftar aktif, tetapi riwayat statusnya tetap dapat dilihat." />
    <ErrorNotice message={error} />
    <section className="panel">
      <div className="panel-heading"><div><h2>Daftar terhapus</h2><p>{tasks.length} task</p></div></div>
      {loading ? <p className="loading">Memuat task...</p> : tasks.length === 0 ? <Empty message="Belum ada task yang dihapus." /> :
        <ul className="trash-list">{tasks.map((task) => <li key={task.id}><Link to={`/tasks/${task.id}`}>
          <span><strong>{task.title}</strong><small>Dihapus {task.deletedAt ? formatTime(task.deletedAt) : ""}</small></span>
          <StatusBadge status={task.status} /><ChevronRight aria-hidden="true" />
        </Link></li>)}</ul>}
    </section>
  </>;
}

export function TimelinePage() {
  const { tasks, loading, error } = useTasks();
  const scheduled = tasks.filter((task) => task.dueDate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const unscheduled = tasks.filter((task) => !task.dueDate);
  return <>
    <PageHeading eyebrow="WORKSPACE / TIMELINE" title="Timeline" description="Lihat task menurut tanggal tenggatnya."
      actions={<Link className="button button-primary" to="/tasks"><Plus aria-hidden="true" /> Task baru</Link>} />
    <ErrorNotice message={error} />
    <section className="panel">
      <div className="panel-heading"><div><h2>Jadwal task</h2><p>{scheduled.length} task dengan tenggat</p></div><CalendarDays aria-hidden="true" /></div>
      {loading ? <p className="loading">Memuat jadwal...</p> : scheduled.length === 0 ? <Empty message="Belum ada task dengan tenggat. Atur tenggat saat membuat task atau dari halaman detail." /> :
        <ul className="schedule-list">{scheduled.map((task) => <li key={task.id} className={isOverdue(task) ? "schedule-overdue" : ""}>
          <time dateTime={task.dueDate!}>{formatDate(task.dueDate!)}</time>
          <div><Link to={`/tasks/${task.id}`}>{task.title}</Link><small>{priorityLabels[task.priority]}{isOverdue(task) ? " · Terlambat" : ""}</small></div>
          <StatusBadge status={task.status} />
        </li>)}</ul>}
    </section>
    {!loading && unscheduled.length > 0 && <section className="panel">
      <div className="panel-heading"><div><h2>Tanpa tenggat</h2><p>{unscheduled.length} task belum dijadwalkan</p></div></div>
      <ul className="recent-list">{unscheduled.map((task) => <li key={task.id}><Link to={`/tasks/${task.id}`}><span>{task.title}</span><StatusBadge status={task.status} /><ChevronRight aria-hidden="true" /></Link></li>)}</ul>
    </section>}
  </>;
}

export function UsersPage() {
  const { actor, setActor } = useOutletContext<PageContext>();
  return <>
    <PageHeading eyebrow="WORKSPACE / USERS" title="Users" description="Pilih nama yang dicatat saat mengubah status task." />
    <section className="panel">
      <div className="panel-heading"><div><h2>Pelaku perubahan</h2><p>Daftar actor tetap sesuai ketentuan tugas</p></div><UsersRound aria-hidden="true" /></div>
      <div className="users-list">{actors.map((name) => <div className="user-row" key={name}>
        <span className="actor-avatar" aria-hidden="true">{name[0].toUpperCase()}</span>
        <div><strong>{name}</strong><small>Actor audit log</small></div>
        <button className={`button ${actor === name ? "button-selected" : "button-outline"}`} disabled={actor === name} onClick={() => setActor(name)}>{actor === name ? "Dipilih" : "Pilih"}</button>
      </div>)}</div>
    </section>
    <p className="page-description">Nama actor dipilih manual; halaman ini tidak menyediakan login atau verifikasi identitas.</p>
  </>;
}

export function InsightsPage() {
  const { tasks, loading, error } = useTasks();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const invalidRange = Boolean(start && end && start > end);
  const filtered = tasks.filter((task) => {
    const created = localDate(task.createdAt);
    return (!start || created >= start) && (!end || created <= end);
  });
  const stats = taskStats(filtered);
  const completionRate = stats.total ? Math.round(stats.done / stats.total * 100) : 0;
  const statusColors: Record<Status, string> = { to_do: "#94a3b8", pending: "#f5b94f", in_progress: "#3b82f6", done: "#22a66c" };
  let position = 0;
  const segments = statuses.map((status) => {
    const from = position;
    position += stats.total ? stats[status] / stats.total * 100 : 0;
    return `${statusColors[status]} ${from}% ${position}%`;
  });
  const priorityOrder = ["high", "medium", "low"] as const;
  const priorityCounts = priorityOrder.map((priority) => ({ priority, count: filtered.filter((task) => task.priority === priority).length }));
  const cards = [
    { label: "Total task", value: stats.total, icon: ListChecks, tone: "blue" },
    { label: "Tingkat selesai", value: `${completionRate}%`, icon: CheckCircle2, tone: "green" },
    { label: "In progress", value: stats.in_progress, icon: Clock3, tone: "blue" },
    { label: "Terlambat", value: stats.overdue, icon: AlertCircle, tone: "red" },
  ];
  return <>
    <PageHeading eyebrow="WORKSPACE / INSIGHTS" title="Task Insights" description="Analitik task aktif berdasarkan tanggal pembuatan." />
    <ErrorNotice message={error} />
    <section className="panel date-filter-panel">
      <div className="panel-heading"><div><h2>Filter rentang tanggal</h2><p>Memfilter task menurut tanggal dibuat</p></div><CalendarDays aria-hidden="true" /></div>
      <div className="date-range">
        <label>Tanggal mulai<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label>Tanggal akhir<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} /></label>
      </div>
    </section>
    {invalidRange ? <ErrorNotice message="Tanggal akhir harus sama atau setelah tanggal mulai." /> : <>
      <section className="insight-stats" aria-label="Metrik insight">
        {cards.map(({ label, value, icon: Icon, tone }) => <div className="insight-card" key={label}>
          <span>{label}</span><strong>{loading ? "–" : value}</strong><span className={`metric-icon metric-${tone}`}><Icon aria-hidden="true" /></span>
        </div>)}
      </section>
      <div className="insight-charts">
        <section className="panel" aria-labelledby="status-chart-heading">
          <div className="panel-heading"><div><h2 id="status-chart-heading">Distribusi status</h2><p>{stats.total} task dalam rentang tanggal</p></div></div>
          <div className="donut-wrap"><div className="donut-chart" role="img" aria-label={statuses.map((status) => `${statusLabels[status]} ${stats[status]}`).join(", ")}
            style={{ background: stats.total ? `conic-gradient(${segments.join(", ")})` : "var(--surface)" }}><span>{stats.total}</span></div></div>
          <div className="chart-legend">{statuses.map((status) => <span key={status}><i style={{ background: statusColors[status] }} />{statusLabels[status]}: {stats[status]}</span>)}</div>
        </section>
        <section className="panel" aria-labelledby="priority-chart-heading">
          <div className="panel-heading"><div><h2 id="priority-chart-heading">Distribusi prioritas</h2><p>Jumlah task untuk setiap tingkat</p></div><BarChart3 aria-hidden="true" /></div>
          <div className="priority-bars">{priorityCounts.map(({ priority, count }) => <div className="priority-bar-row" key={priority}>
            <span>{priorityLabels[priority]}</span><div className="bar-track"><span className={`bar-fill bar-${priority}`} style={{ width: `${stats.total ? count / stats.total * 100 : 0}%` }} /></div><strong>{count}</strong>
          </div>)}</div>
        </section>
      </div>
      {!loading && <section className="insight-note" aria-label="Ringkasan insight"><strong>Ringkasan</strong><p>{stats.total === 0 ? "Belum ada task pada rentang tanggal ini." : stats.overdue > 0 ? `${stats.overdue} task melewati tenggat dan masih perlu diselesaikan.` : stats.in_progress > 0 ? `${stats.in_progress} task sedang dikerjakan, tanpa task yang melewati tenggat.` : `${stats.done} dari ${stats.total} task sudah selesai; tidak ada task yang melewati tenggat.`}</p></section>}
    </>}
  </>;
}
