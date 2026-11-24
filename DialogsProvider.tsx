import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Animal, CaseStatus, DutySchedule, Staff, Task, UpdateType } from "@/lib/types";

import AnimalFormDialog from "./AnimalForm";
import CaseFormDialog from "./CaseForm";
import CareUpdateDialog from "./CareUpdateForm";
import TaskFormDialog from "./TaskForm";
import HandoverFormDialog from "./HandoverForm";
import StaffFormDialog from "./StaffForm";
import DutyFormDialog from "./DutyForm";
import SurgeryFormDialog from "./SurgeryForm";

export type DialogRequest =
  | { kind: "animal"; animal?: Animal }
  | { kind: "case"; animalId?: string }
  | { kind: "careUpdate"; caseId?: string; preset?: { type?: UpdateType; status?: CaseStatus } }
  | { kind: "task"; task?: Task; defaults?: Partial<Task> }
  | { kind: "handover"; caseId?: string }
  | { kind: "staff"; staff?: Staff }
  | { kind: "duty"; duty?: DutySchedule; defaults?: Partial<DutySchedule> }
  | { kind: "surgery"; caseId: string };

interface Ctx {
  open(req: DialogRequest): void;
}
const DialogsContext = createContext<Ctx | null>(null);

export function DialogsProvider({ children }: { children: ReactNode }) {
  const [req, setReq] = useState<DialogRequest | null>(null);
  const [nonce, setNonce] = useState(0);
  const open = useCallback((r: DialogRequest) => {
    setNonce((n) => n + 1);
    setReq(r);
  }, []);
  const close = useCallback(() => setReq(null), []);
  const value = useMemo(() => ({ open }), [open]);

  const common = { key: nonce, onClose: close };
  let node: ReactNode = null;
  if (req) {
    switch (req.kind) {
      case "animal": node = <AnimalFormDialog {...common} animal={req.animal} />; break;
      case "case": node = <CaseFormDialog {...common} animalId={req.animalId} />; break;
      case "careUpdate": node = <CareUpdateDialog {...common} caseId={req.caseId} preset={req.preset} />; break;
      case "task": node = <TaskFormDialog {...common} task={req.task} defaults={req.defaults} />; break;
      case "handover": node = <HandoverFormDialog {...common} caseId={req.caseId} />; break;
      case "staff": node = <StaffFormDialog {...common} staff={req.staff} />; break;
      case "duty": node = <DutyFormDialog {...common} duty={req.duty} defaults={req.defaults} />; break;
      case "surgery": node = <SurgeryFormDialog {...common} caseId={req.caseId} />; break;
    }
  }
  return (
    <DialogsContext.Provider value={value}>
      {children}
      {node}
    </DialogsContext.Provider>
  );
}

export function useDialogs() {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error("useDialogs must be used within DialogsProvider");
  return ctx;
}
