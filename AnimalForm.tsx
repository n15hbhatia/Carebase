import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { ImagePlus, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { ANIMAL_TYPES, SEXES, type Animal } from "@/lib/types";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "../ui/input";
import { AnimalAvatar, StaffOptions } from "../domain";

const schema = z
  .object({
    name: z.string().trim().min(1, "Enter the animal's name").max(40, "Keep the name under 40 characters"),
    token: z.string().trim().regex(/^\d{1,4}$/, "Token must be 1–4 digits, e.g. 028"),
    type: z.enum(["Dog", "Cat", "Other"]),
    breed: z.string().trim().max(60),
    age: z.string().trim().max(30),
    sex: z.enum(["Male", "Female", "Unknown"]),
    ownerName: z.string().trim().max(60),
    contactNumber: z.string().trim().refine((v) => v === "" || /^[+\d][\d\s-]{6,17}$/.test(v), "Enter a valid phone number"),
    doctorId: z.string(),
    notes: z.string().trim().max(500, "Keep notes under 500 characters"),
    openCase: z.boolean(),
    reason: z.string().trim(),
    responsibleId: z.string(),
    nextAction: z.string().trim(),
  })
  .superRefine((v, ctx) => {
    if (v.openCase && !v.reason) ctx.addIssue({ code: "custom", path: ["reason"], message: "Describe why the animal was admitted" });
    if (v.openCase && !v.nextAction) ctx.addIssue({ code: "custom", path: ["nextAction"], message: "Enter the next action" });
  });
type Values = z.infer<typeof schema>;

async function resizeImage(file: File, max = 480): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function AnimalFormDialog({ animal, onClose }: { animal?: Animal; onClose: () => void }) {
  const { db, user, addAnimal, updateAnimal } = useStore();
  const navigate = useNavigate();
  const editing = !!animal;
  const [image, setImage] = useState<string | undefined>(animal?.imageUrl);
  const nextToken = String(Math.max(0, ...db.animals.map((a) => Number(a.token) || 0)) + 1).padStart(3, "0");

  const { register, handleSubmit, watch, setValue, setError, formState: { errors, isSubmitting } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: animal?.name ?? "", token: animal?.token ?? nextToken, type: animal?.type ?? "Dog", breed: animal?.breed ?? "",
      age: animal?.age ?? "", sex: animal?.sex ?? "Unknown", ownerName: animal?.ownerName ?? "", contactNumber: animal?.contactNumber ?? "",
      doctorId: animal?.doctorId ?? "", notes: animal?.notes ?? "", openCase: !editing, reason: "",
      responsibleId: user?.id ?? "", nextAction: "Initial assessment",
    },
  });
  const openCase = watch("openCase");

  const onSubmit = (v: Values) => {
    // Token must not clash with another animal's open case — tokens identify the case on the floor.
    const clash = db.cases.find((c) => c.status !== "Completed" && c.token === v.token && c.animalId !== animal?.id);
    if (clash) {
      setError("token", { message: `Token ${v.token} is in use on active case ${clash.id}` });
      return;
    }
    const base = {
      name: v.name, token: v.token, type: v.type, breed: v.breed, age: v.age, sex: v.sex,
      ownerName: v.ownerName || undefined, contactNumber: v.contactNumber || undefined,
      doctorId: v.doctorId || undefined, notes: v.notes || undefined, imageUrl: image,
    };
    if (editing) {
      updateAnimal(animal.id, base);
      toast.success(`${v.name}'s record updated`);
      onClose();
      return;
    }
    const created = addAnimal(
      { ...base, admissionDate: new Date().toISOString() },
      v.openCase ? { reason: v.reason, doctorId: v.doctorId || undefined, responsibleId: v.responsibleId || undefined, nextAction: v.nextAction } : null,
    );
    toast.success(`${created.name} added${v.openCase ? " and admission case opened" : ""}`);
    onClose();
    navigate(`/animals/${created.id}`);
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      size="lg"
      title={editing ? `Edit ${animal.name}` : "Add animal"}
      description={editing ? `Animal ID ${animal.id}` : "Register an animal and open its admission case in one step."}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="animal-form" disabled={isSubmitting}>{editing ? "Save changes" : "Add animal"}</Button>
        </>
      }
    >
      <form id="animal-form" onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div className="flex items-center gap-4">
          <AnimalAvatar animal={{ name: watch("name") || "New animal", type: watch("type"), imageUrl: image }} size="lg" />
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex h-8 cursor-pointer items-center gap-2 rounded-md border border-line bg-white px-3 text-[13px] font-medium text-ink hover:bg-canvas focus-within:ring-2 focus-within:ring-teal">
              <ImagePlus className="h-4 w-4 text-ink-muted" aria-hidden />
              {image ? "Change photo" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    setImage(await resizeImage(f));
                  } catch {
                    toast.error("That image could not be read");
                  }
                }}
              />
            </label>
            {image && (
              <Button variant="ghost" size="sm" onClick={() => setImage(undefined)}><Trash2 /> Remove</Button>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="a-name" label="Name" required error={errors.name?.message} className="sm:col-span-2">
            <Input id="a-name" autoFocus aria-invalid={!!errors.name} {...register("name")} placeholder="e.g. Bruno" />
          </Field>
          <Field id="a-token" label="Token number" required error={errors.token?.message} hint="Number on the physical token">
            <Input id="a-token" inputMode="numeric" aria-invalid={!!errors.token} {...register("token")} className="font-mono" />
          </Field>
          <Field id="a-type" label="Animal type" required>
            <Select id="a-type" {...register("type")}>{ANIMAL_TYPES.map((t) => <option key={t}>{t}</option>)}</Select>
          </Field>
          <Field id="a-breed" label="Breed">
            <Input id="a-breed" {...register("breed")} placeholder="e.g. Indian Pariah" />
          </Field>
          <Field id="a-sex" label="Sex">
            <Select id="a-sex" {...register("sex")}>{SEXES.map((t) => <option key={t}>{t}</option>)}</Select>
          </Field>
          <Field id="a-age" label="Approximate age">
            <Input id="a-age" {...register("age")} placeholder="e.g. 3 yrs" />
          </Field>
          <Field id="a-doc" label="Assigned doctor" className="sm:col-span-2">
            <Select id="a-doc" {...register("doctorId")}><StaffOptions roles={["Doctor"]} placeholder="Not assigned yet" /></Select>
          </Field>
          <Field id="a-owner" label="Owner name" hint="Leave blank for strays">
            <Input id="a-owner" {...register("ownerName")} />
          </Field>
          <Field id="a-contact" label="Contact number" error={errors.contactNumber?.message}>
            <Input id="a-contact" type="tel" aria-invalid={!!errors.contactNumber} {...register("contactNumber")} placeholder="+91 98xxx xxxxx" />
          </Field>
          <Field id="a-notes" label="Notes" error={errors.notes?.message} className="sm:col-span-3">
            <Textarea id="a-notes" rows={2} {...register("notes")} placeholder="Temperament, where found, anything the next person should know" />
          </Field>
        </div>

        {!editing && (
          <div className="rounded-lg border border-line bg-[#FAFBFC] p-4">
            <Checkbox id="a-open" checked={openCase} onChange={(v) => setValue("openCase", v)} label={<span className="font-medium">Open an admission case now</span>} />
            <p className="ml-6 mt-0.5 text-xs text-ink-muted">Every admission is tracked as a case under its token number.</p>
            {openCase && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field id="a-reason" label="Reason for admission" required error={errors.reason?.message} className="sm:col-span-2">
                  <Input id="a-reason" aria-invalid={!!errors.reason} {...register("reason")} placeholder="e.g. Wound on left hind leg" />
                </Field>
                <Field id="a-resp" label="Responsible person">
                  <Select id="a-resp" {...register("responsibleId")}><StaffOptions placeholder="Me" /></Select>
                </Field>
                <Field id="a-next" label="Next action" required error={errors.nextAction?.message}>
                  <Input id="a-next" aria-invalid={!!errors.nextAction} {...register("nextAction")} />
                </Field>
              </div>
            )}
          </div>
        )}
      </form>
    </Dialog>
  );
}
