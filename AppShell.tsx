import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, Bell, CalendarDays, CheckCheck, ChevronRight, ChevronsLeft, ChevronsRight, ClipboardList, FolderHeart,
  HeartPulse, LayoutDashboard, LogOut, Menu, PawPrint, Plus, Repeat2, Search, Settings, Stethoscope, UserRound, Users, X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { cn, fmtAgo } from "@/lib/utils";
import { Button } from "../ui/button";
import { Avatar } from "../ui/misc";
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuSeparator, MenuTrigger, PopoverClose, PopoverContent, PopoverRoot, PopoverTrigger } from "../ui/menu";
import { useDialogs } from "../forms/DialogsProvider";
import { GlobalSearch } from "./GlobalSearch";

const NAV = [
  { section: "Workspace", items: [
    { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/animals", label: "Animals", icon: PawPrint },
    { to: "/cases", label: "Cases", icon: FolderHeart },
    { to: "/handovers", label: "Handover", icon: Repeat2 },
    { to: "/tasks", label: "Tasks", icon: ClipboardList },
    { to: "/staff", label: "Staff", icon: Users },
  ] },
  { section: "Operations", items: [
    { to: "/schedule", label: "Duty Schedule", icon: CalendarDays },
    { to: "/activity", label: "Activity Log", icon: Activity },
  ] },
  { section: "System", items: [{ to: "/settings", label: "Settings", icon: Settings }] },
];

const TITLES: Record<string, string> = {
  "": "Overview", animals: "Animals", cases: "Cases", handovers: "Handover", tasks: "Tasks", staff: "Staff",
  schedule: "Duty Schedule", activity: "Activity Log", settings: "Settings",
};

function readCollapsed() {
  try {
    return window.localStorage.getItem("carebase:sidebar") === "collapsed";
  } catch {
    return false;
  }
}

export function AppShell() {
  const { db, user } = useStore();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem("carebase:sidebar", collapsed ? "collapsed" : "expanded");
    } catch {
      /* ignore */
    }
  }, [collapsed]);
  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    try {
      window.sessionStorage.setItem("carebase:route", location.pathname + location.search);
    } catch {
      /* ignore */
    }
    document.querySelector("main")?.scrollTo({ top: 0 });
  }, [location.pathname, location.search]);

  // Keyboard: "/" or Ctrl/Cmd+K opens search.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if ((e.key === "k" && (e.metaKey || e.ctrlKey)) || (e.key === "/" && !typing)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Breadcrumbs from the URL.
  const crumbs = useMemo(() => {
    const parts = location.pathname.split("/").filter(Boolean);
    const out: { label: string; to?: string }[] = [{ label: "Carebase", to: "/" }];
    if (parts.length === 0) out.push({ label: "Overview" });
    else {
      out.push({ label: TITLES[parts[0]] ?? "Page", to: parts.length > 1 ? `/${parts[0]}` : undefined });
      if (parts[1]) {
        let label = parts[1];
        if (parts[0] === "animals") label = db.animals.find((a) => a.id === parts[1])?.name ?? parts[1];
        if (parts[0] === "staff") label = db.staff.find((s) => s.id === parts[1])?.name ?? parts[1];
        out.push({ label });
      }
    }
    return out;
  }, [location.pathname, db.animals, db.staff]);
  const title = TITLES[location.pathname.split("/")[1] ?? ""] ?? "Carebase";

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-ink">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:shadow-pop">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className={cn("hidden shrink-0 border-r border-line bg-white transition-[width] duration-150 lg:block", collapsed ? "w-[68px]" : "w-[240px]")}>
        <SidebarInner collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </aside>
      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-navy-dark/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-white shadow-pop">
            <Button variant="ghost" size="icon-sm" className="absolute right-2 top-3" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></Button>
            <SidebarInner collapsed={false} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-3 sm:px-5">
          <Button variant="ghost" size="icon-sm" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></Button>
          <div className="min-w-0 flex-1">
            <nav aria-label="Breadcrumb" className="hidden items-center gap-1 text-xs text-ink-muted sm:flex">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3 w-3" aria-hidden />}
                  {c.to ? <Link to={c.to} className="rounded hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">{c.label}</Link> : <span aria-current="page" className="text-ink">{c.label}</span>}
                </span>
              ))}
            </nav>
            <p className="truncate text-sm font-semibold leading-tight text-ink sm:text-[15px]">{title}</p>
          </div>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden h-9 w-64 items-center gap-2 rounded-md border border-line bg-canvas px-3 text-left text-sm text-ink-muted transition-colors hover:border-[#CBD5DE] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal md:flex xl:w-80"
            aria-label="Search animals, tokens, cases, staff and tasks"
          >
            <Search className="h-4 w-4" aria-hidden />
            <span className="flex-1 truncate">Search token, animal, case…</span>
            <kbd className="rounded border border-line bg-white px-1.5 text-[10px] font-medium">/</kbd>
          </button>
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(true)} aria-label="Search"><Search /></Button>
          <NotificationsBell />
          <QuickAdd />
          {user && <UserMenu compact />}
        </header>
        <main id="main" className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-3 py-5 sm:px-6 sm:py-6">
            <Outlet />
          </div>
        </main>
      </div>
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

function SidebarInner({ collapsed, onToggle }: { collapsed: boolean; onToggle?: () => void }) {
  const { db } = useStore();
  const pendingHandovers = db.handovers.filter((h) => h.status === "Pending").length;
  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center gap-2.5 border-b border-line", collapsed ? "justify-center px-0" : "px-4")}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-navy text-teal-soft">
          <HeartPulse className="h-[18px] w-[18px]" aria-hidden />
        </span>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="text-[15px] font-semibold tracking-tight text-navy">Carebase</p>
            <p className="truncate text-[11px] text-ink-muted">{db.settings.shelterName}</p>
          </div>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Main">
        {NAV.map((g) => (
          <div key={g.section} className="mb-4">
            {!collapsed ? (
              <p className="mb-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-[#A0AEC0]">{g.section}</p>
            ) : (
              <div className="mx-2 mb-2 h-px bg-line" aria-hidden />
            )}
            <ul className="space-y-0.5">
              {g.items.map((it) => (
                <li key={it.to}>
                  <NavLink
                    to={it.to}
                    end={it.end}
                    title={collapsed ? it.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "group flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
                        collapsed && "justify-center px-0",
                        isActive ? "bg-teal-soft text-teal" : "text-[#4A5A68] hover:bg-canvas hover:text-ink",
                      )
                    }
                  >
                    <it.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    {!collapsed && <span className="flex-1 truncate">{it.label}</span>}
                    {!collapsed && it.to === "/handovers" && pendingHandovers > 0 && (
                      <span className="rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold text-warning-ink" aria-label={`${pendingHandovers} pending`}>{pendingHandovers}</span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <UserMenu collapsed={collapsed} />
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className={cn("mt-2 flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-xs text-ink-muted hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal", collapsed && "justify-center px-0")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronsRight className="h-4 w-4" /> : <><ChevronsLeft className="h-4 w-4" /> Collapse</>}
          </button>
        )}
      </div>
    </div>
  );
}

function UserMenu({ collapsed, compact }: { collapsed?: boolean; compact?: boolean }) {
  const { user, logout, db, login, mode } = useStore();
  const navigate = useNavigate();
  if (!user) return null;
  const others = db.staff.filter((s) => s.active && s.id !== user.id);
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        {compact ? (
          <button type="button" className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2" aria-label={`Account menu for ${user.name}`}>
            <Avatar id={user.id} name={user.name} />
          </button>
        ) : (
          <button
            type="button"
            className={cn("flex w-full items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal", collapsed && "justify-center")}
            aria-label={`Account menu for ${user.name}`}
          >
            <Avatar id={user.id} name={user.name} />
            {!collapsed && (
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{user.name}</span>
                <span className="block truncate text-xs text-ink-muted">{user.role}</span>
              </span>
            )}
          </button>
        )}
      </MenuTrigger>
      <MenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-64">
        <div className="px-2.5 py-2">
          <p className="text-sm font-semibold text-ink">{user.name}</p>
          <p className="text-xs text-ink-muted">{user.role} · {user.email}</p>
        </div>
        <MenuSeparator />
        <MenuItem onSelect={() => navigate(`/staff/${user.id}`)}><UserRound /> My profile</MenuItem>
        <MenuItem onSelect={() => navigate(`/tasks?assignee=${user.id}`)}><ClipboardList /> My tasks</MenuItem>
        {can(user, "settings.manage") && <MenuItem onSelect={() => navigate("/settings")}><Settings /> Settings</MenuItem>}
        {mode === "local" && (
          <>
            <MenuSeparator />
            <MenuLabel>Demo · switch user</MenuLabel>
            <div className="max-h-48 overflow-y-auto">
              {others.map((s) => (
                <MenuItem key={s.id} onSelect={() => login(s.id)}>
                  <Avatar id={s.id} name={s.name} size="xs" />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="text-[11px] text-ink-muted">{s.role === "Support Staff" ? "Support" : s.role}</span>
                </MenuItem>
              ))}
            </div>
          </>
        )}
        <MenuSeparator />
        <MenuItem onSelect={logout}><LogOut /> Log out</MenuItem>
      </MenuContent>
    </MenuRoot>
  );
}

function QuickAdd() {
  const { user } = useStore();
  const { open } = useDialogs();
  const items = [
    { label: "Add Animal", icon: PawPrint, perm: can(user, "animal.create"), run: () => open({ kind: "animal" }) },
    { label: "Create Case", icon: FolderHeart, perm: can(user, "case.create"), run: () => open({ kind: "case" }) },
    { label: "Create Task", icon: ClipboardList, perm: true, run: () => open({ kind: "task" }) },
    { label: "Create Handover", icon: Repeat2, perm: can(user, "handover.create"), run: () => open({ kind: "handover" }) },
    { label: "Add Care Update", icon: Stethoscope, perm: can(user, "case.careUpdate"), run: () => open({ kind: "careUpdate" }) },
  ];
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <Button aria-label="Quick add" className="px-2.5 sm:px-3.5"><Plus /> <span className="hidden sm:inline">Quick Add</span></Button>
      </MenuTrigger>
      <MenuContent className="w-56">
        <MenuLabel>Create new</MenuLabel>
        {items.map((it) => (
          <MenuItem key={it.label} onSelect={it.run} disabled={!it.perm}>
            <it.icon /> <span className="flex-1">{it.label}</span>
            {!it.perm && <span className="text-[10px] text-ink-muted">No access</span>}
          </MenuItem>
        ))}
      </MenuContent>
    </MenuRoot>
  );
}

function NotificationsBell() {
  const { db, user, markNotificationRead, markAllNotificationsRead } = useStore();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const mine = db.notifications.filter((n) => n.recipientId === user?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const unread = mine.filter((n) => !n.read).length;
  const shown = (filter === "unread" ? mine.filter((n) => !n.read) : mine).slice(0, 30);
  return (
    <PopoverRoot>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(380px,calc(100vw-24px))]">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-ink-muted">{unread ? `${unread} unread` : "You're all caught up"}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={markAllNotificationsRead} disabled={!unread}><CheckCheck /> Mark all read</Button>
        </div>
        <div className="flex gap-1 border-b border-line px-3 py-2" role="radiogroup" aria-label="Filter notifications">
          {(["all", "unread"] as const).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal", filter === f ? "bg-teal-soft text-teal" : "text-ink-muted hover:text-ink")}>
              {f}
            </button>
          ))}
        </div>
        <ul className="max-h-[420px] overflow-y-auto">
          {shown.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-muted">No notifications here.</li>}
          {shown.map((n) => (
            <li key={n.id} className="border-b border-line last:border-0">
              <PopoverClose asChild>
                <button
                  type="button"
                  onClick={() => {
                    markNotificationRead(n.id);
                    navigate(n.link);
                  }}
                  className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-none", !n.read && "bg-[#F6FBFB]")}
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.read ? "bg-transparent" : n.type === "Task Overdue" || n.type === "Handover Pending" ? "bg-danger" : "bg-teal")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-[13px] font-semibold text-ink">{n.title}</span>
                      <span className="shrink-0 text-[11px] text-ink-muted">{fmtAgo(n.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] leading-snug text-ink-muted">{n.message}</span>
                    {!n.read && <span className="sr-only">Unread</span>}
                  </span>
                </button>
              </PopoverClose>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </PopoverRoot>
  );
}
