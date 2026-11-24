import type { Role, Staff, Task } from "./types";

export type Permission =
  | "animal.create"
  | "animal.edit"
  | "animal.archive"
  | "animal.delete"
  | "case.create"
  | "case.status"
  | "case.careUpdate"
  | "case.surgery"
  | "case.viewAll"
  | "task.create"
  | "task.assign"
  | "task.editAny"
  | "task.delete"
  | "handover.create"
  | "staff.manage"
  | "schedule.manage"
  | "settings.manage";

const MATRIX: Record<Role, Permission[]> = {
  Manager: [
    "animal.create", "animal.edit", "animal.archive", "animal.delete",
    "case.create", "case.status", "case.careUpdate", "case.surgery", "case.viewAll",
    "task.create", "task.assign", "task.editAny", "task.delete",
    "handover.create", "staff.manage", "schedule.manage", "settings.manage",
  ],
  Doctor: [
    "animal.create", "animal.edit",
    "case.create", "case.status", "case.careUpdate", "case.surgery", "case.viewAll",
    "task.create", "task.assign", "task.editAny",
    "handover.create",
  ],
  Assistant: ["animal.create", "case.careUpdate", "handover.create"],
  "Support Staff": [],
};

export function can(user: Staff | undefined, p: Permission) {
  if (!user) return false;
  return MATRIX[user.role].includes(p);
}

/** Support staff may only update operational (cleaning, feeding, general) tasks assigned to them. */
const SUPPORT_CATEGORIES = ["Cleaning", "Feeding", "General"];

export function canUpdateTask(user: Staff | undefined, t: Task) {
  if (!user) return false;
  if (can(user, "task.editAny")) return true;
  if (t.assigneeId !== user.id) return false;
  if (user.role === "Support Staff") return SUPPORT_CATEGORIES.includes(t.category);
  return true;
}

export const ROLE_SUMMARY: Record<Role, string[]> = {
  Manager: ["Full access", "Manage staff", "View all cases", "Assign tasks", "Manage schedules"],
  Doctor: ["View cases", "Update assessments", "Create care plans", "Record treatments", "Assign follow-up actions"],
  Assistant: ["View assigned cases", "Update care progress", "Complete assigned tasks", "Create handovers"],
  "Support Staff": ["View assigned tasks", "Update cleaning & maintenance tasks", "Update operational activities"],
};
