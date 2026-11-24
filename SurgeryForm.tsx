import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { addDays, format, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { SURGERY_STATUSES } from "@/lib/types";
import { DAY_NAMES } from "@/lib/utils";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Field, Input, Select } from "../ui/input";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choose a time"),
  procedure: z.string().trim().min(3, "Name the procedure"),
  status: z.enum(["Scheduled", "In Progress", "Completed", "Postponed"]),
});
type Values = z.infer<typeof schema>;

export default function SurgeryFormDialog({ caseId, onClose }: { caseId: string; onClose: () => void }) {
  const { db, scheduleSurgery } = useStore();
  const c = db.cases.find((x) => x.id === caseId)!;
  const animal = db.animals.find((a) => a.id === c.animalId);
  const days = db.settings.surgeryDays;
  const nextDay = (() => {
    for (let i = 1; i < 14; i++) {
      const d = addDays(new Date(), i);
      if (days.includes(d.getDay())) return format(d, "yyyy-MM-dd");
    }
    return format(addDays(new Date(), 1), "yyyy-MM-dd");
  })();
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: c.surgeryAt ? format(parseISO(c.surgeryAt), "yyyy-MM-dd") : nextDay,
      time: c.surgeryAt ? format(parseISO(c.surgeryAt), "HH:mm") : db.settings.surgeryStartTime,
      procedure: c.surgeryProcedure ?? "",
      status: c.surgeryStatus === "Completed" || c.surgeryStatus === "Postponed" || !c.surgeryStatus ? "Scheduled" : c.surgeryStatus,
    },
  });
  const date = watch("date");
  const offDay = date && !days.includes(parseISO(date).getDay());

  const onSubmit = (v: Values) => {
    scheduleSurgery(caseId, { at: new Date(`${v.date}T${v.time}:00`).toISOString(), procedure: v.procedure, status: v.status });
    toast.success(v.status === "Scheduled" ? "Surgery scheduled" : `Surgery marked ${v.status.toLowerCase()}`);
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={c.surgeryAt && c.surgeryStatus !== "Completed" ? "Update surgery" : "Schedule surgery"}
      description={`${animal?.name} · token ${c.token} · ${c.id}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="surgery-form">Save</Button>
        </>
      }
    >
      <form id="surgery-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field id="sg-proc" label="Procedure" required error={errors.procedure?.message} className="sm:col-span-2">
          <Input id="sg-proc" autoFocus aria-invalid={!!errors.procedure} {...register("procedure")} placeholder="e.g. Spay (sterilisation)" />
        </Field>
        <Field id="sg-date" label="Date" required error={errors.date?.message}
          hint={offDay ? `${DAY_NAMES[parseISO(date).getDay()]} is not a surgery day (${days.map((d) => DAY_NAMES[d].slice(0, 3)).join(", ")}).` : "Surgery day"}>
          <Input id="sg-date" type="date" {...register("date")} />
        </Field>
        <Field id="sg-time" label="Time" required error={errors.time?.message}>
          <Input id="sg-time" type="time" {...register("time")} />
        </Field>
        <Field id="sg-status" label="Surgery status" required className="sm:col-span-2">
          <Select id="sg-status" {...register("status")}>{SURGERY_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select>
        </Field>
      </form>
    </Dialog>
  );
}
