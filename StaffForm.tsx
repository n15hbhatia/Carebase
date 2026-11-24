import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { ROLES, type Staff } from "@/lib/types";
import { ROLE_SUMMARY } from "@/lib/permissions";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Checkbox, Field, Input, Select } from "../ui/input";

const schema = z.object({
  name: z.string().trim().min(2, "Enter the staff member's full name").max(60),
  role: z.enum(["Manager", "Doctor", "Assistant", "Support Staff"]),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().trim().regex(/^[+\d][\d\s-]{6,17}$/, "Enter a valid phone number"),
  joinedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a joining date"),
  active: z.boolean(),
});
type Values = z.infer<typeof schema>;

export default function StaffFormDialog({ staff, onClose }: { staff?: Staff; onClose: () => void }) {
  const { db, user, addStaff, updateStaff } = useStore();
  const editing = !!staff;
  const { register, handleSubmit, watch, setValue, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: staff?.name ?? "", role: staff?.role ?? "Assistant", email: staff?.email ?? "", phone: staff?.phone ?? "",
      joinedAt: (staff?.joinedAt ?? new Date().toISOString()).slice(0, 10), active: staff?.active ?? true,
    },
  });
  const role = watch("role");
  const active = watch("active");

  const onSubmit = (v: Values) => {
    if (db.staff.some((s) => s.email.toLowerCase() === v.email.toLowerCase() && s.id !== staff?.id)) {
      setError("email", { message: "Another staff member already uses this email" });
      return;
    }
    if (editing && staff.id === user?.id && (!v.active || v.role !== "Manager")) {
      setError("role", { message: "You cannot remove your own manager access or deactivate yourself" });
      return;
    }
    const payload = { ...v, joinedAt: new Date(`${v.joinedAt}T09:00:00`).toISOString() };
    if (editing) {
      updateStaff(staff.id, payload);
      toast.success(`${v.name} updated`);
    } else {
      const s = addStaff(payload);
      toast.success(`${s.name} added as ${s.role}`);
    }
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={editing ? `Edit ${staff.name}` : "Add staff member"}
      description={editing ? `Staff ID ${staff.id}` : "New staff can sign in once added."}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="staff-form">{editing ? "Save changes" : "Add staff member"}</Button>
        </>
      }
    >
      <form id="staff-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field id="s-name" label="Full name" required error={errors.name?.message} className="sm:col-span-2">
          <Input id="s-name" autoFocus aria-invalid={!!errors.name} {...register("name")} placeholder="e.g. Dr. Kavya Rao" />
        </Field>
        <Field id="s-role" label="Role" required error={errors.role?.message}>
          <Select id="s-role" {...register("role")}>{ROLES.map((r) => <option key={r}>{r}</option>)}</Select>
        </Field>
        <Field id="s-joined" label="Joined on" required error={errors.joinedAt?.message}>
          <Input id="s-joined" type="date" {...register("joinedAt")} />
        </Field>
        <Field id="s-email" label="Email" required error={errors.email?.message}>
          <Input id="s-email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...register("email")} />
        </Field>
        <Field id="s-phone" label="Phone" required error={errors.phone?.message}>
          <Input id="s-phone" type="tel" aria-invalid={!!errors.phone} {...register("phone")} placeholder="+91 98xxx xxxxx" />
        </Field>
        <div className="sm:col-span-2 rounded-md bg-[#FAFBFC] px-3 py-2.5 text-xs text-ink-muted">
          <span className="font-medium text-ink">{role} access: </span>
          {ROLE_SUMMARY[role].join(" · ")}
        </div>
        {editing && (
          <Checkbox id="s-active" checked={active} onChange={(v) => setValue("active", v)} label="Account active" className="sm:col-span-2" />
        )}
      </form>
    </Dialog>
  );
}
