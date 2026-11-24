import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, formatDistanceToNowStrict, isToday, isYesterday, parseISO } from "date-fns";
import type { Animal, Case, CaseStatus, Database, Staff, Task, TaskDisplayStatus } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const nowISO = () => new Date().toISOString();

export function fmtDate(iso?: string) {
  if (!iso) return "—";
  return format(parseISO(iso), "d MMM yyyy");
}
export function fmtTime(iso?: string) {
  if (!iso) return "—";
  return format(parseISO(iso), "h:mm a");
}
export function fmtDateTime(iso?: string) {
  if (!iso) return "—";
  return format(parseISO(iso), "d MMM yyyy, h:mm a");
}
/** "Today, 9:40 AM" / "Yesterday, 4:10 PM" / "12 Nov, 2:00 PM" */
export function fmtSmart(iso?: string) {
  if (!iso) return "—";
  const d = parseISO(iso);
  if (isToday(d)) return `Today, ${format(d, "h:mm a")}`;
  if (isYesterday(d)) return `Yesterday, ${format(d, "h:mm a")}`;
  return format(d, "d MMM, h:mm a");
}
export function fmtAgo(iso?: string) {
  if (!iso) return "—";
  return `${formatDistanceToNowStrict(parseISO(iso))} ago`;
}
export function fmtClock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return format(d, "h:mm a");
}

export function initials(name: string) {
  return name
    .replace(/^(Dr\.?)\s+/i, "")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Stable avatar tint per person, drawn from the restrained palette.
const AVATAR_TINTS = [
  "bg-[#E8F3F2] text-[#167D83]",
  "bg-[#E6EEF3] text-[#103B50]",
  "bg-[#FBF3E4] text-[#94651A]",
  "bg-[#E6F3EC] text-[#26845B]",
  "bg-[#EFEAF5] text-[#5B4A86]",
  "bg-[#FBEAEA] text-[#B03A36]",
];
export function avatarTint(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_TINTS[h % AVATAR_TINTS.length];
}

// ---------- status styling (single source of truth) ----------
export type Tone = "teal" | "navy" | "warning" | "danger" | "success" | "neutral" | "violet";

export const CASE_STATUS_TONE: Record<CaseStatus, Tone> = {
  "Newly Admitted": "navy",
  "Awaiting Assessment": "warning",
  "Under Assessment": "teal",
  "Care Plan Decided": "teal",
  "Awaiting Treatment": "warning",
  "In Treatment": "teal",
  "Surgery Scheduled": "violet",
  "Post-Surgery Recovery": "violet",
  "Under Observation": "navy",
  Completed: "success",
};

export const TASK_STATUS_TONE: Record<TaskDisplayStatus, Tone> = {
  "To Do": "neutral",
  "In Progress": "teal",
  Completed: "success",
  Overdue: "danger",
};

export const PRIORITY_TONE: Record<string, Tone> = {
  Low: "neutral",
  Normal: "navy",
  Medium: "navy",
  High: "warning",
  Urgent: "danger",
};

export const TONE_CLASSES: Record<Tone, { badge: string; dot: string }> = {
  teal: { badge: "bg-teal-soft text-teal border-teal/15", dot: "bg-teal" },
  navy: { badge: "bg-[#E9EFF3] text-navy border-navy/10", dot: "bg-navy" },
  warning: { badge: "bg-warning-soft text-warning-ink border-warning/20", dot: "bg-warning" },
  danger: { badge: "bg-danger-soft text-danger-ink border-danger/20", dot: "bg-danger" },
  success: { badge: "bg-success-soft text-success border-success/20", dot: "bg-success" },
  neutral: { badge: "bg-[#F1F4F7] text-[#4A5A68] border-line", dot: "bg-[#A0AEC0]" },
  violet: { badge: "bg-[#F0ECF7] text-[#5B4A86] border-[#5B4A86]/15", dot: "bg-[#6E5BA6]" },
};

// ---------- derived data helpers ----------
export function taskDueDate(t: Task) {
  return new Date(`${t.dueDate}T${t.dueTime || "23:59"}:00`);
}
export function taskDisplayStatus(t: Task, now = new Date()): TaskDisplayStatus {
  if (t.status === "Completed") return "Completed";
  if (taskDueDate(t) < now) return "Overdue";
  return t.status;
}

export const isActiveCase = (c: Case) => c.status !== "Completed";

/** The animal's current (open) case, or its most recent case if all are closed. */
export function currentCaseFor(db: Database, animalId: string): Case | undefined {
  const cases = db.cases.filter((c) => c.animalId === animalId);
  const open = cases.filter(isActiveCase).sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  if (open.length) return open[0];
  return cases.sort((a, b) => b.openedAt.localeCompare(a.openedAt))[0];
}

export function animalStatus(db: Database, a: Animal): CaseStatus | "No Active Case" {
  const c = currentCaseFor(db, a.id);
  if (!c) return "No Active Case";
  return c.status;
}

export function staffName(db: Database, id?: string) {
  if (!id) return "Unassigned";
  return db.staff.find((s) => s.id === id)?.name ?? "Unknown";
}
export function staffById(db: Database, id?: string): Staff | undefined {
  return id ? db.staff.find((s) => s.id === id) : undefined;
}

/** Short role label used in handover summaries, e.g. "Dr. Meera Iyer". */
export function shortName(s?: Staff) {
  if (!s) return "the assigned staff member";
  return s.name;
}

/** Two-sentence structured handover summary, editable before submit. */
export function generateHandoverSummary(opts: {
  previousAction: string;
  fromName: string;
  toName: string;
  nextAction: string;
  status: string;
  animalName: string;
  token: string;
}) {
  const prev = opts.previousAction.trim().replace(/\.$/, "");
  const next = opts.nextAction.trim().replace(/\.$/, "");
  const s1 = prev
    ? `${opts.animalName} (token ${opts.token}) is ${opts.status.toLowerCase()}; last action by ${opts.fromName}: ${lowerFirst(prev)}.`
    : `${opts.animalName} (token ${opts.token}) is ${opts.status.toLowerCase()}, handed over by ${opts.fromName}.`;
  const s2 = next
    ? `${opts.toName} is responsible for the next step — ${lowerFirst(next)} — and for recording the outcome.`
    : `${opts.toName} is now responsible for this case and for recording the next update.`;
  return `${s1} ${s2}`;
}
const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s.charAt(0).toLowerCase() + s.slice(1) : s);

export function pluralise(n: number, word: string, plural = `${word}s`) {
  return `${n} ${n === 1 ? word : plural}`;
}

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
