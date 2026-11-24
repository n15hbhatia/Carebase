import type { ReactNode } from "react";
import * as DM from "@radix-ui/react-dropdown-menu";
import * as P from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";

export const MenuRoot = DM.Root;
export const MenuTrigger = DM.Trigger;
export function MenuContent({ children, align = "end", className, side }: { children: ReactNode; align?: "start" | "end" | "center"; className?: string; side?: "top" | "bottom" | "right" | "left" }) {
  return (
    <DM.Portal>
      <DM.Content align={align} side={side} sideOffset={6} className={cn("z-50 min-w-[200px] rounded-lg border border-line bg-white p-1 shadow-pop focus:outline-none", className)}>
        {children}
      </DM.Content>
    </DM.Portal>
  );
}
export function MenuItem({ children, onSelect, danger, disabled }: { children: ReactNode; onSelect?: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <DM.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-canvas data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-ink-muted",
        danger && "text-danger-ink [&_svg]:text-danger",
      )}
    >
      {children}
    </DM.Item>
  );
}
export const MenuSeparator = () => <DM.Separator className="my-1 h-px bg-line" />;
export const MenuLabel = ({ children }: { children: ReactNode }) => <DM.Label className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{children}</DM.Label>;

export const PopoverRoot = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverClose = P.Close;
export function PopoverContent({ children, className, align = "end" }: { children: ReactNode; className?: string; align?: "start" | "end" | "center" }) {
  return (
    <P.Portal>
      <P.Content align={align} sideOffset={8} className={cn("z-50 rounded-lg border border-line bg-white shadow-pop focus:outline-none", className)}>
        {children}
      </P.Content>
    </P.Portal>
  );
}
