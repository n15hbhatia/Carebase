import { useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, ClipboardList, Columns3, MoreHorizontal, Pencil, Plus, Rows3, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { can, canUpdateTask } from "@/lib/permissions";
import { TASK_CATEGORIES, TASK_STATUSES, type Task, type TaskStatus } from "@/lib/types";
import { cn, fmtClock, fmtDateTime, staffName, taskDisplayStatus } from "@/lib/utils";
import { Avatar, Card, EmptyState, KeyValue, Pagination, Segmented, TokenChip } from "@/components/ui/misc";
import { SortTh, Table, Td, Th, Tr } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { compare, FilterBar, PageHeader, PriorityBadge, StaffChip, StaffOptions, TaskStatusBadge, useTableState } from "@/components/domain";
import { useDialogs } from "@/components/forms/DialogsProvider";

type SortKey = "due" | "title" | "priority" | "status" | "assignee";
const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 };

export default function TasksPage() {
  const { db, user, setTaskStatus, deleteTask } = useStore();
  const { open } = useDialogs();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [toDelete, setToDelete] = useState<Task | null>(null);
  const viewMode = (params.get("layout") as "table" | "board") ?? "table";
  const assignee = params.get("assignee") ?? "";
  const status = params.get("status") ?? "";
  const date = params.get("date") ?? "";
  const category = params.get("category") ?? "";
  const openId = params.get("open");
  const { sort, onSort, paginate, setPage } = useTableState<SortKey>({ key: "due", dir: "asc" }, 12);

  const setParam = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
    setPage(1);
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const today = format(new Date(), "yyyy-MM-dd");
    return db.tasks.filter((t) => {
      const ds = taskDisplayStatus(t);
      if (assignee && t.assigneeId !== assignee) return false;
      if (category && t.category !== category) return false;
      if (status === "pending" && t.status === "Completed") return false;
      if (status && status !== "pending" && ds !== status) return false;
      if (date === "today" && t.dueDate !== today) return false;
      if (date && date !== "today" && t.dueDate !== date) return false;
      if (term) {
        const a = db.animals.find((x) => x.id === t.animalId);
        if (!(t.title.toLowerCase().includes(term) || t.id.toLowerCase().includes(term) || a?.name.toLowerCase().includes(term) || a?.token.includes(term))) return false;
      }
      return true;
    });
  }, [db, q, assignee, category, status, date]);

  const sorted = useMemo(() => {
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const v =
        sort.key === "due" ? compare(`${a.dueDate}T${a.dueTime}`, `${b.dueDate}T${b.dueTime}`)
        : sort.key === "priority" ? PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
        : sort.key === "status" ? compare(taskDisplayStatus(a), taskDisplayStatus(b))
        : sort.key === "assignee" ? compare(staffName(db, a.assigneeId), staffName(db, b.assigneeId))
        : compare(a.title, b.title);
      return v * dir;
    });
  }, [filtered, sort, db]);
  const page = paginate(sorted);
  const overdueCount = db.tasks.filter((t) => taskDisplayStatus(t) === "Overdue").length;
  const anyFilter = !!(q || assignee || status || date || category);
  const viewing = db.tasks.find((t) => t.id === openId);

  const changeStatus = (t: Task, s: TaskStatus) => {
    if (!canUpdateTask(user, t)) {
      toast.error("You can only update tasks assigned to you");
      return;
    }
    setTaskStatus(t.id, s);
    toast.success(s === "Completed" ? "Task completed" : `Moved to ${s}`, { description: t.title });
  };

  const rowMenu = (t: Task) => (
    <MenuRoot>
      <MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${t.title}`} onClick={(e) => e.stopPropagation()}><MoreHorizontal /></Button></MenuTrigger>
      <MenuContent>
        <MenuLabel>Set status</MenuLabel>
        {TASK_STATUSES.map((s) => (
          <MenuItem key={s} disabled={t.status === s || !canUpdateTask(user, t)} onSelect={() => changeStatus(t, s)}>{s}</MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem disabled={!can(user, "task.editAny")} onSelect={() => open({ kind: "task", task: t })}><Pencil /> Edit / reassign</MenuItem>
        <MenuItem danger disabled={!can(user, "task.delete")} onSelect={() => setToDelete(t)}><Trash2 /> Delete…</MenuItem>
      </MenuContent>
    </MenuRoot>
  );

  return (
    <>
      <PageHeader
        title="Tasks"
        description="The shelter's Post-it notes and duty list, in one place. Every task has one owner and a due time."
        actions={<>
          <Segmented label="Layout" value={viewMode} onChange={(v) => setParam("layout", v === "table" ? null : v)}
            options={[{ value: "table", label: "Table", icon: Rows3 }, { value: "board", label: "Kanban", icon: Columns3 }]} />
          <Button onClick={() => open({ kind: "task", defaults: assignee ? { assigneeId: assignee } : undefined })}><Plus /> Create task</Button>
        </>}
      />
      <Card>
        <FilterBar>
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Task, animal or token…" className="pl-8" aria-label="Search tasks" />
          </div>
          <Select value={assignee} onChange={(e) => setParam("assignee", e.target.value)} aria-label="Filter by staff member" className="w-48">
            <StaffOptions placeholder="All staff" includeInactive />
          </Select>
          <Select value={status} onChange={(e) => setParam("status", e.target.value)} aria-label="Filter by status" className="w-40">
            <option value="">All statuses</option>
            <option value="pending">Not completed</option>
            <option>To Do</option><option>In Progress</option><option>Overdue</option><option>Completed</option>
          </Select>
          <Select value={category} onChange={(e) => setParam("category", e.target.value)} aria-label="Filter by category" className="w-44">
            <option value="">All categories</option>
            {TASK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Input type="date" value={date === "today" ? format(new Date(), "yyyy-MM-dd") : date} onChange={(e) => setParam("date", e.target.value)} className="w-40" aria-label="Filter by due date" />
          <Button variant={date === "today" ? "soft" : "ghost"} size="sm" onClick={() => setParam("date", date === "today" ? null : "today")}>Due today</Button>
          <Button variant={status === "Overdue" ? "soft" : "ghost"} size="sm" onClick={() => setParam("status", status === "Overdue" ? null : "Overdue")} className={cn(status !== "Overdue" && overdueCount > 0 && "text-danger-ink")}>
            <AlertTriangle /> Overdue ({overdueCount})
          </Button>
          <Button variant={assignee === user?.id ? "soft" : "ghost"} size="sm" onClick={() => setParam("assignee", assignee === user?.id ? null : user?.id ?? null)}>Mine</Button>
          {anyFilter && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setParams(viewMode === "board" ? { layout: "board" } : {}, { replace: true }); }}>Clear</Button>}
        </FilterBar>

        {filtered.length === 0 ? (
          <EmptyState icon={ClipboardList} title={anyFilter ? "No tasks match" : "No tasks yet"} description={anyFilter ? "Try clearing a filter." : "Create the first task to replace a Post-it note."}
            action={<Button onClick={() => open({ kind: "task" })}><Plus /> Create task</Button>} />
        ) : viewMode === "table" ? (
          <>
            <Table>
              <thead>
                <tr>
                  <Th className="w-10"><span className="sr-only">Done</span></Th>
                  <SortTh label="Task" sortKey="title" sort={sort} onSort={onSort} />
                  <Th className="hidden md:table-cell">Animal / case</Th>
                  <SortTh label="Assigned to" sortKey="assignee" sort={sort} onSort={onSort} className="hidden sm:table-cell" />
                  <SortTh label="Due" sortKey="due" sort={sort} onSort={onSort} />
                  <SortTh label="Priority" sortKey="priority" sort={sort} onSort={onSort} className="hidden lg:table-cell" />
                  <SortTh label="Status" sortKey="status" sort={sort} onSort={onSort} />
                  <Th className="w-10"><span className="sr-only">Actions</span></Th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map((t) => {
                  const a = db.animals.find((x) => x.id === t.animalId);
                  const c = db.cases.find((x) => x.id === t.caseId);
                  const ds = taskDisplayStatus(t);
                  return (
                    <Tr key={t.id} onClick={() => setParam("open", t.id)}>
                      <Td onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={t.status === "Completed"} disabled={!canUpdateTask(user, t)}
                          onChange={(e) => changeStatus(t, e.target.checked ? "Completed" : "To Do")}
                          className="h-4 w-4 cursor-pointer accent-[#167D83] disabled:cursor-not-allowed" aria-label={`Mark "${t.title}" ${t.status === "Completed" ? "not done" : "complete"}`} />
                      </Td>
                      <Td>
                        <p className={cn("font-medium", t.status === "Completed" && "text-ink-muted line-through")}>{t.title}</p>
                        <p className="text-xs text-ink-muted">{t.id} · {t.category}</p>
                      </Td>
                      <Td className="hidden md:table-cell">
                        {a ? <span className="flex items-center gap-1.5">{c && <TokenChip token={c.token} />}<span className="text-sm">{a.name}</span></span> : <span className="text-ink-muted">General</span>}
                      </Td>
                      <Td className="hidden sm:table-cell"><StaffChip id={t.assigneeId} /></Td>
                      <Td className={cn("whitespace-nowrap text-[13px] tabular-nums", ds === "Overdue" ? "font-medium text-danger-ink" : "text-ink-muted")}>
                        {t.dueDate === format(new Date(), "yyyy-MM-dd") ? "Today" : format(new Date(`${t.dueDate}T00:00:00`), "d MMM")}, {fmtClock(t.dueTime)}
                      </Td>
                      <Td className="hidden lg:table-cell"><PriorityBadge priority={t.priority} /></Td>
                      <Td><TaskStatusBadge status={ds} /></Td>
                      <Td onClick={(e) => e.stopPropagation()}>{rowMenu(t)}</Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination {...page} />
          </>
        ) : (
          <Board tasks={sorted} onOpen={(id) => setParam("open", id)} onMove={changeStatus} menu={rowMenu} />
        )}
      </Card>

      {viewing && <TaskDetail task={viewing} onClose={() => setParam("open", null)} onDelete={() => setToDelete(viewing)} onStatus={(s) => changeStatus(viewing, s)} />}
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Delete task?" destructive confirmLabel="Delete task"
        description={`"${toDelete?.title}" will be removed for everyone. This cannot be undone.`}
        onConfirm={() => { if (toDelete) { deleteTask(toDelete.id); toast.success("Task deleted"); if (openId === toDelete.id) setParam("open", null); setToDelete(null); } }} />
    </>
  );
}

function Board({ tasks, onOpen, onMove, menu }: { tasks: Task[]; onOpen: (id: string) => void; onMove: (t: Task, s: TaskStatus) => void; menu: (t: Task) => ReactNode }) {
  const { db } = useStore();
  const [over, setOver] = useState<TaskStatus | null>(null);
  return (
    <div className="grid gap-3 p-3 md:grid-cols-3">
      {TASK_STATUSES.map((col) => {
        const list = tasks.filter((t) => t.status === col);
        return (
          <section
            key={col}
            aria-label={`${col} column`}
            onDragOver={(e) => { e.preventDefault(); setOver(col); }}
            onDragLeave={() => setOver((o) => (o === col ? null : o))}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const t = db.tasks.find((x) => x.id === e.dataTransfer.getData("text/plain"));
              if (t && t.status !== col) onMove(t, col);
            }}
            className={cn("flex min-h-[320px] flex-col rounded-lg border bg-[#F8FAFB] transition-colors", over === col ? "border-teal bg-teal-soft/50" : "border-line")}
          >
            <header className="flex items-center justify-between px-3 py-2.5">
              <h3 className="flex items-center gap-2 text-[13px] font-semibold">
                <span className={cn("h-2 w-2 rounded-full", col === "To Do" ? "bg-[#A0AEC0]" : col === "In Progress" ? "bg-teal" : "bg-success")} aria-hidden />
                {col}
              </h3>
              <span className="rounded-full bg-white px-2 text-xs font-medium text-ink-muted">{list.length}</span>
            </header>
            <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
              {list.map((t) => {
                const a = db.animals.find((x) => x.id === t.animalId);
                const ds = taskDisplayStatus(t);
                return (
                  <li
                    key={t.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", t.id)}
                    className={cn("cursor-grab rounded-md border bg-white p-3 shadow-card active:cursor-grabbing", ds === "Overdue" ? "border-danger/30" : "border-line")}
                  >
                    <div className="flex items-start gap-2">
                      <button type="button" onClick={() => onOpen(t.id)} className={cn("flex-1 rounded text-left text-sm font-medium leading-snug hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal", t.status === "Completed" && "text-ink-muted line-through")}>
                        {t.title}
                      </button>
                      {menu(t)}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-muted">
                      <span className="rounded bg-canvas px-1.5 py-0.5">{t.category}</span>
                      {a && <span className="rounded bg-[#EEF3F6] px-1.5 py-0.5 font-medium text-navy">#{a.token} {a.name}</span>}
                      {ds === "Overdue" && <span className="rounded bg-danger-soft px-1.5 py-0.5 font-medium text-danger-ink">Overdue</span>}
                    </div>
                    <div className="mt-2.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-ink-muted"><Avatar id={t.assigneeId} name={staffName(db, t.assigneeId)} size="xs" />{staffName(db, t.assigneeId)}</span>
                      <span className={cn("text-xs tabular-nums", ds === "Overdue" ? "font-medium text-danger-ink" : "text-ink-muted")}>{format(new Date(`${t.dueDate}T00:00:00`), "d MMM")} · {fmtClock(t.dueTime)}</span>
                    </div>
                  </li>
                );
              })}
              {list.length === 0 && <li className="flex flex-1 items-center justify-center rounded-md border border-dashed border-line p-6 text-center text-xs text-ink-muted">Drag tasks here</li>}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TaskDetail({ task: t, onClose, onDelete, onStatus }: { task: Task; onClose: () => void; onDelete: () => void; onStatus: (s: TaskStatus) => void }) {
  const { db, user } = useStore();
  const { open } = useDialogs();
  const a = db.animals.find((x) => x.id === t.animalId);
  const c = db.cases.find((x) => x.id === t.caseId);
  const allowed = canUpdateTask(user, t);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title={t.title} description={`${t.id} · ${t.category}`}
      footer={<>
        {can(user, "task.delete") && <Button variant="danger-outline" onClick={onDelete}><Trash2 /> Delete</Button>}
        <span className="flex-1" />
        {can(user, "task.editAny") && <Button variant="outline" onClick={() => { onClose(); open({ kind: "task", task: t }); }}><Pencil /> Edit</Button>}
        {allowed && t.status !== "Completed" && <Button onClick={() => onStatus("Completed")}>Mark complete</Button>}
        {allowed && t.status === "Completed" && <Button variant="outline" onClick={() => onStatus("To Do")}>Reopen</Button>}
      </>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <TaskStatusBadge status={taskDisplayStatus(t)} />
          <PriorityBadge priority={t.priority} />
        </div>
        {t.description && <p className="text-sm leading-relaxed">{t.description}</p>}
        <dl className="grid grid-cols-2 gap-4">
          <KeyValue label="Assigned to"><StaffChip id={t.assigneeId} /></KeyValue>
          <KeyValue label="Due">{format(new Date(`${t.dueDate}T00:00:00`), "EEE d MMM yyyy")}, {fmtClock(t.dueTime)}</KeyValue>
          <KeyValue label="Animal">{a ? <Link to={`/animals/${a.id}`} className="text-teal hover:underline">{a.name} (token {a.token})</Link> : "General task"}</KeyValue>
          <KeyValue label="Case">{c ? <Link to={`/cases/${c.id}`} className="text-teal hover:underline">{c.id}</Link> : "—"}</KeyValue>
          <KeyValue label="Created">{staffName(db, t.createdBy)} · {fmtDateTime(t.createdAt)}</KeyValue>
          <KeyValue label="Completed">{t.completedAt ? `${staffName(db, t.completedBy)} · ${fmtDateTime(t.completedAt)}` : "—"}</KeyValue>
        </dl>
        {allowed && t.status !== "Completed" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-ink-muted">Move to:</span>
            {TASK_STATUSES.filter((s) => s !== t.status).map((s) => <Button key={s} size="sm" variant="outline" onClick={() => onStatus(s)}>{s}</Button>)}
          </div>
        )}
        {!allowed && <p className="rounded-md bg-canvas px-3 py-2 text-xs text-ink-muted">Only {staffName(db, t.assigneeId)}, a doctor or the manager can update this task.</p>}
      </div>
    </Dialog>
  );
}
