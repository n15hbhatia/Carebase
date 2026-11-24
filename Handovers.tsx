import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Plus, Repeat2, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import type { Handover } from "@/lib/types";
import { cn, fmtDateTime, fmtSmart, staffName } from "@/lib/utils";
import { Avatar, Card, EmptyState, Pagination, TokenChip } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox, Input, Select } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { AnimalAvatar, CaseStatusBadge, FilterBar, PageHeader, PriorityBadge, StaffOptions, useTableState } from "@/components/domain";
import { useDialogs } from "@/components/forms/DialogsProvider";

type Tab = "all" | "pending" | "completed";

export default function HandoversPage() {
  const { db, user } = useStore();
  const { open } = useDialogs();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) ?? "all";
  const openId = params.get("open");
  const [q, setQ] = useState("");
  const [person, setPerson] = useState("");
  const { paginate, setPage } = useTableState<"createdAt">({ key: "createdAt", dir: "desc" });

  const setParam = (k: string, v: string | null) => {
    const n = new URLSearchParams(params);
    if (v) n.set(k, v);
    else n.delete(k);
    setParams(n, { replace: true });
  };

  const counts = {
    all: db.handovers.length,
    pending: db.handovers.filter((h) => h.status === "Pending").length,
    completed: db.handovers.filter((h) => h.status === "Acknowledged").length,
  };
  const forMe = db.handovers.filter((h) => h.status === "Pending" && h.toId === user?.id);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^#/, "");
    return db.handovers
      .filter((h) => (tab === "all" ? true : tab === "pending" ? h.status === "Pending" : h.status === "Acknowledged"))
      .filter((h) => !person || h.fromId === person || h.toId === person)
      .map((h) => {
        const c = db.cases.find((x) => x.id === h.caseId);
        const a = c ? db.animals.find((x) => x.id === c.animalId) : undefined;
        return { h, c, a };
      })
      .filter(({ h, c, a }) => !term || h.id.toLowerCase().includes(term) || c?.id.toLowerCase().includes(term) || c?.token.includes(term) || a?.name.toLowerCase().includes(term))
      .sort((x, y) => Number(y.h.status === "Pending") - Number(x.h.status === "Pending") || y.h.createdAt.localeCompare(x.h.createdAt));
  }, [db, tab, q, person]);
  const page = paginate(rows);
  const viewing = db.handovers.find((h) => h.id === openId);

  return (
    <>
      <PageHeader
        title="Handover"
        description="Hand a case to a colleague with everything they need — and confirm they've taken responsibility."
        actions={can(user, "handover.create") && <Button onClick={() => open({ kind: "handover" })}><Plus /> Create handover</Button>}
      />

      {forMe.length > 0 && (
        <div className="mb-5 rounded-lg border border-warning/30 bg-warning-soft p-4">
          <p className="text-sm font-semibold text-warning-ink">{forMe.length} handover{forMe.length > 1 ? "s" : ""} waiting for you to acknowledge</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {forMe.map((h) => {
              const c = db.cases.find((x) => x.id === h.caseId);
              const a = c && db.animals.find((x) => x.id === c.animalId);
              return (
                <li key={h.id}>
                  <button type="button" onClick={() => setParam("open", h.id)} className="inline-flex items-center gap-2 rounded-md border border-warning/30 bg-white px-3 py-1.5 text-sm hover:border-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
                    {c && <TokenChip token={c.token} />} <span className="font-medium">{a?.name}</span> <span className="text-xs text-ink-muted">from {staffName(db, h.fromId)}</span> <ArrowRight className="h-3.5 w-3.5 text-ink-muted" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Card>
        <div className="flex flex-wrap items-center gap-1 border-b border-line px-4 pt-2" role="tablist" aria-label="Handover status">
          {([["all", "All Handovers"], ["pending", "Pending Acknowledgement"], ["completed", "Completed"]] as const).map(([v, label]) => (
            <button key={v} type="button" role="tab" aria-selected={tab === v}
              onClick={() => { setParam("tab", v === "all" ? null : v); setPage(1); }}
              className={cn("-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
                tab === v ? "border-teal text-teal" : "border-transparent text-ink-muted hover:text-ink")}>
              {label}
              <span className={cn("rounded-full px-1.5 text-[11px] font-semibold", tab === v ? "bg-teal-soft" : "bg-canvas", v === "pending" && counts.pending > 0 && "bg-warning-soft text-warning-ink")}>{counts[v]}</span>
            </button>
          ))}
        </div>
        <FilterBar>
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Token, animal or case ID…" className="pl-8" aria-label="Search handovers" />
          </div>
          <Select value={person} onChange={(e) => { setPerson(e.target.value); setPage(1); }} aria-label="Filter by staff member" className="w-52">
            <StaffOptions placeholder="Anyone (from or to)" includeInactive />
          </Select>
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState icon={Repeat2} title={tab === "pending" ? "No handovers awaiting acknowledgement" : "No handovers found"}
            description={tab === "pending" ? "Everyone has confirmed what they've been handed." : "Create a handover when a case moves to another person."}
            action={can(user, "handover.create") && tab !== "pending" ? <Button onClick={() => open({ kind: "handover" })}><Plus /> Create handover</Button> : undefined} />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th className="hidden md:table-cell">Case ID</Th><Th>Token</Th><Th>Animal</Th><Th className="hidden sm:table-cell">Handed over by</Th>
                  <Th>Handed over to</Th><Th className="hidden lg:table-cell">Date & time</Th><Th className="hidden lg:table-cell">Priority</Th><Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map(({ h, c, a }) => (
                  <Tr key={h.id} onClick={() => setParam("open", h.id)} className={cn(h.status === "Pending" && h.toId === user?.id && "bg-[#FFFBF3]")}>
                    <Td className="hidden font-mono text-[13px] md:table-cell">{c?.id}</Td>
                    <Td>{c && <TokenChip token={c.token} />}</Td>
                    <Td>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setParam("open", h.id); }} className="rounded font-medium hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">{a?.name}</button>
                    </Td>
                    <Td className="hidden sm:table-cell"><Person id={h.fromId} /></Td>
                    <Td><Person id={h.toId} /></Td>
                    <Td className="hidden whitespace-nowrap text-xs text-ink-muted lg:table-cell">{fmtSmart(h.createdAt)}</Td>
                    <Td className="hidden lg:table-cell"><PriorityBadge priority={h.priority} /></Td>
                    <Td><HandoverStatus h={h} /></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination {...page} />
          </>
        )}
      </Card>
      {viewing && <HandoverView h={viewing} onClose={() => setParam("open", null)} />}
    </>
  );
}

function Person({ id }: { id: string }) {
  const { db } = useStore();
  const n = staffName(db, id);
  return <span className="inline-flex items-center gap-2 whitespace-nowrap"><Avatar id={id} name={n} size="sm" /><span className="text-sm">{n}</span></span>;
}

function HandoverStatus({ h }: { h: Handover }) {
  return h.status === "Pending" ? (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-warning/20 bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-ink"><span className="h-1.5 w-1.5 rounded-full bg-warning" />Awaiting</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-success/20 bg-success-soft px-2 py-0.5 text-xs font-medium text-success"><CheckCircle2 className="h-3 w-3" />Acknowledged</span>
  );
}

function HandoverView({ h, onClose }: { h: Handover; onClose: () => void }) {
  const { db, user, acknowledgeHandover } = useStore();
  const [accept, setAccept] = useState(false);
  const c = db.cases.find((x) => x.id === h.caseId);
  const a = c && db.animals.find((x) => x.id === c.animalId);
  const isReceiver = h.toId === user?.id;
  const pending = h.status === "Pending";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} size="lg" title={`Handover ${h.id}`}
      description={`${staffName(db, h.fromId)} → ${staffName(db, h.toId)} · ${fmtDateTime(h.createdAt)}`}
      footer={
        <>
          {c && <Button variant="ghost" asChild><Link to={`/cases/${c.id}`} onClick={onClose}>Open case</Link></Button>}
          <span className="flex-1" />
          {pending && isReceiver ? (
            <>
              <Button variant="outline" onClick={onClose}>Later</Button>
              <Button disabled={!accept} onClick={() => {
                try {
                  acknowledgeHandover(h.id);
                  toast.success("Handover acknowledged", { description: `You are now responsible for ${a?.name} (token ${c?.token}).` });
                  onClose();
                } catch (e) {
                  toast.error((e as Error).message);
                }
              }}><ShieldCheck /> Acknowledge & accept</Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose}>Close</Button>
          )}
        </>
      }>
      <div className="space-y-4">
        {c && a && (
          <div className="flex items-center gap-3 rounded-lg border border-line p-3">
            <AnimalAvatar animal={a} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 font-semibold">{a.name} <TokenChip token={c.token} /></p>
              <p className="text-xs text-ink-muted">{c.id} · {c.reason}</p>
            </div>
            <PriorityBadge priority={h.priority} />
          </div>
        )}
        <div className="rounded-lg border border-teal/25 bg-teal-soft/70 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-teal">Summary</p>
          <p className="mt-1 text-[15px] leading-relaxed text-ink">{h.summary}</p>
        </div>
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-md border border-line p-3"><dt className="text-xs text-ink-muted">Previous action</dt><dd className="mt-0.5 text-sm font-medium">{h.previousAction}</dd></div>
          <div className="rounded-md border border-line p-3"><dt className="text-xs text-ink-muted">Status at handover</dt><dd className="mt-1"><CaseStatusBadge status={h.currentStatus} /></dd></div>
          <div className="rounded-md border border-teal/30 bg-white p-3 sm:col-span-2"><dt className="text-xs font-medium text-teal">Next required action</dt><dd className="mt-0.5 text-sm font-semibold">{h.nextAction}</dd></div>
          {h.notes && <div className="rounded-md border border-warning/30 bg-warning-soft/50 p-3 sm:col-span-2"><dt className="text-xs font-medium text-warning-ink">Important notes</dt><dd className="mt-0.5 text-sm">{h.notes}</dd></div>}
        </dl>
        {pending ? (
          isReceiver ? (
            <div className="rounded-lg border border-line bg-[#FAFBFC] p-3">
              <Checkbox id="accept" checked={accept} onChange={setAccept}
                label={<span>I have read this handover and <strong>accept responsibility</strong> for {a?.name}'s next action.</span>} />
            </div>
          ) : (
            <p className="rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-ink">Waiting for {staffName(db, h.toId)} to acknowledge. Only the receiving staff member can accept this handover.</p>
          )
        ) : (
          <p className="flex items-center gap-2 rounded-md bg-success-soft px-3 py-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> Acknowledged by {staffName(db, h.toId)} on {fmtDateTime(h.acknowledgedAt)}{h.acceptedResponsibility ? " — responsibility accepted." : "."}
          </p>
        )}
      </div>
    </Dialog>
  );
}
