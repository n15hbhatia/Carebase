import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { produce, type Draft } from "immer";
import { toast } from "sonner";
import { getAdapter, type DataAdapter } from "./adapters";
import type {
  ActivityLog, ActivityType, Animal, Case, CaseStatus, CareUpdate, Database, DutySchedule, Handover,
  Notification, NotificationType, Priority, Settings, Staff, SurgeryStatus, Task, TaskStatus, UpdateType,
} from "./types";
import { nowISO, taskDueDate } from "./utils";

// ---------- input shapes ----------
export type AnimalInput = Omit<Animal, "id" | "createdAt" | "updatedAt" | "archived">;
export interface CaseInput {
  animalId: string;
  token: string;
  reason: string;
  doctorId?: string;
  responsibleId?: string;
  nextAction: string;
  status?: CaseStatus;
}
export interface CareUpdateInput {
  type: UpdateType;
  description: string;
  status: CaseStatus;
  nextAction: string;
  responsibleId?: string;
}
export type TaskInput = Omit<Task, "id" | "createdAt" | "updatedAt" | "createdBy" | "completedAt" | "completedBy">;
export interface HandoverInput {
  caseId: string;
  fromId: string;
  toId: string;
  previousAction: string;
  currentStatus: CaseStatus;
  nextAction: string;
  notes?: string;
  priority: Priority;
  summary: string;
}
export type StaffInput = Omit<Staff, "id" | "createdAt" | "updatedAt">;
export type DutyInput = Omit<DutySchedule, "id" | "createdAt" | "updatedAt">;

const SESSION_KEY = "carebase:session";
const readSession = () => {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
};
const writeSession = (v: string | null) => {
  try {
    if (v) window.localStorage.setItem(SESSION_KEY, v);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
};

type D = Draft<Database>;
const pad = (n: number, w: number) => String(n).padStart(w, "0");
function nextId(db: D, counter: string, prefix: string, width: number) {
  db.counters[counter] = (db.counters[counter] ?? 0) + 1;
  return `${prefix}${pad(db.counters[counter], width)}`;
}
function addLog(db: D, entry: Omit<ActivityLog, "id" | "createdAt"> & { createdAt?: string }) {
  db.activityLogs.unshift({ id: nextId(db, "activity", "ACT-", 4), createdAt: entry.createdAt ?? nowISO(), ...entry });
}
function addNotification(db: D, n: { recipientId?: string; type: NotificationType; title: string; message: string; link: string; key?: string }, actorId?: string) {
  if (!n.recipientId || n.recipientId === actorId) return;
  if (n.key && db.notifications.some((x) => x.key === n.key)) return;
  db.notifications.unshift({
    id: nextId(db, "notification", "NTF-", 4), recipientId: n.recipientId, type: n.type, title: n.title,
    message: n.message, link: n.link, key: n.key, read: false, createdAt: nowISO(),
  });
}
const nameIn = (db: D | Database, id?: string) => db.staff.find((s) => s.id === id)?.name ?? "Unassigned";
const animalIn = (db: D | Database, id: string) => db.animals.find((a) => a.id === id);
const caseLabel = (db: D | Database, c: Case) => `${animalIn(db, c.animalId)?.name ?? "Animal"} (token ${c.token})`;

/** Core state transition shared by care updates, status changes and handovers. */
function applyCareUpdate(db: D, caseId: string, input: CareUpdateInput, actorId: string, opts: { keepLastAction?: boolean } = {}) {
  const c = db.cases.find((x) => x.id === caseId);
  if (!c) throw new Error("Case not found");
  const at = nowISO();
  const prevStatus = c.status;
  const prevResponsible = c.responsibleId;
  db.careUpdates.push({
    id: nextId(db, "careUpdate", "CU-", 4), caseId, type: input.type, description: input.description,
    status: input.status, nextAction: input.nextAction, responsibleId: input.responsibleId, createdBy: actorId, createdAt: at,
  });
  c.status = input.status;
  c.nextAction = input.nextAction;
  if (!opts.keepLastAction) c.lastAction = input.description;
  if (input.responsibleId) c.responsibleId = input.responsibleId;
  c.updatedAt = at;
  if (input.status === "Completed") c.closedAt = c.closedAt ?? at;
  else c.closedAt = undefined;
  const label = caseLabel(db, c);
  if (input.type !== "Handover") {
    addLog(db, { action: "Care Update", description: `${input.type} — ${input.description} (${label})`, caseId, animalId: c.animalId, staffId: actorId, createdAt: at });
  }
  if (prevStatus !== input.status) {
    addLog(db, { action: "Status Updated", description: `${label} moved from ${prevStatus} to ${input.status}`, caseId, animalId: c.animalId, staffId: actorId, createdAt: at });
    const recipients = new Set([c.responsibleId, c.doctorId]);
    recipients.forEach((r) =>
      addNotification(db, { recipientId: r, type: "Case Status Updated", title: "Case status updated", message: `${label} is now ${input.status}.`, link: `/cases/${caseId}` }, actorId),
    );
  }
  if (input.type !== "Handover" && input.responsibleId && input.responsibleId !== prevResponsible) {
    addNotification(db, { recipientId: input.responsibleId, type: "Case Assigned", title: "Case assigned to you", message: `You are now responsible for ${label}: ${input.nextAction}.`, link: `/cases/${caseId}` }, actorId);
  }
}

interface StoreValue {
  db: Database;
  ready: boolean;
  mode: DataAdapter["mode"];
  user?: Staff;
  login(staffId: string): void;
  logout(): void;
  // animals
  addAnimal(input: AnimalInput, openCase?: Omit<CaseInput, "animalId" | "token"> | null): Animal;
  updateAnimal(id: string, patch: Partial<AnimalInput>): void;
  setAnimalArchived(id: string, archived: boolean): void;
  deleteAnimal(id: string): void;
  // cases
  createCase(input: CaseInput): Case;
  updateCaseAssignment(id: string, patch: { doctorId?: string; responsibleId?: string; reason?: string }): void;
  addCareUpdate(caseId: string, input: CareUpdateInput): CareUpdate;
  scheduleSurgery(caseId: string, input: { at: string; procedure: string; status: SurgeryStatus }): void;
  // tasks
  createTask(input: TaskInput): Task;
  updateTask(id: string, patch: Partial<TaskInput>): void;
  setTaskStatus(id: string, status: TaskStatus): void;
  deleteTask(id: string): void;
  // handovers
  createHandover(input: HandoverInput): Handover;
  acknowledgeHandover(id: string): void;
  // staff
  addStaff(input: StaffInput): Staff;
  updateStaff(id: string, patch: Partial<StaffInput>): void;
  // schedule
  saveDuty(input: DutyInput, id?: string): void;
  deleteDuty(id: string): void;
  // notifications
  markNotificationRead(id: string): void;
  markAllNotificationsRead(): void;
  // settings
  updateSettings(patch: Partial<Settings>): void;
  resetDemoData(): Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<Database | null>(null);
  const [adapter, setAdapter] = useState<DataAdapter | null>(null);
  const [userId, setUserId] = useState<string | null>(() => readSession());
  const dbRef = useRef<Database | null>(null);
  dbRef.current = db;

  useEffect(() => {
    let alive = true;
    (async () => {
      const a = await getAdapter();
      const data = await a.load();
      if (!alive) return;
      setAdapter(a);
      setDb(sweep(data));
    })().catch((e) => {
      console.error(e);
      toast.error("Could not load shelter data");
    });
    return () => {
      alive = false;
    };
  }, []);

  // Persist on every change.
  const prevSaved = useRef<Database | null>(null);
  useEffect(() => {
    if (!db || !adapter) return;
    const prev = prevSaved.current ?? db;
    prevSaved.current = db;
    adapter.save(db, prev).catch((e) => {
      console.error(e);
      toast.error("Changes could not be saved");
    });
  }, [db, adapter]);

  // Generate time-based reminders (overdue tasks, unacknowledged handovers) every minute.
  useEffect(() => {
    const t = window.setInterval(() => setDb((d) => (d ? sweep(d) : d)), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const user = db?.staff.find((s) => s.id === userId && s.active);

  /** Run a mutation against the current DB. Returns the recipe's return value. */
  const mutate = useCallback(<T,>(recipe: (draft: D, actor: string) => T): T => {
    const current = dbRef.current;
    if (!current) throw new Error("Data not loaded");
    const actor = readSession() ?? "system";
    let result!: T;
    const next = produce(current, (draft) => {
      result = recipe(draft, actor);
    });
    dbRef.current = next;
    setDb(next);
    return result;
  }, []);

  const value = useMemo<StoreValue | null>(() => {
    if (!db) return null;
    return {
      db,
      ready: true,
      mode: adapter?.mode ?? "local",
      user,
      login(staffId) {
        writeSession(staffId);
        setUserId(staffId);
      },
      logout() {
        writeSession(null);
        setUserId(null);
      },

      // ---------------- Animals ----------------
      addAnimal(input, openCase) {
        return mutate((d, actor) => {
          const at = nowISO();
          const animal: Animal = { ...input, id: nextId(d, "animal", "ANM-", 4), archived: false, createdAt: at, updatedAt: at };
          d.animals.push(animal);
          addLog(d, { action: "Animal Added", description: `${animal.name} registered as a new ${animal.type.toLowerCase()} (token ${animal.token})`, animalId: animal.id, staffId: actor });
          if (openCase) createCaseDraft(d, { ...openCase, animalId: animal.id, token: animal.token }, actor);
          return animal;
        });
      },
      updateAnimal(id, patch) {
        mutate((d, actor) => {
          const a = d.animals.find((x) => x.id === id);
          if (!a) return;
          Object.assign(a, patch, { updatedAt: nowISO() });
          addLog(d, { action: "Animal Updated", description: `${a.name}'s record updated`, animalId: id, staffId: actor });
        });
      },
      setAnimalArchived(id, archived) {
        mutate((d, actor) => {
          const a = d.animals.find((x) => x.id === id);
          if (!a) return;
          a.archived = archived;
          a.updatedAt = nowISO();
          addLog(d, { action: "Animal Archived", description: `${a.name}'s record ${archived ? "archived" : "restored from archive"}`, animalId: id, staffId: actor });
        });
      },
      deleteAnimal(id) {
        mutate((d, actor) => {
          const a = d.animals.find((x) => x.id === id);
          if (!a) return;
          const caseIds = new Set(d.cases.filter((c) => c.animalId === id).map((c) => c.id));
          d.animals = d.animals.filter((x) => x.id !== id);
          d.cases = d.cases.filter((c) => !caseIds.has(c.id));
          d.careUpdates = d.careUpdates.filter((u) => !caseIds.has(u.caseId));
          d.handovers = d.handovers.filter((h) => !caseIds.has(h.caseId));
          d.tasks = d.tasks.filter((t) => t.animalId !== id && !(t.caseId && caseIds.has(t.caseId)));
          addLog(d, { action: "Animal Deleted", description: `${a.name} (token ${a.token}) and ${caseIds.size} linked case(s) deleted`, staffId: actor });
        });
      },

      // ---------------- Cases ----------------
      createCase(input) {
        return mutate((d, actor) => createCaseDraft(d, input, actor));
      },
      updateCaseAssignment(id, patch) {
        mutate((d, actor) => {
          const c = d.cases.find((x) => x.id === id);
          if (!c) return;
          const changes: string[] = [];
          if (patch.doctorId !== undefined && patch.doctorId !== c.doctorId) {
            changes.push(`doctor → ${nameIn(d, patch.doctorId)}`);
            c.doctorId = patch.doctorId || undefined;
            addNotification(d, { recipientId: patch.doctorId, type: "Case Assigned", title: "Case assigned to you", message: `You are the assigned doctor for ${caseLabel(d, c)}.`, link: `/cases/${id}` }, actor);
          }
          if (patch.responsibleId !== undefined && patch.responsibleId !== c.responsibleId) {
            changes.push(`responsible → ${nameIn(d, patch.responsibleId)}`);
            c.responsibleId = patch.responsibleId || undefined;
            addNotification(d, { recipientId: patch.responsibleId, type: "Case Assigned", title: "Case assigned to you", message: `You are now responsible for ${caseLabel(d, c)}: ${c.nextAction}.`, link: `/cases/${id}` }, actor);
          }
          if (patch.reason !== undefined && patch.reason !== c.reason) {
            changes.push("reason updated");
            c.reason = patch.reason;
          }
          if (!changes.length) return;
          c.updatedAt = nowISO();
          addLog(d, { action: "Care Update", description: `Case details changed for ${caseLabel(d, c)}: ${changes.join(", ")}`, caseId: id, animalId: c.animalId, staffId: actor });
        });
      },
      addCareUpdate(caseId, input) {
        return mutate((d, actor) => {
          applyCareUpdate(d, caseId, input, actor);
          return d.careUpdates[d.careUpdates.length - 1] as CareUpdate;
        });
      },
      scheduleSurgery(caseId, input) {
        mutate((d, actor) => {
          const c = d.cases.find((x) => x.id === caseId);
          if (!c) return;
          const isNew = !c.surgeryAt || c.surgeryStatus === "Completed" || c.surgeryStatus === "Postponed";
          const prevStatus = c.surgeryStatus;
          c.surgeryAt = input.at;
          c.surgeryProcedure = input.procedure;
          c.surgeryStatus = input.status;
          const when = new Date(input.at).toLocaleString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
          if (input.status === "Scheduled" && (isNew || prevStatus !== "Scheduled")) {
            applyCareUpdate(d, caseId, { type: "Surgery", description: `${input.procedure} scheduled for ${when}`, status: "Surgery Scheduled", nextAction: `Prepare for surgery on ${when}`, responsibleId: c.responsibleId }, actor);
            addLog(d, { action: "Surgery Scheduled", description: `${input.procedure} for ${caseLabel(d, c)} on ${when}`, caseId, animalId: c.animalId, staffId: actor });
          } else if (input.status === "Completed" && prevStatus !== "Completed") {
            applyCareUpdate(d, caseId, { type: "Surgery", description: `${input.procedure} completed`, status: "Post-Surgery Recovery", nextAction: "Monitor recovery and pain score", responsibleId: c.responsibleId }, actor);
          } else {
            c.updatedAt = nowISO();
            addLog(d, { action: "Surgery Scheduled", description: `Surgery for ${caseLabel(d, c)} updated: ${input.status}, ${when}`, caseId, animalId: c.animalId, staffId: actor });
          }
        });
      },

      // ---------------- Tasks ----------------
      createTask(input) {
        return mutate((d, actor) => {
          const at = nowISO();
          const t: Task = { ...input, id: nextId(d, "task", "TSK-", 3), createdBy: actor, createdAt: at, updatedAt: at };
          if (t.caseId && !t.animalId) t.animalId = d.cases.find((c) => c.id === t.caseId)?.animalId;
          if (t.status === "Completed") {
            t.completedAt = at;
            t.completedBy = actor;
          }
          d.tasks.push(t);
          addLog(d, { action: "Task Assigned", description: `"${t.title}" assigned to ${nameIn(d, t.assigneeId)}`, caseId: t.caseId, animalId: t.animalId, staffId: actor });
          addNotification(d, { recipientId: t.assigneeId, type: "Task Assigned", title: "Task assigned to you", message: `${t.title} — due ${t.dueDate} at ${t.dueTime}.`, link: `/tasks?open=${t.id}` }, actor);
          return t;
        });
      },
      updateTask(id, patch) {
        mutate((d, actor) => {
          const t = d.tasks.find((x) => x.id === id);
          if (!t) return;
          const prevAssignee = t.assigneeId;
          const prevStatus = t.status;
          Object.assign(t, patch, { updatedAt: nowISO() });
          if (t.caseId) t.animalId = d.cases.find((c) => c.id === t.caseId)?.animalId ?? t.animalId;
          if (t.status === "Completed" && prevStatus !== "Completed") {
            t.completedAt = nowISO();
            t.completedBy = actor;
            addLog(d, { action: "Task Completed", description: `${nameIn(d, actor)} completed "${t.title}"`, caseId: t.caseId, animalId: t.animalId, staffId: actor });
          } else if (t.status !== "Completed") {
            t.completedAt = undefined;
            t.completedBy = undefined;
          }
          if (prevAssignee !== t.assigneeId) {
            addLog(d, { action: "Task Assigned", description: `"${t.title}" reassigned to ${nameIn(d, t.assigneeId)}`, caseId: t.caseId, animalId: t.animalId, staffId: actor });
            addNotification(d, { recipientId: t.assigneeId, type: "Task Assigned", title: "Task assigned to you", message: `${t.title} — due ${t.dueDate} at ${t.dueTime}.`, link: `/tasks?open=${t.id}` }, actor);
          } else if (!(t.status === "Completed" && prevStatus !== "Completed")) {
            addLog(d, { action: "Task Updated", description: `"${t.title}" updated (${t.status})`, caseId: t.caseId, animalId: t.animalId, staffId: actor });
          }
        });
      },
      setTaskStatus(id, status) {
        mutate((d, actor) => {
          const t = d.tasks.find((x) => x.id === id);
          if (!t || t.status === status) return;
          t.status = status;
          t.updatedAt = nowISO();
          if (status === "Completed") {
            t.completedAt = t.updatedAt;
            t.completedBy = actor;
            addLog(d, { action: "Task Completed", description: `${nameIn(d, actor)} completed "${t.title}"`, caseId: t.caseId, animalId: t.animalId, staffId: actor });
          } else {
            t.completedAt = undefined;
            t.completedBy = undefined;
            addLog(d, { action: "Task Updated", description: `"${t.title}" moved to ${status}`, caseId: t.caseId, animalId: t.animalId, staffId: actor });
          }
        });
      },
      deleteTask(id) {
        mutate((d, actor) => {
          const t = d.tasks.find((x) => x.id === id);
          if (!t) return;
          d.tasks = d.tasks.filter((x) => x.id !== id);
          addLog(d, { action: "Task Deleted", description: `Task "${t.title}" deleted`, caseId: t.caseId, animalId: t.animalId, staffId: actor });
        });
      },

      // ---------------- Handovers ----------------
      createHandover(input) {
        return mutate((d, actor) => {
          const c = d.cases.find((x) => x.id === input.caseId);
          if (!c) throw new Error("Case not found");
          const h: Handover = {
            id: nextId(d, "handover", "HO-", 3), ...input, status: "Pending", createdBy: actor, createdAt: nowISO(),
          };
          d.handovers.push(h);
          // Responsibility stays with the sender until the receiver acknowledges.
          applyCareUpdate(d, c.id, {
            type: "Handover", description: `Handover to ${nameIn(d, input.toId)}: ${input.summary}`,
            status: input.currentStatus, nextAction: input.nextAction, responsibleId: c.responsibleId,
          }, actor, { keepLastAction: true });
          addLog(d, { action: "Handover Created", description: `${nameIn(d, input.fromId)} handed over ${caseLabel(d, c)} to ${nameIn(d, input.toId)}`, caseId: c.id, animalId: c.animalId, staffId: actor });
          addNotification(d, { recipientId: input.toId, type: "Handover Received", title: "New handover received", message: `${nameIn(d, input.fromId)} handed over ${caseLabel(d, c)} to you. Please acknowledge.`, link: `/handovers?open=${h.id}` }, actor);
          return h;
        });
      },
      acknowledgeHandover(id) {
        mutate((d, actor) => {
          const h = d.handovers.find((x) => x.id === id);
          if (!h || h.status === "Acknowledged") return;
          if (h.toId !== actor) throw new Error("Only the receiving staff member can acknowledge this handover.");
          const at = nowISO();
          h.status = "Acknowledged";
          h.acknowledgedAt = at;
          h.acceptedResponsibility = true;
          const c = d.cases.find((x) => x.id === h.caseId);
          if (c) {
            c.responsibleId = h.toId;
            c.updatedAt = at;
            addLog(d, { action: "Handover Acknowledged", description: `${nameIn(d, h.toId)} acknowledged handover ${h.id} and accepted responsibility for ${caseLabel(d, c)}`, caseId: c.id, animalId: c.animalId, staffId: actor });
            addNotification(d, { recipientId: h.fromId, type: "Case Status Updated", title: "Handover acknowledged", message: `${nameIn(d, h.toId)} accepted responsibility for ${caseLabel(d, c)}.`, link: `/cases/${c.id}` }, actor);
          }
          d.notifications.forEach((n) => {
            if (n.recipientId === actor && n.link.includes(h.id)) n.read = true;
          });
        });
      },

      // ---------------- Staff ----------------
      addStaff(input) {
        return mutate((d, actor) => {
          const at = nowISO();
          const s: Staff = { ...input, id: nextId(d, "staff", "STF-", 3), createdAt: at, updatedAt: at };
          d.staff.push(s);
          addLog(d, { action: "Staff Added", description: `${s.name} added as ${s.role}`, staffId: actor });
          return s;
        });
      },
      updateStaff(id, patch) {
        mutate((d, actor) => {
          const s = d.staff.find((x) => x.id === id);
          if (!s) return;
          const wasActive = s.active;
          Object.assign(s, patch, { updatedAt: nowISO() });
          const what = patch.active !== undefined && patch.active !== wasActive ? (s.active ? "reactivated" : "deactivated") : "profile updated";
          addLog(d, { action: "Staff Updated", description: `${s.name} ${what}`, staffId: actor });
        });
      },

      // ---------------- Schedule ----------------
      saveDuty(input, id) {
        mutate((d, actor) => {
          const at = nowISO();
          if (id) {
            const row = d.dutySchedules.find((x) => x.id === id);
            if (row) Object.assign(row, input, { updatedAt: at });
          } else {
            d.dutySchedules.push({ ...input, id: nextId(d, "duty", "DS-", 4), createdAt: at, updatedAt: at });
          }
          addLog(d, { action: "Schedule Updated", description: `${nameIn(d, input.staffId)} ${id ? "duty changed" : "assigned"}: ${input.duty} (${input.shift}) on ${input.date}`, staffId: actor });
        });
      },
      deleteDuty(id) {
        mutate((d, actor) => {
          const row = d.dutySchedules.find((x) => x.id === id);
          if (!row) return;
          d.dutySchedules = d.dutySchedules.filter((x) => x.id !== id);
          addLog(d, { action: "Schedule Updated", description: `Removed ${nameIn(d, row.staffId)}'s ${row.duty} duty on ${row.date}`, staffId: actor });
        });
      },

      // ---------------- Notifications ----------------
      markNotificationRead(id) {
        mutate((d) => {
          const n = d.notifications.find((x) => x.id === id);
          if (n) n.read = true;
        });
      },
      markAllNotificationsRead() {
        mutate((d, actor) => {
          d.notifications.forEach((n) => {
            if (n.recipientId === actor) n.read = true;
          });
        });
      },

      // ---------------- Settings ----------------
      updateSettings(patch) {
        mutate((d, actor) => {
          Object.assign(d.settings, patch);
          addLog(d, { action: "Settings Updated", description: "Shelter settings updated", staffId: actor });
        });
      },
      async resetDemoData() {
        if (!adapter) return;
        const fresh = await adapter.reset();
        prevSaved.current = fresh;
        dbRef.current = fresh;
        setDb(sweep(fresh));
      },
    };
  }, [db, adapter, user, mutate]);

  if (!value) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas" role="status" aria-live="polite">
        <div className="flex items-center gap-3 text-sm text-ink-muted">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-teal border-t-transparent" />
          Loading shelter data…
        </div>
      </div>
    );
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function createCaseDraft(d: D, input: CaseInput, actor: string): Case {
  const animal = d.animals.find((a) => a.id === input.animalId);
  if (!animal) throw new Error("Animal not found");
  const at = nowISO();
  const num = Math.max(d.counters.case ?? 1000, ...d.cases.map((c) => Number(c.id.replace("CB-", "")) || 0)) + 1;
  d.counters.case = num;
  const c: Case = {
    id: `CB-${num}`, animalId: animal.id, token: input.token, reason: input.reason, status: "Newly Admitted",
    doctorId: input.doctorId || undefined, responsibleId: input.responsibleId || actor, lastAction: "Animal admitted",
    nextAction: input.nextAction, openedAt: at, createdBy: actor, createdAt: at, updatedAt: at,
  };
  d.cases.push(c);
  animal.token = input.token;
  animal.admissionDate = at;
  if (input.doctorId) animal.doctorId = input.doctorId;
  animal.updatedAt = at;
  const label = `${animal.name} (token ${input.token})`;
  d.careUpdates.push({
    id: nextId(d, "careUpdate", "CU-", 4), caseId: c.id, type: "Admission", description: `Animal admitted: ${input.reason}`,
    status: "Newly Admitted", nextAction: "Issue token", responsibleId: actor, createdBy: actor, createdAt: at,
  });
  d.careUpdates.push({
    id: nextId(d, "careUpdate", "CU-", 4), caseId: c.id, type: "Token Issued", description: `Token ${input.token} issued`,
    status: input.status ?? "Awaiting Assessment", nextAction: input.nextAction, responsibleId: c.responsibleId, createdBy: actor, createdAt: at,
  });
  c.status = input.status ?? "Awaiting Assessment";
  c.lastAction = `Token ${input.token} issued`;
  addLog(d, { action: "Case Created", description: `Case ${c.id} opened for ${label}: ${input.reason}`, caseId: c.id, animalId: animal.id, staffId: actor, createdAt: at });
  addNotification(d, { recipientId: c.responsibleId, type: "Case Assigned", title: "New case assigned", message: `${label} — ${input.nextAction}.`, link: `/cases/${c.id}` }, actor);
  if (c.doctorId && c.doctorId !== c.responsibleId) {
    addNotification(d, { recipientId: c.doctorId, type: "Case Assigned", title: "New case assigned", message: `You are the assigned doctor for ${label}.`, link: `/cases/${c.id}` }, actor);
  }
  return c;
}

/** Time-based reminders. Idempotent thanks to notification keys. */
function sweep(db: Database): Database {
  const now = new Date();
  return produce(db, (d) => {
    for (const t of d.tasks) {
      if (t.status !== "Completed" && taskDueDate(t) < now) {
        const key = `overdue:${t.id}:${t.dueDate}T${t.dueTime}`;
        if (!d.notifications.some((n) => n.key === key)) {
          d.notifications.unshift({
            id: nextId(d, "notification", "NTF-", 4), recipientId: t.assigneeId, type: "Task Overdue", title: "Task overdue",
            message: `${t.title} was due ${t.dueDate} at ${t.dueTime}.`, link: `/tasks?open=${t.id}`, read: false, key, createdAt: now.toISOString(),
          });
        }
      }
    }
    const hrs = d.settings.handoverReminderHours;
    for (const h of d.handovers) {
      if (h.status === "Pending" && now.getTime() - new Date(h.createdAt).getTime() > hrs * 3600_000) {
        const key = `handover-pending:${h.id}`;
        if (!d.notifications.some((n) => n.key === key)) {
          const c = d.cases.find((x) => x.id === h.caseId);
          d.notifications.unshift({
            id: nextId(d, "notification", "NTF-", 4), recipientId: h.toId, type: "Handover Pending", title: "Handover awaiting acknowledgement",
            message: `${c ? caseLabel(d, c as Case) : h.caseId} was handed to you over ${hrs} hours ago.`, link: `/handovers?open=${h.id}`, read: false, key, createdAt: now.toISOString(),
          });
        }
      }
    }
  });
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

export type { ActivityType, Notification };
