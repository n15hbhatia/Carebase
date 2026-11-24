// Realistic, entirely fictional sample data for Carebase demo mode.
// All dates are generated relative to "now" so the dashboard always reflects a live shelter day.
// Treatment descriptions are illustrative only and are not veterinary advice.

import { addDays, format, set, subMinutes } from "date-fns";
import type {
  ActivityLog, Animal, Case, CareUpdate, CaseStatus, Database, DutySchedule, DutyType, Handover,
  Notification, Priority, Settings, Shift, Staff, Task, TaskCategory, TaskPriority, TaskStatus, UpdateType,
} from "@/lib/types";
import { generateHandoverSummary } from "@/lib/utils";

export const DB_VERSION = 3;

export const DEFAULT_SETTINGS: Settings = {
  shelterName: "Worli Animal Care Shelter",
  location: "Worli, Mumbai",
  surgeryDays: [1, 2, 4, 5],
  surgeryStartTime: "10:00",
  handoverReminderHours: 4,
};

export function buildSeed(now = new Date()): Database {
  const iso = (d: Date) => d.toISOString();
  const dayAt = (offset: number, hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return iso(set(addDays(now, offset), { hours: h, minutes: m, seconds: 0, milliseconds: 0 }));
  };
  const ago = (minutes: number) => iso(subMinutes(now, minutes));
  const ymd = (offset: number) => format(addDays(now, offset), "yyyy-MM-dd");
  const addMin = (isoStr: string, m: number) => iso(new Date(new Date(isoStr).getTime() + m * 60000));

  const surgeryDays = DEFAULT_SETTINGS.surgeryDays;
  // Dr. Meera Iyer operates Mon/Thu, Dr. Farhan Qureshi Tue/Fri (matches the duty schedule below).
  const nextDowOffset = (dows: number[], nth = 1) => {
    let found = 0;
    for (let i = 1; i < 30; i++) if (dows.includes(addDays(now, i).getDay()) && ++found === nth) return i;
    return 1;
  };
  const prevSurgeryOffset = () => {
    for (let i = -1; i > -10; i--) if ([1, 4].includes(addDays(now, i).getDay())) return i;
    return -1;
  };

  // ---------------- Staff (fictional) ----------------
  const S = {
    anjali: "STF-001", meera: "STF-002", farhan: "STF-003", rohan: "STF-004", sneha: "STF-005",
    imran: "STF-006", priya: "STF-007", ganesh: "STF-008", lata: "STF-009", suresh: "STF-010",
  };
  const staffRows: [string, string, Staff["role"], string, string][] = [
    [S.anjali, "Anjali Deshmukh", "Manager", "anjali.d@carebase.demo", "+91 98200 11021"],
    [S.meera, "Dr. Meera Iyer", "Doctor", "meera.i@carebase.demo", "+91 98200 11022"],
    [S.farhan, "Dr. Farhan Qureshi", "Doctor", "farhan.q@carebase.demo", "+91 98200 11023"],
    [S.rohan, "Rohan Patil", "Assistant", "rohan.p@carebase.demo", "+91 98200 11024"],
    [S.sneha, "Sneha Kulkarni", "Assistant", "sneha.k@carebase.demo", "+91 98200 11025"],
    [S.imran, "Imran Shaikh", "Assistant", "imran.s@carebase.demo", "+91 98200 11026"],
    [S.priya, "Priya Nair", "Assistant", "priya.n@carebase.demo", "+91 98200 11027"],
    [S.ganesh, "Ganesh Jadhav", "Support Staff", "ganesh.j@carebase.demo", "+91 98200 11028"],
    [S.lata, "Lata Waghmare", "Support Staff", "lata.w@carebase.demo", "+91 98200 11029"],
    [S.suresh, "Suresh More", "Support Staff", "suresh.m@carebase.demo", "+91 98200 11030"],
  ];
  const staff: Staff[] = staffRows.map(([id, name, role, email, phone], i) => ({
    id, name, role, email, phone, active: true,
    joinedAt: dayAt(-900 + i * 70, "09:00"), createdAt: dayAt(-900 + i * 70, "09:00"), updatedAt: dayAt(-30, "09:00"),
  }));
  const nameOf = (id: string) => staff.find((s) => s.id === id)!.name;

  // ---------------- Animals ----------------
  type AnimalSeed = Omit<Animal, "createdAt" | "updatedAt" | "archived" | "admissionDate"> & { archived?: boolean };
  const animalSeeds: AnimalSeed[] = [
    { id: "ANM-0001", token: "021", name: "Bruno", type: "Dog", breed: "Indian Pariah", age: "4 yrs", sex: "Male", doctorId: S.meera, notes: "Brought in by a resident of BDD Chawl. Friendly, nervous around loud noises.", ownerName: "", contactNumber: "" },
    { id: "ANM-0002", token: "022", name: "Luna", type: "Cat", breed: "Indian Shorthair", age: "2 yrs", sex: "Female", doctorId: S.farhan, notes: "Community cat from Worli Koliwada. Fed by the local fisherfolk.", ownerName: "Kavita Sawant", contactNumber: "+91 98670 44312" },
    { id: "ANM-0003", token: "023", name: "Coco", type: "Dog", breed: "Labrador mix", age: "7 yrs", sex: "Female", doctorId: S.meera, notes: "Owned dog. Owner visits in the evenings.", ownerName: "Rahul Mehta", contactNumber: "+91 99300 21876" },
    { id: "ANM-0004", token: "024", name: "Miki", type: "Cat", breed: "Indian Shorthair", age: "6 months", sex: "Male", doctorId: S.farhan, notes: "Found near Worli Sea Face, underweight." },
    { id: "ANM-0005", token: "025", name: "Tom", type: "Cat", breed: "Persian mix", age: "5 yrs", sex: "Male", doctorId: S.farhan, notes: "Returning patient — treated here three months ago.", ownerName: "Fatima Khan", contactNumber: "+91 98191 55302" },
    { id: "ANM-0006", token: "026", name: "Sheru", type: "Dog", breed: "Indian Pariah", age: "3 yrs", sex: "Male", doctorId: S.meera, notes: "Road accident case reported by traffic police." },
    { id: "ANM-0007", token: "027", name: "Kali", type: "Dog", breed: "Indian Pariah", age: "1 yr", sex: "Female", doctorId: S.meera, notes: "Rescued from a construction site in Lower Parel." },
    { id: "ANM-0008", token: "018", name: "Motu", type: "Dog", breed: "Beagle mix", age: "6 yrs", sex: "Male", doctorId: S.farhan, notes: "Owned. Calm, eats well.", ownerName: "Sanjay Rane", contactNumber: "+91 98330 77810" },
    { id: "ANM-0009", token: "019", name: "Simba", type: "Cat", breed: "Indian Shorthair", age: "1 yr", sex: "Male", doctorId: S.farhan, notes: "Community cat, brought in for sterilisation drive." },
    { id: "ANM-0010", token: "020", name: "Raju", type: "Dog", breed: "Indian Pariah", age: "9 yrs", sex: "Male", doctorId: S.meera, notes: "Senior dog, gentle. Needs soft food." },
    { id: "ANM-0011", token: "016", name: "Chiku", type: "Other", breed: "Rabbit (Dutch)", age: "2 yrs", sex: "Female", doctorId: S.farhan, notes: "Pet rabbit. Keep away from dog ward.", ownerName: "Neha Joshi", contactNumber: "+91 97690 11455" },
    { id: "ANM-0012", token: "017", name: "Bhura", type: "Dog", breed: "Indian Pariah", age: "5 yrs", sex: "Male", doctorId: S.meera, notes: "Brought in limping. Shy with strangers." },
    { id: "ANM-0013", token: "012", name: "Pepper", type: "Cat", breed: "Indian Shorthair", age: "3 yrs", sex: "Female", doctorId: S.farhan, notes: "Released back to colony after recovery." },
    { id: "ANM-0014", token: "014", name: "Golu", type: "Dog", breed: "Indian Pariah", age: "2 yrs", sex: "Male", doctorId: S.meera, notes: "Discharged to owner.", ownerName: "Amit Gawde", contactNumber: "+91 98205 66120" },
    { id: "ANM-0015", token: "015", name: "Bella", type: "Dog", breed: "Spitz", age: "8 yrs", sex: "Female", doctorId: S.meera, notes: "Discharged to owner after observation.", ownerName: "Shirin Bharucha", contactNumber: "+91 98211 30987" },
    { id: "ANM-0016", token: "010", name: "Daisy", type: "Cat", breed: "Siamese mix", age: "4 yrs", sex: "Female", doctorId: S.farhan, notes: "Adopted by a foster family. Record archived.", archived: true },
  ];

  // ---------------- Case journeys ----------------
  interface Step {
    at: string; type: UpdateType; by: string; desc: string; status: CaseStatus; next: string; resp: string;
    ho?: { to: string; priority: Priority; notes?: string; ackMin?: number };
  }
  interface CaseSeed {
    id: string; animalId: string; token: string; reason: string; doctorId: string; steps: Step[];
    surgery?: { at: string; status: Case["surgeryStatus"]; procedure: string };
  }

  const sFarhan = nextDowOffset([2, 5]);
  const sMeera = nextDowOffset([1, 4]);
  const sPrev = prevSurgeryOffset();

  const caseSeeds: CaseSeed[] = [
    {
      id: "CB-1021", animalId: "ANM-0001", token: "021", doctorId: S.meera, reason: "Deep laceration on left hind leg",
      steps: [
        { at: ago(220), type: "Admission", by: S.rohan, desc: "Animal admitted at front desk", status: "Newly Admitted", next: "Issue token and move to observation kennel", resp: S.rohan },
        { at: ago(195), type: "Token Issued", by: S.rohan, desc: "Token 021 issued and tied to kennel D3", status: "Awaiting Assessment", next: "Initial assessment", resp: S.meera },
        { at: ago(170), type: "Assessment", by: S.meera, desc: "Initial assessment completed; wound cleaned and measured", status: "Under Assessment", next: "Decide care plan", resp: S.meera },
        { at: ago(150), type: "Care Plan", by: S.meera, desc: "Care plan decided: twice-daily wound dressing for 7 days", status: "Care Plan Decided", next: "Administer first wound dressing", resp: S.rohan },
        { at: ago(100), type: "Treatment", by: S.rohan, desc: "First wound dressing applied; animal ate half portion", status: "In Treatment", next: "Evening dressing change and record wound condition", resp: S.rohan },
        { at: ago(35), type: "Handover", by: S.rohan, desc: "Handover to evening shift", status: "In Treatment", next: "Evening dressing change and record wound condition", resp: S.rohan,
          ho: { to: S.priya, priority: "High", notes: "Bruno pulls at the bandage — keep the cone on after dressing." } },
      ],
    },
    {
      id: "CB-1022", animalId: "ANM-0002", token: "022", doctorId: S.farhan, reason: "Sterilisation (spay) under community cat programme",
      surgery: { at: dayAt(sFarhan, "10:00"), status: "Scheduled", procedure: "Spay (sterilisation)" },
      steps: [
        { at: dayAt(-1, "10:15"), type: "Admission", by: S.sneha, desc: "Animal admitted for sterilisation drive", status: "Newly Admitted", next: "Issue token", resp: S.sneha },
        { at: dayAt(-1, "10:25"), type: "Token Issued", by: S.sneha, desc: "Token 022 issued; housed in cattery C2", status: "Awaiting Assessment", next: "Pre-surgery assessment", resp: S.farhan },
        { at: dayAt(-1, "12:00"), type: "Assessment", by: S.farhan, desc: "Pre-surgery assessment completed; fit for surgery", status: "Care Plan Decided", next: "Schedule surgery", resp: S.farhan },
        { at: dayAt(-1, "12:20"), type: "Surgery", by: S.farhan, desc: "Spay surgery scheduled for next surgery day", status: "Surgery Scheduled", next: "Fast from 10 PM the night before surgery", resp: S.rohan },
        { at: dayAt(-1, "18:30"), type: "Handover", by: S.rohan, desc: "Handover for pre-surgery preparation", status: "Surgery Scheduled", next: "Fast from 10 PM and prepare for surgery", resp: S.rohan,
          ho: { to: S.sneha, priority: "Normal", notes: "Remove food bowl by 10 PM. Water is fine." } },
      ],
    },
    {
      id: "CB-1023", animalId: "ANM-0003", token: "023", doctorId: S.meera, reason: "Soft tissue mass on right flank",
      surgery: { at: dayAt(sPrev, "11:00"), status: "Completed", procedure: "Mass removal" },
      steps: [
        { at: dayAt(sPrev - 2, "09:40"), type: "Admission", by: S.imran, desc: "Animal admitted with owner", status: "Newly Admitted", next: "Issue token", resp: S.imran },
        { at: dayAt(sPrev - 2, "09:50"), type: "Token Issued", by: S.imran, desc: "Token 023 issued; kennel A1", status: "Awaiting Assessment", next: "Initial assessment", resp: S.meera },
        { at: dayAt(sPrev - 2, "11:30"), type: "Assessment", by: S.meera, desc: "Assessment completed; mass removal recommended", status: "Care Plan Decided", next: "Schedule surgery", resp: S.meera },
        { at: dayAt(sPrev - 2, "12:00"), type: "Surgery", by: S.meera, desc: "Surgery scheduled; owner consent recorded", status: "Surgery Scheduled", next: "Pre-surgery preparation", resp: S.sneha },
        { at: dayAt(sPrev, "13:10"), type: "Surgery", by: S.meera, desc: "Mass removal surgery completed without complications", status: "Post-Surgery Recovery", next: "Monitor recovery and pain score every 4 hours", resp: S.sneha },
        { at: dayAt(sPrev, "19:00"), type: "Handover", by: S.sneha, desc: "Night recovery handover", status: "Post-Surgery Recovery", next: "Monitor recovery and pain score every 4 hours", resp: S.sneha,
          ho: { to: S.imran, priority: "High", notes: "Check stitches for swelling. Owner will call at 8 PM.", ackMin: 25 } },
        { at: ago(180), type: "Observation", by: S.imran, desc: "Stitches clean, eating well, walked on leash", status: "Post-Surgery Recovery", next: "Stitch check by doctor", resp: S.imran },
      ],
    },
    {
      id: "CB-1024", animalId: "ANM-0004", token: "024", doctorId: S.farhan, reason: "Underweight kitten, eye discharge",
      steps: [
        { at: ago(75), type: "Admission", by: S.priya, desc: "Kitten admitted, found near Sea Face", status: "Newly Admitted", next: "Issue token", resp: S.priya },
        { at: ago(65), type: "Token Issued", by: S.priya, desc: "Token 024 issued; cattery C4 (isolation)", status: "Awaiting Assessment", next: "Initial assessment", resp: S.farhan },
      ],
    },
    {
      id: "CB-1025", animalId: "ANM-0005", token: "025", doctorId: S.farhan, reason: "Recurring eye infection",
      steps: [
        { at: dayAt(-5, "11:00"), type: "Admission", by: S.imran, desc: "Returning patient admitted by owner", status: "Newly Admitted", next: "Issue token", resp: S.imran },
        { at: dayAt(-5, "11:10"), type: "Token Issued", by: S.imran, desc: "Token 025 issued; cattery C1", status: "Awaiting Assessment", next: "Initial assessment", resp: S.farhan },
        { at: dayAt(-5, "12:30"), type: "Assessment", by: S.farhan, desc: "Assessment completed; previous case CB-1003 reviewed", status: "Care Plan Decided", next: "Start eye drop course", resp: S.imran },
        { at: dayAt(-5, "16:00"), type: "Medication", by: S.imran, desc: "Eye drop course started (fictional regimen)", status: "In Treatment", next: "Continue drops three times a day", resp: S.imran },
        { at: dayAt(-2, "18:45"), type: "Handover", by: S.imran, desc: "Handover for weekend cover", status: "In Treatment", next: "Continue drops and note any discharge", resp: S.imran,
          ho: { to: S.priya, priority: "Normal", ackMin: 40 } },
        { at: dayAt(-1, "10:30"), type: "Observation", by: S.farhan, desc: "Discharge reduced; moved to observation", status: "Under Observation", next: "Observe for 48 hours, then discharge check", resp: S.priya },
      ],
    },
    {
      id: "CB-1026", animalId: "ANM-0006", token: "026", doctorId: S.meera, reason: "Suspected fracture, right foreleg",
      steps: [
        { at: dayAt(-2, "08:50"), type: "Admission", by: S.rohan, desc: "Road accident case admitted", status: "Newly Admitted", next: "Issue token", resp: S.rohan },
        { at: dayAt(-2, "09:00"), type: "Token Issued", by: S.rohan, desc: "Token 026 issued; kennel B2", status: "Awaiting Assessment", next: "Initial assessment", resp: S.meera },
        { at: dayAt(-2, "10:15"), type: "Assessment", by: S.meera, desc: "Assessment completed; X-ray referral arranged", status: "Under Assessment", next: "Review X-ray report", resp: S.meera },
        { at: dayAt(-1, "15:00"), type: "Care Plan", by: S.meera, desc: "X-ray reviewed; splint and cage rest decided", status: "Awaiting Treatment", next: "Apply splint with doctor", resp: S.rohan },
        { at: ago(130), type: "Handover", by: S.rohan, desc: "Handover — Rohan moving to admissions desk", status: "Awaiting Treatment", next: "Apply splint with doctor", resp: S.rohan,
          ho: { to: S.imran, priority: "Urgent", notes: "Dr. Meera is free after 2 PM. Sheru must be muzzled for handling." } },
      ],
    },
    {
      id: "CB-1027", animalId: "ANM-0007", token: "027", doctorId: S.meera, reason: "Skin infection and hair loss",
      steps: [
        { at: ago(140), type: "Admission", by: S.sneha, desc: "Animal admitted from construction site rescue", status: "Newly Admitted", next: "Issue token", resp: S.sneha },
        { at: ago(130), type: "Token Issued", by: S.sneha, desc: "Token 027 issued; isolation kennel E1", status: "Awaiting Assessment", next: "Initial assessment", resp: S.meera },
        { at: ago(55), type: "Assessment", by: S.meera, desc: "Assessment started; skin scraping taken", status: "Under Assessment", next: "Review skin scraping and decide care plan", resp: S.meera },
      ],
    },
    {
      id: "CB-1018", animalId: "ANM-0008", token: "018", doctorId: S.farhan, reason: "Fever and lethargy",
      steps: [
        { at: dayAt(-6, "09:30"), type: "Admission", by: S.priya, desc: "Animal admitted by owner", status: "Newly Admitted", next: "Issue token", resp: S.priya },
        { at: dayAt(-6, "09:40"), type: "Token Issued", by: S.priya, desc: "Token 018 issued; kennel A3", status: "Awaiting Assessment", next: "Initial assessment", resp: S.farhan },
        { at: dayAt(-6, "11:00"), type: "Assessment", by: S.farhan, desc: "Assessment and blood test completed", status: "Care Plan Decided", next: "Begin 10-day treatment course", resp: S.priya },
        { at: dayAt(-6, "14:00"), type: "Treatment", by: S.priya, desc: "Treatment course started (fictional regimen)", status: "In Treatment", next: "Daily medication and temperature check", resp: S.priya },
        { at: dayAt(-3, "18:00"), type: "Handover", by: S.priya, desc: "Handover — Priya on leave", status: "In Treatment", next: "Daily medication and temperature check", resp: S.priya,
          ho: { to: S.sneha, priority: "Normal", ackMin: 15 } },
        { at: dayAt(-1, "09:15"), type: "Medication", by: S.sneha, desc: "Day 6 medication given; temperature normal", status: "In Treatment", next: "Daily medication and temperature check", resp: S.sneha },
      ],
    },
    {
      id: "CB-1019", animalId: "ANM-0009", token: "019", doctorId: S.farhan, reason: "Sterilisation (neuter) under community cat programme",
      surgery: { at: dayAt(sFarhan, "11:30"), status: "Scheduled", procedure: "Neuter (sterilisation)" },
      steps: [
        { at: dayAt(-1, "11:00"), type: "Admission", by: S.priya, desc: "Animal admitted for sterilisation drive", status: "Newly Admitted", next: "Issue token", resp: S.priya },
        { at: dayAt(-1, "11:05"), type: "Token Issued", by: S.priya, desc: "Token 019 issued; cattery C3", status: "Awaiting Assessment", next: "Pre-surgery assessment", resp: S.farhan },
        { at: dayAt(-1, "13:00"), type: "Assessment", by: S.farhan, desc: "Pre-surgery assessment completed; fit for surgery", status: "Care Plan Decided", next: "Schedule surgery", resp: S.farhan },
        { at: dayAt(-1, "13:10"), type: "Surgery", by: S.farhan, desc: "Neuter surgery scheduled", status: "Surgery Scheduled", next: "Fast from 10 PM the night before surgery", resp: S.priya },
      ],
    },
    {
      id: "CB-1020", animalId: "ANM-0010", token: "020", doctorId: S.meera, reason: "Dental disease, not eating",
      surgery: { at: dayAt(sMeera, "10:30"), status: "Scheduled", procedure: "Dental extraction" },
      steps: [
        { at: dayAt(-1, "16:20"), type: "Admission", by: S.imran, desc: "Senior dog admitted, not eating for 2 days", status: "Newly Admitted", next: "Issue token", resp: S.imran },
        { at: dayAt(-1, "16:30"), type: "Token Issued", by: S.imran, desc: "Token 020 issued; kennel A2", status: "Awaiting Assessment", next: "Initial assessment", resp: S.meera },
        { at: dayAt(-1, "17:30"), type: "Assessment", by: S.meera, desc: "Assessment completed; two loose teeth found", status: "Care Plan Decided", next: "Schedule dental surgery", resp: S.meera },
        { at: ago(300), type: "Surgery", by: S.meera, desc: "Dental extraction scheduled; soft food until surgery", status: "Surgery Scheduled", next: "Soft food twice a day until surgery", resp: S.imran },
      ],
    },
    {
      id: "CB-1016", animalId: "ANM-0011", token: "016", doctorId: S.farhan, reason: "Reduced appetite",
      steps: [
        { at: dayAt(-4, "12:00"), type: "Admission", by: S.sneha, desc: "Pet rabbit admitted by owner", status: "Newly Admitted", next: "Issue token", resp: S.sneha },
        { at: dayAt(-4, "12:05"), type: "Token Issued", by: S.sneha, desc: "Token 016 issued; small animal room", status: "Awaiting Assessment", next: "Initial assessment", resp: S.farhan },
        { at: dayAt(-4, "14:00"), type: "Assessment", by: S.farhan, desc: "Assessment completed; diet change advised", status: "Care Plan Decided", next: "Start hay-only diet and record intake", resp: S.sneha },
        { at: dayAt(-3, "10:00"), type: "Feeding", by: S.sneha, desc: "Hay-only diet started; intake recorded", status: "Under Observation", next: "Record daily food intake and droppings", resp: S.sneha },
      ],
    },
    {
      id: "CB-1017", animalId: "ANM-0012", token: "017", doctorId: S.meera, reason: "Limping, left foreleg",
      steps: [
        { at: dayAt(-1, "17:45"), type: "Admission", by: S.rohan, desc: "Animal admitted, limping on left foreleg", status: "Newly Admitted", next: "Issue token", resp: S.rohan },
        { at: dayAt(-1, "17:55"), type: "Token Issued", by: S.rohan, desc: "Token 017 issued; kennel B4", status: "Awaiting Assessment", next: "Initial assessment (first in morning OPD)", resp: S.meera },
      ],
    },
    // ---------- completed cases ----------
    {
      id: "CB-1012", animalId: "ANM-0013", token: "012", doctorId: S.farhan, reason: "Abscess on neck",
      steps: [
        { at: dayAt(-14, "10:00"), type: "Admission", by: S.imran, desc: "Community cat admitted with neck swelling", status: "Newly Admitted", next: "Issue token", resp: S.imran },
        { at: dayAt(-14, "10:10"), type: "Token Issued", by: S.imran, desc: "Token 012 issued; cattery C2", status: "Awaiting Assessment", next: "Initial assessment", resp: S.farhan },
        { at: dayAt(-14, "11:30"), type: "Assessment", by: S.farhan, desc: "Abscess drained and cleaned", status: "Care Plan Decided", next: "Daily flushing for 5 days", resp: S.imran },
        { at: dayAt(-13, "10:00"), type: "Treatment", by: S.imran, desc: "Daily flushing started", status: "In Treatment", next: "Continue daily flushing", resp: S.imran },
        { at: dayAt(-10, "18:00"), type: "Handover", by: S.imran, desc: "Handover for remaining treatment", status: "In Treatment", next: "Continue daily flushing", resp: S.imran,
          ho: { to: S.rohan, priority: "Low", ackMin: 30 } },
        { at: dayAt(-7, "11:00"), type: "Observation", by: S.farhan, desc: "Wound healed; observation before release", status: "Under Observation", next: "Release back to colony", resp: S.rohan },
        { at: dayAt(-4, "09:30"), type: "Status Change", by: S.farhan, desc: "Case closed; released back to Worli colony", status: "Completed", next: "No further action", resp: S.rohan },
      ],
    },
    {
      id: "CB-1014", animalId: "ANM-0014", token: "014", doctorId: S.meera, reason: "Vomiting and dehydration",
      steps: [
        { at: dayAt(-20, "09:15"), type: "Admission", by: S.sneha, desc: "Animal admitted by owner", status: "Newly Admitted", next: "Issue token", resp: S.sneha },
        { at: dayAt(-20, "09:20"), type: "Token Issued", by: S.sneha, desc: "Token 014 issued; kennel A4", status: "Awaiting Assessment", next: "Initial assessment", resp: S.meera },
        { at: dayAt(-20, "10:00"), type: "Assessment", by: S.meera, desc: "Assessment completed; fluids started", status: "In Treatment", next: "Fluids and bland diet", resp: S.sneha },
        { at: dayAt(-17, "12:00"), type: "Observation", by: S.meera, desc: "Eating normally; under observation", status: "Under Observation", next: "Discharge after 48 hours if stable", resp: S.sneha },
        { at: dayAt(-9, "17:00"), type: "Status Change", by: S.meera, desc: "Case closed; discharged to owner", status: "Completed", next: "No further action", resp: S.sneha },
      ],
    },
    {
      id: "CB-1015", animalId: "ANM-0015", token: "015", doctorId: S.meera, reason: "Heat exhaustion",
      steps: [
        { at: dayAt(-4, "13:30"), type: "Admission", by: S.rohan, desc: "Animal admitted with heat exhaustion", status: "Newly Admitted", next: "Issue token", resp: S.rohan },
        { at: dayAt(-4, "13:35"), type: "Token Issued", by: S.rohan, desc: "Token 015 issued; kennel A5", status: "Awaiting Assessment", next: "Initial assessment", resp: S.meera },
        { at: dayAt(-4, "13:50"), type: "Assessment", by: S.meera, desc: "Cooling and fluids given", status: "Under Observation", next: "Observe for 24 hours", resp: S.rohan },
        { at: dayAt(-2, "11:00"), type: "Status Change", by: S.meera, desc: "Case closed; discharged to owner", status: "Completed", next: "No further action", resp: S.rohan },
      ],
    },
    {
      id: "CB-1003", animalId: "ANM-0005", token: "003", doctorId: S.farhan, reason: "Eye infection (first episode)",
      steps: [
        { at: dayAt(-95, "10:00"), type: "Admission", by: S.priya, desc: "Animal admitted by owner", status: "Newly Admitted", next: "Issue token", resp: S.priya },
        { at: dayAt(-95, "10:05"), type: "Token Issued", by: S.priya, desc: "Token 003 issued", status: "Awaiting Assessment", next: "Initial assessment", resp: S.farhan },
        { at: dayAt(-95, "11:00"), type: "Assessment", by: S.farhan, desc: "Assessment completed; eye drops prescribed", status: "In Treatment", next: "Eye drops for 7 days", resp: S.priya },
        { at: dayAt(-88, "16:00"), type: "Status Change", by: S.farhan, desc: "Case closed; discharged to owner", status: "Completed", next: "No further action", resp: S.priya },
      ],
    },
    {
      id: "CB-1010", animalId: "ANM-0016", token: "010", doctorId: S.farhan, reason: "Malnourishment",
      steps: [
        { at: dayAt(-40, "10:00"), type: "Admission", by: S.sneha, desc: "Stray cat admitted, malnourished", status: "Newly Admitted", next: "Issue token", resp: S.sneha },
        { at: dayAt(-40, "10:05"), type: "Token Issued", by: S.sneha, desc: "Token 010 issued", status: "Awaiting Assessment", next: "Initial assessment", resp: S.farhan },
        { at: dayAt(-40, "11:00"), type: "Assessment", by: S.farhan, desc: "Feeding plan decided", status: "In Treatment", next: "Small meals four times a day", resp: S.sneha },
        { at: dayAt(-26, "12:00"), type: "Status Change", by: S.farhan, desc: "Case closed; handed to foster family", status: "Completed", next: "No further action", resp: S.sneha },
      ],
    },
  ];

  // ---------------- Materialise cases, updates, handovers, logs ----------------
  const cases: Case[] = [];
  const careUpdates: CareUpdate[] = [];
  const handovers: Handover[] = [];
  const activityLogs: ActivityLog[] = [];
  const notifications: Notification[] = [];
  let cu = 0, ho = 0, act = 0, nt = 0;
  const log = (l: Omit<ActivityLog, "id">) => activityLogs.push({ id: `ACT-${String(++act).padStart(4, "0")}`, ...l });
  const notify = (n: Omit<Notification, "id">) => notifications.push({ id: `NTF-${String(++nt).padStart(4, "0")}`, ...n });

  const animals: Animal[] = animalSeeds.map((a) => {
    const own = caseSeeds.filter((c) => c.animalId === a.id).sort((x, y) => y.steps[0].at.localeCompare(x.steps[0].at));
    const admission = own[0]?.steps[0].at ?? dayAt(-30, "10:00");
    const first = caseSeeds.filter((c) => c.animalId === a.id).map((c) => c.steps[0].at).sort()[0] ?? admission;
    return { ...a, archived: !!a.archived, admissionDate: admission, createdAt: first, updatedAt: admission };
  });
  const loggedAnimals = new Set<string>();

  for (const cs of caseSeeds) {
    const animal = animals.find((a) => a.id === cs.animalId)!;
    let responsible = cs.steps[0].resp;
    let lastAction = "";
    let updatedAt = cs.steps[0].at;
    let prevStatus: CaseStatus | undefined;
    cs.steps.forEach((st, i) => {
      careUpdates.push({
        id: `CU-${String(++cu).padStart(4, "0")}`, caseId: cs.id, type: st.type, description: st.desc,
        status: st.status, nextAction: st.next, responsibleId: st.resp, createdBy: st.by, createdAt: st.at,
      });
      const label = `${animal.name} (token ${cs.token})`;
      if (i === 0) {
        if (st.at === animal.createdAt && !loggedAnimals.has(animal.id)) {
          loggedAnimals.add(animal.id);
          log({ action: "Animal Added", description: `${animal.name} registered as a new ${animal.type.toLowerCase()}`, animalId: animal.id, staffId: st.by, createdAt: st.at });
        }
        log({ action: "Case Created", description: `Case ${cs.id} opened for ${label}: ${cs.reason}`, caseId: cs.id, animalId: animal.id, staffId: st.by, createdAt: st.at });
      } else if (st.type === "Handover" && st.ho) {
        const created = st.at;
        const ack = st.ho.ackMin !== undefined ? addMin(created, st.ho.ackMin) : undefined;
        const summary = generateHandoverSummary({
          previousAction: lastAction, fromName: nameOf(st.by), toName: nameOf(st.ho.to), nextAction: st.next,
          status: st.status, animalName: animal.name, token: cs.token,
        });
        const hoId = `HO-${String(++ho).padStart(3, "0")}`;
        handovers.push({
          id: hoId, caseId: cs.id, fromId: st.by, toId: st.ho.to, previousAction: lastAction, currentStatus: st.status,
          nextAction: st.next, notes: st.ho.notes, priority: st.ho.priority, summary,
          status: ack ? "Acknowledged" : "Pending", createdBy: st.by, createdAt: created, acknowledgedAt: ack, acceptedResponsibility: !!ack,
        });
        careUpdates[careUpdates.length - 1].description = `Handover to ${nameOf(st.ho.to)}: ${summary}`;
        log({ action: "Handover Created", description: `${nameOf(st.by)} handed over ${label} to ${nameOf(st.ho.to)}`, caseId: cs.id, animalId: animal.id, staffId: st.by, createdAt: created });
        notify({ recipientId: st.ho.to, type: "Handover Received", title: "New handover received", message: `${nameOf(st.by)} handed over ${label} to you.`, link: `/handovers?open=${hoId}`, read: !!ack, createdAt: created });
        if (ack) {
          log({ action: "Handover Acknowledged", description: `${nameOf(st.ho.to)} acknowledged handover ${hoId} and accepted responsibility for ${label}`, caseId: cs.id, animalId: animal.id, staffId: st.ho.to, createdAt: ack });
          responsible = st.ho.to;
          updatedAt = ack;
        }
      } else {
        log({ action: "Care Update", description: `${st.type} — ${st.desc} (${label})`, caseId: cs.id, animalId: animal.id, staffId: st.by, createdAt: st.at });
        if (prevStatus && prevStatus !== st.status) {
          log({ action: "Status Updated", description: `${label} moved from ${prevStatus} to ${st.status}`, caseId: cs.id, animalId: animal.id, staffId: st.by, createdAt: st.at });
        }
      }
      if (st.type !== "Handover") {
        lastAction = st.desc;
        responsible = st.resp;
      }
      prevStatus = st.status;
      if (st.at > updatedAt) updatedAt = st.at;
    });
    const last = cs.steps[cs.steps.length - 1];
    cases.push({
      id: cs.id, animalId: cs.animalId, token: cs.token, reason: cs.reason, status: last.status, doctorId: cs.doctorId,
      responsibleId: responsible, lastAction, nextAction: last.next, openedAt: cs.steps[0].at,
      closedAt: last.status === "Completed" ? last.at : undefined,
      surgeryAt: cs.surgery?.at, surgeryStatus: cs.surgery?.status, surgeryProcedure: cs.surgery?.procedure,
      createdBy: cs.steps[0].by, createdAt: cs.steps[0].at, updatedAt,
    });
    if (last.status !== "Completed" && responsible !== cs.steps[0].by) {
      notify({ recipientId: responsible, type: "Case Assigned", title: "Case assigned to you", message: `You are responsible for ${animal.name} (token ${cs.token}) — ${last.next}.`, link: `/cases/${cs.id}`, read: true, createdAt: updatedAt });
    }
  }

  // ---------------- Tasks ----------------
  type TS = [string, TaskCategory, string | null, string, number, string, TaskPriority, TaskStatus, string?];
  // [title, category, caseId, assignee, dueDayOffset, dueTime, priority, status, description]
  const taskSeeds: TS[] = [
    ["Evening wound dressing — Bruno", "Medication", "CB-1021", S.rohan, 0, "18:00", "High", "To Do", "Change dressing on left hind leg and note any discharge."],
    ["Initial assessment — Miki", "Examination", "CB-1024", S.farhan, 0, "13:30", "High", "To Do", "Weigh, check eyes and hydration. Isolation cattery C4."],
    ["Apply splint — Sheru", "Examination", "CB-1026", S.imran, 0, "14:30", "High", "In Progress", "Assist Dr. Meera. Sheru must be muzzled for handling."],
    ["Remove food bowl before surgery — Luna", "Surgery Preparation", "CB-1022", S.sneha, -1, "22:00", "Medium", "Completed", "No food after 10 PM. Water is fine."],
    ["Remove food bowl before surgery — Simba", "Surgery Preparation", "CB-1019", S.priya, -1, "22:00", "Medium", "Completed"],
    ["Pain score check — Coco", "Post-Surgery Care", "CB-1023", S.imran, 0, "09:00", "High", "To Do", "Record pain score and check stitches."],
    ["Morning medication — Motu", "Medication", "CB-1018", S.sneha, 0, "09:30", "Medium", "Completed"],
    ["Temperature check — Motu", "Observation", "CB-1018", S.sneha, 0, "17:00", "Low", "To Do"],
    ["Record food intake — Chiku", "Observation", "CB-1016", S.sneha, 0, "16:00", "Low", "To Do"],
    ["Eye drops (afternoon) — Tom", "Medication", "CB-1025", S.priya, 0, "14:00", "Medium", "To Do"],
    ["Soft food feeding — Raju", "Feeding", "CB-1020", S.imran, 0, "08:30", "Medium", "Completed"],
    ["Clean kennel block A", "Cleaning", null, S.ganesh, 0, "08:00", "Medium", "Completed", "Kennels A1–A5, including drains."],
    ["Clean kennel block B", "Cleaning", null, S.ganesh, 0, "11:00", "Medium", "To Do", "Kennels B1–B4."],
    ["Disinfect isolation kennel E1", "Cleaning", "CB-1027", S.lata, 0, "10:00", "High", "To Do", "Skin case — use separate mop and gloves."],
    ["Cattery cleaning and litter change", "Cleaning", null, S.lata, 0, "15:00", "Medium", "In Progress"],
    ["Evening feeding round — all kennels", "Feeding", null, S.suresh, 0, "18:30", "Medium", "To Do", "Check the whiteboard for special diets (Raju: soft food; Chiku: hay only)."],
    ["Restock surgery consumables", "General", null, S.suresh, -1, "16:00", "Medium", "To Do", "Gauze, bandage rolls, gloves for surgery day."],
    ["Initial assessment — Bhura", "Examination", "CB-1017", S.meera, 0, "10:00", "High", "To Do", "First in morning OPD."],
    ["Review skin scraping — Kali", "Examination", "CB-1027", S.meera, 0, "16:00", "Medium", "To Do"],
    ["Stitch check — Coco", "Post-Surgery Care", "CB-1023", S.meera, 1, "11:00", "Medium", "To Do"],
    ["Pre-surgery weigh-in — Raju", "Surgery Preparation", "CB-1020", S.imran, Math.max(0, sMeera - 1), "17:00", "Low", "To Do"],
    ["Laundry — towels and blankets", "General", null, S.ganesh, 1, "10:00", "Low", "To Do"],
    ["Update owner on Coco's recovery", "General", "CB-1023", S.anjali, 0, "19:00", "Low", "To Do", "Call Rahul Mehta with today's update."],
  ];
  const tasks: Task[] = taskSeeds.map(([title, category, caseId, assigneeId, off, time, priority, status, description], i) => {
    const c = caseId ? cases.find((x) => x.id === caseId) : undefined;
    const createdAt = c ? (c.openedAt > dayAt(off - 1, "08:00") ? c.openedAt : dayAt(off - 1, "08:00")) : dayAt(off - 1, "08:00");
    const createdBy = c?.doctorId && assigneeId !== c.doctorId ? c.doctorId : S.anjali;
    const due = dayAt(off, time);
    const completedAt = status === "Completed" ? (due < iso(now) ? addMin(due, -10) : ago(20)) : undefined;
    return {
      id: `TSK-${String(i + 1).padStart(3, "0")}`, title, description, category,
      animalId: c?.animalId, caseId: c?.id, assigneeId, dueDate: ymd(off), dueTime: time, priority, status,
      completedAt, completedBy: completedAt ? assigneeId : undefined,
      createdBy, createdAt: createdAt < iso(now) ? createdAt : ago(240), updatedAt: completedAt ?? createdAt,
    };
  });
  for (const t of tasks) {
    log({ action: "Task Assigned", description: `"${t.title}" assigned to ${nameOf(t.assigneeId)}`, caseId: t.caseId, animalId: t.animalId, staffId: t.createdBy, createdAt: t.createdAt });
    if (t.completedAt) log({ action: "Task Completed", description: `${nameOf(t.assigneeId)} completed "${t.title}"`, caseId: t.caseId, animalId: t.animalId, staffId: t.assigneeId, createdAt: t.completedAt });
    if (t.status !== "Completed") {
      notify({ recipientId: t.assigneeId, type: "Task Assigned", title: "Task assigned to you", message: `${t.title} — due ${t.dueDate === ymd(0) ? "today" : t.dueDate} at ${t.dueTime}.`, link: `/tasks?open=${t.id}`, read: t.createdAt < dayAt(0, "00:00"), createdAt: t.createdAt });
    }
  }

  // ---------------- Duty schedule: last week, this week, next week ----------------
  const dutySchedules: DutySchedule[] = [];
  let ds = 0;
  const weekStart = addDays(now, -((now.getDay() + 6) % 7)); // Monday
  for (let d = -7; d < 14; d++) {
    const date = addDays(weekStart, d);
    const dow = date.getDay();
    const dateStr = format(date, "yyyy-MM-dd");
    const isSurgery = surgeryDays.includes(dow);
    const add = (staffId: string, shift: Shift, duty: DutyType, notes?: string) =>
      dutySchedules.push({ id: `DS-${String(++ds).padStart(4, "0")}`, date: dateStr, staffId, shift, duty, notes, createdAt: dayAt(-10, "09:00"), updatedAt: dayAt(-10, "09:00") });
    if (dow === 0) {
      add(S.priya, "Full Day", "Ward Rounds", "Sunday cover");
      add(S.suresh, "Morning", "Feeding Round");
      add(S.ganesh, "Morning", "Kennel Cleaning");
      add(S.farhan, "Morning", "OPD & Assessments", "On call after 1 PM");
      continue;
    }
    if (dow !== 6) add(S.anjali, "Full Day", "Shelter Management");
    // Doctors: Meera operates Mon/Thu, Farhan Tue/Fri
    const meeraSurgery = isSurgery && (dow === 1 || dow === 4);
    const farhanSurgery = isSurgery && (dow === 2 || dow === 5);
    add(S.meera, "Full Day", meeraSurgery ? "Surgery" : "OPD & Assessments", meeraSurgery ? "Theatre from 10:00" : undefined);
    add(S.farhan, "Full Day", farhanSurgery ? "Surgery" : "OPD & Assessments", farhanSurgery ? "Theatre from 10:00" : undefined);
    if (isSurgery) {
      add(dow % 2 ? S.sneha : S.priya, "Morning", "Surgery Assist");
      add(dow % 2 ? S.priya : S.sneha, "Afternoon", "Ward Rounds");
    } else {
      add(S.sneha, "Morning", "Ward Rounds");
      add(S.priya, "Afternoon", "Medication Round");
    }
    add(S.rohan, dow === 3 ? "Evening" : "Morning", dow === 2 ? "Admissions Desk" : "Medication Round");
    add(S.imran, "Afternoon", dow === 6 ? "Ward Rounds" : "Admissions Desk");
    add(S.ganesh, "Morning", "Kennel Cleaning");
    add(S.lata, "Morning", "Cattery Cleaning");
    add(S.suresh, "Afternoon", dow === 3 || dow === 6 ? "Laundry & Supplies" : "Feeding Round");
  }

  // Seed a few historical staff/system logs
  log({ action: "Schedule Updated", description: "Weekly duty schedule published", staffId: S.anjali, createdAt: dayAt(-10, "09:00") });
  log({ action: "Staff Updated", description: "Rohan Patil's contact number updated", staffId: S.anjali, createdAt: dayAt(-30, "09:00") });

  activityLogs.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return {
    version: DB_VERSION,
    staff,
    animals,
    cases,
    careUpdates,
    handovers,
    tasks,
    dutySchedules,
    activityLogs,
    notifications,
    settings: { ...DEFAULT_SETTINGS },
    counters: {
      animal: animals.length, case: 1027, careUpdate: cu, handover: ho, task: tasks.length,
      duty: ds, activity: act, notification: nt, staff: staff.length,
    },
  };
}
