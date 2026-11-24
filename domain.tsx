import { useMemo, useState, type ReactNode } from "react";
import { Cat, Dog, Rabbit } from "lucide-react";
import { useStore } from "@/lib/store";
import type { Animal, AnimalType, CaseStatus, Role, Staff, TaskDisplayStatus } from "@/lib/types";
import { CASE_STATUS_TONE, cn, PRIORITY_TONE, TASK_STATUS_TONE } from "@/lib/utils";
import { Avatar, Badge } from "./ui/misc";

export function CaseStatusBadge({ status }: { status: CaseStatus | "No Active Case" }) {
  if (status === "No Active Case") return <Badge tone="neutral">No active case</Badge>;
  return <Badge tone={CASE_STATUS_TONE[status]}>{status}</Badge>;
}
export function TaskStatusBadge({ status }: { status: TaskDisplayStatus }) {
  return <Badge tone={TASK_STATUS_TONE[status]}>{status}</Badge>;
}
export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge tone={PRIORITY_TONE[priority] ?? "neutral"} dot={false}>{priority}</Badge>;
}

const TYPE_ICON: Record<AnimalType, typeof Dog> = { Dog, Cat, Other: Rabbit };

export function AnimalAvatar({ animal, size = "md", className }: { animal: Pick<Animal, "name" | "type" | "imageUrl">; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const Icon = TYPE_ICON[animal.type];
  const s = { sm: "h-7 w-7", md: "h-9 w-9", lg: "h-14 w-14", xl: "h-28 w-28" }[size];
  const icon = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-6 w-6", xl: "h-10 w-10" }[size];
  if (animal.imageUrl) {
    return <img src={animal.imageUrl} alt={`Photo of ${animal.name}`} className={cn("shrink-0 rounded-md object-cover", s, className)} />;
  }
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-md bg-[#EEF3F6] text-navy", s, className)} aria-hidden>
      <Icon className={icon} />
    </span>
  );
}

export function StaffChip({ id, className, showRole }: { id?: string; className?: string; showRole?: boolean }) {
  const { db } = useStore();
  const s = db.staff.find((x) => x.id === id);
  if (!s) return <span className={cn("text-sm text-ink-muted", className)}>Unassigned</span>;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Avatar id={s.id} name={s.name} size="sm" />
      <span className="min-w-0">
        <span className="block truncate text-sm text-ink">{s.name}</span>
        {showRole && <span className="block text-xs text-ink-muted">{s.role}</span>}
      </span>
    </span>
  );
}

/** <option>s for a staff <Select>, grouped by role. */
export function StaffOptions({ roles, includeInactive, placeholder = "Select staff member" }: { roles?: Role[]; includeInactive?: boolean; placeholder?: string | null }) {
  const { db } = useStore();
  const groups = useMemo(() => {
    const list = db.staff.filter((s) => (includeInactive || s.active) && (!roles || roles.includes(s.role)));
    const order: Role[] = ["Doctor", "Assistant", "Manager", "Support Staff"];
    return order.map((r) => ({ role: r, items: list.filter((s) => s.role === r) })).filter((g) => g.items.length);
  }, [db.staff, roles, includeInactive]);
  return (
    <>
      {placeholder !== null && <option value="">{placeholder}</option>}
      {groups.map((g) => (
        <optgroup key={g.role} label={g.role === "Doctor" ? "Doctors" : g.role === "Support Staff" ? "Support staff" : `${g.role}s`}>
          {g.items.map((s: Staff) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </optgroup>
      ))}
    </>
  );
}

export function PageHeader({ title, description, actions, children }: { title: string; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
          {description && <p className="mt-1 text-sm text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">{children}</div>;
}

// ---------- table hook: search + sort + pagination ----------
export function useTableState<K extends string>(defaultSort: { key: K; dir: "asc" | "desc" }, pageSize = 10) {
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(1);
  const onSort = (key: K) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  };
  function paginate<T>(rows: T[]) {
    const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
    const p = Math.min(page, pageCount);
    return { rows: rows.slice((p - 1) * pageSize, p * pageSize), page: p, pageCount, total: rows.length, pageSize, onPage: setPage };
  }
  return { sort, onSort, setPage, paginate };
}

export function compare(a: unknown, b: unknown) {
  if (a === b) return 0;
  if (a === undefined || a === null || a === "") return 1;
  if (b === undefined || b === null || b === "") return -1;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}
