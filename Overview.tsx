import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format, isToday, parseISO, startOfDay } from "date-fns";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Activity, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, FolderHeart, PawPrint, Repeat2, Scissors, Users,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { can, canUpdateTask } from "@/lib/permissions";
import { CASE_STATUSES } from "@/lib/types";
import { cn, fmtClock, fmtSmart, isActiveCase, staffName, taskDisplayStatus, taskDueDate } from "@/lib/utils";
import { Avatar, Card, CardHeader, EmptyState, TokenChip } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AnimalAvatar, CaseStatusBadge, TaskStatusBadge } from "@/components/domain";
import { useDialogs } from "@/components/forms/DialogsProvider";
import { toast } from "sonner";

function firstName(n: string) {
  const parts = n.split(" ");
  return parts[0].startsWith("Dr") ? parts.slice(0, 2).join(" ") : parts[0];
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function OverviewPage() {
  const { db, user, setTaskStatus } = useStore();
  const navigate = useNavigate();
  const { open } = useDialogs();

  const stats = useMemo(() => {
    const active = db.cases.filter(isActiveCase);
    const admittedToday = db.cases.filter((c) => isToday(parseISO(c.openedAt)));
    const pendingTasks = db.tasks.filter((t) => t.status !== "Completed");
    const overdue = pendingTasks.filter((t) => taskDisplayStatus(t) === "Overdue");
    const pendingHo = db.handovers.filter((h) => h.status === "Pending");
    const awaitingCases = new Set(pendingHo.map((h) => h.caseId));
    return { active, admittedToday, pendingTasks, overdue, pendingHo, awaitingCases };
  }, [db]);

  const activeRows = [...stats.active].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const today = format(new Date(), "yyyy-MM-dd");
  const todaysTasks = db.tasks
    .filter((t) => t.dueDate === today || (t.status !== "Completed" && t.dueDate < today))
    .sort((a, b) => Number(a.status === "Completed") - Number(b.status === "Completed") || taskDueDate(a).getTime() - taskDueDate(b).getTime());

  const surgeries = db.cases
    .filter((c) => c.surgeryAt && c.surgeryStatus !== "Completed" && parseISO(c.surgeryAt) >= startOfDay(new Date()))
    .sort((a, b) => a.surgeryAt!.localeCompare(b.surgeryAt!));

  const recent = [...db.activityLogs].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8);
  const statusData = CASE_STATUSES.filter((s) => s !== "Completed").map((s) => ({ status: s, count: stats.active.filter((c) => c.status === s).length }));

  const kpis = [
    { label: "Active cases", value: stats.active.length, hint: `${db.cases.length - stats.active.length} completed`, icon: FolderHeart, to: "/cases?view=active", tone: "text-teal bg-teal-soft" },
    { label: "Animals admitted today", value: stats.admittedToday.length, hint: format(new Date(), "EEEE d MMM"), icon: PawPrint, to: "/animals?admitted=today", tone: "text-navy bg-[#E9EFF3]" },
    { label: "Pending tasks", value: stats.pendingTasks.length, hint: stats.overdue.length ? `${stats.overdue.length} overdue` : "None overdue", hintTone: stats.overdue.length ? "text-danger-ink" : undefined, icon: ClipboardList, to: "/tasks?status=pending", tone: "text-warning-ink bg-warning-soft" },
    { label: "Cases awaiting handover", value: stats.awaitingCases.size, hint: `${stats.pendingHo.length} unacknowledged`, icon: Repeat2, to: "/handovers?tab=pending", tone: "text-[#5B4A86] bg-[#F0ECF7]" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{greeting()}, {firstName(user?.name ?? "")}</h1>
          <p className="mt-0.5 text-sm text-ink-muted">Here's what's happening at the shelter today · {format(new Date(), "EEEE, d MMMM yyyy")}</p>
        </div>
        <div className="flex gap-2">
          {can(user, "handover.create") && <Button variant="outline" onClick={() => open({ kind: "handover" })}><Repeat2 /> New handover</Button>}
          {can(user, "animal.create") && <Button onClick={() => open({ kind: "animal" })}><PawPrint /> Admit animal</Button>}
        </div>
      </div>

      {/* Row 1: KPIs */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {kpis.map((k) => (
          <Link key={k.label} to={k.to} className="group rounded-lg border border-line bg-white p-4 shadow-card transition-colors hover:border-[#CFD9E1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[13px] font-medium text-ink-muted">{k.label}</p>
              <span className={cn("flex h-8 w-8 items-center justify-center rounded-md", k.tone)}><k.icon className="h-4 w-4" aria-hidden /></span>
            </div>
            <p className="mt-1 text-[28px] font-semibold leading-none tracking-tight tabular-nums">{k.value}</p>
            <p className="mt-2 flex items-center justify-between text-xs text-ink-muted">
              <span className={k.hintTone}>{k.hint}</span>
              <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </p>
          </Link>
        ))}
      </div>

      {/* Row 2 */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,65fr)_minmax(0,35fr)]">
        <Card>
          <CardHeader title="Active cases" description={`${stats.active.length} open · most recently updated first`} icon={FolderHeart}
            action={<Button variant="ghost" size="sm" asChild><Link to="/cases">View all <ArrowRight /></Link></Button>} />
          {activeRows.length === 0 ? (
            <EmptyState icon={FolderHeart} title="No active cases" description="When an animal is admitted, its case appears here." action={<Button onClick={() => open({ kind: "case" })}>Create case</Button>} />
          ) : (
            <div className="max-h-[440px] overflow-y-auto">
              <Table>
                <thead className="sticky top-0 z-10">
                  <tr><Th>Token</Th><Th>Animal</Th><Th className="hidden 2xl:table-cell">Type</Th><Th>Status</Th><Th className="hidden lg:table-cell">Doctor</Th><Th className="hidden md:table-cell">Next action</Th><Th className="text-right">Updated</Th></tr>
                </thead>
                <tbody>
                  {activeRows.map((c) => {
                    const a = db.animals.find((x) => x.id === c.animalId)!;
                    return (
                      <Tr key={c.id} onClick={() => navigate(`/cases/${c.id}`)}>
                        <Td><TokenChip token={c.token} /></Td>
                        <Td className="whitespace-nowrap">
                          <Link to={`/cases/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal rounded">{a?.name}</Link>
                          {stats.awaitingCases.has(c.id) && <Repeat2 className="ml-1.5 inline h-3.5 w-3.5 text-[#5B4A86]" aria-label="Handover awaiting acknowledgement" />}
                        </Td>
                        <Td className="hidden text-ink-muted 2xl:table-cell">{a?.type}</Td>
                        <Td><CaseStatusBadge status={c.status} /></Td>
                        <Td className="hidden whitespace-nowrap text-ink-muted lg:table-cell">{staffName(db, c.doctorId)}</Td>
                        <Td className="hidden max-w-[180px] truncate text-ink-muted md:table-cell" title={c.nextAction}>{c.nextAction}</Td>
                        <Td className="whitespace-nowrap text-right text-xs text-ink-muted">{fmtSmart(c.updatedAt)}</Td>
                      </Tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Today's tasks" description={`${todaysTasks.filter((t) => t.status === "Completed").length} of ${todaysTasks.length} done`} icon={ClipboardList}
            action={<Button variant="ghost" size="sm" asChild><Link to="/tasks">All tasks <ArrowRight /></Link></Button>} />
          {todaysTasks.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="Nothing due today" action={<Button variant="outline" onClick={() => open({ kind: "task" })}>Create task</Button>} />
          ) : (
            <ul className="max-h-[440px] divide-y divide-line overflow-y-auto">
              {todaysTasks.map((t) => {
                const ds = taskDisplayStatus(t);
                const allowed = canUpdateTask(user, t);
                const animal = db.animals.find((a) => a.id === t.animalId);
                const done = t.status === "Completed";
                return (
                  <li key={t.id} className="flex items-start gap-3 px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={done}
                      disabled={!allowed}
                      onChange={(e) => {
                        setTaskStatus(t.id, e.target.checked ? "Completed" : "To Do");
                        if (e.target.checked) toast.success("Task completed", { description: t.title });
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-[#167D83] disabled:cursor-not-allowed"
                      aria-label={`Mark "${t.title}" as ${done ? "not done" : "complete"}`}
                      title={allowed ? undefined : "Only the assignee or a manager/doctor can update this task"}
                    />
                    <div className="min-w-0 flex-1">
                      <Link to={`/tasks?open=${t.id}`} className={cn("block truncate text-sm font-medium hover:text-teal", done && "text-ink-muted line-through")}>{t.title}</Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                        <span className="tabular-nums">{t.dueDate === today ? fmtClock(t.dueTime) : `${t.dueDate.slice(5)} ${t.dueTime}`}</span>
                        {animal && <span>· {animal.name}</span>}
                        <span>· {staffName(db, t.assigneeId)}</span>
                      </p>
                    </div>
                    <TaskStatusBadge status={ds} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Row 3 */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming surgeries" description={`Surgery days: ${db.settings.surgeryDays.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}`} icon={Scissors}
            action={<Button variant="ghost" size="sm" asChild><Link to="/schedule">Schedule <ArrowRight /></Link></Button>} />
          {surgeries.length === 0 ? (
            <EmptyState icon={CalendarClock} title="No surgeries scheduled" description="Schedule one from a case's page." />
          ) : (
            <ul className="divide-y divide-line">
              {surgeries.map((c) => {
                const a = db.animals.find((x) => x.id === c.animalId)!;
                const d = parseISO(c.surgeryAt!);
                return (
                  <li key={c.id}>
                    <Link to={`/cases/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-[#F8FAFB] focus-visible:bg-[#F8FAFB] focus-visible:outline-none">
                      <div className="w-14 shrink-0 rounded-md border border-line py-1 text-center">
                        <p className="text-[10px] font-semibold uppercase text-ink-muted">{format(d, "EEE")}</p>
                        <p className="text-base font-semibold leading-tight tabular-nums">{format(d, "d")}</p>
                      </div>
                      <AnimalAvatar animal={a} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium">{a.name} <TokenChip token={c.token} /></p>
                        <p className="truncate text-xs text-ink-muted">{c.surgeryProcedure} · {format(d, "h:mm a")} · {staffName(db, c.doctorId)}</p>
                      </div>
                      <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", c.surgeryStatus === "Postponed" ? "bg-warning-soft text-warning-ink" : c.surgeryStatus === "In Progress" ? "bg-teal-soft text-teal" : "bg-[#F0ECF7] text-[#5B4A86]")}>
                        {isToday(d) ? "Today" : c.surgeryStatus}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Recent activity" icon={Activity} action={<Button variant="ghost" size="sm" asChild><Link to="/activity">Activity log <ArrowRight /></Link></Button>} />
          <ol className="px-4 py-2">
            {recent.map((l, i) => (
              <li key={l.id} className="relative flex gap-3 py-2">
                {i < recent.length - 1 && <span className="absolute left-[11px] top-8 h-[calc(100%-20px)] w-px bg-line" aria-hidden />}
                <Avatar id={l.staffId} name={staffName(db, l.staffId)} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug">
                    <span className="font-medium">{staffName(db, l.staffId)}</span>{" "}
                    <span className="text-ink-muted">· {l.action}</span>
                  </p>
                  <p className="truncate text-[13px] text-ink-muted" title={l.description}>
                    {l.caseId ? <Link to={`/cases/${l.caseId}`} className="hover:text-teal">{l.description}</Link> : l.description}
                  </p>
                </div>
                <time className="shrink-0 whitespace-nowrap text-[11px] text-ink-muted" dateTime={l.createdAt}>{fmtSmart(l.createdAt)}</time>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      {/* Row 4 */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader title="Staff overview" description={`${db.staff.filter((s) => s.active).length} active staff`} icon={Users}
            action={<Button variant="ghost" size="sm" asChild><Link to="/staff">Manage <ArrowRight /></Link></Button>} />
          <ul className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
            {db.staff.filter((s) => s.active).map((s) => {
              const open = db.tasks.filter((t) => t.assigneeId === s.id && t.status !== "Completed").length;
              const cases = db.cases.filter((c) => isActiveCase(c) && c.responsibleId === s.id).length;
              return (
                <li key={s.id} className="bg-white">
                  <Link to={`/staff/${s.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFB] focus-visible:bg-[#F8FAFB] focus-visible:outline-none">
                    <Avatar id={s.id} name={s.name} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{s.name}</p>
                      <p className="text-xs text-ink-muted">{s.role}</p>
                    </div>
                    <div className="text-right text-[11px] leading-tight text-ink-muted">
                      <p><span className="font-semibold text-ink tabular-nums">{cases}</span> cases</p>
                      <p><span className="font-semibold text-ink tabular-nums">{open}</span> tasks</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Active cases by status" description="Where each open case sits in the care journey" icon={FolderHeart} />
          <div className="h-[280px] px-2 py-3" role="img" aria-label={`Bar chart of active cases by status: ${statusData.map((d) => `${d.status} ${d.count}`).join(", ")}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }} barCategoryGap={6}>
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis type="category" dataKey="status" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#4A5A68" }} />
                <Tooltip cursor={{ fill: "#F1F5F8" }} contentStyle={{ borderRadius: 8, border: "1px solid #E4E9EE", fontSize: 12 }} formatter={(v) => [`${v} case${Number(v) === 1 ? "" : "s"}`, "Active"]} />
                <Bar dataKey="count" fill="#167D83" radius={[0, 4, 4, 0]} maxBarSize={14} label={{ position: "right", fontSize: 11, fill: "#172B3A" }}
                  onClick={(d) => { const st = (d as unknown as { payload?: { status?: string } }).payload?.status; if (st) navigate(`/cases?status=${encodeURIComponent(st)}`); }} cursor="pointer" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
