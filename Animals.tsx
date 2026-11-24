import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { isToday, parseISO } from "date-fns";
import { Archive, ArchiveRestore, Eye, MoreHorizontal, PawPrint, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { CASE_STATUSES, type Animal } from "@/lib/types";
import { animalStatus, currentCaseFor, fmtDate, staffName } from "@/lib/utils";
import { Card, EmptyState, Pagination, Segmented, TokenChip } from "@/components/ui/misc";
import { Table, SortTh, Td, Th, Tr } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { AnimalAvatar, CaseStatusBadge, compare, FilterBar, PageHeader, useTableState } from "@/components/domain";
import { useDialogs } from "@/components/forms/DialogsProvider";

type SortKey = "token" | "name" | "admissionDate" | "status";

export default function AnimalsPage() {
  const { db, user, setAnimalArchived, deleteAnimal } = useStore();
  const { open } = useDialogs();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const type = params.get("type") ?? "";
  const status = params.get("status") ?? "";
  const admitted = params.get("admitted") ?? "";
  const view = (params.get("view") as "current" | "archived") ?? "current";
  const { sort, onSort, paginate, setPage } = useTableState<SortKey>({ key: "admissionDate", dir: "desc" });
  const [toDelete, setToDelete] = useState<Animal | null>(null);

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
    setPage(1);
  };

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase().replace(/^#/, "");
    const list = db.animals
      .filter((a) => (view === "archived" ? a.archived : !a.archived))
      .filter((a) => !type || a.type === type)
      .filter((a) => !status || animalStatus(db, a) === status)
      .filter((a) => admitted !== "today" || isToday(parseISO(a.admissionDate)))
      .filter((a) => !term || a.name.toLowerCase().includes(term) || a.token.includes(term) || Number(a.token) === Number(term) || a.id.toLowerCase().includes(term) || a.breed.toLowerCase().includes(term))
      .map((a) => ({ a, status: animalStatus(db, a), c: currentCaseFor(db, a.id) }));
    const dir = sort.dir === "asc" ? 1 : -1;
    return list.sort((x, y) => {
      const v = sort.key === "status" ? compare(x.status, y.status) : sort.key === "token" ? Number(x.a.token) - Number(y.a.token) : compare(x.a[sort.key], y.a[sort.key]);
      return v * dir;
    });
  }, [db, q, type, status, admitted, view, sort]);

  const page = paginate(rows);
  const filtered = !!(q || type || status || admitted);

  return (
    <>
      <PageHeader
        title="Animals"
        description="Every animal registered at the shelter, with its token and current care status."
        actions={can(user, "animal.create") && <Button onClick={() => open({ kind: "animal" })}><Plus /> Add animal</Button>}
      />
      <Card>
        <FilterBar>
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" aria-hidden />
            <Input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Search name or token…" className="pl-8" aria-label="Search animals by name or token number" />
          </div>
          <Select value={type} onChange={(e) => setParam("type", e.target.value)} aria-label="Filter by animal type" className="w-36">
            <option value="">All types</option>
            <option>Dog</option><option>Cat</option><option>Other</option>
          </Select>
          <Select value={status} onChange={(e) => setParam("status", e.target.value)} aria-label="Filter by current status" className="w-52">
            <option value="">All statuses</option>
            {CASE_STATUSES.map((s) => <option key={s}>{s}</option>)}
            <option>No Active Case</option>
          </Select>
          {admitted === "today" && (
            <button type="button" onClick={() => setParam("admitted", "")} className="inline-flex h-8 items-center gap-1 rounded-full bg-teal-soft px-3 text-xs font-medium text-teal hover:bg-[#d9ecea]">
              Admitted today <X className="h-3.5 w-3.5" aria-label="Remove filter" />
            </button>
          )}
          {filtered && <Button variant="ghost" size="sm" onClick={() => { setQ(""); setParams({ view }, { replace: true }); }}>Clear filters</Button>}
          <div className="ml-auto">
            <Segmented label="Record view" value={view} onChange={(v) => setParam("view", v === "current" ? "" : v)}
              options={[{ value: "current", label: `Current (${db.animals.filter((a) => !a.archived).length})` }, { value: "archived", label: `Archived (${db.animals.filter((a) => a.archived).length})` }]} />
          </div>
        </FilterBar>
        {rows.length === 0 ? (
          <EmptyState
            icon={PawPrint}
            title={filtered ? "No animals match these filters" : view === "archived" ? "No archived records" : "No animals registered yet"}
            description={filtered ? "Try a different token number or clear the filters." : "Add the first animal to start tracking its care."}
            action={!filtered && view === "current" && can(user, "animal.create") ? <Button onClick={() => open({ kind: "animal" })}><Plus /> Add animal</Button> : undefined}
          />
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <SortTh label="Token" sortKey="token" sort={sort} onSort={onSort} />
                  <SortTh label="Animal" sortKey="name" sort={sort} onSort={onSort} />
                  <Th className="hidden md:table-cell">Breed · Age · Sex</Th>
                  <SortTh label="Current status" sortKey="status" sort={sort} onSort={onSort} />
                  <Th className="hidden lg:table-cell">Current case</Th>
                  <Th className="hidden lg:table-cell">Doctor</Th>
                  <SortTh label="Admitted" sortKey="admissionDate" sort={sort} onSort={onSort} className="hidden sm:table-cell" />
                  <Th className="w-10"><span className="sr-only">Actions</span></Th>
                </tr>
              </thead>
              <tbody>
                {page.rows.map(({ a, status: st, c }) => (
                  <Tr key={a.id} onClick={() => navigate(`/animals/${a.id}`)}>
                    <Td><TokenChip token={a.token} /></Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <AnimalAvatar animal={a} size="sm" />
                        <div className="min-w-0">
                          <Link to={`/animals/${a.id}`} onClick={(e) => e.stopPropagation()} className="block rounded font-medium hover:text-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">{a.name}</Link>
                          <span className="text-xs text-ink-muted">{a.type} · {a.id}</span>
                        </div>
                      </div>
                    </Td>
                    <Td className="hidden text-ink-muted md:table-cell">{[a.breed || "Unknown breed", a.age, a.sex].filter(Boolean).join(" · ")}</Td>
                    <Td><CaseStatusBadge status={st} /></Td>
                    <Td className="hidden lg:table-cell">
                      {c ? <Link to={`/cases/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-mono text-[13px] text-teal hover:underline">{c.id}</Link> : <span className="text-ink-muted">—</span>}
                    </Td>
                    <Td className="hidden whitespace-nowrap text-ink-muted lg:table-cell">{staffName(db, a.doctorId)}</Td>
                    <Td className="hidden whitespace-nowrap text-ink-muted sm:table-cell">{fmtDate(a.admissionDate)}</Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <MenuRoot>
                        <MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.name}`}><MoreHorizontal /></Button></MenuTrigger>
                        <MenuContent>
                          <MenuItem onSelect={() => navigate(`/animals/${a.id}`)}><Eye /> View profile</MenuItem>
                          <MenuItem disabled={!can(user, "animal.edit")} onSelect={() => open({ kind: "animal", animal: a })}><Pencil /> Edit</MenuItem>
                          <MenuItem disabled={!can(user, "animal.archive")} onSelect={() => { setAnimalArchived(a.id, !a.archived); toast.success(`${a.name} ${a.archived ? "restored" : "archived"}`); }}>
                            {a.archived ? <><ArchiveRestore /> Restore</> : <><Archive /> Archive</>}
                          </MenuItem>
                          <MenuSeparator />
                          <MenuItem danger disabled={!can(user, "animal.delete")} onSelect={() => setToDelete(a)}><Trash2 /> Delete…</MenuItem>
                        </MenuContent>
                      </MenuRoot>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
            <Pagination {...page} />
          </>
        )}
      </Card>
      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={`Delete ${toDelete?.name}?`}
        description={`This permanently removes ${toDelete?.name} (token ${toDelete?.token}) together with ${db.cases.filter((c) => c.animalId === toDelete?.id).length} case(s), their care updates, handovers and linked tasks. Archive the record instead if you may need it later.`}
        confirmLabel="Delete permanently"
        destructive
        onConfirm={() => {
          if (!toDelete) return;
          deleteAnimal(toDelete.id);
          toast.success(`${toDelete.name} deleted`);
          setToDelete(null);
        }}
      />
    </>
  );
}
