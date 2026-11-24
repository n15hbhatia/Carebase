import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { RefreshCw, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { CASE_STATUSES, PRIORITIES } from "@/lib/types";
import { generateHandoverSummary, staffName } from "@/lib/utils";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/input";
import { StaffOptions } from "../domain";
import { TokenChip } from "../ui/misc";

const schema = z
  .object({
    caseId: z.string().min(1, "Choose the case you are handing over"),
    fromId: z.string().min(1, "Choose who is handing over"),
    toId: z.string().min(1, "Choose who will take over"),
    previousAction: z.string().trim().min(2, "Describe the last action completed"),
    currentStatus: z.enum(CASE_STATUSES),
    nextAction: z.string().trim().min(2, "Describe the next required action"),
    notes: z.string().trim().max(400),
    priority: z.enum(["Low", "Normal", "High", "Urgent"]),
    summary: z.string().trim().min(20, "The summary should be at least one full sentence").max(500),
  })
  .refine((v) => v.fromId !== v.toId, { path: ["toId"], message: "The receiving staff member must be different from the person handing over" });
type Values = z.infer<typeof schema>;

export default function HandoverFormDialog({ caseId, onClose }: { caseId?: string; onClose: () => void }) {
  const { db, user, createHandover } = useStore();
  const openCases = db.cases.filter((c) => c.status !== "Completed").sort((a, b) => a.token.localeCompare(b.token, undefined, { numeric: true }));
  const initial = db.cases.find((c) => c.id === caseId);
  const summaryEdited = useRef(false);

  const { register, handleSubmit, watch, setValue, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      caseId: caseId ?? "",
      fromId: initial?.responsibleId ?? user?.id ?? "",
      toId: "",
      previousAction: initial?.lastAction ?? "",
      currentStatus: initial?.status ?? "In Treatment",
      nextAction: initial?.nextAction ?? "",
      notes: "",
      priority: "Normal",
      summary: "",
    },
  });

  const v = watch();
  const selected = db.cases.find((c) => c.id === v.caseId);
  const animal = selected ? db.animals.find((a) => a.id === selected.animalId) : undefined;
  const pending = selected ? db.handovers.find((h) => h.caseId === selected.id && h.status === "Pending") : undefined;

  // Auto-populate from the case when the selection changes.
  const lastCase = useRef(caseId ?? "");
  useEffect(() => {
    if (!selected || lastCase.current === selected.id) return;
    lastCase.current = selected.id;
    setValue("fromId", selected.responsibleId ?? user?.id ?? "");
    setValue("previousAction", selected.lastAction);
    setValue("currentStatus", selected.status);
    setValue("nextAction", selected.nextAction);
  }, [selected, setValue, user?.id]);

  const buildSummary = () =>
    selected && animal && v.toId
      ? generateHandoverSummary({
          previousAction: v.previousAction, fromName: staffName(db, v.fromId), toName: staffName(db, v.toId),
          nextAction: v.nextAction, status: v.currentStatus, animalName: animal.name, token: selected.token,
        })
      : "";

  // Keep the summary in sync until the user edits it by hand.
  const auto = buildSummary();
  useEffect(() => {
    if (!summaryEdited.current) setValue("summary", auto);
  }, [auto, setValue]);

  const onSubmit = (val: Values) => {
    if (pending) {
      setError("caseId", { message: `This case already has a handover awaiting acknowledgement (${pending.id}).` });
      return;
    }
    const h = createHandover({ ...val, notes: val.notes || undefined });
    toast.success(`Handover ${h.id} sent to ${staffName(db, val.toId)}`, { description: "They will be asked to acknowledge it." });
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title="Create handover"
      description="Pass a case to a colleague so they can take over without asking you for the details."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="ho-form">Send handover</Button>
        </>
      }
    >
      <form id="ho-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field id="ho-case" label="1. Case" required error={errors.caseId?.message} className="sm:col-span-2">
          <Select id="ho-case" aria-invalid={!!errors.caseId} {...register("caseId", { onChange: () => (summaryEdited.current = false) })}>
            <option value="">Select case</option>
            {openCases.map((c) => (
              <option key={c.id} value={c.id}>Token {c.token} — {db.animals.find((a) => a.id === c.animalId)?.name} ({c.id}, {c.status})</option>
            ))}
          </Select>
        </Field>
        {selected && animal && (
          <div className="sm:col-span-2 -mt-1 flex flex-wrap items-center gap-2 rounded-md bg-[#FAFBFC] px-3 py-2 text-xs text-ink-muted">
            <TokenChip token={selected.token} />
            <span className="font-medium text-ink">{animal.name}</span>
            <span>· Doctor: {staffName(db, selected.doctorId)}</span>
            <span>· Currently responsible: {staffName(db, selected.responsibleId)}</span>
            {pending && <span className="text-warning-ink">· Pending handover {pending.id} not yet acknowledged</span>}
          </div>
        )}
        <Field id="ho-from" label="2. Handed over by" required error={errors.fromId?.message}>
          <Select id="ho-from" aria-invalid={!!errors.fromId} {...register("fromId")}><StaffOptions /></Select>
        </Field>
        <Field id="ho-to" label="3. Receiving staff member" required error={errors.toId?.message}>
          <Select id="ho-to" aria-invalid={!!errors.toId} {...register("toId")}><StaffOptions roles={["Doctor", "Assistant", "Manager"]} /></Select>
        </Field>
        <Field id="ho-prev" label="4. Previous action" required error={errors.previousAction?.message}>
          <Input id="ho-prev" aria-invalid={!!errors.previousAction} {...register("previousAction")} />
        </Field>
        <Field id="ho-status" label="5. Current status" required>
          <Select id="ho-status" {...register("currentStatus")}>{CASE_STATUSES.filter((s) => s !== "Completed").map((s) => <option key={s}>{s}</option>)}</Select>
        </Field>
        <Field id="ho-next" label="6. Next required action" required error={errors.nextAction?.message}>
          <Input id="ho-next" aria-invalid={!!errors.nextAction} {...register("nextAction")} />
        </Field>
        <Field id="ho-pri" label="8. Priority" required>
          <Select id="ho-pri" {...register("priority")}>{PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select>
        </Field>
        <Field id="ho-notes" label="7. Important notes" className="sm:col-span-2">
          <Textarea id="ho-notes" rows={2} {...register("notes")} placeholder="Temperament, feeding, anything that would otherwise go on a Post-it" />
        </Field>

        <div className="sm:col-span-2 rounded-lg border border-teal/25 bg-teal-soft/60 p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <label htmlFor="ho-summary" className="flex items-center gap-1.5 text-[13px] font-semibold text-teal">
              <Sparkles className="h-4 w-4" aria-hidden /> Handover summary<span className="text-danger" aria-hidden>*</span>
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                summaryEdited.current = false;
                setValue("summary", buildSummary());
              }}
              disabled={!auto}
            >
              <RefreshCw /> Regenerate
            </Button>
          </div>
          <Textarea
            id="ho-summary"
            rows={3}
            aria-invalid={!!errors.summary}
            className="bg-white"
            placeholder="Select a case and a receiving staff member to generate the summary."
            {...register("summary", { onChange: () => (summaryEdited.current = true) })}
          />
          {errors.summary ? (
            <p role="alert" className="mt-1 text-xs text-danger-ink">{errors.summary.message}</p>
          ) : (
            <p className="mt-1 text-xs text-ink-muted">Generated from the fields above. Edit it freely before sending.</p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
