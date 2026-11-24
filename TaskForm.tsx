import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import { useStore } from "@/lib/store";
import { can } from "@/lib/permissions";
import { TASK_CATEGORIES, TASK_PRIORITIES, TASK_STATUSES, type Task } from "@/lib/types";
import { Dialog } from "../ui/dialog";
import { Button } from "../ui/button";
import { Field, Input, Select, Textarea } from "../ui/input";
import { StaffOptions } from "../domain";

const schema = z.object({
  title: z.string().trim().min(3, "Give the task a short title").max(80, "Keep the title under 80 characters"),
  description: z.string().trim().max(400),
  category: z.enum(TASK_CATEGORIES),
  caseId: z.string(),
  animalId: z.string().optional(),
  assigneeId: z.string().min(1, "Assign the task to someone"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a due date"),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/, "Choose a due time"),
  priority: z.enum(["Low", "Medium", "High"]),
  status: z.enum(["To Do", "In Progress", "Completed"]),
});
type Values = z.infer<typeof schema>;

export default function TaskFormDialog({ task, defaults, onClose }: { task?: Task; defaults?: Partial<Task>; onClose: () => void }) {
  const { db, user, createTask, updateTask } = useStore();
  const canAssign = can(user, "task.assign");
  const editing = !!task;
  const src = { ...defaults, ...task };
  const cases = db.cases.filter((c) => c.status !== "Completed" || c.id === src.caseId);
  const animals = db.animals.filter((a) => !a.archived || a.id === src.animalId);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: src.title ?? "", description: src.description ?? "", category: src.category ?? "General",
      caseId: src.caseId ?? "", animalId: src.animalId ?? "", assigneeId: src.assigneeId ?? (canAssign ? "" : user?.id ?? ""),
      dueDate: src.dueDate ?? format(new Date(), "yyyy-MM-dd"), dueTime: src.dueTime ?? format(new Date(Date.now() + 2 * 3600_000), "HH:00"),
      priority: src.priority ?? "Medium", status: src.status ?? "To Do",
    },
  });
  const caseId = watch("caseId");

  const onSubmit = (v: Values) => {
    const animalId = v.caseId ? db.cases.find((c) => c.id === v.caseId)?.animalId : v.animalId || undefined;
    const payload = { ...v, description: v.description || undefined, caseId: v.caseId || undefined, animalId };
    if (editing) {
      updateTask(task.id, payload);
      toast.success("Task updated");
    } else {
      const t = createTask(payload);
      toast.success(`Task ${t.id} created`, { description: `Assigned to ${db.staff.find((s) => s.id === t.assigneeId)?.name}` });
    }
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={editing ? `Edit task ${task.id}` : "Create task"}
      description="Tasks replace the Post-it notes on the board — one clear job, one owner, one due time."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="task-form">{editing ? "Save task" : "Create task"}</Button>
        </>
      }
    >
      <form id="task-form" onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field id="t-title" label="Task title" required error={errors.title?.message} className="sm:col-span-2">
          <Input id="t-title" autoFocus aria-invalid={!!errors.title} {...register("title")} placeholder="e.g. Evening wound dressing — Bruno" />
        </Field>
        <Field id="t-cat" label="Category" required>
          <Select id="t-cat" {...register("category")}>{TASK_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
        </Field>
        <Field id="t-assignee" label="Assigned to" required error={errors.assigneeId?.message} hint={canAssign ? undefined : "You can only create tasks for yourself"}>
          {canAssign ? (
            <Select id="t-assignee" aria-invalid={!!errors.assigneeId} {...register("assigneeId")}><StaffOptions /></Select>
          ) : (
            <>
              <input type="hidden" {...register("assigneeId")} />
              <Input id="t-assignee" value={user?.name ?? ""} disabled readOnly />
            </>
          )}
        </Field>
        <Field id="t-case" label="Related case">
          <Select
            id="t-case"
            {...register("caseId", {
              onChange: (e) => {
                const c = db.cases.find((x) => x.id === e.target.value);
                if (c) setValue("animalId", c.animalId);
              },
            })}
          >
            <option value="">No case</option>
            {cases.map((c) => (
              <option key={c.id} value={c.id}>Token {c.token} — {db.animals.find((a) => a.id === c.animalId)?.name} ({c.id})</option>
            ))}
          </Select>
        </Field>
        <Field id="t-animal" label="Related animal" hint={caseId ? "Set from the case" : undefined}>
          <Select id="t-animal" disabled={!!caseId} {...register("animalId")}>
            <option value="">No animal (general task)</option>
            {animals.map((a) => <option key={a.id} value={a.id}>{a.name} (token {a.token})</option>)}
          </Select>
        </Field>
        <Field id="t-date" label="Due date" required error={errors.dueDate?.message}>
          <Input id="t-date" type="date" aria-invalid={!!errors.dueDate} {...register("dueDate")} />
        </Field>
        <Field id="t-time" label="Due time" required error={errors.dueTime?.message}>
          <Input id="t-time" type="time" aria-invalid={!!errors.dueTime} {...register("dueTime")} />
        </Field>
        <Field id="t-pri" label="Priority" required>
          <Select id="t-pri" {...register("priority")}>{TASK_PRIORITIES.map((p) => <option key={p}>{p}</option>)}</Select>
        </Field>
        <Field id="t-status" label="Status" required>
          <Select id="t-status" {...register("status")}>{TASK_STATUSES.map((p) => <option key={p}>{p}</option>)}</Select>
        </Field>
        <Field id="t-desc" label="Details" className="sm:col-span-2">
          <Textarea id="t-desc" rows={2} {...register("description")} placeholder="Anything the person doing this should know" />
        </Field>
      </form>
    </Dialog>
  );
}
