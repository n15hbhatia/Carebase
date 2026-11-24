import { useEffect, useMemo, useRef, useState } from "react";
import * as D from "@radix-ui/react-dialog";
import { useNavigate } from "react-router-dom";
import { ClipboardList, CornerDownLeft, FolderHeart, PawPrint, Search, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { animalStatus, cn, staffName } from "@/lib/utils";

interface Result {
  group: "Animals" | "Cases" | "Staff" | "Tasks";
  id: string;
  title: string;
  meta: string;
  to: string;
  token?: string;
}
const ICONS = { Animals: PawPrint, Cases: FolderHeart, Staff: Users, Tasks: ClipboardList };

export function GlobalSearch({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { db } = useStore();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase().replace(/^#/, "");
    if (!term) return [];
    const has = (...vals: (string | undefined)[]) => vals.some((v) => v?.toLowerCase().includes(term));
    // Token numbers match on exact or numeric-equal value first ("21" finds "021").
    const tokenHit = (t: string) => t === term || Number(t) === Number(term);
    const animals = db.animals
      .filter((a) => has(a.name, a.token, a.id, a.breed) || tokenHit(a.token))
      .sort((a, b) => Number(tokenHit(b.token)) - Number(tokenHit(a.token)))
      .slice(0, 6)
      .map<Result>((a) => ({ group: "Animals", id: a.id, title: a.name, token: a.token, meta: `${a.type} · ${a.breed || "Unknown breed"} · ${animalStatus(db, a)}${a.archived ? " · Archived" : ""}`, to: `/animals/${a.id}` }));
    const cases = db.cases
      .filter((c) => {
        const a = db.animals.find((x) => x.id === c.animalId);
        return has(c.id, c.token, a?.name, c.reason) || tokenHit(c.token);
      })
      .sort((a, b) => Number(b.status !== "Completed") - Number(a.status !== "Completed") || Number(tokenHit(b.token)) - Number(tokenHit(a.token)))
      .slice(0, 6)
      .map<Result>((c) => ({ group: "Cases", id: c.id, title: `${c.id} — ${db.animals.find((a) => a.id === c.animalId)?.name ?? ""}`, token: c.token, meta: `${c.status} · ${c.reason}`, to: `/cases/${c.id}` }));
    const staff = db.staff
      .filter((s) => has(s.name, s.id, s.role, s.email))
      .slice(0, 5)
      .map<Result>((s) => ({ group: "Staff", id: s.id, title: s.name, meta: `${s.role}${s.active ? "" : " · Inactive"}`, to: `/staff/${s.id}` }));
    const tasks = db.tasks
      .filter((t) => has(t.title, t.id, t.category))
      .slice(0, 5)
      .map<Result>((t) => ({ group: "Tasks", id: t.id, title: t.title, meta: `${t.status} · ${staffName(db, t.assigneeId)} · due ${t.dueDate} ${t.dueTime}`, to: `/tasks?open=${t.id}` }));
    return [...animals, ...cases, ...staff, ...tasks];
  }, [q, db]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = (r?: Result) => {
    if (!r) return;
    onOpenChange(false);
    navigate(r.to);
  };

  const groups = (["Animals", "Cases", "Staff", "Tasks"] as const).map((g) => ({ g, items: results.filter((r) => r.group === g) })).filter((x) => x.items.length);
  let idx = -1;

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-50 bg-navy-dark/40" />
        <D.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-24px)] max-w-xl -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-white shadow-pop focus:outline-none">
          <D.Title className="sr-only">Search Carebase</D.Title>
          <D.Description className="sr-only">Search animals, token numbers, case IDs, staff and tasks</D.Description>
          <div className="flex items-center gap-2 border-b border-line px-4">
            <Search className="h-4 w-4 text-ink-muted" aria-hidden />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)); }
                if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
                if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
              }}
              placeholder="Token number, animal, case ID, staff or task…"
              className="h-12 flex-1 bg-transparent text-[15px] text-ink placeholder:text-[#A0AEC0] focus:outline-none"
              role="combobox"
              aria-expanded={results.length > 0}
              aria-controls="search-results"
              aria-activedescendant={results[active] ? `sr-${active}` : undefined}
              aria-label="Search"
            />
            <kbd className="rounded border border-line px-1.5 text-[10px] text-ink-muted">Esc</kbd>
          </div>
          <div ref={listRef} id="search-results" role="listbox" className="max-h-[60vh] overflow-y-auto py-2">
            {!q.trim() && (
              <div className="px-4 py-6 text-center text-sm text-ink-muted">
                Try a token like <button type="button" className="font-mono font-semibold text-teal hover:underline" onClick={() => setQ("021")}>021</button>, a name like{" "}
                <button type="button" className="font-semibold text-teal hover:underline" onClick={() => setQ("Luna")}>Luna</button> or a case like{" "}
                <button type="button" className="font-mono font-semibold text-teal hover:underline" onClick={() => setQ("CB-1023")}>CB-1023</button>.
              </div>
            )}
            {q.trim() && results.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-muted">No matches for “{q}”.</p>}
            {groups.map(({ g, items }) => {
              const Icon = ICONS[g];
              return (
                <div key={g} role="group" aria-label={g} className="pb-1">
                  <p className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-[#A0AEC0]">{g}</p>
                  {items.map((r) => {
                    idx++;
                    const i = idx;
                    return (
                      <div
                        key={r.group + r.id}
                        id={`sr-${i}`}
                        data-idx={i}
                        role="option"
                        aria-selected={active === i}
                        onMouseEnter={() => setActive(i)}
                        onClick={() => go(r)}
                        className={cn("mx-2 flex cursor-pointer items-center gap-3 rounded-md px-2.5 py-2", active === i && "bg-teal-soft")}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-canvas text-ink-muted"><Icon className="h-4 w-4" aria-hidden /></span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-medium text-ink">{r.title}</span>
                            {r.token && <span className="rounded bg-[#EEF3F6] px-1 font-mono text-[11px] font-semibold text-navy">#{r.token}</span>}
                          </span>
                          <span className="block truncate text-xs text-ink-muted">{r.meta}</span>
                        </span>
                        {active === i && <CornerDownLeft className="h-3.5 w-3.5 text-teal" aria-hidden />}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
