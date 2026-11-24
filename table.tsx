import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="overflow-x-auto">
      <table className={cn("w-full border-collapse text-sm", className)}>{children}</table>
    </div>
  );
}
export function Th({ children, className, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("whitespace-nowrap border-b border-line bg-[#FAFBFC] px-4 py-2.5 text-left text-xs font-medium text-ink-muted", className)} {...rest}>
      {children}
    </th>
  );
}
export function SortTh<K extends string>({ label, sortKey, sort, onSort, className }: { label: string; sortKey: K; sort: { key: K; dir: "asc" | "desc" }; onSort: (k: K) => void; className?: string }) {
  const active = sort.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <Th className={className} aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 rounded hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal">
        {label}
        <Icon className={cn("h-3.5 w-3.5", active ? "text-ink" : "text-[#B8C2CC]")} aria-hidden />
      </button>
    </Th>
  );
}
export function Td({ children, className, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn("border-b border-line px-4 py-2.5 align-middle text-ink", className)} {...rest}>
      {children}
    </td>
  );
}
export function Tr({ children, onClick, className }: { children: ReactNode; onClick?: () => void; className?: string }) {
  return (
    <tr
      onClick={onClick}
      className={cn("group transition-colors last:[&>td]:border-b-0", onClick && "cursor-pointer hover:bg-[#F8FAFB]", className)}
    >
      {children}
    </tr>
  );
}
