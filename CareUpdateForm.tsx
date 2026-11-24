import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { CASE_STATUSES, UPDATE_TYPES, type CaseStatus, type UpdateType } from "@/lib/types";
import { fmtSmart } from "@/lib/utils";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/input";
import { StaffOptions } from "../domain";

const schema = z.object({
  caseId: z.string().min(1, "Choose a case"),
  type: z.enum(UPDATE_TYPES),
  description: z.string().trim().min(3, "Describe what was done or observed").max(400, "Keep it under 400 characters"),
  status: z.enum(CASE_STATUSES),
  nextAction: z.string().trim().min(2, "Enter what needs to happen next"),
  responsibleId: z.string().min(1, "Choose who is responsible for the next action"),
});
type Values = z.infer<typeof schema>;

const SELECTABLE_TYPES = UPDATE_TYPES.filter((t) => !["Admission", "Token Issued", "Handover"].includes(t));

export default function CareUpdateDialog({ caseId, preset, onClose }: { caseId?: string; preset?: { type?: UpdateType; status?: CaseStatus }; onClose: () => void }) {
  const { db, user, addCareUpdate } = useStore();
  const canStatus = can(user, "case.status");
  const activeCases = db.cases
    .filter((c) => c.status !== "Completed" || c.id === caseId)
    .sort((a, b) => a.token.localeCompare(b.token, undefined, { numeric: true }));
  const initial = db.cases.find((c) => c.id === caseId);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      caseId: caseId ?? "",
      type: preset?.type ?? (user?.role === "Doctor" ? "Assessment" : "Treatment"),
      description: "",
      status: preset?.status ?? initial?.status ?? "In Treatment",
      nextAction: preset?.status === "Completed" ? "No further action" : initial?.nextAction ?? "",
      responsibleId: initial?.responsibleId ?? user?.id ?? "",
    },
  });
  const selectedId = watch("caseId");
  const selected = db.cases.find((c) => c.id === selectedId);
  useEffect(() => {
    if (selected && selected.id !== caseId) {
      setValue("status", selected.status);
      setValue("nextAction", selected.nextAction);
      setValue("responsibleId", selected.responsibleId ?? user?.id ?? "");
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const animal = selected ? db.animals.find((a) => a.id === selected.animalId) : undefined;

  const onSubmit = (v: Values) => {
    const c = db.cases.find((x) => x.id === v.caseId)!;
    addCareUpdate(v.caseId, {
      type: v.type,
      description: v.description,
      status: canStatus ? v.status : c.status,
      nextAction: v.nextAction,
      responsibleId: v.responsibleId,
    });
    toast.success("Care update recorded", { description: `Care Status Card for token ${c.token} is up to date.` });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={preset?.status ? `Move to “${preset.status}”` : "Add care update"}
      description={selected && animal ? `${animal.name} · token ${selected.token} · last updated ${fmtSmart(selected.updatedAt)}` : "Record what happened and what comes next."}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="cu-form">Save update</Button>
        </>
      }
    >
      <form id="cu-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        {!caseId && (
          <Field id="cu-case" label="Case" required error={errors.caseId?.message} className="sm:col-span-2">
            <Select id="cu-case" aria-invalid={!!errors.caseId} {...register("caseId")}>
              <option value="">Select case</option>
              {activeCases.map((c) => {
                const a = db.animals.find((x) => x.id === c.animalId);
                return <option key={c.id} value={c.id}>Token {c.token} — {a?.name} ({c.id}, {c.status})</option>;
              })}
            </Select>
          </Field>
        )}
        <Field id="cu-type" label="Update type" required>
          <Select id="cu-type" {...register("type")}>{SELECTABLE_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
        </Field>
        <Field id="cu-status" label="Current status" required hint={canStatus ? undefined : "Only doctors and the manager can change case status"}>
          {canStatus ? (
            <Select id="cu-status" {...register("status")}>{CASE_STATUSES.map((t) => <option key={t}>{t}</option>)}</Select>
          ) : (
            <>
              <input type="hidden" {...register("status")} />
              <Select id="cu-status" disabled value={selected?.status ?? ""} onChange={() => undefined}>
                <option value="">—</option>
                {CASE_STATUSES.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </>
          )}
        </Field>
        <Field id="cu-desc" label="What was done or observed" required error={errors.description?.message} className="sm:col-span-2">
          <Textarea id="cu-desc" rows={3} aria-invalid={!!errors.description} {...register("description")} placeholder={preset?.status === "Completed" ? "e.g. Wound healed; discharged to owner" : "e.g. Wound dressing changed; no swelling, ate full meal"} />
        </Field>
        <Field id="cu-next" label="Next action" required error={errors.nextAction?.message}>
          <Input id="cu-next" aria-invalid={!!errors.nextAction} {...register("nextAction")} placeholder="e.g. Evening dressing change" />
        </Field>
        <Field id="cu-resp" label="Responsible person" required error={errors.responsibleId?.message}>
          <Select id="cu-resp" aria-invalid={!!errors.responsibleId} {...register("responsibleId")}><StaffOptions /></Select>
        </Field>
        <p className="sm:col-span-2 text-xs text-ink-muted">Recorded as {user?.name} at the current date and time.</p>
      </form>
    </Dialog>
  );
}
