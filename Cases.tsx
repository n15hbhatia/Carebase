import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { parseISO } from "date-fns";
import { FolderHeart, Plus, Search } from "lucide-react";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { CASE_STATUSES } from "@/lib/types";
import { fmtSmart, isActiveCase, staffName } from "@/lib/utils";
import { Card, EmptyState, Pagination, Segmented, TokenChip } from "@/components/ui/misc";
import { SortTh, Table, Td, Th, Tr } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { AnimalAvatar, CaseStatusBadge, compare, FilterBar, PageHeader, StaffChip, StaffOptions, useTableState } from "@/components/domain";
import { useDialogs } from "@/components/forms/DialogsProvider";

type SortKey = "id" | "token" | "animal" | "status" | "updatedAt" | "openedAt";

export default function CasesPage() {
  const { db, user } = useStore();
  const { open } = useDialogs();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const statusParam = params.get("status") ?? "";
  const view = (params.get("view") as "active" | "completed" | "all") ?? (statusParam === "Completed" ? "completed" : "active");
  const doctor = params.get("doctor") ?? "";
  const responsible = params.get("responsible") ?? "";
  const type = params.get("type") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const defaultMine = !can(user, "case.viewAll");
  const mine = params.has("mine") ? params.get("mine") === "1" : defaultMine;
  const { sort, onSort, paginate, setPage } = useTableState<SortKey>({ key: "updatedAt", dir: "desc" });

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
    setPage(1);
  };

  const pendingHo = useMemo(() => new Set(db.handovers.filter((h) => h.status === "Pending").map((h) => h.caseId)), [db.handovers]);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^#/, "");
    const list = db.cases
      .map((c) => ({ c, a: db.animals.find((x) => x.id === c.animalId)! }))
      .filter(({ a }) => !!a)
      .filter(({ c }) => (view === "all" ? true : view === "active" ? isActiveCase(c) : !isActiveCase(c)))
      .filter(({ c }) => !statusParam || c.status === statusParam)
      .filter(({ c }) => !doctor || c.doctorId === doctor)
      .filter(({ c }) => !responsible || c.responsibleId === responsible)
      .filter(({ a }) => !type || a.type === type)
      .filter(({ c }) => !from || parseISO(c.openedAt) >= new Date(`${from}T00:00:00`))
      .filter(({ c }) => !to || parseISO(c.openedAt) <= new Date(`${to}T23:59:59`))
      .filter(({ c }) => !mine || c.responsibleId === user?.id || c.doctorId === user?.id || db.handovers.some((h) => h.caseId === c.id && h.toId === user?.id && h.status === "Pending"))
      .filter(({ c, a }) => !term || c.id.toLowerCase().includes(term) || c.token.includes(term) || Number(c.token) === Number(term) || a.name.toLowerCase().includes(term) || c.reason.toLowerCase().includes(term));
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((x, y) => {
      const v =
        sort.key === "animal" ? compare(x.a.name, y.a.name)
        : sort.key === "token" ? Number(x.c.token) - Number(y.c.token)
        : sort.key === "status" ? CASE_STATUSES.indexOf(x.c.status) - CASE_STATUSES.indexOf(y.c.status)
        : compare(x.c[sort.key], y.c[sort.key]);
      return v * dir;
    });
  }, [db, q, view, statusParam, doctor, responsible, type, from, to, mine, user?.id, sort]);
  const page = paginate(rows);
  const anyFilter = !!(q || statusParam || doctor || responsible || type || from || to);

  return (
    <>
      <PageHeader
        title="Cases"
        description="Each admission is a case, identified by its token. Open one to see its Care Status Card."
        actions={can(user, "case.create") && <Button onClick={() => open({ kind: "case" })}><Plus /> Create case</Button>}
      />
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <Segmented label="Case view" value={view} onChange={(v) => { const n = new URLSearchParams(params); n.set("view", v); n.delete("status"); setParams(n, { replace: true }); setPage(1); }}
            options={[
              { value: "active", label: `Active (${db.cases.filter(isActiveCase).length})` },
              { value: "completed", label: `Completed (${db.cases.filter((c) => !isActiveCase(c)).length})` },
              { value: "all", label: "All" },
            ]} />
          <Checkbox id="mine" checked={mine} onChange={(v) => setParam("mine", v ? "1" : "0")} label="Only cases I'm responsible for" />
        </div>
        <FilterBar>
          <div className="relative w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Token, case ID or animal…" className="pl-8" aria-label="Search cases" />
          </div>
          <Select value={statusParam} onChange={(e) => setParam("status", e.target.value)} aria-label="Filter by status" className="w-48">
            <option value="">All statuses</option>
            {CASE_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </Select>
          <Select value={doctor} onChange={(e) => setParam("doctor", e.target.value)} aria-label="Filter by doctor" className="w-44">
            <StaffOptions roles={["Doctor"]} placeholder="All doctors" includeInactive />
          </Select>
          <Select value={responsible} onChange={(e) => setParam("responsible", e.target.value)} aria-label="Filter by responsible staff" className="w-48">
            <StaffOptions placeholder="Anyone responsible" includeInactive />
          </Select>
          <Select value={type} onChange={(e) => setParam("type", e.target.value)} aria-label="Filter by animal type" className="w-32">
            <option value="">All animals</option><option>Dog</option><option>Cat</option><option>Other</option>
          </Select>
          <div className="flex items-center gap-1.5 text-xs text-ink-muted">
            <label htmlFor="c-from">Opened</label>
            <Input id="c-from" type="date" value={from} onChange={(e) => setParam("from", e.target.value)} className="h-9 w-36" aria-label="Opened from date" />
            <span aria-hidden>–</span>
            <Input id="c-to" type="date" value={to} onChange={(e) => setParam("to", e.target.value)} className="h-9 w-36" aria-label="Opened to date" />
          </div>
          {anyFilter && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setParams({ view }, { replace: true }); }}>Clear</Button>}
        </FilterBar>

        {rows.length === 0 ? (
          <EmptyState icon={FolderHeart} title={anyFilter || mine ? "No cases match" : "No cases yet"}
            description={mine ? "You are not responsible for any cases in this view. Untick “Only cases I'm responsible for” to see everyone's." : anyFilter ? "Try clearing a filter." : "Create a case when an animal is admitted."}
            action={!anyFilter && !mine && can(user, "case.create") ? <Button onClick={() => open({ kind: "case" })}><Plus /> Create case</Button> : undefined} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <SortTh label="Case ID" sortKey="id" sort={sort} onSort={onSort} className="hidden sm:table-cell" />
                  <SortTh label="Token" sortKey="token" sort={sort} onSort={onSort} />
                  <SortTh label="Animal" sortKey="animal" sort={sort} onSort={onSort} />
                  <SortTh label="Status" sortKey="status" sort={sort} onSort={onSort} />
                  <Th className="hidden xl:table-cell">Doctor</Th>
                  <Th className="hidden lg:table-cell">Responsible</Th>
                  <Th className="hidden md:table-cell">Next action</Th>
                  <SortTh label="Last updated" sortKey="updatedAt" sort={sort} onSort={onSort} className="hidden sm:table-cell" />
                </tr>
              </thead>
              <tbody>
                {page.rows.map(({ c, a }) => (
                  <Tr key={c.id} onClick={() => navigate(`/cases/${c.id}`)}>
                    <Td className="hidden font-mono text-[13px] sm:table-cell">
                      <Link to={`/cases/${c.id}`} onClick={(e) => e.stopPropagation()} className="rounded text-teal hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">{c.id}</Link>
                    </Td>
                    <Td><TokenChip token={c.token} /></Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <AnimalAvatar animal={a} size="sm" />
                        <div>
                          <p className="font-medium">{a.name}</p>
                          <p className="text-xs text-ink-muted">{a.type}</p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-col items-start gap-1">
                        <CaseStatusBadge status={c.status} />
                        {pendingHo.has(c.id) && <span className="text-[11px] font-medium text-[#5B4A86]">Handover pending</span>}
                      </div>
                    </Td>
                    <Td className="hidden whitespace-nowrap text-ink-muted xl:table-cell">{staffName(db, c.doctorId)}</Td>
                    <Td className="hidden lg:table-cell"><StaffChip id={c.responsibleId} /></Td>
                    <Td className="hidden max-w-[260px] md:table-cell"><p className="line-clamp-2 text-[13px] text-ink-muted">{c.nextAction}</p></Td>
                    <Td className="hidden whitespace-nowrap text-xs text-ink-muted sm:table-cell">{fmtSmart(c.updatedAt)}</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination {...page} />
          </>
        )}
      </Card>
    </>
  );
}
