import { Link, useParams } from "react-router-dom";
import { addDays, format, parseISO } from "date-fns";
import { Activity, CalendarDays, ClipboardList, FolderHeart, Mail, Pencil, Phone, Plus } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { can, canUpdateTask, ROLE_SUMMARY } from "@/lib/permissions";
import { SHIFT_HOURS } from "@/lib/types";
import { cn, fmtDate, fmtSmart, isActiveCase, taskDisplayStatus } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, EmptyState, TokenChip } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { CaseStatusBadge, TaskStatusBadge } from "@/components/domain";
import { useDialogs } from "@/components/forms/DialogsProvider";
import NotFoundPage from "./NotFound";

export default function StaffProfilePage() {
  const { id } = useParams();
  const { db, user, setTaskStatus } = useStore();
  const { open } = useDialogs();
  const s = db.staff.find((x) => x.id === id);
  if (!s) return <NotFoundPage what="staff member" />;

  const cases = db.cases.filter((c) => isActiveCase(c) && (c.responsibleId === s.id || c.doctorId === s.id)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const tasks = db.tasks.filter((t) => t.assigneeId === s.id).sort((a, b) => Number(a.status === "Completed") - Number(b.status === "Completed") || `${a.dueDate}${a.dueTime}`.localeCompare(`${b.dueDate}${b.dueTime}`));
  const openTasks = tasks.filter((t) => t.status !== "Completed");
  const today = format(new Date(), "yyyy-MM-dd");
  const weekEnd = format(addDays(new Date(), 6), "yyyy-MM-dd");
  const duties = db.dutySchedules.filter((d) => d.staffId === s.id && d.date >= today && d.date <= weekEnd).sort((a, b) => a.date.localeCompare(b.date));
  const activity = db.activityLogs.filter((l) => l.staffId === s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar id={s.id} name={s.name} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{s.name}</h1>
              <Badge tone={s.active ? "success" : "neutral"}>{s.active ? "Active" : "Deactivated"}</Badge>
            </div>
            <p className="text-sm text-ink-muted">{s.role} · {s.id} · joined {fmtDate(s.joinedAt)}</p>
            <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 text-ink-muted" aria-hidden />{s.phone}</span>
              <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-ink-muted" aria-hidden />{s.email}</span>
            </div>
            <p className="mt-3 text-xs text-ink-muted"><span className="font-medium text-ink">Access: </span>{ROLE_SUMMARY[s.role].join(" · ")}</p>
          </div>
          <div className="flex gap-2">
            {can(user, "task.assign") && <Button variant="outline" size="sm" onClick={() => open({ kind: "task", defaults: { assigneeId: s.id } })}><Plus /> Assign task</Button>}
            {can(user, "staff.manage") && <Button variant="outline" size="sm" onClick={() => open({ kind: "staff", staff: s })}><Pencil /> Edit</Button>}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3 border-t border-line pt-4">
          {[["Active cases", cases.length], ["Open tasks", openTasks.length], ["Overdue", openTasks.filter((t) => taskDisplayStatus(t) === "Overdue").length]].map(([l, n]) => (
            <div key={l as string}><p className="text-xs text-ink-muted">{l}</p><p className={cn("text-xl font-semibold tabular-nums", l === "Overdue" && (n as number) > 0 && "text-danger-ink")}>{n}</p></div>
          ))}
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Active cases" description="Responsible for, or assigned doctor on" icon={FolderHeart} />
          {cases.length === 0 ? <EmptyState icon={FolderHeart} title="No active cases" className="py-8" /> : (
            <ul className="divide-y divide-line">
              {cases.map((c) => {
                const a = db.animals.find((x) => x.id === c.animalId);
                return (
                  <li key={c.id}>
                    <Link to={`/cases/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFB]">
                      <TokenChip token={c.token} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{a?.name} <span className="text-xs font-normal text-ink-muted">· {c.responsibleId === s.id ? "responsible" : "doctor"}</span></p>
                        <p className="truncate text-xs text-ink-muted">Next: {c.nextAction}</p>
                      </div>
                      <CaseStatusBadge status={c.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Assigned tasks" icon={ClipboardList} action={<Button variant="ghost" size="sm" asChild><Link to={`/tasks?assignee=${s.id}`}>View all</Link></Button>} />
          {tasks.length === 0 ? <EmptyState icon={ClipboardList} title="No tasks assigned" className="py-8" /> : (
            <ul className="max-h-[360px] divide-y divide-line overflow-y-auto">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                  <input type="checkbox" checked={t.status === "Completed"} disabled={!canUpdateTask(user, t)}
                    onChange={(e) => { setTaskStatus(t.id, e.target.checked ? "Completed" : "To Do"); if (e.target.checked) toast.success("Task completed"); }}
                    className="h-4 w-4 cursor-pointer accent-[#167D83] disabled:cursor-not-allowed" aria-label={`Complete "${t.title}"`} />
                  <div className="min-w-0 flex-1">
                    <Link to={`/tasks?open=${t.id}`} className={cn("block truncate text-sm font-medium hover:text-teal", t.status === "Completed" && "text-ink-muted line-through")}>{t.title}</Link>
                    <p className="text-xs text-ink-muted">{t.category} · {t.dueDate === today ? "Today" : t.dueDate} {t.dueTime}</p>
                  </div>
                  <TaskStatusBadge status={taskDisplayStatus(t)} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Duties this week" icon={CalendarDays} action={<Button variant="ghost" size="sm" asChild><Link to="/schedule">Schedule</Link></Button>} />
          {duties.length === 0 ? <EmptyState icon={CalendarDays} title="No duties in the next 7 days" className="py-8" /> : (
            <ul className="divide-y divide-line">
              {duties.map((d) => (
                <li key={d.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span className="w-24 shrink-0 font-medium">{d.date === today ? "Today" : format(parseISO(d.date), "EEE d MMM")}</span>
                  <span className="flex-1">{d.duty}</span>
                  <span className="text-xs text-ink-muted">{d.shift} · {SHIFT_HOURS[d.shift]}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent activity" icon={Activity} action={<Button variant="ghost" size="sm" asChild><Link to={`/activity?staff=${s.id}`}>Full log</Link></Button>} />
          {activity.length === 0 ? <EmptyState icon={Activity} title="No recorded activity" className="py-8" /> : (
            <ul className="divide-y divide-line">
              {activity.map((l) => (
                <li key={l.id} className="px-4 py-2.5">
                  <p className="text-[13px]"><span className="font-medium">{l.action}</span> <span className="text-xs text-ink-muted">· {fmtSmart(l.createdAt)}</span></p>
                  <p className="truncate text-[13px] text-ink-muted">{l.description}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
