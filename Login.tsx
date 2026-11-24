import { useState } from "react";
import { HeartPulse, LogIn } from "lucide-react";
import { useStore } from "@/lib/store";
import { ROLE_SUMMARY } from "@/lib/permissions";
import { ROLES } from "@/lib/types";
import { Avatar } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const { db, login, mode } = useStore();
  const active = db.staff.filter((s) => s.active);
  const [selected, setSelected] = useState(active.find((s) => s.role === "Manager")?.id ?? active[0]?.id ?? "");
  const sel = db.staff.find((s) => s.id === selected);
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy text-teal-soft"><HeartPulse className="h-5 w-5" aria-hidden /></span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-navy">Carebase</h1>
            <p className="text-sm text-ink-muted">Every animal. Every update. Every next step.</p>
          </div>
        </div>
        <div className="grid overflow-hidden rounded-lg border border-line bg-white shadow-card md:grid-cols-[1fr_280px]">
          <form
            className="p-6"
            onSubmit={(e) => {
              e.preventDefault();
              if (selected) login(selected);
            }}
          >
            <h2 className="text-base font-semibold">Sign in to {db.settings.shelterName}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {mode === "local" ? "Demo mode: choose a staff profile. Each role sees what that person would see." : "Choose your profile."}
            </p>
            <fieldset className="mt-5">
              <legend className="sr-only">Staff profile</legend>
              {ROLES.map((role) => {
                const people = active.filter((s) => s.role === role);
                if (!people.length) return null;
                return (
                  <div key={role} className="mb-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#A0AEC0]">{role === "Support Staff" ? "Support staff" : `${role}${people.length > 1 ? "s" : ""}`}</p>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {people.map((s) => (
                        <label key={s.id} className={cn("flex cursor-pointer items-center gap-2.5 rounded-md border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-teal", selected === s.id ? "border-teal bg-teal-soft" : "border-line hover:bg-canvas")}>
                          <input type="radio" name="staff" value={s.id} checked={selected === s.id} onChange={() => setSelected(s.id)} className="sr-only" />
                          <Avatar id={s.id} name={s.name} size="sm" />
                          <span className="truncate text-sm font-medium">{s.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </fieldset>
            <Button type="submit" size="lg" className="mt-3 w-full" disabled={!selected}><LogIn /> Sign in{sel ? ` as ${sel.name}` : ""}</Button>
          </form>
          <aside className="border-t border-line bg-[#FAFBFC] p-6 md:border-l md:border-t-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#A0AEC0]">{sel?.role} access</p>
            <ul className="mt-2 space-y-1.5 text-sm text-ink">
              {sel && ROLE_SUMMARY[sel.role].map((r) => (
                <li key={r} className="flex gap-2"><span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-teal" aria-hidden />{r}</li>
              ))}
            </ul>
            <p className="mt-6 text-xs leading-relaxed text-ink-muted">
              All names, animals and treatments are fictional sample data. Data is saved in this browser and survives refreshes. Reset it any time from Settings.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
}
