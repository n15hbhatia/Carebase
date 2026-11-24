import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { differenceInHours, format, parseISO } from "date-fns";
import {
  ArrowDownUp, CheckCircle2, ClipboardCheck, Clock, FilePlus2, Flag, HandHelping, Repeat2, Scissors, Stethoscope, Tag, UserCheck,
  type LucideIcon,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { Case, UpdateType } from "@/lib/types";
import { CASE_STATUS_TONE, cn, fmtAgo, fmtDateTime, staffById, staffName, TONE_CLASSES } from "@/lib/utils";
import { can } from "@/lib/permissions";
import { Avatar, TokenChip } from "./ui/misc";
import { Button } from "./ui/button";
import { CaseStatusBadge } from "./domain";
import { useDialogs } from "./forms/DialogsProvider";

/** The Care Status Card: everything a colleague needs to take over this case. */
export function CareStatusCard({ c, compact }: { c: Case; compact?: boolean }) {
  const { db, user } = useStore();
  const { open } = useDialogs();
  const responsible = staffById(db, c.responsibleId);
  const pending = db.handovers.find((h) => h.caseId === c.id && h.status === "Pending");
  const stale = c.status !== "Completed" && differenceInHours(new Date(), parseISO(c.updatedAt)) >= 12;
  const tone = TONE_CLASSES[CASE_STATUS_TONE[c.status]];
  const closed = c.status === "Completed";

  return (
    <section aria-label="Care Status Card" className="overflow-hidden rounded-lg border border-navy/20 bg-white shadow-card">
      <div className="flex items-center justify-between gap-3 bg-navy px-4 py-2.5 text-white">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-[#9ED3D2]" aria-hidden />
          <h2 className="text-[13px] font-semibold uppercase tracking-wider">Care Status Card</h2>
        </div>
        <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-xs font-semibold" aria-label={`Token ${c.token}`}>TOKEN {c.token}</span>
      </div>

      <dl className={cn("grid divide-line", compact ? "grid-cols-1 divide-y" : "sm:grid-cols-2 sm:divide-x")}>
        <div className="p-4">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Current status</dt>
          <dd className="mt-1.5 flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", tone.dot)} aria-hidden />
            <span className="text-lg font-semibold leading-tight text-ink">{c.status}</span>
          </dd>
        </div>
        <div className={cn("p-4", !compact && "border-t border-line sm:border-t-0")}>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Last action</dt>
          <dd className="mt-1.5 text-sm font-medium leading-snug text-ink">{c.lastAction || "—"}</dd>
        </div>
      </dl>

      <div className="border-y border-teal/20 bg-teal-soft px-4 py-3.5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-teal">Next action</p>
        <p className="mt-1 text-base font-semibold leading-snug text-ink">{closed ? "No further action — case completed" : c.nextAction}</p>
      </div>

      <dl className={cn("grid divide-line", compact ? "grid-cols-1 divide-y" : "sm:grid-cols-2 sm:divide-x")}>
        <div className="p-4">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Responsible person</dt>
          <dd className="mt-2 flex items-center gap-2.5">
            {responsible ? (
              <>
                <Avatar id={responsible.id} name={responsible.name} />
                <div className="min-w-0">
                  <Link to={`/staff/${responsible.id}`} className="block truncate text-sm font-semibold text-ink hover:text-teal">{responsible.name}</Link>
                  <p className="text-xs text-ink-muted">{responsible.role}{responsible.id === user?.id ? " · you" : ""}</p>
                </div>
              </>
            ) : (
              <span className="text-sm text-ink-muted">Unassigned</span>
            )}
          </dd>
        </div>
        <div className={cn("p-4", !compact && "border-t border-line sm:border-t-0")}>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Last updated</dt>
          <dd className="mt-2">
            <p className="text-sm font-semibold text-ink"><time dateTime={c.updatedAt}>{fmtDateTime(c.updatedAt)}</time></p>
            <p className={cn("mt-0.5 flex items-center gap-1 text-xs", stale ? "text-warning-ink" : "text-ink-muted")}>
              <Clock className="h-3 w-3" aria-hidden /> {fmtAgo(c.updatedAt)}{stale ? " · may need an update" : ""}
            </p>
          </dd>
        </div>
      </dl>

      {pending && (
        <div className="flex flex-wrap items-center gap-2 border-t border-warning/30 bg-warning-soft px-4 py-2.5 text-[13px] text-warning-ink">
          <Repeat2 className="h-4 w-4" aria-hidden />
          <span className="flex-1">
            Handover to <strong>{staffName(db, pending.toId)}</strong> awaiting acknowledgement since {format(parseISO(pending.createdAt), "h:mm a")}.
          </span>
          <Link to={`/handovers?open=${pending.id}`} className="font-semibold underline-offset-2 hover:underline">{pending.toId === user?.id ? "Review & acknowledge" : "View handover"}</Link>
        </div>
      )}

      {!closed && (
        <div className="flex flex-wrap gap-2 border-t border-line bg-[#FAFBFC] px-4 py-3">
          {can(user, "case.careUpdate") && <Button size="sm" onClick={() => open({ kind: "careUpdate", caseId: c.id })}><FilePlus2 /> Add care update</Button>}
          {can(user, "handover.create") && !pending && <Button size="sm" variant="outline" onClick={() => open({ kind: "handover", caseId: c.id })}><Repeat2 /> Hand over</Button>}
          <Button size="sm" variant="ghost" onClick={() => open({ kind: "task", defaults: { caseId: c.id, animalId: c.animalId } })}><ClipboardCheck /> Add task</Button>
        </div>
      )}
    </section>
  );
}

const TYPE_ICON: Partial<Record<UpdateType | "Acknowledged" | "Task", LucideIcon>> = {
  Admission: FilePlus2, "Token Issued": Tag, Assessment: Stethoscope, "Care Plan": ClipboardCheck, Treatment: HandHelping,
  Medication: HandHelping, Surgery: Scissors, Observation: Stethoscope, Feeding: HandHelping, "Status Change": Flag,
  Handover: Repeat2, "General Note": FilePlus2, Acknowledged: UserCheck, Task: CheckCircle2,
};

interface TimelineEvent {
  id: string;
  at: string;
  kind: UpdateType | "Acknowledged" | "Task";
  title: string;
  body?: string;
  by: string;
  status?: Case["status"];
  next?: string;
  responsibleId?: string;
}

export function CareTimeline({ c }: { c: Case }) {
  const { db } = useStore();
  const [newestFirst, setNewestFirst] = useState(false);
  const events = useMemo(() => {
    const ev: TimelineEvent[] = db.careUpdates
      .filter((u) => u.caseId === c.id)
      .map((u) => ({
        id: u.id, at: u.createdAt, kind: u.type, title: u.type === "Handover" ? "Handover created" : u.type,
        body: u.description, by: u.createdBy, status: u.status, next: u.nextAction, responsibleId: u.responsibleId,
      }));
    db.handovers
      .filter((h) => h.caseId === c.id && h.acknowledgedAt)
      .forEach((h) => ev.push({ id: `${h.id}-ack`, at: h.acknowledgedAt!, kind: "Acknowledged", title: "Handover acknowledged", body: `${staffName(db, h.toId)} accepted responsibility (${h.id}).`, by: h.toId }));
    db.tasks
      .filter((t) => t.caseId === c.id && t.completedAt)
      .forEach((t) => ev.push({ id: `${t.id}-done`, at: t.completedAt!, kind: "Task", title: "Task completed", body: t.title, by: t.completedBy ?? t.assigneeId }));
    ev.sort((a, b) => a.at.localeCompare(b.at));
    return newestFirst ? ev.reverse() : ev;
  }, [db, c.id, newestFirst]);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setNewestFirst((v) => !v)} aria-pressed={newestFirst}>
          <ArrowDownUp /> {newestFirst ? "Newest first" : "Oldest first"}
        </Button>
      </div>
      <ol className="relative">
        {events.map((e, i) => {
          const Icon = TYPE_ICON[e.kind] ?? FilePlus2;
          const prevStatus = (() => {
            const ordered = newestFirst ? events.slice(i + 1) : events.slice(0, i).reverse();
            return ordered.find((x) => x.status)?.status;
          })();
          const statusChanged = e.status && prevStatus && e.status !== prevStatus;
          const isLast = i === events.length - 1;
          return (
            <li key={e.id} className="relative flex gap-3 pb-5">
              {!isLast && <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-line" aria-hidden />}
              <span className={cn("z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-white",
                e.kind === "Handover" || e.kind === "Acknowledged" ? "border-[#5B4A86]/30 text-[#5B4A86]" : e.kind === "Task" ? "border-success/30 text-success" : "border-teal/30 text-teal")}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <time dateTime={e.at} className="text-xs font-semibold tabular-nums text-ink">{format(parseISO(e.at), "d MMM, h:mm a")}</time>
                  <span className="text-sm font-semibold text-ink">{e.title}</span>
                  {statusChanged && <CaseStatusBadge status={e.status!} />}
                </div>
                {e.body && <p className="mt-0.5 text-sm leading-snug text-ink">{e.body}</p>}
                <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-muted">
                  <Avatar id={e.by} name={staffName(db, e.by)} size="xs" />
                  <span>{staffName(db, e.by)}</span>
                  {e.next && e.kind !== "Handover" && e.next !== "No further action" && (
                    <span>· Next: {e.next}{e.responsibleId ? ` (${staffName(db, e.responsibleId)})` : ""}</span>
                  )}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function CaseIdentity({ c }: { c: Case }) {
  const { db } = useStore();
  const a = db.animals.find((x) => x.id === c.animalId);
  return (
    <span className="inline-flex items-center gap-2">
      <TokenChip token={c.token} />
      <Link to={`/cases/${c.id}`} className="font-medium hover:text-teal">{a?.name}</Link>
      <span className="font-mono text-xs text-ink-muted">{c.id}</span>
    </span>
  );
}

