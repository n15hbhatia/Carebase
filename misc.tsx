import type { ReactNode } from "react";
import * as T from "@radix-ui/react-tabs";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { avatarTint, cn, initials, TONE_CLASSES, type Tone } from "@/lib/utils";
import { Button } from "./button";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-lg border border-line bg-white shadow-card", className)}>{children}</section>;
}
export function CardHeader({ title, description, action, icon: Icon, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; icon?: LucideIcon; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-line px-4 py-3", className)}>
      <div className="flex min-w-0 items-center gap-2">
        {Icon && <Icon className="h-4 w-4 shrink-0 text-ink-muted" aria-hidden />}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>
          {description && <p className="truncate text-xs text-ink-muted">{description}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Badge({ tone = "neutral", children, dot = true, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  const t = TONE_CLASSES[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium leading-5", t.badge, className)}>
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", t.dot)} aria-hidden />}
      {children}
    </span>
  );
}

export function Avatar({ id, name, size = "md", className }: { id: string; name: string; size?: "xs" | "sm" | "md" | "lg" | "xl"; className?: string }) {
  const s = { xs: "h-5 w-5 text-[9px]", sm: "h-6 w-6 text-[10px]", md: "h-8 w-8 text-xs", lg: "h-10 w-10 text-sm", xl: "h-14 w-14 text-lg" }[size];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", s, avatarTint(id), className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function TokenChip({ token, size = "sm", className }: { token: string; size?: "sm" | "lg"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-navy/15 bg-[#EEF3F6] font-mono font-semibold tabular-nums text-navy",
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-3 py-1.5 text-xl tracking-wide",
        className,
      )}
      title={`Token ${token}`}
    >
      <span className={cn("mr-1 font-sans font-medium text-ink-muted", size === "sm" ? "text-[10px]" : "text-xs")}>#</span>
      {token}
    </span>
  );
}

export function EmptyState({ icon: Icon, title, description, action, className }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-teal-soft text-teal">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <p className="text-sm font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Pagination({ page, pageCount, total, pageSize, onPage }: { page: number; pageCount: number; total: number; pageSize: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-[13px] text-ink-muted">
      <span>
        Showing <span className="font-medium text-ink">{from}–{to}</span> of <span className="font-medium text-ink">{total}</span>
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Previous page"><ChevronLeft /></Button>
        <span className="px-2 tabular-nums">{page} / {pageCount}</span>
        <Button variant="outline" size="icon-sm" onClick={() => onPage(page + 1)} disabled={page >= pageCount} aria-label="Next page"><ChevronRight /></Button>
      </div>
    </div>
  );
}

export const TabsRoot = T.Root;
export const TabsContent = T.Content;
export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return <T.List className={cn("inline-flex items-center gap-1 rounded-lg border border-line bg-white p-1", className)}>{children}</T.List>;
}
export function TabsTrigger({ value, children }: { value: string; children: ReactNode }) {
  return (
    <T.Trigger
      value={value}
      className="inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal data-[state=active]:bg-teal-soft data-[state=active]:text-teal"
    >
      {children}
    </T.Trigger>
  );
}

export function Segmented<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode; icon?: LucideIcon }[]; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-1 rounded-lg border border-line bg-white p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal",
            value === o.value ? "bg-teal-soft text-teal" : "text-ink-muted hover:text-ink",
          )}
        >
          {o.icon && <o.icon className="h-3.5 w-3.5" aria-hidden />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-[#EDF1F4]", className)} />;
}

export function KeyValue({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}
