import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { useStore } from "@/lib/store";
import { DUTY_TYPES, SHIFT_HOURS, SHIFTS, type DutySchedule } from "@/lib/types";
import { DAY_NAMES } from "@/lib/utils";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/input";
import { StaffOptions } from "../domain";

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date"),
  staffId: z.string().min(1, "Choose a staff member"),
  shift: z.enum(["Morning", "Afternoon", "Evening", "Full Day"]),
  duty: z.enum(DUTY_TYPES),
  notes: z.string().trim().max(200),
});
type Values = z.infer<typeof schema>;

export default function DutyFormDialog({ duty, defaults, onClose }: { duty?: DutySchedule; defaults?: Partial<DutySchedule>; onClose: () => void }) {
  const { db, saveDuty } = useStore();
  const src = { ...defaults, ...duty };
  const { register, handleSubmit, watch, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: src.date ?? format(new Date(), "yyyy-MM-dd"), staffId: src.staffId ?? "", shift: src.shift ?? "Morning",
      duty: src.duty ?? "Ward Rounds", notes: src.notes ?? "",
    },
  });
  const date = watch("date");
  const dutyType = watch("duty");
  const isSurgeryDay = date ? db.settings.surgeryDays.includes(parseISO(date).getDay()) : false;
  const surgeryWarning = (dutyType === "Surgery" || dutyType === "Surgery Assist") && date && !isSurgeryDay;

  const onSubmit = (v: Values) => {
    const clash = db.dutySchedules.find((d) => d.id !== duty?.id && d.date === v.date && d.staffId === v.staffId && (d.shift === v.shift || d.shift === "Full Day" || v.shift === "Full Day"));
    if (clash) {
      setError("shift", { message: `Already on ${clash.duty} (${clash.shift}) that day` });
      return;
    }
    saveDuty({ ...v, notes: v.notes || undefined }, duty?.id);
    toast.success(duty ? "Duty updated" : "Duty assigned");
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="sm"
      title={duty ? "Edit duty" : "Assign duty"}
      description={date ? `${DAY_NAMES[parseISO(date).getDay()]}${isSurgeryDay ? " · surgery day" : ""}` : undefined}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="duty-form">{duty ? "Save" : "Assign"}</Button>
        </>
      }
    >
      <form id="duty-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
        <Field id="d-date" label="Date" required error={errors.date?.message}>
          <Input id="d-date" type="date" {...register("date")} />
        </Field>
        <Field id="d-staff" label="Staff member" required error={errors.staffId?.message}>
          <Select id="d-staff" aria-invalid={!!errors.staffId} {...register("staffId")}><StaffOptions /></Select>
        </Field>
        <Field id="d-shift" label="Shift" required error={errors.shift?.message}>
          <Select id="d-shift" {...register("shift")}>{SHIFTS.map((s) => <option key={s} value={s}>{s} ({SHIFT_HOURS[s]})</option>)}</Select>
        </Field>
        <Field id="d-duty" label="Duty" required hint={surgeryWarning ? "Heads up: this date is not a configured surgery day." : undefined}>
          <Select id="d-duty" {...register("duty")}>{DUTY_TYPES.map((s) => <option key={s}>{s}</option>)}</Select>
        </Field>
        <Field id="d-notes" label="Notes">
          <Textarea id="d-notes" rows={2} {...register("notes")} />
        </Field>
      </form>
    </Dialog>
  );
}
