import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { format, isToday, isYesterday, parseISO } from "date-fns";
import { Activity as ActivityIcon, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { ACTIVITY_TYPES, type ActivityType } from "@/lib/types";
import { staffName } from "@/lib/utils";
import { Avatar, Badge, Card, EmptyState, Pagination, TokenChip } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { FilterBar, PageHeader, StaffOptions, useTableState } from "@/components/domain";
import type { Tone } from "@/lib/utils";

const TONE: Partial<Record<ActivityType, Tone>> = {
  "Animal Added": "navy", "Case Created": "navy", "Status Updated": "teal", "Care Update": "teal", "Surgery Scheduled": "violet",
  "Task Assigned": "neutral", "Task Completed": "success", "Handover Created": "violet", "Handover Acknowledged": "success",
  "Animal Deleted": "danger", "Task Deleted": "danger", "Animal Archived": "warning",
};

function dayLabel(iso: string) {
  const d = parseISO(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, d MMMM yyyy");
}

export default function ActivityPage() {
  const { db } = useStore();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const staff = params.get("staff") ?? "";
  const type = params.get("type") ?? "";
  const caseId = params.get("case") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const { paginate, setPage } = useTableState<"createdAt">({ key: "createdAt", dir: "desc" }, 25);
  const setParam = (k: string, v: string) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
    setPage(1);
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return db.activityLogs
      .filter((l) => !staff || l.staffId === staff)
      .filter((l) => !type || l.action === type)
      .filter((l) => !caseId || l.caseId === caseId)
      .filter((l) => !from || l.createdAt >= new Date(`${from}T00:00:00`).toISOString())
      .filter((l) => !to || l.createdAt <= new Date(`${to}T23:59:59`).toISOString())
      .filter((l) => !term || l.description.toLowerCase().includes(term) || l.id.toLowerCase().includes(term))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [db.activityLogs, q, staff, type, caseId, from, to]);
  const page = paginate(rows);
  const anyFilter = !!(q || staff || type || caseId || from || to);
  const caseOptions = [...db.cases].sort((a, b) => b.id.localeCompare(a.id));

  let lastDay = "";
  return (
    <>
      <PageHeader title="Activity Log" description="Every important action in Carebase, newest first. Nothing here can be edited." />
      <Card>
        <FilterBar>
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search descriptions…" className="pl-8" aria-label="Search activity" />
          </div>
          <Select value={staff} onChange={(e) => setParam("staff", e.target.value)} aria-label="Filter by staff member" className="w-48"><StaffOptions placeholder="All staff" includeInactive /></Select>
          <Select value={type} onChange={(e) => setParam("type", e.target.value)} aria-label="Filter by activity type" className="w-48">
            <option value="">All activity types</option>
            {ACTIVITY_TYPES.map((t) => <option key={t}>{t}</option>)}
          </Select>
          <Select value={caseId} onChange={(e) => setParam("case", e.target.value)} aria-label="Filter by case ID" className="w-44">
            <option value="">All cases</option>
            {caseOptions.map((c) => <option key={c.id} value={c.id}>{c.id} (#{c.token})</option>)}
          </Select>
          <div className="flex items-center gap-1.5">
            <Input type="date" value={from} onChange={(e) => setParam("from", e.target.value)} className="w-36" aria-label="From date" />
            <span className="text-ink-muted" aria-hidden>–</span>
            <Input type="date" value={to} onChange={(e) => setParam("to", e.target.value)} className="w-36" aria-label="To date" />
          </div>
          {anyFilter && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setParams({}, { replace: true }); }}>Clear</Button>}
          <span className="ml-auto text-xs text-ink-muted">{rows.length} entries</span>
        </FilterBar>
        {rows.length === 0 ? <EmptyState icon={ActivityIcon} title="No activity matches these filters" /> : (
          <>
            <Table>
              <thead>
                <tr><Th className="w-24">Time</Th><Th>Action</Th><Th>Description</Th><Th className="hidden md:table-cell">Case / animal</Th><Th className="hidden sm:table-cell">By</Th><Th className="hidden xl:table-cell">ID</Th></tr>
              </thead>
              <tbody>
                {page.rows.map((l) => {
                  const day = dayLabel(l.createdAt);
                  const header = day !== lastDay;
                  lastDay = day;
                  const c = db.cases.find((x) => x.id === l.caseId);
                  const a = db.animals.find((x) => x.id === l.animalId);
                  return [
                    header && (
                      <tr key={`${l.id}-h`}><td colSpan={6} className="border-b border-line bg-[#FAFBFC] px-4 py-1.5 text-xs font-semibold text-ink-muted">{day}</td></tr>
                    ),
                    <Tr key={l.id}>
                      <Td className="whitespace-nowrap text-xs tabular-nums text-ink-muted"><time dateTime={l.createdAt}>{format(parseISO(l.createdAt), "h:mm a")}</time></Td>
                      <Td><Badge tone={TONE[l.action] ?? "neutral"}>{l.action}</Badge></Td>
                      <Td className="max-w-[420px] text-[13px]">{l.description}</Td>
                      <Td className="hidden md:table-cell">
                        {c ? <Link to={`/cases/${c.id}`} className="inline-flex items-center gap-1.5 hover:text-teal"><TokenChip token={c.token} /><span className="text-[13px]">{c.id}</span></Link>
                          : a ? <Link to={`/animals/${a.id}`} className="text-[13px] hover:text-teal">{a.name}</Link> : <span className="text-ink-muted">—</span>}
                      </Td>
                      <Td className="hidden sm:table-cell"><span className="inline-flex items-center gap-2 whitespace-nowrap text-[13px]"><Avatar id={l.staffId} name={staffName(db, l.staffId)} size="xs" />{staffName(db, l.staffId)}</span></Td>
                      <Td className="hidden font-mono text-xs text-ink-muted xl:table-cell">{l.id}</Td>
                    </Tr>,
                  ];
                })}
              </tbody>
            </Table>
            <Pagination {...page} />
          </>
        )}
      </Card>
    </>
  );
}
