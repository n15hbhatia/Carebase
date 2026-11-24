// Carebase domain model. Mirrors the Supabase schema in supabase/migrations.

export type Role = "Manager" | "Doctor" | "Assistant" | "Support Staff";
export const ROLES: Role[] = ["Manager", "Doctor", "Assistant", "Support Staff"];

export interface Staff {
  id: string; // STF-001
  name: string;
  role: Role;
  email: string;
  phone: string;
  active: boolean;
  joinedAt: string; // ISO date
  createdAt: string;
  updatedAt: string;
}

export type AnimalType = "Dog" | "Cat" | "Other";
export const ANIMAL_TYPES: AnimalType[] = ["Dog", "Cat", "Other"];
export type Sex = "Male" | "Female" | "Unknown";
export const SEXES: Sex[] = ["Male", "Female", "Unknown"];

export interface Animal {
  id: string; // ANM-0001
  token: string; // current physical token number e.g. "021"
  name: string;
  type: AnimalType;
  breed: string;
  age: string; // free text, e.g. "3 yrs", "8 months"
  sex: Sex;
  admissionDate: string; // ISO datetime
  ownerName?: string;
  contactNumber?: string;
  doctorId?: string;
  notes?: string;
  imageUrl?: string; // data URL in demo mode, storage URL in Supabase
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export const CASE_STATUSES = [
  "Newly Admitted",
  "Awaiting Assessment",
  "Under Assessment",
  "Care Plan Decided",
  "Awaiting Treatment",
  "In Treatment",
  "Surgery Scheduled",
  "Post-Surgery Recovery",
  "Under Observation",
  "Completed",
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export type SurgeryStatus = "Scheduled" | "In Progress" | "Completed" | "Postponed";
export const SURGERY_STATUSES: SurgeryStatus[] = ["Scheduled", "In Progress", "Completed", "Postponed"];

export interface Case {
  id: string; // CB-1021
  animalId: string;
  token: string; // token issued for this admission
  reason: string; // reason for admission / presenting concern
  status: CaseStatus;
  doctorId?: string;
  responsibleId?: string;
  lastAction: string;
  nextAction: string;
  openedAt: string;
  closedAt?: string;
  surgeryAt?: string; // ISO datetime
  surgeryStatus?: SurgeryStatus;
  surgeryProcedure?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export const UPDATE_TYPES = [
  "Admission",
  "Token Issued",
  "Assessment",
  "Care Plan",
  "Treatment",
  "Medication",
  "Surgery",
  "Observation",
  "Feeding",
  "Status Change",
  "Handover",
  "General Note",
] as const;
export type UpdateType = (typeof UPDATE_TYPES)[number];

export interface CareUpdate {
  id: string; // CU-0001
  caseId: string;
  type: UpdateType;
  description: string;
  status: CaseStatus; // status after this update
  nextAction: string;
  responsibleId?: string;
  createdBy: string;
  createdAt: string;
}

export type Priority = "Low" | "Normal" | "High" | "Urgent";
export const PRIORITIES: Priority[] = ["Low", "Normal", "High", "Urgent"];

export type HandoverStatus = "Pending" | "Acknowledged";

export interface Handover {
  id: string; // HO-001
  caseId: string;
  fromId: string;
  toId: string;
  previousAction: string;
  currentStatus: CaseStatus;
  nextAction: string;
  notes?: string;
  priority: Priority;
  summary: string;
  status: HandoverStatus;
  createdBy: string;
  createdAt: string;
  acknowledgedAt?: string;
  acceptedResponsibility?: boolean;
}

export const TASK_CATEGORIES = [
  "Feeding",
  "Medication",
  "Cleaning",
  "Examination",
  "Surgery Preparation",
  "Post-Surgery Care",
  "Observation",
  "General",
] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

export type TaskStatus = "To Do" | "In Progress" | "Completed";
export const TASK_STATUSES: TaskStatus[] = ["To Do", "In Progress", "Completed"];
export type TaskDisplayStatus = TaskStatus | "Overdue";
export type TaskPriority = "Low" | "Medium" | "High";
export const TASK_PRIORITIES: TaskPriority[] = ["Low", "Medium", "High"];

export interface Task {
  id: string; // TSK-001
  title: string;
  description?: string;
  category: TaskCategory;
  animalId?: string;
  caseId?: string;
  assigneeId: string;
  dueDate: string; // yyyy-MM-dd
  dueTime: string; // HH:mm
  priority: TaskPriority;
  status: TaskStatus;
  completedAt?: string;
  completedBy?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type Shift = "Morning" | "Afternoon" | "Evening" | "Full Day";
export const SHIFTS: Shift[] = ["Morning", "Afternoon", "Evening", "Full Day"];
export const SHIFT_HOURS: Record<Shift, string> = {
  Morning: "07:00 – 13:00",
  Afternoon: "13:00 – 19:00",
  Evening: "19:00 – 23:00",
  "Full Day": "09:00 – 18:00",
};
export const DUTY_TYPES = [
  "Surgery",
  "Surgery Assist",
  "OPD & Assessments",
  "Ward Rounds",
  "Admissions Desk",
  "Feeding Round",
  "Medication Round",
  "Kennel Cleaning",
  "Cattery Cleaning",
  "Laundry & Supplies",
  "Shelter Management",
] as const;
export type DutyType = (typeof DUTY_TYPES)[number];

export interface DutySchedule {
  id: string; // DS-0001
  date: string; // yyyy-MM-dd
  staffId: string;
  shift: Shift;
  duty: DutyType;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export const ACTIVITY_TYPES = [
  "Animal Added",
  "Animal Updated",
  "Animal Archived",
  "Animal Deleted",
  "Case Created",
  "Status Updated",
  "Care Update",
  "Surgery Scheduled",
  "Task Assigned",
  "Task Updated",
  "Task Completed",
  "Task Deleted",
  "Handover Created",
  "Handover Acknowledged",
  "Staff Added",
  "Staff Updated",
  "Schedule Updated",
  "Settings Updated",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export interface ActivityLog {
  id: string; // ACT-0001
  action: ActivityType;
  description: string;
  caseId?: string;
  animalId?: string;
  staffId: string; // user responsible
  createdAt: string;
}

export type NotificationType =
  | "Case Assigned"
  | "Handover Received"
  | "Handover Pending"
  | "Task Assigned"
  | "Task Overdue"
  | "Case Status Updated";

export interface Notification {
  id: string;
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  read: boolean;
  key?: string; // de-duplication key for generated reminders
  createdAt: string;
}

export interface Settings {
  shelterName: string;
  location: string;
  surgeryDays: number[]; // 0 = Sunday … 6 = Saturday
  surgeryStartTime: string; // HH:mm
  handoverReminderHours: number;
}

export interface Database {
  version: number;
  staff: Staff[];
  animals: Animal[];
  cases: Case[];
  careUpdates: CareUpdate[];
  handovers: Handover[];
  tasks: Task[];
  dutySchedules: DutySchedule[];
  activityLogs: ActivityLog[];
  notifications: Notification[];
  settings: Settings;
  counters: Record<string, number>;
}
