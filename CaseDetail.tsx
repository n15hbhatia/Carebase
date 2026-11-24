import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { CalendarClock, ChevronDown, ClipboardList, FolderHeart, History, Plus, Repeat2, Scissors, Stethoscope, UserCog } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { can, canUpdateTask } from "@/lib/permissions";
import { CASE_STATUSES } from "@/lib/types";
import { cn, fmtDate, fmtSmart, staffName, taskDisplayStatus } from "@/lib/utils";
import { Avatar, Card, CardHeader, EmptyState, KeyValue, TokenChip } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuTrigger } from "@/components/ui/menu";
import { AnimalAvatar, CaseStatusBadge, PriorityBadge, StaffChip, StaffOptions, TaskStatusBadge } from "@/components/domain";
import { CareStatusCard, CareTimeline } from "@/components/care";
import { useDialogs } from "@/components/forms/DialogsProvider";
import NotFoundPage from "./NotFound";

export default function CaseDetailPage() {
  const { id } = useParams();
  const { db, user, setTaskStatus } = useStore();
  const { open } = useDialogs();
  const [assignOpen, setAssignOpen] = useState(false);
  const c = db.cases.find((x) => x.id === id);
  if (!c) return <NotFoundPage what="case" />;
  const a = db.animals.find((x) => x.id === c.animalId)!;
  const tasks = db.tasks.filter((t) => t.caseId === c.id).sort((x, y) => Number(x.status === "Completed") - Number(y.status === "Completed") || `${x.dueDate}${x.dueTime}`.localeCompare(`${y.dueDate}${y.dueTime}`));
  const handovers = db.handovers.filter((h) => h.caseId === c.id).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const otherCases = db.cases.filter((x) => x.animalId === a.id && x.id !== c.id).sort((x, y) => y.openedAt.localeCompare(x.openedAt));
  const closed = c.status === "Completed";

  return (
    <div className="space-y-5">
      {/* A. Case header */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-4">
          <AnimalAvatar animal={a} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{a.name}</h1>
              <CaseStatusBadge status={c.status} />
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">
              <span className="font-mono">{c.id}</span> · {a.type}{a.breed ? `, ${a.breed}` : ""} · {c.reason}
            </p>
            <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
              <KeyValue label="Assigned doctor"><StaffChip id={c.doctorId} /></KeyValue>
              <KeyValue label="Responsible staff"><StaffChip id={c.responsibleId} /></KeyValue>
              <KeyValue label="Opened">{fmtSmart(c.openedAt)}</KeyValue>
              {c.closedAt && <KeyValue label="Completed">{fmtSmart(c.closedAt)}</KeyValue>}
            </dl>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Token</p>
              <TokenChip token={c.token} size="lg" />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              {can(user, "case.status") && (
                <MenuRoot>
                  <MenuTrigger asChild><Button variant="outline" size="sm">Update status <ChevronDown /></Button></MenuTrigger>
                  <MenuContent className="w-60">
                    <MenuLabel>Move case to…</MenuLabel>
                    {CASE_STATUSES.map((s) => (
                      <MenuItem key={s} disabled={s === c.status} onSelect={() => open({ kind: "careUpdate", caseId: c.id, preset: { type: "Status Change", status: s } })}>
                        <span className={cn("h-2 w-2 rounded-full", s === c.status ? "bg-teal" : "bg-line")} aria-hidden />
                        {s}{s === c.status && <span className="ml-auto text-[11px] text-ink-muted">current</span>}
                      </MenuItem>
                    ))}
                  </MenuContent>
                </MenuRoot>
              )}
              {can(user, "case.status") && <Button variant="outline" size="sm" onClick={() => setAssignOpen(true)}><UserCog /> Assign</Button>}
              {can(user, "case.surgery") && !closed && <Button variant="outline" size="sm" onClick={() => open({ kind: "surgery", caseId: c.id })}><Scissors /> {c.surgeryAt && c.surgeryStatus !== "Completed" ? "Surgery" : "Schedule surgery"}</Button>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-5">
          {/* B. Care Status Card */}
          <CareStatusCard c={c} />

          {/* C. Care Journey Timeline */}
          <Card>
            <CardHeader title="Care journey" description="Everything that has happened on this case, with who did it and when" icon={History}
              action={can(user, "case.careUpdate") && !closed ? <Button size="sm" variant="soft" onClick={() => open({ kind: "careUpdate", caseId: c.id })}><Plus /> Care update</Button> : undefined} />
            <div className="px-4 pb-1 pt-2"><CareTimeline c={c} /></div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Case details" icon={FolderHeart} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 p-4">
              <KeyValue label="Animal" className="col-span-2">
                <Link to={`/animals/${a.id}`} className="text-teal hover:underline">{a.name}</Link>
                <span className="font-normal text-ink-muted"> · {a.sex}, {a.age || "age unknown"}</span>
              </KeyValue>
              <KeyValue label="Reason for admission" className="col-span-2">{c.reason}</KeyValue>
              <KeyValue label="Owner">{a.ownerName || "Stray / none"}</KeyValue>
              <KeyValue label="Contact">{a.contactNumber || "—"}</KeyValue>
              {c.surgeryAt && (
                <KeyValue label="Surgery" className="col-span-2">
                  <span className="flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-ink-muted" aria-hidden />
                    {c.surgeryProcedure} · {format(parseISO(c.surgeryAt), "EEE d MMM, h:mm a")} · <span className="text-ink-muted">{c.surgeryStatus}</span></span>
                </KeyValue>
              )}
              {a.notes && <KeyValue label="Notes" className="col-span-2"><span className="font-normal">{a.notes}</span></KeyValue>}
            </dl>
          </Card>

          {/* E. Associated tasks */}
          <Card>
            <CardHeader title="Tasks" description={`${tasks.filter((t) => t.status !== "Completed").length} open`} icon={ClipboardList}
              action={<Button size="sm" variant="ghost" onClick={() => open({ kind: "task", defaults: { caseId: c.id, animalId: c.animalId } })}><Plus /> Add</Button>} />
            {tasks.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No tasks on this case" className="py-8" />
            ) : (
              <ul className="divide-y divide-line">
                {tasks.map((t) => {
                  const allowed = canUpdateTask(user, t);
                  return (
                    <li key={t.id} className="flex items-start gap-3 px-4 py-2.5">
                      <input type="checkbox" checked={t.status === "Completed"} disabled={!allowed}
                        onChange={(e) => { setTaskStatus(t.id, e.target.checked ? "Completed" : "To Do"); if (e.target.checked) toast.success("Task completed"); }}
                        className="mt-0.5 h-4 w-4 cursor-pointer accent-[#167D83] disabled:cursor-not-allowed" aria-label={`Complete "${t.title}"`} />
                      <div className="min-w-0 flex-1">
                        <Link to={`/tasks?open=${t.id}`} className={cn("block text-sm font-medium hover:text-teal", t.status === "Completed" && "text-ink-muted line-through")}>{t.title}</Link>
                        <p className="text-xs text-ink-muted">{staffName(db, t.assigneeId)} · {fmtDate(`${t.dueDate}T00:00:00`)} {t.dueTime}</p>
                      </div>
                      <TaskStatusBadge status={taskDisplayStatus(t)} />
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* F. Handover history */}
          <Card>
            <CardHeader title="Handover history" icon={Repeat2}
              action={can(user, "handover.create") && !closed ? <Button size="sm" variant="ghost" onClick={() => open({ kind: "handover", caseId: c.id })}><Plus /> New</Button> : undefined} />
            {handovers.length === 0 ? (
              <EmptyState icon={Repeat2} title="No handovers yet" className="py-8" />
            ) : (
              <ul className="divide-y divide-line">
                {handovers.map((h) => (
                  <li key={h.id}>
                    <Link to={`/handovers?open=${h.id}`} className="block px-4 py-3 hover:bg-[#F8FAFB]">
                      <div className="flex items-center gap-2 text-sm">
                        <Avatar id={h.fromId} name={staffName(db, h.fromId)} size="xs" />
                        <span className="font-medium">{staffName(db, h.fromId).split(" ").slice(-2).join(" ")}</span>
                        <span className="text-ink-muted">→</span>
                        <Avatar id={h.toId} name={staffName(db, h.toId)} size="xs" />
                        <span className="font-medium">{staffName(db, h.toId).split(" ").slice(-2).join(" ")}</span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-[13px] text-ink-muted">{h.summary}</p>
                      <p className="mt-1.5 flex items-center gap-2 text-xs">
                        <span className={cn("rounded-full px-2 py-0.5 font-medium", h.status === "Pending" ? "bg-warning-soft text-warning-ink" : "bg-success-soft text-success")}>
                          {h.status === "Pending" ? "Awaiting acknowledgement" : `Acknowledged ${fmtSmart(h.acknowledgedAt)}`}
                        </span>
                        <span className="text-ink-muted">{fmtSmart(h.createdAt)}</span>
                        <PriorityBadge priority={h.priority} />
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {otherCases.length > 0 && (
            <Card>
              <CardHeader title={`Other cases for ${a.name}`} icon={Stethoscope} />
              <ul className="divide-y divide-line">
                {otherCases.map((o) => (
                  <li key={o.id}>
                    <Link to={`/cases/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFB]">
                      <TokenChip token={o.token} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{o.id} · {o.reason}</p>
                        <p className="text-xs text-ink-muted">Opened {fmtDate(o.openedAt)}</p>
                      </div>
                      <CaseStatusBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {assignOpen && <AssignDialog caseId={c.id} onClose={() => setAssignOpen(false)} />}
    </div>
  );
}

function AssignDialog({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const { db, updateCaseAssignment } = useStore();
  const c = db.cases.find((x) => x.id === caseId)!;
  const [doctorId, setDoctorId] = useState(c.doctorId ?? "");
  const [responsibleId, setResponsibleId] = useState(c.responsibleId ?? "");
  const [reason, setReason] = useState(c.reason);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="sm" title="Assign case" description={`${c.id} · token ${c.token}`}
      footer={<>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" form="assign-form">Save</Button>
      </>}>
      <form id="assign-form" className="grid gap-4" onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim().length < 3) { toast.error("Reason must be at least 3 characters"); return; }
        updateCaseAssignment(caseId, { doctorId, responsibleId, reason: reason.trim() });
        toast.success("Case assignment saved");
        onClose();
      }}>
        <Field id="as-doc" label="Assigned doctor"><Select id="as-doc" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}><StaffOptions roles={["Doctor"]} placeholder="Not assigned" /></Select></Field>
        <Field id="as-resp" label="Responsible staff" hint="To transfer responsibility with context, use a handover instead.">
          <Select id="as-resp" value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}><StaffOptions placeholder="Unassigned" /></Select>
        </Field>
        <Field id="as-reason" label="Reason for admission" required><Input id="as-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </form>
    </Dialog>
  );
}
