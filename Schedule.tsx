import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { addDays, format, isSameDay, parseISO, startOfWeek } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Plus, Rows3, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { SHIFT_HOURS, SHIFTS, type DutySchedule, type DutyType } from "@/lib/types";
import { cn, staffName } from "@/lib/utils";
import { Avatar, Card, CardHeader, EmptyState, Segmented, TokenChip } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuTrigger } from "@/components/ui/menu";
import { PageHeader } from "@/components/domain";
import { useDialogs } from "@/components/forms/DialogsProvider";

const DUTY_STYLE: Partial<Record<DutyType, string>> = {
  Surgery: "bg-[#F0ECF7] text-[#5B4A86] border-[#5B4A86]/20",
  "Surgery Assist": "bg-[#F0ECF7] text-[#5B4A86] border-[#5B4A86]/20",
  "OPD & Assessments": "bg-teal-soft text-teal border-teal/20",
  "Ward Rounds": "bg-teal-soft text-teal border-teal/20",
  "Medication Round": "bg-teal-soft text-teal border-teal/20",
  "Admissions Desk": "bg-[#E9EFF3] text-navy border-navy/15",
  "Shelter Management": "bg-[#E9EFF3] text-navy border-navy/15",
  "Feeding Round": "bg-warning-soft text-warning-ink border-warning/25",
  "Kennel Cleaning": "bg-[#F1F4F7] text-[#4A5A68] border-line",
  "Cattery Cleaning": "bg-[#F1F4F7] text-[#4A5A68] border-line",
  "Laundry & Supplies": "bg-[#F1F4F7] text-[#4A5A68] border-line",
};
const SHIFT_SHORT = { Morning: "AM", Afternoon: "PM", Evening: "Eve", "Full Day": "Day" } as const;

export default function SchedulePage() {
  const { db, user, deleteDuty } = useStore();
  const { open } = useDialogs();
  const manage = can(user, "schedule.manage");
  const [anchor, setAnchor] = useState(new Date());
  const [mode, setMode] = useState<"week" | "day">("week");
  const [toDelete, setToDelete] = useState<DutySchedule | null>(null);
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const surgeryDays = db.settings.surgeryDays;
  const staff = db.staff.filter((s) => s.active);

  const byKey = useMemo(() => {
    const m = new Map<string, DutySchedule[]>();
    for (const d of db.dutySchedules) {
      const k = `${d.staffId}|${d.date}`;
      m.set(k, [...(m.get(k) ?? []), d]);
    }
    return m;
  }, [db.dutySchedules]);

  const surgeriesOn = (d: Date) => db.cases.filter((c) => c.surgeryAt && isSameDay(parseISO(c.surgeryAt), d)).sort((a, b) => a.surgeryAt!.localeCompare(b.surgeryAt!));

  const chip = (d: DutySchedule) => {
    const content = (
      <span className={cn("block w-full rounded border px-1.5 py-1 text-left text-[11px] leading-tight", DUTY_STYLE[d.duty] ?? "bg-canvas border-line")}>
        <span className="block truncate font-medium">{d.duty}</span>
        <span className="opacity-75">{SHIFT_SHORT[d.shift]}{d.notes ? ` · ${d.notes}` : ""}</span>
      </span>
    );
    if (!manage) return <div key={d.id} title={`${d.duty} · ${d.shift} (${SHIFT_HOURS[d.shift]})`}>{content}</div>;
    return (
      <MenuRoot key={d.id}>
        <MenuTrigger asChild>
          <button type="button" className="block w-full rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal" aria-label={`${staffName(db, d.staffId)}: ${d.duty}, ${d.shift} on ${d.date}`}>{content}</button>
        </MenuTrigger>
        <MenuContent align="start">
          <MenuLabel>{d.duty} · {SHIFT_HOURS[d.shift]}</MenuLabel>
          <MenuItem onSelect={() => open({ kind: "duty", duty: d })}><Pencil /> Edit duty</MenuItem>
          <MenuItem danger onSelect={() => setToDelete(d)}><Trash2 /> Remove…</MenuItem>
        </MenuContent>
      </MenuRoot>
    );
  };

  return (
    <>
      <PageHeader title="Duty Schedule" description={`The printed duty chart, digitised. Surgery days: ${surgeryDays.map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d]).join(", ")}.`}
        actions={<>
          <Segmented label="Calendar view" value={mode} onChange={setMode} options={[{ value: "week", label: "Week", icon: CalendarDays }, { value: "day", label: "Day", icon: Rows3 }]} />
          {manage && <Button onClick={() => open({ kind: "duty", defaults: { date: format(anchor, "yyyy-MM-dd") } })}><Plus /> Assign duty</Button>}
        </>} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" aria-label={mode === "week" ? "Previous week" : "Previous day"} onClick={() => setAnchor((a) => addDays(a, mode === "week" ? -7 : -1))}><ChevronLeft /></Button>
            <Button variant="outline" size="sm" onClick={() => setAnchor(new Date())}>Today</Button>
            <Button variant="outline" size="icon-sm" aria-label={mode === "week" ? "Next week" : "Next day"} onClick={() => setAnchor((a) => addDays(a, mode === "week" ? 7 : 1))}><ChevronRight /></Button>
            <h2 className="ml-2 text-sm font-semibold" aria-live="polite">
              {mode === "week" ? `${format(days[0], "d MMM")} – ${format(days[6], "d MMM yyyy")}` : format(anchor, "EEEE, d MMMM yyyy")}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#F0ECF7] ring-1 ring-[#5B4A86]/30" /> Surgery</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-teal-soft ring-1 ring-teal/30" /> Clinical</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-warning-soft ring-1 ring-warning/30" /> Feeding</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-[#F1F4F7] ring-1 ring-line" /> Cleaning & ops</span>
          </div>
        </div>

        {mode === "week" ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] table-fixed border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-[190px] border-b border-r border-line bg-[#FAFBFC] px-3 py-2 text-left text-xs font-medium text-ink-muted">Staff</th>
                  {days.map((d) => {
                    const isSurg = surgeryDays.includes(d.getDay());
                    const today = isSameDay(d, new Date());
                    return (
                      <th key={d.toISOString()} className={cn("border-b border-r border-line px-2 py-2 text-left align-top last:border-r-0", isSurg ? "bg-[#F7F5FB]" : "bg-[#FAFBFC]")}>
                        <button type="button" onClick={() => { setAnchor(d); setMode("day"); }} className="rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
                          <span className={cn("text-xs font-medium", today ? "text-teal" : "text-ink-muted")}>{format(d, "EEE")}</span>{" "}
                          <span className={cn("text-sm font-semibold", today && "rounded bg-teal px-1.5 text-white")}>{format(d, "d")}</span>
                        </button>
                        {isSurg && <p className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#5B4A86]"><Scissors className="h-3 w-3" aria-hidden />Surgery day</p>}
                        {surgeriesOn(d).map((c) => (
                          <Link key={c.id} to={`/cases/${c.id}`} className="mt-1 block truncate rounded bg-white px-1.5 py-0.5 text-[11px] font-normal text-[#5B4A86] ring-1 ring-[#5B4A86]/20 hover:ring-[#5B4A86]/50">
                            {format(parseISO(c.surgeryAt!), "HH:mm")} #{c.token} {db.animals.find((a) => a.id === c.animalId)?.name}
                          </Link>
                        ))}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id}>
                    <th scope="row" className="border-b border-r border-line px-3 py-2 text-left font-normal">
                      <Link to={`/staff/${s.id}`} className="flex items-center gap-2 hover:text-teal">
                        <Avatar id={s.id} name={s.name} size="sm" />
                        <span className="min-w-0"><span className="block truncate text-[13px] font-medium">{s.name}</span><span className="block text-[11px] text-ink-muted">{s.role}</span></span>
                      </Link>
                    </th>
                    {days.map((d) => {
                      const key = `${s.id}|${format(d, "yyyy-MM-dd")}`;
                      const items = byKey.get(key) ?? [];
                      return (
                        <td key={key} className={cn("group border-b border-r border-line p-1 align-top last:border-r-0", surgeryDays.includes(d.getDay()) && "bg-[#FCFBFE]")}>
                          <div className="space-y-1">
                            {items.map(chip)}
                            {manage && (
                              <button type="button" onClick={() => open({ kind: "duty", defaults: { date: format(d, "yyyy-MM-dd"), staffId: s.id } })}
                                className="flex h-6 w-full items-center justify-center rounded text-ink-muted opacity-0 hover:bg-canvas focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal group-hover:opacity-100"
                                aria-label={`Add duty for ${s.name} on ${format(d, "EEEE d MMM")}`}>
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <DayView date={anchor} chip={chip} />
        )}
      </Card>
      <ConfirmDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)} title="Remove this duty?" destructive confirmLabel="Remove"
        description={`${staffName(db, toDelete?.staffId)} will no longer be on ${toDelete?.duty} (${toDelete?.shift}) on ${toDelete ? format(parseISO(toDelete.date), "EEEE d MMM") : ""}.`}
        onConfirm={() => { if (toDelete) { deleteDuty(toDelete.id); toast.success("Duty removed"); setToDelete(null); } }} />
    </>
  );
}

function DayView({ date, chip }: { date: Date; chip: (d: DutySchedule) => ReactNode }) {
  const { db, user } = useStore();
  const { open } = useDialogs();
  const ds = format(date, "yyyy-MM-dd");
  const rows = db.dutySchedules.filter((d) => d.date === ds);
  const surgeries = db.cases.filter((c) => c.surgeryAt && isSameDay(parseISO(c.surgeryAt), date)).sort((a, b) => a.surgeryAt!.localeCompare(b.surgeryAt!));
  const isSurg = db.settings.surgeryDays.includes(date.getDay());
  return (
    <div className="grid gap-5 p-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {rows.length === 0 && (
          <EmptyState icon={CalendarDays} title="Nobody scheduled for this day"
            action={can(user, "schedule.manage") ? <Button onClick={() => open({ kind: "duty", defaults: { date: ds } })}><Plus /> Assign duty</Button> : undefined} />
        )}
        {SHIFTS.map((shift) => {
          const list = rows.filter((r) => r.shift === shift);
          if (!list.length) return null;
          return (
            <section key={shift}>
              <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold">{shift} <span className="text-xs font-normal text-ink-muted">{SHIFT_HOURS[shift]}</span></h3>
              <ul className="grid gap-2 sm:grid-cols-2">
                {list.map((d) => (
                  <li key={d.id} className="flex items-center gap-3 rounded-md border border-line p-2.5">
                    <Avatar id={d.staffId} name={staffName(db, d.staffId)} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{staffName(db, d.staffId)}</p>
                      <div className="mt-1 max-w-[220px]">{chip(d)}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <Card className="self-start">
        <CardHeader title={isSurg ? "Surgery day" : "Surgeries"} description={isSurg ? "Theatre runs from " + db.settings.surgeryStartTime : "Not a configured surgery day"} icon={Scissors} />
        {surgeries.length === 0 ? <p className="px-4 py-6 text-center text-sm text-ink-muted">No surgeries on this day.</p> : (
          <ul className="divide-y divide-line">
            {surgeries.map((c) => (
              <li key={c.id}>
                <Link to={`/cases/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFB]">
                  <span className="w-12 text-sm font-semibold tabular-nums">{format(parseISO(c.surgeryAt!), "HH:mm")}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 text-sm font-medium">{db.animals.find((a) => a.id === c.animalId)?.name} <TokenChip token={c.token} /></p>
                    <p className="truncate text-xs text-ink-muted">{c.surgeryProcedure} · {staffName(db, c.doctorId)} · {c.surgeryStatus}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
