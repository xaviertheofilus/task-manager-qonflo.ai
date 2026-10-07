import { useEffect, useRef, useState } from "react";
import { LuCalendarDays as CalendarDays, LuChartNoAxesColumn as BarChart3, LuCheckCheck as CheckCheck, LuCircleUserRound, LuColumns3 as Columns3, LuLayoutDashboard as LayoutDashboard, LuListTodo as ListTodo, LuMenu as Menu, LuMoon, LuPanelLeftClose, LuPanelLeftOpen, LuSun, LuTrash2 as Trash2, LuUsersRound as UsersRound, LuX as X } from "react-icons/lu";
import { BrowserRouter, Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";
import { actors } from "./domain";
import { BoardPage, DashboardPage, InsightsPage, TaskDetailPage, TasksPage, TimelinePage, TrashPage, UsersPage } from "./pages";

export type PageContext = { actor: string; setActor: (actor: string) => void };

const mainLinks = [
  { to: "/", label: "Ringkasan", icon: LayoutDashboard },
  { to: "/tasks", label: "Semua task", icon: ListTodo },
  { to: "/board", label: "Board", icon: Columns3 },
  { to: "/timeline", label: "Timeline", icon: CalendarDays },
  { to: "/users", label: "Users", icon: UsersRound },
  { to: "/insights", label: "Insights", icon: BarChart3 },
];

function Shell() {
  const [actor, setActor] = useState<string>(actors[0]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarHidden, setSidebarHidden] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("task-theme");
    return saved === "dark" || (!saved && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  });
  const userMenuRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => { setMenuOpen(false); setUserMenuOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("task-theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!userMenuOpen) return;
    const closeOutside = (event: PointerEvent) => {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    };
    const closeEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUserMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeEscape);
    };
  }, [userMenuOpen]);

  return (
    <div className={`app-shell ${sidebarHidden ? "sidebar-hidden" : ""}`}>
      <a className="skip-link" href="#main-content">Lewati navigasi</a>
      {menuOpen && <button className="sidebar-overlay" aria-label="Tutup navigasi" onClick={() => setMenuOpen(false)} />}
      <aside id="sidebar" className={`sidebar ${menuOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <Link to="/" className="brand-link">
            <span className="brand-mark"><CheckCheck aria-hidden="true" /></span>
            <span><strong>Task Manager</strong><small>Team workspace</small></span>
          </Link>
          <button className="icon-button sidebar-close" aria-label="Tutup navigasi" onClick={() => setMenuOpen(false)}><X aria-hidden="true" /></button>
        </div>

        <nav aria-label="Navigasi utama" className="sidebar-nav">
          <p className="nav-label">WORKSPACE</p>
          {mainLinks.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>
              <Icon aria-hidden="true" /> <span>{label}</span>
            </NavLink>
          ))}
          <p className="nav-label nav-label-secondary">RIWAYAT</p>
          <NavLink to="/trash" className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>
            <Trash2 aria-hidden="true" /> <span>Task terhapus</span>
          </NavLink>
        </nav>

      </aside>

      <main id="main-content" className="main-area">
        <header className="workspace-topbar">
          <button className="icon-button mobile-menu" aria-label="Buka navigasi" aria-expanded={menuOpen} aria-controls="sidebar" onClick={() => setMenuOpen(true)}><Menu aria-hidden="true" /></button>
          <button className="icon-button desktop-sidebar-toggle" aria-label={sidebarHidden ? "Tampilkan sidebar" : "Sembunyikan sidebar"} aria-expanded={!sidebarHidden} aria-controls="sidebar" onClick={() => setSidebarHidden(!sidebarHidden)}>
            {sidebarHidden ? <LuPanelLeftOpen aria-hidden="true" /> : <LuPanelLeftClose aria-hidden="true" />}
          </button>
          <div className="topbar-actions">
            <button className="icon-button theme-toggle" aria-label={theme === "light" ? "Aktifkan tema gelap" : "Aktifkan tema terang"} aria-pressed={theme === "dark"} onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
              {theme === "light" ? <LuMoon aria-hidden="true" /> : <LuSun aria-hidden="true" />}
            </button>
            <div className="user-menu" ref={userMenuRef}>
              <button className="icon-button user-trigger" aria-label={`Menu pengguna: ${actor}`} aria-expanded={userMenuOpen} aria-controls="user-dropdown" onClick={() => setUserMenuOpen(!userMenuOpen)}><LuCircleUserRound aria-hidden="true" /></button>
              {userMenuOpen && <div id="user-dropdown" className="user-dropdown" role="group" aria-label="Pilih pengguna">
                <p>Pengguna aktif</p>
                {actors.map((name) => <button key={name} className="user-option" aria-pressed={actor === name} onClick={() => { setActor(name); setUserMenuOpen(false); }}>
                  <span className="actor-avatar" aria-hidden="true">{name[0].toUpperCase()}</span><span>{name}</span>{actor === name && <CheckCheck aria-hidden="true" />}
                </button>)}
              </div>}
            </div>
          </div>
        </header>
        <div className="content"><Outlet context={{ actor, setActor }} /></div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Shell />}>
          <Route index element={<DashboardPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="board" element={<BoardPage />} />
          <Route path="timeline" element={<TimelinePage />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="insights" element={<InsightsPage />} />
          <Route path="tasks/:id" element={<TaskDetailPage />} />
          <Route path="trash" element={<TrashPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
