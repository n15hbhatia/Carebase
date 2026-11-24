import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, MoreHorizontal, Pencil, Plus, ShieldCheck, UserCheck, UserX, Users } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { can, ROLE_SUMMARY } from "@/lib/permissions";
import { ROLES, type Staff } from "@/lib/types";
import { cn, isActiveCase, taskDisplayStatus } from "@/lib/utils";
import { Avatar, Badge, Card, CardHeader, EmptyState, Segmented } from "@/components/ui/misc";
import { Table, Td, Th, Tr } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { MenuContent, MenuItem, MenuRoot, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { FilterBar, PageHeader } from "@/components/domain";
import { useDialogs } from "@/components/forms/DialogsProvider";

export default function StaffPage() {
  const { db, user, updateStaff } = useStore();
  const { open } = useDialogs();
  const navigate = useNavigate();
  const [role, setRole] = useState("");
  const [view, setView] = useState<"active" | "inactive">("active");
  const [toggle, setToggle] = useState<Staff | null>(null);
  const manage = can(user, "staff.manage");

  const list = db.staff
    .filter((s) => (view === "active" ? s.active : !s.active))
    .filter((s) => !role || s.role === role)
    .sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || a.name.localeCompare(b.name));

  const roleCounts = ROLES.map((r) => ({ r, n: db.staff.filter((s) => s.active && s.role === r).length }));

  return (
    <>
      <PageHeader title="Staff" description={`${db.staff.filter((s) => s.active).length} active team members and what they're responsible for right now.`}
        actions={manage && <Button onClick={() => open({ kind: "staff" })}><Plus /> Add staff</Button>} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {roleCounts.map(({ r, n }) => (
          <button key={r} type="button" onClick={() => setRole(role === r ? "" : r)} aria-pressed={role === r}
            className={cn("rounded-lg border bg-white p-3 text-left shadow-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal", role === r ? "border-teal" : "border-line hover:border-[#CFD9E1]")}>
            <p className="text-[13px] text-ink-muted">{r === "Support Staff" ? "Support staff" : `${r}s`}</p>
            <p className="text-2xl font-semibold tabular-nums">{n}</p>
          </button>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <FilterBar>
            <Select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filter by role" className="w-44">
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r}>{r}</option>)}
            </Select>
            <div className="ml-auto">
              <Segmented label="Account status" value={view} onChange={setView}
                options={[{ value: "active", label: "Active" }, { value: "inactive", label: `Deactivated (${db.staff.filter((s) => !s.active).length})` }]} />
            </div>
          </FilterBar>
          {list.length === 0 ? (
            <EmptyState icon={Users} title={view === "inactive" ? "No deactivated accounts" : "No staff in this role"} />
          ) : (
            <Table>
              <thead>
                <tr><Th>Name</Th><Th className="hidden sm:table-cell">Role</Th><Th className="hidden lg:table-cell">Contact</Th><Th className="text-right">Active cases</Th><Th className="text-right">Open tasks</Th><Th className="w-10"><span className="sr-only">Actions</span></Th></tr>
              </thead>
              <tbody>
                {list.map((s) => {
                  const cases = db.cases.filter((c) => isActiveCase(c) && c.responsibleId === s.id).length;
                  const tasks = db.tasks.filter((t) => t.assigneeId === s.id && t.status !== "Completed");
                  const overdue = tasks.filter((t) => taskDisplayStatus(t) === "Overdue").length;
                  return (
                    <Tr key={s.id} onClick={() => navigate(`/staff/${s.id}`)}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar id={s.id} name={s.name} />
                          <div>
                            <Link to={`/staff/${s.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-teal">{s.name}</Link>
                            <p className="text-xs text-ink-muted">{s.id}{s.id === user?.id ? " · you" : ""}</p>
                          </div>
                        </div>
                      </Td>
                      <Td className="hidden sm:table-cell"><Badge tone={s.role === "Manager" ? "navy" : s.role === "Doctor" ? "teal" : s.role === "Assistant" ? "violet" : "neutral"} dot={false}>{s.role}</Badge></Td>
                      <Td className="hidden text-[13px] text-ink-muted lg:table-cell"><p>{s.phone}</p><p>{s.email}</p></Td>
                      <Td className="text-right tabular-nums">{cases}</Td>
                      <Td className="text-right tabular-nums">{tasks.length}{overdue > 0 && <span className="ml-1 text-xs text-danger-ink">({overdue} overdue)</span>}</Td>
                      <Td onClick={(e) => e.stopPropagation()}>
                        <MenuRoot>
                          <MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${s.name}`}><MoreHorizontal /></Button></MenuTrigger>
                          <MenuContent>
                            <MenuItem onSelect={() => navigate(`/staff/${s.id}`)}><Eye /> View profile</MenuItem>
                            <MenuItem disabled={!manage} onSelect={() => open({ kind: "staff", staff: s })}><Pencil /> Edit / change role</MenuItem>
                            <MenuSeparator />
                            <MenuItem danger={s.active} disabled={!manage || s.id === user?.id} onSelect={() => setToggle(s)}>
                              {s.active ? <><UserX /> Deactivate…</> : <><UserCheck /> Reactivate</>}
                            </MenuItem>
                          </MenuContent>
                        </MenuRoot>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
        <Card className="self-start">
          <CardHeader title="Role permissions" icon={ShieldCheck} description="What each role can do in Carebase" />
          <ul className="divide-y divide-line">
            {ROLES.map((r) => (
              <li key={r} className="px-4 py-3">
                <p className="text-sm font-semibold">{r}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{ROLE_SUMMARY[r].join(" · ")}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <ConfirmDialog open={!!toggle} onOpenChange={(o) => !o && setToggle(null)}
        title={toggle?.active ? `Deactivate ${toggle?.name}?` : `Reactivate ${toggle?.name}?`}
        description={toggle?.active
          ? `${toggle?.name} will no longer be able to sign in or be assigned new work. Their ${db.cases.filter((c) => isActiveCase(c) && c.responsibleId === toggle?.id).length} active case(s) and ${db.tasks.filter((t) => t.assigneeId === toggle?.id && t.status !== "Completed").length} open task(s) stay assigned until you hand them over.`
          : `${toggle?.name} will be able to sign in and receive work again.`}
        destructive={toggle?.active} confirmLabel={toggle?.active ? "Deactivate" : "Reactivate"}
        onConfirm={() => { if (toggle) { updateStaff(toggle.id, { active: !toggle.active }); toast.success(`${toggle.name} ${toggle.active ? "deactivated" : "reactivated"}`); setToggle(null); } }} />
    </>
  );
}
