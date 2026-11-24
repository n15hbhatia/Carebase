import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, ArchiveRestore, ClipboardList, FolderHeart, FolderPlus, History, Pencil, Repeat2, Stethoscope, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { animalStatus, cn, currentCaseFor, fmtDate, fmtSmart, isActiveCase, staffName, taskDisplayStatus } from "@/lib/utils";
import { Avatar, Card, CardHeader, EmptyState, KeyValue, TabsContent, TabsList, TabsRoot, TabsTrigger, TokenChip } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { AnimalAvatar, CaseStatusBadge, StaffChip, TaskStatusBadge } from "@/components/domain";
import { CareStatusCard } from "@/components/care";
import { useDialogs } from "@/components/forms/DialogsProvider";
import NotFoundPage from "./NotFound";

const TREATMENT_TYPES = ["Assessment", "Care Plan", "Treatment", "Medication", "Surgery"];

export default function AnimalProfilePage() {
  const { id } = useParams();
  const { db, user, setAnimalArchived, deleteAnimal } = useStore();
  const { open } = useDialogs();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const a = db.animals.find((x) => x.id === id);
  if (!a) return <NotFoundPage what="animal" />;

  const cases = db.cases.filter((c) => c.animalId === a.id).sort((x, y) => y.openedAt.localeCompare(x.openedAt));
  const caseIds = new Set(cases.map((c) => c.id));
  const current = currentCaseFor(db, a.id);
  const activeCase = current && isActiveCase(current) ? current : undefined;
  const updates = db.careUpdates.filter((u) => caseIds.has(u.caseId)).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const treatments = updates.filter((u) => TREATMENT_TYPES.includes(u.type));
  const tasks = db.tasks.filter((t) => t.animalId === a.id || (t.caseId && caseIds.has(t.caseId))).sort((x, y) => `${y.dueDate}${y.dueTime}`.localeCompare(`${x.dueDate}${x.dueTime}`));
  const handovers = db.handovers.filter((h) => caseIds.has(h.caseId)).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const caseToken = (cid: string) => cases.find((c) => c.id === cid)?.token ?? "";

  return (
    <div className="space-y-5">
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-5 sm:flex-row">
          <AnimalAvatar animal={a} size="xl" className="self-start" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-semibold tracking-tight">{a.name}</h1>
                  <CaseStatusBadge status={animalStatus(db, a)} />
                  {a.archived && <span className="rounded-full bg-[#F1F4F7] px-2 py-0.5 text-xs font-medium text-ink-muted">Archived</span>}
                </div>
                <p className="mt-0.5 text-sm text-ink-muted">{a.id} · {a.type} · {a.breed || "Unknown breed"}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Token</p>
                <TokenChip token={a.token} size="lg" />
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
              <KeyValue label="Age">{a.age || "—"}</KeyValue>
              <KeyValue label="Sex">{a.sex}</KeyValue>
              <KeyValue label="Admitted">{fmtDate(a.admissionDate)}</KeyValue>
              <KeyValue label="Assigned doctor"><StaffChip id={a.doctorId} /></KeyValue>
              <KeyValue label="Owner">{a.ownerName || "Stray / none"}</KeyValue>
              <KeyValue label="Contact">{a.contactNumber || "—"}</KeyValue>
            </dl>
            {a.notes && <p className="mt-3 rounded-md bg-[#FAFBFC] px-3 py-2 text-sm text-ink">{a.notes}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {can(user, "animal.edit") && <Button variant="outline" size="sm" onClick={() => open({ kind: "animal", animal: a })}><Pencil /> Edit</Button>}
              {can(user, "case.create") && !activeCase && !a.archived && <Button size="sm" onClick={() => open({ kind: "case", animalId: a.id })}><FolderPlus /> Open new case</Button>}
              {can(user, "animal.archive") && (
                <Button variant="outline" size="sm" onClick={() => { setAnimalArchived(a.id, !a.archived); toast.success(a.archived ? "Record restored" : "Record archived"); }}>
                  {a.archived ? <><ArchiveRestore /> Restore</> : <><Archive /> Archive</>}
                </Button>
              )}
              {can(user, "animal.delete") && <Button variant="danger-outline" size="sm" onClick={() => setConfirmDelete(true)}><Trash2 /> Delete</Button>}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[400px_minmax(0,1fr)]">
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Current active case</h2>
              {activeCase && <Link to={`/cases/${activeCase.id}`} className="text-[13px] font-medium text-teal hover:underline">Open {activeCase.id} →</Link>}
            </div>
            {activeCase ? (
              <CareStatusCard c={activeCase} compact />
            ) : (
              <Card>
                <EmptyState icon={FolderHeart} title="No active case" description={current ? `Last case ${current.id} was completed on ${fmtDate(current.closedAt)}.` : "This animal has no cases yet."}
                  action={can(user, "case.create") && !a.archived ? <Button size="sm" onClick={() => open({ kind: "case", animalId: a.id })}><FolderPlus /> Open case</Button> : undefined} />
              </Card>
            )}
          </div>
          <Card>
            <CardHeader title="All cases" description={`${cases.length} admission${cases.length === 1 ? "" : "s"}`} icon={FolderHeart} />
            <ul className="divide-y divide-line">
              {cases.map((c) => (
                <li key={c.id}>
                  <Link to={`/cases/${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFB]">
                    <TokenChip token={c.token} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.id} · {c.reason}</p>
                      <p className="text-xs text-ink-muted">{fmtDate(c.openedAt)}{c.closedAt ? ` – ${fmtDate(c.closedAt)}` : " – present"}</p>
                    </div>
                    <CaseStatusBadge status={c.status} />
                  </Link>
                </li>
              ))}
              {cases.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink-muted">No cases yet.</li>}
            </ul>
          </Card>
        </div>

        <Card>
          <TabsRoot defaultValue="treatment">
            <div className="border-b border-line px-4 py-3">
              <TabsList>
                <TabsTrigger value="treatment"><Stethoscope className="h-3.5 w-3.5" /> Treatment history ({treatments.length})</TabsTrigger>
                <TabsTrigger value="updates"><History className="h-3.5 w-3.5" /> Care updates ({updates.length})</TabsTrigger>
                <TabsTrigger value="tasks"><ClipboardList className="h-3.5 w-3.5" /> Tasks ({tasks.length})</TabsTrigger>
                <TabsTrigger value="handovers"><Repeat2 className="h-3.5 w-3.5" /> Handovers ({handovers.length})</TabsTrigger>
              </TabsList>
            </div>
            {(["treatment", "updates"] as const).map((tab) => {
              const list = tab === "treatment" ? treatments : updates;
              return (
                <TabsContent key={tab} value={tab} className="focus-visible:outline-none">
                  {list.length === 0 ? <EmptyState icon={History} title="Nothing recorded yet" /> : (
                    <ul className="divide-y divide-line">
                      {list.map((u) => (
                        <li key={u.id} className="flex gap-3 px-4 py-3">
                          <Avatar id={u.createdBy} name={staffName(db, u.createdBy)} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-x-2 text-sm">
                              <span className="font-semibold">{u.type}</span>
                              <span className="text-xs text-ink-muted">{fmtSmart(u.createdAt)} · {staffName(db, u.createdBy)}</span>
                              <Link to={`/cases/${u.caseId}`} className="font-mono text-xs text-teal hover:underline">#{caseToken(u.caseId)} · {u.caseId}</Link>
                            </p>
                            <p className="mt-0.5 text-sm">{u.description}</p>
                          </div>
                          <div className="hidden sm:block"><CaseStatusBadge status={u.status} /></div>
                        </li>
                      ))}
                    </ul>
                  )}
                </TabsContent>
              );
            })}
            <TabsContent value="tasks" className="focus-visible:outline-none">
              {tasks.length === 0 ? <EmptyState icon={ClipboardList} title="No tasks for this animal" /> : (
                <ul className="divide-y divide-line">
                  {tasks.map((t) => (
                    <li key={t.id}>
                      <Link to={`/tasks?open=${t.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFB]">
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-medium", t.status === "Completed" && "text-ink-muted line-through")}>{t.title}</p>
                          <p className="text-xs text-ink-muted">{t.category} · {staffName(db, t.assigneeId)} · due {t.dueDate} {t.dueTime}</p>
                        </div>
                        <TaskStatusBadge status={taskDisplayStatus(t)} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
            <TabsContent value="handovers" className="focus-visible:outline-none">
              {handovers.length === 0 ? <EmptyState icon={Repeat2} title="No handovers for this animal" /> : (
                <ul className="divide-y divide-line">
                  {handovers.map((h) => (
                    <li key={h.id}>
                      <Link to={`/handovers?open=${h.id}`} className="block px-4 py-3 hover:bg-[#F8FAFB]">
                        <p className="text-sm"><span className="font-medium">{staffName(db, h.fromId)}</span> <span className="text-ink-muted">→</span> <span className="font-medium">{staffName(db, h.toId)}</span>
                          <span className="ml-2 text-xs text-ink-muted">{fmtSmart(h.createdAt)} · {h.caseId}</span></p>
                        <p className="mt-0.5 text-[13px] text-ink-muted">{h.summary}</p>
                        <p className={cn("mt-1 text-xs font-medium", h.status === "Pending" ? "text-warning-ink" : "text-success")}>{h.status === "Pending" ? "Awaiting acknowledgement" : `Acknowledged ${fmtSmart(h.acknowledgedAt)}`}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>
          </TabsRoot>
        </Card>
      </div>

      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Delete ${a.name}?`} destructive confirmLabel="Delete permanently"
        description={`This permanently removes ${a.name} (token ${a.token}), ${cases.length} case(s), ${updates.length} care updates, ${handovers.length} handovers and ${tasks.length} linked tasks. Consider archiving instead.`}
        onConfirm={() => { deleteAnimal(a.id); toast.success(`${a.name} deleted`); navigate("/animals"); }} />
    </div>
  );
}
