import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/lib/store";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Field, Input, Select } from "../ui/input";
import { StaffOptions } from "../domain";

const schema = z.object({
  animalId: z.string().min(1, "Choose the animal for this case"),
  token: z.string().trim().regex(/^\d{1,4}$/, "Token must be 1–4 digits"),
  reason: z.string().trim().min(3, "Describe why the animal is being admitted"),
  doctorId: z.string(),
  responsibleId: z.string(),
  nextAction: z.string().trim().min(2, "Enter what needs to happen next"),
  status: z.enum(["Newly Admitted", "Awaiting Assessment"]),
});
type Values = z.infer<typeof schema>;

export default function CaseFormDialog({ animalId, onClose }: { animalId?: string; onClose: () => void }) {
  const { db, user, createCase } = useStore();
  const navigate = useNavigate();
  const animals = db.animals.filter((a) => !a.archived).sort((a, b) => a.name.localeCompare(b.name));
  const first = animalId ? db.animals.find((a) => a.id === animalId) : undefined;

  const { register, handleSubmit, watch, setValue, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      animalId: animalId ?? "", token: first?.token ?? "", reason: "", doctorId: first?.doctorId ?? "",
      responsibleId: user?.id ?? "", nextAction: "Initial assessment", status: "Awaiting Assessment",
    },
  });
  const selected = watch("animalId");
  useEffect(() => {
    const a = db.animals.find((x) => x.id === selected);
    if (a && a.id !== animalId) {
      setValue("token", a.token);
      setValue("doctorId", a.doctorId ?? "");
    }
  }, [selected, db.animals, setValue, animalId]);

  const openCase = db.cases.find((c) => c.animalId === selected && c.status !== "Completed");

  const onSubmit = (v: Values) => {
    if (openCase) {
      setError("animalId", { message: `This animal already has an active case (${openCase.id}). Close it before opening a new one.` });
      return;
    }
    const clash = db.cases.find((c) => c.status !== "Completed" && c.token === v.token);
    if (clash) {
      setError("token", { message: `Token ${v.token} is in use on active case ${clash.id}` });
      return;
    }
    const c = createCase({ ...v, doctorId: v.doctorId || undefined, responsibleId: v.responsibleId || undefined });
    toast.success(`Case ${c.id} opened`);
    onClose();
    navigate(`/cases/${c.id}`);
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Create case"
      description="A case tracks one admission, from token issue to completion."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="case-form">Create case</Button>
        </>
      }
    >
      <form id="case-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-3">
        <Field id="c-animal" label="Animal" required error={errors.animalId?.message} className="sm:col-span-2" hint={animals.length === 0 ? "Add an animal first" : undefined}>
          <Select id="c-animal" aria-invalid={!!errors.animalId} {...register("animalId")}>
            <option value="">Select animal</option>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>{a.name} — {a.type} (token {a.token})</option>
            ))}
          </Select>
        </Field>
        <Field id="c-token" label="Token number" required error={errors.token?.message}>
          <Input id="c-token" className="font-mono" inputMode="numeric" aria-invalid={!!errors.token} {...register("token")} />
        </Field>
        {openCase && !errors.animalId && (
          <p className="sm:col-span-3 -mt-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-warning-ink">
            This animal already has an active case ({openCase.id}, {openCase.status}). Complete it before opening a new one.
          </p>
        )}
        <Field id="c-reason" label="Reason for admission" required error={errors.reason?.message} className="sm:col-span-3">
          <Input id="c-reason" aria-invalid={!!errors.reason} {...register("reason")} placeholder="e.g. Limping on left foreleg" />
        </Field>
        <Field id="c-doc" label="Assigned doctor">
          <Select id="c-doc" {...register("doctorId")}><StaffOptions roles={["Doctor"]} placeholder="Not assigned yet" /></Select>
        </Field>
        <Field id="c-resp" label="Responsible person">
          <Select id="c-resp" {...register("responsibleId")}><StaffOptions placeholder="Me" /></Select>
        </Field>
        <Field id="c-status" label="Starting status">
          <Select id="c-status" {...register("status")}>
            <option>Awaiting Assessment</option>
            <option>Newly Admitted</option>
          </Select>
        </Field>
        <Field id="c-next" label="Next action" required error={errors.nextAction?.message} className="sm:col-span-3">
          <Input id="c-next" aria-invalid={!!errors.nextAction} {...register("nextAction")} />
        </Field>
      </form>
    </Dialog>
  );
}
