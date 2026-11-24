import { useState, type FormEvent } from "react";
import { Database, RotateCcw, Save, Scissors, Server } from "lucide-react";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { DAY_NAMES, cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/misc";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/dialog";
import { PageHeader } from "@/components/domain";

const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function SettingsPage() {
  const { db, user, updateSettings, resetDemoData, mode } = useStore();
  const editable = can(user, "settings.manage");
  const [form, setForm] = useState(db.settings);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(db.settings);

  const save = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (form.shelterName.trim().length < 3) errs.shelterName = "Enter the shelter's name";
    if (form.surgeryDays.length === 0) errs.surgeryDays = "Choose at least one surgery day";
    if (!/^\d{2}:\d{2}$/.test(form.surgeryStartTime)) errs.surgeryStartTime = "Choose a start time";
    if (!(form.handoverReminderHours >= 1 && form.handoverReminderHours <= 24)) errs.handoverReminderHours = "Enter 1 to 24 hours";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    updateSettings({ ...form, shelterName: form.shelterName.trim(), location: form.location.trim() });
    toast.success("Settings saved");
  };

  return (
    <>
      <PageHeader title="Settings" description={editable ? "Shelter details and the surgery schedule used across Carebase." : "Only the manager can change these settings."} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <form onSubmit={save} noValidate className="space-y-5">
          <Card>
            <CardHeader title="Shelter" />
            <fieldset disabled={!editable} className="grid gap-4 p-4 sm:grid-cols-2">
              <Field id="st-name" label="Shelter name" required error={errors.shelterName}>
                <Input id="st-name" value={form.shelterName} onChange={(e) => setForm({ ...form, shelterName: e.target.value })} aria-invalid={!!errors.shelterName} />
              </Field>
              <Field id="st-loc" label="Location">
                <Input id="st-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
              <Field id="st-ho" label="Remind about unacknowledged handovers after (hours)" required error={errors.handoverReminderHours} className="sm:col-span-2">
                <Input id="st-ho" type="number" min={1} max={24} className="w-28" value={form.handoverReminderHours} onChange={(e) => setForm({ ...form, handoverReminderHours: Number(e.target.value) })} aria-invalid={!!errors.handoverReminderHours} />
              </Field>
            </fieldset>
          </Card>
          <Card>
            <CardHeader title="Surgery schedule" icon={Scissors} description="Used for the dashboard, duty schedule and when booking surgeries" />
            <fieldset disabled={!editable} className="space-y-4 p-4">
              <legend className="sr-only">Surgery days</legend>
              <div>
                <p className="mb-2 text-[13px] font-medium">Surgery days<span className="text-danger" aria-hidden>*</span></p>
                <div className="flex flex-wrap gap-2">
                  {ORDER.map((d) => {
                    const on = form.surgeryDays.includes(d);
                    return (
                      <label key={d} className={cn("cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-teal", on ? "border-teal bg-teal-soft text-teal" : "border-line text-ink-muted hover:bg-canvas", !editable && "cursor-not-allowed opacity-70")}>
                        <input type="checkbox" className="sr-only" checked={on}
                          onChange={() => setForm({ ...form, surgeryDays: on ? form.surgeryDays.filter((x) => x !== d) : [...form.surgeryDays, d].sort() })} />
                        {DAY_NAMES[d].slice(0, 3)}
                      </label>
                    );
                  })}
                </div>
                {errors.surgeryDays && <p role="alert" className="mt-1 text-xs text-danger-ink">{errors.surgeryDays}</p>}
                <p className="mt-1.5 text-xs text-ink-muted">Observed schedule at the shelter: Monday, Tuesday, Thursday and Friday.</p>
              </div>
              <Field id="st-time" label="Theatre start time" required error={errors.surgeryStartTime}>
                <Input id="st-time" type="time" className="w-36" value={form.surgeryStartTime} onChange={(e) => setForm({ ...form, surgeryStartTime: e.target.value })} />
              </Field>
            </fieldset>
          </Card>
          {editable && (
            <div className="flex justify-end gap-2">
              <Button variant="outline" disabled={!dirty} onClick={() => { setForm(db.settings); setErrors({}); }}>Discard</Button>
              <Button type="submit" disabled={!dirty}><Save /> Save settings</Button>
            </div>
          )}
        </form>

        <div className="space-y-5">
          <Card>
            <CardHeader title="Data storage" icon={mode === "local" ? Database : Server} />
            <div className="space-y-3 p-4 text-sm">
              <p><span className="font-medium">{mode === "local" ? "Local demo mode." : "Connected to Supabase."}</span>{" "}
                <span className="text-ink-muted">{mode === "local" ? "Data is saved in this browser and persists across refreshes. It is not shared with other devices." : "Data is stored in your Supabase project."}</span></p>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                {[["Animals", db.animals.length], ["Cases", db.cases.length], ["Care updates", db.careUpdates.length], ["Handovers", db.handovers.length], ["Tasks", db.tasks.length], ["Activity entries", db.activityLogs.length]].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between rounded bg-canvas px-2 py-1.5"><dt className="text-ink-muted">{k}</dt><dd className="font-semibold tabular-nums">{v}</dd></div>
                ))}
              </dl>
              {mode === "local" && <p className="text-xs text-ink-muted">To connect Supabase, set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and run the SQL in supabase/migrations.</p>}
            </div>
          </Card>
          {mode === "local" && editable && (
            <Card>
              <CardHeader title="Reset demo data" icon={RotateCcw} />
              <div className="p-4">
                <p className="text-sm text-ink-muted">Replace everything with fresh sample data dated around today. Your changes will be lost.</p>
                <Button variant="danger-outline" className="mt-3" onClick={() => setConfirmReset(true)}><RotateCcw /> Reset demo data</Button>
              </div>
            </Card>
          )}
        </div>
      </div>
      <ConfirmDialog open={confirmReset} onOpenChange={setConfirmReset} title="Reset all demo data?" destructive confirmLabel="Reset data"
        description="All animals, cases, tasks, handovers and logs in this browser will be replaced with the original sample data. This cannot be undone."
        onConfirm={async () => { await resetDemoData(); setForm((f) => ({ ...f })); toast.success("Demo data reset"); setConfirmReset(false); window.setTimeout(() => window.location.reload(), 400); }} />
    </>
  );
}
